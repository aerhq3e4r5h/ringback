/* Owner self-check for log-in emails: login.html?check=1 loads this file. It is never linked from the site.
   RB.authCheck(host) renders five sections: config, auth server settings, a test send, an inbox checklist and a full
   code check. Raw server details stay inside collapsible blocks. Steps refer to supabase/AUTH-SETUP.md. */
(function(){
  var RB = window.RB, C = window.RB_CONFIG || {};
  var esc = function(s){ return RB.esc(s); };
  var TAG = { pass: ['mint', 'Pass'], fail: ['red', 'Fail'], look: ['amber', 'Look'] };
  var report = { config: [], server: [], send: [], inbox: {}, verify: [] };

  function row(state, title, detail){
    var t = TAG[state];
    return '<li class="ck-row"><span class="tag ' + t[0] + '">' + t[1] + '</span><div><b>' + esc(title) + '</b>' + (detail ? '<p>' + esc(detail) + '</p>' : '') + '</div></li>';
  }
  function raw(label, text){ return '<details><summary>' + esc(label) + '</summary><pre class="ck-raw">' + esc(text) + '</pre></details>'; }
  function note(list, state, title, detail){ list.push({ state: state, title: title, detail: detail || '' }); return row(state, title, detail); }

  RB.authCheck = function(host){
    var LEN = +C.otpLength || 6, MINS = +C.otpExpiryMinutes || 10;
    host.innerHTML =
      '<div class="ck">' +
      '<div class="auth-head"><span class="kicker">Owner tools · not linked anywhere</span><h1>Login <span class="hot">self-check</span></h1>' +
      '<p class="muted">Work through this after following <span class="mono">supabase/AUTH-SETUP.md</span>. Nothing here is shown to customers.</p></div>' +
      '<section class="ck-sec" id="ckConfig"><h2><small>A</small>Site config</h2><ul class="ck-rows"></ul></section>' +
      '<section class="ck-sec" id="ckServer"><h2><small>B</small>Auth server</h2><ul class="ck-rows"><li class="ck-row"><span class="tag">…</span><div><b>Asking Supabase for its email settings…</b></div></li></ul></section>' +
      '<section class="ck-sec" id="ckSend"><h2><small>C</small>Send a test code</h2>' +
        '<p>Use an inbox you can open on your phone. Supabase allows one code per address per minute.</p>' +
        '<form class="form" id="ckSendForm" novalidate onsubmit="return false">' +
          '<label class="fld"><span>Email address</span><input id="ckEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="200" placeholder="you@yourdomain.co.za"></label>' +
          '<label class="check"><input type="checkbox" id="ckCreate"><span>This creates an account (tick it for an address that has never logged in)</span></label>' +
          '<button class="btn btn-hot btn-block" type="submit" id="ckSendBtn">Send a test code</button>' +
        '</form><div id="ckSendOut" aria-live="polite"></div></section>' +
      '<section class="ck-sec" id="ckInbox"><h2><small>D</small>Inbox checklist</h2><p>Check on Gmail (Android), iPhone Mail and the Outlook app. Each No shows its fix.</p><div id="ckQs"></div></section>' +
      '<section class="ck-sec" id="ckVerify"><h2><small>E</small>Prove the whole path</h2>' +
        '<p>Type the code from the test email. This logs this device in as that address.</p>' +
        '<form class="form" id="ckVerifyForm" novalidate onsubmit="return false">' +
          '<label class="fld"><span>Code from the email</span><input id="ckCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="' + new Array(LEN + 1).join('0') + '"></label>' +
          '<button class="btn btn-line btn-block" type="submit" id="ckVerifyBtn">Check the code</button>' +
        '</form><div id="ckVerifyOut" aria-live="polite"></div></section>' +
      '<div class="ck-acts"><button class="btn btn-line" type="button" id="ckCopy">' + RB.icon('i-copy') + 'Copy report</button><a class="btn btn-ghost" href="login.html">Back to log in</a></div>' +
      '</div>';
    var $ = function(id){ return document.getElementById(id); };

    /* (a) config */
    (function(){
      var out = [], L = report.config = [];
      var url = C.supabaseUrl || '', key = C.supabaseKey || '';
      out.push(/^https:\/\/[\w.-]+$/.test(url) ? note(L, 'pass', 'Supabase URL is set', url) : note(L, 'fail', 'Supabase URL is missing or odd', 'config.js → supabaseUrl: ' + (url || '(empty)')));
      if (!key) out.push(note(L, 'fail', 'Supabase key is missing', 'config.js → supabaseKey'));
      else if (/^sb_secret_|service_role/.test(key)) out.push(note(L, 'fail', 'That is a SECRET key', 'Never put the secret or service_role key in config.js. Use the publishable key, and rotate the secret one now.'));
      else out.push(note(L, 'pass', 'Supabase key is set', key.slice(0, 16) + '…'));
      out.push(RB.sb ? note(L, 'pass', 'supabase-js loaded', 'The page created its client.') : note(L, 'fail', 'supabase-js did not load', 'The CDN script was blocked or failed. Reload, or try another network.'));
      out.push(LEN >= 6 && LEN <= 10 ? note(L, 'pass', 'config.otpLength is ' + LEN, 'Must equal Supabase → Email OTP Length (step 8).') : note(L, 'fail', 'config.otpLength is ' + C.otpLength, 'Use a number from 6 to 10 that equals Email OTP Length.'));
      out.push(note(L, MINS === 10 ? 'pass' : 'look', 'config.otpExpiryMinutes is ' + MINS, 'Must match Email OTP Expiration (' + MINS * 60 + ' seconds) and the FAQ wording (10 minutes).'));
      var site = C.siteUrl || '', here = location.href.replace(/[?#].*$/, '');
      out.push(site && here.indexOf(site) === 0 ? note(L, 'pass', 'You are on config.siteUrl', site)
        : note(L, 'look', 'This page isn\'t on config.siteUrl', 'You are on ' + location.origin + location.pathname + '; config.siteUrl is ' + (site || '(empty)') + '. The button in the email goes to the live site, so test there too.'));
      $('ckConfig').querySelector('.ck-rows').innerHTML = out.join('');
    })();

    /* (b) auth server settings */
    (function(){
      var box = $('ckServer'), L = report.server = [];
      if (!C.supabaseUrl || !C.supabaseKey) { box.querySelector('.ck-rows').innerHTML = note(L, 'fail', 'Skipped', 'Fix the config first.'); return; }
      var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function(){ if (ctl) ctl.abort(); }, 10000), url = C.supabaseUrl.replace(/\/$/, '') + '/auth/v1/settings';
      fetch(url, { headers: { apikey: C.supabaseKey }, signal: ctl && ctl.signal }).then(function(r){
        return r.text().then(function(t){ return { status: r.status, text: t }; });
      }).then(function(res){
        clearTimeout(timer);
        var j = null; try { j = JSON.parse(res.text); } catch (e) {}
        var out = [];
        if (res.status !== 200 || !j) {
          out.push(note(L, 'fail', 'Supabase answered ' + res.status, res.status === 401 ? 'The key was refused. Copy the publishable key again (Project Settings → API Keys).' : 'See the raw answer below.'));
        } else {
          var em = j.external && j.external.email;
          out.push(em ? note(L, 'pass', 'Email login is on', 'external.email = true') : note(L, 'fail', 'Email login is off', 'Authentication → Sign In / Providers → Email → enable it (step 8).'));
          out.push(j.disable_signup ? note(L, 'look', 'New sign-ups are closed', 'disable_signup = true. New customers can\'t create accounts until "Allow new users to sign up" is on.') : note(L, 'pass', 'Sign-ups are open', 'disable_signup = false'));
          out.push(j.mailer_autoconfirm ? note(L, 'look', 'Confirm email is off', 'mailer_autoconfirm = true. Turn "Confirm email" on (step 8) so new addresses are checked with a code.') : note(L, 'pass', 'Confirm email is on', 'mailer_autoconfirm = false'));
        }
        box.querySelector('.ck-rows').innerHTML = out.join('');
        box.insertAdjacentHTML('beforeend', raw('Raw answer from ' + url, 'HTTP ' + res.status + '\n' + (j ? JSON.stringify(j, null, 2) : res.text.slice(0, 2000))));
      }).catch(function(e){
        clearTimeout(timer);
        box.querySelector('.ck-rows').innerHTML = note(L, 'fail', 'Couldn\'t reach the auth server', 'No answer from ' + url + '. Check your signal, and that the project isn\'t paused in Supabase.');
        box.insertAdjacentHTML('beforeend', raw('Raw error', String(e && e.message || e)));
      });
    })();

    /* (c) send a test code */
    var testEmail = '';
    try { $('ckEmail').value = localStorage.getItem('rb_last_email') || ''; } catch (e) {}
    $('ckSendForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var out = $('ckSendOut'), b = $('ckSendBtn'), L = report.send = [];
      var em = $('ckEmail').value.trim().toLowerCase(), create = $('ckCreate').checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { out.innerHTML = '<p class="form-msg err">Type a full email address.</p>'; $('ckEmail').focus(); return; }
      if (!RB.sb) { out.innerHTML = '<p class="form-msg err">supabase-js didn\'t load, so nothing can be sent from this page.</p>'; return; }
      testEmail = em; b.classList.add('loading'); out.innerHTML = '';
      var t0 = Date.now(), r;
      try { r = await RB.sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: create } }); } catch (x) { r = { error: x }; }
      b.classList.remove('loading');
      var ms = Date.now() - t0, er = r && r.error, html = '';
      if (!er) {
        try { localStorage.setItem('rb_last_email', em); } catch (x) {}
        html = '<ul class="ck-rows">' + note(L, 'pass', 'Supabase accepted the request (' + ms + ' ms)', 'That only means Supabase handed it to your mail provider. Now check the inbox for ' + em + ' and answer the checklist below.') + '</ul>';
      } else {
        var code = er.code || '', status = er.status || 0, msg = er.message || String(er), d = diagnose(code, status, msg, create);
        html = '<ul class="ck-rows">' + note(L, 'fail', d[0], d[1]) + '</ul>' +
          raw('Raw answer', 'status: ' + (status || '-') + '\ncode: ' + (code || '-') + '\nmessage: ' + msg + '\ntime: ' + ms + ' ms\nshouldCreateUser: ' + create);
      }
      out.innerHTML = html;
    });
    function diagnose(code, status, msg, create){
      var wait = msg.match(/after (\d+) seconds?/i);
      if (code === 'email_address_not_authorized' || /not authori[sz]ed/i.test(msg)) return ['Still on Supabase\'s built-in mailer', 'It only emails your project team. Set up custom SMTP: steps 3–5 (Authentication → Emails → SMTP Settings).'];
      if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return ['The hourly email cap is used up', 'Wait an hour, or raise it under Authentication → Rate Limits (step 9). On the built-in mailer the cap is tiny: set up SMTP first.'];
      if (wait || code === 'over_request_rate_limit') return ['Too soon for this address', 'Wait ' + (wait ? wait[1] : '60') + ' seconds, then send again. This is the minimum interval in SMTP Settings (step 5).'];
      if (status >= 500 || code === 'unexpected_failure' || /error sending|smtp/i.test(msg)) return ['Your mail provider refused the email', 'Usually the SMTP username or password is wrong, or the sender address isn\'t on a verified domain. Check SMTP Settings (step 5) and the provider\'s own log (steps 3–4).'];
      if (code === 'otp_disabled' || code === 'signup_disabled' || /signups? not allowed/i.test(msg)) return [create ? 'Sign-ups or email codes are switched off' : 'No account for this address, or email codes are switched off', (create ? '' : 'If this address has never logged in, tick "This creates an account" and send again. Otherwise: ') + 'check Authentication → Sign In / Providers → Email, and "Allow new users to sign up" (step 8).'];
      if (code === 'captcha_failed' || /captcha/i.test(msg)) return ['CAPTCHA protection is on', 'Turn it off under Authentication → Attack Protection (step 10). The log-in page sends no captcha token.'];
      if (code === 'email_address_invalid' || /invalid/i.test(msg)) return ['Supabase rejected the address', 'Check the spelling. Some providers also refuse test domains like example.com.'];
      if (!status) return ['Couldn\'t reach Supabase', 'Check your signal and try again.'];
      return ['Unexpected answer', 'See the raw answer below, and WhatsApp it to us with the copied report.'];
    }

    /* (d) inbox checklist */
    var QS = [
      ['arrived', 'Did it arrive within 2 minutes?', 'Look in the provider\'s log (Resend → Emails, Brevo → Transactional → Logs). Not there: SMTP Settings are wrong (step 5). There but not in your inbox: check spam and the DNS records (step 4).'],
      ['inbox', 'Was it in the inbox, not spam?', 'Add the provider\'s SPF and DKIM records and DMARC p=none (step 4), send from your own domain, and mark it "Not spam" once.'],
      ['code', 'Does it show a code, not just a link?', 'Paste both templates (step 6). Supabase sends "Confirm signup" to new addresses and "Magic Link" to returning ones, so both need {{ .Token }}.'],
      ['digits', 'Is the code ' + LEN + ' digits?', 'Set Email OTP Length to ' + LEN + ' (step 8), or change config.otpLength to match it.'],
      ['from', 'Is it from your domain?', 'Set the sender email in SMTP Settings to login@yourdomain.co.za and the name to Ringback (step 5).'],
      ['preview', 'Does the phone\'s notification preview show the code?', 'The new templates start with a hidden line that puts the code first. Paste them again (step 6), without editing the top.'],
      ['button', 'Does the button open "Finish logging in"?', 'Set Site URL and Redirect URLs (step 7), and keep the button link in the template exactly as supplied.']
    ];
    $('ckQs').innerHTML = QS.map(function(q){
      return '<div class="ck-q" data-q="' + q[0] + '"><span>' + esc(q[1]) + '</span><div class="seg seg-sm" role="group" aria-label="' + esc(q[1]) + '"><button type="button" aria-pressed="false" data-a="yes">Yes</button><button type="button" aria-pressed="false" data-a="no">No</button></div><p class="fix" hidden>' + esc(q[2]) + '</p></div>';
    }).join('');
    [].forEach.call($('ckQs').querySelectorAll('.ck-q'), function(el){
      RB.seg(el.querySelector('.seg'));
      el.addEventListener('click', function(e){
        var b = e.target.closest('button[data-a]'); if (!b) return;
        [].forEach.call(el.querySelectorAll('button[data-a]'), function(x){ x.setAttribute('aria-pressed', x === b); });
        el.querySelector('.fix').hidden = b.dataset.a !== 'no';
        report.inbox[el.dataset.q] = b.dataset.a;
      });
    });

    /* (e) prove the path */
    $('ckVerifyForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var out = $('ckVerifyOut'), b = $('ckVerifyBtn'), L = report.verify = [];
      var em = testEmail || $('ckEmail').value.trim().toLowerCase(), code = $('ckCode').value.replace(/\D/g, '');
      if (!em) { out.innerHTML = '<p class="form-msg err">Send a test code first (section C).</p>'; return; }
      if (code.length < 6 || code.length > 10) { out.innerHTML = '<p class="form-msg err">Type the ' + LEN + '-digit code from the email.</p>'; $('ckCode').focus(); return; }
      if (!RB.sb) return;
      b.classList.add('loading'); out.innerHTML = '';
      var r; try { r = await RB.sb.auth.verifyOtp({ email: em, token: code, type: 'email' }); } catch (x) { r = { error: x }; }
      b.classList.remove('loading');
      if (r && !r.error) {
        out.innerHTML = '<ul class="ck-rows">' + note(L, 'pass', 'The whole path works', 'Logged in as ' + em + ' with a ' + code.length + '-digit code.' + (code.length !== LEN ? ' config.otpLength is ' + LEN + ': make them match.' : '')) + '</ul>' +
          '<div class="ck-acts"><button class="btn btn-line" type="button" id="ckOut">' + RB.icon('i-logout') + 'Log out of the test session</button></div>';
        $('ckOut').onclick = async function(){ try { await RB.sb.auth.signOut({ scope: 'local' }); } catch (x) {} this.disabled = true; this.textContent = 'Logged out on this device'; };
      } else {
        var er = (r && r.error) || {};
        out.innerHTML = '<ul class="ck-rows">' + note(L, 'fail', 'The code was refused', 'Use the newest email, within ' + MINS + ' minutes. If the email shows ' + (LEN === 6 ? '8' : '6') + ' digits, Email OTP Length and config.otpLength differ (step 8).') + '</ul>' +
          raw('Raw answer', 'status: ' + (er.status || '-') + '\ncode: ' + (er.code || '-') + '\nmessage: ' + (er.message || String(er)));
      }
    });

    /* copy report: plain text for WhatsApp */
    $('ckCopy').onclick = function(){
      var line = function(x){ return '- ' + x.state.toUpperCase() + ': ' + x.title + (x.detail ? ' (' + x.detail + ')' : ''); };
      var t = ['Ringback login self-check', new Date().toString().slice(0, 24), location.origin + location.pathname, '',
        'A. Config', report.config.map(line).join('\n'), '',
        'B. Auth server', (report.server.map(line).join('\n') || '- not finished'), '',
        'C. Test send' + (testEmail ? ' to ' + testEmail : ''), (report.send.map(line).join('\n') || '- not run'), '',
        'D. Inbox checklist', QS.map(function(q){ return '- ' + q[1] + ' ' + (report.inbox[q[0]] ? report.inbox[q[0]].toUpperCase() : 'not answered'); }).join('\n'), '',
        'E. Code check', (report.verify.map(line).join('\n') || '- not run')].join('\n');
      RB.copy(t, this);
    };
  };
})();
