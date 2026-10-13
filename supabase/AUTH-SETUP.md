# Make login emails work

Ringback logs people in with a code sent by email. The website side is done. These steps are the Supabase and
email side, and only you can do them, because they need your Supabase login, an email provider account and your
domain's DNS. Set aside about an hour, most of it waiting for DNS.

Supabase renames and moves its menus from time to time. Every setting below is named by the label you'll see on
screen, so if a menu has moved, search for that label.

---

## 1. Why this is needed

Supabase's built-in mailer is only for testing. It sends only to the email addresses of your Supabase project's
team members, and only a couple of emails an hour. Real customers either see **"Email address not authorized"** or
get no email at all. To send codes to anyone, Supabase must send through your own email provider (custom SMTP).

## 2. A domain

You need a domain you control, such as `yourbusiness.co.za`, so codes come from `login@yourbusiness.co.za`.
If you don't have one, register a `.co.za` at any South African registrar (Afrihost, xneelo, Domains.co.za and
others). You'll need access to its **DNS** settings in step 4.

No domain yet? See the Gmail stopgap in step 3. Use it only until your domain is ready.

## 3. Pick an email provider

Any of these works. Free-tier limits are as at the time of writing; check the provider's current limits.

| Provider | Host | Port | Username | Password | Notes |
|---|---|---|---|---|---|
| **Resend** (simplest) | `smtp.resend.com` | `465` | `resend` | your Resend **API key** | Has a Supabase integration that can fill in SMTP Settings for you. Free tier at the time of writing: 3,000 emails a month, 100 a day. |
| **Brevo** | `smtp-relay.brevo.com` | `587` | your **SMTP login** (shown on Brevo's SMTP & API page, not your account email) | your **SMTP key** (not your account password) | Free tier at the time of writing: 300 emails a day. |
| **Gmail** (stopgap, no domain needed) | `smtp.gmail.com` | `465` | your full Gmail address | a 16-character **app password** | Needs 2-Step Verification on the Google account before Google lets you create an app password. Codes come from your own Gmail address, and Gmail limits how many you can send a day. |

In Resend or Brevo, add your domain (Resend: **Domains → Add domain**; Brevo: **Senders, domains & dedicated IPs →
Domains**). The provider then shows you the DNS records for step 4.

## 4. DNS: SPF, DKIM and DMARC

At your domain's DNS (at your registrar or host), add the records the provider shows you:

- **SPF**: a TXT record starting `v=spf1`. Resend puts its SPF on a `send` subdomain; Brevo uses your main domain.
- **DKIM**: one or more TXT or CNAME records the provider gives you. Copy them exactly.
- **DMARC**: a TXT record at host `_dmarc` with the value `v=DMARC1; p=none;`

> **Warning: a domain can have only ONE SPF record.** If your domain already has one (very common if your email is
> with Afrihost, xneelo or Google Workspace), do **not** add a second `v=spf1` record: two SPF records break both.
> Merge them into one, keeping every `include:` part, for example
> `v=spf1 include:_spf.google.com include:spf.brevo.com ~all`.

DNS can take from a few minutes to a few hours. Wait until the provider shows the domain as **Verified** before
step 5.

## 5. Turn on custom SMTP in Supabase

Supabase dashboard → your project → **Authentication → Emails → SMTP Settings**:

- **Enable Custom SMTP**: on
- **Sender email**: `login@yourdomain.co.za` (any address on the verified domain; for Gmail, your Gmail address)
- **Sender name**: `Ringback`
- **Host**, **Port number**, **Username**, **Password**: from the table in step 3
- **Minimum interval between emails being sent** (may show as "per user"): `60` seconds

Save.

## 6. Paste the two email templates

**Authentication → Emails → Templates**. Supabase sends **Confirm signup** to a brand-new email address and
**Magic Link** to someone who already has an account. Both must contain the code, so replace both:

| Template | Subject | Message body |
|---|---|---|
| **Magic Link** | `Your Ringback login code` | the whole of `supabase/email/magic-link.html` |
| **Confirm signup** | `Your code to finish signing up` | the whole of `supabase/email/confirm-signup.html` |

Paste the files exactly as they are, including the first lines. `{{ .Token }}` becomes the code and
`{{ .TokenHash }}` makes the "Or tap to finish logging in" button work. Save each one.

## 7. URL Configuration

**Authentication → URL Configuration**:

- **Site URL**: `https://aerhq3e4r5h.github.io/ringback`
- **Redirect URLs**: add `https://aerhq3e4r5h.github.io/ringback/**`

## 8. Email provider settings

**Authentication → Sign In / Providers → Email** (older dashboards: **Providers → Email**):

- **Enable Email provider**: on
- **Confirm email**: on
- **Email OTP Length**: `6`. This must equal `otpLength` in `config.js`.
- **Email OTP Expiration**: `600` seconds. This matches `otpExpiryMinutes: 10` in `config.js` and the FAQ's "10 minutes".

Also check that **Allow new users to sign up** (under **Authentication → Sign In / Providers**, "User Signups") is on,
or nobody new can create an account.

## 9. Rate limits

**Authentication → Rate Limits**: once custom SMTP is on, raise **Rate limit for sending emails** to about
`60`–`100` an hour. The default is low, and when it runs out customers see "We can't send login emails right now"
and are asked for their cellphone instead.

## 10. Leave CAPTCHA off

**Authentication → Attack Protection → Enable Captcha protection**: leave it **OFF**. The log-in page doesn't send a
captcha token, so turning it on would make every login fail.

## 11. Test it, then tell customers who sends their email

1. Open **`https://aerhq3e4r5h.github.io/ringback/login.html?check=1`**. It checks the config and the auth server,
   sends a test code and verifies it, and gives you a report to copy into WhatsApp.
2. Work through its inbox checklist on **Gmail (Android)**, **iPhone Mail** and the **Outlook app**:
   did the code arrive within 2 minutes, in the inbox (not spam), showing a 6-digit code, from your domain, with the
   code visible in the lock-screen preview, and does the button open "Finish logging in"? Check the spam folder too.
3. Set `email` in `config.js` to a mailbox you read.
4. Name your provider (for example "Resend" or "Brevo") in the **Email delivery provider** row of `privacy.html`, or
   ask us to.

If anything fails, the self-check says which step above to revisit.
