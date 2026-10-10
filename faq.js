/* FAQ page: filter the questions as you type. */
(function(){
  var fs = document.getElementById('faqSearch');
  if (!fs) return;
  fs.addEventListener('input', function(){
    var q = fs.value.trim().toLowerCase(), any = false;
    document.querySelectorAll('.faq details').forEach(function(d){ var hit = !q || d.textContent.toLowerCase().indexOf(q) >= 0; d.hidden = !hit; if (hit) any = true; if (q && hit) d.open = true; });
    document.querySelectorAll('.faq-cat').forEach(function(h){ var n = h.nextElementSibling, vis = false; while (n && !n.classList.contains('faq-cat')) { if (n.tagName === 'DETAILS' && !n.hidden) vis = true; n = n.nextElementSibling; } h.hidden = !vis; });
    var none = document.getElementById('faqNone'); if (none) none.hidden = any;
  });
})();
