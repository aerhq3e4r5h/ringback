// Portal and admin billing actions. Called from the website with the signed-in user's token.
//   { action: 'checkout', plan }                 client: start a card payment, returns { url }
//   { action: 'manage' }                         client: Paystack link to update the card or cancel
//   { action: 'change', user_id, plan }          admin: move a paying client to another plan from their next billing date
//   { action: 'pause' | 'resume', user_id }      admin: pause or resume a client (also in Vapi)
//   { action: 'sync-vapi', user_id }             admin: re-apply the client's plan settings in Vapi
//   { action: 'setup-plans' }                    admin: create the monthly plans in Paystack and save their codes
import { BillingError, applyVapi, changePlan, manageLink, setPause, setupPlans, startCheckout } from '../_shared/core.ts';
import { caller, cors, json, realDeps } from '../_shared/deps.ts';

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  const who = await caller(req);
  if (!who) return json({ error: 'Please log in again.', code: 'auth' }, 401, h);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const deps = realDeps();
  const adminOnly = () => { if (!who.admin) throw new BillingError('forbidden', 'Only the Ringback admin can do that.', 403); };
  try {
    switch (body.action) {
      case 'checkout': return json(await startCheckout(deps, who.id, who.email, String(body.plan || '')), 200, h);
      case 'manage': return json({ url: await manageLink(deps, who.id) }, 200, h);
      case 'change': adminOnly(); return json({ message: await changePlan(deps, String(body.user_id), String(body.plan)) }, 200, h);
      case 'pause': adminOnly(); return json({ message: await setPause(deps, String(body.user_id), true) }, 200, h);
      case 'resume': adminOnly(); return json({ message: await setPause(deps, String(body.user_id), false) }, 200, h);
      case 'sync-vapi': {
        adminOnly();
        const p = await deps.db.profile(String(body.user_id));
        const plan = p && await deps.db.plan(p.plan_active || p.plan);
        return json({ message: await applyVapi(deps, String(body.user_id), plan || {}, !!p && p.status !== 'paused') }, 200, h);
      }
      case 'setup-plans': adminOnly(); return json({ plans: await setupPlans(deps) }, 200, h);
      default: return json({ error: 'Unknown action.' }, 400, h);
    }
  } catch (e) {
    const be = e instanceof BillingError ? e : null;
    console.error(body.action, (e as Error).message);
    return json({ error: be ? be.message : 'Something went wrong on our side. Please try again, or WhatsApp us.', code: be ? be.code : 'server' }, be ? be.status : 500, h);
  }
});
