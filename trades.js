/* Trades page: one section per trade, built from the shared trade data. */
(function(){
  var RB = window.RB, nav = document.getElementById('tradeNav'), box = document.getElementById('tradeDetails');
  var KIND = { emergency:['red','Emergency alert'], booked:['mint','New booking'], callback:['amber','Callback request'] };
  var mine = RB.getTrade();
  RB.tradesInOrder().forEach(function(t){
    nav.insertAdjacentHTML('beforeend', '<a href="#' + t.key + '">' + RB.esc(t.label) + '</a>');
    var lines = t.lines.map(function(l, i){
      return '<div class="line' + (l[0] === 'ai' ? ' ai' : '') + (i === 1 ? ' on' : '') + '"><small>' + (l[0] === 'ai' ? 'Ringback' : 'Caller') + '</small><span>' + RB.esc(l[1]) + '</span></div>';
    }).join('');
    var tags = t.tags.map(function(g){ return '<span class="tag ' + g[0] + '">' + RB.esc(g[1]) + '</span>'; }).join('');
    var k = KIND[t.kind];
    box.insertAdjacentHTML('beforeend',
      '<article class="trade-detail" id="' + t.key + '">' +
        '<div class="rv">' +
          '<span class="ic">' + RB.icon(t.icon) + '</span>' + (t.key === mine ? ' <span class="tag ember">Your trade</span>' : '') +
          '<h2>' + RB.esc(t.label) + '</h2>' +
          '<p class="lede">Your assistant answers as your business and is set up for ' + RB.esc(t.label.toLowerCase()) + ' calls.</p>' +
          '<dl class="lists">' +
            '<div class="box"><dt class="e">Escalates straight to you</dt><dd>' + RB.esc(t.catches) + '</dd></div>' +
            '<div class="box"><dt class="r">Books or takes a callback</dt><dd>' + RB.esc(t.books) + '</dd></div>' +
            '<div class="box"><dt class="s">Safety steps it gives callers</dt><dd>' + RB.esc(t.safety) + '</dd></div>' +
          '</dl>' +
          '<div class="ctas"><a class="btn btn-hot btn-sm" href="login.html?mode=signup&trade=' + encodeURIComponent(t.label) + '">Set it up for my business</a><a class="btn btn-line btn-sm" href="index.html#' + t.key + '">Watch it play</a></div>' +
        '</div>' +
        '<div class="case-media rv">' +
        '<div class="mini-call screen">' +
          '<div class="screen-bar"><span>Example call · fictional business</span></div>' +
          '<div class="screen-body">' +
          '<div class="call-top"><div class="caller"><span class="avatar">' + RB.esc(t.init) + '</span><div><b>Incoming · ' + RB.esc(t.suburb) + '</b><span>Forwarded to ' + RB.esc(t.biz) + ' · ' + t.time + '</span></div></div><span class="rec"><i></i>Example</span></div>' +
          '<div class="lines">' + lines + '</div>' +
          '<div class="triage">' + tags + '</div>' +
          '<div class="hear" data-hear="' + t.key + '" hidden></div>' +
          '</div>' +
        '</div>' +
        '<div class="sms-screen screen">' +
          '<div class="screen-bar"><span>Example · SMS alert to you</span></div>' +
          '<div class="sms"><b class="' + k[0] + '">' + k[1].toUpperCase() + '</b> · ' + RB.esc(t.caller) + ' · ' + RB.esc(t.suburb) + '<br>' + RB.esc(t.alert) + '</div>' +
        '</div>' +
        '</div>' +
      '</article>');
  });
  /* sample recordings: each section gets a player once its audio file is found */
  box.querySelectorAll('[data-hear]').forEach(function(m){
    var t = RB.tradeByKey(m.dataset.hear);
    RB.callAudio(t, { mount: m, lines: m.parentNode.querySelector('.lines') });
  });
  document.addEventListener('rb:trade', function(e){ var el = e.detail && document.getElementById(e.detail); if (el) el.scrollIntoView({ behavior: RB.reduced ? 'auto' : 'smooth' }); });
  if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(function(){ el.scrollIntoView(); }, 50); }
})();
