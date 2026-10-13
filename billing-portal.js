/* Portal card billing: pay by card (Paystack), subscription status, the minutes meter, and confirming a payment
   after Paystack sends the client back. Talks to the 'billing' Edge Function and the my_usage() database function.
   Everything stays hidden unless config.payments is true (see supabase/BILLING-SETUP.md). */
(function(){
  var RB = window.RB, C = window.RB_CONFIG || {}, sb = RB && RB.sb;
  if (!C.payments || !sb) return;
  var $ = function(id){ return document.getElementById(id); };
  var st = { p: null, usage: null, plans: {}, vat: false, uid: null, confirming: false };
  var COLS = 'id,email,plan,plan_active,billing_status,period_start,period_end,card_brand,card_last4,card_exp,status,paused_reason,past_due_since,billing_updated_at';

  function money(c){ return RB.money(c).replace('.00', ''); }
  function vatOn(c){ return st.vat ? Math.round(c * 1.15) : c; }
  function day(d){ try { return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function dayShort(d){ try { return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function esc(s){ return RB.esc(s == null ? '' : String(s)); }

  async function call(action, extra){
    var r = await sb.functions.invoke('billing', { body: Object.assign({ action: action }, extra || {}) });
    if (!r.error) return r.data || {};
    var msg = 'We couldn\'t reach the payment service. Check your signal and try again.';
    try { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }

  async function refresh(){
    if (!st.uid) { var s = await sb.auth.getSession(); st.uid = s && s.data && s.data.session && s.data.session.user.id; if (!st.uid) return; }
    var r = await Promise.all([
      sb.from('profiles').select(COLS).eq('id', st.uid).maybeSingle(),
      sb.rpc('my_usage'),
      sb.from('plan_catalog').select('key,name,monthly_cents,setup_cents,minutes,extra_min_cents,invoice_limit,features').order('sort'),
      sb.from('billing_settings').select('vat_registered').eq('id', 1).maybeSingle()
    ]);
    if (r[0].error || !r[0].data) return;   // billing.sql not run yet, or offline: show nothing rather than something wrong
    st.p = r[0].data;
    st.usage = r[1].error ? null : (typeof r[1].data === 'string' ? JSON.parse(r[1].data) : r[1].data);
    st.plans = {}; (r[2].data || []).forEach(function(k){ st.plans[k.key] = k; });
    st.vat = !!(r[3].data && r[3].data.vat_registered);
    render();
  }

  /* ---------- the subscription card (Plan and Billing views) ---------- */
  function subHtml(){
    var p = st.p, k = p.plan_active && st.plans[p.plan_active], chosen = p.plan && st.plans[p.plan];
    if (!Object.keys(st.plans).length) return '';
    var vatNote = st.vat ? ' incl. VAT' : '';
    var card = p.card_last4 ? esc((p.card_brand || 'Card').replace(/^\w/, function(c){ return c.toUpperCase(); })) + ' •••• ' + esc(p.card_last4) + (p.card_exp ? ' (exp ' + esc(p.card_exp) + ')' : '') : '';
    var head = function(tag, cls){ return '<div class="bp-head"><span class="kicker">Card payments</span><span class="tag ' + cls + '">' + tag + '</span></div>'; };
    var s = p.billing_status;
    if (k && (s === 'active' || s === 'past_due' || s === 'non_renewing' || s === 'cancelled')) {
      var out = '<div class="card stack-s bp-card">' + head(s === 'active' ? 'Active' : s === 'past_due' ? 'Payment failed' : 'Ending', s === 'active' ? 'mint' : s === 'past_due' ? 'red' : 'amber') +
        '<h3 class="h-sm">' + esc(k.name) + ' · ' + money(vatOn(k.monthly_cents)) + ' a month' + vatNote + '</h3>';
      if (s === 'active') out += '<p>' + (p.period_end ? 'Next charge on <b>' + day(p.period_end) + '</b>' : 'Paid by card') + (card ? ' to your ' + card : '') + '. ' + k.minutes + ' minutes a month included; extra minutes ' + money(vatOn(k.extra_min_cents)) + ' each.</p>';
      if (s === 'past_due') out += '<p class="alert err">Your last monthly payment didn\'t go through' + (card ? ' on your ' + card : '') + '. Update your card and Paystack will try again. Ringback pauses if it stays unpaid for a week.</p>';
      if (s === 'non_renewing' || s === 'cancelled') out += '<p>Your plan won\'t renew. Ringback keeps answering until <b>' + day(p.period_end) + '</b>, then pauses.' + (s === 'non_renewing' && k.invoice_limit ? ' The founding partner period is ending: choose Starter or Pro to keep going.' : '') + '</p>';
      out += '<div class="ctas"><button type="button" class="btn ' + (s === 'past_due' ? 'btn-hot' : 'btn-line') + ' btn-sm" data-bp="manage" data-net>' + (s === 'past_due' ? 'Update my card' : 'Update card or cancel') + '</button></div>';
      out += changeHtml(k.key) + '</div>';
      return out;
    }
    // not paying yet (or the plan ended): pay by card to activate
    var pick = chosen || null;
    if (!pick) return '<div class="card stack-s bp-card">' + head('Not active', '') + '<h3 class="h-sm">Pay by card when you\'re ready</h3><p>Choose a plan below. Then you can activate it here with a card payment, and it renews monthly on the same card.</p></div>';
    var first = (pick.setup_cents || 0) + pick.monthly_cents;
    return '<div class="card stack-s bp-card">' + head(s === 'ended' ? 'Ended' : 'Not active', s === 'ended' ? 'amber' : '') +
      '<h3 class="h-sm">Activate ' + esc(pick.name) + ' by card</h3>' +
      '<dl class="bank"><div><dt>Today</dt><dd><b>' + money(vatOn(first)) + '</b>' + vatNote + '</dd></div>' +
      (pick.setup_cents ? '<div><dt>Made up of</dt><dd>' + money(vatOn(pick.setup_cents)) + ' once-off setup + ' + money(vatOn(pick.monthly_cents)) + ' first month</dd></div>' : '') +
      '<div><dt>Then</dt><dd>' + money(vatOn(pick.monthly_cents)) + ' a month on the same card' + (pick.invoice_limit ? ' (' + pick.invoice_limit + ' months in total)' : '') + '</dd></div>' +
      '<div><dt>Included</dt><dd>' + pick.minutes + ' minutes a month · extra ' + money(vatOn(pick.extra_min_cents)) + '/min</dd></div></dl>' +
      (pick.key === 'founding' ? '<p class="p-small">The founding partner plan is by approval. If we haven\'t confirmed yours yet, WhatsApp us first.</p>' : '') +
      '<p class="p-small">Your free trial week comes first: pay when you decide to keep Ringback. Payments are handled by Paystack; we never see your card number. 3-month minimum on Starter and Pro, then month-to-month (see our <a href="terms.html#fees">terms</a>).</p>' +
      '<div class="ctas"><button type="button" class="btn btn-hot" data-bp="pay" data-plan="' + esc(pick.key) + '" data-net>' + RB.icon('i-lock') + 'Pay ' + money(vatOn(first)) + ' by card</button></div></div>';
  }
  function changeHtml(current){
    var opts = Object.keys(st.plans).filter(function(k){ return k !== current && k !== 'founding'; });
    if (!opts.length) return '';
    return '<form class="bp-change form" data-bp-change><label class="fld"><span>Want a different plan?</span><select name="plan">' + opts.map(function(k){ return '<option value="' + esc(k) + '">' + esc(st.plans[k].name) + ' · ' + money(vatOn(st.plans[k].monthly_cents)) + '/month</option>'; }).join('') + '</select></label><button type="submit" class="btn btn-line btn-sm" data-net>Ask to switch</button><p class="p-small">We\'ll confirm and move you over from your next billing date. No new setup fee.</p></form>';
  }

  /* ---------- the minutes meter (Overview and Billing views) ---------- */
  function usageHtml(){
    var u = st.usage;
    if (!u || !u.included) return '';
    var pct = Math.min(100, Math.round(u.minutes / u.included * 100)), over = u.extra_minutes > 0;
    var unmeasured = (u.calls || 0) - (u.measured_calls || 0);
    return '<div class="card stack-s bp-usage' + (over ? ' over' : pct >= 80 ? ' near' : '') + '"><div class="bp-head"><span class="kicker">Minutes ' + (u.paid ? 'this billing month' : 'this month') + '</span><span class="mono faint">' + dayShort(u.period_start) + ' – ' + dayShort(new Date(new Date(u.period_end).getTime() - 864e5)) + '</span></div>' +
      '<p class="bp-num"><b class="num">' + u.minutes + '</b> <span class="muted">of ' + u.included + ' minutes · ' + u.calls + ' call' + (u.calls === 1 ? '' : 's') + '</span></p>' +
      '<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="' + u.included + '" aria-valuenow="' + Math.min(u.minutes, u.included) + '" aria-label="Minutes used"><i style="--v:' + pct + '%"></i></div>' +
      (over ? '<p class="p-small"><b>' + u.extra_minutes + ' extra minute' + (u.extra_minutes === 1 ? '' : 's') + '</b> so far, about ' + money(vatOn(u.extra_minutes * u.extra_min_cents)) + '. Ringback keeps answering every call; extra minutes are billed after ' + day(new Date(new Date(u.period_end).getTime() - 864e5)) + '.</p>'
        : pct >= 80 ? '<p class="p-small">You\'re close to your allowance. Ringback keeps answering; extra minutes are ' + money(vatOn(u.extra_min_cents)) + ' each.</p>'
        : '<p class="p-small">Each call counts in whole minutes, rounded up.</p>') +
      (unmeasured > 0 ? '<p class="p-small faint">' + unmeasured + ' call' + (unmeasured === 1 ? ' has' : 's have') + ' no length recorded yet, so ' + (unmeasured === 1 ? 'it isn\'t' : 'they aren\'t') + ' counted.</p>' : '') + '</div>';
  }

  /* ---------- pause / payment notices on the Overview ---------- */
  function noticeHtml(){
    var p = st.p;
    if (st.confirming) return '<div class="alert warn bp-note" role="status"><span class="bars-loader" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span> Confirming your payment with Paystack…</div>';
    if (p.status === 'paused' && p.paused_reason === 'billing') return '<div class="alert err bp-note"><b>Ringback is paused</b> because your monthly payment didn\'t go through. <a class="linkbtn" href="#billing">Update your card</a> and it switches back on as soon as the payment clears.</div>';
    if (p.status === 'paused' && p.paused_reason === 'cancelled') return '<div class="alert warn bp-note"><b>Ringback is paused</b> because your plan ended. <a class="linkbtn" href="#plan">Choose a plan</a> to switch it back on.</div>';
    if (p.billing_status === 'past_due') return '<div class="alert err bp-note">Your last payment didn\'t go through. <a class="linkbtn" href="#billing">Update your card</a> to keep Ringback answering.</div>';
    return '';
  }

  function render(){
    if (!st.p) return;
    var sub = subHtml(), use = usageHtml(), note = noticeHtml();
    [['subCard', sub], ['subCardBill', sub], ['usageOv', use], ['usageBill', use], ['billNotice', note]].forEach(function(x){ var el = $(x[0]); if (el) { el.innerHTML = x[1]; el.classList.toggle('bp-slot', !!x[1]); } });
    document.querySelectorAll('[data-bp]').forEach(function(b){ b.onclick = action; });
    document.querySelectorAll('[data-bp-change]').forEach(function(f){ f.onsubmit = requestChange; });
  }

  async function action(e){
    var b = e.currentTarget; if (b.classList.contains('loading')) return;
    b.classList.add('loading');
    try {
      if (b.dataset.bp === 'pay') {
        var r = await call('checkout', { plan: b.dataset.plan });
        if (!r.url || !/^https:\/\/([a-z0-9-]+\.)*paystack\.(com|co)\//.test(r.url)) throw new Error('The payment page didn\'t open. Please try again.');
        location.href = r.url;   // Paystack's secure checkout; it sends them back to dashboard.html?paid=…#plan
        return;
      }
      if (b.dataset.bp === 'manage') {
        var m = await call('manage');
        if (m.url && /^https:\/\//.test(m.url)) { window.open(m.url, '_blank', 'noopener'); RB.toast('Paystack opened in a new tab. Changes show here after you refresh.', 'ok'); }
      }
    } catch (err) { RB.toast(err.message, 'err'); }
    b.classList.remove('loading');
  }

  async function requestChange(e){
    e.preventDefault();
    var f = e.currentTarget, plan = f.elements.namedItem('plan').value, btn = f.querySelector('[type=submit]');
    btn.classList.add('loading');
    var r = await sb.from('requests').insert({ user_id: st.uid, kind: 'change_plan', note: 'Wants to switch to ' + (st.plans[plan] ? st.plans[plan].name : plan) + ' (' + plan + ')' });
    btn.classList.remove('loading');
    if (r.error) return RB.toast('Couldn\'t send that. Please try again, or WhatsApp us.', 'err');
    f.innerHTML = '<p class="alert ok">Request sent. We\'ll confirm the switch with you within one working day.</p>';
  }

  /* ---------- back from Paystack: wait for the webhook to activate the plan ---------- */
  function confirmPayment(){
    var q = new URLSearchParams(location.search);
    if (!q.has('paid')) return;
    q.delete('paid'); q.delete('trxref'); q.delete('reference');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    st.confirming = true; render();
    var tries = 0, before = st.p && st.p.billing_updated_at;
    (function poll(){
      setTimeout(async function(){
        tries++;
        await refresh();
        var p = st.p;
        if (p && p.plan_active && (p.billing_status === 'active' || p.billing_status === 'non_renewing') && p.billing_updated_at !== before) {
          st.confirming = false; render();
          RB.toast('Payment received. ' + (st.plans[p.plan_active] ? st.plans[p.plan_active].name : 'Your plan') + ' is active.', 'ok');
          return;
        }
        if (tries < 40) return poll();
        st.confirming = false; render();
        RB.toast('Your payment is still being confirmed. Refresh in a few minutes. If you were charged and nothing shows within an hour, WhatsApp us.', 'warn');
      }, tries < 10 ? 3000 : 6000);
    })();
  }

  // The plan cards are re-drawn by portal.js when the client picks a plan: refresh so "Activate …" follows.
  var cards = $('planCards');
  if (cards && 'MutationObserver' in window) { var t = null; new MutationObserver(function(){ clearTimeout(t); t = setTimeout(refresh, 400); }).observe(cards, { childList: true }); }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && !st.confirming) refresh(); });
  refresh().then(confirmPayment);
})();
