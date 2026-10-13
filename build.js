/* Build your assistant (build.html): a live preview of the wording, filled with the visitor's own details.
   Writes localStorage rb_draft exactly as the contract at the top of site.js says; login (sign-up) and the portal read it.
   Wording comes from scenarios.js (RB.renderScenario). Nothing leaves the device until the visitor creates an account. */
(function(){
  var RB = window.RB, form = document.getElementById('bldForm');
  if (!RB || !form || !RB.renderScenario) return;
  var $ = function(id){ return document.getElementById(id); };
  var E = form.elements, key = 'emergency', timer;
  var TEXT = ['business_name', 'owner_name', 'service_areas', 'callout_weekday', 'callout_after'];
  var PROMISES = ['10', '15', '20', '30', '60'];

  /* trade chips, one radio per RB.TRADES entry (the draft stores the label, as the portal's select does) */
  $('bTrade').innerHTML = RB.TRADES.map(function(t){
    return '<label><input type="radio" name="trade" value="' + t.key + '"><span>' + RB.icon(t.icon) + RB.esc(t.label) + '</span></label>';
  }).join('');

  var radio = function(name){ var c = form.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; };
  var setRadio = function(name, v){ var r = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; };
  var areasOf = function(s){ return String(s || '').split(',').map(function(a){ return a.trim(); }).filter(Boolean); };

  function fields(){
    var t = RB.tradeByKey(radio('trade')) || RB.TRADES[0], f = {};
    TEXT.forEach(function(n){ f[n] = E[n].value.trim(); });
    f.service_areas = areasOf(f.service_areas).join(', ');
    f.trade = t.label;
    f.after_hours = radio('after_hours') === 'no' ? 'no' : 'yes';
    f.callback_promise = PROMISES.indexOf(E.callback_promise.value) > -1 ? E.callback_promise.value : '15';
    f.booking = radio('booking') === 'callback' ? 'callback' : 'calendar';
    return { business_name: f.business_name, owner_name: f.owner_name, trade: f.trade, service_areas: f.service_areas, callout_weekday: f.callout_weekday, callout_after: f.callout_after, after_hours: f.after_hours, callback_promise: f.callback_promise, booking: f.booking };
  }
  function save(){
    try { localStorage.setItem('rb_draft', JSON.stringify({ v: 1, savedAt: new Date().toISOString(), fields: fields() })); } catch (e) {}
  }

  /* ---------- preview ---------- */
  function render(){
    var f = fields(), t = RB.tradeByKey(radio('trade')) || RB.TRADES[0], areas = areasOf(f.service_areas);
    var d = {
      biz: f.business_name || '[your business]', owner: f.owner_name || 'the owner', fee: f.callout_weekday || '[your call-out fee]',
      after: f.callout_after, suburb: areas[0] || '[your suburb]', areas: areas.length ? areas.join(', ') : '[your suburbs]',
      promise: f.callback_promise, after_hours: f.after_hours, booking: f.booking
    };
    var r = RB.renderScenario(t, key, d);
    $('bLines').innerHTML = RB.scenarioLines(r.lines);
    $('bTags').innerHTML = RB.scenarioTags(r.tags);
    $('bSms').innerHTML = RB.scenarioSms(r.sms, 'Example caller · ' + d.suburb);
    $('bSmsBar').textContent = 'Example · SMS ' + (r.sms ? r.sms.label.toLowerCase() : 'alert') + ' to you';
    $('bAreas').innerHTML = areas.slice(0, 12).map(function(a){ return '<span class="tag">' + RB.esc(a) + '</span>'; }).join('');
    $('bRules').innerHTML = [
      'Quotes your call-out fee only',
      areas.length ? 'Books in your ' + areas.length + ' suburb' + (areas.length > 1 ? 's' : '') : 'Books in your suburbs',
      f.after_hours === 'no' ? 'After hours: takes a message' : 'After hours: alerts you',
      'Calls back within ' + f.callback_promise + ' min',
      "Says it's an AI if asked"
    ].map(function(x){ return '<span class="tag">' + RB.esc(x) + '</span>'; }).join('');
    $('bWa').href = RB.wa(summary(f));
  }
  function summary(f){
    var L = ['Hi Ringback, here are my details for an assistant:', 'Business: ' + (f.business_name || '-')];
    if (f.owner_name) L.push('Name: ' + f.owner_name);
    L.push('Trade: ' + f.trade);
    if (f.service_areas) L.push('Suburbs: ' + f.service_areas);
    if (f.callout_weekday) L.push('Call-out fee (weekdays): ' + f.callout_weekday);
    if (f.callout_after) L.push('Call-out fee (after hours): ' + f.callout_after);
    L.push('After-hours urgent call-outs: ' + (f.after_hours === 'yes' ? 'yes' : 'no, take a message'));
    L.push('Call back within: ' + f.callback_promise + ' minutes');
    L.push('Routine jobs: ' + (f.booking === 'calendar' ? 'book into my calendar' : 'take a callback'));
    return L.join('\n');
  }
  /* 150ms debounce while typing; instant on phones and with reduced motion */
  var instant = function(){ return RB.reduced || RB.mq.compact.matches; };
  function changed(){
    save();
    clearTimeout(timer);
    if (instant()) render(); else timer = setTimeout(render, 150);
  }
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);

  /* preview tabs */
  var seg = document.querySelector('.bld-seg');
  seg.addEventListener('click', function(e){
    var b = e.target.closest('button[data-k]'); if (!b) return;
    key = b.getAttribute('data-k');
    [].forEach.call(seg.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    render();
  });
  RB.seg(seg);

  /* the 'See your preview' button (phones): move focus with the scroll */
  form.querySelector('.bld-jump').addEventListener('click', function(e){
    e.preventDefault();
    var p = $('preview'), top = p.getBoundingClientRect().top + window.pageYOffset - 72;
    window.scrollTo({ top: top, behavior: RB.reduced ? 'auto' : 'smooth' });
    try { p.focus({ preventScroll: true }); } catch (x) { p.focus(); }
  });

  /* ---------- restore: ?trade=key, then the saved draft, then the remembered trade ---------- */
  function fill(d){
    var f = d ? d.fields : {};
    TEXT.forEach(function(n){ E[n].value = f[n] || ''; });
    var t = null;
    RB.TRADES.forEach(function(x){ if (x.label === f.trade) t = x.key; });
    var q = new URLSearchParams(location.search).get('trade');
    if (q && RB.tradeByKey(q)) t = q;
    setRadio('trade', t || RB.getTrade() || RB.TRADES[0].key);
    setRadio('after_hours', f.after_hours === 'no' ? 'no' : 'yes');
    E.callback_promise.value = PROMISES.indexOf(f.callback_promise) > -1 ? f.callback_promise : '15';
    setRadio('booking', f.booking === 'callback' ? 'callback' : 'calendar');
    render();
  }
  fill(RB.getDraft());

  $('bClear').addEventListener('click', function(){
    RB.clearDraft();
    [].forEach.call(document.querySelectorAll('[data-draft-pill]'), function(el){ el.hidden = true; });
    fill(null);
    RB.toast('Cleared. Nothing is stored on this device now.', 'ok');
    E.business_name.focus();
  });
})();
