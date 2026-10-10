/* Contact page: saves the enquiry through RB.lead, falls back to WhatsApp. */
(function(){
  var RB = window.RB, f = document.getElementById('contactForm'), msg = document.getElementById('contactMsg'), btn = document.getElementById('contactBtn');
  if (!f) return;
  function say(text, kind){ msg.className = 'form-msg ' + (kind || ''); msg.textContent = text; }
  var sending = false;
  f.addEventListener('submit', function(e){
    e.preventDefault();
    if (sending) return;
    var el = function(n){ return f.elements.namedItem(n); }, val = function(n){ return el(n).value.trim(); };
    var d = { name: val('name'), business: val('business'), trade: el('trade').value, area: val('area'), phone: val('phone'), email: val('email'), message: val('message'), source: 'contact' };
    [el('name'), el('phone'), el('email')].forEach(function(x){ x.removeAttribute('aria-invalid'); });
    if (!d.name) { el('name').setAttribute('aria-invalid','true'); el('name').focus(); return say('Please add your name.', 'err'); }
    if (!/^[+\d][\d\s()-]{8,}$/.test(d.phone)) { el('phone').setAttribute('aria-invalid','true'); el('phone').focus(); return say('Please add a cellphone number we can reach you on.', 'err'); }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { el('email').setAttribute('aria-invalid','true'); el('email').focus(); return say('That email address doesn\'t look right.', 'err'); }
    if (!el('consent').checked) { el('consent').focus(); return say('Please tick the box so we can contact you.', 'err'); }
    var waText = 'Hi Ringback, I\'m ' + d.name + (d.business ? ' from ' + d.business : '') + (d.trade ? ' (' + d.trade + ')' : '') + (d.area ? ', ' + d.area : '') + '.' + (d.message ? '\n' + d.message : '');
    sending = true; btn.classList.add('loading'); btn.setAttribute('aria-busy', 'true'); say('Sending…');
    RB.lead(d).then(function(ok){
      sending = false; btn.classList.remove('loading'); btn.removeAttribute('aria-busy');
      if (!ok) {
        say('We couldn\'t send that just now. WhatsApp us instead: the button below opens it with your message.', 'err');
        var a = document.createElement('a'); a.className = 'btn btn-line btn-sm mt-s'; a.href = RB.wa(waText); a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = RB.icon('i-wa') + 'Send on WhatsApp';
        msg.appendChild(document.createElement('br')); msg.appendChild(a);
        return;
      }
      f.reset();
      f.innerHTML = '<div class="stack-m" role="status"><span class="ic mint">' + RB.icon('i-check') + '</span><h3 class="h-md">Thanks, ' + RB.esc(d.name.split(' ')[0]) + '. We\'ve got your message.</h3>' +
        '<p class="muted">We\'ll be in touch within one working day. Want a faster answer? WhatsApp us or ask the assistant.</p>' +
        '<div class="row-tags"><a class="btn btn-hot btn-sm" target="_blank" rel="noopener" href="' + RB.wa(waText) + '">WhatsApp us now</a><a class="btn btn-line btn-sm" href="login.html?mode=signup">Create an account</a></div></div>';
    });
  });
})();
