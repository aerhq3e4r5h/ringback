/* 'Rather we set it up with you?': a three-step request sheet. Loaded on demand by site.js for [data-setup-call].
   RB.openSetupCall({source, trade}) -> sends one row to the leads table through RB.lead (source 'setup_call').
   No calendar slots or availability: we WhatsApp or call back to agree a time. */
(function(){
  var RB = window.RB, C = window.RB_CONFIG || {};
  if (!RB) return;
  var NETWORKS = ['Vodacom', 'MTN', 'Cell C', 'Telkom', 'Not sure'];
  var WANTS = [['forwarding', 'Set up call forwarding with me'], ['questions', 'Answer my questions first'], ['trial', 'Start my free trial']];
  var TIMES = ['Weekday morning', 'Weekday afternoon', 'Saturday morning', 'Any time'];
  var n = 0;

  RB.openSetupCall = function(opts){
    opts = opts || {};
    var id = 'sc' + (++n), step = 0;
    var radios = function(name, list, checked){
      return list.map(function(v){ var val = Array.isArray(v) ? v[0] : v, lab = Array.isArray(v) ? v[1] : v;
        return '<label><input type="radio" name="' + name + '" value="' + RB.esc(val) + '"' + (val === checked ? ' checked' : '') + '><span>' + RB.esc(lab) + '</span></label>'; }).join('');
    };
    var trades = RB.TRADES.map(function(t){ return '<label><input type="radio" name="trade" value="' + t.key + '"' + (t.key === opts.trade ? ' checked' : '') + '><span>' + RB.icon(t.icon) + RB.esc(t.label) + '</span></label>'; }).join('');
    var html =
      '<form class="form sc" id="' + id + '" onsubmit="return false" novalidate>' +
        '<div class="sc-head"><h2 class="h-md" id="' + id + 'h">Rather we set it up with you?</h2>' +
        '<p class="muted">Three quick steps. We\'ll get back to you within one working day to agree a time.</p>' +
        '<ol class="sc-dots" aria-label="Steps"><li aria-current="step"><span class="sr-only">Step </span>1<span class="sr-only"> of 3: your trade</span></li><li><span class="sr-only">Step </span>2<span class="sr-only"> of 3: what would help</span></li><li><span class="sr-only">Step </span>3<span class="sr-only"> of 3: your details</span></li></ol></div>' +
        '<fieldset class="sc-step" data-s="0">' +
          '<legend class="sr-only">Step 1 of 3</legend>' +
          '<div class="bfs"><p class="sc-l" id="' + id + 't">Your trade</p><div class="bchips bchips--trade" role="radiogroup" aria-labelledby="' + id + 't">' + trades + '</div></div>' +
          '<div class="bfs"><p class="sc-l" id="' + id + 'n">Your cellphone network</p><div class="bchips" role="radiogroup" aria-labelledby="' + id + 'n">' + radios('network', NETWORKS) + '</div>' +
          '<p class="faint sc-hint">Forwarding codes can differ slightly between networks.</p></div>' +
          '<div class="sc-nav"><button class="btn btn-hot" type="button" data-next>Next <svg aria-hidden="true"><use href="#i-arrow"/></svg></button></div>' +
        '</fieldset>' +
        '<fieldset class="sc-step" data-s="1" hidden>' +
          '<legend class="sr-only">Step 2 of 3</legend>' +
          '<div class="bfs"><p class="sc-l">What would help?</p><div class="sc-checks">' +
            WANTS.map(function(w){ return '<label class="check"><input type="checkbox" name="want" value="' + w[0] + '"' + (w[0] === 'forwarding' ? ' checked' : '') + '>' + w[1] + '</label>'; }).join('') + '</div></div>' +
          '<div class="bfs"><p class="sc-l" id="' + id + 'b">Best time to reach you</p><div class="bchips" role="radiogroup" aria-labelledby="' + id + 'b">' + radios('best', TIMES, 'Any time') + '</div></div>' +
          '<div class="bfs"><p class="sc-l" id="' + id + 'c">Contact me by</p><div class="bchips" role="radiogroup" aria-labelledby="' + id + 'c">' + radios('via', ['WhatsApp', 'Phone call'], 'WhatsApp') + '</div></div>' +
          '<div class="sc-nav"><button class="btn btn-line" type="button" data-back><svg aria-hidden="true"><use href="#i-back"/></svg>Back</button><button class="btn btn-hot" type="button" data-next>Next <svg aria-hidden="true"><use href="#i-arrow"/></svg></button></div>' +
        '</fieldset>' +
        '<fieldset class="sc-step" data-s="2" hidden>' +
          '<legend class="sr-only">Step 3 of 3</legend>' +
          '<label class="fld"><span>Your name <i class="req" aria-hidden="true">*</i></span><input name="name" autocomplete="name" maxlength="120" required aria-describedby="' + id + 'e-name"><small class="form-msg err" id="' + id + 'e-name"></small></label>' +
          '<label class="fld"><span>Business name</span><input name="business" autocomplete="organization" maxlength="120"></label>' +
          '<label class="fld"><span>Cellphone <i class="req" aria-hidden="true">*</i></span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="30" required aria-describedby="' + id + 'e-phone"><small class="form-msg err" id="' + id + 'e-phone"></small></label>' +
          '<label class="fld"><span>Email <small>(optional)</small></span><input name="email" type="email" autocomplete="email" maxlength="200" aria-describedby="' + id + 'e-email"><small class="form-msg err" id="' + id + 'e-email"></small></label>' +
          '<label class="check"><input type="checkbox" name="consent" required aria-describedby="' + id + 'e-consent">You can contact me about Ringback <i class="req" aria-hidden="true">*</i></label><small class="form-msg err" id="' + id + 'e-consent"></small>' +
          '<div class="sc-nav"><button class="btn btn-line" type="button" data-back><svg aria-hidden="true"><use href="#i-back"/></svg>Back</button><button class="btn btn-hot" type="submit" data-send>Send my request</button></div>' +
          '<p class="form-msg" role="status" aria-live="polite" data-msg></p>' +
        '</fieldset>' +
      '</form>';
    var sh = RB.sheet({ label: 'Setup call', html: html, size: RB.mq.compact.matches ? 'full' : 'md' });
    var form = sh.body.querySelector('form'), E = form.elements;
    var steps = form.querySelectorAll('.sc-step'), dots = form.querySelectorAll('.sc-dots li');

    function go(i){
      step = i;
      [].forEach.call(steps, function(s, k){ s.hidden = k !== i; });
      [].forEach.call(dots, function(d, k){ if (k === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); d.classList.toggle('done', k < i); });
      sh.body.scrollTop = 0;
      var f = steps[i].querySelector('input:checked, input, button');
      if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    }
    var val = function(name){ var c = form.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; };
    var err = function(name, msg){ var inp = E[name], m = sh.body.querySelector('#' + id + 'e-' + name); if (m) m.textContent = msg || ''; if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg; };
    function check(){
      var ok = true, first = null;
      var mark = function(name, msg){ if (!err(name, msg)) { ok = false; if (!first) first = E[name]; } };
      mark('name', E.name.value.trim().length >= 2 ? '' : 'Please add your name.');
      var digits = E.phone.value.replace(/\D/g, '');
      mark('phone', digits.length >= 9 && digits.length <= 13 ? '' : 'Please add a cellphone number we can reach, e.g. 082 123 4567.');
      var em = E.email.value.trim();
      mark('email', !em || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? '' : 'That email doesn\'t look right. Leave it empty if you prefer.');
      mark('consent', E.consent.checked ? '' : 'Please tick this so we may contact you.');
      if (first) first.focus();
      return ok;
    }
    function message(){
      var wants = [].filter.call(form.querySelectorAll('input[name=want]:checked'), Boolean).map(function(c){ return c.value; });
      var t = RB.tradeByKey(val('trade'));
      return {
        text: 'Network: ' + (val('network') || 'Not sure') + ' · Wants: ' + (wants.join(', ') || 'a chat') + ' · Best: ' + (val('best') || 'Any time').toLowerCase() + ' · Contact: ' + (val('via') || 'WhatsApp') + ' · From: ' + (opts.source || document.body.dataset.page || 'site'),
        trade: t ? t.label : ''
      };
    }
    function waText(m){
      return 'Hi Ringback, I\'d like help setting up.\nName: ' + E.name.value.trim() + (E.business.value.trim() ? '\nBusiness: ' + E.business.value.trim() : '') + (m.trade ? '\nTrade: ' + m.trade : '') + '\n' + m.text.replace(/ · /g, '\n');
    }

    form.addEventListener('click', function(e){
      if (e.target.closest('[data-next]')) go(Math.min(2, step + 1));
      else if (e.target.closest('[data-back]')) go(Math.max(0, step - 1));
    });
    form.addEventListener('input', function(e){ if (e.target.getAttribute('aria-invalid') === 'true') err(e.target.name, ''); });
    form.addEventListener('change', function(e){ if (e.target.name === 'consent' && e.target.checked) err('consent', ''); });
    form.addEventListener('submit', function(){
      if (step !== 2 || !check()) return;
      var btn = form.querySelector('[data-send]'), msg = form.querySelector('[data-msg]'), m = message();
      btn.classList.add('loading'); btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Sending…';
      RB.lead({ name: E.name.value, business: E.business.value, trade: m.trade, phone: E.phone.value, email: E.email.value, source: 'setup_call', message: m.text }).then(function(ok){
        btn.classList.remove('loading'); btn.disabled = false;
        var first = RB.esc(E.name.value.trim().split(/\s+/)[0]), wa = RB.wa(waText(m));
        if (ok) {
          sh.body.innerHTML = '<div class="sc-done" tabindex="-1"><span class="ic mint">' + RB.icon('i-check') + '</span>' +
            '<h2 class="h-md">Thanks, ' + first + '.</h2>' +
            '<p class="muted">We\'ll ' + (val('via') === 'Phone call' ? 'call' : 'WhatsApp') + ' you within one working day to confirm a time.</p>' +
            '<div class="sc-nav sc-nav--col"><a class="btn btn-line" href="' + wa + '" target="_blank" rel="noopener">' + RB.icon('i-wa') + 'WhatsApp us now</a>' +
            '<a class="btn btn-line" href="build.html">Meanwhile, preview your assistant ' + RB.icon('i-arrow') + '</a></div></div>';
          sh.body.firstChild.focus();
        } else {
          msg.className = 'form-msg err';
          msg.innerHTML = 'We couldn\'t send that just now. Send the same details on WhatsApp instead: ';
          var a = document.createElement('a'); a.className = 'btn btn-hot btn-block mt-s'; a.href = wa; a.target = '_blank'; a.rel = 'noopener';
          a.innerHTML = RB.icon('i-wa') + 'Send on WhatsApp'; msg.appendChild(a);
          a.focus();
        }
      });
    });
    go(0);
    return sh;
  };
})();
