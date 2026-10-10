/* Owner-only admin: clients, website enquiries and account requests. Access is enforced by the database. */
(async function(){
  var RB = window.RB, sb = RB.sb, $ = function(id){ return document.getElementById(id); };
  var user = await RB.requireUser(); if (!user) return;
  var isAdmin = await sb.rpc('is_admin');
  if (isAdmin.data !== true) { $('noAccess').hidden = false; return; }
  $('adminBody').hidden = false;

  var STATUSES = ['new','setting_up','trial','live','paused'];
  var REQUIRED = ['service_areas','hours','callout_weekday'];
  var LABELS = { owner_name:'Owner name', services:'Services', not_offered:'Not offered', service_areas:'Service areas', excluded_areas:'Excluded areas', hours:'Hours', after_hours:'After-hours emergencies', callout_weekday:'Call-out (weekday)', callout_after:'Call-out (after hours)', emergencies:'Emergencies', callback_promise:'Callback promise (min)', booking:'Booking', calendar_email:'Calendar email', languages:'Languages', always_say:'Always say', never_say:'Never say', notes:'Notes' };
  var data = { clients: [], leads: [], reqs: [] };
  function d(x){ return x ? new Date(x).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'; }
  function waNum(p){ var n = String(p || '').replace(/\D/g, ''); if (n.indexOf('0') === 0) n = '27' + n.slice(1); return n; }
  function waLink(p, text){ var n = waNum(p); return n.length >= 10 ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '') : null; }

  async function load(){
    var r = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('leads').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('requests').select('*').order('created_at', { ascending: false }).limit(200)
    ]);
    data.clients = r[0].data || []; data.leads = r[1].data || []; data.reqs = r[2].data || [];
    render();
  }
  function render(){
    var c = data.clients;
    $('adminKpis').innerHTML = [['Clients', c.length, true], ['Trials requested', c.filter(function(x){ return x.trial_requested_at && x.status === 'new'; }).length], ['Live', c.filter(function(x){ return x.status === 'live'; }).length], ['New enquiries', data.leads.filter(function(x){ return !x.handled; }).length]]
      .map(function(k){ return '<div class="kpi' + (k[2] ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('');

    $('clientsBox').innerHTML = !c.length ? '<div class="empty"><h3>No clients yet</h3><p>Sign-ups appear here.</p></div>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>Business</th><th>Contact</th><th>Trade</th><th>Plan</th><th>Setup</th><th>Trial requested</th><th>Status</th><th></th></tr></thead><tbody>' +
      c.map(function(x, i){
        var s = x.setup || {}, n = [x.business_name, x.trade, x.phone].concat(REQUIRED.map(function(k){ return s[k]; })).filter(function(v){ return v && String(v).trim(); }).length;
        var wa = waLink(x.phone, 'Hi ' + ((x.full_name || '').split(' ')[0] || '') + ', it\'s Ringback.');
        return '<tr><td><b>' + RB.esc(x.business_name || '—') + '</b><br><span class="faint mono">Joined ' + d(x.created_at) + '</span></td>' +
          '<td>' + RB.esc(x.full_name || '—') + '<br><span class="faint mono">' + RB.esc(x.email || '') + '</span>' + (x.phone ? '<br><span class="mono">' + RB.esc(x.phone) + '</span>' : '') + '</td>' +
          '<td>' + RB.esc(x.trade || '—') + '</td><td>' + RB.esc(x.plan || '—') + '</td><td class="mono">' + Math.round(n / 6 * 100) + '%</td><td class="mono">' + d(x.trial_requested_at) + '</td>' +
          '<td><select data-status="' + x.id + '" aria-label="Status for ' + RB.esc(x.business_name || '') + '">' + STATUSES.map(function(st){ return '<option' + (st === x.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></td>' +
          '<td style="white-space:nowrap"><button class="btn btn-line btn-sm" type="button" data-view="' + i + '">Details</button>' + (wa ? ' <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    $('clientsBox').querySelectorAll('[data-status]').forEach(function(sel){
      sel.addEventListener('change', async function(){
        var r = await sb.from('profiles').update({ status: sel.value }).eq('id', sel.dataset.status);
        RB.toast(r.error ? 'Couldn\'t update status' : 'Status set to ' + sel.value, r.error ? 'err' : 'ok');
      });
    });
    $('clientsBox').querySelectorAll('[data-view]').forEach(function(b){ b.addEventListener('click', function(){ showClient(c[+b.dataset.view]); }); });

    var l = data.leads;
    $('leadsBox').innerHTML = !l.length ? '<div class="empty"><h3>No enquiries yet</h3><p>Messages from the contact form appear here.</p></div>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Name</th><th>Business</th><th>Phone / email</th><th>Message</th><th>Done</th></tr></thead><tbody>' +
      l.map(function(x){
        var wa = waLink(x.phone, 'Hi ' + (x.name || '').split(' ')[0] + ', thanks for contacting Ringback.');
        return '<tr' + (x.handled ? ' style="opacity:.55"' : '') + '><td class="mono">' + d(x.created_at) + '</td><td><b>' + RB.esc(x.name) + '</b></td><td>' + RB.esc(x.business || '—') + '<br><span class="faint">' + RB.esc([x.trade, x.area].filter(Boolean).join(' · ')) + '</span></td>' +
          '<td>' + (wa ? '<a class="link" target="_blank" rel="noopener" href="' + wa + '">' + RB.esc(x.phone) + '</a>' : RB.esc(x.phone || '—')) + (x.email ? '<br><span class="faint mono">' + RB.esc(x.email) + '</span>' : '') + '</td>' +
          '<td style="max-width:360px">' + RB.esc(x.message || '—') + '</td><td><input type="checkbox" data-lead="' + x.id + '"' + (x.handled ? ' checked' : '') + ' aria-label="Mark handled" style="width:18px;height:18px;accent-color:var(--ember)"></td></tr>';
      }).join('') + '</tbody></table></div>';
    $('leadsBox').querySelectorAll('[data-lead]').forEach(function(cb){
      cb.addEventListener('change', async function(){ var r = await sb.from('leads').update({ handled: cb.checked }).eq('id', cb.dataset.lead); if (r.error) RB.toast('Couldn\'t update', 'err'); else { data.leads.forEach(function(x){ if (String(x.id) === cb.dataset.lead) x.handled = cb.checked; }); render(); } });
    });

    var q = data.reqs, byId = {}; c.forEach(function(x){ byId[x.id] = x; });
    $('reqBox').innerHTML = !q.length ? '<div class="empty"><h3>No requests</h3><p>Deletion and support requests from clients appear here.</p></div>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Client</th><th>Request</th><th>Note</th><th>Done</th></tr></thead><tbody>' +
      q.map(function(x){ var who = byId[x.user_id] || {}; return '<tr' + (x.handled ? ' style="opacity:.55"' : '') + '><td class="mono">' + d(x.created_at) + '</td><td>' + RB.esc(who.business_name || who.email || x.user_id) + '</td><td><span class="tag ' + (x.kind === 'delete_account' ? 'red' : '') + '">' + RB.esc(x.kind) + '</span></td><td>' + RB.esc(x.note || '—') + '</td><td><input type="checkbox" data-req="' + x.id + '"' + (x.handled ? ' checked' : '') + ' aria-label="Mark handled" style="width:18px;height:18px;accent-color:var(--ember)"></td></tr>'; }).join('') + '</tbody></table></div>';
    $('reqBox').querySelectorAll('[data-req]').forEach(function(cb){
      cb.addEventListener('change', async function(){ var r = await sb.from('requests').update({ handled: cb.checked }).eq('id', cb.dataset.req); if (r.error) RB.toast('Couldn\'t update', 'err'); });
    });
  }
  function showClient(x){
    var s = x.setup || {};
    var rows = [['Business', x.business_name], ['Name', x.full_name], ['Email', x.email], ['Cell', x.phone], ['Trade', x.trade], ['Plan', x.plan], ['Status', x.status], ['Trial requested', d(x.trial_requested_at)]]
      .concat(Object.keys(LABELS).map(function(k){ var v = s[k]; return [LABELS[k], Array.isArray(v) ? v.join(', ') : v]; }));
    var sheet = document.createElement('div'); sheet.className = 'sheet';
    sheet.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-label="Client details"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="font-size:1.6rem">' + RB.esc(x.business_name || 'Client') + '</h2><button class="btn btn-line btn-sm" type="button" data-close>Close</button></div>' +
      '<dl class="kv">' + rows.map(function(r){ return '<dt>' + RB.esc(r[0]) + '</dt><dd>' + RB.esc(r[1] || '—') + '</dd>'; }).join('') + '</dl>' +
      '<button class="btn btn-line btn-sm" type="button" data-copy style="justify-self:start">Copy setup as text</button></div>';
    document.body.appendChild(sheet);
    var close = function(){ sheet.remove(); };
    sheet.addEventListener('click', function(e){ if (e.target === sheet || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    sheet.querySelector('[data-copy]').addEventListener('click', function(){
      var text = rows.map(function(r){ return r[0] + ': ' + (r[1] || '—'); }).join('\n');
      try { navigator.clipboard.writeText(text).then(function(){ RB.toast('Copied', 'ok'); }, function(){ RB.toast('Copy failed', 'err'); }); } catch (e) { RB.toast('Copy failed', 'err'); }
    });
    sheet.querySelector('[data-close]').focus();
  }
  $('refreshBtn').addEventListener('click', load);
  load();
})();
