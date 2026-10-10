/* Printable invoice for clients (their own) and the owner (any). Access is enforced by the database. */
(async function(){
  var RB = window.RB, sb = RB.sb, C = window.RB_CONFIG || {}, $ = function(id){ return document.getElementById(id); };
  var user = await RB.requireUser(); if (!user) return;
  function fail(msg){ $('invLoading').hidden = true; var e = $('invErr'); e.hidden = false; e.textContent = msg; }
  var id = parseInt(new URLSearchParams(location.search).get('id'), 10);
  if (!id) return fail('That invoice link isn\'t complete. Open your invoice from Billing in your portal.');

  var res = await Promise.all([
    sb.from('invoices').select('*').eq('id', id).maybeSingle(),
    sb.from('billing_settings').select('*').eq('id', 1).maybeSingle(),
    sb.rpc('is_admin')
  ]);
  if (res[0].error) return fail('We couldn\'t load this invoice. Refresh the page, or WhatsApp us on ' + C.phoneDisplay + '.');
  var inv = res[0].data, b = res[1].data || {}, admin = res[2].data === true;
  if (admin) { var back = $('backLink'); back.href = 'admin.html#billing'; back.lastChild.textContent = 'Back to admin'; }
  if (!inv) return fail('We couldn\'t find that invoice on your account.');
  var cl = (await sb.from('profiles').select('*').eq('id', inv.user_id).maybeSingle()).data || {};

  function day(x){ if (!x) return '—'; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x); var dt = m && x.length === 10 ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(x); return dt.toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' }); }
  var todayStr = (function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date());
  var state = inv.status === 'due' && inv.due_date < todayStr ? 'overdue' : inv.status;
  var STAMP = { due:'Due', overdue:'Overdue', pending:'Payment being checked', paid:'Paid', void:'Cancelled' };
  var total = inv.amount_cents + inv.vat_cents, vat = inv.vat_cents > 0;
  var title = vat && b.vat_registered ? 'Tax invoice' : 'Invoice';
  var trading = b.trading_name || 'Ringback';
  var bank = [['Bank', b.bank_name], ['Account holder', b.account_holder], ['Account number', b.account_number], ['Branch code', b.branch_code], ['Account type', b.account_type]].filter(function(r){ return r[1]; });
  var mark = '<span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#160A04" stroke-width="2.6" stroke-linecap="round"><path d="M5 10v4M9 7v10M13 4v16M17 7v10M21 10v4"/></svg></span>';

  $('paper').innerHTML =
    '<header class="paper-head"><div class="paper-from"><div class="paper-logo">' + mark + RB.esc(trading) + '</div>' +
      '<p>' + (trading !== 'Ringback' ? 'Trading as Ringback<br>' : '') + 'WhatsApp ' + RB.esc(C.phoneDisplay) + '<br>' + RB.esc((C.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')) + (b.vat_registered && b.vat_number ? '<br>VAT no. ' + RB.esc(b.vat_number) : '') + '</p></div>' +
      '<div class="paper-title"><h1>' + title + '</h1><p class="mono">' + RB.esc(inv.number) + '</p><span class="stamp ' + state + '">' + STAMP[state] + '</span></div></header>' +
    '<div class="paper-meta"><div><h4>Billed to</h4><p><b>' + RB.esc(cl.business_name || cl.full_name || '—') + '</b>' + (cl.full_name && cl.business_name ? '<br>' + RB.esc(cl.full_name) : '') + (cl.email ? '<br>' + RB.esc(cl.email) : '') + (cl.phone ? '<br>' + RB.esc(cl.phone) : '') + '</p></div>' +
      '<dl><div><dt>Invoice date</dt><dd>' + day(inv.issued_at) + '</dd></div><div><dt>Due date</dt><dd>' + day(inv.due_date) + '</dd></div><div><dt>Payment reference</dt><dd class="mono">' + RB.esc(inv.number) + '</dd></div>' + (inv.status === 'paid' ? '<div><dt>Paid on</dt><dd>' + day(inv.paid_at) + '</dd></div>' : '') + '</dl></div>' +
    '<table class="paper-lines"><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody><tr><td>' + RB.esc(inv.description) + '</td><td class="r mono">' + RB.money(inv.amount_cents) + '</td></tr></tbody>' +
      '<tfoot>' + (vat ? '<tr><td>Subtotal</td><td class="r mono">' + RB.money(inv.amount_cents) + '</td></tr><tr><td>VAT (15%)</td><td class="r mono">' + RB.money(inv.vat_cents) + '</td></tr>' : '') +
      '<tr class="tot"><td>' + (inv.status === 'paid' ? 'Total paid' : inv.status === 'void' ? 'Total (cancelled)' : 'Total due') + '</td><td class="r mono">' + RB.money(total) + '</td></tr></tfoot></table>' +
    (inv.status === 'paid' || inv.status === 'void' ? '' :
      '<div class="paper-pay"><h4>How to pay</h4>' + (bank.length ? '<dl>' + bank.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + RB.esc(r[1]) + '</dd></div>'; }).join('') + '<div><dt>Reference</dt><dd class="mono"><b>' + RB.esc(inv.number) + '</b></dd></div></dl><p>Please pay by EFT and use <b>' + RB.esc(inv.number) + '</b> as your reference. Then tap "I\'ve paid" in your portal so we can match your payment.</p>' :
        '<p>Please WhatsApp us on ' + RB.esc(C.phoneDisplay) + ' for our banking details, and use <b>' + RB.esc(inv.number) + '</b> as your payment reference.</p>') + '</div>') +
    (inv.note ? '<p class="paper-note">' + RB.esc(inv.note) + '</p>' : '') +
    '<footer class="paper-foot">' + (b.invoice_note ? '<p>' + RB.esc(b.invoice_note) + '</p>' : '') + '<p>Amounts in South African rand' + (vat ? '' : '. No VAT charged') + '. Questions about this invoice? WhatsApp ' + RB.esc(C.phoneDisplay) + '.</p></footer>';

  document.title = title + ' ' + inv.number + ' · Ringback';
  $('invLoading').hidden = true; $('paper').hidden = false;
  var pb = $('printBtn'); pb.disabled = false; pb.addEventListener('click', function(){ window.print(); });
  if (!admin && inv.status === 'due' && inv.user_id === user.id) { var pay = $('payBtn'); pay.hidden = false; pay.href = 'dashboard.html?pay=' + inv.id + '#billing'; }
})();
