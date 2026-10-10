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
