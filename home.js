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

  var phone = $('callPanel');
  function fillCall(linesEl, tri, t, play){
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
  function plusMin(hm, m){ var p = hm.split(':'), t = (+p[0] * 60 + +p[1] + m) % 1440; return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
  function show(i, animate){
    timers.forEach(clearTimeout); timers = [];
    current = i;
    var t = TRADES[i], play = animate && !reduced;
    [].forEach.call(tabs.children, function(b, j){ b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    var activeTab = tabs.children[i];
    if (animate) tabs.scrollTo({ left: activeTab.offsetLeft - 8, behavior: reduced ? 'auto' : 'smooth' });
    var bar = activeTab.querySelector('.bar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    phone.classList.remove('locked');
    $('pTime').textContent = t.time;
    $('lTime').textContent = plusMin(t.time, 1);
    $('cAvatar').textContent = t.init;
    $('cTitle').textContent = t.caller + ' · ' + t.suburb;
    $('cMeta').textContent = 'Forwarded to ' + t.biz;
    var linesEl = $('lines'), tri = $('triage');
    fillCall(linesEl, tri, t, play);
    var toast = $('toastCard');
    toast.dataset.kind = t.kind;
    $('tKind').textContent = KIND[t.kind];
    $('tWho').textContent = t.caller + ' · ' + t.suburb;
    $('tBody').textContent = t.alert;
    if (play) {
      /* lines arrive one by one, then the call ends and the phone locks with the SMS alert */
      tri.classList.add('wait'); toast.classList.add('wait');
      var rows = linesEl.children, end = 250 + rows.length * 1100;
      [].forEach.call(rows, function(r, k){
        timers.push(setTimeout(function(){ [].forEach.call(rows, function(x){ x.classList.remove('on'); }); r.classList.remove('wait'); r.classList.add('on'); }, 250 + k * 1100));
      });
      timers.push(setTimeout(function(){ tri.classList.remove('wait'); [].forEach.call(rows, function(x){ x.classList.remove('on'); }); }, end));
      timers.push(setTimeout(function(){ phone.classList.add('locked'); toast.classList.remove('wait'); }, end + 1100));
    } else { tri.classList.remove('wait'); toast.classList.remove('wait'); }
  }
  RB.showTrade = function(key){ TRADES.forEach(function(t, i){ if (t.key === key) { stopAuto(); show(i, true); } }); };
  function startAuto(){
    if (!autoOn) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function next(){ if (!onScreen) { autoTimer = setTimeout(next, 1000); return; } show((current + 1) % TRADES.length, true); autoTimer = setTimeout(next, 9000); }, 9000);
  }
  function stopAuto(){ autoOn = false; clearTimeout(autoTimer); consoleEl.classList.remove('auto'); }
  var start = 0, h = location.hash.replace('#','');
  if (RB.getTrade && RB.getTrade()) h = h || RB.getTrade();
  TRADES.forEach(function(t, i){ if (t.key === h) start = i; });
  /* Keep the phone the same height for every trade so the page never jumps when it switches.
     Measured on an invisible copy, so re-measuring never interrupts the call that's playing. */
  var callIn = consoleEl.querySelector('.call-in');
  function lockHeight(){
    var probe = callIn.cloneNode(true);
    probe.removeAttribute('id'); probe.querySelectorAll('[id]').forEach(function(n){ n.removeAttribute('id'); });
    probe.style.cssText = 'position:absolute;left:0;top:0;width:' + callIn.offsetWidth + 'px;min-height:0;visibility:hidden;pointer-events:none';
    probe.setAttribute('aria-hidden', 'true');
    callIn.parentNode.appendChild(probe);
    var hi = 0;
    TRADES.forEach(function(t){ fillCall(probe.querySelector('.lines'), probe.querySelector('.triage'), t, false); hi = Math.max(hi, probe.offsetHeight); });
    probe.remove();
    callIn.style.minHeight = hi + 'px';
  }
  lockHeight();
  show(start, !reduced);
  var lockW = innerWidth, lockT = null;
  window.addEventListener('resize', function(){ if (innerWidth === lockW) return; lockW = innerWidth; clearTimeout(lockT); lockT = setTimeout(lockHeight, 200); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockHeight);
  /* Pause the demo (and its waveform) while it's off screen, so phones aren't animating what nobody can see. */
  var onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function(en){ onScreen = en[0].isIntersecting; consoleEl.classList.toggle('paused', !onScreen); }).observe(consoleEl);
  startAuto();

  var rot = $('rot').children, ri = 0;
  if (!reduced) setInterval(function(){ var o = rot[ri]; o.classList.remove('on'); o.classList.add('leaving'); setTimeout(function(){ o.classList.remove('leaving'); }, 500); ri = (ri + 1) % rot.length; rot[ri].classList.add('on'); }, 2400);

  ['trackA','trackB'].forEach(function(id){ var t = $(id); t.innerHTML += t.innerHTML; });
})();
