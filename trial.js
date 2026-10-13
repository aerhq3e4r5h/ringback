/* 'Plan your free week' (pricing.html #trial). Lays out the trial week from a chosen start date and offers
   an .ics file with two all-day reminders. Weekend setup days roll to Monday; public holidays aren't modelled,
   so the card says we'll confirm the day. Wording matches terms.html and the FAQ: 7 days, no card, nothing to pay. */
(function(){
  var RB = window.RB, box = document.getElementById('trialBody');
  if (!RB || !box) return;
  var DAY = 864e5;
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  var iso = function(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
  var add = function(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
  var weekday = function(d){ while (d.getDay() === 0 || d.getDay() === 6) d = add(d, 1); return d; };
  var nice = function(d){ return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }); };
  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var code = function(){
    var f = RB.FORWARD && RB.FORWARD.types && RB.FORWARD.types[0];
    return f ? f.on.replace('{n}', '[your Ringback number]').replace('{s}', '20') : '';
  };

  box.innerHTML =
    '<label class="fld tr-date"><span>I\'d like to start on</span><input type="date" class="in" id="trStart" min="' + iso(today) + '" value="' + iso(weekday(add(today, 1))) + '"></label>' +
    '<ol class="tr-line" id="trLine"></ol>' +
    '<p class="tr-sum"><b>Paid during the trial: R0</b> · No card needed</p>' +
    '<p class="faint tr-note">We\'ll confirm the setup day with you. Public holidays aren\'t shown here.</p>' +
    '<div class="tr-ctas"><button class="btn btn-line" type="button" id="trIcs">' + RB.icon('i-cal') + 'Add reminders to my calendar</button>' +
    '<a class="btn btn-hot" id="trGo" href="login.html?mode=signup">Start</a></div>';
  var input = document.getElementById('trStart');

  function dates(){
    var s = parse(input.value);
    if (!s || s < today) s = today;
    var setup = weekday(add(s, 1)), end = add(setup, 6);
    return { start: s, setup: setup, end: end };
  }
  function render(){
    var d = dates(), c = code();
    document.getElementById('trLine').innerHTML =
      '<li><time datetime="' + iso(d.start) + '">' + nice(d.start) + '</time><p>Create your account and fill in your details <span class="faint">(5 min)</span></p></li>' +
      '<li><time datetime="' + iso(d.setup) + '">' + nice(d.setup) + '</time><p>A 10-minute setup with us: we switch on forwarding with one code' + (c ? ', <code class="tr-code">' + RB.esc(c) + '</code>' : '') + '.</p></li>' +
      '<li><time>Days 1–7</time><p>Every missed call answered, and an SMS to you within a minute.</p></li>' +
      '<li><time datetime="' + iso(d.end) + '">' + nice(d.end) + '</time><p>We\'ll ask whether you want to continue. Keep it: pick your plan in the portal. Stop: we switch it off, and you can dial <code class="tr-code">##004#</code> to cancel forwarding yourself. Nothing to pay.</p></li>';
    var go = document.getElementById('trGo');
    go.href = 'login.html?mode=signup&start=' + iso(d.start);
    go.textContent = 'Start on ' + nice(d.start);
  }

  /* two all-day events, CRLF line endings and lines folded at 75 characters, as RFC 5545 asks */
  var fold = function(l){ var out = l.slice(0, 75); l = l.slice(75); while (l.length) { out += '\r\n ' + l.slice(0, 74); l = l.slice(74); } return out; };
  function ics(){
    var d = dates(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), ymd = function(x){ return iso(x).replace(/-/g, ''); };
    var ev = function(day, title, desc, tag){
      return ['BEGIN:VEVENT', 'UID:' + ymd(day) + '-' + tag + '-' + Math.random().toString(36).slice(2, 10) + '@ringback', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + ymd(day), 'DTEND;VALUE=DATE:' + ymd(add(day, 1)), 'SUMMARY:' + title, 'DESCRIPTION:' + desc, 'TRANSP:TRANSPARENT', 'END:VEVENT'];
    };
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ringback//Trial planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
      .concat(ev(d.setup, 'Ringback setup (to be confirmed)', 'A 10-minute call with Ringback to switch on call forwarding. We\'ll confirm the time with you.', 'setup'))
      .concat(ev(d.end, 'Ringback: decide whether to keep it', 'Last day of the free week. Keep it: pick a plan in the portal. Stop: we switch it off (dial ##004# to cancel forwarding). Nothing to pay.', 'decide'))
      .concat(['END:VCALENDAR']).map(fold).join('\r\n') + '\r\n';
  }
  document.getElementById('trIcs').addEventListener('click', function(){
    var blob = new Blob([ics()], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'ringback-trial.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    RB.toast('Calendar file saved: ringback-trial.ics', 'ok');
  });
  input.addEventListener('change', render);
  input.addEventListener('input', render);
  render();
  /* the forwarding code comes from forward.js, loaded only when the planner is near */
  if (!RB.FORWARD) {
    var load = function(){ RB.loadScript('forward.js').then(render, function(){}); };
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '400px' }); io.observe(box); }
    else load();
  }
})();
