/* Contact page: saves enquiries to the database, falls back to WhatsApp. */
(function(){
  var RB = window.RB, f = document.getElementById('contactForm'), msg = document.getElementById('contactMsg'), btn = document.getElementById('contactBtn');
  if (!f) return;
  function say(text, kind){ msg.className = 'form-msg ' + (kind || ''); msg.textContent = text; }
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var E = f.elements, el = function(n){ return E.namedItem(n); };
    var d = {
      name: el('name').value.trim(), business: el('business').value.trim() || null, trade: el('trade').value || null, area: el('area').value.trim() || null,
      phone: el('phone').value.trim(), email: el('email').value.trim() || null, message: el('message').value.trim() || null, source: 'contact'
    };
    [el('name'), el('phone')].forEach(function(el){ el.removeAttribute('aria-invalid'); });
    if (!d.name) { el('name').setAttribute('aria-invalid','true'); el('name').focus(); return say('Please add your name.', 'err'); }
    if (!/^[+\d][\d\s()-]{8,}$/.test(d.phone)) { el('phone').setAttribute('aria-invalid','true'); el('phone').focus(); return say('Please add a cellphone number we can reach you on.', 'err'); }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { el('email').focus(); return say('That email address doesn\'t look right.', 'err'); }
    if (!el('consent').checked) { el('consent').focus(); return say('Please tick the box so we can contact you.', 'err'); }
    var waText = 'Hi Ringback, I\'m ' + d.name + (d.business ? ' from ' + d.business : '') + (d.trade ? ' (' + d.trade + ')' : '') + (d.area ? ', ' + d.area : '') + '.' + (d.message ? '\n' + d.message : '');
    if (!RB.sb) { say('Opening WhatsApp so you can send this to us…', 'ok'); window.open(RB.wa(waText), '_blank', 'noopener'); return; }
    btn.classList.add('loading');
    var res = await RB.sb.from('leads').insert(d);
    btn.classList.remove('loading');
    if (res.error) {
      say('We couldn\'t send that just now. WhatsApp us instead: the button below opens it with your message.', 'err');
      var a = document.createElement('a'); a.className = 'btn btn-line btn-sm'; a.href = RB.wa(waText); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Send on WhatsApp'; a.style.marginTop = '8px'; msg.appendChild(document.createElement('br')); msg.appendChild(a);
      return;
    }
    f.reset();
    f.innerHTML = '<div style="display:grid;gap:14px;justify-items:start"><span class="ic" style="color:var(--mint);background:rgba(91,227,180,.1);border-color:rgba(91,227,180,.3)">' + RB.icon('i-check') + '</span><h3 style="font-size:1.6rem">Thanks, ' + RB.esc(d.name.split(' ')[0]) + '. We\'ve got your message.</h3><p class="muted">We\'ll be in touch within one working day. Want a faster answer? WhatsApp us or ask the assistant.</p><div class="ctas" style="margin-top:6px"><a class="btn btn-hot btn-sm" target="_blank" rel="noopener" href="' + RB.wa(waText) + '">WhatsApp us now</a><a class="btn btn-line btn-sm" href="login.html?mode=signup">Create an account</a></div></div>';
  });
})();
