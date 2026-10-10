/* Ringback shared site script: header, footer, icons, AI widget, small helpers. */
(function(){
  var C = window.RB_CONFIG || {};
  var RB = window.RB = window.RB || {};
  var reduced = RB.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var page = document.body.dataset.page || '';

  /* ---------- icons ---------- */
  var ICONS = {
    'i-check':'<path d="M20 6 9 17l-5-5"/>',
    'i-phone':'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    'i-arrow':'<path d="M5 12h14M13 6l6 6-6 6"/>',
    'i-mic':'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/>',
    'i-chat':'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'i-mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'i-cloud':'<path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z"/><path d="m11 11-2 3h4l-2 3"/>',
    'i-pin':'<path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    'i-shield':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'i-lang':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'i-rand':'<path d="M7 20V4h5.5a4 4 0 0 1 0 8H7M12 12l5 8"/>',
    'i-redo':'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    'i-menu':'<path d="M4 7h16M4 12h16M4 17h16"/>',
    'i-close':'<path d="M6 6l12 12M18 6 6 18"/>',
    'i-home':'<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    'i-sliders':'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    'i-card':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    'i-list':'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'i-user':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'i-logout':'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    'i-lock':'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    'i-clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'i-bolt':'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    'i-cal':'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 15l2 2 4-4"/>',
    'i-search':'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'i-play':'<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    'i-pause':'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    'i-download':'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    'i-trash':'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    'i-star':'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    'i-wa':'<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1-1.2 2 .8c-.2 1.2-1 1.9-2.1 1.9A6 6 0 0 1 8.4 9.6c0-1.1.7-1.9 1.9-2.1l.8 2z"/>',
    'i-ban':'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    'i-receipt':'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'i-upload':'<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
    'i-copy':'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    'i-print':'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    'i-alert':'<path d="M12 3 2 21h20z"/><path d="M12 10v4M12 17.5v.01"/>',
    'i-bank':'<path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3l9 5H3z"/>',
    'i-back':'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    't-plumb':'<path d="M12 2.7S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.7 12 2.7z"/>',
    't-elec':'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    't-gate':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    't-solar':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    't-pest':'<rect x="8" y="7" width="8" height="13" rx="4"/><path d="M12 7V4M9 3l1.5 1.5M15 3l-1.5 1.5M8 11H4M8 15H4M16 11h4M16 15h4M12 7v13"/>',
    't-air':'<path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
    't-lock':'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>'
  };
  var sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">';
  Object.keys(ICONS).forEach(function(k){ sprite += '<symbol id="' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</symbol>'; });
  document.body.insertAdjacentHTML('afterbegin', sprite + '</svg>');
  RB.icon = function(id){ return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  var LOGO = '<span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#160A04" stroke-width="2.6" stroke-linecap="round"><path d="M5 10v4M9 7v10M13 4v16M17 7v10M21 10v4"/></svg></span>Ringback';

  /* ---------- helpers ---------- */
  RB.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  /* WhatsApp link to us; with toAnyone, WhatsApp asks which chat to send it to instead */
  RB.wa = function(text, toAnyone){ return 'https://wa.me/' + (toAnyone ? '' : C.whatsapp) + (text ? '?text=' + encodeURIComponent(text) : ''); };
  RB.rand = function(n){ return 'R' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  RB.money = function(cents){ var v = (Math.round(cents || 0) / 100).toFixed(2).split('.'); return 'R' + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + v[1]; };
  RB.copy = function(text, btn){
    var done = function(ok){ RB.toast(ok ? 'Copied' : 'Couldn\'t copy. Select and copy it instead.', ok ? 'ok' : 'err'); if (ok && btn) { btn.classList.add('copied'); setTimeout(function(){ btn.classList.remove('copied'); }, 1400); } };
    try { navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); }); } catch (e) { done(false); }
  };
  /* Plan prices in cents, excluding VAT. Keep in step with pricing.html. */
  RB.PLANS = {
    founding: { name:'Founding partner', monthly:150000, setup:0, per:'/mo for 60 days', setupText:'No setup fee', minutes:250, feats:['Everything in Starter','Weekly call reviews','Stop at day 60'] },
    starter:  { name:'Starter', monthly:250000, setup:350000, per:'/month', setupText:'R3,500 setup · 250 min', minutes:250, feats:['Missed and after-hours calls','Emergency SMS alerts','Calendar booking','Call recordings'] },
    pro:      { name:'Pro', monthly:450000, setup:550000, per:'/month', setupText:'R5,500 setup · 600 min', minutes:600, feats:['Everything in Starter','English and Afrikaans','Review requests','Monthly report'] }
  };
  RB.loggedIn = function(){ try { return Object.keys(localStorage).some(function(k){ return /^sb-.*-auth-token$/.test(k); }); } catch (e) { return false; } };
  var toastBox;
  RB.toast = function(msg, kind){
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role','status'); toastBox.setAttribute('aria-live','polite'); document.body.appendChild(toastBox); }
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.innerHTML = '<i></i><span></span>'; t.lastChild.textContent = msg;
    toastBox.appendChild(t); setTimeout(function(){ t.remove(); }, 4200);
  };

  /* ---------- trades (example calls; all businesses are fictional) ----------
     Sample call audio: put a recording of each example call at audio/<key>.mp3 (e.g. audio/plumbing.mp3).
     The player only appears once that file loads. To line the transcript up exactly, add
     cues:[0, 4.5, 9, 15.2] to a trade: the second each line starts. Without cues, lines are spread by length. */
  RB.TRADES = [
    { key:'plumbing', plural:'plumbers', log:[['21:47','Burst geyser · Fourways','red','Alerted'],['14:10','Blocked drain · Randburg','mint','Booked'],['09:32','COC for a house sale · Sandton','amber','Callback']],
      label:'Plumbing', icon:'t-plumb', biz:'Ridgeway Plumbing', owner:'Pieter', caller:'Lerato M', init:'LM', suburb:'Fourways', time:'21:47', kind:'emergency',
      catches:'Burst geysers, major leaks, sewage backups, no water', books:'Leaks, blocked drains, geyser services, COCs',
      safety:'Geyser off at the DB board, main water off at the meter.',
      lines:[['ai',"Hi, you've reached Ridgeway Plumbing. This call is recorded. How can I help?"],['caller',"Water's pouring through my ceiling. I think the geyser burst."],['ai',"Let's get it safe. Switch the geyser off at the DB board, then close the main tap by the meter."],['ai',"Thanks, Lerato. I've sent this to Pieter as an emergency. He'll call you within 15 minutes."]],
      tags:[['red','Emergency'],['','Burst geyser'],['','Power off ✓'],['','Water off ✓']],
      alert:'Burst geyser, water through ceiling. Power and water off. Call back within 15 min.' },
    { key:'electrical', plural:'electricians', log:[['19:12','Burning smell at the DB · Centurion','red','Alerted'],['11:05','New kitchen plugs · Midrand','mint','Booked'],['08:40','DB board upgrade quote · Edenvale','amber','Callback']],
      label:'Electrical', icon:'t-elec', biz:'Ridgeway Electrical', owner:'Sipho', caller:'Johan V', init:'JV', suburb:'Centurion', time:'19:12', kind:'emergency',
      catches:'Burning smells, sparking plugs, full outages, tripping boards', books:'COCs, new plugs and lights, DB upgrades, quotes',
      safety:"Don't touch the board. If safe, switch off the main. Smoke or flames: call 10177.",
      lines:[['ai',"Hi, you've reached Ridgeway Electrical. This call is recorded. How can I help?"],['caller',"Half the house has no power and there's a burning smell by the DB board."],['ai',"Please don't touch the board. If it's safe, switch off the main switch and keep everyone away. If you see smoke or flames, call 10177."],['ai',"I've flagged this as urgent. Sipho will call you back within 15 minutes."]],
      tags:[['red','Emergency'],['','Burning smell'],['','Main off ✓']],
      alert:'Burning smell at DB board, partial outage. Main switched off. Call back within 15 min.' },
    { key:'gates', plural:'gate and alarm installers', log:[['23:05','Gate stuck open · Midrand','red','Alerted'],['15:20','Gate motor service · Kempton Park','mint','Booked'],['10:15','New alarm quote · Benoni','amber','Callback']],
      label:'Gates & alarms', icon:'t-gate', biz:'Ridgeway Gates & Alarms', owner:'Thabo', caller:'Anika P', init:'AP', suburb:'Midrand', time:'23:05', kind:'emergency',
      catches:"Gates stuck open, alarms that won't stop, failed beams", books:'Motor services, remotes, battery swaps, new installs',
      safety:'Stay inside, keep the release key handy. Feeling unsafe: armed response or 10111.',
      lines:[['ai',"Hi, you've reached Ridgeway Gates & Alarms. This call is recorded. How can I help?"],['caller',"My gate motor's stuck open and I can't close it. It's late and I'm worried."],['ai',"I understand. I've marked this urgent. Can you confirm your street address in Midrand?"],['ai',"Got it. Thabo will call you within 20 minutes. Keep the motor's release key handy."]],
      tags:[['red','Urgent'],['','Gate stuck open'],['','After hours']],
      alert:'Gate motor stuck open, after hours, security risk. Call back within 20 min.' },
    { key:'solar', plural:'solar and backup installers', log:[['18:30','Inverter tripping · Bryanston','red','Alerted'],['10:20','Inverter fault check · Bryanston','mint','Booked'],['09:05','Battery upgrade quote · Pretoria East','amber','Callback']],
      label:'Solar & backup', icon:'t-solar', biz:'Ridgeway Solar', owner:'Nadia', caller:'Kevin D', init:'KD', suburb:'Bryanston', time:'10:20', kind:'booked',
      catches:'Inverters down, batteries not charging, tripping systems', books:'Fault-finding, panel cleaning, system quotes, upgrades',
      safety:"Don't open the inverter. If it smells hot or smokes, isolate it if safe and call 10177.",
      lines:[['ai',"Hi, you've reached Ridgeway Solar. This call is recorded. How can I help?"],['caller',"My inverter keeps beeping and the batteries aren't charging from the panels."],['ai',"I can book a technician to check it. Does Tuesday at 9 or Wednesday at 2 suit you?"],['ai',"Booked for Tuesday at 9, Kevin. You'll get an SMS confirmation now."]],
      tags:[['mint','Booked'],['','Inverter fault'],['','Tue 09:00']],
      alert:'Inverter beeping, batteries not charging. Booked Tue 09:00.' },
    { key:'pest', plural:'pest controllers', log:[['16:45','Bee swarm at the front door · Randburg','red','Alerted'],['14:35','Rats in the roof · Randburg','mint','Booked'],['08:50','Termite contract quote · Centurion','amber','Callback']],
      label:'Pest control', icon:'t-pest', biz:'Ridgeway Pest Control', owner:'Lindiwe', caller:'Marie S', init:'MS', suburb:'Randburg', time:'14:35', kind:'booked',
      catches:'Bee swarms, wasp nests near entrances', books:'Rodents, termites, cockroaches, inspections, contracts',
      safety:'Keep people and pets away from swarms. Allergic reaction: call 10177.',
      lines:[['ai',"Hi, you've reached Ridgeway Pest Control. This call is recorded. How can I help?"],['caller',"We've got rats in the roof. We hear them every night."],['ai',"That's no fun. I can book an inspection. Thursday morning or Friday afternoon?"],['ai',"Thursday at 8 it is. Lindiwe will see you then, and you'll get an SMS confirmation."]],
      tags:[['mint','Booked'],['','Rodents'],['','Thu 08:00']],
      alert:'Rats in the roof. Inspection booked Thu 08:00.' },
    { key:'aircon', plural:'aircon technicians', log:[['07:55','Server-room unit down · Rosebank','red','Alerted'],['13:30','Aircon service · Fourways','mint','Booked'],['12:05','Quote for 2 office units · Sandton','amber','Callback']],
      label:'Aircon', icon:'t-air', biz:'Ridgeway Aircon', owner:'Ravi', caller:'Busi N', init:'BN', suburb:'Sandton', time:'12:05', kind:'callback',
      catches:'Server-room units down, units leaking over electrics', books:'Services, re-gassing, installs, quotes',
      safety:'Water near electrics: switch the unit off at the isolator if safe.',
      lines:[['ai',"Hi, you've reached Ridgeway Aircon. This call is recorded. How can I help?"],['caller',"I need a quote for two new aircon units in our office."],['ai',"Happy to help. Roughly how big are the rooms, and when would you like it done?"],['ai',"Thanks, Busi. Ravi will call you back today before 5 with a quote."]],
      tags:[['amber','Callback'],['','Quote request'],['','2 units']],
      alert:'Quote for 2 office aircon units. Call back before 17:00.' },
    { key:'locksmith', plural:'locksmiths', log:[['07:40','Locked out · Rosebank','red','Alerted'],['15:10','Lock change after a move · Northcliff','mint','Booked'],['11:25','Safe installation quote · Sandton','amber','Callback']],
      label:'Locksmith', icon:'t-lock', biz:'Ridgeway Locksmiths', owner:'Charl', caller:'Zanele K', init:'ZK', suburb:'Rosebank', time:'07:40', kind:'emergency',
      catches:'Lock-outs, break-in damage, keys snapped in locks', books:'Lock changes, safes, garage doors, duplicate keys',
      safety:'Checks the caller is safe. Break-in in progress: 10111.',
      lines:[['ai',"Hi, you've reached Ridgeway Locksmiths. This call is recorded. How can I help?"],['caller',"I've locked myself out and I need to get to work."],['ai',"Let's get you back in. Are you at the property now, and is it a house or a flat?"],['ai',"I've flagged it urgent. Charl will call within 10 minutes with an arrival time."]],
      tags:[['red','Urgent'],['','Locked out'],['','Rosebank']],
      alert:'Locked out of house, at the property. Call back within 10 min.' }
  ];

  /* ---------- your trade (remembered on this device) ---------- */
  var TRADE_KEY = 'rb_trade';
  RB.tradeByKey = function(k){ for (var i = 0; i < RB.TRADES.length; i++) if (RB.TRADES[i].key === k) return RB.TRADES[i]; return null; };
  RB.getTrade = function(){ var k = null; try { k = localStorage.getItem(TRADE_KEY); } catch (e) {} return RB.tradeByKey(k) ? k : null; };
  RB.setTrade = function(k){
    if (k && !RB.tradeByKey(k)) k = null;
    try { if (k) localStorage.setItem(TRADE_KEY, k); else localStorage.removeItem(TRADE_KEY); } catch (e) {}
    RB.applyTrade();
    document.dispatchEvent(new CustomEvent('rb:trade', { detail: k }));
  };
  RB.tradeSelect = function(id, cls){
    return '<select' + (id ? ' id="' + id + '"' : '') + ' class="' + (cls || '') + '" data-trade-select><option value="">All trades</option>' +
      RB.TRADES.map(function(t){ return '<option value="' + t.key + '">' + RB.esc(t.label) + '</option>'; }).join('') + '</select>';
  };
  /* Fill every [data-trade-*] spot on the page from the chosen trade, or put the page's own wording back. */
  RB.applyTrade = function(){
    var t = RB.tradeByKey(RB.getTrade());
    document.querySelectorAll('[data-trade-select]').forEach(function(sel){ sel.value = t ? t.key : ''; });
    document.querySelectorAll('[data-trade-text]').forEach(function(el){
      if (el.dataset.def == null) el.dataset.def = el.textContent;
      el.textContent = t ? t[el.dataset.tradeText] : el.dataset.def;
    });
    document.querySelectorAll('[data-trade-sms]').forEach(function(el){
      if (el.dataset.def == null) el.dataset.def = el.innerHTML;
      var label = { emergency:'EMERGENCY', booked:'NEW BOOKING', callback:'CALLBACK' }, color = { emergency:'red', booked:'mint', callback:'amber' };
      el.innerHTML = t ? '<b style="color:var(--' + color[t.kind] + ')">' + label[t.kind] + '</b> · ' + RB.esc(t.caller) + ' · ' + RB.esc(t.suburb) + '<br>' + RB.esc(t.alert) : el.dataset.def;
    });
    document.querySelectorAll('[data-trade-log]').forEach(function(el){
      if (el.dataset.def == null) el.dataset.def = el.innerHTML;
      el.innerHTML = t ? t.log.map(function(r){ return '<div><time>' + r[0] + '</time><span>' + RB.esc(r[1]) + '</span><span class="tag ' + r[2] + '">' + r[3] + '</span></div>'; }).join('') : el.dataset.def;
    });
  };
  document.addEventListener('change', function(e){ if (e.target.matches && e.target.matches('[data-trade-select]')) RB.setTrade(e.target.value); });

  /* ---------- header ---------- */
  var NAV = [['product.html','Product'],['trades.html','Trades'],['pricing.html','Pricing'],['index.html#try','Live demo'],['faq.html','FAQ'],['about.html','About'],['contact.html','Contact']];
  var isIn = RB.loggedIn();
  function navLinks(){ return NAV.map(function(n){ var cur = n[0].split('#')[0] === page + '.html' && n[0].indexOf('#') < 0; return '<a href="' + n[0] + '"' + (cur ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join(''); }
  var ctas = isIn
    ? '<a class="btn btn-hot btn-sm" href="dashboard.html" aria-label="Dashboard">' + RB.icon('i-home') + '<span class="lbl-sm">Dashboard</span></a>'
    : '<a class="btn btn-line btn-sm hide-sm" href="login.html">Log in</a><a class="btn btn-hot btn-sm" href="login.html?mode=signup">Get started</a>';
  var drawerCtas = isIn
    ? '<div class="drawer-cta" style="grid-template-columns:1fr"><a class="btn btn-hot" href="dashboard.html">Go to dashboard</a></div>'
    : '<div class="drawer-cta"><a class="btn btn-line" href="login.html">Log in</a><a class="btn btn-hot" href="login.html?mode=signup">Get started</a></div>';
  var header = document.getElementById('site-header');
  if (header) {
    header.className = 'nav';
    header.innerHTML =
      '<div class="nav-in"><a class="logo" href="index.html" aria-label="Ringback home">' + LOGO + '</a>' +
      '<nav class="links" aria-label="Main">' + navLinks() + '</nav>' +
      '<div class="nav-cta">' + ctas + '<button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="drawer" aria-label="Open menu">' + RB.icon('i-menu') + '</button></div></div>' +
      '<nav class="drawer" id="drawer" aria-label="Menu" hidden><label class="drawer-trade"><span>Your trade</span>' + RB.tradeSelect('') + '</label>' + navLinks() + drawerCtas + '</nav>';
    var menuBtn = document.getElementById('menuBtn'), drawer = document.getElementById('drawer');
    menuBtn.addEventListener('click', function(){ var open = drawer.hidden; drawer.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.innerHTML = RB.icon(open ? 'i-close' : 'i-menu'); });
    drawer.addEventListener('click', function(e){ if (e.target.closest('a')) { drawer.hidden = true; menuBtn.setAttribute('aria-expanded','false'); menuBtn.innerHTML = RB.icon('i-menu'); } });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !drawer.hidden) { drawer.hidden = true; menuBtn.setAttribute('aria-expanded','false'); menuBtn.innerHTML = RB.icon('i-menu'); menuBtn.focus(); } });
  }

  /* ---------- footer ---------- */
  var footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    var tradeLinks = RB.TRADES.map(function(t){ return '<li><a href="trades.html#' + t.key + '">' + t.label + '</a></li>'; }).join('');
    footer.innerHTML =
      '<div class="wrap"><div class="foot">' +
        '<div><a class="logo" href="index.html">' + LOGO + '</a><p>The AI receptionist for home-service trades in Gauteng. Every call answered, every job booked.</p>' +
          '<div style="display:grid;gap:8px;margin-top:18px" class="mono"><a href="' + RB.wa('Hi Ringback') + '" target="_blank" rel="noopener">WhatsApp ' + RB.esc(C.phoneDisplay) + '</a>' + (C.email ? '<a href="mailto:' + RB.esc(C.email) + '">' + RB.esc(C.email) + '</a>' : '') + '<span>Johannesburg · Pretoria · East Rand</span></div></div>' +
        '<div><h4>Product</h4><ul><li><a href="product.html">How it works</a></li><li><a href="product.html#features">Features</a></li><li><a href="index.html#try">Live demo</a></li><li><a href="pricing.html">Pricing</a></li><li><a href="pricing.html#calculator">Calculator</a></li></ul></div>' +
        '<div><h4>Trades</h4><ul>' + tradeLinks + '</ul></div>' +
        '<div><h4>Company</h4><ul><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li><li><a href="faq.html">FAQ</a></li><li><a href="login.html">Log in</a></li><li><a href="login.html?mode=signup">Create an account</a></li></ul></div>' +
        '<div><h4>Legal</h4><ul><li><a href="privacy.html">Privacy policy</a></li><li><a href="terms.html">Terms of service</a></li><li><a href="privacy.html#recordings">Call recordings</a></li><li><a href="privacy.html#rights">Your POPIA rights</a></li></ul></div>' +
      '</div>' +
      '<div class="foot-b"><span>© ' + new Date().getFullYear() + ' Ringback. Prices exclude VAT.</span><span>Businesses named "Ridgeway" on this site are fictional demo businesses.</span></div>' +
      '<div class="wordmark" aria-hidden="true">Ringback</div></div>';
  }

  /* ---------- floating WhatsApp ---------- */
  if (!document.body.hasAttribute('data-no-float') && C.whatsapp) {
    var wa = document.createElement('a');
    wa.className = 'wa-float'; wa.href = RB.wa('Hi Ringback, I have a question.'); wa.target = '_blank'; wa.rel = 'noopener';
    wa.setAttribute('aria-label', 'Chat to us on WhatsApp'); wa.innerHTML = RB.icon('i-wa');
    document.body.appendChild(wa);
  }

  /* ---------- phone action bar ----------
     On small screens a bottom bar (trial, ask, WhatsApp) replaces the floating buttons. It slides in once
     the page hero has scrolled away, so it never covers the headline. */
  var mbar = null;
  if (!document.body.hasAttribute('data-no-float')) {
    mbar = document.createElement('div');
    mbar.className = 'mbar'; mbar.setAttribute('role', 'region'); mbar.setAttribute('aria-label', 'Quick actions');
    mbar.innerHTML = (isIn ? '<a class="btn btn-hot" href="dashboard.html">Go to dashboard</a>' : '<a class="btn btn-hot" href="login.html?mode=signup">Start free trial ' + RB.icon('i-arrow') + '</a>') +
      (!document.body.hasAttribute('data-no-ai') && C.vapiPublicKey ? '<button class="mbar-ic" type="button" data-open-ai aria-label="Ask the Ringback assistant">' + RB.icon('i-mic') + '</button>' : '') +
      (C.whatsapp ? '<a class="mbar-ic wa" href="' + RB.wa('Hi Ringback, I have a question.') + '" target="_blank" rel="noopener" aria-label="Chat to us on WhatsApp">' + RB.icon('i-wa') + '</a>' : '');
    document.body.appendChild(mbar);
    var small = window.matchMedia('(max-width: 700px)');
    var syncBar = function(){ document.body.classList.toggle('has-mbar', small.matches); };
    if (small.addEventListener) small.addEventListener('change', syncBar); syncBar();
    var heroEl = document.querySelector('.hero, .phero, .nf');
    if (heroEl && 'IntersectionObserver' in window) new IntersectionObserver(function(en){ mbar.classList.toggle('show', !en[0].isIntersecting); }, { rootMargin: '-90px 0px 0px 0px' }).observe(heroEl);
    else { var barScroll = function(){ mbar.classList.toggle('show', window.scrollY > 300); }; window.addEventListener('scroll', barScroll, { passive: true }); barScroll(); }
  }

  /* ---------- fill contact placeholders ---------- */
  document.querySelectorAll('[data-wa]').forEach(function(a){ a.href = RB.wa(a.getAttribute('data-wa')); a.target = '_blank'; a.rel = 'noopener'; });
  document.querySelectorAll('[data-phone]').forEach(function(el){ el.textContent = C.phoneDisplay; });
  document.querySelectorAll('[data-tel]').forEach(function(a){ a.href = 'tel:' + C.phoneTel; });
  document.querySelectorAll('[data-email]').forEach(function(el){ if (C.email) { el.textContent = C.email; if (el.tagName === 'A') el.href = 'mailto:' + C.email; } else { var card = el.closest('[data-email-card]'); if (card) card.hidden = true; } });

  /* ---------- progress bar + spotlight ---------- */
  var prog = document.createElement('div'); prog.className = 'progress'; prog.setAttribute('aria-hidden','true'); document.body.appendChild(prog);
  function onScroll(){ var h = document.documentElement; prog.style.setProperty('--sp', (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)).toFixed(4)); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.addEventListener('pointermove', function(e){
    var el = e.target.closest && e.target.closest('.spot'); if (!el) return;
    var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------- section headings build in word by word ----------
     Desktop only, first time each heading is seen. Phones and reduced-motion just show the heading. */
  var revealOK = !reduced && window.matchMedia('(hover: hover) and (min-width: 701px)').matches && 'IntersectionObserver' in window;
  RB.splitWords = function(h){
    var n = 0;
    (function walk(el, hot){
      [].slice.call(el.childNodes).forEach(function(node){
        if (node.nodeType === 3) {
          var frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function(part){
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w' + (hot ? ' hot' : ''); w.style.setProperty('--i', n++); w.textContent = part; frag.appendChild(w);
          });
          node.parentNode.replaceChild(frag, node);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          /* a gradient word group: give each word its own gradient so it survives being split */
          var isHot = node.classList.contains('hot');
          if (isHot) node.classList.remove('hot');
          walk(node, hot || isHot);
        }
      });
    })(h, false);
  };
  if (revealOK) {
    var heads = [].filter.call(document.querySelectorAll('main h2'), function(h){ return !h.closest('.app, .prose, .paper, .faq') && !h.classList.contains('faq-cat'); });
    var hio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting) { hio.unobserve(en.target); en.target.classList.add('is-in'); } });
    }, { threshold: .3 });
    heads.forEach(function(h){ RB.splitWords(h); h.classList.add('wr'); hio.observe(h); });
  }

  /* ---------- count-up (final numbers are shown at rest) ---------- */
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var el = en.target, end = +el.dataset.count, t0 = performance.now();
        (function tick(now){ var k = Math.min(1, (now - t0) / 1100); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); })(t0);
      });
    }, { threshold: .6 });
    document.querySelectorAll('[data-count]').forEach(function(el){ io.observe(el); });
  }

  /* ---------- trade grid (links to trades page); your trade comes first ---------- */
  var grid = document.getElementById('tradeGrid');
  RB.tradesInOrder = function(){ var k = RB.getTrade(); return RB.TRADES.filter(function(t){ return t.key === k; }).concat(RB.TRADES.filter(function(t){ return t.key !== k; })); };
  function buildGrid(){
    var mine = RB.getTrade();
    grid.innerHTML = '';
    RB.tradesInOrder().forEach(function(t){
      var a = document.createElement('a'); a.className = 'trade spot rv' + (t.key === mine ? ' mine' : ''); a.href = 'trades.html#' + t.key;
      a.innerHTML = '<span class="ic">' + RB.icon(t.icon) + '</span>' + (t.key === mine ? '<span class="tag ember mine-tag">Your trade</span>' : '') + '<h3>' + RB.esc(t.label) + '</h3><dl><div><dt class="e">Escalates</dt><dd>' + RB.esc(t.catches) + '</dd></div><div><dt class="r">Books</dt><dd>' + RB.esc(t.books) + '</dd></div></dl><span class="go">See how it works ' + RB.icon('i-arrow') + '</span>';
      grid.appendChild(a);
    });
    var more = document.createElement('a'); more.className = 'trade more spot rv'; more.href = 'contact.html';
    more.innerHTML = '<h3>Another trade?</h3><p class="muted" style="font-size:.92rem">Roofers, glaziers, pool services, appliance repairs, garage doors. If customers phone you, we can set it up.</p><span class="go">Talk to us ' + RB.icon('i-arrow') + '</span>';
    grid.appendChild(more);
  }
  if (grid) { buildGrid(); document.addEventListener('rb:trade', buildGrid); }

  /* ---------- calculator ---------- */
  if (document.getElementById('calc')) {
    var ids = ['missed','real','win','value'];
    var $ = function(id){ return document.getElementById(id); };
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
  var spots = document.getElementById('spots');
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

  /* ---------- FAQ search ---------- */
  var fs = document.getElementById('faqSearch');
  if (fs) {
    fs.addEventListener('input', function(){
      var q = fs.value.trim().toLowerCase(), any = false;
      document.querySelectorAll('.faq details').forEach(function(d){ var hit = !q || d.textContent.toLowerCase().indexOf(q) >= 0; d.hidden = !hit; if (hit) any = true; if (q && hit) d.open = true; });
      document.querySelectorAll('.faq-cat').forEach(function(h){ var n = h.nextElementSibling, vis = false; while (n && !n.classList.contains('faq-cat')) { if (n.tagName === 'DETAILS' && !n.hidden) vis = true; n = n.nextElementSibling; } h.hidden = !vis; });
      var none = document.getElementById('faqNone'); if (none) none.hidden = any;
    });
  }


  /* ---------- "Hear a real call": sample-call audio with a synced transcript ----------
     RB.callAudio(trade, { mount, lines, onPlay, onEnd }) puts a player in `mount` once audio/<key>.mp3 loads.
     If the file is missing the player stays hidden and the transcript works as plain text. */
  var audioOK = {}, nowPlaying = null;
  function fmt(sec){ sec = Math.max(0, Math.floor(sec || 0)); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  RB.callAudio = function(t, o){
    var src = t.audio || ('audio/' + t.key + '.mp3'), mount = o.mount, a = null, dead = false, cues = null;
    mount.hidden = true; mount.innerHTML = '';
    if (audioOK[src] === false) return { destroy: function(){} };
    a = new Audio(); a.preload = 'metadata';
    function lineEls(){ return o.lines ? [].slice.call(o.lines.children) : []; }
    function estimate(dur){
      var w = t.lines.map(function(l){ return l[1].length + 25; }), sum = w.reduce(function(x, y){ return x + y; }, 0), at = 0;
      return w.map(function(x){ var c = at; at += x / sum * dur; return c; });
    }
    function current(){ var i = 0; for (var k = 0; k < cues.length; k++) if (a.currentTime >= cues[k] - 0.05) i = k; return i; }
    function mark(){
      var i = current(), playing = !a.paused || a.currentTime > 0;
      lineEls().forEach(function(el, k){ el.classList.toggle('on', playing && k === i); });
      seek.value = a.currentTime; time.textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration);
      seek.style.setProperty('--p', (a.currentTime / (a.duration || 1) * 100) + '%');
    }
    var btn, seek, time;
    function setBtn(){ var on = !a.paused; btn.innerHTML = RB.icon(on ? 'i-pause' : 'i-play'); btn.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' the example ' + t.label.toLowerCase() + ' call'); mount.classList.toggle('playing', on); }
    function play(){ if (o.onPlay) o.onPlay(); var pr = a.play(); if (pr && pr.catch) pr.catch(function(){}); }
    a.addEventListener('loadedmetadata', function(){
      if (dead) return;
      audioOK[src] = true;
      cues = (t.cues && t.cues.length === t.lines.length) ? t.cues : estimate(a.duration);
      mount.innerHTML = '<button type="button" class="hear-btn"></button><div class="hear-mid"><span class="hear-t">Hear this call <span class="faint">· example recording</span></span><input type="range" class="hear-seek" min="0" step="0.1" aria-label="Position in the recording"></div><span class="hear-time mono"></span>';
      btn = mount.querySelector('.hear-btn'); seek = mount.querySelector('.hear-seek'); time = mount.querySelector('.hear-time');
      seek.max = a.duration; setBtn(); mark();
      btn.addEventListener('click', function(){ if (a.paused) play(); else a.pause(); });
      seek.addEventListener('input', function(){ a.currentTime = +seek.value; mark(); });
      /* each transcript line becomes a button that jumps the recording to that line */
      lineEls().forEach(function(el, k){
        var b = document.createElement('button'); b.type = 'button'; b.className = el.className + ' seekable'; b.innerHTML = el.innerHTML;
        b.setAttribute('aria-label', 'Play from: ' + el.textContent);
        b.addEventListener('click', function(){ a.currentTime = cues[k]; play(); mark(); });
        el.parentNode.replaceChild(b, el);
      });
      mount.hidden = false;
    });
    a.addEventListener('error', function(){ audioOK[src] = false; mount.hidden = true; });
    a.addEventListener('play', function(){ if (nowPlaying && nowPlaying !== a) nowPlaying.pause(); nowPlaying = a; });
    ['play','pause'].forEach(function(ev){ a.addEventListener(ev, function(){ if (btn) { setBtn(); mark(); } }); });
    a.addEventListener('timeupdate', function(){ if (btn) mark(); });
    a.addEventListener('ended', function(){ lineEls().forEach(function(el){ el.classList.remove('on'); }); if (o.onEnd) o.onEnd(); });
    a.src = src;
    return { audio: a, destroy: function(){ dead = true; a.pause(); a.removeAttribute('src'); a.load(); mount.hidden = true; mount.innerHTML = ''; } };
  };

  /* ---------- call-forwarding guide ----------
     Standard GSM forwarding codes (the 3GPP "MMI" codes most South African networks use).
     PLEASE VERIFY each network against its current help pages, or by dialling the code, before relying on it,
     then set verified to the date you checked (e.g. verified:'2026-10-12'). Until then the guide says plainly
     that the code is the standard one and hasn't been confirmed for that network. Some contracts and
     prepaid packages block forwarding, and the network bills forwarded calls at your normal rates. */
  RB.FORWARD = {
    networks: [
      { key:'vodacom', name:'Vodacom', verified:null },
      { key:'mtn', name:'MTN', verified:null },
      { key:'cellc', name:'Cell C', verified:null },
      { key:'telkom', name:'Telkom', verified:null }
    ],
    /* {n} is the number to forward to, {s} the ring time in seconds before forwarding (5–30). */
    types: [
      { key:'missed', label:'All missed calls', hint:'Busy, no answer and unreachable in one go. What Ringback normally uses.', on:'**004*{n}**{s}#', off:'##004#', ring:true },
      { key:'noanswer', label:'No answer', hint:"Rings for a while first, then forwards.", on:'**61*{n}**{s}#', off:'##61#', ring:true },
      { key:'busy', label:'When busy', hint:"When you're on another call or decline it.", on:'**67*{n}#', off:'##67#' },
      { key:'unreachable', label:'Unreachable', hint:'Phone off, flat battery or no signal.', on:'**62*{n}#', off:'##62#' },
      { key:'all', label:'All calls', hint:"Every call forwards and your phone won't ring. Handy on leave.", on:'**21*{n}#', off:'##21#' }
    ],
    /* overrides for a network whose codes differ, e.g. mtn:{ busy:{ on:'...', off:'...' } } */
    overrides: {}
  };
  var fwdN = 0;
  RB.forwardGuide = function(el){
    var F = RB.FORWARD, id = 'fw' + (++fwdN);
    var chips = function(name, list, sel){ return '<div class="chips" role="radiogroup">' + list.map(function(x){ return '<label><input type="radio" name="' + id + name + '" value="' + x.key + '"' + (x.key === sel ? ' checked' : '') + '><span>' + RB.esc(x.name || x.label) + '</span></label>'; }).join('') + '</div>'; };
    el.classList.add('fwd');
    el.innerHTML =
      '<div class="fwd-in form">' +
        '<div class="fld"><span id="' + id + 'nl">Your network</span>' + chips('net', F.networks, 'vodacom').replace('role="radiogroup"', 'role="radiogroup" aria-labelledby="' + id + 'nl"') + '</div>' +
        '<div class="fld"><span id="' + id + 'tl">When should calls forward?</span>' + chips('type', F.types, 'missed').replace('role="radiogroup"', 'role="radiogroup" aria-labelledby="' + id + 'tl"') + '<small class="fwd-hint"></small></div>' +
        '<div class="two"><label class="fld"><span>Number to forward to <small>the Ringback number we give you</small></span><input type="tel" inputmode="tel" autocomplete="off" class="fwd-num" placeholder="e.g. 010 123 4567" maxlength="20"></label>' +
        '<label class="fld fwd-ring"><span>Ring for</span><select class="fwd-sec">' + [5,10,15,20,25,30].map(function(x){ return '<option value="' + x + '"' + (x === 20 ? ' selected' : '') + '>' + x + ' seconds</option>'; }).join('') + '</select></label></div>' +
      '</div>' +
      '<div class="fwd-out" aria-live="polite">' +
        '<div class="fwd-code"><span class="lbl">Dial this to switch it on</span><div class="fwd-row"><code class="fwd-on"></code><button type="button" class="icon-btn fwd-copy" data-which="on" aria-label="Copy the code to switch forwarding on">' + RB.icon('i-copy') + '</button></div></div>' +
        '<div class="fwd-code"><span class="lbl">Dial this to switch it off</span><div class="fwd-row"><code class="fwd-off"></code><button type="button" class="icon-btn fwd-copy" data-which="off" aria-label="Copy the code to switch forwarding off">' + RB.icon('i-copy') + '</button></div></div>' +
        '<p class="fwd-note"></p>' +
      '</div>';
    var q = function(s){ return el.querySelector(s); };
    function render(){
      var net = F.networks.filter(function(x){ return x.key === q('[name=' + id + 'net]:checked').value; })[0];
      var type = F.types.filter(function(x){ return x.key === q('[name=' + id + 'type]:checked').value; })[0];
      var ov = (F.overrides[net.key] || {})[type.key] || {};
      var raw = q('.fwd-num').value.replace(/[^\d+]/g, ''), ok = /^(\+27|0)\d{9}$/.test(raw);
      var num = ok ? raw : '[number]', sec = q('.fwd-sec').value;
      q('.fwd-hint').textContent = type.hint;
      q('.fwd-ring').hidden = !type.ring;
      q('.fwd-on').textContent = (ov.on || type.on).replace('{n}', num).replace('{s}', sec);
      q('.fwd-off').textContent = ov.off || type.off;
      q('.fwd-on').classList.toggle('faint', !ok);
      q('[data-which=on]').disabled = !ok;
      q('.fwd-note').innerHTML = (net.verified
        ? 'Checked with ' + RB.esc(net.name) + ' on ' + RB.esc(net.verified) + '. '
        : '<b>Standard code, not yet confirmed for ' + RB.esc(net.name) + '.</b> Most networks use it, but check with ' + RB.esc(net.name) + ' if it doesn\'t work, or <a href="' + RB.wa('Hi Ringback, can you help me set up call forwarding on ' + net.name + '?') + '" target="_blank" rel="noopener">let us set it up with you</a>. ') +
        'You should see a confirmation on screen after dialling. Forwarded calls are billed by your network at your normal rates.' + (ok ? '' : ' Enter the number to forward to and the code will fill in.');
    }
    el.addEventListener('input', render); el.addEventListener('change', render);
    el.querySelectorAll('.fwd-copy').forEach(function(b){ b.addEventListener('click', function(){ RB.copy(q(b.dataset.which === 'on' ? '.fwd-on' : '.fwd-off').textContent, b); }); });
    render();
  };
  document.querySelectorAll('[data-forward-guide]').forEach(RB.forwardGuide);

  /* ---------- AI assistant (Vapi widget) ---------- */
  function openAI(){
    var w = document.querySelector('vapi-widget');
    var launcher = w && w.querySelector('.vapi-widget-wrapper [style*="cursor: pointer"]');
    if (w && w.querySelectorAll('button').length) return;
    if (launcher) { launcher.click(); return; }
    location.href = 'index.html#try';
  }
  RB.openAI = openAI;
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-open-ai]'); if (b) { e.preventDefault(); openAI(); } });
  var prompts = document.getElementById('prompts');
  if (prompts) [].forEach.call(prompts.children, function(b){
    b.addEventListener('click', function(){
      var done = function(){ b.classList.add('copied'); setTimeout(function(){ b.classList.remove('copied'); }, 1600); };
      try { navigator.clipboard.writeText(b.textContent).then(done, done); } catch (e) { done(); }
      openAI();
    });
  });
  if (!document.body.hasAttribute('data-no-ai') && C.vapiPublicKey) {
    var vw = document.createElement('vapi-widget');
    var attrs = { 'public-key':C.vapiPublicKey, 'assistant-id':C.vapiAssistantId, mode:'hybrid', theme:'dark', position:'bottom-right', 'border-radius':'large', 'base-bg-color':'#0B1716', 'accent-color':'#FF7A3D', 'cta-button-color':'#FF7A3D', 'cta-button-text-color':'#160A04', title:'Ask Ringback', 'cta-title':'Ask Ringback', 'cta-subtitle':'Chat, talk, or try the demo', 'start-button-text':'Talk to the assistant', 'end-button-text':'End call',
      'chat-first-message':"Hi, I'm the Ringback assistant. Ask me anything, or type 'try the demo' and pick a trade to hear how I'd handle your calls.",
      'hybrid-empty-message':"Type a question, or tap the mic to talk. Say 'try the demo' to hear it take a call for your trade.",
      'chat-placeholder':'Ask about pricing, setup, POPIA...', 'voice-show-transcript':'true', 'consent-required':'true', 'consent-title':'Before we start',
      'consent-content':"This chat or call is handled by an AI assistant and is recorded so we can reply and follow up with you. Please don't share sensitive personal information. By continuing you agree to this and to our privacy policy.",
      'consent-storage-key':'ringback_consent' };
    Object.keys(attrs).forEach(function(k){ vw.setAttribute(k, attrs[k]); });
    document.body.appendChild(vw);
    /* the collapsed launcher has no buttons; once a chat opens it does. CSS hides the collapsed launcher on phones,
       where the action bar's Ask button opens it instead. */
    var syncVw = function(){ vw.classList.toggle('closed', !vw.querySelector('button')); };
    syncVw();
    if ('MutationObserver' in window) new MutationObserver(syncVw).observe(vw, { childList: true, subtree: true });
    var sc = document.createElement('script'); sc.src = 'https://unpkg.com/@vapi-ai/client-sdk-react@0.1.1/dist/embed/widget.umd.js'; sc.async = true; document.body.appendChild(sc);
  }
  RB.applyTrade();
})();
