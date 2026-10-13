// Draxora — interações do site (sem dependências)
(function () {
  // Header ganha borda ao rolar
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Revelar blocos ao entrar na tela
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Formulários de captura
  // Para integrar com sua ferramenta de e-mail (ConvertKit, RD Station, Mailchimp, Brevo…),
  // coloque a URL de envio no atributo data-endpoint do <form class="dx-lead">.
  // Sem data-endpoint, o formulário só mostra a confirmação (modo demonstração).
  document.querySelectorAll('form.dx-lead').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var endpoint = form.getAttribute('data-endpoint');
      var data = new FormData(form);
      var done = function () { form.classList.add('is-done'); };
      if (!endpoint) { done(); return; }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      fetch(endpoint, { method: 'POST', body: data })
        .then(done)
        .catch(function () { if (btn) btn.disabled = false; alert('Não foi possível enviar agora. Tente de novo em instantes.'); });
    });
  });

  // Ano no rodapé
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
