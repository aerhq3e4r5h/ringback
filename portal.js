/* Client portal: overview, business setup, plan and trial, billing, calls, account. */
(async function(){
  var RB = window.RB, sb = RB.sb;
  var $ = function(id){ return document.getElementById(id); };
  document.querySelectorAll('[data-signout]').forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); dirty = false; RB.signOut(); }); });

  var user = await RB.requireUser();
  if (!user) return;

  var PLANS = RB.PLANS;
  var STATUS = { new:['new','Getting started'], req:['req','Trial requested'], setting_up:['setting_up','Setting up'], trial:['trial','Trial running'], live:['live','Live'], paused:['paused','Paused'] };
  var REQUIRED = ['business_name','trade','phone','service_areas','hours','callout_weekday'];
  var LABELS = { business_name:'Business name', trade:'Trade', phone:'Cellphone for alerts', service_areas:'Suburbs you cover', hours:'Working hours', callout_weekday:'Call-out fee, weekdays' };
  var FIELDS = ['owner_name','services','not_offered','service_areas','excluded_areas','hours','after_hours','callout_weekday','callout_after','emergencies','callback_promise','booking','calendar_email','languages','always_say','never_say','notes'];
  var INV = { due:['amber','Due'], overdue:['red','Overdue'], pending:['ember','Checking payment'], paid:['mint','Paid'], void:['','Cancelled'] };

  var profile = null, calls = [], invoices = [], billing = {}, dirty = false, tried = false;

  function showLoadError(){
    $('loading').hidden = true; var e = $('loadErr'); e.hidden = false;
    e.innerHTML = 'We couldn\'t load your account just now. <button type="button" class="linkbtn" id="retryLoad">Try again</button> or <a class="linkbtn" target="_blank" rel="noopener" href="' + RB.wa('Hi Ringback, my portal won\'t load.') + '">WhatsApp us</a>.';
    $('retryLoad').onclick = function(){ location.reload(); };
  }

  async function load(){
    var p = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (p.error) return false;
    if (!p.data) { p = await sb.rpc('ensure_profile'); if (Array.isArray(p.data)) p.data = p.data[0]; if (p.error || !p.data || !p.data.id) return false; }
    profile = p.data; profile.setup = profile.setup || {};
    var pending = null; try { pending = sessionStorage.getItem('rb_plan'); sessionStorage.removeItem('rb_plan'); } catch (e) {}
    if (pending && PLANS[pending] && !profile.plan) { var u = await sb.from('profiles').update({ plan: pending }).eq('id', user.id); if (!u.error) profile.plan = pending; }
    var r = await Promise.all([
      sb.from('calls').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(200),
      sb.from('invoices').select('*').eq('user_id', user.id).order('issued_at', { ascending: false }).limit(200),
      sb.from('billing_settings').select('*').eq('id', 1).maybeSingle()
    ]);
    calls = r[0].data || []; invoices = r[1].data || []; billing = r[2].data || {};
    sb.rpc('is_admin').then(function(x){ if (x.data === true) { $('adminLink').hidden = false; $('adminLinkM').hidden = false; } });
    return true;
  }

  /* ---------- helpers ---------- */
  function setupValues(){ var s = Object.assign({}, profile.setup); s.business_name = profile.business_name; s.trade = profile.trade; s.phone = profile.phone; return s; }
  function filled(v){ return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }
  function missingOf(s){ return REQUIRED.filter(function(k){ return !filled(s[k]); }); }
  function setupPct(){ return Math.round((REQUIRED.length - missingOf(setupValues()).length) / REQUIRED.length * 100); }
  function listLabels(keys){ var l = keys.map(function(k){ return LABELS[k].toLowerCase(); }); return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]; }
  function statusKey(){ if (profile.status === 'new' && profile.trial_requested_at) return 'req'; return profile.status; }
  function firstName(){ var n = (profile.setup.owner_name || profile.full_name || '').trim().split(' ')[0]; return n || 'there'; }
  function fmtDate(d){ try { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return (m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(d)).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }); } catch (e) { return d; } }
  function fmtTime(d){ try { return new Date(d).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); } catch (e) { return d; } }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function invState(i){ return i.status === 'due' && i.due_date < today() ? 'overdue' : i.status; }
  function invTotal(i){ return (i.amount_cents || 0) + (i.vat_cents || 0); }
  function open(i){ return i.status === 'due' || i.status === 'pending'; }

  /* ---------- overview ---------- */
  function renderOverview(){
    var h = new Date().getHours();
    $('greet').textContent = (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ', ' + firstName();
    $('greetKicker').textContent = profile.business_name || 'Overview';
    var st = STATUS[statusKey()] || STATUS.new, pill = $('statusPill');
    pill.className = 'status ' + st[0]; pill.lastChild.textContent = st[1];
    var pct = setupPct(), miss = missingOf(setupValues()), s = profile.status;
    var steps = [
      { t:'Create your account', d:'Done. Welcome to Ringback.', done:true },
      { t:'Fill in your business details', d:pct === 100 ? 'Complete' : pct + '% complete · still needed: ' + listLabels(miss), done:pct === 100, href:'#setup', btn:'Finish setup' },
      { t:'Choose a plan', d:profile.plan ? PLANS[profile.plan].name : 'Founding partner, Starter or Pro', done:!!profile.plan, href:'#plan', btn:'Choose a plan' },
      { t:'Request your free trial week', d:profile.trial_requested_at ? 'Requested ' + fmtDate(profile.trial_requested_at) : 'We\'ll WhatsApp you to arrange it', done:!!profile.trial_requested_at, href:'#plan', btn:'Request trial' },
      { t:'We set up your assistant and forwarding', d:'A 10-minute session with us', done:['trial','live'].indexOf(s) >= 0, href:null, btn:'WhatsApp us' },
      { t:'You\'re live', d:'Every missed call answered', done:s === 'live' }
    ];
    var doneN = steps.filter(function(x){ return x.done; }).length, nextStep = steps.filter(function(x){ return !x.done; })[0];
    var ring = Math.round(doneN / steps.length * 100);
    $('ring').style.setProperty('--v', ring); $('ringVal').textContent = ring + '%';
    $('checklist').innerHTML = steps.map(function(x){
      var cls = x.done ? 'done' : (x === nextStep ? 'next' : '');
      return '<li class="' + cls + '"><span class="dot">' + RB.icon('i-check') + '</span><div><b>' + RB.esc(x.t) + '</b><small>' + RB.esc(x.d) + '</small></div>' + (x === nextStep && x.href ? '<a class="btn btn-line btn-sm" href="' + x.href + '">Go</a>' : '<span></span>') + '</li>';
    }).join('');
    var nb = $('nextBtn');
    if (!nextStep) { $('nextText').textContent = 'You\'re all set. Ringback is answering your missed calls.'; nb.textContent = 'View calls'; nb.href = '#calls'; nb.removeAttribute('target'); }
    else if (nextStep.href) { $('nextText').textContent = 'Next: ' + nextStep.t.toLowerCase() + '.'; nb.textContent = nextStep.btn; nb.href = nextStep.href; nb.removeAttribute('target'); }
    else { $('nextText').textContent = 'We\'ve got your request. We\'ll WhatsApp you within one working day to set up forwarding.'; nb.textContent = 'WhatsApp us'; nb.href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || '') + '. I\'d like to set up my trial.'); nb.target = '_blank'; }
    $('planName').textContent = profile.plan ? PLANS[profile.plan].name : 'Not chosen yet';
    $('planNote').textContent = profile.plan ? RB.money(PLANS[profile.plan].monthly).replace('.00', '') + PLANS[profile.plan].per + ' · ' + PLANS[profile.plan].setupText : 'Pick the plan that fits. You start with a free trial week either way.';
    var since = Date.now() - 30 * 864e5;
    $('callCount').textContent = calls.filter(function(c){ return new Date(c.occurred_at).getTime() > since; }).length;
    $('helpWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I need a hand with my account.');
    var openInv = invoices.filter(open), due = openInv.filter(function(i){ return i.status === 'due'; });
    $('dueTotal').textContent = RB.money(openInv.reduce(function(a, i){ return a + invTotal(i); }, 0));
    var overdue = due.filter(function(i){ return invState(i) === 'overdue'; });
    $('dueNote').textContent = overdue.length ? overdue.length + ' overdue invoice' + (overdue.length > 1 ? 's' : '') + '. Please pay as soon as you can.' :
      due.length ? 'Due by ' + fmtDate(due.map(function(i){ return i.due_date; }).sort()[0]) + '.' :
      openInv.length ? 'We\'re confirming your payment.' : 'Nothing to pay right now.';
  }

  /* ---------- setup form ---------- */
  var form = $('setupForm');
  function fillSetup(){
    var s = setupValues(), E = form.elements;
    ['business_name','phone'].concat(FIELDS).forEach(function(k){
      var el = E.namedItem(k); if (!el) return;
      if (k === 'languages') { [].forEach.call(form.querySelectorAll('[name=languages]'), function(cb){ cb.checked = (s.languages || ['English']).indexOf(cb.value) >= 0; }); return; }
      if (k === 'after_hours') { [].forEach.call(form.querySelectorAll('[name=after_hours]'), function(r){ r.checked = r.value === s.after_hours; }); return; }
      if (s[k] != null) el.value = s[k];
    });
    if (s.trade) { var t = E.namedItem('trade'); [].forEach.call(t.options, function(o){ if (o.text === s.trade || o.value === s.trade) t.value = o.value; }); }
    tried = Object.keys(profile.setup).length > 0;
    updateMeter();
  }
  function readSetup(){
    var E = form.elements, out = {};
    FIELDS.forEach(function(k){
      if (k === 'languages') { out.languages = [].filter.call(form.querySelectorAll('[name=languages]'), function(c){ return c.checked; }).map(function(c){ return c.value; }); return; }
      if (k === 'after_hours') { var r = form.querySelector('[name=after_hours]:checked'); out.after_hours = r ? r.value : null; return; }
      var el = E.namedItem(k); if (el) out[k] = el.value.trim();
    });
    return { business_name: E.namedItem('business_name').value.trim(), trade: E.namedItem('trade').value, phone: E.namedItem('phone').value.trim(), setup: out };
  }
  function formMissing(){ var v = readSetup(); return missingOf(Object.assign({}, v.setup, { business_name: v.business_name, trade: v.trade, phone: v.phone })); }
  function updateMeter(){
    var miss = formMissing(), pct = Math.round((REQUIRED.length - miss.length) / REQUIRED.length * 100);
    $('setupPct').textContent = pct + '% complete'; $('setupMeter').style.setProperty('--v', pct + '%');
    REQUIRED.forEach(function(k){ var el = form.elements.namedItem(k); if (el) { if (tried && miss.indexOf(k) >= 0) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); } });
    var box = $('missingBox');
    if (miss.length && tried) {
      box.hidden = false;
      box.innerHTML = RB.icon('i-alert') + '<span><b>Still needed before we can switch you on:</b> ' + miss.map(function(k){ return '<button type="button" class="linkbtn" data-focus="' + k + '">' + RB.esc(LABELS[k]) + '</button>'; }).join(', ') + '</span>';
      box.querySelectorAll('[data-focus]').forEach(function(b){ b.onclick = function(){ focusField(b.dataset.focus); }; });
    } else box.hidden = true;
    $('setupDone').hidden = !(setupPct() === 100 && !miss.length && !dirty);
  }
  function focusField(k){ var el = form.elements.namedItem(k); if (!el) return; el.scrollIntoView({ block: 'center', behavior: RB.reduced ? 'auto' : 'smooth' }); setTimeout(function(){ el.focus({ preventScroll: true }); }, RB.reduced ? 0 : 350); }
  form.addEventListener('input', function(){ dirty = true; $('saveState').textContent = 'Unsaved changes'; updateMeter(); });
  form.querySelectorAll('[data-fill]').forEach(function(b){
    b.addEventListener('click', function(){ var el = form.elements.namedItem(b.dataset.fill); el.value = b.dataset.val; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); });
  });
  window.addEventListener('beforeunload', function(e){ if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var v = readSetup(); tried = true;
    if (!v.business_name) { updateMeter(); focusField('business_name'); return RB.toast('Please add your business name.', 'err'); }
    var b = $('saveBtn'); b.classList.add('loading');
    var r = await sb.from('profiles').update(v).eq('id', user.id).select().maybeSingle();
    b.classList.remove('loading');
    if (r.error || !r.data) { $('saveState').textContent = 'Not saved'; return RB.toast(r.error && /fetch|network/i.test(r.error.message) ? 'No connection. Your changes are still here; try again.' : 'Couldn\'t save. Please try again, or WhatsApp us.', 'err'); }
    profile = r.data; profile.setup = profile.setup || {}; dirty = false;
    $('saveState').textContent = 'Saved ' + new Date().toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' });
    var miss = missingOf(setupValues());
    updateMeter(); renderOverview(); renderPlan();
    if (miss.length) { RB.toast('Saved. Still needed: ' + listLabels(miss) + '.', 'warn'); focusField(miss[0]); }
    else { RB.toast('Setup complete. Next, choose a plan.', 'ok'); $('setupDone').scrollIntoView({ block: 'center', behavior: RB.reduced ? 'auto' : 'smooth' }); }
  });

  /* ---------- plan + trial ---------- */
  function renderPlan(){
    $('planCards').innerHTML = Object.keys(PLANS).map(function(k){
      var p = PLANS[k], sel = profile.plan === k;
      return '<div class="plan' + (sel ? ' sel' : '') + (k === 'founding' ? ' star' : '') + '">' + (k === 'founding' ? '<span class="ribbon">3 places</span>' : '') +
        '<div><h3>' + p.name + '</h3></div><div class="price"><b>' + RB.money(p.monthly).replace('.00', '') + '</b><span>' + p.per + '</span></div><p class="setup">' + p.setupText + '</p>' +
        '<ul>' + p.feats.map(function(f){ return '<li>' + RB.icon('i-check') + RB.esc(f) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn ' + (sel ? 'btn-line' : 'btn-hot') + '" data-plan="' + k + '"' + (sel ? ' disabled' : '') + '>' + (sel ? 'Your plan' : 'Choose ' + p.name) + '</button></div>';
    }).join('');
    $('planCards').querySelectorAll('[data-plan]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        btn.classList.add('loading');
        var r = await sb.from('profiles').update({ plan: btn.dataset.plan }).eq('id', user.id).select().maybeSingle();
        if (r.error || !r.data) { btn.classList.remove('loading'); return RB.toast('Couldn\'t change plan. Please try again.', 'err'); }
        profile = r.data; profile.setup = profile.setup || {}; RB.toast('Plan updated to ' + PLANS[profile.plan].name, 'ok'); renderPlan(); renderOverview(); renderBilling();
      });
    });
    var tb = $('trialBtn'), pct = setupPct(), miss = missingOf(setupValues());
    $('trialWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I\'d like to set up my free trial week.');
    $('trialFix').hidden = true;
    if (profile.trial_requested_at) {
      $('trialTitle').textContent = 'Trial requested ' + fmtDate(profile.trial_requested_at);
      $('trialText').textContent = ['trial','live'].indexOf(profile.status) >= 0 ? 'Your assistant is set up. Thanks for trying Ringback.' : 'We\'ll WhatsApp you within one working day to set up call forwarding. Want to speed things up? Message us now.';
      tb.hidden = true;
    } else {
      tb.hidden = false; $('trialTitle').textContent = 'Ready when you are';
      if (pct < 100) {
        tb.disabled = true; $('trialFix').hidden = false;
        $('trialText').textContent = 'Your business details are ' + pct + '% done. Still needed: ' + listLabels(miss) + '. Then request your trial here.';
      } else if (!profile.plan) {
        tb.disabled = false; $('trialText').textContent = 'All set. Pick a plan above (you can change it later), then request your trial and we\'ll WhatsApp you to set up call forwarding.';
      } else {
        tb.disabled = false; $('trialText').textContent = 'All set. Request your trial and we\'ll WhatsApp you to set up call forwarding.';
      }
    }
  }
  $('trialBtn').addEventListener('click', async function(){
    var b = $('trialBtn'); b.classList.add('loading');
    var r = await sb.from('profiles').update({ trial_requested_at: new Date().toISOString() }).eq('id', user.id).select().maybeSingle();
    b.classList.remove('loading');
    if (r.error || !r.data) return RB.toast('Couldn\'t send your request. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; RB.toast('Trial requested. We\'ll be in touch.', 'ok'); renderPlan(); renderOverview(); renderBilling();
  });

  /* ---------- billing ---------- */
  function renderBilling(){
    var openInv = invoices.filter(open), pending = invoices.filter(function(i){ return i.status === 'pending'; });
    var paid = invoices.filter(function(i){ return i.status === 'paid'; });
    var due = invoices.filter(function(i){ return i.status === 'due'; }).map(function(i){ return i.due_date; }).sort();
    $('billKpis').innerHTML = [['Outstanding', RB.money(openInv.reduce(function(a, i){ return a + invTotal(i); }, 0)), true], ['Next due', due.length ? fmtDate(due[0]) : '—'], ['Checking payment', pending.length], ['Paid to date', RB.money(paid.reduce(function(a, i){ return a + invTotal(i); }, 0))]]
      .map(function(k){ return '<div class="kpi' + (k[2] ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('');
    var badge = $('billBadge'), nDue = invoices.filter(function(i){ return i.status === 'due'; }).length;
    badge.hidden = !nDue; badge.textContent = nDue;

    if (!invoices.length) {
      $('invoiceBox').innerHTML = '<div class="empty"><span class="ic">' + RB.icon('i-receipt') + '</span><h3>No invoices yet</h3><p style="max-width:46ch">' +
        (['trial','live','paused'].indexOf(profile.status) >= 0 ? 'Your invoices will show up here as soon as we send them.' : 'Nothing to pay yet. Your first invoice comes after your free trial week, and only if you decide to continue.') + '</p></div>';
    } else {
      $('invoiceBox').innerHTML = '<div class="inv-list">' + invoices.map(function(i){
        var st = INV[invState(i)] || INV.due, canPay = i.status === 'due';
        return '<div class="inv"><div class="inv-main"><div class="inv-top"><b class="mono">' + RB.esc(i.number) + '</b><span class="tag ' + st[0] + '">' + st[1] + '</span></div><p>' + RB.esc(i.description) + '</p>' +
          '<small class="faint">Issued ' + fmtDate(i.issued_at) + (i.status === 'paid' ? ' · Paid ' + fmtDate(i.paid_at) : i.status === 'pending' ? ' · You told us you paid on ' + fmtDate(i.client_paid_at) : i.status === 'void' ? '' : ' · Due ' + fmtDate(i.due_date)) + '</small>' +
          (i.note ? '<small class="faint">Note from us: ' + RB.esc(i.note) + '</small>' : '') + '</div>' +
          '<div class="inv-amt">' + RB.money(invTotal(i)) + (i.vat_cents ? '<small class="faint">incl. VAT</small>' : '') + '</div>' +
          '<div class="inv-act"><a class="btn btn-line btn-sm" href="invoice.html?id=' + i.id + '">' + RB.icon('i-receipt') + 'View</a>' + (canPay ? '<button type="button" class="btn btn-hot btn-sm" data-pay="' + i.id + '">I\'ve paid</button>' : '') + '</div></div>';
      }).join('') + '</div>';
      $('invoiceBox').querySelectorAll('[data-pay]').forEach(function(b){ b.onclick = function(){ payDialog(invoices.filter(function(i){ return String(i.id) === b.dataset.pay; })[0]); }; });
    }

    var bank = [['Bank', billing.bank_name], ['Account holder', billing.account_holder], ['Account number', billing.account_number], ['Branch code', billing.branch_code], ['Account type', billing.account_type]].filter(function(r){ return r[1]; });
    var ref = (invoices.filter(function(i){ return i.status === 'due'; })[0] || {}).number || 'your invoice number';
    $('bankCard').innerHTML = '<span class="kicker">Pay by EFT</span>' + (billing.account_number ?
      '<dl class="bank">' + bank.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd><span>' + RB.esc(r[1]) + '</span>' + (/number|code/i.test(r[0]) ? '<button type="button" class="icon-btn" data-copy="' + RB.esc(r[1]) + '" aria-label="Copy ' + r[0].toLowerCase() + '">' + RB.icon('i-copy') + '</button>' : '') + '</dd></div>'; }).join('') +
      '<div><dt>Reference</dt><dd><b class="hot">' + RB.esc(ref) + '</b>' + (ref !== 'your invoice number' ? '<button type="button" class="icon-btn" data-copy="' + RB.esc(ref) + '" aria-label="Copy reference">' + RB.icon('i-copy') + '</button>' : '') + '</dd></div></dl>' +
      '<p style="font-size:.88rem">Always use the invoice number as your reference so we can match your payment.</p>' :
      '<h3>Banking details</h3><p>Our banking details are on each invoice, and we\'ll send them with your first one. Questions about paying? WhatsApp us.</p><a class="btn btn-line btn-sm" style="align-self:flex-start" target="_blank" rel="noopener" href="' + RB.wa('Hi Ringback, I have a question about paying my invoice.') + '">' + RB.icon('i-wa') + 'WhatsApp us</a>');
    $('bankCard').querySelectorAll('[data-copy]').forEach(function(b){ b.onclick = function(){ RB.copy(b.dataset.copy, b); }; });

    var p = profile.plan && PLANS[profile.plan], vat = billing.vat_registered;
    $('costCard').innerHTML = '<span class="kicker">What you\'ll pay</span>' + (p ?
      '<h3>' + RB.esc(p.name) + '</h3><dl class="bank"><div><dt>Monthly</dt><dd>' + RB.money(p.monthly) + (profile.plan === 'founding' ? ' for 60 days' : '') + '</dd></div><div><dt>Once-off setup</dt><dd>' + (p.setup ? RB.money(p.setup) : 'Free') + '</dd></div><div><dt>Minutes included</dt><dd>' + p.minutes + ' a month</dd></div></dl>' +
      '<p style="font-size:.88rem">' + (vat ? 'Plus VAT. ' : '') + 'Your free trial week comes first. We only invoice once you decide to continue. Extra minutes R5 each.</p><a class="link" href="#plan">Change plan ' + RB.icon('i-arrow') + '</a>' :
      '<h3>No plan yet</h3><p>Choose a plan to see what you\'ll pay. Every plan starts with a free trial week.</p><a class="link" href="#plan">Choose a plan ' + RB.icon('i-arrow') + '</a>');
  }

  function payDialog(inv){
    if (!inv) return;
    var last = document.activeElement;
    var sheet = document.createElement('div'); sheet.className = 'sheet';
    sheet.innerHTML = '<form class="sheet-in form" role="dialog" aria-modal="true" aria-labelledby="payTitle" novalidate>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 id="payTitle" style="font-size:1.6rem">Let us know you\'ve paid</h2><button class="btn btn-line btn-sm" type="button" data-close>Close</button></div>' +
      '<dl class="bank"><div><dt>Invoice</dt><dd class="mono">' + RB.esc(inv.number) + '</dd></div><div><dt>Amount</dt><dd><b>' + RB.money(invTotal(inv)) + '</b></dd></div><div><dt>Reference to use</dt><dd class="mono">' + RB.esc(inv.number) + '</dd></div></dl>' +
      '<label class="fld"><span>Proof of payment <small>(optional · PDF or photo, up to 5 MB)</small></span><input type="file" name="proof" accept="application/pdf,image/jpeg,image/png,image/webp"></label>' +
      '<label class="fld"><span>Anything we should know? <small>(optional)</small></span><textarea name="note" maxlength="500" placeholder="e.g. Paid from my FNB account on 12 October"></textarea></label>' +
      '<p class="form-msg" id="payMsg" aria-live="polite"></p>' +
      '<div class="ctas" style="margin-top:0"><button class="btn btn-hot" type="submit">Confirm payment sent</button><button class="btn btn-line" type="button" data-close>Cancel</button></div>' +
      '<p class="faint" style="font-size:.84rem">We\'ll check our bank and mark it paid, usually within one working day. Only you and Ringback can see your proof of payment.</p></form>';
    document.body.appendChild(sheet);
    var f = sheet.querySelector('form'), msg = sheet.querySelector('#payMsg'), busy = false;
    function close(){ if (busy) return; sheet.remove(); document.removeEventListener('keydown', onKey); if (last && last.focus) last.focus(); }
    function onKey(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    sheet.addEventListener('click', function(e){ if (e.target === sheet || e.target.closest('[data-close]')) close(); });
    sheet.querySelector('[data-close]').focus();
    f.addEventListener('submit', async function(e){
      e.preventDefault(); if (busy) return;
      var file = f.elements.namedItem('proof').files[0], note = f.elements.namedItem('note').value.trim(), path = null;
      msg.className = 'form-msg'; msg.textContent = '';
      if (file) {
        if (file.size > 5 * 1024 * 1024) { msg.className = 'form-msg err'; msg.textContent = 'That file is over 5 MB. Try a smaller photo or a PDF.'; return; }
        if (['application/pdf','image/jpeg','image/png','image/webp'].indexOf(file.type) < 0) { msg.className = 'form-msg err'; msg.textContent = 'Please upload a PDF, JPG, PNG or WebP file.'; return; }
      }
      busy = true; var btn = f.querySelector('[type=submit]'); btn.classList.add('loading');
      if (file) {
        var ext = { 'application/pdf':'pdf', 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[file.type];
        path = user.id + '/' + inv.number + '-' + Date.now() + '.' + ext;
        var up = await sb.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) { busy = false; btn.classList.remove('loading'); msg.className = 'form-msg err'; msg.textContent = 'Couldn\'t upload that file. You can still confirm without it, or try again.'; f.elements.namedItem('proof').value = ''; return; }
      }
      var r = await sb.rpc('client_mark_paid', { p_invoice: inv.id, p_proof: path, p_note: note || null });
      busy = false; btn.classList.remove('loading');
      if (r.error || !r.data) { msg.className = 'form-msg err'; msg.textContent = (r.error && r.error.message && !/fetch/i.test(r.error.message) ? r.error.message + ' ' : '') + 'Please try again, or WhatsApp us.'; return; }
      var updated = Array.isArray(r.data) ? r.data[0] : r.data;
      invoices = invoices.map(function(i){ return i.id === updated.id ? updated : i; });
      close(); renderBilling(); renderOverview();
      RB.toast('Thanks! We\'ll confirm your payment within one working day.', 'ok');
    });
  }

  /* ---------- calls ---------- */
  function renderCalls(){
    var since = Date.now() - 30 * 864e5, recent = calls.filter(function(c){ return new Date(c.occurred_at).getTime() > since; });
    var count = function(t){ return recent.filter(function(c){ return c.call_type === t; }).length; };
    $('callKpis').innerHTML = [['Calls, last 30 days', recent.length, true], ['Emergencies', count('emergency')], ['Booked', count('booked')], ['Callbacks', count('callback')]]
      .map(function(k){ return '<div class="kpi' + (k[2] ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('');
    if (!calls.length) {
      $('callsBox').innerHTML = '<div class="empty"><span class="ic">' + RB.icon('i-phone') + '</span><h3>No calls yet</h3><p style="max-width:44ch">Once Ringback is live on your number, every call it takes shows up here with a summary and recording.</p><a class="btn btn-line btn-sm" href="index.html#try">Hear the demo</a></div>';
      return;
    }
    var tag = { emergency:'red', booked:'mint', callback:'amber', other:'' };
    $('callsBox').innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Caller</th><th>Suburb</th><th>Problem</th><th>Outcome</th><th>Recording</th></tr></thead><tbody>' +
      calls.map(function(c){
        return '<tr><td class="mono">' + RB.esc(fmtTime(c.occurred_at)) + '</td><td>' + RB.esc(c.caller_name || '—') + (c.caller_phone ? '<br><span class="faint mono">' + RB.esc(c.caller_phone) + '</span>' : '') + '</td><td>' + RB.esc(c.suburb || '—') + '</td><td>' + RB.esc(c.problem || '—') + '</td><td><span class="tag ' + (tag[c.call_type] || '') + '">' + RB.esc(c.call_type || 'other') + '</span>' + (c.booked_slot ? '<br><span class="faint mono">' + RB.esc(c.booked_slot) + '</span>' : '') + '</td><td>' + (c.recording_url && /^https:\/\//.test(c.recording_url) ? '<a class="link" target="_blank" rel="noopener" href="' + RB.esc(c.recording_url) + '">Listen</a>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------- account ---------- */
  function renderAccount(){
    $('acEmail').value = user.email; $('acName').value = profile.full_name || '';
    $('whoName').textContent = profile.business_name || profile.full_name || 'Your account'; $('whoEmail').textContent = user.email;
  }
  $('accountForm').addEventListener('submit', async function(e){
    e.preventDefault();
    var r = await sb.from('profiles').update({ full_name: $('acName').value.trim() }).eq('id', user.id).select().maybeSingle();
    if (r.error || !r.data) return RB.toast('Couldn\'t save. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; renderAccount(); renderOverview(); RB.toast('Saved', 'ok');
  });
  $('dlBtn').addEventListener('click', function(){
    var blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), account: { email: user.email }, profile: profile, invoices: invoices, calls: calls }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ringback-my-data.json'; document.body.appendChild(a); a.click(); a.remove();
  });
  function showDelBtn(){
    $('delArea').innerHTML = '<button class="btn btn-danger btn-sm" type="button" id="delBtn" style="justify-self:start">' + RB.icon('i-trash') + 'Request deletion</button>';
    $('delBtn').onclick = askDelete;
  }
  function askDelete(){
    var area = $('delArea');
    area.innerHTML = '<p class="alert err">This deletes your account, business details and call history. Are you sure?</p><div class="ctas" style="margin-top:0"><button class="btn btn-danger btn-sm" type="button" id="delYes">Yes, delete my account</button><button class="btn btn-line btn-sm" type="button" id="delNo">Cancel</button></div>';
    $('delNo').onclick = showDelBtn;
    $('delYes').onclick = async function(){
      this.classList.add('loading');
      var r = await sb.from('requests').insert({ user_id: user.id, kind: 'delete_account', note: 'Requested from portal' });
      area.innerHTML = r.error ? '<p class="alert err">Couldn\'t send the request. Please WhatsApp us and we\'ll delete it for you.</p>' : '<p class="alert ok">Request received. We\'ll delete your account within 7 days and confirm by email.</p>';
    };
  }
  $('delBtn').onclick = askDelete;

  /* ---------- routing ---------- */
  var VIEWS = ['overview','setup','plan','billing','calls','account'];
  function route(){
    var v = location.hash.replace('#','') || 'overview'; if (VIEWS.indexOf(v) < 0) v = 'overview';
    document.querySelectorAll('[data-view]').forEach(function(s){ s.hidden = s.dataset.view !== v; });
    document.querySelectorAll('[data-nav]').forEach(function(a){ if (a.dataset.nav === v) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  if (!(await load())) return showLoadError();
  $('loading').hidden = true;
  renderOverview(); fillSetup(); renderPlan(); renderBilling(); renderCalls(); renderAccount(); route();
  var payId = new URLSearchParams(location.search).get('pay');
  if (payId) {
    history.replaceState(null, '', location.pathname + location.hash);
    var toPay = invoices.filter(function(i){ return String(i.id) === payId && i.status === 'due'; })[0];
    if (toPay) payDialog(toPay);
  }
  sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_OUT') location.replace('login.html'); });
})();
