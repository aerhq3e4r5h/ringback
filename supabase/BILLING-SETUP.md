# Card payments, plan limits and Vapi automation: setup

This switches on paying by card in the client portal, with everything that follows from it handled
automatically. Do it in **Paystack test mode first**, check it end to end, then switch to live keys
(step 10).

## How it works

1. **The client pays.** They pick a plan in the portal and tap **Pay by card**. Paystack's secure page takes
   the once-off setup fee plus the first month. We never see the card number.
2. **Paystack tells Ringback.** The `paystack-webhook` function checks Paystack's signature, then:
   - activates the plan and records both payments as paid invoices in the portal
   - saves the card for later charges
   - starts a monthly Paystack subscription from the next billing date
   - applies the plan's settings to the client's Vapi assistant
   - emails you and the client
3. **Every month** Paystack charges the card, and the plan rolls on to the next month with a new paid invoice.
4. **Limits.** The `billing-daily` function runs once a day:
   - **Minutes:** it counts each client's minutes and emails them at 80% and 100% of their allowance.
     Ringback keeps answering past 100%.
   - **Extra minutes:** when a billing month closes, extra minutes are charged to the saved card at the plan's
     rate (R5 + VAT if you're registered). If that charge fails, they get an ordinary invoice due in 7 days.
   - **Features:** Afrikaans and other per-plan settings are applied to the client's Vapi assistant, using
     the plan's `vapi_patch`.
5. **Failed payments.** The client gets an email and a red banner in the portal. After `GRACE_DAYS` (7) the
   automation pauses them: their Ringback number is detached from their assistant in Vapi, so forwarded calls
   stop being answered. Paying switches it straight back on.
6. **Cancellations.** Ringback keeps answering until the end of the paid month, then pauses.

You manage all of this in **Admin → Subscriptions**: link each client's Vapi assistant, approve founding
partners, switch plans, pause, resume and re-sync.

## What you need

- A **Paystack** business account (paystack.com) with South African payouts set up. Test mode works
  straight away. Live mode needs Paystack to approve your business; CIPC registration helps.
- Your **Vapi** private API key (Vapi dashboard → API Keys → Private key).
- Optional, for the emails: a **Resend** API key and a sender address on your domain. You may already have
  these from setting up the login emails (`AUTH-SETUP.md`). Without them the automation still runs; it just
  doesn't send emails, and the portal still shows everything.
- **Node.js** on your computer, so you can run `npx supabase …`. Get it from nodejs.org.

Menus get renamed from time to time. If a label below doesn't match exactly, look for the closest one.

## 1. Run the SQL

In Supabase → **SQL editor**, run these files in this order. Each is safe to re-run.
1. `supabase/calls_followup.sql` (call length and the other call columns)
2. `supabase/protect_status.sql`
3. `supabase/billing.sql`

## 2. Connect the Supabase CLI to your project

In a terminal, in this repository's folder:

```
npx supabase login
npx supabase link --project-ref mmjbhckqqcvixhzehgvg
```

## 3. Set the secrets

These never go on the website. Use your Paystack **test** secret key for now. For `CRON_SECRET` and
`VAPI_WEBHOOK_SECRET`, make up two long random strings (a password manager can generate them).

```
npx supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx \
  VAPI_PRIVATE_KEY=xxxxxxxx \
  VAPI_WEBHOOK_SECRET=a-long-random-string \
  CRON_SECRET=another-long-random-string \
  OWNER_EMAIL=you@yourdomain.co.za \
  SITE_URL=https://aerhq3e4r5h.github.io/ringback/ \
  GRACE_DAYS=7 \
  RESEND_API_KEY=re_xxxxxxxx \
  NOTIFY_FROM="Ringback <billing@yourdomain.co.za>"
```

Leave out the two Resend lines if you don't use Resend.

## 4. Deploy the functions

```
npx supabase functions deploy billing paystack-webhook billing-daily vapi-calls
```

`supabase/config.toml` already tells Supabase which functions are called from outside (Paystack, the daily job
and Vapi). Those functions check their own signature or secret instead of a login.

## 5. Point Paystack at the webhook

Paystack dashboard → **Settings → API Keys & Webhooks** → **Test Webhook URL**:

```
https://mmjbhckqqcvixhzehgvg.supabase.co/functions/v1/paystack-webhook
```

You don't need to set a callback URL; the portal sends its own.

## 6. Switch on payments in the portal and create the plans

1. In `config.js`, set `payments: true` and publish the site.
2. Log in. You land in Admin. Go to **Subscriptions** and tap **Create Paystack plans**. This creates
   monthly plans for Founding, Starter and Pro in Paystack, at your `plan_catalog` prices plus VAT if you're
   VAT-registered, and saves their codes.
   - Founding is created with 1 further monthly charge, because month 1 is paid at checkout: 60 days in total.

**Prices** live in the `plan_catalog` table (Supabase → Table editor), in cents, excluding VAT. If you change a
price there, create a new Paystack plan for it:
1. Clear that plan's `paystack_plan_code`.
2. Tap **Create Paystack plans** again.
3. Move existing subscribers across with **Switch plan** in admin.

Keep `RB.PLANS` in `site.js` and the pricing page in step with any price change.

## 7. Schedule the daily job

Supabase → **Integrations → Cron** → **Create job**. Daily at 06:15 South African time is `15 4 * * *` (UTC).
Choose an HTTP request:
- **Method:** POST
- **URL:** `https://mmjbhckqqcvixhzehgvg.supabase.co/functions/v1/billing-daily`
- **Header:** `x-cron-secret: <your CRON_SECRET>`

Or run this in the SQL editor, with the `pg_cron` and `pg_net` extensions switched on (Database → Extensions):

```sql
select cron.schedule('ringback-billing-daily', '15 4 * * *', $$
  select net.http_post(
    url := 'https://mmjbhckqqcvixhzehgvg.supabase.co/functions/v1/billing-daily',
    headers := '{"x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb
  );
$$);
```

## 8. Link each client to Vapi

Admin → **Subscriptions** → **Manage** next to the client:
- **Vapi assistant id:** Vapi → Assistants → the client's assistant → copy the id.
- **Vapi phone number id:** Vapi → Phone Numbers → the Ringback number this client forwards to → copy the id.
  Pausing and resuming works by detaching and re-attaching this number.
- **Founding partner:** tick it for an approved founding partner. Only ticked clients can pay for that plan.

**Counting minutes.** Minutes come from the length of each call in the `calls` table. If your calls aren't
already logged with their length by another webhook, use the `vapi-calls` function. On each client's assistant
in Vapi, set:
- **Server URL:** `https://mmjbhckqqcvixhzehgvg.supabase.co/functions/v1/vapi-calls`
- **Server URL secret:** your `VAPI_WEBHOOK_SECRET`

Every finished call is then stored with its length, summary, transcript and recording link. Don't use both
this and another call-logging webhook, or calls appear twice. For the outcome, suburb, caller name, problem
and booked slot, add an **analysis structured data** schema to the assistant with fields named `outcome`
(emergency / booked / callback / other), `suburb`, `caller_name`, `problem` and `booked_slot`.

**Plan features in Vapi.** `plan_catalog.vapi_patch` is JSON that gets applied to the client's assistant when
they're on that plan. For example, Pro could switch on a multilingual transcriber for Afrikaans:

```json
{ "transcriber": { "provider": "deepgram", "model": "nova-2", "language": "multi" } }
```

Vapi replaces a whole object like `transcriber` when you send it, so include every setting that object needs,
not just the one you're changing. Leave `vapi_patch` as `{}` to change nothing. After editing it, use
**Sync to Vapi** on a client to apply it straight away.

## 9. Test it (Paystack test mode)

1. Log in as a test client, finish the setup form, choose **Starter**, and tap **Pay by card**.
2. Pay with one of Paystack's test cards (Paystack docs → Test Payments). You land back in the portal, which
   says "Confirming your payment…" and then **Active**.
3. Check:
   - **Billing:** two paid invoices, setup and month 1.
   - **Admin → Subscriptions:** Active, with the next charge date.
   - **Paystack → Subscriptions:** a subscription starting next month.
   - **Supabase → Table editor → billing_events:** the events Paystack sent.
4. Run the daily job once by hand to see what it does:
   ```
   curl -X POST -H "x-cron-secret: YOUR_CRON_SECRET" https://mmjbhckqqcvixhzehgvg.supabase.co/functions/v1/billing-daily
   ```

If something doesn't happen, check Supabase → **Edge Functions → Logs** for that function.

## 10. Go live

1. `npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxxxx`
2. In Paystack's **Live Webhook URL**, set the same webhook URL as in step 5.
3. Test-mode plan codes don't exist in live mode, so clear them and create live ones. In the SQL editor run
   `update public.plan_catalog set paystack_plan_code = null;`, then tap **Create Paystack plans** in admin.
4. Make one real small payment yourself, and refund it in Paystack.

## Good to know

- **Refunds and disputes** are done in the Paystack dashboard. If you refund a payment, also mark its invoice
  void in admin.
- **Plan changes.** Clients tap **Ask to switch** in the portal, which shows up in Admin → Account requests.
  You then use **Switch plan**. The new price starts on their next billing date, with no new setup fee.
- **EFT still works.** Clients who don't pay by card keep getting invoices from **Create this month's
  invoices**, which now skips anyone paying by card.
- **Fees.** Paystack charges a fee per transaction. Check their current South African pricing.
- **Privacy.** The privacy policy now lists Paystack as the card processor. The card token Paystack gives us
  (which lets us charge extra minutes) is stored in `billing_private`, which only admins and the functions
  can read.
