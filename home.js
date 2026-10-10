/* Home page: the switchable example-call console, the rotating headline word, the example-day ledger, the bento rail
   counter and the trade grid. Reduced motion and lite mode (RB.lite) open on the finished call with a 'Play the example'
   button instead of autoplaying. The phone keeps a fixed 1:2 shape, so its chat follows the newest line by transform and
   the page never moves when a call plays or the trade changes. */
(function(){
  var RB = window.RB, TRADES = RB.TRADES, reduced = RB.reduced, calm = reduced || RB.lite, IO = window.IntersectionObserver;
  var $ = function(id){ return document.getElementById(id); };
  var each = function(list, fn){ [].forEach.call(list, fn); };
  var KIND = { emergency:'● Emergency alert', booked:'● New booking', callback:'● Callback request' };

  var wave = $('wave');
  for (var i = 0; i < 52; i++) {
    var s = document.createElement('span');
    s.style.height = (25 + Math.round(70 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)))) + '%';
    s.style.animationDelay = (-(i * 37) % 1200) + 'ms';
    s.style.animationDuration = (900 + (i * 53) % 700) + 'ms';
    wave.appendChild(s);
  }

  /* ---------- trade tabs with a sliding pill ---------- */
  var tabs = $('tabs'), ind = tabs.querySelector('.tab-ind'), consoleEl = $('console'), tabBtns = [];
  var current = 0, timers = [], autoTimer = null, autoOn = !calm, onScreen = true;
  if (!autoOn) consoleEl.classList.remove('auto');
  if (calm) consoleEl.classList.add('calm');
  TRADES.forEach(function(t, i){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'trade-tab'; b.setAttribute('role','tab'); b.id = 'tab-' + t.key; b.setAttribute('aria-controls','callPanel');
    b.innerHTML = RB.icon(t.icon) + RB.esc(t.label) + '<span class="bar"></span>';
    b.addEventListener('click', function(){ stopAuto(); show(i, true); });
    tabs.appendChild(b); tabBtns.push(b);
  });
  tabs.addEventListener('keydown', function(e){
    var n = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: TRADES.length - 1 }[e.key];
    if (n == null) return;
    e.preventDefault(); stopAuto();
    n = (n + TRADES.length) % TRADES.length;
    show(n, true); tabBtns[n].focus();
  });
  function moveInd(){
    var b = tabBtns[current]; if (!b || !b.offsetWidth || !ind) return;
    tabs.style.setProperty('--x', b.offsetLeft + 'px'); tabs.style.setProperty('--w', b.offsetWidth + 'px');
    tabs.classList.add('has-ind');
  }

  /* ---------- the phone ---------- */
  var phone = $('callPanel'), chat = phone.querySelector('.chat'), chatIn = $('chatIn'), linesEl = $('lines'), tri = $('triage');
  var rings = phone.querySelector('.rings'), toast = $('toastCard'), stack = $('toastStack'), player = null;
  function fillCall(t, play){
    linesEl.innerHTML = '';
    t.lines.forEach(function(l){
      var d = document.createElement('div');
      d.className = 'line' + (l[0] === 'ai' ? ' ai' : '') + (play ? ' wait' : '');
      d.innerHTML = '<small>' + (l[0] === 'ai' ? 'Ringback' : 'Caller') + '</small><span></span>';
      d.lastChild.textContent = l[1];
      linesEl.appendChild(d);
    });
    tri.innerHTML = '';
    t.tags.forEach(function(g){ var s = document.createElement('span'); s.className = 'tag ' + g[0]; s.textContent = g[1]; tri.appendChild(s); });
  }
  /* keep the line being spoken (or the newest one) in view; transform only, so nothing around the phone moves */
  var followQ = 0;
  function follow(){
    followQ = 0;
    var rows = [].slice.call(linesEl.children), target = null;
    rows.forEach(function(r){ if (r.classList.contains('on')) target = r; });
    if (!target) { rows.forEach(function(r){ if (!r.classList.contains('wait')) target = r; }); if (!tri.classList.contains('wait')) target = tri; }
    var vh = chat.clientHeight, max = Math.max(0, chatIn.offsetHeight - vh), off = 0;
    if (target && max > 0) { off = target.offsetTop + target.offsetHeight - vh; if (target.offsetTop < off) off = target.offsetTop; off = Math.max(0, Math.min(max, off)); }
    chatIn.style.transform = off ? 'translateY(' + (-off) + 'px)' : '';
    chat.classList.toggle('is-up', off > 0);
  }
  function queueFollow(){ if (!followQ) followQ = requestAnimationFrame(follow); }
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(queueFollow);
    mo.observe(linesEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    mo.observe(tri, { attributes: true, attributeFilter: ['class'] });
  }
  function setLocked(on){
    var was = phone.classList.contains('locked');
    phone.classList.toggle('locked', on); phone.classList.toggle('in-call', !on);
    /* RICH: the rings ripple outward once each time the phone locks */
    if (on && !was && RB.rich && rings) { rings.classList.remove('ripple'); void rings.getBoundingClientRect(); rings.classList.add('ripple'); }
  }
  function plusMin(hm, m){ var p = hm.split(':'), t = (+p[0] * 60 + +p[1] + m) % 1440; return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
  function show(i, animate, force){
    timers.forEach(clearTimeout); timers = [];
    current = i;
    var t = TRADES[i], play = animate && (force || !reduced);
    tabBtns.forEach(function(b, j){ b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    var activeTab = tabBtns[i];
    moveInd();
    if (animate && tabs.scrollWidth > tabs.clientWidth) tabs.scrollTo({ left: activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
    var bar = activeTab.querySelector('.bar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    setLocked(false);
    $('pTime').textContent = t.time;
    $('lTime').textContent = plusMin(t.time, 1);
    $('cAvatar').textContent = t.init;
    $('cTitle').textContent = t.caller + ' · ' + t.suburb;
    $('cMeta').textContent = 'Forwarded to ' + t.biz;
    fillCall(t, play);
    toast.dataset.kind = t.kind;
    $('tKind').textContent = KIND[t.kind];
    $('tWho').textContent = t.caller + ' · ' + t.suburb;
    $('tBody').textContent = t.alert;
    $('tSum').textContent = t.caller + ' · ' + t.suburb + ' · ' + t.tags.map(function(g){ return g[1].replace(/ ✓$/, ''); }).join(' · ');
    /* sample recording for this trade, if there is one: playing it takes over from the animation */
    if (player) player.destroy();
    player = RB.callAudio(t, { mount: $('hear'), lines: linesEl,
      onPlay: function(){ stopAuto(); timers.forEach(clearTimeout); timers = []; setLocked(false); each(linesEl.children, function(x){ x.classList.remove('wait'); }); tri.classList.remove('wait'); stack.classList.add('wait'); },
      onEnd: function(){ setLocked(true); stack.classList.remove('wait'); } });
    if (play) {
      /* lines arrive one by one, then the call ends and the phone locks with the SMS alert */
      tri.classList.add('wait'); stack.classList.add('wait');
      var rows = linesEl.children, end = 250 + rows.length * 1100;
      each(rows, function(r, k){
        timers.push(setTimeout(function(){ each(rows, function(x){ x.classList.remove('on'); }); r.classList.remove('wait'); r.classList.add('on'); }, 250 + k * 1100));
      });
      timers.push(setTimeout(function(){ tri.classList.remove('wait'); each(rows, function(x){ x.classList.remove('on'); }); }, end));
      timers.push(setTimeout(function(){ setLocked(true); stack.classList.remove('wait'); }, end + 1100));
    } else { tri.classList.remove('wait'); stack.classList.remove('wait'); setLocked(true); }
    queueFollow();
  }
  RB.showTrade = function(key){ TRADES.forEach(function(t, i){ if (t.key === key) { stopAuto(); show(i, true); } }); };
  function step(d){ stopAuto(); show((current + d + TRADES.length) % TRADES.length, true); }
  function startAuto(){
    if (!autoOn) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function next(){ if (!onScreen) { autoTimer = setTimeout(next, 1000); return; } show((current + 1) % TRADES.length, true); autoTimer = setTimeout(next, 9000); }, 9000);
  }
  function stopAuto(){ autoOn = false; clearTimeout(autoTimer); consoleEl.classList.remove('auto'); }

  /* controls under the phone (shown on phones): previous, replay, next */
  var pctl = $('pctl'), cap = pctl.querySelector('.phone-cap');
  var pcBtn = function(cls, ic, label, d){ var b = document.createElement('button'); b.type = 'button'; b.className = 'pc' + cls; b.setAttribute('aria-label', label); b.innerHTML = RB.icon(ic); if (d) b.dataset.step = d; return b; };
  pctl.insertBefore(pcBtn('', 'i-back', 'Previous example call', '-1'), cap);
  pctl.appendChild(pcBtn(' pc-play', 'i-redo', 'Replay the example call'));
  pctl.appendChild(pcBtn('', 'i-arrow', 'Next example call', '1'));
  pctl.addEventListener('click', function(e){
    var b = e.target.closest('.pc'); if (!b) return;
    if (b.dataset.step) step(+b.dataset.step); else { stopAuto(); show(current, true, true); }
  });
  /* a sideways swipe on the phone changes trade; the first touch stops the autoplay */
  var sx = null, sy = 0;
  phone.addEventListener('pointerdown', function(e){ if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; stopAuto(); });
  phone.addEventListener('pointerup', function(e){
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
  phone.addEventListener('pointercancel', function(){ sx = null; });

  var start = 0, h = location.hash.replace('#','');
  if (RB.getTrade && RB.getTrade()) h = h || RB.getTrade();
  TRADES.forEach(function(t, i){ if (t.key === h) start = i; });
  show(start, !calm);
  if (calm) {
    var replay = document.createElement('button');
    replay.type = 'button'; replay.className = 'btn btn-line btn-sm play-ex'; replay.innerHTML = RB.icon('i-play') + 'Play the example';
    replay.addEventListener('click', function(){ show(current, true, true); });
    pctl.parentNode.insertBefore(replay, pctl.nextSibling);
  }
  window.addEventListener('resize', function(){ moveInd(); queueFollow(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ moveInd(); queueFollow(); });
  /* Pause the demo (and its waveform) while it's off screen, so phones aren't animating what nobody can see. */
  if (IO) new IO(function(en){ onScreen = en[0].isIntersecting; consoleEl.classList.toggle('paused', !onScreen); }).observe(consoleEl);
  /* on phones the action bar steps aside while the console is on screen, so it never covers the caption or controls */
  if (IO) new IO(function(en){ document.body.classList.toggle('demo-on', en[0].isIntersecting); }, { rootMargin: '-56px 0px 0px 0px' }).observe(consoleEl);
  startAuto();

  /* "Your trade" (the select in the hero kicker on desktop, the menu chips on phones) switches the demo */
  document.addEventListener('rb:trade', function(e){ if (e.detail) RB.showTrade(e.detail); });

  var rot = $('rot').children, ri = 0;
  if (!reduced) setInterval(function(){ var o = rot[ri]; o.classList.remove('on'); o.classList.add('leaving'); setTimeout(function(){ o.classList.remove('leaving'); }, 500); ri = (ri + 1) % rot.length; rot[ri].classList.add('on'); }, 2400);

  /* the marquee loops by doubling its track (the copy is hidden from screen readers); standing still it scrolls by hand */
  if (!calm) ['trackA','trackB'].forEach(function(id){
    var t = $(id); if (!t) return;
    each([].slice.call(t.children), function(c){ var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); t.appendChild(k); });
  });

  /* ---------- 02 the example day, with and without ---------- */
  var night = $('night'), num = $('nightNum'), countRaf = 0;
  function countTo(to, fmt){
    cancelAnimationFrame(countRaf);
    if (reduced) { num.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function tick(now){ var k = Math.min(1, (now - t0) / 400); num.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) countRaf = requestAnimationFrame(tick); })(t0);
  }
  if (night) night.querySelectorAll('[data-night]').forEach(function(b){
    b.addEventListener('click', function(){
      var on = b.dataset.night === 'on';
      if (night.classList.contains('with') === on) return;
      night.classList.toggle('with', on);
      night.querySelectorAll('[data-night]').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
      if (on) countTo(6, function(n){ return n + ' / 6'; }); else countTo(20250, function(n){ return '−' + RB.rand(n); });
    });
  });

  /* ---------- 03 bento: a snap rail on phones with a '1 / 7' counter; the triage pills drop in once (RICH) ---------- */
  var bento = $('bento'), bn = $('bentoN');
  if (bento) {
    var cards = [].slice.call(bento.children);
    var railTab = function(){ if (RB.mq.compact.matches) bento.tabIndex = 0; else bento.removeAttribute('tabindex'); };
    railTab(); if (RB.mq.compact.addEventListener) RB.mq.compact.addEventListener('change', railTab);
    if (IO && bn) {
      var cio = new IO(function(en){ en.forEach(function(e){ if (e.isIntersecting && RB.mq.compact.matches) bn.textContent = cards.indexOf(e.target) + 1; }); }, { root: bento, threshold: .6 });
      cards.forEach(function(c){ cio.observe(c); });
    }
  }
  var tu = $('triUi');
  if (tu && RB.rich && IO) {
    tu.classList.add('drop');
    var tio = new IO(function(en){ if (en[0].isIntersecting) { tu.classList.add('is-in'); tio.disconnect(); } }, { threshold: .4 });
    tio.observe(tu);
  }

  /* ---------- 04 trade grid (links to the trades page); your trade comes first ---------- */
  var grid = $('tradeGrid'), arrow = RB.icon('i-arrow');
  function buildGrid(){
    var mine = RB.getTrade();
    grid.innerHTML = RB.tradesInOrder().map(function(t){
      var me = t.key === mine;
      return '<a class="trade spot rv' + (me ? ' mine' : '') + '" href="trades.html#' + t.key + '"><span class="tg">' + RB.icon(t.icon) + '</span>' +
        (me ? '<span class="tag ember mine-tag">Your trade</span>' : '') + '<h3>' + RB.esc(t.label) + '</h3>' +
        '<dl><div><dt class="e">Escalates</dt><dd>' + RB.esc(t.catches) + '</dd></div><div><dt class="r">Books</dt><dd>' + RB.esc(t.books) + '</dd></div></dl>' +
        '<span class="go">See how it works ' + arrow + '</span></a>';
    }).join('') +
      '<a class="trade more spot rv" href="contact.html"><span class="tg">' + RB.icon('i-plus') + '</span><h3>Another trade?</h3><p class="muted">Roofers, glaziers, pool services, appliance repairs, garage doors. If customers phone you, we can set it up.</p><span class="go">Talk to us ' + arrow + '</span></a>';
  }
  if (grid) { buildGrid(); document.addEventListener('rb:trade', buildGrid); }
})();
