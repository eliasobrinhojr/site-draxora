// Minha semana · teste do app (só para convidados).
// Tudo o que a pessoa registra fica neste aparelho (localStorage). Para o servidor vão só eventos anônimos:
// {pid aleatório, turma, tipo, dia, valor?}. Nunca sono, humor, remédio ou nota.
(function () {
  'use strict';
  var CHAVE = 'dx_teste_v1';
  var API = '../api/teste.php';
  var SONO = [['9', '9 h ou mais'], ['8', '8 h'], ['7', '7 h'], ['6', '6 h'], ['5', '5 h ou menos']];
  var HUMOR = [['acelerado', 'Acelerado ou fora do controle'], ['animado', 'Animado'], ['normal', 'Normal para mim'], ['baixo', 'Pra baixo'], ['muito-baixo', 'Muito para baixo, tudo custa']];
  var REMEDIO = [['sim', 'Tomei como combinado'], ['nao', 'Não tomei como combinado'], ['nao-uso', 'Não uso remédio']];
  var DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  // ===== Datas (sempre no fuso do aparelho) =====
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function deYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function soma(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function hoje() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dm(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function segunda(d) { var w = (d.getDay() + 6) % 7; return soma(d, -w); }

  // ===== Armazenamento =====
  var st = ler();
  function ler() {
    try { var j = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (j && typeof j === 'object') return j; } catch (e) { /* sem armazenamento */ }
    return { regs: {}, fila: [] };
  }
  function grava() { try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) { /* cheio ou bloqueado */ } }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ===== Eventos anônimos (fila que sobrevive a falta de internet) =====
  function evento(tipo, dia, valor) {
    st.fila = st.fila || [];
    var chave = tipo + '|' + dia;
    st.fila = st.fila.filter(function (e) { return e.tipo + '|' + e.dia !== chave; });
    st.fila.push({ tipo: tipo, dia: dia, valor: valor || null });
    grava(); envia();
  }
  var enviando = false;
  function envia() {
    if (enviando || !st.pid || !st.fila || !st.fila.length) return;
    enviando = true;
    var e = st.fila[0];
    fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', keepalive: true,
      body: JSON.stringify({ pid: st.pid, turma: st.turma, tipo: e.tipo, dia: e.dia, valor: e.valor })
    }).then(function (r) {
      enviando = false;
      // 2xx: chegou. 4xx (menos 429): nunca vai passar, descarta. 429/5xx: tenta depois.
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) {
        st.fila.shift(); grava(); envia();
      }
    }).catch(function () { enviando = false; });
  }
  window.addEventListener('online', envia);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) envia(); });

  // ===== Telas =====
  function mostra(id) {
    $('#carregando').hidden = true;
    $$('.tela').forEach(function (s) { s.hidden = s.id !== 't-' + id; });
    var app = ['hoje', 'semana', 'resumo', 'ajustes'].indexOf(id) >= 0;
    $('#abas').hidden = !app;
    $$('#abas button').forEach(function (b) { if (b.dataset.tela === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (id === 'hoje') desenhaHoje();
    if (id === 'semana') desenhaSemana();
    if (id === 'resumo') desenhaResumo();
    window.scrollTo(0, 0);
  }
  $$('#abas button').forEach(function (b) { b.addEventListener('click', function () { mostra(b.dataset.tela); }); });

  function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function instalado() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }

  // ===== Entrada =====
  var turmaConvite = null;
  function inicia() {
    if (st.pid) { mostra('hoje'); envia(); return; }
    var c = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(c)) { mostra('convite'); return; }
    fetch(API + '?c=' + encodeURIComponent(c), { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ativa) { $('#t-convite h1').textContent = 'Este convite não está ativo.'; mostra('convite'); return; }
        turmaConvite = c;
        // No iPhone, o app da tela inicial tem armazenamento próprio: melhor instalar antes de começar.
        if (ios() && !instalado()) $('#aviso-ios').hidden = false;
        mostra('termo');
      })
      .catch(function () { $('#t-convite h1').textContent = 'Sem conexão agora.'; $('#t-convite p').textContent = 'Abra o link do convite de novo quando estiver com internet.'; mostra('convite'); });
  }

  $('#f-termo').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (!f.idade.checked || !f.aceito.checked) { var e = $('#erro-termo'); e.textContent = 'Marque as duas caixas para começar.'; e.hidden = false; return; }
    st = { pid: uuid(), turma: turmaConvite, aceito: new Date().toISOString(), regs: st.regs || {}, fila: [] };
    grava();
    evento('aceite', ymd(hoje()));
    $('#instalar-dica').hidden = instalado();
    mostra('hoje');
  });

  // ===== Hoje =====
  var diaSel = hoje();
  function opcoes(campo, lista) {
    var box = limpa($('.opcoes[data-campo="' + campo + '"]'));
    lista.forEach(function (o) {
      var l = el('label', 'op');
      var i = el('input'); i.type = 'radio'; i.name = campo; i.value = o[0];
      l.appendChild(i); l.appendChild(el('span', null, o[1])); box.appendChild(l);
    });
  }
  opcoes('sono', SONO); opcoes('humor', HUMOR); opcoes('remedio', REMEDIO);

  function desenhaHoje() {
    var h = hoje(), k = ymd(diaSel), r = (st.regs || {})[k] || {};
    var dif = Math.round((h - diaSel) / 864e5);
    $('#dia-titulo').textContent = dif === 0 ? 'Hoje' : dif === 1 ? 'Ontem' : DIAS_SEM[diaSel.getDay()] + ', ' + dm(diaSel);
    $('#dia-prox').disabled = dif <= 0;
    $('#dia-ant').disabled = dif >= 6;
    var f = $('#f-dia');
    ['sono', 'humor', 'remedio'].forEach(function (c) { $$('input[name="' + c + '"]').forEach(function (i) { i.checked = r[c] === i.value; }); });
    f.nota.value = r.nota || '';
    $('#ok-dia').hidden = true;
    contaSemana();
  }
  function contaSemana() {
    var s = segunda(hoje()), n = 0;
    for (var i = 0; i < 7; i++) if ((st.regs || {})[ymd(soma(s, i))]) n++;
    $('#semana-conta').textContent = 'Esta semana: ' + n + ' de 7 dias registrados.';
  }
  $('#dia-ant').addEventListener('click', function () { diaSel = soma(diaSel, -1); desenhaHoje(); });
  $('#dia-prox').addEventListener('click', function () { diaSel = soma(diaSel, 1); desenhaHoje(); });
  $('#f-dia').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, r = {};
    ['sono', 'humor', 'remedio'].forEach(function (c) { var i = f.querySelector('input[name="' + c + '"]:checked'); if (i) r[c] = i.value; });
    var nota = f.nota.value.trim().slice(0, 60);
    if (nota) r.nota = nota;
    var ok = $('#ok-dia');
    if (!r.sono && !r.humor && !r.remedio) { ok.textContent = 'Escolha pelo menos uma opção. Dia difícil? Só o humor já vale.'; ok.hidden = false; return; }
    var k = ymd(diaSel);
    st.regs = st.regs || {}; st.regs[k] = r; grava();
    evento('registro', k);
    ok.textContent = ymd(diaSel) === ymd(hoje()) ? 'Dia salvo. Até amanhã!' : 'Dia ' + dm(diaSel) + ' salvo.';
    ok.hidden = false;
    contaSemana();
  });

  // ===== Semana =====
  var semIni = segunda(hoje());
  function desenhaSemana() {
    var atual = segunda(hoje());
    $('#sem-titulo').textContent = ymd(semIni) === ymd(atual) ? 'Esta semana' : 'Semana de ' + dm(semIni);
    $('#sem-prox').disabled = semIni >= atual;
    var dias = []; for (var i = 0; i < 7; i++) dias.push(soma(semIni, i));
    var t = limpa($('#grade'));
    var cab = el('tr'); cab.appendChild(el('th', 'rot', ''));
    dias.forEach(function (d) { var th = el('th', null); th.appendChild(el('span', null, DIAS_SEM[d.getDay()])); th.appendChild(el('small', null, dm(d))); cab.appendChild(th); });
    t.appendChild(cab);
    function bloco(titulo, campo, lista) {
      var tr = el('tr', 'sec'); var th = el('th', null, titulo); th.colSpan = 8; tr.appendChild(th); t.appendChild(tr);
      lista.forEach(function (o) {
        var row = el('tr'); row.appendChild(el('th', 'rot', o[1]));
        dias.forEach(function (d) {
          var r = (st.regs || {})[ymd(d)] || {};
          var td = el('td'); var b = el('span', 'bola' + (r[campo] === o[0] ? ' cheia' : ''));
          b.setAttribute('aria-label', r[campo] === o[0] ? 'marcado' : 'vazio'); td.appendChild(b); row.appendChild(td);
        });
        t.appendChild(row);
      });
    }
    bloco('Sono', 'sono', SONO);
    bloco('Humor', 'humor', HUMOR);
    bloco('Remédio', 'remedio', [REMEDIO[0]]);
    var rn = el('tr'); rn.appendChild(el('th', 'rot', 'Nota'));
    dias.forEach(function (d) { var r = (st.regs || {})[ymd(d)] || {}; var td = el('td', 'nota-cel'); if (r.nota) { td.textContent = '•'; td.title = r.nota; } rn.appendChild(td); });
    t.appendChild(rn);
    var c = conta(dias);
    var nb = limpa($('#numeros'));
    [[c.curtas, 'noites com 5 h ou menos'], [c.acel, 'dias acelerados'], [c.mbaixo, 'dias muito para baixo']].forEach(function (x) {
      var d = el('div', 'num'); d.appendChild(el('b', null, String(x[0]))); d.appendChild(el('span', null, x[1])); nb.appendChild(d);
    });
    $('#alerta-sono').hidden = c.curtas < 3;
  }
  function conta(dias) {
    var c = { curtas: 0, acel: 0, mbaixo: 0, regs: 0, sonoSoma: 0, sonoN: 0, humor: {}, rem: { sim: 0, nao: 0, 'nao-uso': 0 }, notas: [] };
    dias.forEach(function (d) {
      var r = (st.regs || {})[ymd(d)]; if (!r) return;
      c.regs++;
      if (r.sono) { c.sonoSoma += +r.sono; c.sonoN++; if (r.sono === '5') c.curtas++; }
      if (r.humor) { c.humor[r.humor] = (c.humor[r.humor] || 0) + 1; if (r.humor === 'acelerado') c.acel++; if (r.humor === 'muito-baixo') c.mbaixo++; }
      if (r.remedio) c.rem[r.remedio]++;
      if (r.nota) c.notas.push([d, r.nota]);
    });
    return c;
  }
  $('#sem-ant').addEventListener('click', function () { semIni = soma(semIni, -7); desenhaSemana(); });
  $('#sem-prox').addEventListener('click', function () { semIni = soma(semIni, 7); desenhaSemana(); });

  // ===== Resumo (1 página para o profissional) =====
  var semanasResumo = 2;
  $$('#t-resumo .seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      semanasResumo = +b.dataset.sem;
      $$('#t-resumo .seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      desenhaResumo();
    });
  });
  function desenhaResumo() {
    var fim = hoje(), ini = soma(fim, -(7 * semanasResumo - 1));
    var dias = []; for (var i = 0; i < 7 * semanasResumo; i++) dias.push(soma(ini, i));
    var c = conta(dias);
    var f = limpa($('#folha'));
    var topo = el('header', 'folha-topo');
    topo.appendChild(el('p', 'eb', 'RESUMO PARA A CONSULTA · FEITO PELO PACIENTE'));
    topo.appendChild(el('h2', null, 'Últimas ' + semanasResumo + ' semanas: ' + dm(ini) + ' a ' + dm(fim) + '/' + fim.getFullYear()));
    topo.appendChild(el('p', null, 'Dias com registro: ' + c.regs + ' de ' + dias.length + '.'));
    f.appendChild(topo);

    var g = el('div', 'folha-grid');
    var s = el('section'); s.appendChild(el('h3', null, 'Sono'));
    s.appendChild(el('p', null, c.sonoN ? 'Média aproximada: ' + (c.sonoSoma / c.sonoN).toFixed(1).replace('.', ',') + ' h por noite (registro em faixas de 5 h ou menos a 9 h ou mais).' : 'Sem registro de sono no período.'));
    s.appendChild(el('p', null, 'Noites com 5 h ou menos: ' + c.curtas + '.'));
    g.appendChild(s);
    var h = el('section'); h.appendChild(el('h3', null, 'Humor (dias)'));
    var ul = el('ul');
    HUMOR.forEach(function (o) { ul.appendChild(el('li', null, o[1] + ': ' + (c.humor[o[0]] || 0))); });
    h.appendChild(ul); g.appendChild(h);
    var m = el('section'); m.appendChild(el('h3', null, 'Remédio'));
    if (c.rem.sim + c.rem.nao === 0 && c.rem['nao-uso'] > 0) m.appendChild(el('p', null, 'Não usa remédio.'));
    else if (c.rem.sim + c.rem.nao === 0) m.appendChild(el('p', null, 'Sem registro de remédio no período.'));
    else m.appendChild(el('p', null, 'Tomou como combinado em ' + c.rem.sim + ' dia(s); não tomou como combinado em ' + c.rem.nao + ' dia(s).'));
    g.appendChild(m);
    f.appendChild(g);

    // Linha do tempo: as bolinhas do humor e do sono, dia a dia, como na folha.
    var wrap = el('div', 'grade-wrap');
    var t = el('table', 'grade mini');
    var cab = el('tr'); cab.appendChild(el('th', 'rot', ''));
    dias.forEach(function (d) { var th = el('th', d.getDay() === 1 ? 'seg-ini' : null, String(d.getDate())); cab.appendChild(th); });
    t.appendChild(cab);
    var CURTO = { acelerado: 'Acelerado', animado: 'Animado', normal: 'Normal', baixo: 'Pra baixo', 'muito-baixo': 'Muito p/ baixo', '9': '9 h+', '8': '8 h', '7': '7 h', '6': '6 h', '5': '5 h ou -' };
    [['Humor', 'humor', HUMOR], ['Sono', 'sono', SONO]].forEach(function (b) {
      var tr = el('tr', 'sec'); var th = el('th', null, b[0]); th.colSpan = dias.length + 1; tr.appendChild(th); t.appendChild(tr);
      b[2].forEach(function (o) {
        var row = el('tr'); row.appendChild(el('th', 'rot', CURTO[o[0]]));
        dias.forEach(function (d) { var r = (st.regs || {})[ymd(d)] || {}; var td = el('td', d.getDay() === 1 ? 'seg-ini' : null); td.appendChild(el('span', 'bola' + (r[b[1]] === o[0] ? ' cheia' : ''))); row.appendChild(td); });
        t.appendChild(row);
      });
    });
    wrap.appendChild(t); f.appendChild(wrap);

    if (c.notas.length) {
      var n = el('section', 'notas'); n.appendChild(el('h3', null, 'Notas do paciente'));
      var ln = el('ul'); c.notas.forEach(function (x) { ln.appendChild(el('li', null, dm(x[0]) + ': ' + x[1])); });
      n.appendChild(ln); f.appendChild(n);
    }
    f.appendChild(el('p', 'rodape-folha', 'Para o profissional: resumo das últimas semanas, feito pelo paciente (ou por alguém próximo) a partir de registros diários (sono em faixas de horas e humor em 5 níveis descritos em palavras). Sem interpretação. Material educativo, não diagnóstico. Gerado em ' + dm(new Date()) + '/' + new Date().getFullYear() + ' · Minha semana (teste) · Draxora.'));
  }
  $('#btn-imprimir').addEventListener('click', function () {
    evento('resumo', ymd(hoje()), String(semanasResumo));
    window.print();
  });

  // ===== Depois da consulta =====
  $$('input[name="levou"]').forEach(function (i) { i.addEventListener('change', function () { $('#fs-ajudou').hidden = i.value !== 's'; }); });
  $('#f-consulta').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, levou = f.querySelector('input[name="levou"]:checked'), ajudou = f.querySelector('input[name="ajudou"]:checked');
    var ok = $('#ok-consulta');
    if (!levou || (levou.value === 's' && !ajudou)) { ok.textContent = 'Responda as perguntas acima.'; ok.hidden = false; return; }
    evento('consulta', ymd(hoje()), levou.value === 'n' ? 'n' : 's-' + ajudou.value);
    ok.textContent = 'Obrigado! Sua resposta ajuda a decidir o próximo passo.'; ok.hidden = false;
  });

  // ===== Ajustes: lembrete =====
  function proximoHorario() {
    var hm = ($('#hora-lembrete').value || '21:00').split(':');
    var d = new Date(); d.setHours(+hm[0], +hm[1], 0, 0);
    if (d < new Date()) d.setDate(d.getDate() + 1);
    return d;
  }
  function fmtIcs(d) { return ymd(d).replace(/-/g, '') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00'; }
  var URL_APP = location.origin + location.pathname;
  $('#btn-ics').addEventListener('click', function () {
    var d = proximoHorario(), f = new Date(d.getTime() + 5 * 60000);
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Draxora//Minha semana teste//PT', 'BEGIN:VEVENT',
      'UID:' + uuid() + '@draxora.com.br', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + fmtIcs(d), 'DTEND:' + fmtIcs(f), 'RRULE:FREQ=DAILY', 'SUMMARY:Minha semana: 20 segundos',
      'DESCRIPTION:Sono\\, humor e remédio. ' + URL_APP, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Minha semana', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    evento('lembrete', ymd(hoje()), 'ics');
    if (ios()) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
    baixa(new Blob([ics], { type: 'text/calendar' }), 'lembrete-minha-semana.ics');
  });
  $('#btn-google').addEventListener('click', function () {
    var d = proximoHorario(), f = new Date(d.getTime() + 5 * 60000);
    var u = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Minha semana: 20 segundos') +
      '&dates=' + fmtIcs(d) + '/' + fmtIcs(f) + '&ctz=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo') +
      '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY') + '&details=' + encodeURIComponent('Sono, humor e remédio. ' + URL_APP);
    evento('lembrete', ymd(hoje()), 'google');
    window.open(u, '_blank', 'noopener');
  });
  function baixa(blob, nome) {
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ===== Ajustes: instalar =====
  var pedidoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); pedidoInstalar = e; $('#btn-instalar').hidden = false; });
  $('#btn-instalar').addEventListener('click', function () { if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; $('#btn-instalar').hidden = true; } });

  // ===== Ajustes: cópia =====
  $('#btn-copia').addEventListener('click', function () {
    var dados = { app: 'draxora-minha-semana-teste', versao: 1, exportado_em: new Date().toISOString(), pid: st.pid, turma: st.turma, aceito: st.aceito, regs: st.regs || {} };
    baixa(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }), 'minha-semana-copia-' + ymd(hoje()) + '.json');
    evento('copia', ymd(hoje()));
    var ok = $('#ok-copia'); ok.textContent = 'Cópia salva nos downloads do aparelho.'; ok.hidden = false;
  });
  $('#arq-copia').addEventListener('change', function (ev) {
    var arq = ev.target.files && ev.target.files[0]; if (!arq) return;
    var ok = $('#ok-copia');
    arq.text().then(function (txt) {
      var j = JSON.parse(txt);
      if (!j || j.app !== 'draxora-minha-semana-teste' || typeof j.regs !== 'object') throw new Error('arquivo');
      var n = 0;
      Object.keys(j.regs).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        var r = j.regs[k] || {}, limpo = {};
        if (SONO.some(function (o) { return o[0] === r.sono; })) limpo.sono = r.sono;
        if (HUMOR.some(function (o) { return o[0] === r.humor; })) limpo.humor = r.humor;
        if (REMEDIO.some(function (o) { return o[0] === r.remedio; })) limpo.remedio = r.remedio;
        if (typeof r.nota === 'string' && r.nota) limpo.nota = r.nota.slice(0, 60);
        if (Object.keys(limpo).length) { st.regs[k] = limpo; n++; }
      });
      // A cópia traz o mesmo participante: continua contando como a mesma pessoa no teste.
      if (j.pid && /^[0-9a-f-]{36}$/.test(j.pid)) { st.pid = j.pid; st.turma = j.turma; st.aceito = j.aceito; }
      grava();
      ok.textContent = n + ' dia(s) restaurado(s).'; ok.hidden = false;
    }).catch(function () { ok.textContent = 'Este arquivo não é uma cópia do Minha semana.'; ok.hidden = false; });
    ev.target.value = '';
  });

  // ===== Ajustes: sair =====
  $('#btn-sair').addEventListener('click', function () { $('#confirma-sair').hidden = false; $('#btn-sair').hidden = true; });
  $('#btn-sair-nao').addEventListener('click', function () { $('#confirma-sair').hidden = true; $('#btn-sair').hidden = false; });
  $('#btn-sair-sim').addEventListener('click', function () {
    var pid = st.pid, turma = st.turma;
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', keepalive: true,
      body: JSON.stringify({ pid: pid, turma: turma, tipo: 'saiu', dia: ymd(hoje()) }) }).catch(function () {});
    try { localStorage.removeItem(CHAVE); } catch (e) { /* nada */ }
    st = { regs: {}, fila: [] };
    $('#t-convite h1').textContent = 'Você saiu do teste. Obrigado por participar.';
    $('#t-convite p').textContent = 'Os registros deste aparelho foram apagados.';
    mostra('convite');
  });

  // ===== Funciona sem internet depois da primeira visita =====
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  inicia();
})();
