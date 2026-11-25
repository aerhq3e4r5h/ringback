/* Privacy and terms: a reading time counted from the article (ceil(words / 220), never guessed), a Print button,
   and the "On this page" index: a sticky list with a scrollspy on wide screens, a collapsible <details> under COMPACT. */
(function(){
  var RB = window.RB || {}, text = document.getElementById('legalText');
  if (!text) return;

  /* business details from config.js (legal: {...}); a row with nothing to show is hidden rather than left blank */
  var C = window.RB_CONFIG || {}, L = C.legal || {};
  document.querySelectorAll('[data-legal]').forEach(function(el){
    var v = L[el.getAttribute('data-legal')] || (el.getAttribute('data-legal') === 'email' ? C.email : '');
    if (v) el.textContent = v; else if (el.closest('tr')) el.closest('tr').hidden = true;
  });

  var rt = document.querySelector('[data-read-time]');
  if (rt) {
    var words = (text.textContent.match(/\S+/g) || []).length, mins = Math.max(1, Math.ceil(words / 220));
    rt.textContent = mins + ' min read';
    rt.setAttribute('data-words', words);
    rt.hidden = false;
  }

  var pr = document.querySelector('[data-print]');
  if (pr && window.print) { pr.hidden = false; pr.addEventListener('click', function(){ window.print(); }); }

  var box = document.querySelector('.toc-box'), toc = document.getElementById('legalToc');
  if (!box || !toc) return;
  var compact = RB.mq ? RB.mq.compact : window.matchMedia('(max-width:700px), (pointer:coarse) and (max-height:500px)');
  /* COMPACT starts closed; wider screens always show the list (its summary is hidden there) */
  function mode(){ box.open = !compact.matches; }
  mode();
  if (compact.addEventListener) compact.addEventListener('change', mode);
  /* under COMPACT, picking a section closes the list first, then scrolls, so the collapse can't push the section away */
  toc.addEventListener('click', function(e){
    var a = e.target.closest('a'), t = a && document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!t || !compact.matches) return;
    e.preventDefault();
    /* the list may close with a height transition, so take its open height off the target now rather than measuring later */
    var sum = box.querySelector('summary'), lost = box.offsetHeight - (sum ? sum.offsetHeight : 0) - 2;
    var y = t.getBoundingClientRect().top + window.pageYOffset - lost - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    box.open = false;
    window.scrollTo({ top: Math.max(0, y), behavior: RB.reduced ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', a.hash);
  });
  if (RB.spy) RB.spy(toc, { axis: 'y', offset: 110 });
})();
