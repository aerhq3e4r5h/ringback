/* Client portal: overview, business setup, plan and trial, billing, calls, account.
   Every Supabase read and write goes through RB.call (one session refresh, then back to log in).
   Features that need SQL the owner may not have run yet (calls_followup.sql, founding_spots.sql) hide themselves
   until the database answers. Every piece of database text goes through RB.esc. */
(async function(){
  var RB = window.RB, sb = RB.sb, C = window.RB_CONFIG || {};
  var $ = function(id){ return document.getElementById(id); };
  var $$ = function(s, el){ return [].slice.call((el || document).querySelectorAll(s)); };
  var root = document.documentElement, body = document.body;
  /* the app layout: bottom tab bar, app bar and setup steps */
  var MQ = window.matchMedia('(max-width:900px), (pointer:coarse) and (max-height:500px)');
  var STANDALONE = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (STANDALONE) root.classList.add('is-standalone');
  var OFFLINE_SAVE = 'No signal. Your changes are kept on this phone; tap Save when you\'re back online.';
  var dirty = false, leaving = false;

  $$('[data-signout]').forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); dirty = false; leaving = true; RB.signOut(); }); });

  /* ---------- offline at load: wait for signal, then carry on (or reload if the database library never arrived) ---------- */
  function hideLoading(){ $('loading').hidden = true; }
  if (navigator.onLine === false) {
    hideLoading(); $('offlineBox').hidden = false;
    await new Promise(function(res){ window.addEventListener('online', res, { once: true }); });
    if (!RB.sb) { location.reload(); return; }
    $('offlineBox').hidden = true; $('loading').hidden = false;
  }
  if (!RB.sb && navigator.onLine === false) return;

  var user = await RB.requireUser();
  if (!user) return;
  var UID = user.id, DKEY = 'rb_setup_draft_' + UID, SEENKEY = 'rb_calls_seen_' + UID;

  var PLANS = RB.PLANS;
  var STATUS = { new:['new','Getting started'], req:['req','Trial requested'], setting_up:['setting_up','Setting up'], trial:['trial','Trial running'], live:['live','Live'], paused:['paused','Paused'] };
  var REQUIRED = ['business_name','trade','phone','service_areas','hours','callout_weekday'];
  var LABELS = { business_name:'Business name', trade:'Trade', phone:'Cellphone for alerts', service_areas:'Suburbs you cover', hours:'Working hours', callout_weekday:'Call-out fee, weekdays' };
  var FIELDS = ['owner_name','services','not_offered','service_areas','excluded_areas','hours','after_hours','callout_weekday','callout_after','emergencies','callback_promise','booking','calendar_email','languages','always_say','never_say','notes'];
  var INV = { due:['amber','Due'], overdue:['red','Overdue'], pending:['ember','Checking payment'], paid:['mint','Paid'], void:['','Cancelled'] };
  var OUT = { emergency:['red','Emergency'], booked:['mint','Booked'], callback:['amber','Callback'], other:['','Other'] };
  var PAGE = 200;

  var profile = null, calls = [], invoices = [], billing = {}, tried = false, isAdmin = false, founding = null;
  var morePossible = false, followup = false, lastLoad = 0, view = 'overview';
  /* the view asked for, so a session expiry during the first load returns here */
  var startView = location.hash.replace('#', '').split('/')[0];

  /* ---------- storage (never trusted, never required) ---------- */
  function lsGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k){ try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------- RB.call: run a Supabase request; on an expired session refresh once, else back to log in ---------- */
  var refreshing = null;
  function run(fn){ return Promise.resolve().then(fn).then(function(r){ return r || {}; }, function(e){ return { error: { message: (e && e.message) || 'Failed to fetch' } }; }); }
  function authErr(r){ var e = r && r.error; return !!e && (r.status === 401 || e.code === 'PGRST301' || /JWT expired|invalid JWT|JWSError/i.test(e.message || '')); }
  function netErr(r){ var e = r && r.error; return navigator.onLine === false || !!(e && /failed to fetch|networkerror|network|load failed|fetch/i.test(e.message || '')); }
  function missingFn(r){ var e = r && r.error; return !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|function .* does not exist/i.test(e.message || '')); }
  RB.call = async function(fn){
    var r = await run(fn);
    if (!authErr(r)) return r;
    if (!refreshing) {
      refreshing = sb.auth.refreshSession().then(function(x){ return !!(x && !x.error && x.data && x.data.session); }, function(){ return false; });
      refreshing.then(function(ok){ if (ok) setTimeout(function(){ refreshing = null; }, 60000); });
    }
    if (await refreshing) { r = await run(fn); if (!authErr(r)) return r; }
    expire();
    return r;
  };
  function expire(){
    if (leaving) return; leaving = true;
    try { if (profile) saveDraft(); } catch (e) {}
    dirty = false;
    var v = route.done ? view : (['setup','plan','billing','calls','account'].indexOf(startView) >= 0 ? startView : 'overview');
    location.replace('login.html?next=' + encodeURIComponent('dashboard.html#' + v) + '&notice=session');
  }

  /* ---------- buttons that need the network say so while there's no signal ---------- */
  function netState(){
    var off = navigator.onLine === false;
    $$('[data-net]').forEach(function(b){
      if (off) {
        b.setAttribute('aria-disabled', 'true'); b.classList.add('is-wait');
        if (b.classList.contains('icon-btn')) { b.title = 'Waiting for signal…'; return; }
        if (b.dataset.label == null) { b.dataset.label = b.innerHTML; b.textContent = 'Waiting for signal…'; }
      } else if (b.getAttribute('aria-disabled') === 'true') {
        b.removeAttribute('aria-disabled'); b.classList.remove('is-wait'); b.removeAttribute('title');
        if (b.dataset.label != null) { b.innerHTML = b.dataset.label; delete b.dataset.label; }
      }
    });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-net][aria-disabled="true"]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (b.id === 'saveBtn') { saveDraft(); $('saveState').textContent = 'Kept on this phone'; RB.toast(OFFLINE_SAVE, 'warn'); }
    else RB.toast('Waiting for signal. Try again when you\'re back online.', 'warn');
  }, true);
  window.addEventListener('online', function(){ netState(); if (Date.now() - lastLoad > 90e3 && profile) fresh(); });
  window.addEventListener('offline', netState);

  /* ---------- load ---------- */
  function fetchCalls(from){ return RB.call(function(){ return sb.from('calls').select('*').eq('user_id', UID).order('occurred_at', { ascending: false }).range(from, from + PAGE - 1); }); }
  function fetchInvoices(){ return RB.call(function(){ return sb.from('invoices').select('*').eq('user_id', UID).order('issued_at', { ascending: false }).limit(200); }); }

  async function load(){
    var p = await RB.call(function(){ return sb.from('profiles').select('*').eq('id', UID).maybeSingle(); });
    if (p.error) return { ok: false, net: netErr(p) };
    if (!p.data) {
      p = await RB.call(function(){ return sb.rpc('ensure_profile'); });
      if (Array.isArray(p.data)) p.data = p.data[0];
      if (p.error || !p.data || !p.data.id) return { ok: false, net: netErr(p) };
    }
    profile = p.data; profile.setup = profile.setup || {};
    var pending = null; try { pending = sessionStorage.getItem('rb_plan'); sessionStorage.removeItem('rb_plan'); } catch (e) {}
    if (pending && PLANS[pending] && !profile.plan) { var u = await RB.call(function(){ return sb.from('profiles').update({ plan: pending }).eq('id', UID); }); if (!u.error) profile.plan = pending; }
    var r = await Promise.all([fetchCalls(0), fetchInvoices(), RB.call(function(){ return sb.from('billing_settings').select('*').eq('id', 1).maybeSingle(); })]);
    if (leaving) return { ok: false };
    calls = r[0].data || []; invoices = r[1].data || []; billing = r[2].data || {};
    morePossible = calls.length === PAGE;
    followup = calls.length > 0 && Object.prototype.hasOwnProperty.call(calls[0], 'handled_at');
    if (r[0].error || r[1].error) RB.toast(netErr(r[0]) || netErr(r[1]) ? 'Some of your account didn\'t load. Check your signal and tap Refresh.' : 'Some of your account didn\'t load. Tap Refresh to try again.', 'warn');
    RB.call(function(){ return sb.rpc('is_admin'); }).then(function(x){ isAdmin = x.data === true; $('adminLink').hidden = !isAdmin; $('adminCard').hidden = !isAdmin; });
    RB.call(function(){ return sb.rpc('founding_spots'); }).then(function(x){
      var d = x && !x.error && x.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      if (d && isFinite(d.total) && isFinite(d.taken) && d.total > 0) { founding = { total: +d.total, left: Math.max(0, d.total - d.taken) }; if (profile) renderPlan(); }
    });
    lastLoad = Date.now();
    return { ok: true };
  }

  function showLoadError(res){
    hideLoading(); var e = $('loadErr'); e.hidden = false;
    e.innerHTML = res.net
      ? 'No signal, so we couldn\'t load your account. We\'ll try again when you\'re back online. <button type="button" class="linkbtn" id="retryLoad">Try again now</button>'
      : 'We couldn\'t load your account just now. That\'s on our side, not your phone. <button type="button" class="linkbtn" id="retryLoad">Try again</button> or <a class="linkbtn" target="_blank" rel="noopener" href="' + RB.wa('Hi Ringback, my portal won\'t load.') + '">WhatsApp us</a>.';
    $('retryLoad').onclick = function(){ location.reload(); };
    if (res.net) window.addEventListener('online', function(){ location.reload(); }, { once: true });
  }

  /* ---------- helpers ---------- */
  function setupValues(){ var s = Object.assign({}, profile.setup); s.business_name = profile.business_name; s.trade = profile.trade; s.phone = profile.phone; return s; }
  function filled(v){ return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }
  function missingOf(s){ return REQUIRED.filter(function(k){ return !filled(s[k]); }); }
  function setupPct(){ return Math.round((REQUIRED.length - missingOf(setupValues()).length) / REQUIRED.length * 100); }
  function listLabels(keys){ var l = keys.map(function(k){ return LABELS[k].toLowerCase(); }); return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]; }
  function statusKey(){ if (profile.status === 'new' && profile.trial_requested_at) return 'req'; return profile.status; }
  function firstName(){ var n = (profile.setup.owner_name || profile.full_name || '').trim().split(' ')[0]; return n || 'there'; }
  function asDate(d){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(d); }
  function fmtDate(d){ try { return asDate(d).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }); } catch (e) { return d; } }
  function hm(d){ var x = new Date(d); return ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2); }
  var WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function dShort(d){ var x = asDate(d); return WD[x.getDay()] + ' ' + x.getDate() + ' ' + MO[x.getMonth()] + (x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : ''); }
  function ymdOf(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today(){ return ymdOf(new Date()); }
  function dayLabel(d){ var k = ymdOf(new Date(d)), y = new Date(); y.setDate(y.getDate() - 1); return k === today() ? 'Today' : k === ymdOf(y) ? 'Yesterday' : dShort(d); }
  function invState(i){ return i.status === 'due' && i.due_date < today() ? 'overdue' : i.status; }
  function invTotal(i){ return (i.amount_cents || 0) + (i.vat_cents || 0); }
  function isOpen(i){ return i.status === 'due' || i.status === 'pending'; }
  function tms(c){ return new Date(c.occurred_at).getTime() || 0; }
  /* South African numbers: 0XX… becomes 27XX…; WhatsApp only for cellphones (06, 07, 08) */
  function waNum(p){ var n = String(p || '').replace(/\D/g, ''); if (n.indexOf('0') === 0) n = '27' + n.slice(1); return n; }
  function waCell(p){ var n = waNum(p); return /^27[678]\d{8}$/.test(n) ? n : null; }
  function telHref(p){ var n = String(p || '').replace(/[^\d+]/g, ''); return n.length >= 6 ? 'tel:' + n : null; }
  function normR(v){ v = String(v || '').trim().replace(/^R\s*/i, ''); return v ? 'R' + v : ''; }
  function stripR(v){ return String(v || '').trim().replace(/^R\s*/i, ''); }
  function outOf(c){ return OUT[c.call_type] ? c.call_type : 'other'; }
  function todoCall(c){ return followup && !c.handled_at && (c.call_type === 'emergency' || c.call_type === 'callback'); }

  /* ---------- badges: due invoices and calls since this device last opened Calls ---------- */
  var seenAt = (lsGet(SEENKEY) || {}).at, dotsSince = null;
  if (!seenAt) { seenAt = Date.now(); lsSet(SEENKEY, { at: seenAt }); }
  function newCalls(){ return calls.filter(function(c){ return tms(c) > seenAt; }).length; }
  function badges(){
    var nDue = invoices.filter(function(i){ return i.status === 'due'; }).length, nNew = view === 'calls' ? 0 : newCalls();
    $$('[data-badge]').forEach(function(b){
      var n = b.dataset.badge === 'billing' ? nDue : nNew;
      b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
      var a = b.closest('a'); if (a && b.classList.contains('tab-badge')) a.setAttribute('aria-label', a.textContent.replace(/\d+\+?$/, '') + (n ? ', ' + n + (b.dataset.badge === 'billing' ? ' due' : ' new') : ''));
    });
  }

  /* ---------- overview ---------- */
  function renderOverview(){
    var h = new Date().getHours();
    $('greet').textContent = (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ', ' + firstName();
    $('greetKicker').textContent = profile.business_name || 'Overview';
    var st = STATUS[statusKey()] || STATUS.new;
    [$('statusPill'), $('abStatus')].forEach(function(pill){ pill.className = 'status ' + st[0]; pill.lastChild.textContent = st[1]; });
    $('abName').textContent = profile.business_name || 'Ringback';
    var pct = setupPct(), miss = missingOf(setupValues()), s = profile.status;
    var steps = [
      { t:'Create your account', d:'Done. Welcome to Ringback.', done:true },
      { t:'Fill in your business details', d:pct === 100 ? 'Complete' : pct + '% complete · still needed: ' + listLabels(miss), done:pct === 100, href:'#setup', btn:'Finish setup' },
      { t:'Choose a plan', d:profile.plan && PLANS[profile.plan] ? PLANS[profile.plan].name : 'Founding partner, Starter or Pro', done:!!profile.plan, href:'#plan', btn:'Choose a plan' },
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
    var pl = profile.plan && PLANS[profile.plan];
    $('planName').textContent = pl ? pl.name : 'Not chosen yet';
    $('planNote').textContent = pl ? RB.money(pl.monthly).replace('.00', '') + pl.per + ' · ' + pl.setupText : 'Pick the plan that fits. You start with a free trial week either way.';
    var since = Date.now() - 30 * 864e5;
    $('callCount').textContent = calls.filter(function(c){ return tms(c) > since; }).length;
    $('callNote').textContent = calls.length ? 'Every call Ringback took, with what the caller needed.' : 'Calls appear here once Ringback is live on your number.';
    var todo = calls.filter(todoCall).length;
    $('todoNote').hidden = !followup || !todo; $('todoNote').textContent = todo + ' still to call back';
    $('helpWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I need a hand with my account.');
    var openInv = invoices.filter(isOpen), due = openInv.filter(function(i){ return i.status === 'due'; });
    $('dueTotal').textContent = RB.money(openInv.reduce(function(a, i){ return a + invTotal(i); }, 0));
    var overdue = due.filter(function(i){ return invState(i) === 'overdue'; });
    $('dueNote').textContent = overdue.length ? overdue.length + ' overdue invoice' + (overdue.length > 1 ? 's' : '') + '. Please pay as soon as you can.' :
      due.length ? 'Due by ' + fmtDate(due.map(function(i){ return i.due_date; }).sort()[0]) + '.' :
      openInv.length ? 'We\'re confirming your payment.' : 'Nothing to pay right now.';
    renderInstall();
  }

  /* ---------- install card: never in the installed app; dismissible ---------- */
  var bip = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); bip = e; if (profile) renderInstall(); });
  window.addEventListener('appinstalled', function(){ lsSet('rb_install_dismissed', 1); bip = null; renderInstall(); });
  function renderInstall(){
    var el = $('installCard'), ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var phone = MQ.matches || window.matchMedia('(pointer:coarse)').matches;
    if (STANDALONE || lsGet('rb_install_dismissed') || !(bip || phone)) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="card install"><div class="stack-s"><span class="kicker">On your phone</span><h3 class="h-sm">Add Ringback to your home screen</h3>' +
      (bip ? '<p>It opens like an app, straight to your calls.</p><div><button type="button" class="btn btn-line btn-sm" id="installBtn">' + RB.icon('i-download') + 'Add to home screen</button></div>'
        : ios ? '<ol class="install-steps"><li>Tap <b>Share</b> in Safari\'s toolbar.</li><li>Then tap <b>Add to Home Screen</b>.</li></ol>'
        : '<p>Use your browser menu, then <b>Install app</b> or <b>Add to Home screen</b>.</p>') +
      '</div><button type="button" class="icon-btn install-x" id="installX" aria-label="Dismiss">' + RB.icon('i-close') + '</button></div>';
    $('installX').onclick = function(){ lsSet('rb_install_dismissed', 1); renderInstall(); };
    if ($('installBtn')) $('installBtn').onclick = async function(){ var e = bip; bip = null; e.prompt(); try { var ch = await e.userChoice; if (ch && ch.outcome === 'accepted') lsSet('rb_install_dismissed', 1); } catch (x) {} renderInstall(); };
  }

  /* ================= setup form ================= */
  var form = $('setupForm'), E = form.elements;
  var STEP_N = 6, wiz = { on: false, step: 1 };
  var STEP_EL = $$('[data-step]', form);

  /* suburb chips: stored as the same comma-separated text as before */
  var SUBURBS = ['Alberton','Benoni','Boksburg','Bryanston','Centurion','Craighall','Edenvale','Fourways','Germiston','Greenside','Halfway House','Hatfield','Houghton','Kempton Park','Krugersdorp','Linden','Lonehill','Melville','Menlyn','Midrand','Montana','Morningside','Northcliff','Parkhurst','Parktown','Pretoria East','Randburg','Randpark Ridge','Rivonia','Roodepoort','Rosebank','Sandton','Soweto','Springs','Sunninghill','Waterkloof','Weltevreden Park','Witkoppen','Woodmead','Waverley'];
  $('suburbList').innerHTML = SUBURBS.map(function(s){ return '<option value="' + s + '">'; }).join('');
  function splitList(v){ return String(v || '').split(/[,;\n]/).map(function(s){ return s.trim(); }).filter(Boolean); }
  var chips = {};
  $$('.chipin', form).forEach(function(w){
    var name = w.dataset.chips, hidden = E.namedItem(name), list = w.querySelector('.chipin-list'), inp = w.querySelector('.chipin-in'), items = [];
    function sync(fire){ var all = items.slice(), t = inp.value.trim(); if (t) all.push(t); hidden.value = all.join(', ').slice(0, 1000); if (fire) form.dispatchEvent(new Event('input')); }
    function render(){
      list.innerHTML = items.map(function(x, i){ return '<li class="chip"><span>' + RB.esc(x) + '</span><button type="button" class="chip-x" data-i="' + i + '" aria-label="Remove ' + RB.esc(x) + '">' + RB.icon('i-close') + '</button></li>'; }).join('');
      list.hidden = !items.length;
    }
    function add(){
      splitList(inp.value).forEach(function(p){ p = p.slice(0, 60); if (!items.some(function(x){ return x.toLowerCase() === p.toLowerCase(); })) items.push(p); });
      inp.value = ''; render(); sync(true);
    }
    inp.addEventListener('keydown', function(e){ if (e.key !== 'Enter') return; e.preventDefault(); e.stopPropagation(); if (inp.value.trim()) add(); else nextField(inp); });
    inp.addEventListener('input', function(e){ if (/[,;]/.test(inp.value) || e.inputType === 'insertReplacementText' || (!e.inputType && inp.value)) add(); else sync(false); });
    inp.addEventListener('blur', function(){ if (inp.value.trim()) add(); });
    w.querySelector('.chipin-add').addEventListener('click', function(){ if (inp.value.trim()) add(); inp.focus(); });
    list.addEventListener('click', function(e){
      var b = e.target.closest('.chip-x'); if (!b) return;
      var i = +b.dataset.i; items.splice(i, 1); render(); sync(true);
      var nx = list.querySelectorAll('.chip-x')[Math.min(i, items.length - 1)]; (nx || inp).focus();
    });
    chips[name] = { set: function(v){ items = splitList(v); inp.value = ''; render(); sync(false); }, input: inp };
  });
  function fieldEl(k){ return chips[k] ? chips[k].input : E.namedItem(k); }

  /* raw form state (what's on screen) and the merged update we save */
  function formValues(){
    var out = {};
    FIELDS.forEach(function(k){
      if (k === 'languages') { out.languages = $$('[name=languages]', form).filter(function(c){ return c.checked; }).map(function(c){ return c.value; }); return; }
      if (k === 'after_hours') { var r = form.querySelector('[name=after_hours]:checked'); out.after_hours = r ? r.value : null; return; }
      var el = E.namedItem(k); if (!el) return;
      out[k] = el.hasAttribute('data-rand') ? normR(el.value) : el.value.trim();
    });
    return { business_name: E.namedItem('business_name').value.trim(), trade: E.namedItem('trade').value, phone: E.namedItem('phone').value.trim(), setup: out };
  }
  /* Merge: keys the form doesn't show (ringback_number, referred_by, preferred_start…) survive every save. */
  function readSetup(){ var v = formValues(); v.setup = Object.assign({}, profile.setup, v.setup); return v; }
  function flat(v){ return Object.assign({}, v.setup, { business_name: v.business_name, trade: v.trade, phone: v.phone }); }
  function flatForm(){ return flat(formValues()); }

  function fillFrom(s){
    ['business_name','phone'].concat(FIELDS).forEach(function(k){
      if (k === 'languages') { $$('[name=languages]', form).forEach(function(cb){ cb.checked = (s.languages || ['English']).indexOf(cb.value) >= 0; }); return; }
      if (k === 'after_hours') { $$('[name=after_hours]', form).forEach(function(r){ r.checked = r.value === s.after_hours; }); return; }
      if (chips[k]) { chips[k].set(s[k] || ''); return; }
      var el = E.namedItem(k); if (!el) return;
      if (s[k] != null) el.value = el.hasAttribute('data-rand') ? stripR(s[k]) : s[k];
      else if (el.tagName !== 'SELECT') el.value = '';
    });
    if (s.trade) { var t = E.namedItem('trade'); [].forEach.call(t.options, function(o){ if (o.text === s.trade || o.value === s.trade) t.value = o.value; }); }
  }
  function fillSetup(){ fillFrom(setupValues()); tried = Object.keys(profile.setup).some(function(k){ return FIELDS.indexOf(k) >= 0; }); updateMeter(); renderReview(); }
  function formMissing(){ return missingOf(flatForm()); }
  function updateMeter(){
    var miss = formMissing(), pct = Math.round((REQUIRED.length - miss.length) / REQUIRED.length * 100);
    $('setupPct').textContent = pct + '% complete'; $('setupMeter').style.setProperty('--v', pct + '%');
    REQUIRED.forEach(function(k){ var el = fieldEl(k); if (el) { if (tried && miss.indexOf(k) >= 0) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); } });
    var box = $('missingBox');
    if (miss.length && tried && !wiz.on) {
      box.hidden = false;
      box.innerHTML = RB.icon('i-alert') + '<span><b>Still needed before we can switch you on:</b> ' + miss.map(function(k){ return '<button type="button" class="linkbtn" data-focus="' + k + '">' + RB.esc(LABELS[k]) + '</button>'; }).join(', ') + '</span>';
      $$('[data-focus]', box).forEach(function(b){ b.onclick = function(){ focusField(b.dataset.focus); }; });
    } else box.hidden = true;
    $('setupDone').hidden = !(setupPct() === 100 && !miss.length && !dirty);
  }
  function stepOf(el){ var fs = el && el.closest('[data-step]'); return fs ? +fs.dataset.step : 1; }
  function focusField(k){
    var el = fieldEl(k); if (!el) return;
    if (wiz.on && stepOf(el) !== wiz.step) goStep(stepOf(el), true);
    el.scrollIntoView({ block: 'center', behavior: RB.reduced || wiz.on ? 'auto' : 'smooth' });
    setTimeout(function(){ el.focus({ preventScroll: true }); }, RB.reduced || wiz.on ? 0 : 350);
  }
  /* Enter moves to the next field (enterkeyhint=next); the last one closes the keyboard */
  var ENTRY = 'input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea';
  function nextField(el){
    var scope = wiz.on ? STEP_EL[wiz.step - 1] : form;
    var list = $$(ENTRY, scope).filter(function(x){ return x.offsetParent !== null; }), i = list.indexOf(el);
    if (i >= 0 && list[i + 1]) list[i + 1].focus(); else el.blur();
  }
  form.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' || e.isComposing) return;
    var t = e.target; if (t.tagName !== 'INPUT' || t.classList.contains('chipin-in') || /^(checkbox|radio|submit|button)$/.test(t.type)) return;
    e.preventDefault(); nextField(t);
  });

  /* ---------- autosave a draft on this phone (Android may discard the tab; beforeunload never fires) ---------- */
  var draftT = null;
  function saveDraft(){ if (!profile) return; lsSet(DKEY, { savedAt: new Date().toISOString(), values: formValues(), step: wiz.step }); }
  function clearSetupDraft(){ clearTimeout(draftT); lsDel(DKEY); $('draftBanner').hidden = true; }
  var reviewT = null;
  form.addEventListener('input', function(){
    dirty = true; $('saveState').textContent = 'Unsaved changes'; updateMeter();
    clearTimeout(draftT); draftT = setTimeout(saveDraft, 500);
    clearTimeout(reviewT); reviewT = setTimeout(renderReview, 250);
  });
  $$('[data-fill]', form).forEach(function(b){
    b.addEventListener('click', function(){ var el = E.namedItem(b.dataset.fill); el.value = b.dataset.val; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); });
  });
  window.addEventListener('beforeunload', function(e){ if (dirty) { saveDraft(); e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', function(){ if (document.hidden && dirty) saveDraft(); });

  function same(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function checkDraft(){
    var d = lsGet(DKEY);
    if (!d || !d.values || !d.values.setup) return false;
    if (same(d.values, formValues())) { lsDel(DKEY); return false; }
    var at = new Date(d.savedAt), when = isNaN(at) ? '' : hm(at) + (ymdOf(at) === today() ? '' : ' on ' + dShort(at));
    $('draftText').textContent = 'You have unsaved changes' + (when ? ' from ' + when : '') + ' on this phone.';
    $('draftBanner').hidden = false;
    $('draftRestore').onclick = function(){
      fillFrom(flat(d.values)); dirty = true; $('saveState').textContent = 'Unsaved changes';
      $('draftBanner').hidden = true; updateMeter(); renderReview();
      if (view !== 'setup') location.hash = '#setup';
      if (wiz.on && d.step > 1) setTimeout(function(){ goStep(d.step); }, 0);
      RB.toast('Restored. Check it and tap Save.', 'ok');
    };
    $('draftDiscard').onclick = function(){ clearSetupDraft(); RB.toast('Discarded', 'ok'); };
    return true;
  }

  /* ---------- imports: the assistant-preview draft, and what was chosen at sign-up ---------- */
  var imported = false;
  function importBuilder(){
    var d = RB.getDraft && RB.getDraft(); if (!d || !d.fields) return;
    var keys = Object.keys(d.fields).filter(function(k){ return filled(d.fields[k]); });
    if (!keys.length || keys.some(function(k){ return filled(profile.setup[k]); })) return;
    var cur = flatForm(), add = {};
    keys.forEach(function(k){ if (k === 'trade' ? !profile.trade : !filled(cur[k]) || ['after_hours','callback_promise','booking'].indexOf(k) >= 0) add[k] = d.fields[k]; });
    if (!Object.keys(add).length) return;
    fillFrom(Object.assign({}, cur, add));
    imported = true; dirty = true; $('importBox').hidden = false; $('saveState').textContent = 'Unsaved changes';
    updateMeter(); renderReview();
  }
  async function importMeta(){
    var m = user.user_metadata || {}, add = {};
    if (m.preferred_start && !profile.setup.preferred_start) add.preferred_start = String(m.preferred_start).slice(0, 10);
    if (m.referred_by && !profile.setup.referred_by && /^[0-9a-f]{8}$/.test(m.referred_by)) add.referred_by = m.referred_by;
    if (!Object.keys(add).length) return;
    var setup = Object.assign({}, profile.setup, add);
    var r = await RB.call(function(){ return sb.from('profiles').update({ setup: setup }).eq('id', UID); });
    if (!r.error) { profile.setup = setup; renderPlan(); }
  }

  /* ---------- save (full form, or one wizard step) ---------- */
  async function saveSetup(o){
    o = o || {};
    var v = readSetup();
    if (!o.partial) {
      tried = true;
      if (!v.business_name) { updateMeter(); focusField('business_name'); RB.toast('Please add your business name.', 'err'); return false; }
    }
    if (navigator.onLine === false) { saveDraft(); $('saveState').textContent = 'Kept on this phone'; RB.toast(OFFLINE_SAVE, 'warn'); return false; }
    var b = o.btn || $('saveBtn'); b.classList.add('loading');
    var r = await RB.call(function(){ return sb.from('profiles').update(v).eq('id', UID).select().maybeSingle(); });
    b.classList.remove('loading');
    if (r.error || !r.data) {
      saveDraft(); $('saveState').textContent = 'Not saved';
      if (!leaving) RB.toast(netErr(r) ? OFFLINE_SAVE : 'Couldn\'t save. Your changes are kept on this phone. Try again, or WhatsApp us.', 'err');
      return false;
    }
    profile = r.data; profile.setup = profile.setup || {}; dirty = false; clearSetupDraft();
    if (imported) { RB.clearDraft && RB.clearDraft(); imported = false; $('importBox').hidden = true; }
    $('saveState').textContent = 'Saved ' + hm(new Date());
    renderOverview(); renderPlan(); renderGoLive(); updateMeter();
    if (o.partial) return true;
    var miss = missingOf(setupValues());
    if (miss.length) { RB.toast('Saved. Still needed: ' + listLabels(miss) + '.', 'warn'); focusField(miss[0]); }
    else { RB.toast('Setup complete. Next, choose a plan.', 'ok'); if (!wiz.on) $('setupDone').scrollIntoView({ block: 'center', behavior: RB.reduced ? 'auto' : 'smooth' }); }
    return true;
  }
  form.addEventListener('submit', function(e){ e.preventDefault(); saveSetup(); });

  /* ---------- steps on phones (900px and below): five fieldsets plus Review ---------- */
  $('wizDots').innerHTML = STEP_EL.map(function(){ return '<li></li>'; }).join('');
  function stepTitle(n){ var fs = STEP_EL[n - 1], lg = fs.querySelector('legend'); return lg ? lg.textContent : 'Review'; }
  function wizApply(){
    wiz.on = MQ.matches;
    form.classList.toggle('is-wiz', wiz.on);
    $('wizHead').hidden = $('wizFoot').hidden = !wiz.on;
    $('saveBar').hidden = wiz.on;
    STEP_EL.forEach(function(fs, i){ fs.classList.toggle('is-step', i + 1 === wiz.step); });
    $('wizStep').textContent = 'Step ' + wiz.step + ' of ' + STEP_N;
    $$('li', $('wizDots')).forEach(function(li, i){ li.className = i + 1 < wiz.step ? 'done' : i + 1 === wiz.step ? 'on' : ''; });
    $('wizTitle').textContent = wiz.step === STEP_N ? 'Review' : stepTitle(wiz.step);
    $('wizBack').hidden = wiz.step === 1;
    $('wizNext').textContent = wiz.step === STEP_N ? 'Save details' : 'Next';
    $('wizNext').toggleAttribute('data-net', wiz.step === STEP_N);
    updateMeter(); netState();
  }
  function goStep(n, quiet){
    wiz.step = Math.max(1, Math.min(STEP_N, n)); wizApply();
    if (wiz.step === STEP_N) renderReview();
    var top = $('wizHead').getBoundingClientRect().top + window.scrollY - (MQ.matches ? 72 : 110);
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    if (!quiet) try { $('wizTitle').focus({ preventScroll: true }); } catch (e) { $('wizTitle').focus(); }
  }
  $('wizBack').addEventListener('click', function(){ goStep(wiz.step - 1); });
  $('wizNext').addEventListener('click', async function(){
    var fs = STEP_EL[wiz.step - 1], f = flatForm();
    var miss = REQUIRED.filter(function(k){ return fs.contains(fieldEl(k)) && !filled(f[k]); });
    if (miss.length) { tried = true; updateMeter(); focusField(miss[0]); RB.toast('Please add: ' + listLabels(miss) + '.', 'err'); return; }
    if (wiz.step === STEP_N) { await saveSetup({ btn: $('wizNext') }); return; }
    if (dirty) await saveSetup({ partial: true, btn: $('wizNext') });
    goStep(wiz.step + 1);
  });
  MQ.addEventListener('change', function(){ wizApply(); renderCalls(); });

  /* hide the sticky footer, save bar and tab bar while typing, so they never cover the field */
  document.addEventListener('focusin', function(e){ if (e.target.matches && e.target.matches(ENTRY) && !e.target.closest('.rb-layer,.sheet')) body.classList.add('is-typing'); });
  document.addEventListener('focusout', function(){ setTimeout(function(){ var a = document.activeElement; if (!(a && a.matches && a.matches(ENTRY))) body.classList.remove('is-typing'); }, 60); });

  /* ---------- review: how the assistant will answer, from these answers ---------- */
  function renderReview(){
    var f = flatForm(), none = '<span class="faint">Not filled in yet</span>', esc = RB.esc;
    var biz = f.business_name ? esc(f.business_name) : 'your business';
    var promise = { '10':'10 minutes', '15':'15 minutes', '20':'20 minutes', '30':'30 minutes', '60':'an hour' }[f.callback_promise] || '15 minutes';
    var rows = [
      ['Greeting', '“Good day, you\'ve reached ' + biz + '. Just so you know, this call is recorded. How can I help?”'],
      ['Emergencies', (f.emergencies ? 'Flags these as urgent: ' + esc(f.emergencies) + '.' : 'Tell it what counts as an emergency, so it knows what to flag.') + ' Tells the caller ' + (f.owner_name ? esc(f.owner_name) : 'you') + ' will call back within ' + promise + '.'],
      ['Call-out fees', f.callout_weekday ? esc(f.callout_weekday) + ' on weekdays' + (f.callout_after ? ', ' + esc(f.callout_after) + ' after hours and on weekends' : '') + '.' : none],
      ['Areas', f.service_areas ? 'Covers ' + esc(f.service_areas) + '.' + (f.excluded_areas ? ' Politely declines ' + esc(f.excluded_areas) + '.' : '') : none],
      ['Hours', (f.hours ? esc(f.hours) + '.' : none) + (f.after_hours === 'yes' ? ' After hours it still takes emergencies and alerts you.' : f.after_hours === 'no' ? ' After hours it takes a message for the next working day.' : '')],
      ['Bookings', f.booking === 'callback' ? 'Takes a callback request for routine jobs.' : 'Books routine jobs into your Google Calendar' + (f.calendar_email ? ' (' + esc(f.calendar_email) + ')' : '') + '.'],
      ['Languages', (f.languages && f.languages.length ? f.languages : ['English']).map(esc).join(', ')]
    ];
    $('reviewList').innerHTML = rows.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
  }

  /* ================= go live: forwarding, check, and a real test call ================= */
  var test = { state: 'idle' }, glN = 0;
  function rbNumber(){ var n = profile.setup && profile.setup.ringback_number; return n && String(n).trim() ? String(n).trim() : ''; }
  function goLiveOn(){ return !!rbNumber() && ['setting_up','trial','live'].indexOf(profile.status) >= 0; }
  var UA = navigator.userAgent, ANDROID = /Android/i.test(UA), IOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function dialHref(code){ return 'tel:' + code.replace(/\*/g, '%2A').replace(/#/g, '%23'); }
  var CHECKS = [['*#61#','No answer'],['*#62#','Unreachable'],['*#67#','Busy']];
  function renderGoLive(){
    var on = goLiveOn(), num = rbNumber();
    $('fwdSection').hidden = on;
    ['goLiveOv','goLiveSetup'].forEach(function(id){
      var el = $(id);
      if (!on) { el.innerHTML = ''; el.hidden = true; delete el.dataset.num; return; }
      el.hidden = false;
      var key = num + '|' + profile.status;
      if (el.dataset.num === key) return;
      el.dataset.num = key; buildGoLive(el, num, id === 'goLiveOv' && profile.status === 'live');
    });
    renderTest();
  }
  function buildGoLive(el, num, fold){
    glN++;
    el.innerHTML = '<div class="card golive"><div class="stack-s"><span class="kicker">Go live</span><h2 class="h-md">' + (fold ? 'Your forwarding and test call' : 'Switch Ringback on for your number') + '</h2>' +
      '<p>Your Ringback number is <b class="mono">' + RB.esc(num) + '</b>. ' + (fold ? 'Changed phones or networks? Check forwarding is still on, and make a test call.' : 'Three steps, about five minutes, on the phone your customers call.') + '</p></div>' +
      (fold ? '<details class="gl-fold"><summary class="btn btn-line btn-sm">Check forwarding and test</summary>' : '') +
      '<ol class="gl-steps">' +
      '<li><span class="gl-n" aria-hidden="true">1</span><div class="gl-b"><h3 class="h-sm">Switch on forwarding</h3><div class="gl-fwd"></div>' +
        (ANDROID ? '<div><a class="btn btn-line btn-sm gl-dial" href="#">' + RB.icon('i-dial') + 'Open dialler</a></div>' : '<p class="gl-hint">' + (IOS ? 'Copy it, then paste it in your Phone app and tap call.' : 'Dial it on the phone whose calls you want answered.') + '</p>') + '</div></li>' +
      '<li><span class="gl-n" aria-hidden="true">2</span><div class="gl-b"><h3 class="h-sm">Check it\'s on</h3><p>Dial each of these. Your phone shows whether forwarding is on, and to which number.</p><ul class="gl-codes">' +
        CHECKS.map(function(c){ return '<li><code>' + c[0] + '</code><span>' + c[1] + '</span>' + (ANDROID ? '<a class="icon-btn" href="' + dialHref(c[0]) + '" aria-label="Dial ' + c[0] + '">' + RB.icon('i-phone') + '</a>' : '') + '<button type="button" class="icon-btn" data-copy="' + c[0] + '" aria-label="Copy ' + c[0] + '">' + RB.icon('i-copy') + '</button></li>'; }).join('') +
        '</ul><p class="gl-note"></p></div></li>' +
      '<li><span class="gl-n" aria-hidden="true">3</span><div class="gl-b"><h3 class="h-sm">Make a test call</h3><p>Ask someone to phone your cellphone and let it ring out. Don\'t answer it.</p><div class="gl-test"></div></div></li>' +
      '</ol>' + (fold ? '</details>' : '') + '</div>';
    var fw = el.querySelector('.gl-fwd');
    RB.forwardGuide(fw, { number: num, lock: true });
    function sync(){
      var code = fw.querySelector('.fwd-on').textContent, dial = el.querySelector('.gl-dial');
      if (dial) dial.href = dialHref(code);
      var nk = (fw.querySelector('input[type=radio][value]:checked') || {}).value, net = RB.FORWARD.networks.filter(function(x){ return x.key === nk; })[0] || RB.FORWARD.networks[0];
      el.querySelector('.gl-note').innerHTML = net.verified ? 'Checked with ' + RB.esc(net.name) + ' on ' + RB.esc(net.verified) + '.' : '<b>Standard codes, not yet confirmed for ' + RB.esc(net.name) + '.</b> Most networks use them; if one doesn\'t work, <a href="' + RB.wa('Hi Ringback, can you help me check call forwarding on ' + net.name + '?') + '" target="_blank" rel="noopener">WhatsApp us</a>.';
      el.dataset.glNet = net.name; el.dataset.glCode = code;
    }
    fw.addEventListener('change', sync); fw.addEventListener('input', sync); sync();
    $$('[data-copy]', el).forEach(function(b){ b.onclick = function(){ RB.copy(b.dataset.copy, b); }; });
    el.querySelector('.gl-test').addEventListener('click', function(e){
      if (e.target.closest('[data-test-start]')) startTest(el);
      if (e.target.closest('[data-test-again]')) { test = { state: 'idle' }; renderTest(); }
    });
  }
  function mmss(ms){ var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function renderTest(){
    $$('.gl-test').forEach(function(box){
      var gl = box.closest('#goLiveOv,#goLiveSetup');
      var h = '';
      if (test.state === 'idle') h = '<button type="button" class="btn btn-hot btn-sm" data-test-start data-net>I\'m making a test call now</button>';
      else if (test.state === 'wait') h = '<p class="gl-wait"><span class="gl-dot" aria-hidden="true"></span><span class="gl-tick" aria-hidden="true">Waiting for the call… ' + mmss(test.active) + '</span><span class="sr-only" role="status" aria-live="polite">' + test.said + '</span></p><p class="faint gl-small">We check every 10 seconds, for up to ' + test.limitMin + ' minutes while this page is open.</p>';
      else if (test.state === 'ok') h = '<p class="alert ok" role="status">Test call received at ' + hm(test.call.occurred_at) + '. Ringback is answering your missed calls.</p>';
      else if (test.state === 'timeout') {
        var net = gl && gl.dataset.glNet || '', code = gl && gl.dataset.glCode || '';
        h = '<div class="alert warn" role="status"><b>No test call has come through yet.</b><ul class="gl-check"><li>Is forwarding on? Dial *#61# to check.</li><li>Did it ring out? Forwarding only starts after the ring time you chose.</li><li>Some contracts and prepaid packages block forwarding. Your network can tell you.</li></ul></div>' +
          '<div class="ctas mt-s"><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + RB.wa('Hi Ringback, my test call didn\'t come through. Network: ' + net + '. Code I dialled: ' + code + '.') + '">' + RB.icon('i-wa') + 'WhatsApp us</a><button type="button" class="btn btn-ghost btn-sm" data-test-again>Try again</button></div>';
      }
      box.innerHTML = h;
    });
    netState();
  }
  function stopTest(){ clearInterval(test.timer); clearInterval(test.poller); test.timer = test.poller = null; }
  function startTest(){
    stopTest();
    var limitMin = +C.testCallWaitMinutes > 0 ? +C.testCallWaitMinutes : 5;
    test = { state: 'wait', since: Date.now(), active: 0, last: Date.now(), limitMin: limitMin, limit: limitMin * 60000, said: 'Waiting for the call…', known: {} };
    calls.forEach(function(c){ test.known[String(c.id)] = 1; });
    test.timer = setInterval(function(){
      var now = Date.now(); if (!document.hidden) test.active += now - test.last; test.last = now;
      if (test.active >= test.limit) { stopTest(); test.state = 'timeout'; renderTest(); return; }
      $$('.gl-tick').forEach(function(t){ t.textContent = 'Waiting for the call… ' + mmss(test.active); });
    }, 1000);
    test.poller = setInterval(pollTest, 10000);
    renderTest();
  }
  async function pollTest(){
    if (document.hidden || test.state !== 'wait' || test.busy) return;
    test.busy = true;
    var from = new Date(test.since - 120000).toISOString();
    var r = await RB.call(function(){ return sb.from('calls').select('*').eq('user_id', UID).gte('occurred_at', from).order('occurred_at', { ascending: false }).limit(10); });
    test.busy = false;
    if (test.state !== 'wait') return;
    test.said = 'Waiting for the call… ' + mmss(test.active);
    $$('.gl-test .sr-only').forEach(function(s){ s.textContent = test.said; });
    var hit = (r.data || []).filter(function(c){ return !test.known[String(c.id)]; })[0];
    if (!hit) return;
    stopTest(); test.state = 'ok'; test.call = hit;
    mergeCalls([hit]); renderAllData(); renderTest(); openCall(hit.id);
  }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && test.state === 'wait') { test.last = Date.now(); pollTest(); } });

  /* ================= plan + trial ================= */
  function renderPlan(){
    $('planCards').innerHTML = Object.keys(PLANS).map(function(k){
      var p = PLANS[k], sel = profile.plan === k, left = k === 'founding' && founding ? (founding.left ? founding.left + ' of ' + founding.total + ' places left' : 'All places taken') : '';
      return '<div class="plan' + (sel ? ' sel' : '') + (k === 'founding' ? ' star' : '') + '">' + (left ? '<span class="ribbon">' + left + '</span>' : '') +
        '<div><h3>' + RB.esc(p.name) + '</h3></div><div class="price"><b class="num">' + RB.money(p.monthly).replace('.00', '') + '</b><span>' + RB.esc(p.per) + '</span></div><p class="setup">' + RB.esc(p.setupText) + '</p>' +
        '<ul>' + p.feats.map(function(f){ return '<li>' + RB.icon('i-check') + RB.esc(f) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn ' + (sel ? 'btn-line' : 'btn-hot') + '" data-plan="' + k + '"' + (sel ? ' disabled' : ' data-net') + '>' + (sel ? 'Your plan' : 'Choose ' + RB.esc(p.name)) + '</button></div>';
    }).join('');
    $$('[data-plan]', $('planCards')).forEach(function(btn){
      btn.addEventListener('click', async function(){
        btn.classList.add('loading');
        var r = await RB.call(function(){ return sb.from('profiles').update({ plan: btn.dataset.plan }).eq('id', UID).select().maybeSingle(); });
        if (r.error || !r.data) { btn.classList.remove('loading'); return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t change plan. Please try again.', 'err'); }
        profile = r.data; profile.setup = profile.setup || {}; RB.toast('Plan updated to ' + PLANS[profile.plan].name, 'ok'); renderPlan(); renderOverview(); renderBilling();
      });
    });
    var tb = $('trialBtn'), pct = setupPct(), miss = missingOf(setupValues());
    $('trialWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I\'d like to set up my free trial week.');
    $('trialFix').hidden = true;
    var ps = profile.setup.preferred_start, sd = ps && asDate(ps);
    $('startNote').hidden = !(sd && !isNaN(sd)); if (sd && !isNaN(sd)) $('startNote').textContent = 'You asked to start on ' + dShort(ps) + '.';
    if (profile.trial_requested_at) {
      $('trialTitle').textContent = 'Trial requested ' + fmtDate(profile.trial_requested_at);
      $('trialText').textContent = ['trial','live'].indexOf(profile.status) >= 0 ? 'Your assistant is set up. Thanks for trying Ringback.' : 'We\'ll WhatsApp you within one working day to set up call forwarding. Want to speed things up? Message us now.';
      tb.hidden = true;
    } else {
      tb.hidden = false; $('trialTitle').textContent = 'Ready when you are';
      if (pct < 100) { tb.disabled = true; $('trialFix').hidden = false; $('trialText').textContent = 'Your business details are ' + pct + '% done. Still needed: ' + listLabels(miss) + '. Then request your trial here.'; }
      else if (!profile.plan) { tb.disabled = false; $('trialText').textContent = 'All set. Pick a plan above (you can change it later), then request your trial and we\'ll WhatsApp you to set up call forwarding.'; }
      else { tb.disabled = false; $('trialText').textContent = 'All set. Request your trial and we\'ll WhatsApp you to set up call forwarding.'; }
    }
    netState();
  }
  $('trialBtn').addEventListener('click', async function(){
    var b = $('trialBtn'); b.classList.add('loading');
    var r = await RB.call(function(){ return sb.from('profiles').update({ trial_requested_at: new Date().toISOString() }).eq('id', UID).select().maybeSingle(); });
    b.classList.remove('loading');
    if (r.error || !r.data) return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t send your request. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; RB.toast('Trial requested. We\'ll be in touch.', 'ok'); renderPlan(); renderOverview(); renderBilling();
  });

  /* ================= billing ================= */
  function renderBilling(){
    var openInv = invoices.filter(isOpen), pending = invoices.filter(function(i){ return i.status === 'pending'; });
    var paid = invoices.filter(function(i){ return i.status === 'paid'; });
    var due = invoices.filter(function(i){ return i.status === 'due'; }).map(function(i){ return i.due_date; }).sort();
    $('billKpis').innerHTML = [['Outstanding', RB.money(openInv.reduce(function(a, i){ return a + invTotal(i); }, 0)), true], ['Next due', due.length ? fmtDate(due[0]) : '—'], ['Checking payment', pending.length], ['Paid to date', RB.money(paid.reduce(function(a, i){ return a + invTotal(i); }, 0))]]
      .map(function(k){ return '<div class="kpi' + (k[2] ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('');

    if (!invoices.length) {
      $('invoiceBox').innerHTML = '<div class="empty"><span class="ic">' + RB.icon('i-receipt') + '</span><h3>No invoices yet</h3><p class="p-measure">' +
        (['trial','live','paused'].indexOf(profile.status) >= 0 ? 'Your invoices will show up here as soon as we send them.' : 'Nothing to pay yet. Your first invoice comes after your free trial week, and only if you decide to continue.') + '</p></div>';
    } else {
      $('invoiceBox').innerHTML = '<div class="inv-list">' + invoices.map(function(i){
        var st = INV[invState(i)] || INV.due, canPay = i.status === 'due';
        return '<div class="inv"><div class="inv-main"><div class="inv-top"><b class="mono">' + RB.esc(i.number) + '</b><span class="tag ' + st[0] + '">' + st[1] + '</span></div><p>' + RB.esc(i.description) + '</p>' +
          '<small class="faint">Issued ' + RB.esc(fmtDate(i.issued_at)) + (i.status === 'paid' ? ' · Paid ' + RB.esc(fmtDate(i.paid_at)) : i.status === 'pending' ? ' · You told us you paid on ' + RB.esc(fmtDate(i.client_paid_at)) : i.status === 'void' ? '' : ' · Due ' + RB.esc(fmtDate(i.due_date))) + '</small>' +
          (i.note ? '<small class="faint">Note from us: ' + RB.esc(i.note) + '</small>' : '') + '</div>' +
          '<div class="inv-amt">' + RB.money(invTotal(i)) + (i.vat_cents ? '<small class="faint">incl. VAT</small>' : '') + '</div>' +
          '<div class="inv-act"><a class="btn btn-line btn-sm" href="invoice.html?id=' + encodeURIComponent(i.id) + '">' + RB.icon('i-receipt') + 'View</a>' + (canPay ? '<button type="button" class="btn btn-hot btn-sm" data-pay="' + RB.esc(i.id) + '">I\'ve paid</button>' : '') + '</div></div>';
      }).join('') + '</div>';
      $$('[data-pay]', $('invoiceBox')).forEach(function(b){ b.onclick = function(){ payDialog(invoices.filter(function(i){ return String(i.id) === b.dataset.pay; })[0]); }; });
    }

    var bank = [['Bank', billing.bank_name], ['Account holder', billing.account_holder], ['Account number', billing.account_number], ['Branch code', billing.branch_code], ['Account type', billing.account_type]].filter(function(r){ return r[1]; });
    var ref = (invoices.filter(function(i){ return i.status === 'due'; })[0] || {}).number || 'your invoice number';
    $('bankCard').innerHTML = '<span class="kicker">Pay by EFT</span>' + (billing.account_number ?
      '<dl class="bank">' + bank.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd><span>' + RB.esc(r[1]) + '</span>' + (/number|code/i.test(r[0]) ? '<button type="button" class="icon-btn" data-copy="' + RB.esc(r[1]) + '" aria-label="Copy ' + r[0].toLowerCase() + '">' + RB.icon('i-copy') + '</button>' : '') + '</dd></div>'; }).join('') +
      '<div><dt>Reference</dt><dd><b>' + RB.esc(ref) + '</b>' + (ref !== 'your invoice number' ? '<button type="button" class="icon-btn" data-copy="' + RB.esc(ref) + '" aria-label="Copy reference">' + RB.icon('i-copy') + '</button>' : '') + '</dd></div></dl>' +
      '<p class="p-small">Always use the invoice number as your reference so we can match your payment.</p>' :
      '<h3>Banking details</h3><p>Our banking details are on each invoice, and we\'ll send them with your first one. Questions about paying? WhatsApp us.</p><div><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + RB.wa('Hi Ringback, I have a question about paying my invoice.') + '">' + RB.icon('i-wa') + 'WhatsApp us</a></div>');
    $$('[data-copy]', $('bankCard')).forEach(function(b){ b.onclick = function(){ RB.copy(b.dataset.copy, b); }; });

    var p = profile.plan && PLANS[profile.plan], vat = billing.vat_registered;
    $('costCard').innerHTML = '<span class="kicker">What you\'ll pay</span>' + (p ?
      '<h3>' + RB.esc(p.name) + '</h3><dl class="bank"><div><dt>Monthly</dt><dd>' + RB.money(p.monthly) + (profile.plan === 'founding' ? ' for 60 days' : '') + '</dd></div><div><dt>Once-off setup</dt><dd>' + (p.setup ? RB.money(p.setup) : 'Free') + '</dd></div><div><dt>Minutes included</dt><dd>' + p.minutes + ' a month</dd></div></dl>' +
      '<p class="p-small">' + (vat ? 'Plus VAT. ' : '') + 'Your free trial week comes first. We only invoice once you decide to continue. Extra minutes ' + RB.money(RB.EXTRA_MIN_CENTS || 500).replace('.00', '') + ' each.</p><a class="link" href="#plan">Change plan ' + RB.icon('i-arrow') + '</a>' :
      '<h3>No plan yet</h3><p>Choose a plan to see what you\'ll pay. Every plan starts with a free trial week.</p><a class="link" href="#plan">Choose a plan ' + RB.icon('i-arrow') + '</a>');
  }

  function payDialog(inv){
    if (!inv) return;
    var sh = RB.sheet({ label: 'Invoice ' + inv.number, size: 'sm', html:
      '<form class="form" novalidate><h2 class="h-md">Let us know you\'ve paid</h2>' +
      '<dl class="bank"><div><dt>Invoice</dt><dd class="mono">' + RB.esc(inv.number) + '</dd></div><div><dt>Amount</dt><dd><b>' + RB.money(invTotal(inv)) + '</b></dd></div><div><dt>Reference to use</dt><dd class="mono">' + RB.esc(inv.number) + '</dd></div></dl>' +
      '<label class="fld"><span>Proof of payment <small>(optional · PDF or photo, up to 5 MB)</small></span><input type="file" name="proof" accept="application/pdf,image/jpeg,image/png,image/webp"></label>' +
      '<label class="fld"><span>Anything we should know? <small>(optional)</small></span><textarea name="note" maxlength="500" placeholder="e.g. Paid from my FNB account on 12 October"></textarea></label>' +
      '<p class="form-msg" aria-live="polite"></p>' +
      '<div class="ctas mt-s"><button class="btn btn-hot" type="submit" data-net>Confirm payment sent</button></div>' +
      '<p class="faint p-small">We\'ll check our bank and mark it paid, usually within one working day. Only you and Ringback can see your proof of payment.</p></form>' });
    var f = sh.body.querySelector('form'), msg = sh.body.querySelector('.form-msg'), busy = false;
    netState();
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
        path = UID + '/' + inv.number + '-' + Date.now() + '.' + ext;
        var up = await RB.call(function(){ return sb.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false }); });
        if (up.error) { busy = false; btn.classList.remove('loading'); msg.className = 'form-msg err'; msg.textContent = netErr(up) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t upload that file. You can still confirm without it, or try again.'; f.elements.namedItem('proof').value = ''; return; }
      }
      var r = await RB.call(function(){ return sb.rpc('client_mark_paid', { p_invoice: inv.id, p_proof: path, p_note: note || null }); });
      busy = false; btn.classList.remove('loading');
      if (r.error || !r.data) { msg.className = 'form-msg err'; msg.textContent = netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t confirm that. Please try again, or WhatsApp us.'; return; }
      var updated = Array.isArray(r.data) ? r.data[0] : r.data;
      invoices = invoices.map(function(i){ return i.id === updated.id ? updated : i; });
      sh.close(); renderBilling(); renderOverview(); badges();
      RB.toast('Thanks! We\'ll confirm your payment within one working day.', 'ok');
    });
  }

  /* ================= calls ================= */
  var cf = { q: '', type: 'all', period: 'all' }, qT = null;
  function inPeriod(c){ if (cf.period === 'all') return true; return tms(c) > Date.now() - (+cf.period) * 864e5; }
  function matchQ(c){
    if (!cf.q) return true;
    var q = cf.q.toLowerCase(), qd = q.replace(/\D/g, '');
    if ([c.caller_name, c.suburb, c.problem, c.caller_phone].some(function(v){ return v && String(v).toLowerCase().indexOf(q) >= 0; })) return true;
    if (qd.length >= 3) { var pd = String(c.caller_phone || '').replace(/\D/g, ''); if (pd.indexOf(qd) >= 0 || waNum(c.caller_phone).indexOf(waNum(qd)) >= 0) return true; }
    return false;
  }
  function matchType(c, t){ return t === 'all' ? true : t === 'todo' ? todoCall(c) : outOf(c) === t; }
  function filtered(){ return calls.filter(function(c){ return inPeriod(c) && matchQ(c) && matchType(c, cf.type); }); }

  function renderCalls(){
    var since = Date.now() - 30 * 864e5, recent = calls.filter(function(c){ return tms(c) > since; });
    var count = function(t){ return recent.filter(function(c){ return c.call_type === t; }).length; };
    var k = [['Calls, last 30 days', recent.length, true], ['Emergencies', count('emergency')], ['Booked', count('booked')]];
    k.push(followup ? ['Still to call back', calls.filter(todoCall).length] : ['Callbacks', count('callback')]);
    $('callKpis').innerHTML = k.map(function(x){ return '<div class="kpi' + (x[2] ? ' hl' : '') + '"><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('');
    var box = $('callsBox');
    if (!calls.length) {
      box.innerHTML = '<div class="empty"><span class="ic">' + RB.icon('i-phone') + '</span><h3>No calls yet</h3><p class="p-measure">Once Ringback is live on your number, every call it takes shows up here with what the caller needed and a recording.</p><a class="btn btn-line btn-sm" href="index.html#try">Hear the demo</a></div>';
      return;
    }
    if (!$('callQ')) {
      box.innerHTML = callChart() +
        '<div class="calls-tools">' +
          '<div class="calls-row"><label class="sr-only" for="callQ">Search calls</label><input type="search" id="callQ" class="in" placeholder="Search caller, number, suburb or problem" enterkeyhint="search" autocomplete="off">' +
          '<label class="sr-only" for="callPer">Period</label><select id="callPer" class="in"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all" selected>All loaded calls</option></select></div>' +
          '<div class="fchips" id="callChips" role="group" aria-label="Filter by outcome"></div>' +
          '<div class="calls-meta"><p class="mono faint" id="callCountLine" aria-live="polite"></p><button type="button" class="btn btn-line btn-sm" id="csvBtn">' + RB.icon('i-download') + 'Download CSV</button></div>' +
        '</div><div id="callList"></div><div id="callMore" class="calls-more"></div>';
      $('callQ').addEventListener('input', function(){ clearTimeout(qT); qT = setTimeout(function(){ cf.q = $('callQ').value.trim(); renderCallList(); }, 200); });
      $('callQ').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); $('callQ').blur(); } });
      $('callPer').addEventListener('change', function(){ cf.period = $('callPer').value; renderCallList(); });
      $('callChips').addEventListener('click', function(e){ var b = e.target.closest('[data-type]'); if (!b) return; cf.type = b.dataset.type; renderCallList(); });
      $('csvBtn').addEventListener('click', exportCsv);
    } else {
      var ch = box.querySelector('.chart-screen'); if (ch) ch.outerHTML = callChart();
    }
    renderCallList();
  }
  function clearFilters(){ cf = { q: '', type: 'all', period: 'all' }; $('callQ').value = ''; $('callPer').value = 'all'; renderCallList(); }

  function renderCallList(){
    var base = calls.filter(function(c){ return inPeriod(c) && matchQ(c); }), list = base.filter(function(c){ return matchType(c, cf.type); });
    var types = [['all','All',''],['emergency','Emergency','red'],['booked','Booked','mint'],['callback','Callback','amber'],['other','Other','']];
    if (followup) types.splice(1, 0, ['todo','Still to call back','amber']);
    if (!followup && cf.type === 'todo') cf.type = 'all';
    $('callChips').innerHTML = types.map(function(t){
      var n = base.filter(function(c){ return matchType(c, t[0]); }).length;
      return '<button type="button" class="fchip ' + t[2] + '" data-type="' + t[0] + '" aria-pressed="' + (cf.type === t[0]) + '">' + t[1] + ' <span class="n">' + n + '</span></button>';
    }).join('');
    $('callCountLine').textContent = list.length === calls.length ? calls.length + ' call' + (calls.length === 1 ? '' : 's') + (morePossible ? ' loaded' : '') : list.length + ' of ' + calls.length + ' call' + (calls.length === 1 ? '' : 's') + (morePossible ? ' loaded' : '');
    $('csvBtn').disabled = !list.length;
    var el = $('callList');
    if (!list.length) {
      el.innerHTML = '<div class="empty"><h3>No calls match</h3><p>Try another search, outcome or period.</p><button type="button" class="btn btn-line btn-sm" id="clearF">Clear filters</button></div>';
      $('clearF').onclick = clearFilters;
    } else el.innerHTML = MQ.matches ? cardsHtml(list) : tableHtml(list);
    $('callMore').innerHTML = morePossible ? '<button type="button" class="btn btn-line" id="moreBtn" data-net>Load more calls</button>' : '';
    if ($('moreBtn')) $('moreBtn').onclick = loadMore;
    if (recBtn && !document.contains(recBtn)) recRebind();
    netState();
  }

  function recCell(c, label){
    if (!(c.recording_url && /^https:\/\//.test(c.recording_url))) return '';
    return '<span class="rec-cell"><button type="button" class="icon-btn rec-btn" data-rec="' + RB.esc(c.recording_url) + '" data-cid="' + RB.esc(c.id) + '" aria-label="Play the recording of the call from ' + RB.esc(c.caller_name || 'this caller') + '">' + RB.icon('i-play') + '</button><span class="rec-time mono faint"></span>' + (label ? '<a class="faint" target="_blank" rel="noopener" href="' + RB.esc(c.recording_url) + '">Open<span class="sr-only"> the recording in a new tab</span></a>' : '') + '</span>';
  }
  function handledTag(c){ return followup && c.handled_at ? '<span class="tag mint cc-done">Called back ' + hm(c.handled_at) + '</span>' : ''; }
  function cardsHtml(list){
    var out = '', day = null;
    list.forEach(function(c){
      var d = dayLabel(c.occurred_at), o = OUT[outOf(c)], tel = telHref(c.caller_phone), wa = waCell(c.caller_phone), isNew = dotsSince && tms(c) > dotsSince;
      if (d !== day) { out += (day ? '</ul>' : '') + '<h3 class="day-h">' + RB.esc(d) + '</h3><ul class="cc-list">'; day = d; }
      out += '<li class="cc"><button type="button" class="cc-main" data-open="' + RB.esc(c.id) + '">' +
        '<span class="cc-top"><span class="mono cc-time">' + hm(c.occurred_at) + '</span>' + (isNew ? '<span class="cc-new">New</span>' : '') + '<span class="tag ' + o[0] + '">' + o[1] + '</span>' + handledTag(c) + '</span>' +
        '<span class="cc-who"><b>' + RB.esc(c.caller_name || 'Unknown caller') + '</b>' + (c.suburb ? '<span>' + RB.esc(c.suburb) + '</span>' : '') + '</span>' +
        (c.problem ? '<span class="cc-prob">' + RB.esc(c.problem) + '</span>' : '') + '</button>' +
        '<div class="cc-act">' + (tel ? '<a class="btn btn-line cc-btn" href="' + RB.esc(tel) + '">' + RB.icon('i-phone') + 'Call back</a>' : '') +
        (wa ? '<a class="btn btn-line cc-btn" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + RB.icon('i-wa') + 'WhatsApp</a>' : '') + recCell(c, false) + '</div></li>';
    });
    return out + '</ul>';
  }
  function tableHtml(list){
    return '<div class="table-wrap"><table class="data calls-table"><thead><tr><th>When</th><th>Caller</th><th>Suburb</th><th>Problem</th><th>Outcome</th><th>Recording</th></tr></thead><tbody>' +
      list.map(function(c){
        var o = OUT[outOf(c)], tel = telHref(c.caller_phone), isNew = dotsSince && tms(c) > dotsSince;
        return '<tr><td class="mono">' + RB.esc(dShort(c.occurred_at)) + '<br>' + hm(c.occurred_at) + (isNew ? ' <span class="cc-new">New</span>' : '') + '</td>' +
          '<td><button type="button" class="linkbtn" data-open="' + RB.esc(c.id) + '">' + RB.esc(c.caller_name || 'Unknown caller') + '</button>' + (c.caller_phone ? '<br>' + (tel ? '<a class="mono faint" href="' + RB.esc(tel) + '">' + RB.esc(c.caller_phone) + '</a>' : '<span class="faint mono">' + RB.esc(c.caller_phone) + '</span>') : '') + '</td>' +
          '<td>' + RB.esc(c.suburb || '—') + '</td><td>' + RB.esc(c.problem || '—') + '</td>' +
          '<td><span class="tag ' + o[0] + '">' + o[1] + '</span>' + (c.booked_slot ? '<br><span class="faint mono">' + RB.esc(c.booked_slot) + '</span>' : '') + (handledTag(c) ? '<br>' + handledTag(c) : '') + '</td>' +
          '<td>' + (recCell(c, true) || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  $('callsBox').addEventListener('click', function(e){ var b = e.target.closest('[data-open]'); if (b) openCall(b.dataset.open); });

  /* calls per day, last 14 days (weekends lighter) */
  function callChart(){
    var days = [], byDay = {}, key = function(d){ return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    calls.forEach(function(c){ var k = key(new Date(c.occurred_at)); byDay[k] = (byDay[k] || 0) + 1; });
    for (var i = 13; i >= 0; i--) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d: d, n: byDay[key(d)] || 0 }); }
    var top = Math.max.apply(null, days.map(function(x){ return x.n; }).concat([1])), total = days.reduce(function(a, x){ return a + x.n; }, 0);
    var label = function(x){ return WD[x.d.getDay()] + ' ' + x.d.getDate() + ' ' + MO[x.d.getMonth()]; };
    return '<div class="screen p-screen chart-screen"><div class="screen-bar"><span>Calls per day · last 14 days · ' + total + ' call' + (total === 1 ? '' : 's') + '</span></div><div class="screen-body">' +
      '<div class="chart call-chart" aria-hidden="true">' + days.map(function(x){
        var we = x.d.getDay() === 0 || x.d.getDay() === 6;
        return '<div title="' + label(x) + ': ' + x.n + '"><i class="' + (we ? 'night' : '') + (x.n ? '' : ' zero') + '" style="--h:' + Math.max(3, Math.round(x.n / top * 100)) + '%"></i><span>' + x.d.getDate() + '</span></div>';
      }).join('') + '</div>' +
      '<ul class="sr-only">' + days.map(function(x){ return '<li>' + label(x) + ': ' + x.n + ' call' + (x.n === 1 ? '' : 's') + '</li>'; }).join('') + '</ul>' +
      '<div class="legend"><span><i></i>Weekdays</span><span><i class="nt"></i>Weekends</span></div></div></div>';
  }

  async function loadMore(){
    var b = $('moreBtn'); b.classList.add('loading');
    var r = await fetchCalls(calls.length);
    b.classList.remove('loading');
    if (r.error) return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t load more calls. Please try again.', 'err');
    var got = r.data || []; morePossible = got.length === PAGE;
    var have = {}; calls.forEach(function(c){ have[String(c.id)] = 1; });
    calls = calls.concat(got.filter(function(c){ return !have[String(c.id)]; }));
    renderCallList();
  }
  function mergeCalls(rows){
    var byId = {}, added = 0; calls.forEach(function(c){ byId[String(c.id)] = c; });
    rows.forEach(function(c){ var k = String(c.id); if (byId[k]) Object.assign(byId[k], c); else { byId[k] = c; calls.push(c); added++; } });
    calls.sort(function(a, b){ return tms(b) - tms(a); });
    if (!followup && calls.length && Object.prototype.hasOwnProperty.call(calls[0], 'handled_at')) followup = true;
    return added;
  }

  /* ---------- CSV of the filtered list (Excel-safe: BOM, RFC 4180 quoting, no formulas) ---------- */
  function csvCell(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = '\'' + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function exportCsv(){
    var rows = [['Date','Time','Caller','Number','Suburb','Problem','Outcome','Booked slot','Called back','Recording link']].concat(filtered().map(function(c){
      var d = new Date(c.occurred_at);
      return [d.toLocaleDateString('en-ZA', { year:'numeric', month:'2-digit', day:'2-digit' }), hm(d), c.caller_name, c.caller_phone, c.suburb, c.problem, OUT[outOf(c)][1], c.booked_slot,
        followup && c.handled_at ? new Date(c.handled_at).toLocaleDateString('en-ZA', { year:'numeric', month:'2-digit', day:'2-digit' }) + ' ' + hm(c.handled_at) : '', c.recording_url && /^https:\/\//.test(c.recording_url) ? c.recording_url : ''];
    }));
    var csv = '﻿' + rows.map(function(r){ return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'ringback-calls-' + today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------- one recording at a time, in rows, cards and the drawer ---------- */
  var recAudio = null, recBtn = null;
  function fmtS(x){ x = Math.floor(x || 0); return Math.floor(x / 60) + ':' + ('0' + x % 60).slice(-2); }
  function recPaint(b, playing){
    if (!b) return;
    b.innerHTML = RB.icon(playing ? 'i-pause' : 'i-play');
    b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^(Play|Pause)/, playing ? 'Pause' : 'Play'));
    b.classList.toggle('copied', playing);
  }
  function recTime(b){ return b && b.parentNode.querySelector('.rec-time'); }
  function recRebind(){ /* a re-render replaced the button: find its twin by recording URL */
    if (!recAudio) return;
    var nb = $$('[data-rec]').filter(function(x){ return x.dataset.rec === recBtn.dataset.rec; })[0];
    if (nb) { recBtn = nb; recPaint(nb, !recAudio.paused); }
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-rec]'); if (!b) return;
    if (recAudio && recAudio.src === new URL(b.dataset.rec, location.href).href) {
      recBtn = b;
      if (recAudio.paused) { var p = recAudio.play(); if (p && p.catch) p.catch(function(){}); } else recAudio.pause();
      return;
    }
    if (recAudio) { recAudio.pause(); recPaint(recBtn, false); var t0 = recTime(recBtn); if (t0) t0.textContent = ''; }
    recBtn = b; recAudio = new Audio(b.dataset.rec); recAudio.preload = 'none';
    var a = recAudio;
    a.addEventListener('play', function(){ if (a === recAudio) $$('[data-rec]').forEach(function(x){ if (x.dataset.rec === b.dataset.rec) recPaint(x, true); }); });
    a.addEventListener('pause', function(){ if (a === recAudio) $$('[data-rec]').forEach(function(x){ if (x.dataset.rec === b.dataset.rec) recPaint(x, false); }); });
    a.addEventListener('timeupdate', function(){ if (a !== recAudio) return; var txt = fmtS(a.currentTime) + (a.duration && isFinite(a.duration) ? ' / ' + fmtS(a.duration) : ''); $$('[data-rec]').forEach(function(x){ if (x.dataset.rec === b.dataset.rec) { var t = recTime(x); if (t) t.textContent = txt; } }); });
    a.addEventListener('ended', function(){ if (a === recAudio) { a.currentTime = 0; } });
    a.addEventListener('error', function(){ if (a !== recAudio) return; recPaint(recBtn, false); RB.toast('Couldn\'t play that recording here. Try Open instead.', 'err'); recAudio = null; });
    var pr = a.play(); if (pr && pr.catch) pr.catch(function(){});
  });

  /* ---------- the call drawer ---------- */
  var drawer = null;
  function transcriptHtml(t){
    var lines = [];
    var who = function(r){ r = String(r || '').toLowerCase(); return /^(user|caller|customer|human)$/.test(r) ? 'Caller' : /^(assistant|bot|ai|agent|ringback)$/.test(r) ? 'Assistant' : null; };
    if (typeof t === 'string') {
      t.split(/\r?\n/).forEach(function(l){
        l = l.trim(); if (!l) return;
        var m = /^(user|caller|customer|human|assistant|bot|ai|agent|ringback)\s*:\s*(.*)$/i.exec(l);
        if (m) lines.push([who(m[1]), m[2]]); else if (lines.length) lines[lines.length - 1][1] += ' ' + l; else lines.push([null, l]);
      });
    } else if (Array.isArray(t)) {
      t.forEach(function(x){ if (!x || typeof x !== 'object') return; var w = who(x.role || x.speaker), m = x.message || x.content || x.text; if (w && typeof m === 'string' && m.trim()) lines.push([w, m]); });
    }
    if (!lines.length) return '';
    return '<div class="cd-block"><h3 class="kicker">Transcript</h3><dl class="cd-tx">' + lines.map(function(l){ return '<div><dt>' + (l[0] || '·') + '</dt><dd>' + RB.esc(l[1]) + '</dd></div>'; }).join('') + '</dl></div>';
  }
  function durText(s){ s = Math.round(+s); if (!isFinite(s) || s <= 0) return ''; var m = Math.floor(s / 60); return (m ? m + ' min ' : '') + (s % 60) + ' s'; }
  function jobCard(c){
    var o = OUT[outOf(c)][1];
    return ['Ringback call · ' + dShort(c.occurred_at) + ' ' + hm(c.occurred_at), 'Caller: ' + (c.caller_name || 'Unknown'), c.caller_phone ? 'Number: ' + c.caller_phone : '', c.suburb ? 'Suburb: ' + c.suburb : '', c.problem ? 'Problem: ' + c.problem : '', 'Outcome: ' + o, c.booked_slot ? 'Booked: ' + c.booked_slot : '', c.recording_url && /^https:\/\//.test(c.recording_url) ? 'Recording: ' + c.recording_url : '']
      .filter(Boolean).join('\n');
  }
  function markHtml(c){
    if (!followup) return '';
    var done = !!c.handled_at;
    return '<button type="button" class="btn cd-mark' + (done ? ' is-done' : '') + '" aria-pressed="' + done + '" data-net>' + RB.icon(done ? 'i-check' : 'i-phone') + (done ? 'Called back ' + hm(c.handled_at) + ' · tap to undo' : 'Mark as called back') + '</button>';
  }
  function drawerHtml(c){
    var o = OUT[outOf(c)], tel = telHref(c.caller_phone), wa = waCell(c.caller_phone), has = function(k){ return c[k] != null && String(c[k]).trim() !== ''; };
    var dl = [['Number', c.caller_phone], ['Suburb', c.suburb], ['Problem', c.problem], ['Outcome', o[1]], ['Booked slot', c.booked_slot], ['Duration', has('duration_seconds') ? durText(c.duration_seconds) : '']].filter(function(r){ return r[1]; });
    return '<div class="cd">' +
      '<div class="cd-head"><span class="tag ' + o[0] + '">' + o[1] + '</span><span class="mono faint">' + RB.esc(dShort(c.occurred_at)) + ' · ' + hm(c.occurred_at) + '</span></div>' +
      '<h2 class="h-md cd-name">' + RB.esc(c.caller_name || 'Unknown caller') + '</h2>' +
      ((tel || wa) ? '<div class="cd-acts">' + (tel ? '<a class="btn btn-hot" href="' + RB.esc(tel) + '">' + RB.icon('i-phone') + 'Call back</a>' : '') + (wa ? '<a class="btn btn-line" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + RB.icon('i-wa') + 'WhatsApp</a>' : '') + '</div>' : '') +
      '<div class="cd-markbox">' + markHtml(c) + '</div>' +
      '<dl class="cd-dl">' + dl.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + RB.esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (recCell(c, true) ? '<div class="cd-block"><h3 class="kicker">Recording</h3>' + recCell(c, true) + '</div>' : '') +
      (has('summary') && typeof c.summary === 'string' ? '<div class="cd-block"><h3 class="kicker">Summary</h3><p>' + RB.esc(c.summary) + '</p></div>' : '') +
      (c.transcript ? transcriptHtml(c.transcript) : '') +
      '<div><button type="button" class="btn btn-line btn-sm cd-copy">' + RB.icon('i-copy') + 'Copy details</button></div></div>';
  }
  function openCall(id){
    var c = calls.filter(function(x){ return String(x.id) === String(id); })[0];
    if (!c) { RB.toast('That call isn\'t in your list. It may be older than the calls loaded here.', 'warn'); if (/^#calls\//.test(location.hash)) history.replaceState(null, '', '#calls'); return; }
    if (drawer) drawer.sh.close();
    var back = /^#calls\//.test(location.hash) ? '#calls' : (location.hash || '#' + view);
    history.replaceState(null, '', '#calls/' + encodeURIComponent(c.id));
    var sh = RB.sheet({ label: 'Call', size: RB.mq.compact.matches ? 'full' : 'md', html: drawerHtml(c), onClose: function(){ drawer = null; if (/^#calls\//.test(location.hash)) history.replaceState(null, '', back); } });
    sh.el.classList.add('cd-sheet');
    drawer = { sh: sh, id: String(c.id) };
    sh.body.querySelector('.cd-copy').addEventListener('click', function(){ RB.copy(jobCard(c), this); });
    sh.body.querySelector('.cd-markbox').addEventListener('click', function(e){ var b = e.target.closest('.cd-mark'); if (b) markCall(c, !c.handled_at, b); });
    recRebind(); netState();
  }
  async function markCall(c, done, b){
    b.classList.add('loading');
    var r = await RB.call(function(){ return sb.rpc('client_mark_call', { p_call: String(c.id), p_done: done }); });
    b.classList.remove('loading');
    if (r.error) {
      if (missingFn(r)) { followup = false; calls.forEach(function(x){ delete x.handled_at; }); var bx = b.parentNode; bx.innerHTML = ''; var cp = bx.parentNode.querySelector('.cd-copy'); if (cp) cp.focus(); renderCalls(); renderOverview(); return; }
      return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t update that call. Please try again.', 'err');
    }
    c.handled_at = done ? new Date().toISOString() : null;
    var box = b.parentNode; box.innerHTML = markHtml(c); var nb = box.querySelector('.cd-mark'); if (nb) nb.focus();
    renderOverview(); renderCalls(); badges();
    RB.toast(done ? 'Marked as called back' : 'Moved back to still to call back', 'ok');
  }

  /* ================= account ================= */
  function renderAccount(){
    $('acEmail').value = user.email || ''; if (document.activeElement !== $('acName')) $('acName').value = profile.full_name || '';
    $('whoName').textContent = profile.business_name || profile.full_name || 'Your account'; $('whoEmail').textContent = user.email || '';
    var ll = user.last_sign_in_at && new Date(user.last_sign_in_at);
    $('lastLogin').hidden = !(ll && !isNaN(ll)); if (ll && !isNaN(ll)) $('lastLogin').textContent = 'Last log-in: ' + dShort(ll) + ' at ' + hm(ll);
    renderRefer();
  }
  $('accountForm').addEventListener('submit', async function(e){
    e.preventDefault();
    var r = await RB.call(function(){ return sb.from('profiles').update({ full_name: $('acName').value.trim() }).eq('id', UID).select().maybeSingle(); });
    if (r.error || !r.data) return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t save. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; renderAccount(); renderOverview(); RB.toast('Saved', 'ok');
  });
  $('dlBtn').addEventListener('click', function(){
    var blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), account: { email: user.email }, profile: profile, invoices: invoices, calls: calls }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ringback-my-data.json'; document.body.appendChild(a); a.click(); a.remove();
  });
  function twoStep(area, o){
    function first(){
      area.innerHTML = '<div><button class="btn ' + o.cls + ' btn-sm" type="button">' + o.btn + '</button></div>';
      area.querySelector('button').onclick = ask;
    }
    function ask(){
      area.innerHTML = '<p class="alert err">' + o.warn + '</p><div class="ctas mt-s"><button class="btn btn-danger btn-sm" type="button" data-yes data-net>' + o.yes + '</button><button class="btn btn-line btn-sm" type="button" data-no>Cancel</button></div>';
      area.querySelector('[data-no]').onclick = first; netState();
      area.querySelector('[data-yes]').onclick = async function(){ this.classList.add('loading'); await o.go(area, this); };
      area.querySelector('[data-no]').focus();
    }
    first();
  }
  twoStep($('delArea'), { cls: 'btn-danger', btn: RB.icon('i-trash') + 'Request deletion', warn: 'This deletes your account, business details and call history. Are you sure?', yes: 'Yes, delete my account', go: async function(area){
    var r = await RB.call(function(){ return sb.from('requests').insert({ user_id: UID, kind: 'delete_account', note: 'Requested from portal' }); });
    area.innerHTML = r.error ? '<p class="alert err">Couldn\'t send the request. Please WhatsApp us and we\'ll delete it for you.</p>' : '<p class="alert ok">Request received. We\'ll delete your account within 7 days and confirm by email.</p>';
  } });
  twoStep($('allArea'), { cls: 'btn-line', btn: RB.icon('i-logout') + 'Log out of all devices', warn: 'This logs you out on every phone and computer, including this one. You\'ll need a new code to log in again.', yes: 'Yes, log out everywhere', go: async function(area, b){
    leaving = true; dirty = false;
    var r = await run(function(){ return sb.auth.signOut({ scope: 'global' }); });
    if (r && r.error) { leaving = false; b.classList.remove('loading'); return RB.toast(netErr(r) ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t log out everywhere. Please try again.', 'err'); }
    location.href = 'login.html';
  } });

  /* ---------- refer another business (a share link, no counts, no rewards unless configured) ---------- */
  function renderRefer(){
    var code = String(UID).replace(/[^0-9a-f]/gi, '').slice(0, 8).toLowerCase(), link = (C.siteUrl || location.href.replace(/[^/]*$/, '')) + '?ref=' + code;
    var text = 'I use Ringback to answer the calls I miss. Have a look: ' + link;
    $('referCard').innerHTML = '<span class="kicker">Refer</span><h3>Know another tradie who misses calls? Send them this.</h3>' +
      '<p class="refer-link mono">' + RB.esc(link) + '</p>' +
      '<div class="refer-acts"><button type="button" class="btn btn-line btn-sm" id="refCopy">' + RB.icon('i-copy') + 'Copy link</button><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + RB.wa(text, true) + '">' + RB.icon('i-wa') + 'Share on WhatsApp</a>' +
      (navigator.share ? '<button type="button" class="btn btn-ghost btn-sm" id="refShare">' + RB.icon('i-link') + 'Share…</button>' : '') + '</div>' +
      (profile.plan === 'founding' ? '<p class="p-small">As a founding partner we asked for a review and two referrals if you\'re happy. This link is the easy way.</p>' : '') +
      (C.referralNote ? '<p class="p-small">' + RB.esc(C.referralNote) + '</p>' : '');
    $('refCopy').onclick = function(){ RB.copy(link, this); };
    if ($('refShare')) $('refShare').onclick = function(){ navigator.share({ title: 'Ringback', text: 'I use Ringback to answer the calls I miss.', url: link }).catch(function(){}); };
  }

  /* ================= routing, tab bar, app bar ================= */
  var VIEWS = ['overview','setup','plan','billing','calls','account'], scrollAt = {};
  function route(){
    var parts = location.hash.replace('#', '').split('/'), v = parts[0] || 'overview';
    if (VIEWS.indexOf(v) < 0) v = 'overview';
    if (v !== view) scrollAt[view] = window.scrollY;
    var changed = v !== view || !route.done; route.done = true;
    if (view === 'calls' && v !== 'calls') { dotsSince = null; }
    if (v === 'calls' && view !== 'calls') { dotsSince = seenAt; seenAt = Date.now(); lsSet(SEENKEY, { at: seenAt }); }
    view = v;
    $$('[data-view]').forEach(function(s){ s.hidden = s.dataset.view !== v; });
    $$('[data-nav]').forEach(function(a){ if (a.dataset.nav === v || (v === 'plan' && a.dataset.nav === 'billing' && a.closest('.tabbar'))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (v === 'calls' && changed) renderCalls();
    badges();
    if (changed) window.scrollTo(0, scrollAt[v] || 0);
    if (v === 'calls' && parts[1] && (!drawer || drawer.id !== decodeURIComponent(parts[1]))) openCall(decodeURIComponent(parts[1]));
  }
  window.addEventListener('hashchange', route);

  function stamp(){ $('abUpdated').textContent = 'Updated ' + hm(new Date(lastLoad)); }
  function appBar(){ var on = STANDALONE || MQ.matches; $('appBar').hidden = !on; body.classList.toggle('has-appbar', on); }
  MQ.addEventListener('change', appBar);

  function renderAllData(){ renderOverview(); renderPlan(); renderBilling(); renderCalls(); renderAccount(); renderGoLive(); badges(); stamp(); netState(); }

  $('abRefresh').addEventListener('click', async function(){
    var b = this; b.classList.add('is-spin'); b.disabled = true;
    var res = await load();
    b.classList.remove('is-spin'); b.disabled = false;
    if (!res.ok) { if (!leaving) RB.toast(res.net ? 'No signal. Try again when you\'re back online.' : 'Couldn\'t refresh just now. Please try again.', 'err'); return; }
    renderAllData(); if (!dirty) fillSetup();
    RB.toast('Up to date', 'ok');
  });

  /* back to the app after a while: quietly fetch new calls and invoices */
  async function fresh(){
    if (!profile || leaving || navigator.onLine === false) return;
    lastLoad = Date.now();
    var r = await Promise.all([fetchCalls(0), fetchInvoices()]);
    if (r[0].error || r[1].error) return;
    var before = calls.length, added = mergeCalls(r[0].data || []);
    invoices = r[1].data || [];
    if (before === 0 && calls.length) morePossible = (r[0].data || []).length === PAGE;
    renderAllData();
    if (added) RB.toast(added === 1 ? '1 new call' : added + ' new calls', 'ok');
  }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && Date.now() - lastLoad > 90e3) fresh(); });

  /* ================= start ================= */
  var res = await load();
  if (!res.ok) { if (!leaving) showLoadError(res); return; }
  hideLoading();
  appBar(); wizApply();
  fillSetup();
  if (!checkDraft()) importBuilder();
  renderAllData(); route();
  importMeta();
  var payId = new URLSearchParams(location.search).get('pay');
  if (payId) {
    history.replaceState(null, '', location.pathname + location.hash);
    var toPay = invoices.filter(function(i){ return String(i.id) === payId && i.status === 'due'; })[0];
    if (toPay) payDialog(toPay);
  }
  sb.auth.onAuthStateChange(function(ev, session){
    if (ev === 'SIGNED_OUT' && !leaving) { leaving = true; if (dirty) saveDraft(); location.replace('login.html'); }
    if (ev === 'USER_UPDATED' && session && session.user) { user = session.user; renderAccount(); }
  });
})();
