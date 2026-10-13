// Real implementations of the billing core's deps: Supabase (service role), Paystack, Vapi and email (Resend).
// Secrets come from Supabase Edge Function secrets; see supabase/BILLING-SETUP.md.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import type { Deps, Json } from './core.ts';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;

export const SUPABASE_URL = env('SUPABASE_URL');
export const SITE_URL = env('SITE_URL', 'https://aerhq3e4r5h.github.io/ringback/').replace(/\/?$/, '/');
export const SITE_ORIGIN = new URL(SITE_URL).origin;

export function serviceClient() {
  return createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}

// The signed-in user calling a function, from their Authorization header, plus whether they're an admin.
export async function caller(req: Request): Promise<{ id: string; email: string; admin: boolean } | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const userClient = createClient(SUPABASE_URL, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data || !data.user) return null;
  const adm = await userClient.rpc('is_admin');
  return { id: data.user.id, email: data.user.email || '', admin: adm.data === true };
}

async function api(base: string, key: string, method: string, path: string, body?: Json): Promise<Json> {
  if (!key) throw new Error(base + ' key is not set');
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: Json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(method + ' ' + path + ' → ' + res.status + ' ' + (json.message || text).toString().slice(0, 300));
  return json;
}

async function sendEmail(to: string | null, subject: string, text: string) {
  if (!to) return;
  const key = env('RESEND_API_KEY'), from = env('NOTIFY_FROM');
  if (!key || !from) { console.log('[email skipped: set RESEND_API_KEY and NOTIFY_FROM]', to, subject); return; }
  try {
    await api('https://api.resend.com', key, 'POST', '/emails', { from, to: [to], subject, text: text + '\n\nRingback · ' + SITE_URL });
  } catch (e) { console.error('email failed', (e as Error).message); }
}

export function realDeps(): Deps {
  const sb = serviceClient();
  const one = async (q: any) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data; };
  const dupOk = (r: any) => { if (r.error) { if (r.error.code === '23505') return false; throw new Error(r.error.message); } return true; };
  return {
    db: {
      profile: (id) => one(sb.from('profiles').select('*').eq('id', id).maybeSingle()),
      profileBy: (f, v) => one(sb.from('profiles').select('*').eq(f, v).limit(1).maybeSingle()),
      updateProfile: async (id, patch) => { await one(sb.from('profiles').update(patch).eq('id', id)); },
      plan: (k) => k ? one(sb.from('plan_catalog').select('*').eq('key', k).maybeSingle()) : Promise.resolve(null),
      planByCode: (c) => one(sb.from('plan_catalog').select('*').eq('paystack_plan_code', c).maybeSingle()),
      plans: () => one(sb.from('plan_catalog').select('*').order('sort')),
      updatePlan: async (k, patch) => { await one(sb.from('plan_catalog').update(patch).eq('key', k)); },
      priv: (id) => one(sb.from('billing_private').select('*').eq('user_id', id).maybeSingle()),
      privBy: (f, v) => one(sb.from('billing_private').select('*').eq(f, v).limit(1).maybeSingle()),
      upsertPriv: async (id, patch) => { await one(sb.from('billing_private').upsert(Object.assign({ user_id: id, updated_at: new Date().toISOString() }, patch), { onConflict: 'user_id' })); },
      addEvent: async (id, type, userId, payload) => dupOk(await sb.from('billing_events').insert({ id, type, user_id: userId, payload })),
      removeEvent: async (id) => { await one(sb.from('billing_events').delete().eq('id', id)); },
      addInvoice: async (row) => dupOk(await sb.from('invoices').insert(row)),
      markInvoicePaid: async (ref, patch) => { await one(sb.from('invoices').update(patch).eq('provider_ref', ref)); },
      usage: async (userId, start, end) => one(sb.rpc('usage_for', { p_user: userId, p_start: start, p_end: end })),
      addMark: async (userId, start, mark, detail) => dupOk(await sb.from('usage_marks').insert({ user_id: userId, period_start: start, mark, detail })),
      settings: async () => (await one(sb.from('billing_settings').select('*').eq('id', 1).maybeSingle())) || {},
      billedProfiles: () => one(sb.from('profiles').select('*').not('plan_active', 'is', null)),
      addCall: async (row) => dupOk(await sb.from('calls').insert(row)),
    },
    paystack: (m, p, b) => api('https://api.paystack.co', env('PAYSTACK_SECRET_KEY'), m, p, b),
    vapi: (m, p, b) => api('https://api.vapi.ai', env('VAPI_PRIVATE_KEY'), m, p, b),
    notify: sendEmail,
    now: () => new Date(),
    env: { siteUrl: SITE_URL, ownerEmail: env('OWNER_EMAIL') || null, graceDays: Number(env('GRACE_DAYS', '7')) || 7, log: (...a) => console.log(...a) },
  };
}

// CORS for calls from the website (portal and admin).
export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = origin === SITE_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : SITE_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(body: Json, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
}
