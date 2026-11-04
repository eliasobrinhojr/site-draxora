// Painel · Teste do app (/teste/). Só contagens anônimas. Texto vindo do banco entra com textContent.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
  var dados = null, filtro = 'todas';

  function api(acao, corpo) {
    return fetch('dados.php?acao=' + acao, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function carrega() {
    return api('teste').then(function (d) { if (!d.ok) return; dados = d; $('#teste').hidden = false; desenha(); }).catch(function () {});
  }
  document.addEventListener('dx:carregado', carrega);

  function vazio() {
    return { participantes: 0, sairam: 0, resumo: 0, lembrete: 0, semanas: { 1: { completas: 0, ativos: 0 }, 2: { completas: 0, ativos: 0 }, 3: { completas: 0, ativos: 0 }, 4: { completas: 0, ativos: 0 } },
      dist: [0, 0, 0, 0, 0, 0, 0, 0], consulta: { 's-muito': 0, 's-um-pouco': 0, 's-nao': 0, n: 0 }, w4_lembrete: { completas: 0, ativos: 0 }, w4_sem_lembrete: { completas: 0, ativos: 0 } };
  }
  function soma(a, b) {
    ['participantes', 'sairam', 'resumo', 'lembrete'].forEach(function (k) { a[k] += b[k]; });
    [1, 2, 3, 4].forEach(function (k) { a.semanas[k].completas += b.semanas[k].completas; a.semanas[k].ativos += b.semanas[k].ativos; });
    b.dist.forEach(function (v, i) { a.dist[i] += v; });
    Object.keys(a.consulta).forEach(function (k) { a.consulta[k] += b.consulta[k] || 0; });
    ['w4_lembrete', 'w4_sem_lembrete'].forEach(function (g) { a[g].completas += b[g].completas; a[g].ativos += b[g].ativos; });
    return a;
  }

  function desenha() {
    var f = limpa($('#teste-filtro'));
    var opcoes = [['todas', 'Todas']].concat(dados.turmas.map(function (t) { return [t.codigo, t.codigo]; }));
    opcoes.forEach(function (o) {
      var b = el('button', null, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(filtro === o[0]));
      b.addEventListener('click', function () { filtro = o[0]; desenha(); }); f.appendChild(b);
    });
    var T = vazio();
    Object.keys(dados.por_turma).forEach(function (c) { if (filtro === 'todas' || filtro === c) soma(T, dados.por_turma[c]); });
    var box = limpa($('#teste-conteudo'));

    var k = el('div', 'teste-kpis');
    [[T.participantes, 'aceitaram'], [T.sairam, 'saíram'], [T.resumo, 'geraram resumo'], [T.lembrete, 'baixaram lembrete']].forEach(function (x) {
      var d = el('div', 'teste-kpi'); d.appendChild(el('p', 'tile-num', String(x[0]))); d.appendChild(el('p', 'muted pequeno', x[1])); k.appendChild(d);
    });
    box.appendChild(k);

    // Retenção por semana, com as linhas do critério (15% e 40%).
    var r = el('div', 'teste-ret');
    r.appendChild(el('h3', 'sub', 'Ativos por semana (4 dias ou mais com registro)'));
    [1, 2, 3, 4].forEach(function (s) {
      var w = T.semanas[s], p = pct(w.ativos, w.completas);
      var linha = el('div', 'ret-linha');
      linha.appendChild(el('span', 'ret-rot', 'Semana ' + s));
      var trilho = el('div', 'ret-trilho');
      var barra = el('div', 'ret-barra'); barra.style.width = (p || 0) + '%'; trilho.appendChild(barra);
      var m15 = el('span', 'ret-marca'); m15.style.left = '15%'; m15.title = '15%: pivotar'; trilho.appendChild(m15);
      var m40 = el('span', 'ret-marca forte'); m40.style.left = '40%'; m40.title = '40%: seguir'; trilho.appendChild(m40);
      linha.appendChild(trilho);
      linha.appendChild(el('span', 'ret-val', w.completas ? p + '% (' + w.ativos + ' de ' + w.completas + ')' : 'em andamento'));
      r.appendChild(linha);
    });
    var w4 = T.semanas[4], p4 = pct(w4.ativos, w4.completas);
    var veredito = w4.completas === 0 ? ['Aguardando a semana 4', ''] : p4 >= 40 ? ['Semana 4: ' + p4 + '% · critério atingido (seguir)', 'bom'] : p4 < 15 ? ['Semana 4: ' + p4 + '% · abaixo de 15% (pivotar)', 'ruim'] : ['Semana 4: ' + p4 + '% · entre 15% e 40% (ajustar e repetir)', 'meio'];
    if (w4.completas > 0 && w4.completas < 8) veredito[0] += ' · amostra pequena (' + w4.completas + ' de pelo menos 8)';
    r.appendChild(el('p', 'veredito ' + veredito[1], veredito[0]));
    var wl = T.w4_lembrete, ws = T.w4_sem_lembrete;
    if (wl.completas + ws.completas > 0) {
      r.appendChild(el('p', 'muted pequeno', 'Semana 4 com lembrete: ' + (wl.completas ? pct(wl.ativos, wl.completas) + '% de ' + wl.completas : 'ninguém') +
        ' · sem lembrete: ' + (ws.completas ? pct(ws.ativos, ws.completas) + '% de ' + ws.completas : 'ninguém') + '.'));
    }
    box.appendChild(r);

    // Distribuição de dias com registro por semana completa.
    var dd = el('div', 'teste-dist');
    dd.appendChild(el('h3', 'sub', 'Dias com registro por semana (semanas completas)'));
    var max = Math.max.apply(null, T.dist.concat([1]));
    var cols = el('div', 'dist-cols');
    T.dist.forEach(function (v, i) {
      var c = el('div', 'dist-col');
      c.appendChild(el('span', 'dist-v', String(v)));
      var b = el('div', 'dist-b' + (i >= 4 ? ' ativa' : '')); b.style.height = Math.round(80 * v / max) + 'px'; c.appendChild(b);
      c.appendChild(el('span', 'dist-x', String(i)));
      cols.appendChild(c);
    });
    dd.appendChild(cols);
    dd.appendChild(el('p', 'muted pequeno', 'Verde escuro = semana ativa (4 a 7 dias).'));
    box.appendChild(dd);

    var cq = el('div', 'teste-cons');
    cq.appendChild(el('h3', 'sub', 'Depois da consulta'));
    var ul = el('ul');
    [['s-muito', 'Levou e ajudou muito'], ['s-um-pouco', 'Levou e ajudou um pouco'], ['s-nao', 'Levou, não fez diferença'], ['n', 'Não levou']].forEach(function (x) { ul.appendChild(el('li', null, x[1] + ': ' + T.consulta[x[0]])); });
    cq.appendChild(ul);
    box.appendChild(cq);

    turmas();
  }

  function turmas() {
    var box = limpa($('#teste-turmas'));
    if (!dados.turmas.length) box.appendChild(el('p', 'muted pequeno', 'Nenhuma turma ainda. Crie uma abaixo; o convite é o link com o código.'));
    dados.turmas.forEach(function (t) {
      var it = el('div', 'item');
      var topo = el('div', 'card-topo');
      topo.appendChild(el('strong', null, t.codigo + ' · ' + t.nome));
      var b = el('button', 'btn-txt', t.ativa ? 'Fechar para novos' : 'Reabrir'); b.type = 'button';
      b.addEventListener('click', function () { api('turma', { codigo: t.codigo, ativa: !t.ativa }).then(carrega); });
      topo.appendChild(b); it.appendChild(topo);
      var p = (dados.por_turma[t.codigo] || {}).participantes || 0;
      it.appendChild(el('p', 'muted pequeno', (t.ativa ? 'Aberta' : 'Fechada para novos') + ' · ' + p + ' participante(s) · link: ' + location.origin + '/teste/?c=' + t.codigo));
      box.appendChild(it);
    });
  }

  $('#f-turma').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $('#turma-msg');
    api('turma', { codigo: f.codigo.value, nome: f.nome.value }).then(function (j) {
      msg.textContent = j.ok ? 'Turma criada.' : (j.message || 'Não foi possível criar.');
      if (j.ok) { f.reset(); carrega(); }
    });
  });

  $('#btn-teste-csv').addEventListener('click', function () {
    if (!dados) return;
    var cab = ['turma', 'participante_anonimo', 'aceite', 'semana', 'inicio', 'fim', 'semana_completa', 'dias_com_registro', 'ativa', 'baixou_lembrete', 'gerou_resumo', 'saiu_em'];
    var linhas = [cab].concat(dados.linhas).map(function (l) { return l.map(function (v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); });
    var blob = new Blob(['﻿' + linhas.join('\r\n') + '\r\n# corte: ' + dados.gerado_em], { type: 'text/csv;charset=utf-8' });
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'teste-app-' + dados.gerado_em.slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
})();
