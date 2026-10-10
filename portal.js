/* Client portal: overview, business setup, plan and trial, calls, account. */
(async function(){
  var RB = window.RB, sb = RB.sb, C = window.RB_CONFIG;
  var $ = function(id){ return document.getElementById(id); };
  document.querySelectorAll('[data-signout]').forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); RB.signOut(); }); });

  var user = await RB.requireUser();
  if (!user) return;

  var PLANS = {
    founding: { name:'Founding partner', price:'R1,500', per:'/mo for 60 days', setup:'No setup fee', feats:['Everything in Starter','Weekly call reviews','Stop at day 60'] },
    starter:  { name:'Starter', price:'R2,500', per:'/month', setup:'R3,500 setup · 250 min', feats:['Missed and after-hours calls','Emergency SMS alerts','Calendar booking','Call recordings'] },
    pro:      { name:'Pro', price:'R4,500', per:'/month', setup:'R5,500 setup · 600 min', feats:['Everything in Starter','English and Afrikaans','Review requests','Monthly report'] }
  };
  var STATUS = { new:['new','Getting started'], req:['req','Trial requested'], setting_up:['setting_up','Setting up'], trial:['trial','Trial running'], live:['live','Live'], paused:['paused','Paused'] };
  var REQUIRED = ['business_name','trade','phone','service_areas','hours','callout_weekday'];
  var FIELDS = ['owner_name','services','not_offered','service_areas','excluded_areas','hours','after_hours','callout_weekday','callout_after','emergencies','callback_promise','booking','calendar_email','languages','always_say','never_say','notes'];

  var profile = null, calls = [];

  async function load(){
    var p = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (p.error || !p.data) { $('loading').hidden = true; $('loadErr').hidden = false; $('loadErr').textContent = 'We couldn\'t load your account just now. Refresh the page, or WhatsApp us if it keeps happening.'; return false; }
    profile = p.data; profile.setup = profile.setup || {};
    var pending = null; try { pending = sessionStorage.getItem('rb_plan'); sessionStorage.removeItem('rb_plan'); } catch (e) {}
    if (pending && PLANS[pending] && !profile.plan) { await sb.from('profiles').update({ plan: pending }).eq('id', user.id); profile.plan = pending; }
    var c = await sb.from('calls').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(200);
    calls = c.data || [];
    sb.rpc('is_admin').then(function(r){ if (r.data === true) { $('adminLink').hidden = false; $('adminLinkM').hidden = false; } });
    return true;
  }

  /* ---------- helpers ---------- */
  function setupValues(){ var s = Object.assign({}, profile.setup); s.business_name = profile.business_name; s.trade = profile.trade; s.phone = profile.phone; return s; }
  function filled(v){ return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }
  function setupPct(){ var s = setupValues(), n = 0; REQUIRED.forEach(function(k){ if (filled(s[k])) n++; }); return Math.round(n / REQUIRED.length * 100); }
  function statusKey(){ if (profile.status === 'new' && profile.trial_requested_at) return 'req'; return profile.status; }
  function firstName(){ var n = (profile.setup.owner_name || profile.full_name || '').trim().split(' ')[0]; return n || 'there'; }
  function fmtDate(d){ try { return new Date(d).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }); } catch (e) { return d; } }
  function fmtTime(d){ try { return new Date(d).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); } catch (e) { return d; } }

  /* ---------- overview ---------- */
  function renderOverview(){
    var h = new Date().getHours();
    $('greet').textContent = (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ', ' + firstName();
    $('greetKicker').textContent = profile.business_name || 'Overview';
    var st = STATUS[statusKey()] || STATUS.new, pill = $('statusPill');
    pill.className = 'status ' + st[0]; pill.lastChild.textContent = st[1];
    var pct = setupPct(), s = profile.status;
    var steps = [
      { t:'Create your account', d:'Done. Welcome to Ringback.', done:true },
      { t:'Fill in your business details', d:pct + '% complete', done:pct === 100, href:'#setup', btn:'Finish setup' },
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
    if (!nextStep) { $('nextText').textContent = 'You\'re all set. Ringback is answering your missed calls.'; nb.textContent = 'View calls'; nb.href = '#calls'; }
    else if (nextStep.href) { $('nextText').textContent = 'Next: ' + nextStep.t.toLowerCase() + '.'; nb.textContent = nextStep.btn; nb.href = nextStep.href; nb.removeAttribute('target'); }
    else { $('nextText').textContent = 'We\'ve got your request. We\'ll WhatsApp you within one working day to set up forwarding.'; nb.textContent = 'WhatsApp us'; nb.href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || '') + '. I\'d like to set up my trial.'); nb.target = '_blank'; }
    $('planName').textContent = profile.plan ? PLANS[profile.plan].name : 'Not chosen yet';
    $('planNote').textContent = profile.plan ? PLANS[profile.plan].price + PLANS[profile.plan].per + ' · ' + PLANS[profile.plan].setup : 'Pick the plan that fits. You start with a free trial week either way.';
    var since = Date.now() - 30 * 864e5;
    $('callCount').textContent = calls.filter(function(c){ return new Date(c.occurred_at).getTime() > since; }).length;
    $('helpWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I need a hand with my account.');
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
  function updateMeter(){
    var v = readSetup(), s = Object.assign({}, v.setup, { business_name: v.business_name, trade: v.trade, phone: v.phone }), n = 0;
    REQUIRED.forEach(function(k){ if (filled(s[k])) n++; });
    var pct = Math.round(n / REQUIRED.length * 100);
    $('setupPct').textContent = pct + '% complete'; $('setupMeter').style.setProperty('--v', pct + '%');
  }
  var dirty = false;
  form.addEventListener('input', function(){ dirty = true; $('saveState').textContent = 'Unsaved changes'; updateMeter(); });
  window.addEventListener('beforeunload', function(e){ if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var v = readSetup();
    if (!v.business_name) { form.elements.namedItem('business_name').focus(); return RB.toast('Please add your business name.', 'err'); }
    var b = $('saveBtn'); b.classList.add('loading');
    var r = await sb.from('profiles').update(v).eq('id', user.id).select().maybeSingle();
    b.classList.remove('loading');
    if (r.error) return RB.toast('Couldn\'t save. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; dirty = false;
    $('saveState').textContent = 'Saved ' + new Date().toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' });
    RB.toast('Business details saved', 'ok'); renderOverview(); renderPlan();
  });

  /* ---------- plan + trial ---------- */
  function renderPlan(){
    $('planCards').innerHTML = Object.keys(PLANS).map(function(k){
      var p = PLANS[k], sel = profile.plan === k;
      return '<div class="plan' + (sel ? ' sel' : '') + (k === 'founding' ? ' star' : '') + '">' + (k === 'founding' ? '<span class="ribbon">3 places</span>' : '') +
        '<div><h3>' + p.name + '</h3></div><div class="price"><b>' + p.price + '</b><span>' + p.per + '</span></div><p class="setup">' + p.setup + '</p>' +
        '<ul>' + p.feats.map(function(f){ return '<li>' + RB.icon('i-check') + RB.esc(f) + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn ' + (sel ? 'btn-line' : 'btn-hot') + '" data-plan="' + k + '"' + (sel ? ' disabled' : '') + '>' + (sel ? 'Your plan' : 'Choose ' + p.name) + '</button></div>';
    }).join('');
    $('planCards').querySelectorAll('[data-plan]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        btn.classList.add('loading');
        var r = await sb.from('profiles').update({ plan: btn.dataset.plan }).eq('id', user.id).select().maybeSingle();
        if (r.error) { btn.classList.remove('loading'); return RB.toast('Couldn\'t change plan. Please try again.', 'err'); }
        profile = r.data; profile.setup = profile.setup || {}; RB.toast('Plan updated to ' + PLANS[profile.plan].name, 'ok'); renderPlan(); renderOverview();
      });
    });
    var tb = $('trialBtn'), pct = setupPct();
    $('trialWa').href = RB.wa('Hi Ringback, it\'s ' + (profile.business_name || firstName()) + '. I\'d like to set up my free trial week.');
    if (profile.trial_requested_at) {
      $('trialTitle').textContent = 'Trial requested ' + fmtDate(profile.trial_requested_at);
      $('trialText').textContent = ['trial','live'].indexOf(profile.status) >= 0 ? 'Your assistant is set up. Thanks for trying Ringback.' : 'We\'ll WhatsApp you within one working day to set up call forwarding. Want to speed things up? Message us now.';
      tb.hidden = true;
    } else {
      tb.hidden = false;
      tb.disabled = pct < 100;
      $('trialText').textContent = pct < 100 ? 'Finish your business details first (' + pct + '% done), then request your trial here.' : 'All set. Request your trial and we\'ll WhatsApp you to set up call forwarding.';
    }
  }
  $('trialBtn').addEventListener('click', async function(){
    var b = $('trialBtn'); b.classList.add('loading');
    var r = await sb.from('profiles').update({ trial_requested_at: new Date().toISOString() }).eq('id', user.id).select().maybeSingle();
    b.classList.remove('loading');
    if (r.error) return RB.toast('Couldn\'t send your request. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; RB.toast('Trial requested. We\'ll be in touch.', 'ok'); renderPlan(); renderOverview();
  });

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
    if (r.error) return RB.toast('Couldn\'t save. Please try again.', 'err');
    profile = r.data; profile.setup = profile.setup || {}; renderAccount(); renderOverview(); RB.toast('Saved', 'ok');
  });
  $('dlBtn').addEventListener('click', function(){
    var blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), account: { email: user.email }, profile: profile, calls: calls }, null, 2)], { type: 'application/json' });
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
      var r = await sb.from('requests').insert({ user_id: user.id, kind: 'delete_account', note: 'Requested from portal' });
      area.innerHTML = r.error ? '<p class="alert err">Couldn\'t send the request. Please WhatsApp us and we\'ll delete it for you.</p>' : '<p class="alert ok">Request received. We\'ll delete your account within 7 days and confirm by email.</p>';
    };
  }
  $('delBtn').onclick = askDelete;

  /* ---------- routing ---------- */
  var VIEWS = ['overview','setup','plan','calls','account'];
  function route(){
    var v = location.hash.replace('#','') || 'overview'; if (VIEWS.indexOf(v) < 0) v = 'overview';
    document.querySelectorAll('[data-view]').forEach(function(s){ s.hidden = s.dataset.view !== v; });
    document.querySelectorAll('[data-nav]').forEach(function(a){ if (a.dataset.nav === v) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  if (!(await load())) return;
  $('loading').hidden = true;
  renderOverview(); fillSetup(); renderPlan(); renderCalls(); renderAccount(); route();
  sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_OUT') location.replace('login.html'); });
})();
