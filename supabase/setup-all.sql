-- =====================================================================================================
-- Ringback: ALL database setup in one go.
--
-- How to run it:
--   1. Open https://supabase.com/dashboard → your Ringback project → SQL editor → New query.
--   2. Paste this whole file and press Run. You should see "Success. No rows returned".
--   3. Run the checks at the very bottom (they're commented out) to confirm.
--
-- It is safe to run more than once: every step creates things only if they're missing, and never deletes
-- your data or overwrites prices you've edited.
--
-- It contains, in this order (the same as the separate files in supabase/):
--   1. founding_spots.sql   founding-partner places counter on the pricing page and in the portal
--   2. calls_followup.sql   call length, summary, transcript, "called back" in the portal
--   3. protect_status.sql   clients can't change their own account status
--   4. billing.sql          card payments, plan limits, usage, Vapi ids (also extends step 3 to billing columns)
--
-- If it stops with an error, nothing after the error is applied. Copy the error message and send it to us.
-- =====================================================================================================



-- =====================================================================================================
-- founding_spots.sql
-- =====================================================================================================

-- Founding partner places counter for pricing.html.
--
-- Run this once in Supabase: Dashboard → SQL editor → New query → paste → Run.
--
-- It doesn't open up the profiles table. Row-level security on profiles stays exactly as it is;
-- this function runs with the owner's rights (security definer) and returns only two numbers,
-- never any client data. Visitors who aren't logged in may call it, and nothing else.
--
-- A place counts as taken when a client is on the founding plan and their status is one of the
-- statuses below. Change the list or the total here if that's not how you count them.

create or replace function public.founding_spots()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', 3,
    'taken', least(3, (
      select count(*)::int
      from public.profiles
      where plan = 'founding'
        and status in ('setting_up', 'trial', 'live')
    ))
  );
$$;

revoke all on function public.founding_spots() from public;
grant execute on function public.founding_spots() to anon, authenticated;

-- Check it: select public.founding_spots();


-- =====================================================================================================
-- calls_followup.sql
-- =====================================================================================================

-- Calls follow-up: "Mark as called back" in the client portal, plus optional call details.
--
-- Run this once in Supabase: Dashboard → SQL editor → New query → paste → Run. It is safe to run again.
--
-- What it does
--   1. Adds four columns to public.calls (only if they're missing):
--        handled_at        when the client marked the call as called back (null = still to call back)
--        summary           a short summary of the call
--        transcript        the call transcript as text, one line per turn, e.g. "Caller: ..." / "Assistant: ..."
--        duration_seconds  how long the call lasted
--   2. Adds public.client_mark_call(p_call, p_done): a client can mark ONE of their own calls as called back
--      (or undo it). It can't change anything else, and it can't touch another client's calls.
--
-- Until this runs, the portal hides "Mark as called back", the "Still to call back" chip and KPI, and the
-- admin count. The summary, transcript and duration blocks in the call drawer only show when a call has them.
--
-- Your call webhook (the one that inserts rows into public.calls) should fill summary, transcript and
-- duration_seconds when it has them. The portal reads transcript as plain text; lines starting with
-- "User:", "Caller:" or "Customer:" show as Caller, and "Assistant:", "AI:" or "Bot:" as Assistant.

alter table public.calls add column if not exists handled_at timestamptz;
alter table public.calls add column if not exists summary text;
alter table public.calls add column if not exists transcript text;
alter table public.calls add column if not exists duration_seconds integer;

create or replace function public.client_mark_call(p_call text, p_done boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.calls
     set handled_at = case when p_done then now() else null end
   where id::text = p_call
     and user_id = auth.uid();
$$;

revoke all on function public.client_mark_call(text, boolean) from public;
grant execute on function public.client_mark_call(text, boolean) to authenticated;

-- Check it, logged in as a client (or with "Role: authenticated" in the SQL editor):
--   select public.client_mark_call('<a call id>', true);
-- To remove it: drop function public.client_mark_call(text, boolean);
-- (The columns can stay; the portal simply stops showing the button once the function is gone.)


-- =====================================================================================================
-- protect_status.sql
-- =====================================================================================================

-- Protect a client's status from client edits.
--
-- Run this once in Supabase: Dashboard → SQL editor → New query → paste → Run. It is safe to run again.
--
-- Why: clients update their own row in public.profiles directly (business details, plan, trial request).
-- Row-level security lets them update their row, and unless column grants say otherwise that includes the
-- status column ("new", "setting_up", "trial", "live", "paused"). Status is yours to set from admin, so this
-- trigger quietly keeps the old status whenever a logged-in non-admin updates a profile.
--
-- Who it affects
--   - Logged-in clients: any change they make to status is ignored; everything else saves as normal.
--   - You (public.is_admin() is true): not affected; admin status changes work as before.
--   - Webhooks and scripts using the service-role key: auth.uid() is null, so not affected.
--
-- How to test it: log in to the portal as a client, then in the browser console run
--   await RB.sb.from('profiles').update({ status: 'live' }).eq('id', (await RB.sb.auth.getUser()).data.user.id).select()
-- The returned row still has the old status. Changing it from admin still works.
--
-- How to remove it:
--   drop trigger if exists protect_status on public.profiles;
--   drop function if exists public.protect_profile_status();

create or replace function public.protect_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not coalesce(public.is_admin(), false) then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_status on public.profiles;
create trigger protect_status
  before update on public.profiles
  for each row
  execute function public.protect_profile_status();


-- =====================================================================================================
-- billing.sql
-- =====================================================================================================

-- Ringback billing: Paystack subscriptions, plan entitlements, usage metering and Vapi sync.
--
-- Run this once in Supabase: Dashboard → SQL editor → New query → paste → Run. It is safe to run again.
-- Run calls_followup.sql and protect_status.sql first (this file builds on calls.duration_seconds and
-- extends the status protection to the billing columns).
--
-- What it adds
--   plan_catalog        the plans: prices, included minutes, extra-minute price, features, the Paystack plan code
--                       and an optional Vapi patch applied to a client's assistant on that plan. Public read-only.
--   billing_private     per-client secrets the website never sees: the Paystack card token and the client's
--                       Vapi assistant / phone number ids. Admin-only.
--   billing_events      every Paystack webhook we processed, so a repeated delivery is never applied twice.
--   usage_marks         which usage warnings (80%, 100%) and period settlements already happened.
--   profiles columns    billing_status, plan_active, period_start/end, card details for display, etc.
--                       Clients can read these on their own row but cannot change them (trigger below).
--   invoices columns    provider and provider_ref (unique), so card payments become ordinary paid invoices.
--   calls.external_id   the Vapi call id, so a call reported twice is stored once.
--   my_usage()          the signed-in client's minutes for the current billing period.

-- ---------------------------------------------------------------- plans
create table if not exists public.plan_catalog (
  key              text primary key,                 -- 'founding' | 'starter' | 'pro'
  name             text not null,
  monthly_cents    integer not null,                 -- excl. VAT
  setup_cents      integer not null default 0,       -- excl. VAT, charged once with the first payment
  minutes          integer not null,                 -- included minutes per billing month
  extra_min_cents  integer not null default 500,     -- excl. VAT, per minute over the allowance
  invoice_limit    integer,                          -- total monthly charges, e.g. founding = 2 (60 days); null = until cancelled
  features         jsonb not null default '{}'::jsonb,
  paystack_plan_code text,                           -- filled by the billing-manage 'setup-plans' action, or by hand
  vapi_patch       jsonb not null default '{}'::jsonb, -- merged into the client's Vapi assistant when they're on this plan
  sort             integer not null default 0
);

insert into public.plan_catalog (key, name, monthly_cents, setup_cents, minutes, extra_min_cents, invoice_limit, features, sort) values
  ('founding', 'Founding partner', 150000, 0,      250, 500, 2,    '{"afrikaans":false,"reviews":false,"followups":false,"report":false,"weekly_reviews":true}', 0),
  ('starter',  'Starter',          250000, 350000, 250, 500, null, '{"afrikaans":false,"reviews":false,"followups":false,"report":false}', 1),
  ('pro',      'Pro',              450000, 550000, 600, 500, null, '{"afrikaans":true,"reviews":true,"followups":true,"report":true}', 2)
on conflict (key) do nothing;   -- re-running never overwrites prices or codes you've edited

alter table public.plan_catalog enable row level security;
drop policy if exists plan_catalog_read on public.plan_catalog;
create policy plan_catalog_read on public.plan_catalog for select using (true);
drop policy if exists plan_catalog_admin on public.plan_catalog;
create policy plan_catalog_admin on public.plan_catalog for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- profile billing state (read-only for clients)
alter table public.profiles add column if not exists billing_status text not null default 'none';
  -- none | active | past_due | non_renewing | cancelled | ended
alter table public.profiles add column if not exists plan_active text references public.plan_catalog(key);
alter table public.profiles add column if not exists period_start timestamptz;
alter table public.profiles add column if not exists period_end timestamptz;
alter table public.profiles add column if not exists past_due_since timestamptz;
alter table public.profiles add column if not exists paused_reason text;   -- 'billing' | 'cancelled' when the automation paused them
alter table public.profiles add column if not exists card_brand text;
alter table public.profiles add column if not exists card_last4 text;
alter table public.profiles add column if not exists card_exp text;         -- 'MM/YY'
alter table public.profiles add column if not exists paystack_customer_code text;
alter table public.profiles add column if not exists paystack_subscription_code text;
alter table public.profiles add column if not exists billing_updated_at timestamptz;

-- ---------------------------------------------------------------- private per-client billing + Vapi ids
create table if not exists public.billing_private (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  authorization_code      text,      -- Paystack reusable card token: lets the automation charge extra minutes
  authorization_reusable  boolean,
  email_token             text,      -- Paystack subscription email token (needed to disable a subscription)
  vapi_assistant_id       text,      -- this client's assistant in Vapi
  vapi_phone_number_id    text,      -- this client's Ringback number in Vapi
  founding_approved       boolean not null default false,  -- you approve founding-partner applications in admin
  updated_at              timestamptz not null default now()
);
alter table public.billing_private add column if not exists founding_approved boolean not null default false;
alter table public.billing_private enable row level security;
drop policy if exists billing_private_admin on public.billing_private;
create policy billing_private_admin on public.billing_private for all using (public.is_admin()) with check (public.is_admin());
-- No client policy: clients can neither read nor write this table. The Edge Functions use the service role.

-- ---------------------------------------------------------------- webhook idempotency and usage marks
create table if not exists public.billing_events (
  id           text primary key,     -- '<event>:<reference or code>'
  type         text not null,
  user_id      uuid,
  received_at  timestamptz not null default now(),
  payload      jsonb
);
alter table public.billing_events enable row level security;
drop policy if exists billing_events_admin on public.billing_events;
create policy billing_events_admin on public.billing_events for select using (public.is_admin());

create table if not exists public.usage_marks (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  period_start  timestamptz not null,
  mark          text not null,       -- 'warn80' | 'warn100' | 'settled'
  detail        jsonb,
  created_at    timestamptz not null default now(),
  primary key (user_id, period_start, mark)
);
alter table public.usage_marks enable row level security;
drop policy if exists usage_marks_read on public.usage_marks;
create policy usage_marks_read on public.usage_marks for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- invoices and calls
alter table public.invoices add column if not exists provider text;        -- 'paystack' for card payments
alter table public.invoices add column if not exists provider_ref text;
create unique index if not exists invoices_provider_ref_key on public.invoices (provider_ref) where provider_ref is not null;

alter table public.calls add column if not exists external_id text;
create unique index if not exists calls_external_id_key on public.calls (external_id) where external_id is not null;

-- ---------------------------------------------------------------- usage for the signed-in client
-- Minutes are counted per call, rounded up to the next whole minute, over the current billing period
-- (the paid period when there is one, otherwise the calendar month).
create or replace function public.usage_for(p_user uuid, p_start timestamptz, p_end timestamptz)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'calls',          count(*)::int,
    'measured_calls', count(c.duration_seconds)::int,
    'minutes',        coalesce(sum(ceil(c.duration_seconds / 60.0)), 0)::int
  )
  from public.calls c
  where c.user_id = p_user and c.occurred_at >= p_start and c.occurred_at < p_end;
$$;
-- Supabase grants every new function to anon and authenticated by default, so revoke those explicitly.
revoke all on function public.usage_for(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_for(uuid, timestamptz, timestamptz) to service_role;
-- (only the service role and the functions below call it)

create or replace function public.my_usage()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  k public.plan_catalog;
  s timestamptz; e timestamptz; u json;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then return null; end if;
  select * into k from public.plan_catalog where key = coalesce(p.plan_active, p.plan);
  s := coalesce(p.period_start, date_trunc('month', now()));
  e := coalesce(p.period_end, date_trunc('month', now()) + interval '1 month');
  u := public.usage_for(p.id, s, e);
  return json_build_object(
    'plan', k.key, 'plan_name', k.name, 'paid', p.plan_active is not null,
    'included', k.minutes, 'extra_min_cents', k.extra_min_cents,
    'period_start', s, 'period_end', e,
    'calls', (u->>'calls')::int, 'measured_calls', (u->>'measured_calls')::int, 'minutes', (u->>'minutes')::int,
    'extra_minutes', greatest(0, (u->>'minutes')::int - coalesce(k.minutes, 0)),
    'features', coalesce(k.features, '{}'::jsonb)
  );
end;
$$;
revoke all on function public.my_usage() from public, anon;
grant execute on function public.my_usage() to authenticated;

-- Admin view of any client's usage.
create or replace function public.client_usage(p_user uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare p public.profiles; k public.plan_catalog; s timestamptz; e timestamptz; u json;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  select * into p from public.profiles where id = p_user;
  select * into k from public.plan_catalog where key = coalesce(p.plan_active, p.plan);
  s := coalesce(p.period_start, date_trunc('month', now()));
  e := coalesce(p.period_end, date_trunc('month', now()) + interval '1 month');
  u := public.usage_for(p_user, s, e);
  return json_build_object('included', k.minutes, 'minutes', (u->>'minutes')::int, 'calls', (u->>'calls')::int,
    'measured_calls', (u->>'measured_calls')::int, 'period_start', s, 'period_end', e);
end;
$$;
revoke all on function public.client_usage(uuid) from public, anon;
grant execute on function public.client_usage(uuid) to authenticated;

-- ---------------------------------------------------------------- clients can't change billing columns
-- Extends protect_status.sql: for a signed-in non-admin, every billing column keeps its old value.
-- Webhooks and the daily job use the service role (auth.uid() is null) and admins pass, so they can.
create or replace function public.protect_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not coalesce(public.is_admin(), false) then
    new.status                     := old.status;
    new.billing_status             := old.billing_status;
    new.plan_active                := old.plan_active;
    new.period_start               := old.period_start;
    new.period_end                 := old.period_end;
    new.past_due_since             := old.past_due_since;
    new.paused_reason              := old.paused_reason;
    new.card_brand                 := old.card_brand;
    new.card_last4                 := old.card_last4;
    new.card_exp                   := old.card_exp;
    new.paystack_customer_code     := old.paystack_customer_code;
    new.paystack_subscription_code := old.paystack_subscription_code;
    new.billing_updated_at         := old.billing_updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_status on public.profiles;
create trigger protect_status
  before update on public.profiles
  for each row
  execute function public.protect_profile_status();

-- Check it worked:
--   select key, name, monthly_cents, minutes, paystack_plan_code from public.plan_catalog order by sort;
--   select public.my_usage();   -- while logged in as a client (SQL editor runs as admin, so it returns null there)


-- =====================================================================================================
-- Checks: select these lines (without the leading --) and run them to confirm everything is in place.
-- =====================================================================================================
-- select public.founding_spots();                                         -- {"total": 3, "taken": 0} or similar
-- select key, name, monthly_cents, minutes from public.plan_catalog order by sort;   -- 3 plans
-- select column_name from information_schema.columns where table_name = 'calls' and column_name in ('duration_seconds','handled_at','external_id');   -- 3 rows
-- select column_name from information_schema.columns where table_name = 'profiles' and column_name in ('billing_status','plan_active','period_end');  -- 3 rows
-- select tgname from pg_trigger where tgname = 'protect_status';           -- 1 row
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.invoices'::regclass and contype = 'c';
--    ↑ lists any rules on invoices. If one limits "method" or "kind" (e.g. only 'eft'), card payments ('card', 'setup',
--      'monthly', 'extra') can't be recorded: send us the output and we'll give you the one-line fix.
