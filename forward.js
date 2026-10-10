/* Call-forwarding guide, used on product.html and in the portal (dashboard.html).
   RB.forwardGuide(el, opts) builds the guide inside el. Any [data-forward-guide] element on the page is built
   automatically. opts.number prefills the number to forward to; with opts.lock it's read-only and labelled as
   coming from the client's Ringback setup.

   Standard GSM forwarding codes (the 3GPP "MMI" codes most South African networks use).
   PLEASE VERIFY each network against its current help pages, or by dialling the code, before relying on it,
   then set verified to the date you checked (e.g. verified:'2026-10-12'). Until then the guide says plainly
   that the code is the standard one and hasn't been confirmed for that network. Some contracts and
   prepaid packages block forwarding, and the network bills forwarded calls at your normal rates. */
(function(){
  var RB = window.RB;
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
  RB.forwardGuide = function(el, opts){
    opts = (opts && typeof opts === 'object') ? opts : {};
    var F = RB.FORWARD, id = 'fw' + (++fwdN), lock = !!(opts.lock && opts.number);
    var chips = function(name, list, sel){ return '<div class="chips" role="radiogroup">' + list.map(function(x){ return '<label><input type="radio" name="' + id + name + '" value="' + x.key + '"' + (x.key === sel ? ' checked' : '') + '><span>' + RB.esc(x.name || x.label) + '</span></label>'; }).join('') + '</div>'; };
    el.classList.add('fwd');
    el.innerHTML =
      '<div class="fwd-in form">' +
        '<div class="fld"><span id="' + id + 'nl">Your network</span>' + chips('net', F.networks, 'vodacom').replace('role="radiogroup"', 'role="radiogroup" aria-labelledby="' + id + 'nl"') + '</div>' +
        '<div class="fld"><span id="' + id + 'tl">When should calls forward?</span>' + chips('type', F.types, 'missed').replace('role="radiogroup"', 'role="radiogroup" aria-labelledby="' + id + 'tl"') + '<small class="fwd-hint"></small></div>' +
        '<div class="two"><label class="fld"><span>Number to forward to <small>' + (lock ? 'From your Ringback setup' : 'the Ringback number we give you') + '</small></span><input type="tel" inputmode="tel" autocomplete="off" class="fwd-num" placeholder="e.g. 010 123 4567" maxlength="20"' + (lock ? ' readonly' : '') + '></label>' +
        '<label class="fld fwd-ring"><span>Ring for</span><select class="fwd-sec">' + [5,10,15,20,25,30].map(function(x){ return '<option value="' + x + '"' + (x === 20 ? ' selected' : '') + '>' + x + ' seconds</option>'; }).join('') + '</select></label></div>' +
      '</div>' +
      '<div class="fwd-out" aria-live="polite">' +
        '<div class="fwd-code"><span class="lbl">Dial this to switch it on</span><div class="fwd-row"><code class="fwd-on"></code><button type="button" class="icon-btn fwd-copy" data-which="on" aria-label="Copy the code to switch forwarding on">' + RB.icon('i-copy') + '</button></div></div>' +
        '<div class="fwd-code"><span class="lbl">Dial this to switch it off</span><div class="fwd-row"><code class="fwd-off"></code><button type="button" class="icon-btn fwd-copy" data-which="off" aria-label="Copy the code to switch forwarding off">' + RB.icon('i-copy') + '</button></div></div>' +
        '<p class="fwd-note"></p>' +
      '</div>';
    var q = function(s){ return el.querySelector(s); };
    if (opts.number) q('.fwd-num').value = String(opts.number);
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
  document.querySelectorAll('[data-forward-guide]').forEach(function(el){ RB.forwardGuide(el); });
})();
