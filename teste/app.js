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
  // "Se aconteceu hoje": fatos do dia, opcionais, que não nomeiam nenhum quadro. [chave, texto, rótulo curto]
  var MARCAS = [
    ['muda', 'O humor mudou muito no mesmo dia', 'Humor mudou no dia'],
    ['irrita', 'Muita irritação ou explosão', 'Irritação forte'],
    ['impulso', 'Agi por impulso (gasto, comida, briga ou algo de que me arrependi)', 'Impulso'],
    ['foco', 'Perdi o foco ou esqueci algo importante', 'Foco ou esquecimento'],
    ['ansiedade', 'Crise de ansiedade ou pânico', 'Ansiedade ou pânico'],
    ['evitei', 'Evitei pessoas, saídas ou compromissos', 'Evitei pessoas'],
    ['substancia', 'Usei álcool ou outras substâncias mais do que o normal', 'Álcool ou substâncias'],
    ['morte', 'Tive pensamentos de morte ou de me machucar', 'Pensamentos de morte']
  ];
  // Quando "pensamentos de morte" é marcado, o app mostra ajuda na hora. Ele não avisa ninguém (está no termo).
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
  // A aba "Hoje" sempre abre no dia de hoje (outros dias: setas ou toque na Semana).
  $$('#abas button').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.tela === 'hoje') diaSel = hoje(); mostra(b.dataset.tela); }); });

  function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function navegadorDeApp() { return /Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|TikTok|musical_ly|Line\//.test(navigator.userAgent); }
  function instalado() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function android() { return /Android/i.test(navigator.userAgent); }
  // Pede ao navegador para não apagar os registros quando faltar espaço (Chrome e ícone da tela inicial).
  function pedePersistir() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* nada */ } }

  // ===== Levar os registros entre lugares do mesmo celular =====
  // Navegador, ícone da tela inicial (iPhone) e navegador de dentro de outros apps guardam tudo separado.
  // O código "MS1." leva os registros pela área de transferência do próprio celular: nada passa pela Draxora.
  function codifica() {
    var b = new TextEncoder().encode(JSON.stringify({ p: st.pid, t: st.turma, a: st.aceito, r: st.regs || {} })), s = '';
    for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return 'MS1.' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodifica(txt) {
    var m = String(txt || '').replace(/\s+/g, '').match(/MS1\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      var s = atob(m[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((m[1].length + 3) % 4));
      var b = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      var j = JSON.parse(new TextDecoder().decode(b));
      return j && typeof j === 'object' && j.r && typeof j.r === 'object' ? j : null;
    } catch (e) { return null; }
  }
  // Só aceita as opções que o app conhece (cópia em arquivo ou código colado).
  function limpaRegs(regs) {
    var out = {};
    Object.keys(regs || {}).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var r = regs[k] || {}, limpo = {};
      if (SONO.some(function (o) { return o[0] === r.sono; })) limpo.sono = r.sono;
      if (HUMOR.some(function (o) { return o[0] === r.humor; })) limpo.humor = r.humor;
      if (REMEDIO.some(function (o) { return o[0] === r.remedio; })) limpo.remedio = r.remedio;
      if (typeof r.nota === 'string' && r.nota) limpo.nota = r.nota.slice(0, 140);
      if (Array.isArray(r.marcas)) { var ms = r.marcas.filter(function (m) { return MARCAS.some(function (o) { return o[0] === m; }); }); if (ms.length) limpo.marcas = ms; }
      if (Object.keys(limpo).length) out[k] = limpo;
    });
    return out;
  }
  // Junta os dias que faltam aqui (o que já está registrado aqui fica como está). Fica o participante que
  // começou primeiro, para o teste continuar contando como a mesma pessoa.
  function junta(j) {
    var regs = limpaRegs(j.r), n = 0, iguais = 0;
    st.regs = st.regs || {};
    Object.keys(regs).forEach(function (k) { if (st.regs[k]) iguais++; else { st.regs[k] = regs[k]; n++; } });
    var pidOk = typeof j.p === 'string' && /^[0-9a-f-]{36}$/.test(j.p);
    if (pidOk && (!st.pid || !st.aceito || (j.a && String(j.a) < String(st.aceito)))) { st.pid = j.p; st.turma = j.t || null; st.aceito = j.a || new Date().toISOString(); }
    st.fila = st.fila || [];
    grava();
    return { novos: n, iguais: iguais };
  }
  function diasTxt(n) { return n === 1 ? '1 dia' : n + ' dias'; }

  // ===== Entrada =====
  var turmaConvite = null;
  function inicia() {
    if (st.pid) {
      pedePersistir();
      // Hoje já registrado: abre na Semana com o dia destacado (o formulário preenchido confundia).
      if ((st.regs || {})[ymd(hoje())]) { semIni = segunda(hoje()); semDestaque = ymd(hoje()); mostra('semana'); }
      else mostra('hoje');
      envia(); return;
    }
    var c = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(c)) { mostra('convite'); return; }
    fetch(API + '?c=' + encodeURIComponent(c), { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ativa) { $('#t-convite h1').textContent = 'Este convite não está ativo.'; mostra('convite'); return; }
        turmaConvite = c;
        // No iPhone, o ícone da tela inicial tem armazenamento próprio: começa pelo ícone.
        // Dentro do Instagram, Facebook, LinkedIn etc.: não instala e os registros ficam presos ao app.
        // Nesses dois casos o termo só aparece depois de "Prefiro começar aqui mesmo assim".
        var porta = false;
        if (navegadorDeApp()) {
          porta = true; $('#aviso-inapp').hidden = false;
          if (android()) {
            var a = $('#abrir-chrome');
            a.href = 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;package=com.android.chrome;end';
            a.hidden = false;
          }
        } else if (ios() && !instalado()) { porta = true; $('#aviso-ios').hidden = false; }
        $('#f-termo').hidden = porta;
        $('#mesmo-assim').hidden = !porta;
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
    pedePersistir();
    mostra('hoje');
  });
  $('#btn-mesmo-assim').addEventListener('click', function () {
    $('#f-termo').hidden = false; $('#mesmo-assim').hidden = true;
    $('#f-termo').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Primeira tela: trazer os registros de outro lugar do celular.
  function abreTrazer() {
    $('#trazer-form').hidden = false; $('#btn-trazer').hidden = true;
    $('#trazer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { $('#cod-trazer').focus(); }, 350);
  }
  $('#link-trazer').addEventListener('click', function (e) { e.preventDefault(); abreTrazer(); });
  $('#btn-trazer').addEventListener('click', abreTrazer);
  $('#btn-convite-trazer').addEventListener('click', function () {
    // Sem convite válido (ícone salvo sem o link da turma): só a parte de trazer os registros.
    ['#f-termo', '#mesmo-assim', '#aviso-inapp', '#aviso-ios', '#link-trazer'].forEach(function (s) { $(s).hidden = true; });
    mostra('termo'); abreTrazer();
  });
  $('#btn-trazer-ok').addEventListener('click', function () {
    var j = decodifica($('#cod-trazer').value), er = $('#erro-trazer');
    if (!j || typeof j.p !== 'string' || !/^[0-9a-f-]{36}$/.test(j.p)) {
      er.textContent = 'Não reconheci o código. No lugar onde você registrou, abra Ajustes, toque em "Copiar meus registros" e cole aqui de novo.';
      er.hidden = false; return;
    }
    er.hidden = true;
    var r = junta(j);
    pedePersistir(); envia();
    $('#cod-trazer').value = '';
    mostra('hoje');
    aviso(diasTxt(r.novos) + (r.novos === 1 ? ' trazido.' : ' trazidos.') + ' Continue por aqui.');
  });

  // ===== Hoje =====
  var diaSel = hoje();
  function opcoes(campo, lista) {
    var box = limpa($('.opcoes[data-campo="' + campo + '"]'));
    lista.forEach(function (o) {
      var l = el('label', 'op');
      var i = el('input'); i.type = 'radio'; i.name = campo; i.value = o[0];
      l.appendChild(i); l.appendChild(el('span', null, o[1])); box.appendChild(l);
      // Tocar de novo na opção marcada desmarca (para corrigir um toque errado).
      var estava = false;
      l.addEventListener('pointerdown', function () { estava = i.checked; });
      i.addEventListener('click', function () { if (estava) { i.checked = false; estava = false; } });
    });
  }
  opcoes('sono', SONO); opcoes('humor', HUMOR); opcoes('remedio', REMEDIO);
  (function () {
    var box = limpa($('.opcoes[data-campo="marcas"]'));
    MARCAS.forEach(function (o) {
      var l = el('label', 'op');
      var i = el('input'); i.type = 'checkbox'; i.name = 'marcas'; i.value = o[0];
      l.appendChild(i); l.appendChild(el('span', null, o[1])); box.appendChild(l);
    });
  })();

  function desenhaHoje() {
    var h = hoje(), k = ymd(diaSel), r = (st.regs || {})[k] || {};
    var dif = Math.round((h - diaSel) / 864e5);
    $('#dia-titulo').textContent = dif === 0 ? 'Hoje' : dif === 1 ? 'Ontem' : DIAS_SEM[diaSel.getDay()] + ', ' + dm(diaSel);
    $('#dia-prox').disabled = dif <= 0;
    $('#dia-ant').disabled = dif >= 6;
    var f = $('#f-dia');
    ['sono', 'humor', 'remedio'].forEach(function (c) { $$('input[name="' + c + '"]').forEach(function (i) { i.checked = r[c] === i.value; }); });
    $$('input[name="marcas"]').forEach(function (i) { i.checked = (r.marcas || []).indexOf(i.value) >= 0; });
    ajudaMorte();
    f.nota.value = r.nota || '';
    $('#conta-nota').textContent = f.nota.value.length + '/140';
    $('#ok-dia').hidden = true;
    var ja = !!(st.regs || {})[k];
    $('#dica-dia').textContent = ja ? 'Este dia já está registrado. Mude o que quiser e salve de novo; para desmarcar, toque de novo na opção.' : 'Escolha uma opção em cada linha. Dia difícil? Só o humor já vale.';
    f.querySelector('button[type="submit"]').textContent = ja ? 'Salvar alteração' : 'Salvar o dia';
    contaSemana();
    dicaInstalar();
  }
  // Fora do ícone da tela inicial: no iPhone e nos navegadores de outros apps, lembra de levar os registros.
  function dicaInstalar() {
    var d = $('#instalar-dica'), t = $('#instalar-dica-txt');
    if (instalado()) { d.hidden = true; return; }
    limpa(t);
    var b = el('b');
    if (navegadorDeApp()) {
      b.textContent = 'Você está no navegador de dentro de outro app.';
      t.appendChild(b); t.appendChild(document.createTextNode(' Para não perder os registros, leve-os para o navegador do celular: Ajustes, "Copiar meus registros".'));
    } else if (ios()) {
      b.textContent = 'No iPhone, o ícone da tela inicial não enxerga o que está no Safari.';
      t.appendChild(b); t.appendChild(document.createTextNode(' Se for pôr o ícone, antes toque em Ajustes, "Copiar meus registros", e depois cole no ícone.'));
    } else {
      b.textContent = 'Deixe na tela inicial';
      t.appendChild(b); t.appendChild(document.createTextNode(' para abrir em 1 toque. Veja como em Ajustes.'));
    }
    d.hidden = false;
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
    var marcas = $$('input[name="marcas"]:checked').map(function (i) { return i.value; });
    if (marcas.length) r.marcas = marcas;
    var nota = f.nota.value.trim().slice(0, 140);
    if (nota) r.nota = nota;
    var ok = $('#ok-dia');
    if (!r.sono && !r.humor && !r.remedio && !r.marcas) { ok.textContent = 'Escolha pelo menos uma opção. Dia difícil? Só o humor já vale.'; ok.hidden = false; return; }
    var k = ymd(diaSel), editou = !!(st.regs || {})[k];
    st.regs = st.regs || {}; st.regs[k] = r; grava();
    evento('registro', k);
    // Depois de salvar, mostra a semana com o dia destacado; o aviso tem "Corrigir" para voltar.
    var dia = diaSel;
    semIni = segunda(dia); semDestaque = k;
    mostra('semana');
    aviso(editou ? 'Alteração salva.' : (k === ymd(hoje()) ? 'Dia salvo. Até amanhã!' : 'Dia ' + dm(dia) + ' salvo.'), 'Corrigir', function () { diaSel = dia; mostra('hoje'); });
  });

  // Dicas (sempre à mão na tela Hoje).
  var dlg = $('#dicas');
  function fechaDicas() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $('#btn-dicas').addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
  $('#dicas-fechar').addEventListener('click', fechaDicas);
  $('#dicas-ok').addEventListener('click', fechaDicas);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) fechaDicas(); });
  function ajudaMorte() { var i = document.querySelector('input[name="marcas"][value="morte"]'); $('#ajuda-morte').hidden = !(i && i.checked); }
  document.addEventListener('change', function (e) { if (e.target && e.target.name === 'marcas') ajudaMorte(); });
  $('#f-dia').nota.addEventListener('input', function () { $('#conta-nota').textContent = this.value.length + '/140'; });

  // Aviso curto no rodapé da tela, com uma ação opcional.
  var avisoTimer = null;
  function aviso(txt, acao, fn) {
    var a = $('#aviso'), b = $('#aviso-acao');
    $('#aviso-txt').textContent = txt;
    b.hidden = !acao; b.textContent = acao || ''; b.onclick = function () { a.hidden = true; fn(); };
    a.hidden = false;
    clearTimeout(avisoTimer); avisoTimer = setTimeout(function () { a.hidden = true; }, 6000);
  }

  // ===== Semana =====
  var semIni = segunda(hoje()), semDestaque = null;
  function desenhaSemana() {
    var atual = segunda(hoje());
    $('#sem-titulo').textContent = ymd(semIni) === ymd(atual) ? 'Esta semana' : 'Semana de ' + dm(semIni);
    $('#sem-prox').disabled = semIni >= atual;
    var dias = []; for (var i = 0; i < 7; i++) dias.push(soma(semIni, i));
    var t = limpa($('#grade'));
    var cab = el('tr'); cab.appendChild(el('th', 'rot', ''));
    var h0 = hoje();
    dias.forEach(function (d) {
      var dif = Math.round((h0 - d) / 864e5), k = ymd(d);
      var th = el('th', k === semDestaque ? 'destaque' : null);
      // Dias dos últimos 7 podem ser abertos para corrigir.
      var alvo = th;
      if (dif >= 0 && dif <= 6) {
        alvo = el('button', 'dia-btn'); alvo.type = 'button';
        alvo.setAttribute('aria-label', 'Corrigir ' + DIAS_SEM[d.getDay()] + ' ' + dm(d));
        alvo.addEventListener('click', function () { diaSel = d; mostra('hoje'); });
        th.appendChild(alvo);
      }
      alvo.appendChild(el('span', null, DIAS_SEM[d.getDay()])); alvo.appendChild(el('small', null, dm(d)));
      cab.appendChild(th);
    });
    t.appendChild(cab);
    function bloco(titulo, campo, lista) {
      var tr = el('tr', 'sec'); var th = el('th', null, titulo); th.colSpan = 8; tr.appendChild(th); t.appendChild(tr);
      lista.forEach(function (o) {
        var row = el('tr'); var rot = el('th', 'rot', o[2] || o[1]); rot.title = o[1]; row.appendChild(rot);
        dias.forEach(function (d) {
          var r = (st.regs || {})[ymd(d)] || {};
          var tem = Array.isArray(r[campo]) ? r[campo].indexOf(o[0]) >= 0 : r[campo] === o[0];
          var td = el('td'); var b = el('span', 'bola' + (tem ? ' cheia' : ''));
          b.setAttribute('aria-label', tem ? 'marcado' : 'vazio'); td.appendChild(b); row.appendChild(td);
        });
        t.appendChild(row);
      });
    }
    bloco('Sono', 'sono', SONO);
    bloco('Humor', 'humor', HUMOR);
    // As três respostas viram linhas (antes só "Tomei": quem marcava "Não tomei" não via nada na Semana).
    bloco('Remédio', 'remedio', [['sim', REMEDIO[0][1], 'Tomei'], ['nao', REMEDIO[1][1], 'Não tomei'], ['nao-uso', REMEDIO[2][1], 'Não uso']]);
    bloco('Se aconteceu', 'marcas', MARCAS);
    var rn = el('tr'); rn.appendChild(el('th', 'rot', 'Nota'));
    dias.forEach(function (d) { var r = (st.regs || {})[ymd(d)] || {}; var td = el('td', 'nota-cel'); if (r.nota) { td.textContent = '•'; td.title = r.nota; } rn.appendChild(td); });
    t.appendChild(rn);
    var c = conta(dias);
    var nb = limpa($('#numeros'));
    [[c.curtas, 'noites com 5 h ou menos'], [c.acel, 'dias acelerados'], [c.mbaixo, 'dias muito para baixo']].forEach(function (x) {
      var d = el('div', 'num'); d.appendChild(el('b', null, String(x[0]))); d.appendChild(el('span', null, x[1])); nb.appendChild(d);
    });
    $('#alerta-sono').hidden = c.curtas < 3;
    $('#alerta-morte').hidden = !c.marcas.morte;
  }
  function conta(dias) {
    var c = { curtas: 0, acel: 0, mbaixo: 0, regs: 0, sonoSoma: 0, sonoN: 0, humor: {}, rem: { sim: 0, nao: 0, 'nao-uso': 0 }, notas: [], marcas: {} };
    dias.forEach(function (d) {
      var r = (st.regs || {})[ymd(d)]; if (!r) return;
      c.regs++;
      if (r.sono) { c.sonoSoma += +r.sono; c.sonoN++; if (r.sono === '5') c.curtas++; }
      if (r.humor) { c.humor[r.humor] = (c.humor[r.humor] || 0) + 1; if (r.humor === 'acelerado') c.acel++; if (r.humor === 'muito-baixo') c.mbaixo++; }
      if (r.remedio) c.rem[r.remedio]++;
      if (r.nota) c.notas.push([d, r.nota]);
      (r.marcas || []).forEach(function (m) { c.marcas[m] = (c.marcas[m] || 0) + 1; });
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
    topo.appendChild(el('h2', null, dm(ini) + ' a ' + dm(fim) + '/' + fim.getFullYear()));
    topo.appendChild(el('p', 'folha-sub', 'Últimas ' + semanasResumo + ' semanas · ' + c.regs + ' de ' + dias.length + ' dias com registro'));
    f.appendChild(topo);

    // Três números de destaque (o que o profissional costuma perguntar primeiro).
    var remReg = c.rem.sim + c.rem.nao;
    var nums = el('div', 'folha-nums');
    [[c.sonoN ? (c.sonoSoma / c.sonoN).toFixed(1).replace('.', ',') + ' h' : '–', 'sono médio por noite'],
     [String(c.curtas), c.curtas === 1 ? 'noite com 5 h ou menos' : 'noites com 5 h ou menos'],
     [remReg ? c.rem.sim + ' de ' + remReg : '–', 'remédio como combinado']].forEach(function (x) {
      var d = el('div', 'num'); d.appendChild(el('b', null, x[0])); d.appendChild(el('span', null, x[1])); nums.appendChild(d);
    });
    f.appendChild(nums);

    // Contagens em linhas: rótulo à esquerda, número à direita (zeros mais claros).
    function linhas(titulo, itens, vazio) {
      var sec = el('section'); var h3 = el('h3', null, titulo[0]); if (titulo[1]) h3.appendChild(el('small', null, titulo[1])); sec.appendChild(h3);
      if (!itens.length) { sec.appendChild(el('p', 'vazio', vazio)); return sec; }
      itens.forEach(function (it) {
        var l = el('div', 'lin' + (it[1] ? '' : ' zero')); l.appendChild(el('span', null, it[0])); l.appendChild(el('b', null, String(it[1]))); sec.appendChild(l);
      });
      return sec;
    }
    var g = el('div', 'folha-grid');
    g.appendChild(linhas(['Humor', 'dias'], HUMOR.map(function (o) { return [o[1], c.humor[o[0]] || 0]; })));
    var sonoL = SONO.map(function (o) { return [o[1], 0, o[0]]; });
    dias.forEach(function (d) { var r = (st.regs || {})[ymd(d)]; if (r && r.sono) sonoL.forEach(function (x) { if (x[2] === r.sono) x[1]++; }); });
    g.appendChild(linhas(['Sono', 'noites'], c.sonoN ? sonoL : [], 'Sem registro de sono no período.'));
    var remL = [];
    if (remReg || c.rem['nao-uso']) {
      remL.push(['Tomou como combinado', c.rem.sim], ['Não tomou como combinado', c.rem.nao]);
      if (c.rem['nao-uso']) remL.push(['Não usa remédio', c.rem['nao-uso']]);
      var semRem = c.regs - remReg - c.rem['nao-uso']; if (semRem > 0) remL.push(['Sem resposta', semRem]);
    }
    g.appendChild(linhas(['Remédio', 'dias'], remL, 'Sem registro de remédio no período.'));
    g.appendChild(linhas(['Se aconteceu', 'dias'], MARCAS.filter(function (o) { return c.marcas[o[0]]; }).map(function (o) { return [o[1], c.marcas[o[0]]]; }), 'Nenhuma marcação no período.'));
    f.appendChild(g);

    // Linha do tempo: as bolinhas do humor e do sono, dia a dia, como na folha.
    var wrap = el('div', 'grade-wrap');
    var t = el('table', 'grade mini');
    var cab = el('tr'); cab.appendChild(el('th', 'rot', ''));
    dias.forEach(function (d) { var th = el('th', d.getDay() === 1 ? 'seg-ini' : null, String(d.getDate())); cab.appendChild(th); });
    t.appendChild(cab);
    var CURTO = { acelerado: 'Acelerado', animado: 'Animado', normal: 'Normal', baixo: 'Pra baixo', 'muito-baixo': 'Muito p/ baixo', '9': '9 h+', '8': '8 h', '7': '7 h', '6': '6 h', '5': '5 h ou -' };
    MARCAS.forEach(function (o) { CURTO[o[0]] = o[2]; });
    CURTO.sim = 'Tomou'; CURTO.nao = 'Não tomou'; CURTO['nao-uso'] = 'Não usa';
    var linhasT = [['Humor', 'humor', HUMOR], ['Sono', 'sono', SONO]];
    if (remReg || c.rem['nao-uso']) linhasT.push(['Remédio', 'remedio', REMEDIO.filter(function (o) { return o[0] !== 'nao-uso' || c.rem['nao-uso']; })]);
    if (Object.keys(c.marcas).length) linhasT.push(['Se aconteceu', 'marcas', MARCAS.filter(function (o) { return c.marcas[o[0]]; })]);
    f.appendChild(el('h3', 'folha-h3', 'Dia a dia'));
    linhasT.forEach(function (b) {
      var tr = el('tr', 'sec'); var th = el('th', null, b[0]); th.colSpan = dias.length + 1; tr.appendChild(th); t.appendChild(tr);
      b[2].forEach(function (o) {
        var row = el('tr'); row.appendChild(el('th', 'rot', CURTO[o[0]]));
        dias.forEach(function (d) { var r = (st.regs || {})[ymd(d)] || {}; var v = r[b[1]]; var tem = Array.isArray(v) ? v.indexOf(o[0]) >= 0 : v === o[0]; var td = el('td', d.getDay() === 1 ? 'seg-ini' : null); td.appendChild(el('span', 'bola' + (tem ? ' cheia' : ''))); row.appendChild(td); });
        t.appendChild(row);
      });
    });
    wrap.appendChild(t); f.appendChild(wrap);

    if (c.notas.length) {
      var n = el('section', 'notas'); n.appendChild(el('h3', null, 'Notas do paciente'));
      var ln = el('ul'); c.notas.forEach(function (x) { ln.appendChild(el('li', null, dm(x[0]) + ': ' + x[1])); });
      n.appendChild(ln); f.appendChild(n);
    }
    f.appendChild(el('p', 'rodape-folha', 'Para o profissional: resumo das últimas semanas, feito pelo paciente (ou por alguém próximo) a partir de registros diários (sono em faixas de horas, humor em 5 níveis descritos em palavras e, quando marcado, situações do dia). Sem interpretação. Material educativo, não diagnóstico. Gerado em ' + dm(new Date()) + '/' + new Date().getFullYear() + ' · Minha semana (teste) · Draxora.'));
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

  // ===== Ajustes: levar os registros (código pela área de transferência) =====
  $('#btn-copiar-cod').addEventListener('click', function () {
    var cod = codifica(), ok = $('#ok-levar'), ta = $('#cod-levar');
    function campo() {
      ta.value = cod; ta.hidden = false; ta.focus(); ta.select();
      ok.textContent = 'Toque e segure no campo acima e escolha Copiar. Depois cole no outro lugar.'; ok.hidden = false;
    }
    evento('copia', ymd(hoje()));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cod).then(function () {
        ta.hidden = true;
        ok.textContent = 'Copiado (' + diasTxt(Object.keys(st.regs || {}).length) + '). Abra o teste no outro lugar e cole em "Trazer meus registros" ou em Ajustes, "Colar registros".';
        ok.hidden = false;
      }, campo);
    } else campo();
  });
  $('#btn-colar-cod').addEventListener('click', function () { $('#colar-form').hidden = false; $('#cod-colar').focus(); });
  $('#btn-colar-ok').addEventListener('click', function () {
    var j = decodifica($('#cod-colar').value), ok = $('#ok-levar');
    if (!j) { ok.textContent = 'Não reconheci o código. Copie de novo no outro lugar e cole aqui.'; ok.hidden = false; return; }
    var r = junta(j);
    envia();
    ok.textContent = diasTxt(r.novos) + (r.novos === 1 ? ' juntado.' : ' juntados.') + (r.iguais === 1 ? ' 1 dia que já estava aqui ficou como estava.' : r.iguais > 1 ? ' ' + r.iguais + ' dias que já estavam aqui ficaram como estavam.' : '');
    ok.hidden = false; $('#colar-form').hidden = true; $('#cod-colar').value = '';
  });

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
      var regs = limpaRegs(j.regs), n = 0;
      st.regs = st.regs || {};
      Object.keys(regs).forEach(function (k) { st.regs[k] = regs[k]; n++; });
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
  // Atualização: o ícone da tela inicial costuma voltar do segundo plano sem recarregar. Ao voltar, procura versão
  // nova; quando ela assume, recarrega uma vez (só se já havia versão antiga rodando, nunca na primeira visita).
  if ('serviceWorker' in navigator) {
    var tinhaVersao = !!navigator.serviceWorker.controller, recarregou = false;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!tinhaVersao || recarregou) return;
      recarregou = true; location.reload();
    });
  }

  inicia();
})();
