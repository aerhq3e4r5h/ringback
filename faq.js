/* FAQ page: search with highlighted matches, category filters, a scrollspy index, deep links and copy-link buttons.
   Every <details> has an id (see README, Pages). '/' focuses the search here (site.js leaves '/' to this page). */
(function(){
  var RB = window.RB || {}, fs = document.getElementById('faqSearch'), list = document.getElementById('faqList');
  if (!fs || !list) return;
  var items = [].slice.call(list.querySelectorAll('details[id]')), heads = [].slice.call(list.querySelectorAll('.faq-cat'));
  var countEl = document.getElementById('faqCount'), none = document.getElementById('faqNone'), filters = document.getElementById('faqFilters'), index = document.getElementById('faqIndex');
  var total = items.length, cat = '', openedBySearch = [];
  /* each question knows its category */
  items.forEach(function(d){
    var g = d.closest('.faq-group'); /* the category is its section's id (start, calls, money, privacy, account) */
    d.dataset.cat = g ? g.id : '';
    var a = d.querySelector('.faq-a');
    if (a) a.insertAdjacentHTML('beforeend', '<button class="faq-link" type="button" aria-label="Copy link to this question" title="Copy link">' + (RB.icon ? RB.icon('i-link') : '') + '</button>');
  });
  list.addEventListener('click', function(e){
    var b = e.target.closest('.faq-link'); if (!b) return;
    var d = b.closest('details'), url = location.origin + location.pathname + '#' + d.id;
    if (RB.copy) RB.copy(url, b); else if (navigator.clipboard) navigator.clipboard.writeText(url);
    if (history.replaceState) history.replaceState(null, '', '#' + d.id);
  });

  /* highlighting works on text nodes only, and puts the original nodes back on every change */
  function unmark(){
    list.querySelectorAll('mark.faq-hit').forEach(function(m){ var p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  }
  function mark(root, re){
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function(n){ return n.parentNode.closest('button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var t = n.nodeValue; re.lastIndex = 0; if (!re.test(t)) return;
      var frag = document.createDocumentFragment(), last = 0; re.lastIndex = 0;
      t.replace(re, function(m, off){
        if (off > last) frag.appendChild(document.createTextNode(t.slice(last, off)));
        var mk = document.createElement('mark'); mk.className = 'faq-hit'; mk.textContent = m; frag.appendChild(mk);
        last = off + m.length; return m;
      });
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }
  function textOf(d){ return (d.querySelector('summary').textContent + ' ' + (d.querySelector('.faq-a') || d).textContent).toLowerCase(); }

  function apply(){
    var q = fs.value.trim().toLowerCase(), tokens = q ? q.split(/\s+/) : [], shown = 0, per = {};
    unmark();
    if (!q) { openedBySearch.forEach(function(d){ d.open = false; }); openedBySearch = []; }
    var re = tokens.length ? new RegExp(tokens.map(function(t){ return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'gi') : null;
    items.forEach(function(d){
      var txt = textOf(d), hit = (!cat || d.dataset.cat === cat) && tokens.every(function(t){ return txt.indexOf(t) >= 0; });
      d.hidden = !hit;
      if (hit) { shown++; per[d.dataset.cat] = (per[d.dataset.cat] || 0) + 1; }
      if (hit && re) { if (!d.open) { d.open = true; openedBySearch.push(d); } mark(d, re); }
    });
    heads.forEach(function(h){ var g = h.closest('.faq-group'); if (g) g.hidden = !per[g.id]; else h.hidden = !per[h.id]; });
    if (index) index.querySelectorAll('a').forEach(function(a){ var c = a.querySelector('.c'), n = per[a.hash.slice(1)] || 0; if (c) c.textContent = n; a.classList.toggle('is-empty', !n); });
    if (countEl) countEl.textContent = (q || cat) ? 'Showing ' + shown + ' of ' + total + ' questions' + (q ? ' for “' + fs.value.trim() + '”' : '') : 'Showing ' + total + ' questions';
    if (none) none.hidden = shown > 0;
    if (spy) spy.refresh();
  }
  var t; fs.addEventListener('input', function(){
    clearTimeout(t); t = setTimeout(function(){
      apply();
      if (history.replaceState) { var q = fs.value.trim(); history.replaceState(null, '', location.pathname + (q ? '?q=' + encodeURIComponent(q) : '') + location.hash); }
    }, 120);
  });
  if (filters) filters.addEventListener('click', function(e){
    var b = e.target.closest('button[data-cat]'); if (!b) return;
    cat = b.dataset.cat;
    filters.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
    apply();
  });

  /* '/' focuses the search when focus isn't already in a field */
  document.addEventListener('keydown', function(e){
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    var el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (document.querySelector('.rb-sheet')) return;
    e.preventDefault(); fs.focus(); fs.select();
  });

  /* scrollspy over the category index: a vertical list on desktop, a sticky chip bar under COMPACT */
  var spy = null, spies = {};
  /* never above where an anchor jump lands (html scroll-padding-top), so the tapped category is the one marked */
  function offset(){ var top = parseFloat(getComputedStyle(index).top) || 0, pad = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 2;
    return Math.max(pad, RB.mq && RB.mq.compact.matches ? top + index.offsetHeight + 12 : 110); }
  function startSpy(){
    if (!index || !RB.spy) return;
    var axis = RB.mq && RB.mq.compact.matches ? 'x' : 'y';
    spy = spies[axis] || (spies[axis] = RB.spy(index, { axis: axis, offset: offset() }));
    spy.refresh();
  }
  startSpy();
  if (RB.mq && RB.mq.compact.addEventListener) RB.mq.compact.addEventListener('change', startSpy);

  /* deep links: open the question, bring it into view under the sticky bars and flash an ember rule */
  function target(again){
    var id = decodeURIComponent(location.hash.slice(1)), d = id && document.getElementById(id);
    if (!d || d.tagName !== 'DETAILS') return;
    if (d.hidden) { fs.value = ''; cat = ''; if (filters) filters.querySelector('button').click(); apply(); }
    d.open = true;
    var y = d.getBoundingClientRect().top + window.pageYOffset - offset() - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    if (again === true) return;
    d.classList.remove('is-target'); void d.offsetWidth; d.classList.add('is-target');
    setTimeout(function(){ d.classList.remove('is-target'); }, 2000);
  }
  window.addEventListener('hashchange', function(){ target(); });

  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) { fs.value = q0.slice(0, 80); }
  apply();
  if (location.hash) { target(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ target(true); }); }
})();
