/* Home page: the switchable live-call console and the rotating headline word. */
(function(){
  var RB = window.RB, TRADES = RB.TRADES, reduced = RB.reduced;
  var $ = function(id){ return document.getElementById(id); };
  var KIND = { emergency:'● Emergency alert', booked:'● New booking', callback:'● Callback request' };

  var wave = $('wave');
  for (var i = 0; i < 52; i++) {
    var s = document.createElement('span');
    s.style.height = (25 + Math.round(70 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)))) + '%';
    s.style.animationDelay = (-(i * 37) % 1200) + 'ms';
    s.style.animationDuration = (900 + (i * 53) % 700) + 'ms';
    wave.appendChild(s);
  }

  var tabs = $('tabs'), consoleEl = $('console');
  var current = 0, timers = [], autoTimer = null, autoOn = !reduced;
  if (!autoOn) consoleEl.classList.remove('auto');
  TRADES.forEach(function(t, i){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'trade-tab'; b.setAttribute('role','tab'); b.id = 'tab-' + t.key; b.setAttribute('aria-controls','callPanel');
    b.innerHTML = RB.icon(t.icon) + RB.esc(t.label) + '<span class="bar"></span>';
    b.addEventListener('click', function(){ stopAuto(); show(i, true); });
    tabs.appendChild(b);
  });
  tabs.addEventListener('keydown', function(e){
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); stopAuto();
    var n = (current + (e.key === 'ArrowRight' ? 1 : -1) + TRADES.length) % TRADES.length;
    show(n, true); tabs.children[n].focus();
  });

  function show(i, animate){
    timers.forEach(clearTimeout); timers = [];
    current = i;
    var t = TRADES[i];
    [].forEach.call(tabs.children, function(b, j){ b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    var activeTab = tabs.children[i];
    if (animate) tabs.scrollTo({ left: activeTab.offsetLeft - 8, behavior: reduced ? 'auto' : 'smooth' });
    var bar = activeTab.querySelector('.bar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    $('cAvatar').textContent = t.init;
    $('cTitle').textContent = 'Incoming · ' + t.suburb;
    $('cMeta').textContent = 'Forwarded to ' + t.biz + ' · ' + t.time;
    var linesEl = $('lines'); linesEl.innerHTML = '';
    t.lines.forEach(function(l, k){
      var d = document.createElement('div');
      d.className = 'line' + (l[0] === 'ai' ? ' ai' : '') + (animate && !reduced ? ' wait' : '') + (!animate && k === 0 ? ' on' : '');
      d.innerHTML = '<small>' + (l[0] === 'ai' ? 'Ringback' : 'Caller') + '</small><span></span>';
      d.lastChild.textContent = l[1];
      linesEl.appendChild(d);
    });
    var tri = $('triage'); tri.innerHTML = '';
    t.tags.forEach(function(g){ var s = document.createElement('span'); s.className = 'tag ' + g[0]; s.textContent = g[1]; tri.appendChild(s); });
    var toast = $('toastCard');
    toast.dataset.kind = t.kind;
    $('tKind').textContent = KIND[t.kind];
    $('tWho').textContent = t.caller + ' · ' + t.suburb;
    $('tBody').textContent = t.alert;
    if (animate && !reduced) {
      tri.classList.add('wait'); toast.classList.add('wait');
      var rows = linesEl.children;
      [].forEach.call(rows, function(r, k){
        timers.push(setTimeout(function(){ [].forEach.call(rows, function(x){ x.classList.remove('on'); }); r.classList.remove('wait'); r.classList.add('on'); }, 250 + k * 1100));
      });
      timers.push(setTimeout(function(){ tri.classList.remove('wait'); }, 250 + rows.length * 1100));
      timers.push(setTimeout(function(){ toast.classList.remove('wait'); }, 650 + rows.length * 1100));
    } else { tri.classList.remove('wait'); toast.classList.remove('wait'); }
  }
  function startAuto(){
    if (!autoOn) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function next(){ show((current + 1) % TRADES.length, true); autoTimer = setTimeout(next, 9000); }, 9000);
  }
  function stopAuto(){ autoOn = false; clearTimeout(autoTimer); consoleEl.classList.remove('auto'); }
  var start = 0, h = location.hash.replace('#','');
  TRADES.forEach(function(t, i){ if (t.key === h) start = i; });
  /* Keep the console the same height for every trade so the page never jumps when it switches. */
  var callIn = consoleEl.querySelector('.call-in'), toastEl = $('toastCard');
  function lockHeight(){
    callIn.style.minHeight = ''; toastEl.style.minHeight = '';
    var hi = 0, ht = 0;
    TRADES.forEach(function(t, j){ show(j, false); hi = Math.max(hi, callIn.offsetHeight); ht = Math.max(ht, toastEl.offsetHeight); });
    callIn.style.minHeight = hi + 'px'; toastEl.style.minHeight = ht + 'px';
  }
  lockHeight();
  show(start, false);
  var lockW = innerWidth, lockT = null;
  window.addEventListener('resize', function(){ if (innerWidth === lockW) return; lockW = innerWidth; clearTimeout(lockT); lockT = setTimeout(function(){ var c = current; lockHeight(); show(c, false); }, 200); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ var c = current; lockHeight(); show(c, false); });
  startAuto();

  var rot = $('rot').children, ri = 0;
  if (!reduced) setInterval(function(){ var o = rot[ri]; o.classList.remove('on'); o.classList.add('leaving'); setTimeout(function(){ o.classList.remove('leaving'); }, 500); ri = (ri + 1) % rot.length; rot[ri].classList.add('on'); }, 2400);

  ['trackA','trackB'].forEach(function(id){ var t = $(id); t.innerHTML += t.innerHTML; });
})();
