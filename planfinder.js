/* 'Which plan fits?' (pricing.html #finder). A guide, not a quote.
   Minutes a month = calls a week (band midpoint) × 4.3 weeks × minutes a call.
   Cost = plan + max(0, minutes − allowance) × RB.EXTRA_MIN_CENTS (R5). Pro is recommended for Afrikaans or follow-ups/reviews,
   never for cheaper minutes: at R5 a minute, Starter plus extras is always cheaper than Pro. */
(function(){
  var RB = window.RB, C = window.RB_CONFIG || {}, box = document.getElementById('finderBody');
  if (!RB || !box) return;
  var BANDS = [['1–5', 3], ['6–15', 10], ['16–30', 22], ['30+', 40]], LENS = [2, 3, 5], WEEKS = 4.3;
  var st = { band: 1, len: 3, af: 'no', extras: 'no', fromCalc: false };

  /* preselect from the calculator (sessionStorage rb_calc) */
  try {
    var c = JSON.parse(sessionStorage.getItem('rb_calc'));
    if (c && c.missed > 0) {
      var best = 0;
      BANDS.forEach(function(b, i){ if (Math.abs(b[1] - c.missed) < Math.abs(BANDS[best][1] - c.missed)) best = i; });
      st.band = best; st.fromCalc = true;
    }
  } catch (e) {}

  var group = function(name, legend, opts, cur, note){
    return '<fieldset class="fi-q"><legend>' + legend + (note ? ' <small class="fi-note">' + note + '</small>' : '') + '</legend><div class="bchips">' +
      opts.map(function(o){ return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div></fieldset>';
  };
  box.innerHTML =
    '<form class="fi-form" onsubmit="return false">' +
      group('band', 'Calls you miss in a normal week', BANDS.map(function(b, i){ return [i, b[0]]; }), st.band, st.fromCalc ? 'from your calculator' : '') +
      group('len', 'Usual call length', LENS.map(function(l){ return [l, 'About ' + l + ' min']; }), st.len) +
      group('af', 'Do callers ask for Afrikaans?', [['yes', 'Yes'], ['no', 'No']], st.af) +
      group('extras', 'Want follow-ups on callers who didn\'t book, Google review requests and a monthly report?', [['yes', 'Yes'], ['no', 'Not now']], st.extras) +
      '<details class="fi-how"><summary>How do I count missed calls?</summary><p><b>iPhone:</b> Phone → Recents → Missed. Count last week\'s.</p><p><b>Android:</b> Phone → Recents (or Call history) → Missed.</p></details>' +
    '</form>' +
    '<div class="fi-out" aria-live="polite" id="finderOut"></div>';

  var out = document.getElementById('finderOut');
  var cost = function(plan, mins){ var p = RB.PLANS[plan]; return p.monthly + Math.max(0, mins - p.minutes) * RB.EXTRA_MIN_CENTS; };
  var vat = +C.vatRate > 0 ? +C.vatRate : 0;
  var r = function(cents){ return RB.rand(cents / 100); };

  function render(){
    var calls = BANDS[st.band][1], mins = Math.round(calls * WEEKS * st.len);
    var s = cost('starter', mins), p = cost('pro', mins), pick = (st.af === 'yes' || st.extras === 'yes') ? 'pro' : 'starter';
    var why = [];
    if (st.af === 'yes') why.push('Afrikaans needs Pro.');
    if (st.extras === 'yes') why.push('Follow-ups, review requests and the monthly report come with Pro.');
    if (pick === 'starter') why.push(mins <= RB.PLANS.starter.minutes ? 'About ' + mins + ' minutes fits inside Starter\'s 250.' : 'Even with extra minutes, Starter costs less than Pro for you.');
    var bar = function(allow){ return '<i class="fi-bar' + (mins > allow ? ' over' : '') + '" style="--w:' + Math.min(100, mins / allow * 100).toFixed(1) + '%"></i>'; };
    var line = function(plan, total){
      var P = RB.PLANS[plan], extra = Math.max(0, mins - P.minutes);
      return '<div class="fi-cost' + (plan === pick ? ' is-pick' : '') + '"><dt>' + P.name + '</dt><dd><b>' + r(total) + '</b>/month' +
        '<small>' + r(P.monthly) + (extra ? ' + ' + extra + ' extra min × R5' : ', no extras') + (vat ? ' · about ' + r(total * (1 + vat)) + ' incl. VAT' : '') + '</small></dd></div>';
    };
    var founding = RB.foundingLeft > 0 ? '<p class="fi-found">Founding partner: R1,500 a month for 60 days, no setup fee, for our first three businesses. <a href="#plans">See the offer</a></p>' : '';
    out.innerHTML =
      '<p class="fi-mins">About <b class="num">' + mins + '</b> minutes a month</p>' +
      '<p class="fi-f">' + calls + ' calls a week × ' + WEEKS + ' weeks × ' + st.len + ' min</p>' +
      '<div class="fi-bars"><div><span>Starter · 250 min</span>' + bar(250) + '</div><div><span>Pro · 600 min</span>' + bar(600) + '</div></div>' +
      '<dl class="fi-costs">' + line('starter', s) + line('pro', p) + '</dl>' +
      '<div class="fi-rec"><p><span class="tag mint">Fits you</span> <b>' + RB.PLANS[pick].name + '</b></p><ul>' + why.map(function(w){ return '<li>' + w + '</li>'; }).join('') + '</ul></div>' +
      '<p class="fi-honest">At R5 a minute, Starter plus extra minutes always costs less than Pro. Pro is worth it for what it adds, not for cheaper minutes.</p>' +
      founding +
      '<a class="btn btn-hot btn-block" href="login.html?mode=signup&amp;plan=' + pick + '">Start my trial on ' + RB.PLANS[pick].name + ' ' + RB.icon('i-arrow') + '</a>';
    /* mark the matching plan card; no scrolling */
    [].forEach.call(document.querySelectorAll('.plan[data-plan]'), function(card){
      var on = card.getAttribute('data-plan') === pick, tag = card.querySelector('.fits');
      card.classList.toggle('fits-you', on);
      if (on && !tag) card.querySelector('.pl-h').insertAdjacentHTML('afterbegin', '<span class="tag mint fits">Fits you</span>');
      if (!on && tag) tag.remove();
    });
  }
  box.addEventListener('change', function(e){
    var n = e.target.name; if (!n || !(n in st)) return;
    st[n] = n === 'band' || n === 'len' ? +e.target.value : e.target.value;
    render();
  });
  document.addEventListener('rb:founding', function(){ if (started) render(); });
  /* the card marking starts once the visitor opens the finder, so a first look at the plans stays neutral */
  var fin = document.getElementById('finder'), started = false;
  var start = function(){ if (!started && fin.open) { started = true; render(); } };
  fin.addEventListener('toggle', start);
  if (location.hash === '#finder' || st.fromCalc) fin.open = true;
  start();
  /* a link to #finder (search, other pages) opens it */
  window.addEventListener('hashchange', function(){ if (location.hash === '#finder') { fin.open = true; start(); } });
})();
