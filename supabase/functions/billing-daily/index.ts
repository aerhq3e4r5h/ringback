// The daily billing job: usage warnings, extra-minute charges at the end of each billing month,
// and pausing clients whose plan ended or whose payment has failed for longer than GRACE_DAYS.
// Deploy with --no-verify-jwt and call it once a day with the header  x-cron-secret: <CRON_SECRET>
// (see supabase/BILLING-SETUP.md for the Supabase Cron job that does this).
import { daily } from '../_shared/core.ts';
import { realDeps } from '../_shared/deps.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  const results = await daily(realDeps());
  console.log(JSON.stringify(results));
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
