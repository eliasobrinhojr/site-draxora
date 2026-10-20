// Draxora — interações do site (sem dependências)
(function () {
  // ===== CONTATO — edite aqui =====
  // WhatsApp com DDI + DDD, só números (ex.: '5592999999999'). Vazio = esconde o botão de WhatsApp.
  var WHATSAPP = '5548991851531';
  var EMAIL = 'elias.dvlpr@gmail.com';
  // Link do checkout da Hotmart (ex.: 'https://pay.hotmart.com/XXXXXXXX'). Vazio = botão desativado com aviso "em breve".
  var CHECKOUT_URL = 'https://pay.hotmart.com/Y108011719G';
  // Rastreamento de anúncios. Vazio = nada é carregado.
  // META_PIXEL_ID: só números (Gerenciador de Eventos da Meta). GTAG_ID: 'G-XXXX' (GA4) ou 'AW-XXXX' (Google Ads).
  var META_PIXEL_ID = '1760580708485734';
  var GTAG_ID = '';
  var PRODUCT = { name: 'Mapa dos Sintomas', id: 'Y108011719G', value: 14.90, currency: 'BRL' };

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

  // Formulários de captura "Avisar-me" -> api/inscrever.php (PHP + MySQL na Hostinger)
  var params = new URLSearchParams(window.location.search);
  document.querySelectorAll('form.dx-lead').forEach(function (form) {
    var err = form.querySelector('[data-lead-error]');
    var btn = form.querySelector('button[type="submit"]');
    function fail(msg) { if (err) { err.textContent = msg; err.hidden = false; } }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (err) err.hidden = true;
      var email = form.elements.email;
      var ok = form.elements.consentimento;
      if (!email.value.trim() || !email.checkValidity()) { fail('Digite um e-mail válido.'); email.focus(); return; }
      if (ok && !ok.checked) { fail('Marque a caixa para autorizar o aviso por e-mail.'); ok.focus(); return; }
      var endpoint = form.getAttribute('data-endpoint');
      var data = new FormData(form);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) { if (params.get(k)) data.append(k, params.get(k)); });
      data.append('origem', window.location.pathname);
      if (btn) btn.disabled = true;
      fetch(endpoint, { method: 'POST', body: data, credentials: 'same-origin' })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (res && res.ok) { form.classList.add('is-done'); form.dispatchEvent(new CustomEvent('dx:lead')); }
          else { fail((res && res.message) || 'Não foi possível salvar agora. Tente de novo em instantes.'); }
        })
        .catch(function () { fail('Sem conexão. Confira sua internet e tente de novo.'); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });

  // Contador de quem está esperando uma porta (só aparece a partir do mínimo configurado no servidor)
  document.querySelectorAll('[data-count]').forEach(function (el) {
    if (window.location.protocol === 'file:') return;
    var root = document.body.getAttribute('data-root') || '';
    fetch(root + 'api/contador.php?lista=' + encodeURIComponent(el.getAttribute('data-count')))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.total) { el.querySelector('strong').textContent = res.total.toLocaleString('pt-BR'); el.hidden = false; }
      })
      .catch(function () {});
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

  // Checkout sempre abre no topo (Safari e navegadores do Instagram/Facebook guardavam o scroll da página de vendas)
  if (document.body.getAttribute('data-page') === 'checkout') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var toTop = function () { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
    toTop();
    window.addEventListener('load', toTop);
    window.addEventListener('pageshow', toTop);
  }

  // Leva os parâmetros de campanha (utm_*, src…) da página de vendas até o checkout
  var query = window.location.search;
  if (query) {
    document.querySelectorAll('a[data-keep-query]').forEach(function (a) {
      a.setAttribute('href', a.getAttribute('href').split('?')[0] + query);
    });
  }

  // Botão "Ir para o pagamento seguro" -> Hotmart
  document.querySelectorAll('[data-checkout-go]').forEach(function (btn) {
    var note = document.querySelector('[data-checkout-note]');
    var soon = document.querySelector('[data-checkout-soon]');
    if (!CHECKOUT_URL) {
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('href');
      if (soon) soon.hidden = false;
      if (note) note.hidden = true;
      return;
    }
    var url = CHECKOUT_URL;
    if (query) url += (url.indexOf('?') === -1 ? '?' : '&') + query.slice(1);
    btn.setAttribute('href', url);
  });

  // ===== Rastreamento com consentimento (LGPD) =====
  var page = document.body.getAttribute('data-page') || 'home';
  var tracking = { on: false };
  function track(evt, params) {
    if (!tracking.on) return;
    if (window.fbq && META_PIXEL_ID) window.fbq('track', evt, params || {});
    if (window.gtag && GTAG_ID) {
      var map = { ViewContent: 'view_item', InitiateCheckout: 'begin_checkout', Lead: 'generate_lead' };
      if (map[evt]) window.gtag('event', map[evt], { currency: PRODUCT.currency, value: PRODUCT.value, items: [{ item_id: PRODUCT.id, item_name: PRODUCT.name }] });
    }
  }
  function loadTracking() {
    if (tracking.on) return;
    tracking.on = true;
    if (META_PIXEL_ID) {
      /* Meta Pixel */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }
    if (GTAG_ID) {
      var g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GTAG_ID; document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', GTAG_ID);
    }
    var content = { content_name: PRODUCT.name, content_ids: [PRODUCT.id], content_type: 'product', value: PRODUCT.value, currency: PRODUCT.currency };
    if (page === 'vendas' || page === 'checkout') track('ViewContent', content);
  }
  function readConsent() { try { return localStorage.getItem('dx-consent'); } catch (e) { return null; } }
  function saveConsent(v) { try { localStorage.setItem('dx-consent', v); } catch (e) {} }
  if (META_PIXEL_ID || GTAG_ID) {
    var consent = readConsent();
    if (consent === 'yes') loadTracking();
    else if (consent !== 'no') {
      var bar = document.createElement('div');
      bar.className = 'dx-consent';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Cookies');
      var root = document.body.getAttribute('data-root') || '';
      bar.innerHTML = '<p>Aceitar ajuda a saber quais anúncios trazem leitores, para gastar menos e chegar a quem precisa. Não coletamos o que você anota. <a href="' + root + 'privacidade/index.html">Saiba mais</a></p>' +
        '<div><button type="button" class="dx-btn dx-btn-secondary" data-consent="no">Recusar</button><button type="button" class="dx-btn dx-btn-primary" data-consent="yes">Aceitar</button></div>';
      document.body.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-consent]'); if (!b) return;
        var v = b.getAttribute('data-consent'); saveConsent(v); bar.remove();
        if (v === 'yes') loadTracking();
      });
    }
  }
  // Clique no pagamento = início de checkout
  document.querySelectorAll('[data-checkout-go]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      track('InitiateCheckout', { content_name: PRODUCT.name, content_ids: [PRODUCT.id], value: PRODUCT.value, currency: PRODUCT.currency, num_items: 1 });
      // Dá tempo de o evento sair antes de trocar de página (sem isso, parte dos InitiateCheckout se perde)
      var href = btn.getAttribute('href');
      if (!tracking.on || !href || e.metaKey || e.ctrlKey || e.shiftKey || btn.target === '_blank') return;
      e.preventDefault();
      setTimeout(function () { window.location.href = href; }, 350);
    });
  });
  // Cadastro na lista da porta 01 = lead
  document.querySelectorAll('form.dx-lead').forEach(function (form) {
    form.addEventListener('dx:lead', function () { track('Lead'); });
  });

  // Ano no rodapé
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
