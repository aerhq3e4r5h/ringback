// Ringback billing core: everything the Edge Functions decide, with no network or database code of its own.
// The functions pass in `deps` (database, Paystack, Vapi, email, clock); tests pass in fakes.
// Money is always in cents (ZAR). Prices in plan_catalog exclude VAT; VAT is added when billing_settings.vat_registered.

export type Json = Record<string, any>;

export interface Deps {
  db: {
    profile(id: string): Promise<Json | null>;
    profileBy(field: string, value: string): Promise<Json | null>;
    updateProfile(id: string, patch: Json): Promise<void>;
    plan(key: string): Promise<Json | null>;
    planByCode(code: string): Promise<Json | null>;
    plans(): Promise<Json[]>;
    updatePlan(key: string, patch: Json): Promise<void>;
    priv(id: string): Promise<Json | null>;
    privBy(field: string, value: string): Promise<Json | null>;
    upsertPriv(id: string, patch: Json): Promise<void>;
    addEvent(id: string, type: string, userId: string | null, payload: Json): Promise<boolean>; // false = already processed
    removeEvent(id: string): Promise<void>;                                                     // undo, so a retry is processed
    addInvoice(row: Json): Promise<boolean>;                                                    // false = provider_ref exists
    markInvoicePaid(providerRef: string, patch: Json): Promise<void>;
    usage(userId: string, start: string, end: string): Promise<{ calls: number; measured_calls: number; minutes: number }>;
    addMark(userId: string, periodStart: string, mark: string, detail: Json): Promise<boolean>; // false = exists
    settings(): Promise<Json>;
    billedProfiles(): Promise<Json[]>;
    addCall(row: Json): Promise<boolean>;
  };
  paystack(method: string, path: string, body?: Json): Promise<Json>;   // returns the parsed JSON, throws on HTTP error
  vapi(method: string, path: string, body?: Json): Promise<Json>;
  notify(to: string | null, subject: string, text: string): Promise<void>;
  now(): Date;
  env: { siteUrl: string; ownerEmail: string | null; graceDays: number; log(...a: any[]): void };
}

// ------------------------------------------------------------------ helpers
export const VAT = 0.15;
export function withVat(cents: number, settings: Json): number {
  return settings && settings.vat_registered ? Math.round(cents * (1 + VAT)) : cents;
}
export function vatPart(cents: number, settings: Json): number {
  return settings && settings.vat_registered ? Math.round(cents * VAT) : 0;
}
export function money(cents: number): string {
  const v = (Math.round(cents) / 100).toFixed(2).split('.');
  return 'R' + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + v[1];
}
export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x;
}
export function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function iso(d: Date): string { return d.toISOString(); }
function short(id: string): string { return String(id).replace(/-/g, '').slice(0, 8); }
function monthLabel(d: Date): string { return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' }); }
function dayLabel(d: Date): string { return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }); }
function bizName(p: Json): string { return p.business_name || p.full_name || p.email || 'a client'; }

export class BillingError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}

// Paystack signs the raw body with HMAC-SHA512 using your secret key.
export async function verifyPaystackSignature(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(raw)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  const sig = signature.trim().toLowerCase();
  if (sig.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function cardFields(auth: Json | undefined): Json {
  if (!auth) return {};
  const out: Json = {};
  if (auth.card_type || auth.brand) out.card_brand = String(auth.brand || auth.card_type).trim().slice(0, 20);
  if (auth.last4) out.card_last4 = String(auth.last4).slice(-4);
  if (auth.exp_month && auth.exp_year) out.card_exp = String(auth.exp_month).padStart(2, '0') + '/' + String(auth.exp_year).slice(-2);
  return out;
}

// ------------------------------------------------------------------ checkout
// First payment: the setup fee plus the first month, charged by card so Paystack gives us a reusable card token.
// Monthly renewals then run as a Paystack subscription that starts one month later.
export async function startCheckout(deps: Deps, userId: string, userEmail: string, planKey: string): Promise<Json> {
  const p = await deps.db.profile(userId);
  if (!p) throw new BillingError('no_profile', 'Your account isn\'t set up yet. Reload the page and try again.');
  const plan = await deps.db.plan(planKey);
  if (!plan) throw new BillingError('bad_plan', 'That plan doesn\'t exist.');
  if (p.plan_active && ['active', 'past_due', 'non_renewing'].includes(p.billing_status)) {
    throw new BillingError('already_paying', 'You already have an active plan. To change it, use "Change plan" or WhatsApp us.');
  }
  if (plan.key === 'founding' && !((await deps.db.priv(userId)) || {}).founding_approved) {
    throw new BillingError('founding_needs_approval', 'The founding partner plan is by application. Apply on the Plan page and we\'ll confirm it with you.');
  }
  const settings = await deps.db.settings();
  const net = (plan.setup_cents || 0) + plan.monthly_cents;
  const amount = withVat(net, settings);
  const email = p.email || userEmail;
  if (!email) throw new BillingError('no_email', 'We need an email address on your account first.');
  const reference = 'rb_f_' + short(userId) + '_' + deps.now().getTime().toString(36);
  const res = await deps.paystack('POST', '/transaction/initialize', {
    email, amount, currency: 'ZAR', reference, channels: ['card'],
    callback_url: deps.env.siteUrl + 'dashboard.html?paid=' + encodeURIComponent(reference) + '#plan',
    metadata: {
      user_id: userId, plan: plan.key, kind: 'first', net_cents: net,
      custom_fields: [
        { display_name: 'Business', variable_name: 'business', value: bizName(p) },
        { display_name: 'Plan', variable_name: 'plan', value: plan.name },
      ],
    },
  });
  if (!res || !res.status || !res.data || !res.data.authorization_url) {
    throw new BillingError('paystack_init', 'We couldn\'t start the payment. Please try again in a minute.', 502);
  }
  return { url: res.data.authorization_url, reference: res.data.reference || reference, amount };
}

// ------------------------------------------------------------------ webhook events
export async function handleEvent(deps: Deps, evt: Json): Promise<string> {
  const type = String(evt && evt.event || '');
  const d: Json = (evt && evt.data) || {};
  const key = type + ':' + (d.reference || d.subscription_code || (d.subscription && d.subscription.subscription_code) || d.invoice_code || d.id || '');
  const user = await findUser(deps, d);
  const fresh = await deps.db.addEvent(key, type, user ? user.id : null, evt);
  if (!fresh) return 'duplicate';
  try {
    switch (type) {
      case 'charge.success': return await chargeSuccess(deps, d, user);
      case 'subscription.create': return await subscriptionCreate(deps, d, user);
      case 'invoice.payment_failed': return await paymentFailed(deps, d, user);
      case 'invoice.update': return d.status === 'failed' ? await paymentFailed(deps, d, user) : 'ignored';
      case 'subscription.not_renew': return await subscriptionEnding(deps, d, user, 'non_renewing');
      case 'subscription.disable': return await subscriptionEnding(deps, d, user, d.status === 'complete' ? 'ended' : 'cancelled');
      default: return 'ignored';
    }
  } catch (e) {
    // forget the event so Paystack's retry is processed; invoices and marks are themselves idempotent
    await deps.db.removeEvent(key);
    throw e;
  }
}

async function findUser(deps: Deps, d: Json): Promise<Json | null> {
  const md = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
  if (md.user_id) { const p = await deps.db.profile(String(md.user_id)); if (p) return p; }
  const sub = d.subscription_code || (d.subscription && d.subscription.subscription_code);
  if (sub) { const p = await deps.db.profileBy('paystack_subscription_code', sub); if (p) return p; }
  const cust = d.customer && d.customer.customer_code;
  if (cust) { const p = await deps.db.profileBy('paystack_customer_code', cust); if (p) return p; }
  return null;
}

async function chargeSuccess(deps: Deps, d: Json, p: Json | null): Promise<string> {
  if (d.status && d.status !== 'success') return 'ignored: status ' + d.status;
  if (d.currency && d.currency !== 'ZAR') return 'ignored: currency ' + d.currency;
  if (!p) { await deps.notify(deps.env.ownerEmail, 'Ringback: payment from an unknown customer', 'Paystack reported a successful payment (' + d.reference + ', ' + money(d.amount || 0) + ') we could not match to a client. Check Paystack and the admin page.'); return 'unmatched'; }
  const md = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
  // Our own references say what a charge was: rb_f_ = first payment from the portal, rb_x_ = extra minutes.
  // Subscription renewals are created by Paystack and carry the plan code instead.
  const ref = String(d.reference || '');
  const kind = ref.startsWith('rb_f_') ? 'first' : ref.startsWith('rb_x_') ? 'extra' : (d.plan && d.plan.plan_code) ? 'renewal' : 'other';
  if (kind === 'first') return firstPayment(deps, d, p, md);
  if (kind === 'extra') {
    await deps.db.markInvoicePaid(d.reference, { status: 'paid', paid_at: d.paid_at || iso(deps.now()), method: 'card', provider: 'paystack' });
    return 'extra paid';
  }
  if (kind === 'renewal') return renewal(deps, d, p);
  await deps.notify(deps.env.ownerEmail, 'Ringback: unexpected payment', 'A ' + money(d.amount || 0) + ' payment from ' + bizName(p) + ' (' + d.reference + ') did not come from the portal. Check Paystack.');
  return 'other';
}

async function firstPayment(deps: Deps, d: Json, p: Json, md: Json): Promise<string> {
  const plan = await deps.db.plan(String(md.plan || ''));
  if (!plan) return 'unknown plan ' + md.plan;
  const settings = await deps.db.settings();
  const now = deps.now();
  const paidAt = d.paid_at ? new Date(d.paid_at) : now;
  const expected = withVat((plan.setup_cents || 0) + plan.monthly_cents, settings);
  if (typeof d.amount === 'number' && d.amount < expected) {
    await deps.notify(deps.env.ownerEmail, 'Ringback: short payment', bizName(p) + ' paid ' + money(d.amount) + ' but ' + plan.name + ' costs ' + money(expected) + '. Nothing was activated; check Paystack.');
    return 'short payment';
  }
  const start = paidAt, end = addMonths(paidAt, 1);
  // invoices: setup (if any) and month 1, recorded as paid by card
  if (plan.setup_cents) {
    await deps.db.addInvoice({ user_id: p.id, kind: 'setup', description: 'Once-off setup · ' + plan.name, amount_cents: plan.setup_cents, vat_cents: vatPart(plan.setup_cents, settings), due_date: ymd(paidAt), status: 'paid', paid_at: iso(paidAt), method: 'card', provider: 'paystack', provider_ref: d.reference + ':setup' });
  }
  await deps.db.addInvoice({ user_id: p.id, kind: 'monthly', period: ymd(start).slice(0, 7), description: plan.name + ' · ' + monthLabel(start), amount_cents: plan.monthly_cents, vat_cents: vatPart(plan.monthly_cents, settings), due_date: ymd(paidAt), status: 'paid', paid_at: iso(paidAt), method: 'card', provider: 'paystack', provider_ref: d.reference + ':m1' });

  const auth: Json = d.authorization || {};
  const cust: Json = d.customer || {};
  await deps.db.upsertPriv(p.id, { authorization_code: auth.authorization_code || null, authorization_reusable: !!auth.reusable });

  const patch: Json = Object.assign({
    plan: plan.key, plan_active: plan.key, billing_status: 'active', period_start: iso(start), period_end: iso(end),
    past_due_since: null, paystack_customer_code: cust.customer_code || p.paystack_customer_code || null, billing_updated_at: iso(now),
  }, cardFields(auth));
  if (p.status === 'paused' && p.paused_reason) { patch.status = 'live'; patch.paused_reason = null; }

  // Renewals: a Paystack subscription on this plan, starting when month 1 ends.
  let subNote = '';
  const remaining = plan.invoice_limit ? plan.invoice_limit - 1 : null;
  if (remaining === 0) {
    patch.billing_status = 'non_renewing';
    subNote = 'This plan has no further monthly charges.';
  } else if (!plan.paystack_plan_code) {
    subNote = 'WARNING: plan "' + plan.key + '" has no Paystack plan code, so no monthly subscription was created. Run billing-manage setup-plans, then use Change plan in admin to start it.';
  } else if (!auth.reusable || !auth.authorization_code) {
    subNote = 'WARNING: this card can\'t be charged again (not reusable), so no subscription was created. Ask the client to pay with a different card.';
  } else {
    try {
      const sub = await deps.paystack('POST', '/subscription', { customer: cust.customer_code || cust.email, plan: plan.paystack_plan_code, authorization: auth.authorization_code, start_date: iso(end) });
      if (sub && sub.data) {
        if (sub.data.subscription_code) patch.paystack_subscription_code = sub.data.subscription_code;
        if (sub.data.email_token) await deps.db.upsertPriv(p.id, { email_token: sub.data.email_token });
      }
      subNote = 'Monthly subscription starts ' + dayLabel(end) + '.';
    } catch (e) {
      subNote = 'WARNING: creating the subscription failed (' + (e as Error).message + '). Use Change plan in admin to retry.';
    }
  }
  await deps.db.updateProfile(p.id, patch);
  const vapi = await applyVapi(deps, p.id, plan, true);
  await deps.notify(deps.env.ownerEmail, 'Ringback: ' + bizName(p) + ' paid for ' + plan.name, money(d.amount || expected) + ' paid by card (' + d.reference + '). ' + subNote + ' Vapi: ' + vapi);
  if (p.email) await deps.notify(p.email, 'Your Ringback payment', 'Thanks! We received ' + money(d.amount || expected) + ' for ' + plan.name + '. Your plan is active until ' + dayLabel(end) + ' and renews monthly by card. You can see your invoices and update your card in your portal: ' + deps.env.siteUrl + 'dashboard.html#billing');
  return 'activated ' + plan.key + (subNote.startsWith('WARNING') ? ' (' + subNote + ')' : '');
}

async function renewal(deps: Deps, d: Json, p: Json): Promise<string> {
  const plan = (d.plan && d.plan.plan_code && await deps.db.planByCode(d.plan.plan_code)) || await deps.db.plan(p.plan_active || p.plan);
  if (!plan) return 'renewal: unknown plan';
  const settings = await deps.db.settings();
  const now = deps.now();
  const paidAt = d.paid_at ? new Date(d.paid_at) : now;
  // charge extra minutes for the period that just closed, before moving the period on
  if (p.period_start && p.period_end) await settlePeriod(deps, p, p.period_start, p.period_end);
  const start = p.period_end ? new Date(p.period_end) : paidAt;
  const end = addMonths(start, 1);
  await deps.db.addInvoice({ user_id: p.id, kind: 'monthly', period: ymd(start).slice(0, 7), description: plan.name + ' · ' + monthLabel(start), amount_cents: plan.monthly_cents, vat_cents: vatPart(plan.monthly_cents, settings), due_date: ymd(paidAt), status: 'paid', paid_at: iso(paidAt), method: 'card', provider: 'paystack', provider_ref: d.reference });
  const patch: Json = Object.assign({ plan: plan.key, plan_active: plan.key, billing_status: 'active', period_start: iso(start), period_end: iso(end), past_due_since: null, billing_updated_at: iso(now) }, cardFields(d.authorization));
  const wasPaused = p.status === 'paused' && p.paused_reason;
  if (wasPaused) { patch.status = 'live'; patch.paused_reason = null; }
  if (d.authorization && d.authorization.reusable && d.authorization.authorization_code) await deps.db.upsertPriv(p.id, { authorization_code: d.authorization.authorization_code, authorization_reusable: true });
  await deps.db.updateProfile(p.id, patch);
  if (wasPaused || plan.key !== p.plan_active) await applyVapi(deps, p.id, plan, true);
  if (wasPaused) await deps.notify(deps.env.ownerEmail, 'Ringback: ' + bizName(p) + ' paid and is back on', 'Their payment came through, so Ringback is answering their calls again.');
  return 'renewed ' + plan.key + ' to ' + ymd(end);
}

async function subscriptionCreate(deps: Deps, d: Json, p: Json | null): Promise<string> {
  if (!p) return 'unmatched';
  const patch: Json = {};
  if (d.subscription_code) patch.paystack_subscription_code = d.subscription_code;
  if (d.customer && d.customer.customer_code && !p.paystack_customer_code) patch.paystack_customer_code = d.customer.customer_code;
  if (Object.keys(patch).length) await deps.db.updateProfile(p.id, patch);
  if (d.email_token) await deps.db.upsertPriv(p.id, { email_token: d.email_token });
  return 'subscription saved';
}

async function paymentFailed(deps: Deps, d: Json, p: Json | null): Promise<string> {
  if (!p) return 'unmatched';
  const now = deps.now();
  if (p.billing_status === 'past_due') return 'already past due';
  await deps.db.updateProfile(p.id, { billing_status: 'past_due', past_due_since: p.past_due_since || iso(now), billing_updated_at: iso(now) });
  const grace = deps.env.graceDays;
  await deps.notify(p.email || null, 'Your Ringback payment didn\'t go through', 'We couldn\'t charge your card for this month. Please update your card in the portal within ' + grace + ' days so Ringback keeps answering your calls: ' + deps.env.siteUrl + 'dashboard.html#billing');
  await deps.notify(deps.env.ownerEmail, 'Ringback: payment failed for ' + bizName(p), 'Their monthly card payment failed. They have ' + grace + ' days to update their card before the automation pauses their assistant.');
  return 'past due';
}

async function subscriptionEnding(deps: Deps, d: Json, p: Json | null, status: string): Promise<string> {
  if (!p) return 'unmatched';
  await deps.db.updateProfile(p.id, { billing_status: status, billing_updated_at: iso(deps.now()) });
  const until = p.period_end ? dayLabel(new Date(p.period_end)) : 'the end of the period';
  await deps.notify(deps.env.ownerEmail, 'Ringback: ' + bizName(p) + ' subscription ' + (status === 'ended' ? 'completed' : 'cancelled'), 'Their plan stays on until ' + until + '. After that the automation pauses their assistant unless they start a plan again.');
  return status;
}

// ------------------------------------------------------------------ usage and extra minutes
// Settles one billing period once: counts minutes, and charges extra minutes on the saved card.
export async function settlePeriod(deps: Deps, p: Json, startIso: string, endIso: string): Promise<string> {
  const plan = await deps.db.plan(p.plan_active || p.plan);
  if (!plan) return 'no plan';
  const u = await deps.db.usage(p.id, startIso, endIso);
  const extra = Math.max(0, u.minutes - plan.minutes);
  const first = await deps.db.addMark(p.id, startIso, 'settled', { minutes: u.minutes, included: plan.minutes, extra, calls: u.calls, measured: u.measured_calls });
  if (!first) return 'already settled';
  if (!extra) return 'no extra minutes';
  const settings = await deps.db.settings();
  const net = extra * plan.extra_min_cents;
  const total = withVat(net, settings);
  const start = new Date(startIso);
  const ref = 'rb_x_' + short(p.id) + '_' + ymd(start).replace(/-/g, '');
  const priv = await deps.db.priv(p.id);
  const base = { user_id: p.id, kind: 'extra', period: ymd(start).slice(0, 7), description: extra + ' extra minute' + (extra === 1 ? '' : 's') + ' · ' + monthLabel(start) + ' (' + u.minutes + ' used, ' + plan.minutes + ' included)', amount_cents: net, vat_cents: total - net, provider: 'paystack', provider_ref: ref };
  if (priv && priv.authorization_code && priv.authorization_reusable && p.email) {
    try {
      const r = await deps.paystack('POST', '/transaction/charge_authorization', { email: p.email, amount: total, currency: 'ZAR', authorization_code: priv.authorization_code, reference: ref, metadata: { user_id: p.id, kind: 'extra', period_start: startIso } });
      if (r && r.data && r.data.status === 'success') {
        await deps.db.addInvoice(Object.assign({}, base, { due_date: ymd(deps.now()), status: 'paid', paid_at: iso(deps.now()), method: 'card' }));
        await deps.notify(p.email, 'Ringback: extra minutes for ' + monthLabel(start), 'You used ' + u.minutes + ' minutes on ' + plan.name + ' (' + plan.minutes + ' included), so ' + extra + ' extra minutes (' + money(total) + ') were charged to your card. The invoice is in your portal.');
        return 'charged ' + extra + ' extra minutes';
      }
    } catch (e) { deps.env.log('extra charge failed', (e as Error).message); }
  }
  // no card or the charge failed: an ordinary invoice due in 7 days (payable by EFT, like today)
  const due = new Date(deps.now().getTime() + 7 * 864e5);
  await deps.db.addInvoice(Object.assign({}, base, { due_date: ymd(due), status: 'due' }));
  await deps.notify(p.email || null, 'Ringback: extra minutes for ' + monthLabel(start), 'You used ' + u.minutes + ' minutes (' + plan.minutes + ' included). An invoice for ' + extra + ' extra minutes (' + money(total) + ') is in your portal, due ' + dayLabel(due) + '.');
  return 'invoiced ' + extra + ' extra minutes';
}

// The daily job: usage warnings, settling periods that ended without a renewal, and pausing after the grace period.
export async function daily(deps: Deps): Promise<Json[]> {
  const out: Json[] = [];
  const now = deps.now();
  for (const p of await deps.db.billedProfiles()) {
    const r: Json = { user: p.id, business: bizName(p), actions: [] as string[] };
    try {
      const plan = await deps.db.plan(p.plan_active || p.plan);
      if (!plan || !p.period_start || !p.period_end) { out.push(r); continue; }
      const start = p.period_start, end = p.period_end;
      if (new Date(end) > now) {
        // in the current period: warn at 80% and 100% of the included minutes, once each
        const u = await deps.db.usage(p.id, start, end);
        const pct = plan.minutes ? u.minutes / plan.minutes : 0;
        for (const [mark, level] of [['warn100', 1], ['warn80', 0.8]] as [string, number][]) {
          if (pct >= level && await deps.db.addMark(p.id, start, mark, { minutes: u.minutes, included: plan.minutes })) {
            const msg = mark === 'warn100'
              ? 'You\'ve used all ' + plan.minutes + ' minutes on ' + plan.name + ' this month (' + u.minutes + ' so far). Ringback keeps answering every call; extra minutes are ' + money(withVat(plan.extra_min_cents, await deps.db.settings())) + ' each and are billed after ' + dayLabel(new Date(end)) + '.'
              : 'You\'ve used ' + u.minutes + ' of your ' + plan.minutes + ' minutes on ' + plan.name + ' this month. Ringback keeps answering every call; minutes over the allowance are billed at the end of the month.';
            await deps.notify(p.email || null, mark === 'warn100' ? 'Ringback: you\'ve used your monthly minutes' : 'Ringback: 80% of your minutes used', msg);
            r.actions.push(mark);
            break;   // send only the highest new warning
          }
        }
      } else {
        // the period has ended and no renewal moved it on
        const s = await settlePeriod(deps, p, start, end);
        if (!s.startsWith('already')) r.actions.push(s);
        if (['non_renewing', 'cancelled', 'ended'].includes(p.billing_status) && p.status !== 'paused') {
          await deps.db.updateProfile(p.id, { status: 'paused', paused_reason: 'cancelled', billing_updated_at: iso(now) });
          r.actions.push('paused (plan ended) · Vapi: ' + await applyVapi(deps, p.id, plan, false));
          await deps.notify(deps.env.ownerEmail, 'Ringback: ' + bizName(p) + ' paused', 'Their plan ended on ' + dayLabel(new Date(end)) + ', so the automation paused their assistant.');
          await deps.notify(p.email || null, 'Ringback is paused', 'Your Ringback plan ended on ' + dayLabel(new Date(end)) + ', so we\'ve stopped answering your calls. Choose a plan in your portal to switch it back on: ' + deps.env.siteUrl + 'dashboard.html#plan');
        }
      }
      // failed payments: pause once the grace period is over
      if (p.billing_status === 'past_due' && p.past_due_since && p.status !== 'paused' &&
          now.getTime() - new Date(p.past_due_since).getTime() > deps.env.graceDays * 864e5) {
        await deps.db.updateProfile(p.id, { status: 'paused', paused_reason: 'billing', billing_updated_at: iso(now) });
        r.actions.push('paused (unpaid) · Vapi: ' + await applyVapi(deps, p.id, plan, false));
        await deps.notify(p.email || null, 'Ringback is paused', 'We couldn\'t collect your monthly payment, so Ringback has stopped answering your calls. Update your card in your portal and it switches back on as soon as the payment goes through: ' + deps.env.siteUrl + 'dashboard.html#billing');
        await deps.notify(deps.env.ownerEmail, 'Ringback: ' + bizName(p) + ' paused for non-payment', 'Their payment has been failing for more than ' + deps.env.graceDays + ' days.');
      }
    } catch (e) { r.error = (e as Error).message; }
    out.push(r);
  }
  return out;
}

// ------------------------------------------------------------------ Vapi
// On: make sure the client's Ringback number points at their assistant and apply the plan's vapi_patch.
// Off (paused): detach the assistant from the number, so forwarded calls are no longer answered.
export async function applyVapi(deps: Deps, userId: string, plan: Json, on: boolean): Promise<string> {
  const priv = await deps.db.priv(userId);
  if (!priv || !priv.vapi_assistant_id) return 'skipped (no Vapi assistant id saved for this client)';
  const done: string[] = [];
  try {
    if (on && plan && plan.vapi_patch && Object.keys(plan.vapi_patch).length) {
      await deps.vapi('PATCH', '/assistant/' + encodeURIComponent(priv.vapi_assistant_id), plan.vapi_patch);
      done.push('applied ' + plan.key + ' settings');
    }
    if (priv.vapi_phone_number_id) {
      await deps.vapi('PATCH', '/phone-number/' + encodeURIComponent(priv.vapi_phone_number_id), { assistantId: on ? priv.vapi_assistant_id : null });
      done.push(on ? 'number answering' : 'number detached');
    } else if (!on) done.push('no phone number id saved, so nothing was paused in Vapi');
    return done.join(', ') || 'nothing to change';
  } catch (e) {
    await deps.notify(deps.env.ownerEmail, 'Ringback: Vapi update failed', 'Updating Vapi for client ' + userId + ' failed: ' + (e as Error).message + '. Change it by hand in Vapi.');
    return 'FAILED: ' + (e as Error).message;
  }
}

// ------------------------------------------------------------------ admin and client actions
export async function manageLink(deps: Deps, userId: string): Promise<string> {
  const p = await deps.db.profile(userId);
  if (!p || !p.paystack_subscription_code) throw new BillingError('no_subscription', 'There\'s no card subscription on this account yet.');
  const r = await deps.paystack('GET', '/subscription/' + encodeURIComponent(p.paystack_subscription_code) + '/manage/link');
  if (!r || !r.data || !r.data.link) throw new BillingError('paystack_link', 'Paystack didn\'t return a link. Try again in a minute.', 502);
  return r.data.link;
}

// Switch a paying client to another plan from their next billing date (no new setup fee).
export async function changePlan(deps: Deps, userId: string, planKey: string): Promise<string> {
  const p = await deps.db.profile(userId);
  const plan = await deps.db.plan(planKey);
  if (!p || !plan) throw new BillingError('bad_input', 'Unknown client or plan.');
  if (!plan.paystack_plan_code) throw new BillingError('no_plan_code', 'Plan "' + plan.key + '" has no Paystack plan code yet. Run "Create Paystack plans" first.');
  const priv = await deps.db.priv(userId);
  if (!priv || !priv.authorization_code) throw new BillingError('no_card', 'This client hasn\'t paid by card yet, so there\'s no card to move to a new plan.');
  if (p.paystack_subscription_code && priv.email_token) {
    try { await deps.paystack('POST', '/subscription/disable', { code: p.paystack_subscription_code, token: priv.email_token }); }
    catch (e) { throw new BillingError('disable_failed', 'Couldn\'t stop the old subscription: ' + (e as Error).message, 502); }
  }
  const start = p.period_end && new Date(p.period_end) > deps.now() ? new Date(p.period_end) : addMonths(deps.now(), 0);
  const sub = await deps.paystack('POST', '/subscription', { customer: p.paystack_customer_code || p.email, plan: plan.paystack_plan_code, authorization: priv.authorization_code, start_date: iso(start) });
  const patch: Json = { plan: plan.key, billing_status: 'active', billing_updated_at: iso(deps.now()) };
  if (sub && sub.data && sub.data.subscription_code) patch.paystack_subscription_code = sub.data.subscription_code;
  if (sub && sub.data && sub.data.email_token) await deps.db.upsertPriv(userId, { email_token: sub.data.email_token });
  await deps.db.updateProfile(userId, patch);
  return 'Moves to ' + plan.name + ' from ' + dayLabel(start) + '.';
}

// Create the monthly plans in Paystack (once), and save their codes into plan_catalog.
export async function setupPlans(deps: Deps): Promise<Json[]> {
  const settings = await deps.db.settings();
  const out: Json[] = [];
  for (const plan of await deps.db.plans()) {
    if (plan.paystack_plan_code) { out.push({ plan: plan.key, code: plan.paystack_plan_code, created: false }); continue; }
    const body: Json = { name: 'Ringback ' + plan.name, interval: 'monthly', amount: withVat(plan.monthly_cents, settings), currency: 'ZAR', description: plan.minutes + ' minutes included. Extra minutes billed separately.' };
    if (plan.invoice_limit) body.invoice_limit = Math.max(1, plan.invoice_limit - 1);   // month 1 is paid at checkout
    const r = await deps.paystack('POST', '/plan', body);
    const code = r && r.data && r.data.plan_code;
    if (code) await deps.db.updatePlan(plan.key, { paystack_plan_code: code });
    out.push({ plan: plan.key, code: code || null, created: !!code });
  }
  return out;
}

export async function setPause(deps: Deps, userId: string, paused: boolean): Promise<string> {
  const p = await deps.db.profile(userId);
  if (!p) throw new BillingError('bad_input', 'Unknown client.');
  const plan = await deps.db.plan(p.plan_active || p.plan);
  await deps.db.updateProfile(userId, paused ? { status: 'paused', paused_reason: 'manual' } : { status: 'live', paused_reason: null });
  return (paused ? 'Paused' : 'Back on') + ' · Vapi: ' + await applyVapi(deps, userId, plan || {}, !paused);
}

// ------------------------------------------------------------------ Vapi call reports → calls table (minutes)
const OUTCOMES: Json = { emergency: 'emergency', urgent: 'emergency', booked: 'booked', booking: 'booked', callback: 'callback', quote: 'callback' };
export async function recordVapiCall(deps: Deps, body: Json): Promise<string> {
  const m: Json = body && body.message || {};
  if (m.type !== 'end-of-call-report') return 'ignored ' + (m.type || 'unknown');
  const call: Json = m.call || {};
  if (!call.id) return 'no call id';
  let priv = call.assistantId ? await deps.db.privBy('vapi_assistant_id', call.assistantId) : null;
  if (!priv && call.phoneNumberId) priv = await deps.db.privBy('vapi_phone_number_id', call.phoneNumberId);
  if (!priv) return 'no client for this assistant/number';
  const started = m.startedAt || call.startedAt, ended = m.endedAt || call.endedAt;
  let secs = typeof m.durationSeconds === 'number' ? m.durationSeconds : null;
  if (secs == null && started && ended) secs = Math.max(0, (new Date(ended).getTime() - new Date(started).getTime()) / 1000);
  const a: Json = m.analysis || {};
  const sd: Json = a.structuredData || {};
  const outcome = String(sd.outcome || sd.call_type || '').toLowerCase();
  const fresh = await deps.db.addCall({
    user_id: priv.user_id,
    external_id: call.id,
    occurred_at: started || iso(deps.now()),
    duration_seconds: secs == null ? null : Math.round(secs),
    caller_phone: (call.customer && call.customer.number) || null,
    caller_name: sd.caller_name || null,
    suburb: sd.suburb || null,
    problem: sd.problem || (a.summary ? String(a.summary).split(/(?<=\.)\s/)[0].slice(0, 200) : null),
    call_type: OUTCOMES[outcome] || 'other',
    booked_slot: sd.booked_slot || null,
    summary: a.summary || m.summary || null,
    transcript: m.transcript || (m.artifact && m.artifact.transcript) || null,
    recording_url: m.recordingUrl || (m.artifact && m.artifact.recordingUrl) || null,
  });
  return fresh ? 'recorded' : 'duplicate';
}
