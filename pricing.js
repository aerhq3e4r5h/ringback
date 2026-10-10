/* Pricing page: the missed-call calculator and the founding places counter. */
(function(){
  var C = window.RB_CONFIG || {}, RB = window.RB;
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- calculator ---------- */
  if ($('calc')) {
    var ids = ['missed','real','win','value'];
    var fill = function(el){ el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); };
    var calc = function(){
      var m = +$('missed').value, r = $('real').value / 100, w = $('win').value / 100, v = +$('value').value, jobs = m * r * w * 4.3;
      $('o-missed').textContent = m; $('o-real').textContent = Math.round(r * 100) + '%'; $('o-win').textContent = Math.round(w * 100) + '%'; $('o-value').textContent = RB.rand(v);
      $('lost').textContent = RB.rand(jobs * v); $('yearly').textContent = RB.rand(jobs * v * 12); $('jobs').textContent = jobs.toFixed(1);
      $('breakeven').textContent = Math.max(1, Math.ceil(2500 / v)); ids.forEach(function(id){ fill($(id)); });
      /* bar chart: monthly loss, yearly loss and a year of Ringback Starter including setup */
      var st = RB.PLANS.starter, cost = (st.monthly * 12 + st.setup) / 100, month = jobs * v, year = month * 12, top = Math.max(year, cost, 1);
      [['bMonth', month], ['bYear', year], ['bCost', cost]].forEach(function(b){ $(b[0]).style.transform = 'scaleX(' + Math.max(0.004, b[1] / top).toFixed(4) + ')'; $(b[0] + 'V').textContent = RB.rand(b[1]); });
      var share = $('shareWa');
      if (share) share.href = RB.wa('I worked out what missed calls cost my business: about ' + RB.rand(month) + ' a month, ' + RB.rand(year) + ' a year, from ' + m + ' missed calls a week. Work out yours: ' + (C.siteUrl || '') + 'pricing.html#calculator', true);
    };
    ids.forEach(function(id){ $(id).addEventListener('input', calc); }); calc();
  }

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
        spots.innerHTML = left ? '<i></i><b>' + left + ' of ' + d.total + '</b> places left' : '<i></i>All ' + d.total + ' places taken';
        spots.classList.toggle('full', !left); spots.hidden = false;
      }).catch(function(){});
  }
})();
