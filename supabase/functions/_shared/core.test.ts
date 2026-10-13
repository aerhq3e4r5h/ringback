// Billing core tests with in-memory fakes (no network). Run: deno run supabase/functions/_shared/core.test.ts
// or: node --experimental-strip-types supabase/functions/_shared/core.test.ts
import * as core from './core.ts';
import { createHmac } from 'node:crypto';

let fails = 0, passes = 0;
function ok(cond: any, msg: string) { if (cond) passes++; else { fails++; console.log('FAIL', msg); } }
function eq(a: any, b: any, msg: string) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

function world(opts: any = {}) {
  const W: any = {
    now: new Date(opts.now || '2026-10-14T08:00:00Z'),
    profiles: { u1: Object.assign({ id: 'u1', email: 'pieter@example.com', business_name: 'Ridgeway Plumbing', plan: 'starter', status: 'trial', billing_status: 'none' }, opts.profile || {}) },
    plans: {
      founding: { key: 'founding', name: 'Founding partner', monthly_cents: 150000, setup_cents: 0, minutes: 250, extra_min_cents: 500, invoice_limit: 2, paystack_plan_code: 'PLN_f', vapi_patch: {} },
      starter: { key: 'starter', name: 'Starter', monthly_cents: 250000, setup_cents: 350000, minutes: 250, extra_min_cents: 500, invoice_limit: null, paystack_plan_code: 'PLN_s', vapi_patch: { transcriber: { language: 'en' } } },
      pro: { key: 'pro', name: 'Pro', monthly_cents: 450000, setup_cents: 550000, minutes: 600, extra_min_cents: 500, invoice_limit: null, paystack_plan_code: 'PLN_p', vapi_patch: { transcriber: { language: 'multi' } } },
    },
    priv: { u1: Object.assign({ user_id: 'u1', vapi_assistant_id: 'asst_1', vapi_phone_number_id: 'pn_1' }, opts.priv || {}) },
    events: new Set(), invoices: [] as any[], marks: new Set(), calls: [] as any[], minutes: opts.minutes || 0,
    settings: { vat_registered: !!opts.vat },
    paystackCalls: [] as any[], vapiCalls: [] as any[], emails: [] as any[],
    paystackFail: opts.paystackFail || {},
  };
  const deps: core.Deps = {
    db: {
      profile: async (id) => W.profiles[id] ? Object.assign({}, W.profiles[id]) : null,
      profileBy: async (f, v) => { const p = Object.values(W.profiles).find((x: any) => x[f] === v); return p ? Object.assign({}, p) : null; },
      updateProfile: async (id, patch) => { Object.assign(W.profiles[id], patch); },
      plan: async (k) => W.plans[k] || null,
      planByCode: async (c) => Object.values(W.plans).find((x: any) => x.paystack_plan_code === c) || null,
      plans: async () => Object.values(W.plans),
      updatePlan: async (k, patch) => { Object.assign(W.plans[k], patch); },
      priv: async (id) => W.priv[id] ? Object.assign({}, W.priv[id]) : null,
      privBy: async (f, v) => Object.values(W.priv).find((x: any) => x[f] === v) || null,
      upsertPriv: async (id, patch) => { W.priv[id] = Object.assign(W.priv[id] || { user_id: id }, patch); },
      addEvent: async (id) => { if (W.events.has(id)) return false; W.events.add(id); return true; },
      removeEvent: async (id) => { W.events.delete(id); },
      addInvoice: async (row) => { if (row.provider_ref && W.invoices.some((i: any) => i.provider_ref === row.provider_ref)) return false; W.invoices.push(row); return true; },
      markInvoicePaid: async (ref, patch) => { W.invoices.filter((i: any) => i.provider_ref === ref).forEach((i: any) => Object.assign(i, patch)); },
      usage: async () => ({ calls: 10, measured_calls: 10, minutes: W.minutes }),
      addMark: async (u, s, m) => { const k = u + s + m; if (W.marks.has(k)) return false; W.marks.add(k); return true; },
      settings: async () => W.settings,
      billedProfiles: async () => Object.values(W.profiles).filter((p: any) => p.plan_active).map((p: any) => Object.assign({}, p)),
      addCall: async (row) => { if (W.calls.some((c: any) => c.external_id === row.external_id)) return false; W.calls.push(row); return true; },
    },
    paystack: async (m, p, b) => {
      W.paystackCalls.push([m, p, b]);
      if (W.paystackFail[p]) throw new Error('paystack ' + p + ' failed');
      if (p === '/transaction/initialize') return { status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: b.reference } };
      if (p === '/subscription') return { status: true, data: { subscription_code: 'SUB_' + b.plan, email_token: 'tok_' + b.plan } };
      if (p === '/transaction/charge_authorization') return { status: true, data: { status: W.chargeStatus || 'success', reference: b.reference } };
      if (p.endsWith('/manage/link')) return { status: true, data: { link: 'https://paystack.com/manage/xyz' } };
      if (p === '/plan') return { status: true, data: { plan_code: 'PLN_new_' + b.name.split(' ').pop() } };
      return { status: true, data: {} };
    },
    vapi: async (m, p, b) => { W.vapiCalls.push([m, p, b]); return {}; },
    notify: async (to, subject, text) => { W.emails.push({ to, subject, text }); },
    now: () => W.now,
    env: { siteUrl: 'https://site/', ownerEmail: 'owner@example.com', graceDays: 7, log: () => {} },
  };
  return { W, deps };
}

const firstEvt = (over: any = {}) => ({ event: 'charge.success', data: Object.assign({
  status: 'success', currency: 'ZAR', reference: 'rb_f_u1_x', amount: 600000, paid_at: '2026-10-14T08:00:00Z',
  metadata: { user_id: 'u1', plan: 'starter', kind: 'first' },
  customer: { customer_code: 'CUS_1', email: 'pieter@example.com' },
  authorization: { authorization_code: 'AUTH_1', reusable: true, last4: '4081', card_type: 'visa ', exp_month: '12', exp_year: '2030' },
}, over) });

// ---------- signature
{
  const raw = JSON.stringify({ event: 'x' }), secret = 'sk_test_abc';
  const sig = createHmac('sha512', secret).update(raw).digest('hex');
  ok(await core.verifyPaystackSignature(raw, sig, secret), 'valid signature accepted');
  ok(!await core.verifyPaystackSignature(raw + ' ', sig, secret), 'tampered body rejected');
  ok(!await core.verifyPaystackSignature(raw, null, secret), 'missing signature rejected');
  ok(!await core.verifyPaystackSignature(raw, sig, ''), 'missing secret rejected');
}
// ---------- dates and money
eq(core.addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString(), '2026-02-28T10:00:00.000Z', 'Jan 31 + 1 month clamps to Feb 28');
eq(core.withVat(250000, { vat_registered: true }), 287500, 'VAT added when registered');
eq(core.withVat(250000, {}), 250000, 'no VAT when not registered');

// ---------- checkout
{
  const { W, deps } = world();
  const r = await core.startCheckout(deps, 'u1', 'pieter@example.com', 'starter');
  eq(r.amount, 600000, 'starter first payment = setup R3,500 + month R2,500');
  const init = W.paystackCalls[0][2];
  eq([init.currency, init.channels, init.metadata.kind, init.metadata.plan], ['ZAR', ['card'], 'first', 'starter'], 'initialize body');
  ok(init.callback_url.startsWith('https://site/dashboard.html?paid='), 'callback to portal');
  let err: any; try { await core.startCheckout(deps, 'u1', '', 'founding'); } catch (e) { err = e; }
  eq(err && err.code, 'founding_needs_approval', 'founding blocked without approval');
  W.priv.u1.founding_approved = true;
  eq((await core.startCheckout(deps, 'u1', '', 'founding')).amount, 150000, 'founding allowed once approved, no setup fee');
  W.profiles.u1.plan_active = 'starter'; W.profiles.u1.billing_status = 'active';
  err = null; try { await core.startCheckout(deps, 'u1', '', 'pro'); } catch (e) { err = e; }
  eq(err && err.code, 'already_paying', 'cannot double-subscribe');
}
{
  const { W, deps } = world({ vat: true });
  eq((await core.startCheckout(deps, 'u1', '', 'pro')).amount, Math.round(1000000 * 1.15), 'pro first payment with VAT');
}

// ---------- first payment webhook
{
  const { W, deps } = world({ profile: { status: 'paused', paused_reason: 'billing' } });
  const res = await core.handleEvent(deps, firstEvt());
  ok(res.startsWith('activated starter'), 'first payment activates: ' + res);
  const p = W.profiles.u1;
  eq([p.plan_active, p.billing_status, p.card_last4, p.card_brand, p.card_exp, p.paystack_customer_code], ['starter', 'active', '4081', 'visa', '12/30', 'CUS_1'], 'profile after first payment');
  eq([p.period_start, p.period_end], ['2026-10-14T08:00:00.000Z', '2026-11-14T08:00:00.000Z'], 'period is one month');
  eq([p.status, p.paused_reason], ['live', null], 'billing-paused client is switched back on');
  eq(W.invoices.map((i: any) => [i.kind, i.amount_cents, i.status, i.provider_ref]), [['setup', 350000, 'paid', 'rb_f_u1_x:setup'], ['monthly', 250000, 'paid', 'rb_f_u1_x:m1']], 'setup + month-1 invoices recorded as paid');
  const sub = W.paystackCalls.find((c: any) => c[1] === '/subscription');
  eq(sub && [sub[2].plan, sub[2].authorization, sub[2].start_date], ['PLN_s', 'AUTH_1', '2026-11-14T08:00:00.000Z'], 'subscription starts when month 1 ends');
  eq([p.paystack_subscription_code, W.priv.u1.email_token, W.priv.u1.authorization_code], ['SUB_PLN_s', 'tok_PLN_s', 'AUTH_1'], 'subscription + card token saved privately');
  ok(W.vapiCalls.some((c: any) => c[1] === '/assistant/asst_1' && c[2].transcriber.language === 'en'), 'plan vapi_patch applied');
  ok(W.vapiCalls.some((c: any) => c[1] === '/phone-number/pn_1' && c[2].assistantId === 'asst_1'), 'number attached to assistant');
  ok(W.emails.some((e: any) => e.to === 'pieter@example.com') && W.emails.some((e: any) => e.to === 'owner@example.com'), 'client and owner emailed');
  // replay
  const n = W.invoices.length;
  eq(await core.handleEvent(deps, firstEvt()), 'duplicate', 'same event twice is ignored');
  eq(W.invoices.length, n, 'no duplicate invoices');
}
{
  const { W, deps } = world();
  eq(await core.handleEvent(deps, firstEvt({ amount: 100 })), 'short payment', 'underpayment does not activate');
  eq(W.profiles.u1.billing_status, 'none', 'still not active');
}
{
  const { W, deps } = world({ priv: { founding_approved: true } });
  await core.handleEvent(deps, firstEvt({ amount: 150000, metadata: { user_id: 'u1', plan: 'founding', kind: 'first' } }));
  const sub = W.paystackCalls.find((c: any) => c[1] === '/subscription');
  ok(sub && sub[2].plan === 'PLN_f', 'founding: one more monthly charge via subscription (plan invoice_limit)');
}
{
  const { W, deps } = world();
  W.plans.starter.paystack_plan_code = null;
  const res = await core.handleEvent(deps, firstEvt());
  ok(res.includes('WARNING') && W.profiles.u1.billing_status === 'active', 'no plan code: still activates, warns owner');
}
{
  const { W, deps } = world({ paystackFail: { '/subscription': true } });
  const res = await core.handleEvent(deps, firstEvt());
  ok(res.includes('WARNING') && W.profiles.u1.plan_active === 'starter', 'subscription failure: payment still recorded, owner warned');
}

// ---------- renewal with extra minutes for the closing period
{
  const { W, deps } = world({ minutes: 263, now: '2026-11-14T08:05:00Z', profile: { plan_active: 'starter', billing_status: 'active', period_start: '2026-10-14T08:00:00.000Z', period_end: '2026-11-14T08:00:00.000Z', paystack_customer_code: 'CUS_1', paystack_subscription_code: 'SUB_PLN_s' }, priv: { authorization_code: 'AUTH_1', authorization_reusable: true } });
  const res = await core.handleEvent(deps, { event: 'charge.success', data: { status: 'success', currency: 'ZAR', reference: 'T_renew1', amount: 250000, paid_at: '2026-11-14T08:04:00Z', plan: { plan_code: 'PLN_s' }, customer: { customer_code: 'CUS_1' }, authorization: { authorization_code: 'AUTH_1', reusable: true, last4: '4081' } } });
  ok(res.startsWith('renewed starter'), 'renewal: ' + res);
  eq([W.profiles.u1.period_start, W.profiles.u1.period_end], ['2026-11-14T08:00:00.000Z', '2026-12-14T08:00:00.000Z'], 'period advanced from previous end');
  const extra = W.paystackCalls.find((c: any) => c[1] === '/transaction/charge_authorization');
  eq(extra && [extra[2].amount, extra[2].authorization_code, extra[2].metadata.kind], [6500, 'AUTH_1', 'extra'], '13 extra minutes × R5 charged to card');
  eq(W.invoices.map((i: any) => [i.kind, i.amount_cents, i.status]), [['extra', 6500, 'paid'], ['monthly', 250000, 'paid']], 'extra + monthly invoices');
  // webhook for the extra charge itself arrives later
  eq(await core.handleEvent(deps, { event: 'charge.success', data: { status: 'success', currency: 'ZAR', reference: extra[2].reference, amount: 6500, metadata: { user_id: 'u1', kind: 'extra' } } }), 'extra paid', 'extra webhook marks paid');
  eq(W.invoices.length, 2, 'no extra invoice duplicate');
}
{
  // no card: extra minutes become a due invoice
  const { W, deps } = world({ minutes: 300, now: '2026-11-15T06:00:00Z', profile: { plan_active: 'starter', billing_status: 'cancelled', period_start: '2026-10-14T08:00:00.000Z', period_end: '2026-11-14T08:00:00.000Z' }, priv: { authorization_code: null } });
  const out = await core.daily(deps);
  const acts = out[0].actions.join(' | ');
  ok(acts.includes('invoiced 50 extra minutes'), 'cancelled + no card: extra invoiced (' + acts + ')');
  ok(acts.includes('paused (plan ended)'), 'cancelled plan paused after period end');
  eq([W.profiles.u1.status, W.profiles.u1.paused_reason], ['paused', 'cancelled'], 'status paused');
  ok(W.vapiCalls.some((c: any) => c[1] === '/phone-number/pn_1' && c[2].assistantId === null), 'Vapi number detached');
  eq(W.invoices[0].status, 'due', 'invoice due');
  const out2 = await core.daily(deps);
  eq(out2[0].actions.length, 0, 'second daily run does nothing new');
}

{
  // a renewal that (wrongly) carries the first payment's metadata is still treated as a renewal
  const { W, deps } = world({ profile: { plan_active: 'starter', billing_status: 'active', period_start: '2026-10-14T08:00:00.000Z', period_end: '2026-11-14T08:00:00.000Z', paystack_customer_code: 'CUS_1' } });
  const res = await core.handleEvent(deps, { event: 'charge.success', data: { status: 'success', currency: 'ZAR', reference: 'T_ren2', amount: 250000, plan: { plan_code: 'PLN_s' }, metadata: { user_id: 'u1', plan: 'starter', kind: 'first' }, customer: { customer_code: 'CUS_1' } } });
  ok(res.startsWith('renewed'), 'renewal with stale first-payment metadata is a renewal: ' + res);
  ok(!W.invoices.some((i: any) => i.kind === 'setup'), 'no second setup fee');
}

// ---------- usage warnings
{
  const { W, deps } = world({ minutes: 210, profile: { plan_active: 'starter', billing_status: 'active', period_start: '2026-10-14T08:00:00.000Z', period_end: '2026-11-14T08:00:00.000Z' } });
  eq((await core.daily(deps))[0].actions, ['warn80'], '84% → 80% warning');
  eq((await core.daily(deps))[0].actions, [], '80% warning only once');
  W.minutes = 260;
  eq((await core.daily(deps))[0].actions, ['warn100'], '104% → 100% warning');
  ok(W.emails.some((e: any) => /keeps answering/.test(e.text)), 'warning says calls keep being answered');
}

// ---------- failed payment → grace → pause → recover
{
  const { W, deps } = world({ profile: { plan_active: 'starter', billing_status: 'active', status: 'live', period_start: '2026-10-14T08:00:00.000Z', period_end: '2026-11-14T08:00:00.000Z', paystack_subscription_code: 'SUB_PLN_s', paystack_customer_code: 'CUS_1' } });
  W.now = new Date('2026-11-14T09:00:00Z');
  eq(await core.handleEvent(deps, { event: 'invoice.payment_failed', data: { invoice_code: 'INV_1', subscription: { subscription_code: 'SUB_PLN_s' } } }), 'past due', 'payment failed → past due');
  W.now = new Date('2026-11-18T09:00:00Z');
  ok(!(await core.daily(deps))[0].actions.some((a: string) => a.startsWith('paused')), 'not paused inside grace period');
  W.now = new Date('2026-11-22T09:00:00Z');
  ok((await core.daily(deps))[0].actions.some((a: string) => a.startsWith('paused (unpaid)')), 'paused after 7 days');
  eq([W.profiles.u1.status, W.profiles.u1.paused_reason], ['paused', 'billing'], 'paused for billing');
  // they update their card and Paystack retries successfully
  await core.handleEvent(deps, { event: 'charge.success', data: { status: 'success', currency: 'ZAR', reference: 'T_late', amount: 250000, paid_at: '2026-11-22T10:00:00Z', plan: { plan_code: 'PLN_s' }, customer: { customer_code: 'CUS_1' } } });
  eq([W.profiles.u1.status, W.profiles.u1.billing_status, W.profiles.u1.past_due_since], ['live', 'active', null], 'back on after paying');
  ok(W.vapiCalls.filter((c: any) => c[1] === '/phone-number/pn_1').pop()[2].assistantId === 'asst_1', 'Vapi number re-attached');
}

// ---------- cancellation events, unknown customers, retries after errors
{
  const { W, deps } = world({ profile: { plan_active: 'pro', billing_status: 'active', paystack_subscription_code: 'SUB_x', period_end: '2026-11-14T08:00:00.000Z' } });
  eq(await core.handleEvent(deps, { event: 'subscription.not_renew', data: { subscription_code: 'SUB_x' } }), 'non_renewing', 'not_renew');
  eq(await core.handleEvent(deps, { event: 'subscription.disable', data: { subscription_code: 'SUB_x', status: 'complete' } }), 'ended', 'disable complete → ended');
  eq(await core.handleEvent(deps, firstEvt({ reference: 'zzz', metadata: {}, customer: { customer_code: 'CUS_unknown' } })), 'unmatched', 'unknown customer is reported, not applied');
}
{
  const { W, deps } = world();
  deps.db.updateProfile = async () => { throw new Error('db down'); };
  let threw = false; try { await core.handleEvent(deps, firstEvt()); } catch { threw = true; }
  ok(threw && !W.events.has('charge.success:rb_f_u1_x'), 'failed processing is un-marked so the retry runs');
}

// ---------- admin actions
{
  const { W, deps } = world({ profile: { plan_active: 'starter', billing_status: 'active', paystack_subscription_code: 'SUB_old', paystack_customer_code: 'CUS_1', period_end: '2026-11-14T08:00:00.000Z' }, priv: { authorization_code: 'AUTH_1', email_token: 'tok_old' } });
  const msg = await core.changePlan(deps, 'u1', 'pro');
  ok(/Pro from 14 Nov 2026/.test(msg), 'change plan message: ' + msg);
  ok(W.paystackCalls.some((c: any) => c[1] === '/subscription/disable' && c[2].code === 'SUB_old'), 'old subscription disabled');
  eq(W.profiles.u1.paystack_subscription_code, 'SUB_PLN_p', 'new subscription saved');
  eq(W.profiles.u1.plan_active, 'starter', 'features stay on the paid plan until the renewal');
  eq(await core.manageLink(deps, 'u1'), 'https://paystack.com/manage/xyz', 'manage link');
  ok((await core.setPause(deps, 'u1', true)).includes('number detached'), 'manual pause detaches number');
}
{
  const { W, deps } = world({ vat: true });
  W.plans.starter.paystack_plan_code = null; W.plans.founding.paystack_plan_code = null;
  const r = await core.setupPlans(deps);
  const body = (k: string) => W.paystackCalls.find((c: any) => c[1] === '/plan' && c[2].name.endsWith(k))[2];
  eq([body('Starter').amount, body('Starter').interval, body('partner').invoice_limit], [287500, 'monthly', 1], 'plans created with VAT, founding limited to 1 more');
  eq(r.filter((x: any) => x.created).length, 2, 'only plans without codes are created');
}
{
  const { W, deps } = world();
  deps.vapi = async () => { throw new Error('401 invalid key'); };
  ok((await core.applyVapi(deps, 'u1', W.plans.pro, true)).startsWith('FAILED'), 'Vapi failure reported');
  ok(W.emails.some((e: any) => /Vapi update failed/.test(e.subject)), 'owner told to change Vapi by hand');
  W.priv.u1 = { user_id: 'u1' };
  ok((await core.applyVapi(deps, 'u1', W.plans.pro, true)).startsWith('skipped'), 'no assistant id: skipped');
}

// ---------- Vapi call reports
{
  const { W, deps } = world();
  const rep = { message: { type: 'end-of-call-report', call: { id: 'call_1', assistantId: 'asst_1', customer: { number: '+27821234567' } }, startedAt: '2026-10-14T19:00:00Z', endedAt: '2026-10-14T19:02:05Z', analysis: { summary: 'Burst geyser in Fourways. Caller switched power off.', structuredData: { outcome: 'Emergency', suburb: 'Fourways', caller_name: 'Lerato' } }, recordingUrl: 'https://rec/1.mp3' } };
  eq(await core.recordVapiCall(deps, rep), 'recorded', 'call recorded');
  eq([W.calls[0].user_id, W.calls[0].duration_seconds, W.calls[0].call_type, W.calls[0].suburb, W.calls[0].problem], ['u1', 125, 'emergency', 'Fourways', 'Burst geyser in Fourways.'], 'call fields');
  eq(await core.recordVapiCall(deps, rep), 'duplicate', 'same call twice stored once');
  eq(await core.recordVapiCall(deps, { message: { type: 'status-update' } }), 'ignored status-update', 'other messages ignored');
  eq(await core.recordVapiCall(deps, { message: { type: 'end-of-call-report', call: { id: 'c2', assistantId: 'other' } } }), 'no client for this assistant/number', 'unknown assistant ignored');
}

console.log(passes + ' passed, ' + fails + ' failed');
if (fails) process.exit(1);
