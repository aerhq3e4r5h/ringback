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
