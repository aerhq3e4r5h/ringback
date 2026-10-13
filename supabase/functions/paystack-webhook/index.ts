// Paystack → Ringback. Paystack calls this on every payment event; it must be deployed with --no-verify-jwt.
// Every request is checked against the x-paystack-signature header, and each event is applied once.
import { handleEvent, verifyPaystackSignature } from '../_shared/core.ts';
import { realDeps } from '../_shared/deps.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  const ok = await verifyPaystackSignature(raw, req.headers.get('x-paystack-signature'), Deno.env.get('PAYSTACK_SECRET_KEY') || '');
  if (!ok) return new Response('bad signature', { status: 401 });
  let evt;
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  try {
    const result = await handleEvent(realDeps(), evt);
    console.log(evt.event, result);
    return new Response(result);
  } catch (e) {
    // A 500 makes Paystack retry later; the event isn't marked processed unless it got past the idempotency insert.
    console.error(evt && evt.event, (e as Error).message);
    return new Response('error', { status: 500 });
  }
});
