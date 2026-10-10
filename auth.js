/* Supabase client, session helpers and the log-in / sign-up page (email one-time code). */
(function(){
  var C = window.RB_CONFIG || {}, RB = window.RB;
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

  /* ---------------- log-in page ---------------- */
  var card = document.getElementById('auth');
  if (!card) return;
  var $ = function(id){ return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var mode = params.get('mode') === 'signup' ? 'signup' : 'login';
  var next = params.get('next') || 'dashboard.html';
  if (!/^[\w-]+\.html(\?[\w=&-]*)?(#[\w-]*)?$/.test(next)) next = 'dashboard.html';
  var notice = params.get('notice') || linkError();
  var LEN = C.otpLength || 6, email = '', timer = null;

  if (!RB.sb) { $('cfgWarn').hidden = false; $('sendBtn').disabled = true; }
  else RB.sb.auth.getSession().then(function(r){ if (r.data && r.data.session) location.replace(next); });

  if (params.get('trade')) { var ts = $('su-trade'); [].forEach.call(ts.options, function(o){ if (o.text === params.get('trade')) ts.value = o.value; }); }
  if (params.get('plan')) { try { sessionStorage.setItem('rb_plan', params.get('plan')); } catch (e) {} }

  function setMode(m){
    mode = m;
    $('tabLogin').setAttribute('aria-selected', m === 'login'); $('tabSignup').setAttribute('aria-selected', m === 'signup');
    $('signupFields').hidden = m !== 'signup'; $('termsRow').hidden = m !== 'signup';
    $('authTitle').textContent = m === 'signup' ? 'Create your account' : 'Welcome back';
    $('authSub').textContent = m === 'signup' ? 'Takes a minute. No password: we email you a code to confirm it\'s you.' : 'Enter your email and we\'ll send you a 6-digit code. No password needed.';
    $('sendBtn').textContent = m === 'signup' ? 'Create account' : 'Send me a code';
    $('switchLine').innerHTML = m === 'signup' ? 'Already have an account? <button type="button" class="linkbtn" id="switchBtn">Log in</button>' : 'New to Ringback? <button type="button" class="linkbtn" id="switchBtn">Create an account</button>';
    $('switchBtn').onclick = function(){ setMode(mode === 'signup' ? 'login' : 'signup'); };
    say('');
    var q = new URLSearchParams(location.search); if (m === 'signup') q.set('mode', 'signup'); else q.delete('mode');
    var qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }
  function say(text, kind, el){ el = el || $('formMsg'); el.className = 'form-msg ' + (kind || ''); el.textContent = text; }
  $('tabLogin').onclick = function(){ setMode('login'); };
  $('tabSignup').onclick = function(){ setMode('signup'); };
  setMode(mode);
  if (notice) {
    say(/expired|otp|invalid|access_denied/i.test(notice) ? 'That sign-in link has expired or was already used. Enter your email and we\'ll send you a new code.' : 'That sign-in link didn\'t work. Enter your email and we\'ll send you a new code.', 'warn');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  function friendly(err){
    var m = (err && (err.message || err.msg)) || '';
    if (/signups? not allowed|user not found|otp_disabled/i.test(m)) return { text: 'We couldn\'t find an account for that email.', action: 'signup' };
    if (/security purposes|only request this after|rate limit|too many/i.test(m)) return { text: 'Too many code requests. Please wait a minute, then try again.' };
    if (/not authorized|email address not authorized/i.test(m)) return { text: 'We\'re in early access and can\'t email that address yet. WhatsApp us and we\'ll set you up.', action: 'wa' };
    if (/invalid.*email|email.*invalid/i.test(m)) return { text: 'That email address doesn\'t look right.' };
    if (/expired|invalid|token/i.test(m)) return { text: 'That code is wrong or has expired. Check the email, or resend a new code.' };
    if (/fetch|network/i.test(m)) return { text: 'Couldn\'t reach the server. Check your connection and try again.' };
    return { text: m || 'Something went wrong. Please try again.' };
  }

  async function sendCode(isResend){
    var opts = { shouldCreateUser: mode === 'signup', emailRedirectTo: (C.siteUrl || location.href.replace(/[^/]*$/, '')) + next };
    if (mode === 'signup') opts.data = { full_name: $('su-name').value.trim(), business_name: $('su-biz').value.trim(), trade: $('su-trade').value, phone: $('su-phone').value.trim() };
    var r = await RB.sb.auth.signInWithOtp({ email: email, options: opts });
    if (r.error) return r.error;
    startResend();
    if (!isResend) showCode();
    return null;
  }

  $('authForm').addEventListener('submit', async function(e){
    e.preventDefault();
    if (!RB.sb) return;
    email = $('email').value.trim().toLowerCase();
    [].forEach.call(card.querySelectorAll('[aria-invalid]'), function(x){ x.removeAttribute('aria-invalid'); });
    if (mode === 'signup') {
      if (!$('su-name').value.trim()) { $('su-name').setAttribute('aria-invalid','true'); $('su-name').focus(); return say('Please add your name.', 'err'); }
      if (!$('su-biz').value.trim()) { $('su-biz').setAttribute('aria-invalid','true'); $('su-biz').focus(); return say('Please add your business name.', 'err'); }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('email').setAttribute('aria-invalid','true'); $('email').focus(); return say('Please enter a valid email address.', 'err'); }
    if (mode === 'signup' && !$('terms').checked) { $('terms').focus(); return say('Please accept the terms and privacy policy to continue.', 'err'); }
    var b = $('sendBtn'); b.classList.add('loading'); say('');
    var err = await sendCode(false);
    b.classList.remove('loading');
    if (err) {
      var f = friendly(err); say(f.text, 'err');
      if (f.action === 'signup') { var x = document.createElement('button'); x.type = 'button'; x.className = 'linkbtn'; x.textContent = ' Create an account instead'; x.onclick = function(){ setMode('signup'); $('su-name').focus(); }; $('formMsg').appendChild(x); }
      if (f.action === 'wa') { var a = document.createElement('a'); a.className = 'linkbtn'; a.href = RB.wa('Hi Ringback, I\'d like an account. My email is ' + email); a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' WhatsApp us'; $('formMsg').appendChild(a); }
    }
  });

  /* ---- code entry ---- */
  var otp = $('otp'); otp.style.setProperty('--len', LEN);
  for (var i = 0; i < LEN; i++) {
    var inp = document.createElement('input');
    inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = LEN; inp.autocomplete = i === 0 ? 'one-time-code' : 'off';
    inp.setAttribute('aria-label', 'Digit ' + (i + 1) + ' of ' + LEN); inp.pattern = '[0-9]*';
    otp.appendChild(inp);
  }
  var boxes = [].slice.call(otp.children);
  function code(){ return boxes.map(function(b){ return b.value; }).join(''); }
  function fillFrom(start, digits){
    digits.split('').forEach(function(d, k){ if (boxes[start + k]) boxes[start + k].value = d; });
    var nextBox = boxes[Math.min(start + digits.length, LEN - 1)]; nextBox.focus();
    if (code().length === LEN) verify();
  }
  boxes.forEach(function(b, idx){
    b.addEventListener('input', function(){
      otp.classList.remove('bad');
      var v = b.value.replace(/\D/g, '');
      if (v.length > 1) { b.value = ''; fillFrom(idx, v.slice(0, LEN - idx)); return; }
      b.value = v;
      if (v && idx < LEN - 1) boxes[idx + 1].focus();
      if (code().length === LEN) verify();
    });
    b.addEventListener('keydown', function(e){
      if (e.key === 'Backspace' && !b.value && idx > 0) { boxes[idx - 1].value = ''; boxes[idx - 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && idx > 0) boxes[idx - 1].focus();
      if (e.key === 'ArrowRight' && idx < LEN - 1) boxes[idx + 1].focus();
    });
    b.addEventListener('paste', function(e){
      var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (t) { e.preventDefault(); boxes.forEach(function(x){ x.value = ''; }); fillFrom(0, t.slice(0, LEN)); }
    });
    b.addEventListener('focus', function(){ b.select(); });
  });

  function showCode(){
    $('stepForm').hidden = true; $('stepCode').hidden = false;
    $('sentTo').textContent = email;
    boxes.forEach(function(x){ x.value = ''; }); boxes[0].focus();
    say('', '', $('codeMsg'));
  }
  $('backBtn').onclick = function(){ $('stepCode').hidden = true; $('stepForm').hidden = false; clearInterval(timer); $('email').focus(); };

  var verifying = false;
  async function verify(){
    if (verifying) return;
    var c = code(); if (c.length !== LEN) return say('Enter all ' + LEN + ' digits.', 'err', $('codeMsg'));
    verifying = true; var b = $('verifyBtn'); b.classList.add('loading');
    var r = await RB.sb.auth.verifyOtp({ email: email, token: c, type: 'email' });
    b.classList.remove('loading'); verifying = false;
    if (r.error) { otp.classList.remove('bad'); void otp.offsetWidth; otp.classList.add('bad'); return say(friendly(r.error).text, 'err', $('codeMsg')); }
    say('You\'re in. Taking you to your dashboard…', 'ok', $('codeMsg'));
    location.replace(next);
  }
  $('codeForm').addEventListener('submit', function(e){ e.preventDefault(); verify(); });

  function startResend(){
    var left = 60, rb = $('resendBtn'); rb.disabled = true; clearInterval(timer);
    $('resendTimer').textContent = '(in ' + left + 's)';
    timer = setInterval(function(){ left--; $('resendTimer').textContent = left > 0 ? '(in ' + left + 's)' : ''; if (left <= 0) { clearInterval(timer); rb.disabled = false; } }, 1000);
  }
  $('resendBtn').onclick = async function(){
    var err = await sendCode(true);
    if (err) say(friendly(err).text, 'err', $('codeMsg')); else { say('New code sent. Check your inbox.', 'ok', $('codeMsg')); boxes.forEach(function(x){ x.value = ''; }); boxes[0].focus(); }
  };
})();
