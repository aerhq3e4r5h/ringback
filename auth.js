/* Supabase client, session helpers and the log-in / sign-up page (email one-time code).
   Loaded by login, dashboard, admin and invoice, after config.js, site.js and supabase-js.
   CONTRACT  RB.sb, RB.requireUser(), RB.signOut(): unchanged for the portal, admin and invoice pages.
             RB.authError(err, mode) -> {text, kind:'err'|'warn', action:null|'signup'|'wa'|'handoff'|'resend', retryAfter:number|null}
             mode is 'login', 'signup' or 'verify'. Raw server text only goes to console.warn, never into the page.
   Sign-up user_metadata keys: full_name, business_name, trade, phone, preferred_start, referred_by, plan.
   Storage   rb_otp {email, mode, next, sentAt, resendAt} (session, mirrored to local so a new tab can carry on, 15 min),
             rb_next {next, at} (local, 15 min), rb_last_email (local), rb_start (session), rb_plan (session), rb_th (session). */
(function(){
  var C = window.RB_CONFIG || {}, RB = window.RB = window.RB || {};
  var fromLink = /(^|[#&])access_token=/.test(location.hash);
  RB.sb = null;
  if (C.supabaseUrl && C.supabaseKey && window.supabase && window.supabase.createClient) {
    RB.sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  }
  /* An email link that has expired or was already used comes back with an error in the address. */
  function linkError(){ var h = new URLSearchParams(location.hash.replace(/^#/, '')); return h.get('error_code') || h.get('error') || ''; }
  RB.requireUser = async function(){
    if (!RB.sb) { location.replace('login.html'); return null; }
    var err = linkError();
    var r = await RB.sb.auth.getSession();
    var s = r.data && r.data.session;
    if (!s) {
      var here = (location.pathname.split('/').pop() || 'dashboard.html') + location.search + (err ? '' : location.hash);
      location.replace('login.html?next=' + encodeURIComponent(here) + (err ? '&notice=' + encodeURIComponent(err) : ''));
      return null;
    }
    return s.user;
  };
  RB.signOut = async function(){ if (RB.sb) await RB.sb.auth.signOut(); location.href = 'index.html'; };

  /* ---------------- honest error wording (also used by admin tools) ---------------- */
  RB.authError = function(err, mode){
    var e = err || {}, code = String(e.code || e.error_code || ''), status = +e.status || 0;
    var m = String(e.message || e.msg || e.error_description || e.error || '');
    try { console.warn('Ringback auth (' + (mode || '') + '):', status || '-', code || '-', m); } catch (x) {}
    var out = function(text, action, kind, retry){ return { text: text, kind: kind || 'err', action: action || null, retryAfter: retry == null ? null : retry }; };
    var verify = mode === 'verify', wait = m.match(/after (\d+) seconds?/i);
    var net = !(status >= 500) && (e.name === 'AuthRetryableFetchError' || e.name === 'TypeError' || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m));
    if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(m))
      return out('We can\'t send login emails right now. Leave your number and we\'ll get you in.', 'handoff', 'warn');
    if (code === 'over_request_rate_limit' || wait) {
      var n = wait ? +wait[1] : 60;
      return out('Please wait ' + n + ' second' + (n === 1 ? '' : 's') + ' before asking for another code.', null, 'warn', n);
    }
    if (code === 'email_address_not_authorized' || /address not authori[sz]ed/i.test(m))
      return out('We\'re in early access and can\'t email that address yet. Leave your number and we\'ll get you in.', 'handoff');
    var signupOff = code === 'signup_disabled' || /signups? not allowed/i.test(m), otpOff = code === 'otp_disabled';
    var notFound = code === 'user_not_found' || /user not found/i.test(m);
    if (mode === 'signup' && (signupOff || otpOff)) return out('New sign-ups are paused right now. WhatsApp us and we\'ll set you up.', 'wa');
    if (!verify && (signupOff || otpOff || notFound)) return out('There\'s no account for that email.', 'signup');
    if (code === 'otp_expired' || /(token|link|code|otp).*(expired|invalid)|(expired|invalid).*(token|otp|code)/i.test(m) || (verify && (status === 401 || status === 403)))
      return out('That code is wrong or has expired.', 'resend');
    if (code === 'email_address_invalid' || (code === 'validation_failed' && /email/i.test(m)) || /unable to validate email|email address .* is invalid|invalid email/i.test(m))
      return out('That email address doesn\'t look right.');
    if (!verify && (status >= 500 || code === 'unexpected_failure' || code === 'email_provider_disabled' || code === 'captcha_failed' || /error sending|smtp/i.test(m)))
      return out('Our email service didn\'t send that.', 'handoff');
    if (net) return out('Couldn\'t reach the server. Check your signal and try again.');
    return out('Something went wrong on our side. Try again, or WhatsApp us.', 'wa');
  };

  /* ---------------- log-in page ---------------- */
  var card = document.getElementById('auth');
  if (!card) return;
  var $ = function(id){ return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var LEN = Math.min(10, Math.max(6, +C.otpLength || 6)), MINS = +C.otpExpiryMinutes || 10, RESEND = 60, KEEP = 15 * 6e4, HELP_AFTER = 75e3;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var mode = params.get('mode') === 'signup' ? 'signup' : 'login';
  var okNext = function(n){ return typeof n === 'string' && /^[\w-]+\.html(\?[\w=&%.-]*)?(#[\w-]*)?$/.test(n); };
  var hasNext = okNext(params.get('next')), next = hasNext ? params.get('next') : 'dashboard.html';
  var notice = params.get('notice') || linkError();
  var email = '', view = '', sentAt = 0, resendAt = 0, tick = null, helpTimer = null, tries = 0, verifying = false, done = false, lastAuto = '', lastErr = null;
  var mq = RB.mq || { compact: window.matchMedia('(max-width:700px), (pointer:coarse) and (max-height:500px)') };

  /* storage, never trusted and never required */
  function getJSON(store, k){ try { return JSON.parse(window[store].getItem(k)); } catch (e) { return null; } }
  function setJSON(store, k, v){ try { if (v == null) window[store].removeItem(k); else window[store].setItem(k, JSON.stringify(v)); } catch (e) {} }
  function getRaw(store, k){ try { return window[store].getItem(k) || ''; } catch (e) { return ''; } }
  function setRaw(store, k, v){ try { window[store].setItem(k, v); } catch (e) {} }
  function saveOtp(o){ setJSON('sessionStorage', 'rb_otp', o); setJSON('localStorage', 'rb_otp', o); }
  function loadOtp(){
    var o = getJSON('sessionStorage', 'rb_otp') || getJSON('localStorage', 'rb_otp');
    return o && EMAIL_RE.test(o.email || '') && Date.now() - o.sentAt < KEEP && Date.now() - o.sentAt >= 0 ? o : null;
  }

  /* ---- views ---- */
  var steps = { wait: 'stepWait', form: 'stepForm', code: 'stepCode', finish: 'stepFinish', in: 'stepIn', check: 'stepCheck' };
  function setView(v){
    view = v;
    Object.keys(steps).forEach(function(k){ $(steps[k]).hidden = k !== v; });
    document.documentElement.classList.remove('th-mode');
    hideHandoff();
  }
  function say(text, kind, el){ el = el || $('formMsg'); el.className = 'form-msg' + (kind ? ' ' + kind : ''); el.textContent = text; return el; }
  function actBtn(host, label, fn, cls, href){
    var row = host.querySelector('.msg-acts');
    if (!row) { row = document.createElement('div'); row.className = 'msg-acts'; host.appendChild(row); }
    var b = document.createElement(href ? 'a' : 'button');
    b.className = 'btn btn-line btn-sm ' + (cls || '');
    if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else { b.type = 'button'; b.onclick = fn; }
    b.innerHTML = (cls === 'wa' ? RB.icon('i-wa') : ''); b.appendChild(document.createTextNode(label));
    row.appendChild(b); return b;
  }
  function waText(extra){
    var n = $('su-name').value.trim(), b = $('su-biz').value.trim();
    return 'Hi Ringback, ' + (n ? 'I\'m ' + n + (b ? ' from ' + b : '') + '. ' : '') + extra + (email ? ' My email is ' + email + '.' : '');
  }

  /* show RB.authError's message and its action in a step's message area */
  function showError(err, where, ctx){
    var f = RB.authError(err, ctx), host = where === 'code' ? $('codeMsg') : where === 'finish' ? $('finishMsg') : $('formMsg');
    lastErr = err;
    if (f.action === 'handoff') { showHandoff(where, err, f.text); return f; }
    var text = f.text;
    if (where === 'code' && f.action === 'resend' && tries >= 3) text += ' If you asked for more than one code, use the newest email.';
    say(text, f.kind, host);
    if (f.action === 'signup') actBtn(host, 'Create an account', function(){ setMode('signup'); $('su-name').focus(); });
    if (f.action === 'wa') actBtn(host, 'WhatsApp us', null, 'wa', RB.wa(waText(mode === 'signup' ? 'I\'d like to create a Ringback account.' : 'I\'m trying to log in to Ringback.')));
    if (f.action === 'resend' && where === 'code') actBtn(host, 'Send a new code', function(){ resend(); });
    if (f.retryAfter) {
      if (where === 'code') startResend(f.retryAfter);
      else { var b = $('sendBtn'); b.disabled = true; setTimeout(function(){ b.disabled = !RB.sb; }, f.retryAfter * 1000); }
    }
    return f;
  }

  /* ---- mode: log in / create account ---- */
  function setMode(m){
    mode = m;
    $('tabLogin').setAttribute('aria-selected', m === 'login'); $('tabSignup').setAttribute('aria-selected', m === 'signup');
    $('signupFields').hidden = m !== 'signup';
    $('authTitle').innerHTML = m === 'signup' ? 'Create your <span class="hot">account</span>' : 'Welcome <span class="hot">back</span>';
    $('authSub').textContent = m === 'signup' ? 'Takes a minute. No password: we email you a ' + LEN + '-digit code to confirm it\'s you.' : 'Enter your email and we\'ll send you a ' + LEN + '-digit code. No password needed.';
    if (RB.sb) $('sendBtn').textContent = m === 'signup' ? 'Create account' : 'Send me a code';
    $('switchLine').innerHTML = m === 'signup' ? 'Already have an account? <button type="button" class="linkbtn" id="switchBtn">Log in</button>' : 'New to Ringback? <button type="button" class="linkbtn" id="switchBtn">Create an account</button>';
    $('switchBtn').onclick = function(){ setMode(mode === 'signup' ? 'login' : 'signup'); };
    say(''); hideHandoff();
    var q = new URLSearchParams(location.search); if (m === 'signup') q.set('mode', 'signup'); else q.delete('mode');
    var qs = q.toString(); try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
  }
  $('tabLogin').onclick = function(){ setMode('login'); };
  $('tabSignup').onclick = function(){ setMode('signup'); };

  /* ---- sign-up context: trade, plan, start date, builder draft ---- */
  function pickTrade(label){ var s = $('su-trade'); [].forEach.call(s.options, function(o){ if (label && o.text === label) s.value = o.value || o.text; }); }
  if (params.get('trade')) pickTrade(params.get('trade'));
  else if (RB.getTrade && RB.getTrade() && RB.tradeByKey) pickTrade((RB.tradeByKey(RB.getTrade()) || {}).label);
  if (params.get('plan')) setRaw('sessionStorage', 'rb_plan', params.get('plan'));
  (function(){
    var s = params.get('start'), m = s && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return;
    var d = new Date(+m[1], +m[2] - 1, +m[3]), today = new Date(); today.setHours(0, 0, 0, 0);
    var real = d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
    if (real && d >= today && d - today <= 60 * 864e5) setRaw('sessionStorage', 'rb_start', s);
  })();
  (function(){
    var draft = RB.getDraft && RB.getDraft(), f = (draft && draft.fields) || {}, filled = false;
    if (!draft && params.get('from') !== 'build') return;
    var put = function(id, v){ v = String(v || '').trim(); if (v && !$(id).value.trim()) { $(id).value = v.slice(0, 120); filled = true; } };
    put('su-name', f.owner_name); put('su-biz', f.business_name);
    if (f.trade && !params.get('trade')) { pickTrade(f.trade); if ($('su-trade').value === f.trade) filled = true; }
    $('draftNote').hidden = !filled;
  })();

  /* ---- the email field: typo catch and remembered address ---- */
  var TYPO = { 'gmial.com':'gmail.com', 'gmal.com':'gmail.com', 'gmai.com':'gmail.com', 'gamil.com':'gmail.com', 'gnail.com':'gmail.com', 'gmail.co':'gmail.com', 'gmail.co.za':'gmail.com',
    'hotmial.com':'hotmail.com', 'hotmal.com':'hotmail.com', 'outlok.com':'outlook.com', 'outllok.com':'outlook.com', 'yaho.com':'yahoo.com' };
  var emailIn = $('email'), typoFor = '';
  function suggestion(v){ var at = v.lastIndexOf('@'); if (at < 1) return ''; var fix = TYPO[v.slice(at + 1)]; return fix ? v.slice(0, at + 1) + fix : ''; }
  function checkTypo(){
    var v = emailIn.value.trim().toLowerCase(), s = suggestion(v), b = $('typoBtn');
    b.hidden = !s; typoFor = s ? v : '';
    if (s) { b.textContent = 'Did you mean '; var x = document.createElement('b'); x.textContent = s; b.appendChild(x); b.appendChild(document.createTextNode('?')); b.dataset.fix = s; }
    return !!s;
  }
  emailIn.addEventListener('blur', checkTypo);
  emailIn.addEventListener('input', function(){ if (!$('typoBtn').hidden && emailIn.value.trim().toLowerCase() !== typoFor) $('typoBtn').hidden = true; emailIn.removeAttribute('aria-invalid'); });
  $('typoBtn').onclick = function(){ emailIn.value = this.dataset.fix; this.hidden = true; typoFor = ''; emailIn.focus(); };
  (function(){
    var q = (params.get('email') || '').trim().toLowerCase(), last = getRaw('localStorage', 'rb_last_email');
    if (q && EMAIL_RE.test(q) && q.length <= 200) emailIn.value = q;
    else if (last && EMAIL_RE.test(last)) emailIn.value = last;
  })();

  /* ---- sending the code ---- */
  function signupData(){
    var d = { full_name: $('su-name').value.trim(), business_name: $('su-biz').value.trim(), trade: $('su-trade').value, phone: $('su-phone').value.trim() };
    var start = getRaw('sessionStorage', 'rb_start'), ref = RB.getRef && RB.getRef(), plan = getRaw('sessionStorage', 'rb_plan');
    if (start) d.preferred_start = start;
    if (ref) d.referred_by = ref;
    if (plan && (!RB.PLANS || RB.PLANS[plan])) d.plan = plan;
    return d;
  }
  async function sendCode(){
    var opts = { shouldCreateUser: mode === 'signup', emailRedirectTo: (C.siteUrl || location.href.replace(/[^/]*$/, '')) + next };
    if (mode === 'signup') opts.data = signupData();
    var r;
    try { r = await RB.sb.auth.signInWithOtp({ email: email, options: opts }); } catch (e) { r = { error: e }; }
    if (r && r.error) return r.error;
    if (!r) return { message: 'empty response' };
    var now = Date.now();
    sentAt = now; tries = 0;
    saveOtp({ email: email, mode: mode, next: next, sentAt: now, resendAt: now + RESEND * 1000 });
    setJSON('localStorage', 'rb_next', { next: next, at: now });
    setRaw('localStorage', 'rb_last_email', email);
    return null;
  }

  var sending = false;
  $('authForm').addEventListener('submit', async function(e){
    e.preventDefault();
    if (!RB.sb || sending) return;
    email = emailIn.value.trim().toLowerCase();
    [].forEach.call(card.querySelectorAll('[aria-invalid]'), function(x){ x.removeAttribute('aria-invalid'); });
    hideHandoff();
    if (!EMAIL_RE.test(email)) { emailIn.setAttribute('aria-invalid', 'true'); emailIn.focus(); return say('Please enter a valid email address.', 'err'); }
    /* a likely typo stops the first press only; pressing again sends to the address as typed */
    if (typoFor !== email && checkTypo()) { $('typoBtn').focus(); return say('Check the address above, then send.', 'warn'); }
    if (mode === 'signup') {
      if (!$('su-name').value.trim()) { $('su-name').setAttribute('aria-invalid', 'true'); $('su-name').focus(); return say('Please add your name.', 'err'); }
      if (!$('su-biz').value.trim()) { $('su-biz').setAttribute('aria-invalid', 'true'); $('su-biz').focus(); return say('Please add your business name.', 'err'); }
      if (!$('terms').checked) { $('terms').focus(); return say('Please accept the terms and privacy policy to continue.', 'err'); }
    }
    var b = $('sendBtn'); sending = true; b.classList.add('loading'); b.setAttribute('aria-busy', 'true'); say('');
    var err = await sendCode();
    sending = false; b.classList.remove('loading'); b.removeAttribute('aria-busy');
    if (err) { showError(err, 'form', mode); return; }
    showCode(true);
  });

  $('haveCode').onclick = function(){
    var v = emailIn.value.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) { emailIn.setAttribute('aria-invalid', 'true'); emailIn.focus(); return say('Type the email address the code was sent to first.', 'err'); }
    email = v; sentAt = 0;
    var o = loadOtp(); if (o && o.email === v) { sentAt = o.sentAt; resendAt = o.resendAt; }
    showCode(false, true);
  };

  /* ---- the code field: one real input over six drawn cells ---- */
  var codeIn = $('code'), otp = $('otp'), cells = $('otpCells');
  codeIn.setAttribute('aria-label', LEN + '-digit code');
  function digits(){ return codeIn.value.replace(/\D/g, '').slice(0, 10); }
  function paint(){
    var d = digits(), n = Math.max(LEN, d.length), focused = document.activeElement === codeIn;
    if (cells.children.length !== n) { cells.innerHTML = new Array(n + 1).join('<span></span>'); otp.style.setProperty('--n', n); }
    [].forEach.call(cells.children, function(c, i){ c.textContent = d[i] || ''; c.className = (d[i] ? 'on' : '') + (focused && !codeIn.disabled && i === Math.min(d.length, n - 1) ? ' cur' : ''); });
  }
  function takeDigits(raw){
    var d = String(raw || '').replace(/\D/g, '').slice(0, 10);
    if (codeIn.value !== d) codeIn.value = d;
    try { codeIn.setSelectionRange(d.length, d.length); } catch (e) {}
    otp.classList.remove('bad');
    paint();
    if (d.length < LEN) lastAuto = '';
    else if (d.length === LEN && d !== lastAuto && !verifying) { lastAuto = d; verify(); }
  }
  codeIn.addEventListener('input', function(){ takeDigits(codeIn.value); });
  codeIn.addEventListener('paste', function(e){
    var t = (e.clipboardData || window.clipboardData); t = t && t.getData('text');
    if (t == null) return;
    e.preventDefault(); takeDigits(t);
  });
  codeIn.addEventListener('focus', function(){
    paint();
    var end = codeIn.value.length; try { codeIn.setSelectionRange(end, end); } catch (e) {}
    if (mq.compact.matches) { centre(); setTimeout(centre, 350); }
  });
  codeIn.addEventListener('blur', paint);
  function centre(){ if (document.activeElement !== codeIn) return; try { otp.scrollIntoView({ block: 'center', behavior: RB.reduced ? 'instant' : 'smooth' }); } catch (e) { otp.scrollIntoView(); } }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function(){ if (mq.compact.matches) centre(); });

  if (navigator.clipboard && navigator.clipboard.readText) {
    $('pasteBtn').hidden = false;
    $('pasteBtn').onclick = function(){
      navigator.clipboard.readText().then(function(t){
        if (!/\d{6}/.test(String(t).replace(/[\s-]/g, ''))) { say('There\'s no code on your clipboard. Copy it from the email first.', 'warn', $('codeMsg')); codeIn.focus(); return; }
        takeDigits(t); if (!verifying) codeIn.focus();
      }, function(){ say('Your browser didn\'t allow pasting. Press and hold the box to paste instead.', 'warn', $('codeMsg')); codeIn.focus(); });
    };
  }
  function mailLink(addr){
    var d = addr.split('@')[1] || '';
    if (/^(gmail|googlemail)\.com$/.test(d)) return ['https://mail.google.com/mail/u/0/#search/in%3Aanywhere+Ringback', 'Open Gmail'];
    if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(d)) return ['https://outlook.live.com/mail/0/', 'Open Outlook'];
    if (/^(yahoo|ymail)\.[a-z.]+$/.test(d)) return ['https://mail.yahoo.com/', 'Open Yahoo Mail'];
    return null;
  }
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp/i.test(navigator.userAgent || '') || navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  function showCode(fresh, typed){
    setView('code');
    showAddr($('sentTo'), email); showAddr($('neAddr'), email);
    $('sentLine').firstChild.nodeValue = typed ? 'For ' : 'Sent to ';
    var ml = mailLink(email), mb = $('mailBtn');
    mb.hidden = !ml; if (ml) { mb.href = ml[0]; mb.lastChild.textContent = ml[1]; }
    $('inAppLine').hidden = !inApp;
    codeIn.value = ''; codeIn.disabled = false; lastAuto = ''; otp.classList.remove('bad', 'ok'); paint();
    say(typed ? 'Enter the code from the newest email we sent to this address.' : '', '', $('codeMsg'));
    if (fresh) startResend(RESEND);
    else startResend(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    clearTimeout(helpTimer); $('noEmail').hidden = true;
    if (sentAt) helpTimer = setTimeout(showHelper, Math.max(0, sentAt + HELP_AFTER - Date.now()));
    codeIn.focus({ preventScroll: !mq.compact.matches });
  }
  /* long addresses break after the @ first, never mid-domain if it fits */
  function showAddr(el, a){ var i = a.indexOf('@'); el.innerHTML = i > 0 ? RB.esc(a.slice(0, i)) + '<wbr>' + RB.esc(a.slice(i)) : RB.esc(a); }
  function showHelper(){ if (view === 'code' && !done) $('noEmail').hidden = false; }
  function backToForm(){
    clearInterval(tick); clearTimeout(helpTimer); saveOtp(null);
    setView('form'); setMode(mode); if (email) emailIn.value = email; emailIn.focus();
  }
  $('backBtn').onclick = backToForm;
  $('neChange').onclick = backToForm;
  $('neWa').onclick = function(){ showHandoff('code', { code: 'no_email_after_75s' }); };

  async function verify(){
    if (verifying || done) return;
    var d = digits(), msg = $('codeMsg');
    if (d.length < 6 || d.length > 10) { codeIn.focus(); return say('Enter the ' + LEN + '-digit code from the email.', 'err', msg); }
    if (d.length !== LEN) console.info('Ringback: trying a ' + d.length + '-digit code, but config.otpLength is ' + LEN + '. Make config.otpLength match Supabase\'s Email OTP Length.');
    verifying = true; codeIn.disabled = true; paint();
    var b = $('verifyBtn'); b.classList.add('loading'); b.setAttribute('aria-busy', 'true'); say('Checking the code…', '', msg);
    var r;
    try { r = await RB.sb.auth.verifyOtp({ email: email, token: d, type: 'email' }); } catch (e) { r = { error: e }; }
    b.classList.remove('loading'); b.removeAttribute('aria-busy');
    if (r && r.error || !r) {
      verifying = false; codeIn.disabled = false; tries++;
      otp.classList.remove('bad'); void otp.offsetWidth; otp.classList.add('bad');
      showError(r ? r.error : {}, 'code', 'verify');
      codeIn.focus(); try { codeIn.select(); } catch (e) {}
      return;
    }
    success($('codeMsg'), next);
  }
  $('codeForm').addEventListener('submit', function(e){ e.preventDefault(); verify(); });

  function success(msgEl, dest){
    done = true; clearInterval(tick); clearTimeout(helpTimer);
    saveOtp(null); setJSON('localStorage', 'rb_next', null); setJSON('sessionStorage', 'rb_th', null);
    otp.classList.add('ok');
    msgEl.className = 'form-msg ok';
    msgEl.innerHTML = RB.icon('i-check') + '<span></span>';
    msgEl.lastChild.textContent = /^dashboard\.html/.test(dest) ? 'You\'re in. Taking you to your dashboard…' : 'You\'re in. Taking you back…';
    setTimeout(function(){ location.replace(dest); }, 600);
  }

  /* ---- resend ---- */
  function startResend(sec){
    var rb = $('resendBtn'), t = $('resendTimer');
    clearInterval(tick);
    resendAt = Date.now() + sec * 1000;
    var o = loadOtp(); if (o && o.email === email) { o.resendAt = resendAt; saveOtp(o); }
    var draw = function(){
      var left = Math.ceil((resendAt - Date.now()) / 1000);
      rb.disabled = left > 0; t.textContent = left > 0 ? '(in ' + left + 's)' : '';
      if (left <= 0) clearInterval(tick);
    };
    draw(); if (sec > 0) tick = setInterval(draw, 1000);
  }
  var resending = false;
  async function resend(){
    if (resending || !RB.sb) return;
    var left = Math.ceil((resendAt - Date.now()) / 1000);
    if (left > 0) return say('You can ask for a new code in ' + left + ' seconds.', 'warn', $('codeMsg'));
    resending = true; $('resendBtn').disabled = true; hideHandoff();
    var err = await sendCode();
    resending = false;
    if (err) { $('resendBtn').disabled = false; showError(err, 'code', mode); return; }
    startResend(RESEND);
    codeIn.value = ''; lastAuto = ''; paint();
    say('New code sent. Use the newest email.', 'ok', $('codeMsg'));
    clearTimeout(helpTimer); $('noEmail').hidden = true; helpTimer = setTimeout(showHelper, HELP_AFTER);
    codeIn.focus({ preventScroll: true });
  }
  $('resendBtn').onclick = resend;
  $('expiryLine').textContent = 'Codes last ' + MINS + ' minutes.';
  $('neExpiry').textContent = 'Codes last ' + MINS + ' minutes.';
  $('codeLead').textContent = 'Enter the ' + LEN + '-digit code from the email. If your email shows a button instead, tap it.';

  /* ---- handoff: we couldn't email a code, so take a number instead ---- */
  var hoHost = null, hoCtx = null;
  function showHandoff(where, err, why){
    var host = where === 'code' ? $('codeMsg') : $('formMsg'), h = $('handoff');
    hideHandoff();
    hoHost = host; hoCtx = err || {};
    host.textContent = ''; host.className = 'form-msg sr-only';
    host.textContent = $('hoTitle').textContent + (why ? ' ' + why : '');
    host.parentNode.insertBefore(h, host.nextSibling);
    $('hoForm').hidden = false; say('', '', $('hoMsg'));
    var ph = $('ho-phone'); if (!ph.value) ph.value = $('su-phone').value.trim();
    h.hidden = false;
    ['sendBtn', 'verifyBtn'].forEach(function(id){ $(id).classList.replace('btn-hot', 'btn-line'); });
    h.scrollIntoView({ block: 'nearest', behavior: RB.reduced ? 'auto' : 'smooth' });
  }
  function hideHandoff(){
    var h = $('handoff'); if (!h || h.hidden) return;
    h.hidden = true;
    if (hoHost) { hoHost.className = 'form-msg'; hoHost.textContent = ''; }
    ['sendBtn', 'verifyBtn'].forEach(function(id){ $(id).classList.replace('btn-line', 'btn-hot'); });
  }
  var hoSending = false;
  $('hoForm').addEventListener('submit', function(e){
    e.preventDefault();
    if (hoSending) return;
    var ph = $('ho-phone'), phone = ph.value.trim(), msg = $('hoMsg');
    ph.removeAttribute('aria-invalid');
    if (!/^[+\d][\d\s()-]{8,}$/.test(phone)) { ph.setAttribute('aria-invalid', 'true'); ph.focus(); return say('Please add a cellphone number we can reach you on.', 'err', msg); }
    if (!$('ho-ok').checked) { $('ho-ok').focus(); return say('Please tick the box so we can contact you.', 'err', msg); }
    var e2 = hoCtx || {}, plan = getRaw('sessionStorage', 'rb_plan'), start = getRaw('sessionStorage', 'rb_start');
    var name = $('su-name').value.trim(), biz = $('su-biz').value.trim(), trade = $('su-trade').value;
    var why = e2.code === 'no_email_after_75s' ? 'Code email not received (' + mode + ', nothing after 75s)' : 'Code email failed (' + mode + ', ' + (e2.status || '-') + '/' + (e2.code || '-') + ')';
    var row = { name: name, business: biz, trade: trade, phone: phone, email: email, source: 'signup_fallback',
      message: why + '.' + (plan ? ' Plan: ' + plan + '.' : '') + (start ? ' Start: ' + start + '.' : '') };
    var wa = RB.wa(waText('The login code email didn\'t reach me. My cell is ' + phone + '.'));
    var b = $('hoBtn'); hoSending = true; b.classList.add('loading'); b.setAttribute('aria-busy', 'true'); say('Sending…', '', msg);
    RB.lead(row).then(function(ok){
      hoSending = false; b.classList.remove('loading'); b.removeAttribute('aria-busy');
      $('hoForm').hidden = true;
      var first = name.split(' ')[0];
      say(ok ? 'Thanks' + (first ? ', ' + first : '') + '. We\'ll WhatsApp you.' : 'We couldn\'t save that just now. WhatsApp us instead: the button opens it with your details.', ok ? 'ok' : 'err', msg);
      actBtn(msg, 'WhatsApp us now', null, 'wa', wa);
    });
  });

  /* ---- tap to finish logging in ---- */
  var th = window.RB_TH || '';
  if (!th) { var st = getJSON('sessionStorage', 'rb_th'); if (st && /^[A-Za-z0-9_-]{20,200}$/.test(st.th) && Date.now() - st.at < 30 * 6e4) th = st.th; }
  if (params.get('th')) {
    var raw = params.get('th'); params.delete('th');
    try { history.replaceState(history.state, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) {}
    if (/^[A-Za-z0-9_-]{20,200}$/.test(raw)) th = raw;
  }
  function showFinish(){
    setView('finish');
    var b = $('finishBtn'), msg = $('finishMsg');
    if (!RB.sb) { b.disabled = true; say('We couldn\'t load the log-in system. Check your signal and reload this page.', 'err', msg); return; }
    b.onclick = async function(){
      if (b.classList.contains('loading') || done) return;
      b.classList.add('loading'); b.setAttribute('aria-busy', 'true'); say('', '', msg);
      var r;
      try { r = await RB.sb.auth.verifyOtp({ token_hash: th, type: 'email' }); } catch (e) { r = { error: e }; }
      b.classList.remove('loading'); b.removeAttribute('aria-busy');
      if (r && !r.error) {
        var n = getJSON('localStorage', 'rb_next'), dest = n && okNext(n.next) && Date.now() - n.at < KEEP ? n.next : 'dashboard.html';
        return success(msg, dest);
      }
      setJSON('sessionStorage', 'rb_th', null);
      var f = RB.authError(r ? r.error : {}, 'verify');
      say(f.text, f.kind, msg);
      b.hidden = true; $('finishNew').hidden = false; $('finishNew').focus();
    };
  }
  $('finishNew').onclick = function(){
    th = ''; setView('form'); setMode('login');
    var last = getRaw('localStorage', 'rb_last_email'); if (last && EMAIL_RE.test(last)) emailIn.value = last;
    emailIn.focus();
  };

  /* ---- already logged in ---- */
  function showIn(user){
    setView('in');
    showAddr($('inEmail'), (user && user.email) || 'your account');
    $('goDash').href = next;
    $('outBtn').onclick = async function(){
      var b = this; b.classList.add('loading');
      try { await RB.sb.auth.signOut({ scope: 'local' }); } catch (e) {}
      b.classList.remove('loading');
      setView('form'); setMode(mode); emailIn.value = ''; emailIn.focus();
    };
  }

  /* ---- notices ---- */
  function showNotice(){
    if (!notice) return;
    var n = $('noticeMsg');
    n.textContent = notice === 'session' ? 'You were logged out. Log in again to carry on.'
      : /expired|otp|invalid|access_denied/i.test(notice) ? 'That sign-in link has expired or was already used. Enter your email and we\'ll send you a new code.'
      : 'That sign-in link didn\'t work. Enter your email and we\'ll send you a new code.';
    n.hidden = false;
    if (location.hash && linkError()) try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  }

  /* ---- start ---- */
  setMode(mode);
  showNotice();
  if (params.get('check') === '1') {
    setView('check'); document.body.classList.add('is-check');
    var host = $('stepCheck');
    host.innerHTML = '<p class="muted">Loading the self-check…</p>';
    RB.loadScript('auth-check.js').then(function(){ RB.authCheck(host); }, function(){ host.innerHTML = '<p class="alert err">Couldn\'t load auth-check.js. Check the file is published next to login.html.</p>'; });
    return;
  }
  if (!RB.sb) {
    var w = $('cfgWarn');
    if (C.supabaseUrl && C.supabaseKey) w.textContent = 'We couldn\'t load the log-in system. Check your signal and reload this page, or WhatsApp us.';
    w.hidden = false; $('sendBtn').disabled = true; $('sendBtn').textContent = mode === 'signup' ? 'Create account' : 'Send me a code';
    if (th) showFinish(); else setView('form');
    return;
  }
  $('sendBtn').disabled = false; setMode(mode);
  if (th) { showFinish(); return; }

  function restoreOrForm(){
    if (view && view !== 'wait') return;
    var o = loadOtp(), q = (params.get('email') || '').trim().toLowerCase();
    if (o && (!q || q === o.email) && !notice) {
      email = o.email; sentAt = o.sentAt; resendAt = o.resendAt || 0;
      if (o.mode === 'signup' || o.mode === 'login') { mode = o.mode; setMode(mode); }
      if (!hasNext && okNext(o.next)) next = o.next;
      emailIn.value = email;
      return showCode(false);
    }
    setView('form');
  }
  if (RB.loggedIn && RB.loggedIn() || fromLink) {
    setView('wait');
    var giveUp = setTimeout(restoreOrForm, 6000);
    RB.sb.auth.getSession().then(function(r){
      clearTimeout(giveUp);
      var s = r && r.data && r.data.session;
      if (!s) return restoreOrForm();
      if (hasNext || fromLink) { location.replace(next); return; }
      if (view === 'wait') showIn(s.user);
    }, function(){ clearTimeout(giveUp); restoreOrForm(); });
  } else restoreOrForm();

  /* logged in from another tab, or by the link in the email while this page waited */
  try {
    RB.sb.auth.onAuthStateChange(function(ev, session){
      if (ev !== 'SIGNED_IN' || !session || done || verifying || (view !== 'form' && view !== 'code')) return;
      var msg = view === 'code' ? $('codeMsg') : $('formMsg');
      if (view === 'code') codeIn.disabled = true;
      success(msg, next);
    });
  } catch (e) {}
})();
