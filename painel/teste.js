// Painel · Teste do app (/teste/). Só contagens anônimas. Texto vindo do banco entra com textContent.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
  var dados = null, filtro = 'todas';
  function interna(c) { var t = dados.turmas.filter(function (x) { return x.codigo === c; })[0]; return t ? !!t.interna : false; }
  // Soma das turmas do filtro; "todas" deixa as internas de fora.
  function total(porTurma, f) {
    var T = vazio();
    Object.keys(porTurma || {}).forEach(function (c) { if (f === 'todas' ? !interna(c) : f === c) soma(T, porTurma[c]); });
    return T;
  }
  function reais(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }
  function dataBr(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); }
  function p100(a, b) { var p = pct(a, b); return p == null ? '–' : p + '%'; }

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
    return { participantes: 0, com_registro: 0, parados: 0, sairam: 0, resumo: 0, lembrete: 0, copia: 0, semanas: { 1: { completas: 0, ativos: 0 }, 2: { completas: 0, ativos: 0 }, 3: { completas: 0, ativos: 0 }, 4: { completas: 0, ativos: 0 } },
      dist: [0, 0, 0, 0, 0, 0, 0, 0], consulta: { 's-muito': 0, 's-um-pouco': 0, 's-nao': 0, n: 0 }, w4_lembrete: { completas: 0, ativos: 0 }, w4_sem_lembrete: { completas: 0, ativos: 0 } };
  }
  function soma(a, b) {
    ['participantes', 'com_registro', 'parados', 'sairam', 'resumo', 'lembrete', 'copia'].forEach(function (k) { a[k] += b[k] || 0; });
    [1, 2, 3, 4].forEach(function (k) { a.semanas[k].completas += b.semanas[k].completas; a.semanas[k].ativos += b.semanas[k].ativos; });
    b.dist.forEach(function (v, i) { a.dist[i] += v; });
    Object.keys(a.consulta).forEach(function (k) { a.consulta[k] += b.consulta[k] || 0; });
    ['w4_lembrete', 'w4_sem_lembrete'].forEach(function (g) { a[g].completas += b[g].completas; a[g].ativos += b[g].ativos; });
    return a;
  }

  function desenha() {
    var f = limpa($('#teste-filtro'));
    var opcoes = [['todas', 'Todas (sem internas)']].concat(dados.turmas.map(function (t) { return [t.codigo, t.codigo + (t.interna ? ' · interna' : '')]; }));
    opcoes.forEach(function (o) {
      var b = el('button', null, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(filtro === o[0]));
      b.addEventListener('click', function () { filtro = o[0]; desenha(); }); f.appendChild(b);
    });
    var T = total(dados.por_turma, filtro);
    var box = limpa($('#teste-conteudo'));

    box.appendChild(edital());

    var k = el('div', 'teste-kpis');
    [[T.participantes, 'aceitaram'], [T.com_registro, 'fizeram o 1º registro'], [T.parados, 'aceitaram há 3+ dias e nunca registraram'], [T.resumo, 'geraram resumo'],
     [T.lembrete, 'baixaram lembrete'], [T.copia, 'copiaram o código de levar'], [T.sairam, 'saíram']].forEach(function (x) {
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
    var C = T.consulta, nLevou = C['s-muito'] + C['s-um-pouco'] + C['s-nao'], nTot = nLevou + C.n;
    var ul = el('ul');
    [['s-muito', 'Levou e ajudou muito'], ['s-um-pouco', 'Levou e ajudou um pouco'], ['s-nao', 'Levou, não fez diferença'], ['n', 'Não levou']].forEach(function (x) {
      ul.appendChild(el('li', null, x[1] + ': ' + C[x[0]] + (nTot ? ' (' + p100(C[x[0]], nTot) + ')' : '')));
    });
    cq.appendChild(ul);
    var ajudou = C['s-muito'] + C['s-um-pouco'];
    cq.appendChild(el('p', 'muted pequeno', nLevou ? 'Ajudou: ' + ajudou + ' de ' + nLevou + ' que levaram (' + p100(ajudou, nLevou) + '), n = ' + nLevou + (nLevou < 5 ? ' · amostra pequena, não citar em porcentagem' : '') + '.' : 'Ninguém respondeu ainda (n = 0).'));
    box.appendChild(cq);

    box.appendChild(canais());

    turmas();
  }


  // Números citáveis: só turmas externas, com data de corte no dia 1º do mês.
  function frase(T, ate) {
    if (!T.participantes) return 'Até ' + ate + ': nenhuma pessoa no teste do app ainda.';
    var w4 = T.semanas[4], w1 = T.semanas[1], C = T.consulta, nLevou = C['s-muito'] + C['s-um-pouco'] + C['s-nao'];
    var t = 'Até ' + ate + ', ' + T.participantes + ' pessoa' + (T.participantes === 1 ? '' : 's') + ' entr' + (T.participantes === 1 ? 'ou' : 'aram') + ' no teste do app e ' + T.com_registro + ' ' + (T.com_registro === 1 ? 'fez' : 'fizeram') + ' ao menos 1 registro.';
    if (w1.completas) t += ' Semana 1: ' + p100(w1.ativos, w1.completas) + ' ativas (4+ dias com registro), n = ' + w1.completas + '.';
    t += w4.completas ? ' Semana 4: ' + p100(w4.ativos, w4.completas) + ' ativas, n = ' + w4.completas + '.' : ' Semana 4: ninguém completou ainda.';
    if (nLevou) t += ' Levaram o resumo à consulta: ' + nLevou + '; disseram que ajudou: ' + (C['s-muito'] + C['s-um-pouco']) + '.';
    return t;
  }
  function edital() {
    var c = el('div', 'teste-edital');
    var topo = el('div', 'card-topo');
    topo.appendChild(el('h3', 'sub', 'Números para o edital'));
    var b = el('button', 'btn-txt', 'Copiar texto'); b.type = 'button'; topo.appendChild(b);
    c.appendChild(topo);
    var corte = dataBr(dados.corte), fC = frase(total(dados.por_turma_corte, 'todas'), corte), fH = frase(total(dados.por_turma, 'todas'), dataBr(dados.gerado_em.slice(0, 10)));
    c.appendChild(el('p', 'edital-rot', 'Corte ' + corte + ' (citável)'));
    c.appendChild(el('p', 'edital-txt', fC));
    c.appendChild(el('p', 'edital-rot', 'Hoje (parcial, não citar)'));
    c.appendChild(el('p', 'muted', fH));
    var msg = el('p', 'pequeno muted'); msg.setAttribute('role', 'status'); c.appendChild(msg);
    c.appendChild(el('p', 'muted pequeno', 'Sem turmas internas. Corte = dia 1º do mês, nada a partir dele entra. Fonte: eventos anônimos do app, sem conteúdo de registro.'));
    b.addEventListener('click', function () {
      var txt = fC + ' Fonte: dados anônimos do teste aberto do app Draxora, corte em ' + corte + '.';
      var feito = function () { msg.textContent = 'Copiado.'; };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(feito, function () { msg.textContent = txt; });
      else msg.textContent = txt;
    });
    return c;
  }

  // Por canal: do aceite ao ativo, e quanto custou cada um (gasto digitado em "Turmas e convites").
  function canais() {
    var c = el('div', 'teste-canais');
    c.appendChild(el('h3', 'sub', 'Por canal (turma)'));
    var wrap = el('div', 'tabela-wrap'), tb = el('table', 'tabela');
    var th = el('tr');
    ['Turma', 'Aceitaram', '1º registro', 'Ativos sem. 1', 'Ativos sem. 4', 'Gasto', 'Custo por aceite', 'Custo por ativo sem. 1'].forEach(function (h, i) { th.appendChild(el('th', i ? 'num' : null, h)); });
    var thead = el('thead'); thead.appendChild(th); tb.appendChild(thead);
    var tbody = el('tbody'), soma1 = { gasto: 0, aceites: 0, ativos: 0 };
    dados.turmas.filter(function (t) { return !t.interna; }).forEach(function (t) {
      var x = dados.por_turma[t.codigo] || vazio(), w1 = x.semanas[1], w4 = x.semanas[4];
      var tr = el('tr');
      tr.appendChild(el('td', null, t.codigo));
      tr.appendChild(el('td', 'num', String(x.participantes)));
      tr.appendChild(el('td', 'num', x.com_registro + (x.participantes ? ' (' + p100(x.com_registro, x.participantes) + ')' : '')));
      tr.appendChild(el('td', 'num', w1.completas ? w1.ativos + ' de ' + w1.completas : '–'));
      tr.appendChild(el('td', 'num', w4.completas ? p100(w4.ativos, w4.completas) + ' de ' + w4.completas : '–'));
      tr.appendChild(el('td', 'num', t.gasto != null ? reais(t.gasto) : '–'));
      tr.appendChild(el('td', 'num', t.gasto != null && x.participantes ? reais(t.gasto / x.participantes) : '–'));
      tr.appendChild(el('td', 'num', t.gasto != null && w1.ativos ? reais(t.gasto / w1.ativos) : '–'));
      if (t.gasto != null) { soma1.gasto += t.gasto; soma1.aceites += x.participantes; soma1.ativos += w1.ativos; }
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb); c.appendChild(wrap);
    c.appendChild(el('p', 'muted pequeno', soma1.gasto ? 'Canais pagos: ' + reais(soma1.gasto) + ' para ' + soma1.aceites + ' aceite(s)' + (soma1.ativos ? ' e ' + soma1.ativos + ' ativo(s) na semana 1' : '') + '. Digite o gasto em "Turmas e convites" (total até hoje).' : 'Digite o gasto dos canais pagos em "Turmas e convites" para ver o custo por aceite e por ativo. "Ativos sem. 1" só conta quem já completou a semana.'));
    return c;
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
      var f = el('form', 'f-extra'); f.setAttribute('autocomplete', 'off');
      var li = el('label', 'chk'); var ck = el('input'); ck.type = 'checkbox'; ck.checked = !!t.interna; li.appendChild(ck); li.appendChild(document.createTextNode(' Interna (fora dos totais)'));
      var lg = el('label', null, 'Gasto até hoje (R$) '); var ig = el('input'); ig.inputMode = 'decimal'; ig.size = 8; ig.placeholder = '0,00'; ig.value = t.gasto != null ? t.gasto.toFixed(2).replace('.', ',') : ''; lg.appendChild(ig);
      var bs = el('button', 'btn-txt', 'Salvar'); bs.type = 'submit';
      var m = el('span', 'pequeno'); m.setAttribute('role', 'status');
      f.appendChild(li); f.appendChild(lg); f.appendChild(bs); f.appendChild(m);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        api('turma', { codigo: t.codigo, interna: ck.checked, gasto: ig.value }).then(function (j) { if (j.ok) carrega(); else m.textContent = j.message || 'Não foi possível salvar.'; });
      });
      it.appendChild(f);
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
    cab.push('turma_interna');
    var linhas = [cab].concat(dados.linhas.map(function (l) { return l.concat([interna(l[0]) ? 'sim' : 'nao']); })).map(function (l) { return l.map(function (v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); });
    var blob = new Blob(['﻿' + linhas.join('\r\n') + '\r\n# corte: ' + dados.gerado_em], { type: 'text/csv;charset=utf-8' });
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'teste-app-' + dados.gerado_em.slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
})();
