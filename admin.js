/* Owner-only admin: clients, billing, website enquiries and account requests. Access is enforced by the database. */
(async function(){
  var RB = window.RB, sb = RB.sb, $ = function(id){ return document.getElementById(id); };
  var user = await RB.requireUser(); if (!user) return;
  var isAdmin = await sb.rpc('is_admin');
  $('adminLoading').hidden = true;
  if (isAdmin.data !== true) { $('noAccess').hidden = false; return; }
  $('adminBody').hidden = false;

  var PLANS = RB.PLANS;
  var STATUSES = ['new','setting_up','trial','live','paused'];
  var REQUIRED = ['service_areas','hours','callout_weekday'];
  var LABELS = { owner_name:'Owner name', services:'Services', not_offered:'Not offered', service_areas:'Service areas', excluded_areas:'Excluded areas', hours:'Hours', after_hours:'After-hours emergencies', callout_weekday:'Call-out (weekday)', callout_after:'Call-out (after hours)', emergencies:'Emergencies', callback_promise:'Callback promise (min)', booking:'Booking', calendar_email:'Calendar email', languages:'Languages', always_say:'Always say', never_say:'Never say', notes:'Notes' };
  var INV = { due:['amber','Due'], overdue:['red','Overdue'], pending:['ember','To confirm'], paid:['mint','Paid'], void:['','Cancelled'] };
  var data = { clients: [], leads: [], reqs: [], invoices: [], billing: {} }, filter = 'open';

  function d(x){ return x ? new Date(x).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'; }
  function dd(x){ if (!x) return '—'; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x); var dt = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(x); return dt.toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }); }
  function ymd(dt){ return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function period(dt){ return ymd(dt).slice(0, 7); }
  function monthName(p){ var m = /^(\d{4})-(\d{2})$/.exec(p || ''); return m ? new Date(+m[1], m[2] - 1, 1).toLocaleDateString('en-ZA', { month:'long', year:'numeric' }) : ''; }
  function waNum(p){ var n = String(p || '').replace(/\D/g, ''); if (n.indexOf('0') === 0) n = '27' + n.slice(1); return n; }
  function waLink(p, text){ var n = waNum(p); return n.length >= 10 ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '') : null; }
  function total(i){ return (i.amount_cents || 0) + (i.vat_cents || 0); }
  function invState(i){ return i.status === 'due' && i.due_date < ymd(new Date()) ? 'overdue' : i.status; }
  function client(id){ return data.clients.filter(function(c){ return c.id === id; })[0] || {}; }
  function clientName(c){ return c.business_name || c.full_name || c.email || 'Client'; }

  function openSheet(html, label){
    var last = document.activeElement, sheet = document.createElement('div'); sheet.className = 'sheet';
    sheet.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-label="' + RB.esc(label) + '">' + html + '</div>';
    document.body.appendChild(sheet);
    function close(){ sheet.remove(); document.removeEventListener('keydown', onKey); if (last && last.focus) last.focus(); }
    function onKey(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    sheet.addEventListener('click', function(e){ if (e.target === sheet || e.target.closest('[data-close]')) close(); });
    var first = sheet.querySelector('select,input,textarea,button:not([data-close])') || sheet.querySelector('button'); if (first) first.focus();
    return { el: sheet, close: close };
  }
  function head(title){ return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="font-size:1.6rem">' + RB.esc(title) + '</h2><button class="btn btn-line btn-sm" type="button" data-close>Close</button></div>'; }

  async function load(){
    var r = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('leads').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('requests').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('invoices').select('*').order('issued_at', { ascending: false }).limit(1000),
      sb.from('billing_settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if (r.some(function(x){ return x.error; })) RB.toast('Some data couldn\'t load. Try Refresh.', 'err');
    data.clients = r[0].data || []; data.leads = r[1].data || []; data.reqs = r[2].data || []; data.invoices = r[3].data || []; data.billing = r[4].data || {};
    render();
  }

  function render(){
    var c = data.clients, inv = data.invoices;
    var outstanding = inv.filter(function(i){ return i.status === 'due' || i.status === 'pending'; }).reduce(function(a, i){ return a + total(i); }, 0);
    var thisMonth = period(new Date());
    var paidMonth = inv.filter(function(i){ return i.status === 'paid' && i.paid_at && i.paid_at.slice(0, 7) === thisMonth; }).reduce(function(a, i){ return a + total(i); }, 0);
    $('adminKpis').innerHTML = [['Clients', c.length, true], ['Trials requested', c.filter(function(x){ return x.trial_requested_at && x.status === 'new'; }).length], ['Live', c.filter(function(x){ return x.status === 'live'; }).length],
      ['Payments to confirm', inv.filter(function(i){ return i.status === 'pending'; }).length], ['Outstanding', RB.money(outstanding).replace('.00', '')], ['Paid this month', RB.money(paidMonth).replace('.00', '')], ['New enquiries', data.leads.filter(function(x){ return !x.handled; }).length]]
      .map(function(k){ return '<div class="kpi' + (k[2] ? ' hl' : '') + '"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('');

    /* clients */
    $('clientsBox').innerHTML = !c.length ? '<div class="empty"><h3>No clients yet</h3><p>Sign-ups appear here.</p></div>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>Business</th><th>Contact</th><th>Trade</th><th>Plan</th><th>Setup</th><th>Trial requested</th><th>Status</th><th></th></tr></thead><tbody>' +
      c.map(function(x, i){
        var s = x.setup || {}, n = [x.business_name, x.trade, x.phone].concat(REQUIRED.map(function(k){ return s[k]; })).filter(function(v){ return v && String(v).trim(); }).length;
        var wa = waLink(x.phone, 'Hi ' + ((x.full_name || '').split(' ')[0] || '') + ', it\'s Ringback.');
        return '<tr><td><b>' + RB.esc(x.business_name || '—') + '</b><br><span class="faint mono">Joined ' + d(x.created_at) + '</span></td>' +
          '<td>' + RB.esc(x.full_name || '—') + '<br><span class="faint mono">' + RB.esc(x.email || '') + '</span>' + (x.phone ? '<br><span class="mono">' + RB.esc(x.phone) + '</span>' : '') + '</td>' +
          '<td>' + RB.esc(x.trade || '—') + '</td><td>' + RB.esc(x.plan && PLANS[x.plan] ? PLANS[x.plan].name : '—') + '</td><td class="mono">' + Math.round(n / 6 * 100) + '%</td><td class="mono">' + d(x.trial_requested_at) + '</td>' +
          '<td><select data-status="' + x.id + '" aria-label="Status for ' + RB.esc(x.business_name || '') + '">' + STATUSES.map(function(st){ return '<option' + (st === x.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></td>' +
          '<td style="white-space:nowrap"><button class="btn btn-line btn-sm" type="button" data-view="' + i + '">Details</button> <button class="btn btn-line btn-sm" type="button" data-bill="' + x.id + '">Invoice</button>' + (wa ? ' <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    $('clientsBox').querySelectorAll('[data-status]').forEach(function(sel){
      sel.addEventListener('change', async function(){
        var r = await sb.from('profiles').update({ status: sel.value }).eq('id', sel.dataset.status).select().maybeSingle();
        if (r.error || !r.data) return RB.toast('Couldn\'t update status', 'err');
        data.clients = data.clients.map(function(x){ return x.id === r.data.id ? r.data : x; });
        RB.toast('Status set to ' + sel.value, 'ok'); render();
      });
    });
    $('clientsBox').querySelectorAll('[data-view]').forEach(function(b){ b.addEventListener('click', function(){ showClient(c[+b.dataset.view]); }); });
    $('clientsBox').querySelectorAll('[data-bill]').forEach(function(b){ b.addEventListener('click', function(){ newInvoice(b.dataset.bill); }); });

    renderInvoices();

    /* enquiries */
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
      cb.addEventListener('change', async function(){ var r = await sb.from('leads').update({ handled: cb.checked }).eq('id', cb.dataset.lead); if (r.error) { cb.checked = !cb.checked; RB.toast('Couldn\'t update', 'err'); } else { data.leads.forEach(function(x){ if (String(x.id) === cb.dataset.lead) x.handled = cb.checked; }); render(); } });
    });

    /* requests */
    var q = data.reqs;
    $('reqBox').innerHTML = !q.length ? '<div class="empty"><h3>No requests</h3><p>Deletion and support requests from clients appear here.</p></div>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Client</th><th>Request</th><th>Note</th><th>Done</th></tr></thead><tbody>' +
      q.map(function(x){ var who = client(x.user_id); return '<tr' + (x.handled ? ' style="opacity:.55"' : '') + '><td class="mono">' + d(x.created_at) + '</td><td>' + RB.esc(who.business_name || who.email || x.user_id) + '</td><td><span class="tag ' + (x.kind === 'delete_account' ? 'red' : '') + '">' + RB.esc(x.kind === 'delete_account' ? 'Delete account' : x.kind) + '</span></td><td>' + RB.esc(x.note || '—') + '</td><td><input type="checkbox" data-req="' + x.id + '"' + (x.handled ? ' checked' : '') + ' aria-label="Mark handled" style="width:18px;height:18px;accent-color:var(--ember)"></td></tr>'; }).join('') + '</tbody></table></div>';
    $('reqBox').querySelectorAll('[data-req]').forEach(function(cb){
      cb.addEventListener('change', async function(){ var r = await sb.from('requests').update({ handled: cb.checked }).eq('id', cb.dataset.req); if (r.error) { cb.checked = !cb.checked; RB.toast('Couldn\'t update', 'err'); } else data.reqs.forEach(function(x){ if (String(x.id) === cb.dataset.req) x.handled = cb.checked; }); });
    });
  }

  /* ---------- billing ---------- */
  function renderInvoices(){
    $('bankWarn').hidden = !!data.billing.account_number;
    var list = data.invoices.filter(function(i){ return filter === 'all' || (filter === 'open' ? (i.status === 'due' || i.status === 'pending') : i.status === filter); });
    $('invFilter').querySelectorAll('[data-f]').forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.f === filter)); });
    if (!list.length) { $('invBox').innerHTML = '<div class="empty"><span class="ic">' + RB.icon('i-receipt') + '</span><h3>' + (data.invoices.length ? 'Nothing here' : 'No invoices yet') + '</h3><p style="max-width:48ch">' + (data.invoices.length ? 'No invoices match this filter.' : 'Create a setup or monthly invoice for a client. They\'ll see it in their portal under Billing, with your banking details.') + '</p></div>'; return; }
    $('invBox').innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th>Invoice</th><th>Client</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th>Proof</th><th></th></tr></thead><tbody>' +
      list.map(function(i){
        var st = INV[invState(i)] || INV.due, cl = client(i.user_id);
        var acts = i.status === 'pending' ? '<button class="btn btn-hot btn-sm" type="button" data-act="paid" data-id="' + i.id + '">Confirm paid</button> <button class="btn btn-line btn-sm" type="button" data-act="due" data-id="' + i.id + '">Not received</button>' :
          i.status === 'due' ? '<button class="btn btn-line btn-sm" type="button" data-act="paid" data-id="' + i.id + '">Mark paid</button> <button class="btn btn-ghost btn-sm" type="button" data-act="void" data-id="' + i.id + '">Cancel</button>' :
          i.status === 'paid' ? '<button class="btn btn-ghost btn-sm" type="button" data-act="due" data-id="' + i.id + '">Undo paid</button>' : '';
        return '<tr' + (i.status === 'void' ? ' style="opacity:.55"' : '') + '><td><b class="mono">' + RB.esc(i.number) + '</b><br><span class="faint mono">' + dd(i.issued_at.slice(0, 10)) + '</span></td>' +
          '<td>' + RB.esc(clientName(cl)) + (cl.email ? '<br><span class="faint mono">' + RB.esc(cl.email) + '</span>' : '') + '</td>' +
          '<td>' + RB.esc(i.description) + (i.client_note ? '<br><span class="faint">Client: ' + RB.esc(i.client_note) + '</span>' : '') + '</td>' +
          '<td class="mono" style="white-space:nowrap">' + RB.money(total(i)) + (i.vat_cents ? '<br><span class="faint">incl. ' + RB.money(i.vat_cents) + ' VAT</span>' : '') + '</td>' +
          '<td class="mono">' + dd(i.due_date) + '</td><td><span class="tag ' + st[0] + '">' + st[1] + '</span>' + (i.status === 'paid' ? '<br><span class="faint mono">' + dd(i.paid_at && i.paid_at.slice(0, 10)) + '</span>' : i.status === 'pending' ? '<br><span class="faint mono">Sent ' + dd(i.client_paid_at && i.client_paid_at.slice(0, 10)) + '</span>' : '') + '</td>' +
          '<td>' + (i.proof_path ? '<button class="linkbtn" type="button" data-proof="' + RB.esc(i.proof_path) + '">View</button>' : '<span class="faint">—</span>') + '</td>' +
          '<td style="white-space:nowrap">' + acts + ' <a class="btn btn-ghost btn-sm" href="invoice.html?id=' + i.id + '">Open</a></td></tr>';
      }).join('') + '</tbody></table></div>';
    $('invBox').querySelectorAll('[data-act]').forEach(function(b){ b.addEventListener('click', function(){ invAction(b); }); });
    $('invBox').querySelectorAll('[data-proof]').forEach(function(b){ b.addEventListener('click', function(){ viewProof(b.dataset.proof); }); });
  }
  $('invFilter').querySelectorAll('[data-f]').forEach(function(b){ b.addEventListener('click', function(){ filter = b.dataset.f; renderInvoices(); }); });

  async function invAction(b){
    var id = +b.dataset.id, act = b.dataset.act;
    if (act === 'void' && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Cancel it'; b.classList.add('btn-danger'); setTimeout(function(){ if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Cancel'; b.classList.remove('btn-danger'); } }, 4000); return; }
    var patch = act === 'paid' ? { status: 'paid', method: 'eft' } : act === 'due' ? { status: 'due', client_paid_at: null } : { status: 'void' };
    b.classList.add('loading');
    var r = await sb.from('invoices').update(patch).eq('id', id).select().maybeSingle();
    if (r.error || !r.data) { b.classList.remove('loading'); return RB.toast('Couldn\'t update the invoice', 'err'); }
    data.invoices = data.invoices.map(function(i){ return i.id === id ? r.data : i; });
    RB.toast(act === 'paid' ? 'Marked paid. The client sees it in their portal.' : act === 'due' ? 'Marked as unpaid' : 'Invoice cancelled', 'ok');
    render();
  }

  async function viewProof(path){
    var w = window.open('', '_blank');
    var r = await sb.storage.from('payment-proofs').createSignedUrl(path, 600);
    if (r.error || !r.data) { if (w) w.close(); return RB.toast('Couldn\'t open the file', 'err'); }
    if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl;
  }

  function priceFor(cl, kind){ var p = PLANS[cl.plan]; if (!p) return null; return kind === 'setup' ? p.setup : kind === 'monthly' ? p.monthly : null; }
  function descFor(cl, kind, per){
    var p = PLANS[cl.plan], name = p ? p.name + ' plan' : 'Ringback';
    return kind === 'setup' ? 'Once-off setup fee · ' + name : kind === 'monthly' ? name + ' · ' + monthName(per) : kind === 'extra' ? 'Extra call minutes · ' + monthName(per) : '';
  }

  function newInvoice(clientId){
    if (!data.clients.length) return RB.toast('No clients yet', 'err');
    var terms = data.billing.payment_terms_days != null ? data.billing.payment_terms_days : 7;
    var due = new Date(); due.setDate(due.getDate() + terms);
    var s = openSheet(head('New invoice') +
      '<form class="form" id="invForm" novalidate>' +
      '<label class="fld"><span>Client</span><select name="client">' + data.clients.map(function(c){ return '<option value="' + c.id + '"' + (c.id === clientId ? ' selected' : '') + '>' + RB.esc(clientName(c)) + (c.plan && PLANS[c.plan] ? ' · ' + PLANS[c.plan].name : '') + '</option>'; }).join('') + '</select></label>' +
      '<div class="two"><label class="fld"><span>Type</span><select name="kind"><option value="setup">Setup fee</option><option value="monthly" selected>Monthly fee</option><option value="extra">Extra minutes</option><option value="other">Other</option></select></label>' +
      '<label class="fld" id="perRow"><span>Month</span><input name="period" type="month" value="' + period(new Date()) + '"></label></div>' +
      '<label class="fld"><span>Description <small>(shown on the invoice)</small></span><input name="description" maxlength="200" required></label>' +
      '<div class="two"><label class="fld"><span>Amount excl. VAT (R)</span><input name="amount" inputmode="decimal" required placeholder="e.g. 2500"></label>' +
      '<label class="fld"><span>Due date</span><input name="due" type="date" value="' + ymd(due) + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="vat"' + (data.billing.vat_registered ? ' checked' : '') + '><span>Add 15% VAT' + (data.billing.vat_registered ? '' : ' (only if you\'re VAT-registered)') + '</span></label>' +
      '<label class="fld"><span>Note to client <small>(optional, shown on the invoice)</small></span><input name="note" maxlength="500"></label>' +
      '<p class="mono" id="invTotal"></p><p class="form-msg" id="invMsg" aria-live="polite"></p>' +
      '<div class="ctas" style="margin-top:0"><button class="btn btn-hot" type="submit">Create invoice</button><button class="btn btn-line" type="button" data-close>Cancel</button></div>' +
      '<p class="faint" style="font-size:.84rem">The client sees it straight away under Billing in their portal.</p></form>', 'New invoice');
    var f = s.el.querySelector('#invForm'), E = f.elements;
    function cents(){ var v = parseFloat(String(E.namedItem('amount').value).replace(/[^\d.]/g, '')); return isFinite(v) ? Math.round(v * 100) : 0; }
    function showTotal(){ var a = cents(), vat = E.namedItem('vat').checked ? Math.round(a * 0.15) : 0; s.el.querySelector('#invTotal').textContent = a ? 'Total: ' + RB.money(a + vat) + (vat ? ' (incl. ' + RB.money(vat) + ' VAT)' : '') : ''; }
    function auto(){
      var cl = client(E.namedItem('client').value), kind = E.namedItem('kind').value, per = E.namedItem('period').value;
      s.el.querySelector('#perRow').hidden = !(kind === 'monthly' || kind === 'extra');
      E.namedItem('description').value = descFor(cl, kind, per);
      var price = priceFor(cl, kind); E.namedItem('amount').value = price ? (price / 100).toFixed(2) : '';
      showTotal();
    }
    ['client','kind','period'].forEach(function(n){ E.namedItem(n).addEventListener('change', auto); });
    ['amount','vat'].forEach(function(n){ E.namedItem(n).addEventListener('input', showTotal); E.namedItem(n).addEventListener('change', showTotal); });
    auto();
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      var msg = s.el.querySelector('#invMsg'), kind = E.namedItem('kind').value, a = cents(), desc = E.namedItem('description').value.trim();
      msg.className = 'form-msg err';
      if (!desc) { msg.textContent = 'Add a description.'; return; }
      if (a < 100) { msg.textContent = 'Enter an amount of at least R1.'; return; }
      if (!E.namedItem('due').value) { msg.textContent = 'Choose a due date.'; return; }
      var row = { user_id: E.namedItem('client').value, kind: kind, description: desc, amount_cents: a, vat_cents: E.namedItem('vat').checked ? Math.round(a * 0.15) : 0, due_date: E.namedItem('due').value, note: E.namedItem('note').value.trim() || null, period: (kind === 'monthly' || kind === 'extra') && E.namedItem('period').value ? E.namedItem('period').value : null };
      var btn = f.querySelector('[type=submit]'); btn.classList.add('loading'); msg.textContent = '';
      var r = await sb.from('invoices').insert(row).select().maybeSingle();
      btn.classList.remove('loading');
      if (r.error || !r.data) { msg.textContent = r.error && r.error.code === '23505' ? 'This client already has a monthly invoice for that month.' : 'Couldn\'t create the invoice. ' + (r.error ? r.error.message : ''); return; }
      data.invoices.unshift(r.data); s.close(); filter = 'open'; render();
      RB.toast('Invoice ' + r.data.number + ' created', 'ok');
      var cl = client(row.user_id), wa = waLink(cl.phone, 'Hi ' + ((cl.full_name || '').split(' ')[0] || '') + ', your Ringback invoice ' + r.data.number + ' for ' + RB.money(total(r.data)) + ' is in your portal under Billing: ' + (window.RB_CONFIG.siteUrl || '') + 'dashboard.html#billing');
      showNotify(r.data, wa);
    });
  }
  function showNotify(inv, wa){
    var s = openSheet(head('Invoice ' + inv.number + ' created') + '<p class="muted">' + (wa ? 'Let the client know it\'s waiting in their portal.' : 'The client can see it in their portal under Billing.') + '</p><div class="ctas" style="margin-top:0">' + (wa ? '<a class="btn btn-hot" target="_blank" rel="noopener" href="' + wa + '">' + RB.icon('i-wa') + 'WhatsApp the client</a>' : '') + '<a class="btn btn-line" href="invoice.html?id=' + inv.id + '">View invoice</a><button class="btn btn-ghost" type="button" data-close>Done</button></div>', 'Invoice created');
    var a = s.el.querySelector('a[target]'); if (a) a.addEventListener('click', function(){ setTimeout(s.close, 300); });
  }

  function monthly(){
    var per = period(new Date());
    var live = data.clients.filter(function(c){ return c.status === 'live' && PLANS[c.plan]; });
    var have = {}; data.invoices.forEach(function(i){ if (i.kind === 'monthly' && i.period === per && i.status !== 'void') have[i.user_id] = 1; });
    var todo = live.filter(function(c){ return !have[c.id]; });
    var terms = data.billing.payment_terms_days != null ? data.billing.payment_terms_days : 7, due = new Date(); due.setDate(due.getDate() + terms);
    var vat = !!data.billing.vat_registered;
    var sum = todo.reduce(function(a, c){ var m = PLANS[c.plan].monthly; return a + m + (vat ? Math.round(m * 0.15) : 0); }, 0);
    var s = openSheet(head('Invoices for ' + monthName(per)) +
      (todo.length ? '<p class="muted">Creates a monthly invoice for each live client who doesn\'t have one for ' + monthName(per) + ' yet. Due ' + dd(ymd(due)) + (vat ? ', plus VAT' : '') + '.</p><dl class="kv">' + todo.map(function(c){ return '<dt>' + RB.esc(clientName(c)) + '</dt><dd>' + RB.esc(PLANS[c.plan].name) + ' · ' + RB.money(PLANS[c.plan].monthly) + '</dd>'; }).join('') + '</dl><p class="mono">Total ' + RB.money(sum) + '</p><div class="ctas" style="margin-top:0"><button class="btn btn-hot" type="button" id="goMonthly">Create ' + todo.length + ' invoice' + (todo.length > 1 ? 's' : '') + '</button><button class="btn btn-line" type="button" data-close>Cancel</button></div>' :
      '<p class="muted">' + (live.length ? 'Every live client already has an invoice for ' + monthName(per) + '.' : 'No live clients with a plan yet. Set a client\'s status to "live" once they\'re paying.') + '</p><div class="ctas" style="margin-top:0"><button class="btn btn-line" type="button" data-close>Close</button></div>'), 'Monthly invoices');
    var go = s.el.querySelector('#goMonthly'); if (!go) return;
    go.addEventListener('click', async function(){
      go.classList.add('loading');
      var rows = todo.map(function(c){ var m = PLANS[c.plan].monthly; return { user_id: c.id, kind: 'monthly', period: per, description: descFor(c, 'monthly', per), amount_cents: m, vat_cents: vat ? Math.round(m * 0.15) : 0, due_date: ymd(due) }; });
      var r = await sb.from('invoices').insert(rows).select();
      go.classList.remove('loading');
      if (r.error) return RB.toast('Couldn\'t create the invoices. ' + r.error.message, 'err');
      data.invoices = (r.data || []).concat(data.invoices); s.close(); filter = 'open'; render();
      RB.toast((r.data || []).length + ' invoices created', 'ok');
    });
  }

  function settings(){
    var b = data.billing;
    var fields = [['trading_name','Trading name on invoices','e.g. Ringback'],['bank_name','Bank','e.g. FNB'],['account_holder','Account holder',''],['account_number','Account number',''],['branch_code','Branch code','e.g. 250655'],['account_type','Account type','e.g. Business cheque']];
    var s = openSheet(head('Payment details') +
      '<form class="form" id="setForm" novalidate><p class="muted">Logged-in clients see these on their invoices and in Billing. Only you can change them.</p>' +
      fields.map(function(f){ return '<label class="fld"><span>' + f[1] + '</span><input name="' + f[0] + '" maxlength="120" value="' + RB.esc(b[f[0]] || '') + '" placeholder="' + RB.esc(f[2]) + '"></label>'; }).join('') +
      '<div class="two"><label class="fld"><span>Payment terms (days)</span><input name="payment_terms_days" type="number" min="0" max="60" value="' + (b.payment_terms_days != null ? b.payment_terms_days : 7) + '"></label><label class="fld"><span>VAT number</span><input name="vat_number" maxlength="20" value="' + RB.esc(b.vat_number || '') + '" placeholder="Only if VAT-registered"></label></div>' +
      '<label class="check"><input type="checkbox" name="vat_registered"' + (b.vat_registered ? ' checked' : '') + '><span>I\'m VAT-registered (adds 15% VAT to new invoices and shows "Tax invoice")</span></label>' +
      '<label class="fld"><span>Note on every invoice <small>(optional)</small></span><textarea name="invoice_note" maxlength="500" placeholder="e.g. Thank you for your business.">' + RB.esc(b.invoice_note || '') + '</textarea></label>' +
      '<p class="form-msg" id="setMsg" aria-live="polite"></p><div class="ctas" style="margin-top:0"><button class="btn btn-hot" type="submit">Save payment details</button><button class="btn btn-line" type="button" data-close>Cancel</button></div></form>', 'Payment details');
    var f = s.el.querySelector('#setForm'), E = f.elements;
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      var msg = s.el.querySelector('#setMsg'), patch = { updated_at: new Date().toISOString() };
      fields.forEach(function(x){ patch[x[0]] = E.namedItem(x[0]).value.trim() || null; });
      patch.vat_number = E.namedItem('vat_number').value.trim() || null; patch.invoice_note = E.namedItem('invoice_note').value.trim() || null;
      patch.vat_registered = E.namedItem('vat_registered').checked;
      var t = parseInt(E.namedItem('payment_terms_days').value, 10); patch.payment_terms_days = isFinite(t) ? Math.max(0, Math.min(60, t)) : 7;
      if (patch.account_number && !/^[\d\s-]{6,20}$/.test(patch.account_number)) { msg.className = 'form-msg err'; msg.textContent = 'Check the account number (digits only).'; return; }
      var btn = f.querySelector('[type=submit]'); btn.classList.add('loading');
      var r = await sb.from('billing_settings').update(patch).eq('id', 1).select().maybeSingle();
      btn.classList.remove('loading');
      if (r.error || !r.data) { msg.className = 'form-msg err'; msg.textContent = 'Couldn\'t save. ' + (r.error ? r.error.message : ''); return; }
      data.billing = r.data; s.close(); render(); RB.toast('Payment details saved', 'ok');
    });
  }

  function showClient(x){
    var s = x.setup || {};
    var rows = [['Business', x.business_name], ['Name', x.full_name], ['Email', x.email], ['Cell', x.phone], ['Trade', x.trade], ['Plan', x.plan && PLANS[x.plan] ? PLANS[x.plan].name : ''], ['Status', x.status], ['Trial requested', d(x.trial_requested_at)]]
      .concat(Object.keys(LABELS).map(function(k){ var v = s[k]; return [LABELS[k], Array.isArray(v) ? v.join(', ') : v]; }));
    var mine = data.invoices.filter(function(i){ return i.user_id === x.id; });
    var sh = openSheet(head(x.business_name || 'Client') +
      '<dl class="kv">' + rows.map(function(r){ return '<dt>' + RB.esc(r[0]) + '</dt><dd>' + RB.esc(r[1] || '—') + '</dd>'; }).join('') + '</dl>' +
      '<h3>Invoices</h3>' + (mine.length ? '<dl class="kv">' + mine.map(function(i){ return '<dt class="mono">' + RB.esc(i.number) + '</dt><dd>' + RB.esc(i.description) + ' · ' + RB.money(total(i)) + ' · ' + (INV[invState(i)] || INV.due)[1] + '</dd>'; }).join('') + '</dl>' : '<p class="muted">None yet.</p>') +
      '<div class="ctas" style="margin-top:0"><button class="btn btn-hot btn-sm" type="button" data-newinv>New invoice</button><button class="btn btn-line btn-sm" type="button" data-copy>Copy setup as text</button></div>', 'Client details');
    sh.el.querySelector('[data-copy]').addEventListener('click', function(){ RB.copy(rows.map(function(r){ return r[0] + ': ' + (r[1] || '—'); }).join('\n')); });
    sh.el.querySelector('[data-newinv]').addEventListener('click', function(){ sh.close(); newInvoice(x.id); });
  }

  $('newInvBtn').addEventListener('click', function(){ newInvoice(); });
  $('monthlyBtn').addEventListener('click', monthly);
  $('settingsBtn').addEventListener('click', settings);
  $('bankWarnBtn').addEventListener('click', settings);
  $('refreshBtn').addEventListener('click', function(){ load().then(function(){ RB.toast('Up to date', 'ok'); }); });
  load();
})();
