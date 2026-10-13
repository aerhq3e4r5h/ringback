/* Site search and command palette. Loaded on demand by site.js ([data-search], Ctrl/Cmd+K, '/').
   RB.openSearch(q): a sheet with a combobox and a grouped listbox (pages and sections, actions, FAQ questions).
   FAQ questions are read from faq.html on first open. Enter on free text goes to faq.html?q=term. */
(function(){
  var RB = window.RB;
  if (!RB) return;
  var MAX = 8;
  /* query word -> words it should also match */
  var SYN = { price: ['cost', 'pricing', 'fee'], robot: ['ai', 'bot', 'human'], popia: ['privacy', 'data'], afrikaans: ['language'], forward: ['forwarding', 'codes'], trial: ['free'] };

  var nav = function(href){ return function(){ location.href = href; }; };
  var P = function(title, href, kw, sub){ return { g: 'Pages', title: title, sub: sub || '', kw: kw || '', run: nav(href), href: href }; };
  var PAGES = [
    P('Home', 'index.html', 'start ringback ai receptionist'),
    P('Product', 'product.html', 'how it works'),
    P('Call flow', 'product.html#flow', 'what happens when', 'Product'),
    P('Features', 'product.html#features', 'sms alerts booking recordings', 'Product'),
    P('Getting set up', 'product.html#how', 'setup onboarding steps', 'Product'),
    P('Call forwarding codes', 'product.html#forwarding', 'forward divert network vodacom mtn cell c telkom', 'Product'),
    P('Monthly report', 'product.html#report', 'results report pro', 'Product'),
    P('Compared', 'product.html#compare', 'voicemail receptionist comparison', 'Product'),
    P('Trades', 'trades.html', 'industries examples')
  ].concat(RB.TRADES.map(function(t){ return P(t.label, 'trades.html#' + t.key, t.plural + ' ' + t.catches + ' ' + t.books, 'Trades'); })).concat([
    P('Pricing', 'pricing.html', 'plans cost'),
    P('Plans', 'pricing.html#plans', 'starter pro founding partner', 'Pricing'),
    P('Which plan fits?', 'pricing.html#finder', 'plan finder minutes recommend', 'Pricing'),
    P('Calculator', 'pricing.html#calculator', 'missed calls cost lost', 'Pricing'),
    P('Plan your free week', 'pricing.html#trial', 'trial calendar start date', 'Pricing'),
    P('FAQ: Getting started', 'faq.html#start', 'questions', 'FAQ'),
    P('FAQ: Calls and emergencies', 'faq.html#calls', 'questions', 'FAQ'),
    P('FAQ: Pricing and contracts', 'faq.html#money', 'questions', 'FAQ'),
    P('FAQ: Privacy and POPIA', 'faq.html#privacy', 'questions data', 'FAQ'),
    P('FAQ: Your account', 'faq.html#account', 'questions login', 'FAQ'),
    P('About', 'about.html', 'who we are team'),
    P('Contact', 'contact.html', 'email phone whatsapp message'),
    P('Privacy', 'privacy.html', 'policy popia data'),
    P('Terms', 'terms.html', 'conditions contract'),
    P('Build your assistant', 'build.html', 'preview builder wording')
  ]);
  var A = function(title, kw, run, href){ return { g: 'Actions', title: title, sub: '', kw: kw, run: run, href: href || null }; };
  var ACTIONS = [
    A('Talk to the assistant', 'ai demo voice call live', function(){ RB.openAI(); }),
    A('WhatsApp us', 'chat message contact', function(){ window.open(RB.wa('Hi Ringback, '), '_blank', 'noopener'); }),
    A('Request a setup call', 'help setup forwarding call me', function(){ RB.loadScript('setupcall.js').then(function(){ RB.openSetupCall({ source: 'search', trade: RB.getTrade() }); }, function(){ location.href = 'contact.html#message'; }); }),
    A('Preview my assistant', 'build builder wording', nav('build.html'), 'build.html'),
    A('Log in', 'login sign in portal account code', nav('login.html'), 'login.html'),
    A('Create account', 'sign up register trial start', nav('login.html?mode=signup'), 'login.html?mode=signup')
  ].concat(RB.TRADES.map(function(t){
    return A('Show examples for ' + t.label, 'example ' + t.plural + ' trade', function(){ RB.setTrade(t.key); location.href = 'index.html#' + t.key; });
  }));
  var QUESTIONS = null, loading = null;

  function loadFaq(){
    if (QUESTIONS || loading) return loading || Promise.resolve();
    loading = fetch('faq.html').then(function(r){ return r.ok ? r.text() : ''; }).then(function(html){
      var doc = new DOMParser().parseFromString(html, 'text/html');
      QUESTIONS = [].map.call(doc.querySelectorAll('details'), function(d){
        var s = d.querySelector('summary'), q = s ? s.textContent.trim() : '', ans = d.textContent.replace(q, '').replace(/\s+/g, ' ').trim();
        if (!q) return null;
        var href = d.id ? 'faq.html#' + d.id : 'faq.html?q=' + encodeURIComponent(q);
        return { g: 'Questions', title: q, sub: ans.slice(0, 90) + (ans.length > 90 ? '…' : ''), kw: ans, run: nav(href), href: href };
      }).filter(Boolean);
    }).catch(function(){ QUESTIONS = []; });
    return loading;
  }

  var words = function(s){ return String(s).toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim().split(' ').filter(Boolean); };
  function expand(tok){
    var out = [tok];
    Object.keys(SYN).forEach(function(k){ if (k.indexOf(tok) === 0 || (tok.length >= 3 && tok.indexOf(k) === 0)) out = out.concat(k, SYN[k]); });
    return out;
  }
  /* every query word (or a synonym) must prefix-match a word; title matches count most */
  function score(item, toks){
    var tw = words(item.title), kw = words(item.sub + ' ' + item.kw), total = 0;
    for (var i = 0; i < toks.length; i++) {
      var alts = expand(toks[i]), best = 0;
      alts.forEach(function(a, k){
        var syn = k > 0 ? 0.6 : 1;
        /* the typed word matches as a prefix; a synonym only as a whole word ('ai' must not find 'aircon') */
        var hit = function(w){ return k ? w === a : w.indexOf(a) === 0; };
        if (tw.some(hit)) best = Math.max(best, (hit(tw[0]) ? 4 : 3) * syn);
        else if (kw.some(hit)) best = Math.max(best, 1 * syn);
      });
      if (!best) return 0;
      total += best;
    }
    return total;
  }
  function search(q){
    var toks = words(q), groups = [['Pages', 'Pages and sections'], ['Actions', 'Actions'], ['Questions', 'Questions']];
    var all = PAGES.concat(ACTIONS, QUESTIONS || []);
    if (!toks.length) {
      return [{ g: 'Actions', label: 'Actions', items: ACTIONS.slice(0, 6) }, { g: 'Pages', label: 'Pages', items: [PAGES[1], PAGES[8], PAGES[16], PAGES[PAGES.length - 1]].filter(Boolean) }];
    }
    var hits = all.map(function(it){ return { it: it, s: score(it, toks) }; }).filter(function(h){ return h.s > 0; }).sort(function(a, b){ return b.s - a.s; });
    return groups.map(function(g){
      return { g: g[0], label: g[1], items: hits.filter(function(h){ return h.it.g === g[0]; }).slice(0, MAX).map(function(h){ return h.it; }) };
    }).filter(function(g){ return g.items.length; });
  }

  var n = 0;
  RB.openSearch = function(q){
    var id = 'srch' + (++n), active = -1, flat = [];
    var html =
      '<div class="pal">' +
        '<div class="pal-in search">' + RB.icon('i-search') +
          '<input type="text" id="' + id + 'i" role="combobox" aria-expanded="true" aria-controls="' + id + 'l" aria-autocomplete="list" aria-activedescendant="" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Search pages, questions, actions" aria-label="Search the site"></div>' +
        '<p class="sr-only" role="status" aria-live="polite" id="' + id + 's"></p>' +
        '<div class="pal-list" role="listbox" id="' + id + 'l" aria-label="Results"></div>' +
        '<p class="pal-keys faint" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</p>' +
      '</div>';
    var sh = RB.sheet({ label: 'Search', html: html, size: RB.mq.compact.matches ? 'full' : 'md' });
    var input = sh.body.querySelector('input'), list = sh.body.querySelector('.pal-list'), status = sh.body.querySelector('[role=status]');
    sh.el.classList.add('rb-sheet--pal');

    function render(){
      var res = search(input.value), html = '', i = 0;
      flat = [];
      res.forEach(function(g, gi){
        html += '<div role="group" aria-labelledby="' + id + 'g' + gi + '"><p class="pal-g" id="' + id + 'g' + gi + '" role="presentation">' + RB.esc(g.label) + '</p>';
        g.items.forEach(function(it){
          flat.push(it);
          html += '<div class="pal-o" role="option" id="' + id + 'o' + i + '" aria-selected="false" data-i="' + i + '"><b>' + RB.esc(it.title) + '</b>' + (it.sub ? '<span>' + RB.esc(it.sub) + '</span>' : '') + '</div>';
          i++;
        });
        html += '</div>';
      });
      var term = input.value.trim();
      if (!flat.length) html = '<div class="pal-empty"><p>No match' + (term ? ' for “' + RB.esc(term) + '”' : '') + '.</p><button class="btn btn-line btn-sm" type="button" data-ask>' + RB.icon('i-mic') + 'Ask the assistant</button>' +
        (term ? '<a class="link" href="faq.html?q=' + encodeURIComponent(term) + '">Search the FAQ for it ' + RB.icon('i-arrow') + '</a>' : '') + '</div>';
      list.innerHTML = html;
      status.textContent = term ? (flat.length ? flat.length + ' result' + (flat.length > 1 ? 's' : '') : 'No results') : '';
      setActive(term && flat.length ? 0 : -1);
    }
    function setActive(i){
      active = i;
      [].forEach.call(list.querySelectorAll('.pal-o'), function(o){ o.setAttribute('aria-selected', String(+o.getAttribute('data-i') === i)); });
      var el = i >= 0 ? list.querySelector('#' + id + 'o' + i) : null;
      input.setAttribute('aria-activedescendant', el ? el.id : '');
      if (el) {
        /* keep it in view without moving the page */
        var r = el.getBoundingClientRect(), sc = sh.body, b = sc.getBoundingClientRect();
        if (r.bottom > b.bottom) sc.scrollTop += r.bottom - b.bottom + 8;
        else if (r.top < b.top + 72) sc.scrollTop -= b.top + 72 - r.top;
      }
    }
    function run(it){ sh.close(); setTimeout(function(){ it.run(); }, 0); }

    input.addEventListener('input', render);
    input.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) setActive((active + 1) % flat.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) setActive(active <= 0 ? flat.length - 1 : active - 1); }
      else if (e.key === 'Home' && flat.length && !input.value) { e.preventDefault(); setActive(0); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (active >= 0 && flat[active]) run(flat[active]);
        else if (input.value.trim()) { sh.close(); location.href = 'faq.html?q=' + encodeURIComponent(input.value.trim()); }
      }
    });
    list.addEventListener('mousemove', function(e){ var o = e.target.closest('.pal-o'); if (o && +o.getAttribute('data-i') !== active) setActive(+o.getAttribute('data-i')); });
    list.addEventListener('click', function(e){
      var o = e.target.closest('.pal-o');
      if (o) { run(flat[+o.getAttribute('data-i')]); return; }
      if (e.target.closest('[data-ask]')) { sh.close(); RB.openAI(); }
    });

    if (q) input.value = q;
    render();
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    loadFaq().then(function(){ if (document.contains(input)) { var a = active; render(); if (a >= 0 && a < flat.length) setActive(a); } });
    return sh;
  };
})();
