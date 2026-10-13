/* Scenario templates: what the assistant says in common situations, and the 'What does it say when…' explorer.
   Every line here describes behaviour the FAQ already claims (call-out fee only, checks the service area, filters
   sales calls, says it's an AI if asked, Afrikaans on Pro). The owner checks this wording against the real Vapi
   prompt; see README 'Features'. All businesses and callers are fictional.
   RB.SCENARIOS[key] = {label, tags:[[status,label]], lines:[['ai'|'caller', text]], sms:{kind,label,body}|null, filtered, faq, why, pro}
   Placeholders: {biz} {owner} {fee} {suburb} {areas} {outside} {job} {promise} {after}.
   RB.renderScenario(trade, key, details) -> {lines, tags, sms, filtered, faq, why, label}. Used by build.js too.
   RB.scenarioExplorer(el, tradeKey) mounts into <div class="case-call" data-scenarios="{key}"> holding .lines, .triage, .sms. */
(function(){
  var RB = window.RB;
  if (!RB) return;
  var GREET = ['ai', "Hi, you've reached {biz}. This call is recorded. How can I help?"];

  RB.SCENARIOS = {
    booking: {
      label: 'Routine booking', pro: false, filtered: false, faq: null,
      why: 'Routine jobs go straight into your calendar, or become a callback if you prefer.',
      tags: [['mint', 'Booked'], ['', '{job}'], ['', 'Example slot']],
      lines: [GREET,
        ['caller', "Hi, I'd like someone to come out. It's for {job_l}, and I'm in {suburb}."],
        ['ai', "No problem, {suburb} is in our area. I can book you in for Tuesday at 9 or Wednesday at 2. Which suits you?"],
        ['caller', 'Tuesday at 9, please.'],
        ['ai', "Booked for Tuesday at 9. {owner} will see you then, and you'll get an SMS confirmation now."]],
      sms: { kind: 'mint', label: 'NEW BOOKING', body: '{job}. Booked Tue 09:00.' }
    },
    price: {
      label: 'Asks the price', pro: false, filtered: false, faq: 'q-prices',
      why: 'It only ever gives your call-out fee. Quotes stay with you.',
      tags: [['amber', 'Callback'], ['', 'Price question'], ['', 'Call-out fee only']],
      lines: [GREET,
        ['caller', 'How much do you charge for {job_l}?'],
        ['ai', "The call-out fee is {fee} on weekdays. {owner} will quote once they've seen the job."],
        ['caller', "Okay. Can they call me about it?"],
        ['ai', "Of course. I've passed your number to {owner}, and they'll call you back to arrange a visit."]],
      sms: { kind: 'amber', label: 'CALLBACK', body: 'Asked about the price of {job_l}. Told the call-out fee only. Wants a visit.' }
    },
    area: {
      label: 'Outside your area', pro: false, filtered: false, faq: null,
      why: 'It checks the suburb against your service area before it books anything.',
      tags: [['', 'Outside area'], ['', '{outside}'], ['', 'Not booked']],
      lines: [GREET,
        ['caller', 'Hi, do you come out to {outside}?'],
        ['ai', "Thanks for checking. {outside} is outside the area we cover, so I can't book a visit there. We work in {areas}."],
        ['caller', "Ah, pity. Thanks anyway."],
        ['ai', "Sorry we can't help this time. I've let {owner} know you called."]],
      sms: { kind: '', label: 'OUTSIDE AREA', body: 'Caller in {outside} asked for a visit. Outside your area, not booked.' }
    },
    sales: {
      label: 'Sales call', pro: false, filtered: true, faq: null,
      why: "Sales and spam calls get a polite no, and you aren't disturbed.",
      tags: [['', 'Sales call'], ['', 'Filtered']],
      lines: [GREET,
        ['caller', "Hi, I'm calling from a marketing company about advertising for your business."],
        ['ai', "Thanks for calling. {owner} doesn't take sales calls on this line, so I won't pass this on. Have a good day."]],
      sms: null
    },
    robot: {
      label: 'Is this a robot?', pro: false, filtered: false, faq: 'q-ai',
      why: "If anyone asks, it says it's an AI. It never pretends to be a person.",
      tags: [['amber', 'Callback'], ['', 'Asked if AI'], ['', '{job}']],
      lines: [GREET,
        ['caller', 'Wait, am I talking to a real person?'],
        ['ai', "No, I'm an AI assistant for {biz}. I can take your details for {owner} or book you in. What do you need?"],
        ['caller', "Fine. It's about {job_l}. I'd rather speak to someone."],
        ['ai', "No problem. I've asked {owner} to call you back on this number."]],
      sms: { kind: 'amber', label: 'CALLBACK', body: 'Asked if it was an AI (told yes). About {job_l}. Wants to speak to you.' }
    },
    afrikaans: {
      label: 'Afrikaans caller', pro: true, filtered: false, faq: 'q-languages',
      why: 'English on every plan; Afrikaans on Pro. The SMS to you stays in English.',
      tags: [['mint', 'Booked'], ['', 'Afrikaans'], ['', 'Pro plan']],
      lines: [GREET,
        ['caller', 'Goeiemiddag. Kan ek maar Afrikaans praat?'],
        ['ai', 'Natuurlik. Hoe kan ek help?'],
        ['caller', 'Ek soek iemand wat môre kan kom kyk. Ek bly in {suburb}.'],
        ['ai', "Ek kan 'n afspraak vir u maak. Pas Dinsdag om nege-uur of Woensdag om twee-uur?"],
        ['caller', 'Dinsdag om nege-uur, dankie.'],
        ['ai', "Dis bespreek vir Dinsdag om nege-uur. {owner} sien u dan, en u kry nou 'n SMS."]],
      sms: { kind: 'mint', label: 'NEW BOOKING', body: 'Afrikaans caller in {suburb}. Booked Tue 09:00.' }
    },
    /* the builder's 'Emergency' tab; the trades page uses each trade's own example instead */
    emergency: {
      label: 'Emergency', pro: false, filtered: false, faq: 'q-safety',
      why: 'Only basic, widely known safety steps, then it alerts you as urgent.',
      tags: [['red', 'Emergency'], ['', '{problem}']],
      lines: [GREET, ['caller', '{say_caller}'], ['ai', '{say_safe}'], ['ai', '{say_end}']],
      sms: { kind: 'red', label: 'EMERGENCY', body: '{summary} {sms_end}' }
    }
  };

  /* per trade: an emergency call, in words the assistant can say (basic safety only, as faq q-safety says) */
  var EMERG = {
    plumbing: ['Burst geyser', "Water's pouring through my ceiling. I think the geyser burst.", "Let's get it safe. Switch the geyser off at the DB board, then close the main tap by the meter.", 'Burst geyser, water through ceiling. Power and water off.'],
    electrical: ['Burning smell', "Half the house has no power and there's a burning smell by the DB board.", "Please don't touch the board. If it's safe, switch off the main switch and keep everyone away. If you see smoke or flames, call 10177.", 'Burning smell at DB board, partial outage. Main off.'],
    gates: ['Gate stuck open', "My gate motor's stuck open and I can't close it. It's late and I'm worried.", 'Please stay inside and keep the motor\'s release key handy. If you feel unsafe, call your armed response or 10111.', 'Gate motor stuck open, security risk.'],
    solar: ['Inverter smell', "My inverter is beeping and there's a hot smell coming from it.", "Please don't open the inverter. If it's safe, switch it off at the isolator. If you see smoke, call 10177.", 'Inverter beeping with a hot smell. Isolated.'],
    pest: ['Bee swarm', "There's a bee swarm right by our front door.", 'Please keep people and pets away from the swarm. If anyone is stung and reacts badly, call 10177.', 'Bee swarm at the front door. People kept away.'],
    aircon: ['Unit leaking', "Our aircon is leaking water right above the plugs.", "If it's safe, switch the unit off at the isolator and keep away from the water near the plugs.", 'Unit leaking over plugs. Switched off at isolator.'],
    locksmith: ['Locked out', "I've locked myself out and I need to get to work.", "Are you somewhere safe right now? If someone has broken in or is still there, call 10111 first.", 'Locked out, at the property, safe.']
  };
  var OUTSIDE = 'Vereeniging';

  var lc = function(s){ s = String(s || ''); return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
  /* capitalise the start of each sentence after filling ('the owner will…' -> 'The owner will…') */
  var caps = function(s){ return s.replace(/(^|[.?!]\s+)([a-z])/g, function(m, a, b){ return a + b.toUpperCase(); }); };

  /* details (all optional): biz, owner, fee, after (after-hours fee), suburb, areas, promise, after_hours 'yes'|'no', booking 'calendar'|'callback' */
  RB.renderScenario = function(trade, key, details){
    var t = typeof trade === 'string' ? RB.tradeByKey(trade) : trade;
    t = t || RB.TRADES[0];
    var s = RB.SCENARIOS[key];
    if (!s) return null;
    var d = details || {}, em = EMERG[t.key] || EMERG.plumbing;
    var job = String(t.books || '').split(',')[0].trim();
    var promise = d.promise || '15', owner = d.owner || t.owner, afterNo = d.after_hours === 'no';
    var V = {
      biz: d.biz || t.biz, owner: owner, fee: d.fee || 'R650', after: d.after || '', suburb: d.suburb || t.suburb,
      areas: d.areas || d.suburb || t.suburb, outside: OUTSIDE, job: job, job_l: lc(job), promise: promise,
      problem: em[0], say_caller: em[1], say_safe: em[2], summary: em[3],
      say_end: afterNo ? "Thanks. I've taken a message for " + owner + ", marked urgent. They'll call you back as soon as they're available." : "Thanks. I've sent this to " + owner + " as urgent. They'll call you within " + promise + ' minutes.',
      sms_end: afterNo ? 'Message taken, after hours.' : 'Call back within ' + promise + ' min.'
    };
    var fill = function(str){ return caps(String(str).replace(/\{(\w+)\}/g, function(m, k){ return V[k] != null ? V[k] : m; })); };
    var lines = s.lines.map(function(l){ return [l[0], fill(l[1])]; });
    var tags = s.tags.map(function(g){ return [g[0], fill(g[1])]; });
    var sms = s.sms ? { kind: s.sms.kind, label: s.sms.label, body: fill(s.sms.body) } : null;
    /* builder-only variants, driven by the visitor's own answers */
    if (key === 'price' && d.after) lines[2][1] += ' After hours it\'s ' + d.after + '.';
    if (key === 'booking' && d.booking === 'callback') {
      lines[2] = ['ai', fill("No problem, {suburb} is in our area. I'll ask {owner} to call you back within {promise} minutes to set a time.")];
      lines[3] = ['caller', 'Great, thanks.'];
      lines[4] = ['ai', fill("You're welcome. {owner} will be in touch soon.")];
      tags = [['amber', 'Callback'], ['', job], ['', 'Within ' + promise + ' min']];
      sms = { kind: 'amber', label: 'CALLBACK', body: fill('{job}. Wants a time booked. Call back within {promise} min.') };
    }
    if (key === 'emergency' && afterNo) tags = [['red', 'Urgent'], ['', em[0]], ['', 'Message taken']];
    return { label: s.label, lines: lines, tags: tags, sms: sms, filtered: s.filtered, faq: s.faq, why: s.why, pro: s.pro };
  };

  /* ---------- markup helpers, in the same shape as the trades page's own example ---------- */
  RB.scenarioLines = function(lines){
    return lines.map(function(l){ return '<div class="line' + (l[0] === 'ai' ? ' ai' : '') + '"><small>' + (l[0] === 'ai' ? 'Ringback' : 'Caller') + '</small><span>' + RB.esc(l[1]) + '</span></div>'; }).join('');
  };
  RB.scenarioTags = function(tags){ return tags.map(function(g){ return '<span class="tag ' + g[0] + '">' + RB.esc(g[1]) + '</span>'; }).join(''); };
  RB.scenarioSms = function(sms, who){
    if (!sms) return '<span class="scn-filtered">' + RB.icon('i-ban') + 'Filtered · no SMS sent</span>';
    return '<b class="' + (sms.kind || '') + '">' + RB.esc(sms.label) + '</b> · ' + RB.esc(who || 'Example caller') + '<br>' + RB.esc(sms.body);
  };

  /* ---------- the explorer ---------- */
  var ORDER = [['example', "This trade's example"], ['booking'], ['price'], ['area'], ['sales'], ['robot'], ['afrikaans', 'Afrikaans caller (Pro)']];
  var quick = function(){ return RB.reduced || (RB.mq && RB.mq.compact.matches); };
  var uid = 0;

  RB.scenarioExplorer = function(el, tradeKey){
    if (!el || el._rbScn) return; el._rbScn = true;
    var t = RB.tradeByKey(tradeKey || el.getAttribute('data-scenarios'));
    var L = el.querySelector('.lines'), T = el.querySelector('.triage'), S = el.querySelector('.sms');
    if (!t || !L) return;
    var orig = { lines: L.innerHTML, tags: T ? T.innerHTML : '', sms: S ? S.innerHTML : '', smsCls: S ? S.className : '' };
    var id = 'scn' + (++uid);
    el.classList.add('scn');
    var row = document.createElement('div');
    row.className = 'scn-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', id + 'q');
    row.innerHTML = '<p class="scn-q" id="' + id + 'q">What does it say when…</p>' + ORDER.map(function(o, i){
      return '<button type="button" class="scn-b" data-k="' + o[0] + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + RB.esc(o[1] || RB.SCENARIOS[o[0]].label) + '</button>';
    }).join('');
    el.insertBefore(row, el.firstChild);
    var why = document.createElement('p'); why.className = 'scn-why'; el.appendChild(why);
    var live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); el.appendChild(live);

    function content(k){
      if (k === 'example') return { lines: orig.lines, tags: orig.tags, sms: orig.sms, smsCls: orig.smsCls, why: 'This is the example call for ' + t.label.toLowerCase() + '.', faq: 'q-safety', label: "This trade's example" };
      var r = RB.renderScenario(t, k);
      return { lines: RB.scenarioLines(r.lines), tags: RB.scenarioTags(r.tags), sms: RB.scenarioSms(r.sms, 'Example caller · ' + t.suburb), smsCls: orig.smsCls + (r.sms ? '' : ' sms--filtered'), why: r.why, faq: r.faq, label: r.label, filtered: r.filtered };
    }
    function paint(target, c){
      var q = function(s){ return target.querySelector(s); };
      q('.lines').innerHTML = c.lines;
      if (q('.triage')) q('.triage').innerHTML = c.tags;
      if (q('.sms')) { q('.sms').innerHTML = c.sms; q('.sms').className = c.smsCls; }
      var w = q('.scn-why');
      w.innerHTML = '<b>Why it does this:</b> ' + RB.esc(c.why) + (c.faq ? ' <a href="faq.html#' + c.faq + '">Read the FAQ</a>' : '');
    }
    /* lock the height to the tallest scenario, measured on a hidden clone, so nothing below jumps */
    function lock(){
      var w = el.getBoundingClientRect().width; if (!w) return;
      var c = el.cloneNode(true);
      c.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;min-height:0;width:' + w + 'px';
      c.removeAttribute('id'); [].forEach.call(c.querySelectorAll('[id]'), function(n){ n.removeAttribute('id'); });
      el.parentNode.appendChild(c);
      var max = 0;
      ORDER.forEach(function(o){ paint(c, content(o[0])); max = Math.max(max, c.getBoundingClientRect().height); });
      c.remove();
      el.style.minHeight = Math.ceil(max) + 'px';
      el._rbW = w;
    }
    function show(k, announce){
      var c = content(k);
      [].forEach.call(row.querySelectorAll('.scn-b'), function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-k') === k ? 'true' : 'false'); });
      var run = function(){ paint(el, c); el.setAttribute('data-k', k); };
      if (quick() || !announce) run();
      else { el.classList.add('scn-swap'); setTimeout(function(){ run(); el.classList.remove('scn-swap'); }, 120); }
      if (announce) live.textContent = 'Showing: ' + c.label + (c.filtered ? '. Filtered, no SMS sent.' : '.');
    }
    row.addEventListener('click', function(e){ var b = e.target.closest('.scn-b'); if (b) show(b.getAttribute('data-k'), true); });
    show('example', false);
    lock();
    var rt;
    window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ if (Math.abs(el.getBoundingClientRect().width - (el._rbW || 0)) > 1) lock(); }, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock);
  };

  function mountAll(){ [].forEach.call(document.querySelectorAll('[data-scenarios]'), function(el){ RB.scenarioExplorer(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
  document.addEventListener('rb:trades-ready', mountAll);
})();
