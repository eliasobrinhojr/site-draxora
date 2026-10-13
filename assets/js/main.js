// Draxora — interações do site (sem dependências)
(function () {
  // ===== CONTATO — edite aqui =====
  // WhatsApp com DDI + DDD, só números (ex.: '5592999999999'). Vazio = esconde o botão de WhatsApp.
  var WHATSAPP = '5548991851531';
  var EMAIL = 'elias.dvlpr@gmail.com';

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
    items.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('is-pending'); io.observe(el); }
    });
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

  // Porta 00: frase vaga -> frase precisa
  document.querySelectorAll('[data-phrases]').forEach(function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    var panel = box.querySelector('[role="tabpanel"]');
    var text = box.querySelector('[data-phrase-text]');
    var tags = box.querySelector('[data-phrase-tags]');
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      text.textContent = tab.getAttribute('data-precise');
      tags.innerHTML = '';
      tab.getAttribute('data-tags').split('|').forEach(function (s) {
        var el = document.createElement('span'); el.textContent = s; tags.appendChild(el);
      });
      panel.setAttribute('aria-labelledby', tab.id);
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (k === 'ArrowUp' || k === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });

  // Modal "Sugerir um tema" -> WhatsApp ou e-mail
  document.querySelectorAll('[data-open]').forEach(function (btn) {
    var dlg = document.getElementById(btn.getAttribute('data-open'));
    if (!dlg || typeof dlg.showModal !== 'function') return;
    btn.addEventListener('click', function () {
      dlg.showModal();
      var first = dlg.querySelector('textarea, input');
      if (first) first.focus();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-close]').forEach(function (c) { c.addEventListener('click', function () { dlg.close(); }); });
  });

  document.querySelectorAll('form[data-suggest]').forEach(function (form) {
    var wa = form.querySelector('[data-whatsapp]');
    if (wa && !WHATSAPP) wa.hidden = true;
    var err = form.querySelector('[data-error]');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var via = ev.submitter ? ev.submitter.value : (WHATSAPP ? 'whatsapp' : 'email');
      var tema = form.elements.tema.value.trim();
      var nome = form.elements.nome.value.trim();
      if (!tema) { err.hidden = false; form.elements.tema.focus(); return; }
      err.hidden = true;
      var msg = 'Olá, Draxora! Tenho uma sugestão de porta:\n\n' + tema + (nome ? '\n\n— ' + nome : '');
      var url = via === 'whatsapp'
        ? 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg)
        : 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Sugestão de porta') + '&body=' + encodeURIComponent(msg);
      if (via === 'whatsapp') window.open(url, '_blank', 'noopener'); else window.location.href = url;
      form.reset();
      var dlg = form.closest('dialog'); if (dlg) dlg.close();
    });
  });

  // Ano no rodapé
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
