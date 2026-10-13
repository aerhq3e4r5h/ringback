/* Pricing page: the missed-call calculator, the comparison switcher and the founding places counter.
   The calculator keeps its inputs in sessionStorage rb_calc {missed, real, win, value} for the plan finder.
   The counter sets RB.foundingLeft and fires 'rb:founding' only when real numbers arrive. */
(function(){
  var C = window.RB_CONFIG || {}, RB = window.RB;
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- calculator ----------
     Each slider has − and + steppers; tapping the value turns it into a number field for an exact figure.
     Desktop shows a value bubble over the thumb (--p); phones get a sticky strip with the monthly figure. */
  if ($('calc')) {
    var ids = ['missed','real','win','value'];
    var fmt = function(id, v){ return id === 'value' ? RB.rand(v) : id === 'missed' ? String(v) : v + '%'; };
    var fill = function(el){
      var p = (el.value - el.min) / (el.max - el.min) * 100;
      el.style.setProperty('--p', p + '%');
      var bub = el.parentNode.querySelector('.bub');
      if (bub) { bub.style.setProperty('--p', p.toFixed(2)); bub.textContent = fmt(el.id, +el.value); }
    };
    var calc = function(){
      var m = +$('missed').value, r = $('real').value / 100, w = $('win').value / 100, v = +$('value').value, jobs = m * r * w * 4.3;
      ids.forEach(function(id){ var o = $('o-' + id); if (!o.querySelector('input')) o.textContent = fmt(id, +$(id).value); });
      $('lost').textContent = RB.rand(jobs * v); $('yearly').textContent = RB.rand(jobs * v * 12); $('jobs').textContent = jobs.toFixed(1);
      if ($('stripV')) $('stripV').textContent = RB.rand(jobs * v);
      $('breakeven').textContent = Math.max(1, Math.ceil(2500 / v)); ids.forEach(function(id){ fill($(id)); });
      /* bar chart: monthly loss, yearly loss and a year of Ringback Starter including setup */
      var st = RB.PLANS.starter, cost = (st.monthly * 12 + st.setup) / 100, month = jobs * v, year = month * 12, top = Math.max(year, cost, 1);
      [['bMonth', month], ['bYear', year], ['bCost', cost]].forEach(function(b){ $(b[0]).style.transform = 'scaleX(' + Math.max(0.004, b[1] / top).toFixed(4) + ')'; $(b[0] + 'V').textContent = RB.rand(b[1]); });
      var share = $('shareWa');
      if (share) share.href = RB.wa('I worked out what missed calls cost my business: about ' + RB.rand(month) + ' a month, ' + RB.rand(year) + ' a year, from ' + m + ' missed calls a week. Work out yours: ' + (C.siteUrl || '') + 'pricing.html#calculator', true);
    };
    var remember = function(){ try { sessionStorage.setItem('rb_calc', JSON.stringify({ missed: +$('missed').value, real: +$('real').value, win: +$('win').value, value: +$('value').value })); } catch (e) {} };
    var set = function(el, v){
      var min = +el.min, max = +el.max, st = +el.step || 1;
      v = Math.min(max, Math.max(min, Math.round((v - min) / st) * st + min));
      el.value = v; calc(); remember();
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    ids.forEach(function(id){ $(id).addEventListener('input', function(){ calc(); remember(); }); });
    /* steppers */
    $('calc').addEventListener('click', function(e){
      var b = e.target.closest('.stp'); if (!b) return;
      var el = b.closest('.range').querySelector('input[type=range]');
      set(el, +el.value + (+b.getAttribute('data-d')) * (+el.step || 1));
    });
    /* tap the value to type it */
    var edit = function(o){
      if (o.querySelector('input')) return;
      var id = o.getAttribute('for'), el = $(id), inp = document.createElement('input');
      inp.type = 'number'; inp.inputMode = 'numeric'; inp.className = 'out-edit'; inp.min = el.min; inp.max = el.max; inp.step = el.step; inp.value = el.value;
      inp.setAttribute('aria-label', o.getAttribute('aria-label').split(':')[0] + ' (' + el.min + ' to ' + el.max + ')');
      o.textContent = ''; o.appendChild(inp); o.removeAttribute('role'); o.removeAttribute('tabindex');
      inp.focus(); try { inp.select(); } catch (e) {}
      var finished = false;
      var done = function(keep){
        if (finished) return; finished = true;
        var v = parseFloat(String(inp.value).replace(/[^\d.]/g, ''));
        o.removeChild(inp); o.setAttribute('role', 'button'); o.setAttribute('tabindex', '0');
        if (keep && !isNaN(v)) set(el, v); else calc();
      };
      inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); done(true); o.focus(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); o.focus(); } });
      inp.addEventListener('blur', function(){ done(true); });
      inp.addEventListener('input', function(){ var v = parseFloat(inp.value); if (!isNaN(v) && v >= +el.min && v <= +el.max) { el.value = v; fill(el); } });
    };
    [].forEach.call(document.querySelectorAll('#calc output'), function(o){
      o.addEventListener('click', function(){ edit(o); });
      o.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(o); } });
    });
    calc();
  }

  /* ---------- comparison: on phones a switcher picks the one plan column shown beside the row labels ---------- */
  var cseg = document.querySelector('.cmp-seg'), cwrap = document.querySelector('.cmp-wrap');
  if (cseg && cwrap) cseg.addEventListener('click', function(e){
    var b = e.target.closest('button[data-show]'); if (!b) return;
    [].forEach.call(cseg.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    cwrap.setAttribute('data-show', b.getAttribute('data-show'));
  });

  /* ---------- founding partner places (real numbers from the database, see supabase/founding_spots.sql) ----------
     If the query fails or returns anything unexpected, the counter stays hidden. Never a made-up number. */
  var spots = $('spots');
  if (spots && C.supabaseUrl && C.supabaseKey && window.fetch) {
    var ctl = window.AbortController ? new AbortController() : null;
    if (ctl) setTimeout(function(){ ctl.abort(); }, 8000);
    fetch(C.supabaseUrl + '/rest/v1/rpc/founding_spots', { method: 'POST', headers: { apikey: C.supabaseKey, 'Content-Type': 'application/json' }, body: '{}', signal: ctl ? ctl.signal : undefined })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || typeof d.total !== 'number' || typeof d.taken !== 'number' || d.total < 1) return;
        var left = Math.max(0, d.total - d.taken);
        RB.foundingLeft = left;
        document.dispatchEvent(new CustomEvent('rb:founding', { detail: { left: left, total: d.total } }));
        spots.innerHTML = left ? '<i></i><b>' + left + ' of ' + d.total + '</b> places left' : '<i></i>All ' + d.total + ' places taken';
        spots.classList.toggle('full', !left); spots.hidden = false;
      }).catch(function(){});
  }
})();
