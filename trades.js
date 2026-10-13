/* Trades page: seven case files built from RB.TRADES, a glyph selector, a sticky rail (chip bar at 1040px and below).
   Contract with scenarios.js: each case holds <div class="case-call" data-scenarios="{key}"> with .lines, .triage and .sms;
   'rb:trades-ready' fires once after the cases exist. */
(function(){
  var RB = window.RB, sel = document.getElementById('tradeSel'), rail = document.getElementById('tradeNav'), box = document.getElementById('tradeDetails');
  if (!box || !RB || !RB.TRADES) return;
  var KIND = { emergency:['red','Emergency alert'], booked:['mint','New booking'], callback:['amber','Callback request'] };
  var esc = RB.esc, mine = RB.getTrade(), wide = window.matchMedia('(min-width:1041px)');
  function list(s){ return '<ul>' + String(s).split(/,\s*/).map(function(x){ return '<li>' + esc(x.charAt(0).toUpperCase() + x.slice(1)) + '</li>'; }).join('') + '</ul>'; }
  var trades = RB.tradesInOrder(), html = '';
  trades.forEach(function(t, i){
    var k = KIND[t.kind] || KIND.emergency, n = ('0' + (i + 1)).slice(-2);
    sel.insertAdjacentHTML('beforeend', '<a class="tsel-tile" href="#' + t.key + '" data-key="' + t.key + '">' + RB.icon(t.icon) + '<span>' + esc(t.label) + '</span><span class="tag ember tsel-mine">Your trade</span></a>');
    rail.insertAdjacentHTML('beforeend', '<a href="#' + t.key + '" data-key="' + t.key + '">' + RB.icon(t.icon) + '<span>' + esc(t.label) + '</span><i class="rail-mine">Yours</i></a>');
    var lines = t.lines.map(function(l){
      return '<div class="line' + (l[0] === 'ai' ? ' ai' : '') + '"><small>' + (l[0] === 'ai' ? 'Ringback' : 'Caller') + '</small><span>' + esc(l[1]) + '</span></div>';
    }).join('');
    var tags = t.tags.map(function(g){ return '<span class="tag ' + g[0] + '">' + esc(g[1]) + '</span>'; }).join('');
    html +=
      '<section class="case' + (i % 2 ? ' band' : '') + '" id="' + t.key + '" data-key="' + t.key + '" aria-labelledby="h-' + t.key + '">' +
      '<div class="wrap case-in">' +
        '<header class="case-head">' +
          '<svg class="art case-art" viewBox="0 0 160 120" aria-hidden="true" focusable="false"><use href="art.svg#art-' + t.key + '"/></svg>' +
          '<div class="case-title"><span class="kicker"><b>' + n + '</b>Case file</span><span class="tag ember case-mine">Your trade</span>' +
          '<h2 id="h-' + t.key + '">' + esc(t.label) + '</h2></div>' +
          '<p class="case-lede">Your assistant answers as your business and knows which calls can\'t wait for ' + esc(t.plural) + '.</p>' +
        '</header>' +
        '<div class="case-status">' +
          '<div class="st st-red"><h3>Escalates straight to you</h3>' + list(t.catches) + '</div>' +
          '<div class="st st-mint"><h3>Books or takes a callback</h3>' + list(t.books) + '</div>' +
          '<div class="st st-amber"><h3>Safety steps it gives callers</h3><p>' + esc(t.safety) + '</p></div>' +
        '</div>' +
        '<div class="case-call" data-scenarios="' + t.key + '">' +
          '<div class="screen case-screen" role="group" aria-label="Example call for a fictional ' + esc(t.label.toLowerCase()) + ' business">' +
            '<div class="screen-bar"><span>Example · fictional business</span></div>' +
            '<div class="screen-body">' +
              '<div class="call-top"><div class="caller"><span class="avatar" aria-hidden="true">' + esc(t.init) + '</span><div><b>Incoming · ' + esc(t.suburb) + '</b><span>Forwarded to ' + esc(t.biz) + ' · ' + esc(t.time) + '</span></div></div></div>' +
              '<div class="lines">' + lines + '</div>' +
              '<div class="triage">' + tags + '</div>' +
              '<div class="hear" data-hear="' + t.key + '" hidden></div>' +
            '</div>' +
          '</div>' +
          '<div class="case-sms"><span class="case-sms-lbl">Example · SMS alert to you</span>' +
            '<div class="sms"><b class="' + k[0] + '">' + k[1].toUpperCase() + '</b> · ' + esc(t.caller) + ' · ' + esc(t.suburb) + '<br>' + esc(t.alert) + '</div></div>' +
        '</div>' +
        '<div class="case-ctas">' +
          '<a class="btn btn-hot" href="build.html?trade=' + t.key + '">Preview it for my business <svg aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
          '<a class="link" href="contact.html#message" data-setup-call data-source="trades">Rather we set it up with you?</a>' +
          '<a class="link" href="index.html#' + t.key + '">Watch it play</a>' +
        '</div>' +
      '</div></section>';
  });
  box.insertAdjacentHTML('beforeend', html);

  /* the saved trade: ember ring on its tile, "Yours" in the rail, a tag on its case file */
  function markMine(){
    mine = RB.getTrade();
    document.querySelectorAll('[data-key]').forEach(function(el){ el.classList.toggle('is-mine', el.dataset.key === mine); });
  }
  markMine();

  /* sample recordings: a player only for keys listed in config.audio */
  box.querySelectorAll('[data-hear]').forEach(function(m){
    RB.callAudio(RB.tradeByKey(m.dataset.hear), { mount: m, lines: m.parentNode.querySelector('.lines') });
  });

  /* scrollspy: a vertical rail on wide screens, a horizontal chip bar at 1040px and below */
  var spied = {};
  function spy(){
    var axis = wide.matches ? 'y' : 'x';
    if (spied[axis] || !RB.spy) { if (spied[axis]) spied[axis].refresh(); return; }
    spied[axis] = RB.spy(rail, { axis: axis, offset: axis === 'y' ? 100 : stickyOffset() });
  }
  function stickyOffset(){
    if (wide.matches) return 96;
    var top = parseFloat(getComputedStyle(rail).top) || 0;
    return top + rail.offsetHeight + 12;
  }
  spy();
  if (wide.addEventListener) wide.addEventListener('change', spy);

  /* scroll to a case without scrollIntoView, allowing for the sticky bars */
  function go(key, smooth){
    var el = key && document.getElementById(key); if (!el) return;
    var y = el.getBoundingClientRect().top + window.pageYOffset - stickyOffset() + (wide.matches ? 0 : 4);
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !RB.reduced ? 'smooth' : 'auto' });
  }
  sel.addEventListener('click', function(e){
    var a = e.target.closest('a[data-key]'); if (!a) return;
    e.preventDefault();
    if (history.replaceState) history.replaceState(null, '', '#' + a.dataset.key);
    RB.setTrade(a.dataset.key); /* fires rb:trade, which scrolls */
  });
  rail.addEventListener('click', function(e){
    var a = e.target.closest('a[data-key]'); if (!a) return;
    e.preventDefault();
    if (history.replaceState) history.replaceState(null, '', '#' + a.dataset.key);
    go(a.dataset.key, true);
  });
  document.addEventListener('rb:trade', function(e){ markMine(); go(e.detail, true); });
  if (location.hash) {
    var key = decodeURIComponent(location.hash.slice(1));
    go(key, false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ go(key, false); });
  }
  document.dispatchEvent(new CustomEvent('rb:trades-ready'));
})();
