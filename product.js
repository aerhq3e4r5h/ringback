/* Product page: sticky in-page tabs, the call-flow connectors, the compact comparison switcher and the trade link. */
(function(){
  var RB = window.RB, $ = function(s){ return document.querySelector(s); };

  /* in-page tabs: scrollspy along x, offset by the nav and the bar itself */
  var bar = $('.ptabs'), tabs = $('#productTabs');
  /* the band starts just below where an anchor jump lands (html scroll-padding-top), so a tapped tab is the one marked */
  var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  if (bar && tabs && RB.spy) RB.spy(tabs, { axis: 'x', offset: Math.max((parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight + 8, pad + 2) });

  /* "See it handle awkward calls": the visitor's saved trade, else plumbing */
  var awk = $('#awkwardLink');
  function awkward(){ if (awk) awk.href = 'trades.html#' + (RB.getTrade() || 'plumbing'); }
  awkward(); document.addEventListener('rb:trade', awkward);

  /* call-flow connectors: measured from the nodes, redrawn when the layout changes */
  var map = $('#flowMap'), svg = map && map.querySelector('.flow2-lines'), NS = 'http://www.w3.org/2000/svg';
  function box(el, m){ var r = el.getBoundingClientRect(); return { l: r.left - m.left, r: r.right - m.left, t: r.top - m.top, b: r.bottom - m.top, x: (r.left + r.right) / 2 - m.left, y: (r.top + r.bottom) / 2 - m.top }; }
  function draw(){
    if (!svg || getComputedStyle(svg).display === 'none') return;
    var m = map.getBoundingClientRect(), q = function(s){ return box(map.querySelector(s), m); };
    var n1 = q('.fn1'), n2 = q('.fn2'), n3 = q('.fn3'), n4 = q('.fn4'), n5 = q('.fn5');
    var lanes = [].map.call(map.querySelectorAll('.flow2-lane'), function(l){ return { b: box(l, m), c: l.classList.contains('red') ? 'red' : l.classList.contains('mint') ? 'mint' : 'amber' }; });
    function curve(x1, y1, x2, y2){ var my = (y1 + y2) / 2; return 'M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2; }
    var paths = [
      ['M' + n1.r + ' ' + n1.y + 'H' + n2.l, ''], ['M' + n2.r + ' ' + n2.y + 'H' + n3.l, ''],
      [curve(n3.x, n3.b, n4.x, n4.t), '']
    ];
    lanes.forEach(function(l){ paths.push([curve(n4.x, n4.b, l.b.x, l.b.t), l.c]); paths.push([curve(l.b.x, l.b.b, n5.x, n5.t), l.c]); });
    svg.setAttribute('viewBox', '0 0 ' + Math.round(m.width) + ' ' + Math.round(m.height));
    svg.innerHTML = '';
    paths.forEach(function(p){
      var el = document.createElementNS(NS, 'path');
      el.setAttribute('d', p[0].replace(/\d+\.\d+/g, function(n){ return (+n).toFixed(1); }));
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      if (p[1]) el.setAttribute('class', p[1]);
      svg.appendChild(el);
    });
  }
  if (map && svg) {
    draw();
    if ('ResizeObserver' in window) new ResizeObserver(function(){ requestAnimationFrame(draw); }).observe(map);
    else window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }

  /* comparison: under COMPACT one alternative at a time beside Ringback, so the table never scrolls sideways */
  var seg = $('#cmpSeg'), wrap = $('#cmpWrap');
  if (seg && wrap && RB.mq) {
    var col = '1';
    seg.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      col = b.dataset.col;
      [].forEach.call(seg.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed', String(x === b)); });
      if (wrap.hasAttribute('data-show')) wrap.setAttribute('data-show', col);
    });
    var sync = function(){
      var on = RB.mq.compact.matches;
      seg.hidden = !on;
      if (on) { wrap.setAttribute('data-show', col); wrap.removeAttribute('tabindex'); }
      else { wrap.removeAttribute('data-show'); wrap.setAttribute('tabindex', '0'); }
      if (RB.seg) RB.seg(seg);
    };
    sync();
    if (RB.mq.compact.addEventListener) RB.mq.compact.addEventListener('change', sync);
  }
})();
