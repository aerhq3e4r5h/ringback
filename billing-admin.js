/* Admin card billing: Paystack plan codes, every client's subscription and usage, their Vapi ids,
   founding approval, and the pause / resume / switch-plan / sync-to-Vapi actions.
   Hidden unless config.payments is true. The database and the 'billing' Edge Function check that you're an admin. */
(function(){
  var RB = window.RB, C = window.RB_CONFIG || {}, sb = RB && RB.sb;
  if (!C.payments || !sb) return;
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return RB.esc(s == null ? '' : String(s)); };
  var plans = {}, privs = {}, clients = [];
  var STATUS = { none: ['', 'No card'], active: ['mint', 'Active'], past_due: ['red', 'Payment failed'], non_renewing: ['amber', 'Ending'], cancelled: ['amber', 'Cancelled'], ended: ['', 'Ended'] };

  function day(d){ try { return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; } catch (e) { return '—'; } }
  async function call(action, extra){
    var r = await sb.functions.invoke('billing', { body: Object.assign({ action: action }, extra || {}) });
    if (!r.error) return r.data || {};
    var msg = r.error.message || 'The billing function didn\'t answer. Is it deployed?';
    try { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }

  async function load(){
    var adm = await sb.rpc('is_admin');
    if (adm.data !== true) return;
    var r = await Promise.all([
      sb.from('plan_catalog').select('*').order('sort'),
      sb.from('billing_private').select('*'),
      sb.from('profiles').select('id,email,business_name,full_name,plan,plan_active,billing_status,period_end,card_last4,status,paused_reason').order('created_at', { ascending: false })
    ]);
    if (r[0].error) { show('<p class="alert warn">Run <code>supabase/billing.sql</code> in Supabase to switch on card subscriptions.</p>'); return; }
    plans = {}; (r[0].data || []).forEach(function(k){ plans[k.key] = k; });
    privs = {}; (r[1].data || []).forEach(function(x){ privs[x.user_id] = x; });
    clients = r[2].data || [];
    render();
  }
  function show(html){ var s = $('subscriptions'); s.hidden = false; $('subsNav').hidden = false; $('subsBox').innerHTML = html; }

  function render(){
    $('planCodes').innerHTML = '<dl class="kv">' + Object.keys(plans).map(function(k){ var p = plans[k]; return '<dt>' + esc(p.name) + '</dt><dd>' + RB.money(p.monthly_cents).replace('.00', '') + '/mo · ' + p.minutes + ' min · ' + (p.paystack_plan_code ? '<span class="mono">' + esc(p.paystack_plan_code) + '</span>' : '<span class="tag amber">No Paystack plan yet</span>') + '</dd>'; }).join('') + '</dl>';
    $('setupPlansBtn').hidden = Object.keys(plans).every(function(k){ return plans[k].paystack_plan_code; });
    show(!clients.length ? '<p class="muted">No clients yet.</p>' :
      '<div class="table-wrap"><table class="data"><thead><tr><th>Client</th><th>Card plan</th><th>Status</th><th>Next charge</th><th>Vapi</th><th></th></tr></thead><tbody>' +
      clients.map(function(c){
        var s = STATUS[c.billing_status] || STATUS.none, pv = privs[c.id] || {};
        return '<tr><td>' + esc(c.business_name || c.full_name || c.email) + '<br><span class="faint mono">' + esc(c.email) + '</span></td>' +
          '<td>' + esc(c.plan_active && plans[c.plan_active] ? plans[c.plan_active].name : '—') + (c.plan && c.plan !== c.plan_active ? '<br><span class="faint">chose ' + esc(plans[c.plan] ? plans[c.plan].name : c.plan) + '</span>' : '') + (pv.founding_approved ? '<br><span class="tag ember">Founding approved</span>' : '') + '</td>' +
          '<td><span class="tag ' + s[0] + '">' + s[1] + '</span>' + (c.status === 'paused' ? '<br><span class="tag red">Paused' + (c.paused_reason ? ' · ' + esc(c.paused_reason) : '') + '</span>' : '') + '</td>' +
          '<td class="mono">' + (c.billing_status === 'active' ? day(c.period_end) : '—') + (c.card_last4 ? '<br><span class="faint">•••• ' + esc(c.card_last4) + '</span>' : '') + '</td>' +
          '<td>' + (pv.vapi_assistant_id ? '<span class="tag mint">Linked</span>' : '<span class="tag amber">Not linked</span>') + '</td>' +
          '<td><button type="button" class="btn btn-line btn-sm" data-sub="' + esc(c.id) + '">Manage</button></td></tr>';
      }).join('') + '</tbody></table></div>');
    document.querySelectorAll('[data-sub]').forEach(function(b){ b.onclick = function(){ manage(b.dataset.sub); }; });
  }

  async function manage(id){
    var c = clients.filter(function(x){ return x.id === id; })[0]; if (!c) return;
    var pv = privs[id] || {};
    var u = await sb.rpc('client_usage', { p_user: id }); u = u.error ? null : (typeof u.data === 'string' ? JSON.parse(u.data) : u.data);
    var others = Object.keys(plans).filter(function(k){ return k !== c.plan_active; });
    var sh = RB.sheet({ label: 'Billing for ' + (c.business_name || c.email), size: 'md', html:
      '<div class="stack-m"><h2 class="h-md">' + esc(c.business_name || c.full_name || c.email) + '</h2>' +
      '<dl class="kv"><dt>Card plan</dt><dd>' + esc(c.plan_active && plans[c.plan_active] ? plans[c.plan_active].name : 'None') + ' · ' + esc((STATUS[c.billing_status] || STATUS.none)[1]) + '</dd><dt>Next charge</dt><dd>' + day(c.period_end) + '</dd>' +
      (u ? '<dt>Minutes</dt><dd>' + u.minutes + ' of ' + (u.included || '—') + ' this period (' + u.calls + ' calls' + (u.calls - u.measured_calls ? ', ' + (u.calls - u.measured_calls) + ' without a length' : '') + ')</dd>' : '') + '</dl>' +
      '<form class="form card" id="bpPriv" novalidate><h3 class="h-sm">Vapi and approvals</h3>' +
      '<label class="fld"><span>Vapi assistant id <small>Vapi → Assistants → copy the id</small></span><input name="vapi_assistant_id" value="' + esc(pv.vapi_assistant_id) + '" autocomplete="off" spellcheck="false"></label>' +
      '<label class="fld"><span>Vapi phone number id <small>the Ringback number this client forwards to</small></span><input name="vapi_phone_number_id" value="' + esc(pv.vapi_phone_number_id) + '" autocomplete="off" spellcheck="false"></label>' +
      '<label class="check"><input type="checkbox" name="founding_approved"' + (pv.founding_approved ? ' checked' : '') + '><span>Approved for the founding partner plan</span></label>' +
      '<div><button class="btn btn-hot btn-sm" type="submit">Save</button></div></form>' +
      '<div class="card stack-s"><h3 class="h-sm">Actions</h3><div class="ctas">' +
      '<button type="button" class="btn btn-line btn-sm" data-act="sync-vapi">Sync to Vapi</button>' +
      (c.status === 'paused' ? '<button type="button" class="btn btn-line btn-sm" data-act="resume">Resume</button>' : '<button type="button" class="btn btn-danger btn-sm" data-act="pause">Pause</button>') + '</div>' +
      (c.plan_active && others.length ? '<form class="bp-change form" id="bpSwitch"><label class="fld"><span>Switch card plan from the next billing date</span><select name="plan">' + others.map(function(k){ return '<option value="' + esc(k) + '">' + esc(plans[k].name) + '</option>'; }).join('') + '</select></label><button class="btn btn-line btn-sm" type="submit">Switch</button></form>' : '') +
      '<p class="form-msg" id="bpMsg" aria-live="polite"></p></div></div>' });
    var msg = sh.body.querySelector('#bpMsg');
    var say = function(t, k){ msg.className = 'form-msg ' + (k || ''); msg.textContent = t; };
    sh.body.querySelector('#bpPriv').onsubmit = async function(e){
      e.preventDefault(); var E = e.currentTarget.elements;
      var row = { user_id: id, vapi_assistant_id: E.namedItem('vapi_assistant_id').value.trim() || null, vapi_phone_number_id: E.namedItem('vapi_phone_number_id').value.trim() || null, founding_approved: E.namedItem('founding_approved').checked, updated_at: new Date().toISOString() };
      var r = await sb.from('billing_private').upsert(row, { onConflict: 'user_id' });
      if (r.error) return say('Couldn\'t save: ' + r.error.message, 'err');
      privs[id] = Object.assign(privs[id] || {}, row); render(); say('Saved.', 'ok');
    };
    sh.body.querySelectorAll('[data-act]').forEach(function(b){
      b.onclick = async function(){
        if (b.dataset.act === 'pause' && !confirm('Pause Ringback for this client? Their forwarded calls stop being answered.')) return;
        b.classList.add('loading'); say('');
        try { var r = await call(b.dataset.act, { user_id: id }); say(r.message || 'Done.', 'ok'); load(); } catch (err) { say(err.message, 'err'); }
        b.classList.remove('loading');
      };
    });
    var sw = sh.body.querySelector('#bpSwitch');
    if (sw) sw.onsubmit = async function(e){
      e.preventDefault(); var btn = sw.querySelector('[type=submit]'); btn.classList.add('loading'); say('');
      try { var r = await call('change', { user_id: id, plan: sw.elements.namedItem('plan').value }); say(r.message || 'Done.', 'ok'); load(); } catch (err) { say(err.message, 'err'); }
      btn.classList.remove('loading');
    };
  }

  $('setupPlansBtn').onclick = async function(){
    var b = this; b.classList.add('loading');
    try {
      var r = await call('setup-plans');
      RB.toast((r.plans || []).filter(function(p){ return p.created; }).length + ' Paystack plan(s) created.', 'ok');
      load();
    } catch (err) { RB.toast(err.message, 'err'); }
    b.classList.remove('loading');
  };
  $('refreshBtn') && $('refreshBtn').addEventListener('click', load);
  load();
})();
