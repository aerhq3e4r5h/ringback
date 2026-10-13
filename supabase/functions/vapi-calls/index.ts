// Vapi → Ringback: records every finished call (with its length, so minutes can be counted) in the calls table.
// Set this function's URL as the Server URL on each client's assistant in Vapi, with the same secret as
// VAPI_WEBHOOK_SECRET in Vapi's "Server URL secret". Deploy with --no-verify-jwt.
// Only use it if your calls aren't already logged by another webhook, or calls will appear twice.
import { recordVapiCall } from '../_shared/core.ts';
import { realDeps } from '../_shared/deps.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = Deno.env.get('VAPI_WEBHOOK_SECRET') || '';
  if (!secret || req.headers.get('x-vapi-secret') !== secret) return new Response('forbidden', { status: 403 });
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  try {
    const r = await recordVapiCall(realDeps(), body);
    return new Response(JSON.stringify({ result: r }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error((e as Error).message);
    return new Response('error', { status: 500 });
  }
});
