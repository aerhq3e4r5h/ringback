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
