// Painel da Draxora — só leitura. Todo texto vindo do banco entra com textContent (nunca innerHTML).
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var st = { dias: 30, metrica: 'cadastros', emails: false, apresentacao: false, dados: null };

  var ROT = {
    usou: { 'quase-todo-dia': 'Quase todo dia', 'alguns-dias': 'Alguns dias', 'nao-usei': 'Ainda não usou' },
    consulta: { 'fui-levei': 'Foi e levou as folhas', 'fui-sem-levar': 'Foi, mas não levou', 'ainda-nao': 'Ainda não foi' },
    ajudou: { 'muito': 'Ajudou muito', 'um-pouco': 'Ajudou um pouco', 'nao': 'Não fez diferença', 'nao-se-aplica': 'Ainda não sabe' },
    semanas: { 'menos-1': 'Menos de 1 semana', '1': '1 semana', '2-3': '2 a 3 semanas', '4-mais': '4 semanas ou mais' },
    versao: { '1.1': 'Versão 1.1 (4 páginas)', '1.0': 'Versão 1.0 (25 páginas)', 'nao-lembro': 'Não lembra a versão' },
    diagnostico: { 'sim-acompanha': 'Tinha, e faz acompanhamento', 'sim-sem-acompanhar': 'Tinha, sem acompanhamento agora', 'em-investigacao': 'Em investigação', 'nao': 'Não, ia à primeira consulta', 'prefiro-nao-dizer': 'Prefere não dizer' },
    canal: { 'sim': 'Segue o canal', 'nao': 'Não segue', 'nao-sabia': 'Não sabia que existe' }
  };
  var PERGUNTAS = [['usou', 'Usou as folhas?'], ['semanas', 'Por quantas semanas?'], ['consulta', 'Foi à consulta?'], ['ajudou', 'O Mapa ajudou?'], ['versao', 'Qual versão?'], ['diagnostico', 'Já tinha diagnóstico?'], ['canal', 'Canal do WhatsApp']];
  var FONTES = { email: 'E-mail', instagram: 'Instagram', facebook: 'Facebook', google: 'Google', whatsapp: 'WhatsApp', guia: 'PDF do guia', amostra: 'PDF antigo (amostra)', link: 'Link /guia', baixar: 'Link de download', '(direto)': 'Direto ou sem origem' };
  var METRICAS = { cadastros: 'Cadastros do guia', baixou_guia: 'Baixaram o guia', baixou_folhas: 'Baixaram as folhas', relatos: 'Relatos na /conte/', interessados_app: 'Interessados no app' };

  function fonte(s) { return FONTES[s] || (s.charAt(0).toUpperCase() + s.slice(1)); }
  function origemDl(s) { var m = /^email[-_]?(\d+)/i.exec(s); return m ? 'E-mail ' + m[1] : (s === '(sem origem)' ? 'Sem origem no link' : s); }
  function n(v) { return (v || 0).toLocaleString('pt-BR'); }
  function dm(d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }
  function dmh(d) { return dm(d) + ' ' + d.slice(11, 16); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  // ===== API =====
  function api(acao, corpo) {
    return fetch('dados.php?acao=' + acao, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }

  function mostraEntrar(msg) {
    $('#app').hidden = true; $('#entrar').hidden = false;
    var e = $('#erro-entrar'); e.hidden = !msg; e.textContent = msg || '';
    $('#chave').value = ''; $('#chave').focus();
  }

  function carrega() {
    var c = $('#conteudo'); c.classList.add('carregando');
    return api('dados', { dias: st.dias, listas: !st.apresentacao, emails: st.emails }).then(function (d) {
      c.classList.remove('carregando');
      if (d._status === 401) { mostraEntrar(st.dados ? 'A sessão terminou. Entre de novo.' : ''); return; }
      if (!d.ok) { $('#gerado').textContent = 'Não foi possível carregar agora (' + (d.message || d._status) + ').'; return; }
      st.dados = d; $('#entrar').hidden = true; $('#app').hidden = false; desenha();
    }).catch(function () { c.classList.remove('carregando'); $('#gerado').textContent = 'Sem conexão. Tente de novo.'; });
  }

  // ===== Desenho =====
  function desenha() {
    var d = st.dados;
    var nomes = { 7: 'últimos 7 dias', 30: 'últimos 30 dias', 90: 'últimos 90 dias', 0: 'desde o início' };
    $('#periodo-txt').textContent = dm(d.periodo.de) + ' a ' + dm(d.periodo.ate) + ' · ' + nomes[d.periodo.dias];
    $('#gerado').textContent = 'Atualizado em ' + dmh(d.gerado_em) + ' (Brasília). Só leitura: nada aqui altera os dados.';
    Object.keys(d.kpis).forEach(function (k) {
      var alvo = $('#k-' + k); if (!alvo) return;
      alvo.textContent = n(d.kpis[k]);
      var dd = $('#d-' + k); limpa(dd);
      if (d.anterior) {
        var dif = d.kpis[k] - d.anterior[k];
        var b = el('b', null, dif > 0 ? '▲ ' + n(dif) : dif < 0 ? '▼ ' + n(-dif) : '=');
        dd.appendChild(b); dd.appendChild(document.createTextNode(' vs ' + d.periodo.dias + ' dias antes'));
      }
    });
    funil(d); grafico(); tabelaDia(d);
    var fontes = Object.keys(d.fontes).map(function (k) { return { rot: fonte(k), n: d.fontes[k] }; });
    barras($('#fontes'), fontes, { pct: true });
    $('#h-anuncios').hidden = !d.anuncios.length;
    barras($('#anuncios'), d.anuncios.map(function (a) { return { rot: a.anuncio, sub: fonte(a.fonte), n: a.n }; }), {});
    duplas(d.downloads_origem);
    distribuicoes(d.relatos_resumo);
    if (!st.apresentacao) { listaRelatos(d.relatos || []); listaApp(d.interessados || []); }
  }

  function funil(d) {
    var k = d.kpis, etapas = [['Cadastraram', k.cadastros], ['Baixaram o guia', k.baixou_guia], ['Baixaram as folhas', k.baixou_folhas], ['Contaram como foi', k.relatos]];
    var max = Math.max.apply(null, etapas.map(function (e) { return e[1]; }).concat([1]));
    var box = limpa($('#funil'));
    etapas.forEach(function (e, i) {
      var linha = el('div', 'hb');
      var rot = el('div', 'hb-rot'); rot.appendChild(el('span', null, e[0])); linha.appendChild(rot);
      var lb = el('div', 'hb-linha');
      var barra = el('div', 'hb-barra' + (e[1] ? '' : ' zero'));
      barra.style.width = (e[1] / max * 78) + '%'; barra.style.background = e[1] ? 'var(--f' + (i + 1) + ')' : '';
      lb.appendChild(barra);
      var v = el('span', 'hb-val', n(e[1]));
      if (i > 0 && k.cadastros) v.appendChild(el('small', null, ' · ' + Math.round(e[1] / k.cadastros * 100) + '%'));
      lb.appendChild(v); linha.appendChild(lb); box.appendChild(linha);
    });
  }

  function barras(box, itens, op) {
    limpa(box);
    if (!itens.length) { box.appendChild(el('p', 'vazio', 'Nada no período.')); return; }
    var tot = itens.reduce(function (a, b) { return a + b.n; }, 0);
    var max = Math.max.apply(null, itens.map(function (i) { return i.n; }).concat([1]));
    itens.forEach(function (it) {
      var linha = el('div', 'hb');
      var rot = el('div', 'hb-rot'); rot.appendChild(el('span', null, it.rot)); if (it.sub) rot.appendChild(el('small', null, it.sub));
      linha.appendChild(rot);
      var lb = el('div', 'hb-linha');
      var barra = el('div', 'hb-barra' + (it.n ? '' : ' zero')); barra.style.width = (it.n / max * 74) + '%';
      lb.appendChild(barra);
      var v = el('span', 'hb-val', n(it.n));
      if (op.pct && tot) v.appendChild(el('small', null, ' · ' + Math.round(it.n / tot * 100) + '%'));
      lb.appendChild(v); linha.appendChild(lb); box.appendChild(linha);
    });
  }

  function duplas(lista) {
    var box = limpa($('#downloads'));
    if (!lista.length) { box.appendChild(el('p', 'vazio', 'Nenhum download no período.')); return; }
    var max = Math.max.apply(null, lista.map(function (o) { return Math.max(o.guia, o.folhas); }).concat([1]));
    lista.forEach(function (o) {
      var linha = el('div', 'hb');
      var rot = el('div', 'hb-rot'); rot.appendChild(el('span', null, origemDl(o.origem))); linha.appendChild(rot);
      var col = el('div');
      [['guia', ''], ['folhas', ' s2']].forEach(function (a) {
        var lb = el('div', 'hb-linha');
        var barra = el('div', 'hb-barra' + a[1] + (o[a[0]] ? '' : ' zero')); barra.style.width = (o[a[0]] / max * 70) + '%';
        lb.appendChild(barra);
        var v = el('span', 'hb-val', n(o[a[0]])); v.appendChild(el('small', null, ' ' + a[0]));
        lb.appendChild(v); col.appendChild(lb);
      });
      linha.appendChild(col); box.appendChild(linha);
    });
  }

  function distribuicoes(r) {
    var box = limpa($('#relatos-resumo'));
    PERGUNTAS.forEach(function (p) {
      var dados = r[p[0]] || {};
      var ordem = Object.keys(ROT[p[0]]).concat(['(sem resposta)']);
      var itens = ordem.filter(function (k) { return dados[k]; }).map(function (k) { return { rot: ROT[p[0]][k] || 'Sem resposta', n: dados[k] }; });
      var bloco = el('div', 'dist'); bloco.appendChild(el('h3', null, p[1]));
      var b = el('div', 'hbars'); bloco.appendChild(b); barras(b, itens, { pct: true });
      box.appendChild(bloco);
    });
  }

  function listaRelatos(lista) {
    var box = limpa($('#lista-relatos'));
    if (!lista.length) { box.appendChild(el('p', 'vazio', 'Nenhum relato no período.')); return; }
    lista.forEach(function (r) {
      var it = el('article', 'item');
      var topo = el('div', 'item-topo'); topo.appendChild(el('span', null, dmh(r.em) + ' · ' + fonte(r.fonte)));
      topo.appendChild(el('span', null, r.email || 'sem e-mail')); it.appendChild(topo);
      var chips = el('div', 'chips');
      ['usou', 'semanas', 'consulta', 'ajudou', 'versao', 'diagnostico', 'canal'].forEach(function (k) { if (r[k] && ROT[k][r[k]]) chips.appendChild(el('span', 'chip', ROT[k][r[k]])); });
      it.appendChild(chips);
      if (r.texto) it.appendChild(el('p', 'item-texto', r.texto));
      box.appendChild(it);
    });
  }

  function listaApp(lista) {
    var box = limpa($('#lista-app'));
    if (!lista.length) { box.appendChild(el('p', 'vazio', 'Ninguém novo no período.')); return; }
    lista.forEach(function (p) {
      var l = el('div', 'linha-app'); l.appendChild(el('span', null, p.email)); l.appendChild(el('span', null, dmh(p.em) + ' · ' + fonte(p.fonte)));
      box.appendChild(l);
    });
  }

  function tabelaDia(d) {
    var box = limpa($('#tabela-dia'));
    var w = el('div', 'tabela-wrap'), t = el('table'), th = el('thead'), tr = el('tr');
    tr.appendChild(el('th', null, 'Dia'));
    Object.keys(METRICAS).forEach(function (k) { tr.appendChild(el('th', 'n', METRICAS[k])); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    d.por_dia.slice().reverse().forEach(function (r) {
      var l = el('tr'); l.appendChild(el('td', null, dm(r.d)));
      Object.keys(METRICAS).forEach(function (k) { l.appendChild(el('td', 'n', n(r[k]))); });
      tb.appendChild(l);
    });
    t.appendChild(tb); w.appendChild(t); box.appendChild(w);
  }

  // ===== Gráfico por dia (colunas, uma série) =====
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function passoBom(max) {
    if (max <= 4) return 1;
    var bruto = max / 4, p = Math.pow(10, Math.floor(Math.log10(bruto))), r = bruto / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  }
  var ativo = -1;
  function grafico() {
    var box = limpa($('#grafico-dia')), dados = st.dados.por_dia, m = st.metrica;
    var W = Math.max(280, box.clientWidth), H = W < 600 ? 190 : (st.apresentacao ? 300 : 240);
    var mE = 34, mD = 8, mT = 22, mB = 26, pw = W - mE - mD, ph = H - mT - mB;
    var vals = dados.map(function (r) { return r[m]; }), max = Math.max.apply(null, vals.concat([0]));
    var passo = passoBom(max), topo = Math.max(passo, Math.ceil(max / passo) * passo);
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, tabindex: '0', role: 'img' });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    svg.setAttribute('aria-label', METRICAS[m] + ' por dia: total ' + total + ', máximo ' + max + ' em um dia. Use as setas para ver cada dia. A tabela abaixo tem todos os valores.');
    var grade = sv('g', { 'class': 'grade' }), eixo = sv('g', { 'class': 'eixo' });
    for (var v = 0; v <= topo; v += passo) {
      var y = mT + ph - v / topo * ph;
      grade.appendChild(sv('line', { x1: mE, x2: W - mD, y1: y, y2: y }));
      var t = sv('text', { x: mE - 8, y: y + 4, 'text-anchor': 'end' }); t.textContent = n(v); eixo.appendChild(t);
    }
    svg.appendChild(grade);
    var slot = pw / dados.length, bw = Math.max(1, Math.min(24, slot - 2)), barras = sv('g');
    dados.forEach(function (r, i) {
      var h = r[m] / topo * ph, x = mE + i * slot + (slot - bw) / 2, yb = mT + ph;
      if (h <= 0) return;
      var rr = Math.min(4, bw / 2, h);
      var d = 'M' + x + ',' + yb + 'V' + (yb - h + rr) + 'Q' + x + ',' + (yb - h) + ' ' + (x + rr) + ',' + (yb - h) + 'H' + (x + bw - rr) + 'Q' + (x + bw) + ',' + (yb - h) + ' ' + (x + bw) + ',' + (yb - h + rr) + 'V' + yb + 'Z';
      barras.appendChild(sv('path', { d: d, 'class': 'barra', 'data-i': i }));
    });
    svg.appendChild(barras);
    // Rótulo direto só no maior dia
    if (max > 0) {
      var im = vals.lastIndexOf(max), xm = mE + im * slot + slot / 2;
      var tl = sv('text', { x: Math.min(Math.max(xm, mE + 10), W - mD - 10), y: mT + ph - max / topo * ph - 6, 'text-anchor': 'middle', 'class': 'rot' });
      tl.textContent = n(max); svg.appendChild(tl);
    }
    // Datas: primeira, meio e última
    [0, Math.floor((dados.length - 1) / 2), dados.length - 1].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i, j, a) {
      var tx = sv('text', { x: mE + i * slot + slot / 2, y: H - 6, 'text-anchor': j === 0 && a.length > 1 ? 'start' : j === a.length - 1 && a.length > 1 ? 'end' : 'middle' });
      if (j === 0 && a.length > 1) tx.setAttribute('x', mE); if (j === a.length - 1 && a.length > 1) tx.setAttribute('x', W - mD);
      tx.textContent = dm(dados[i].d); eixo.appendChild(tx);
    });
    svg.appendChild(eixo);
    if (!total) { var vz = sv('text', { x: mE + pw / 2, y: mT + ph / 2, 'text-anchor': 'middle', 'class': 'rot' }); vz.textContent = 'Nada no período'; svg.appendChild(vz); }
    box.appendChild(svg);

    function mostra(i, cx, cy) {
      ativo = i;
      barras.querySelectorAll('.barra').forEach(function (b) { b.classList.toggle('ativa', +b.getAttribute('data-i') === i); });
      var tip = $('#tooltip'); limpa(tip);
      tip.appendChild(el('b', null, n(dados[i][m]))); tip.appendChild(document.createTextNode(METRICAS[m] + ' · ' + dm(dados[i].d)));
      tip.hidden = false;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, cx - tw / 2)) + 'px';
      tip.style.top = Math.max(8, cy - th - 12) + 'px';
    }
    function esconde() { ativo = -1; $('#tooltip').hidden = true; barras.querySelectorAll('.barra').forEach(function (b) { b.classList.remove('ativa'); }); }
    function porX(clientX) { var r = svg.getBoundingClientRect(), x = (clientX - r.left) * W / r.width; return Math.max(0, Math.min(dados.length - 1, Math.floor((x - mE) / slot))); }
    function pos(i) { var r = svg.getBoundingClientRect(), k = r.width / W; return [r.left + (mE + i * slot + slot / 2) * k, r.top + (mT + ph - dados[i][m] / topo * ph) * k]; }
    svg.addEventListener('pointermove', function (e) { var i = porX(e.clientX), p = pos(i); mostra(i, p[0], Math.min(p[1], e.clientY)); });
    svg.addEventListener('pointerleave', esconde);
    svg.addEventListener('blur', esconde);
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      var i = ativo < 0 ? dados.length - 1 : ativo;
      i = e.key === 'Home' ? 0 : e.key === 'End' ? dados.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1);
      i = Math.max(0, Math.min(dados.length - 1, i)); var p = pos(i); mostra(i, p[0], p[1]);
    });
  }

  // ===== Controles =====
  function seg(sel, attr, fn) {
    $(sel).addEventListener('click', function (e) {
      var b = e.target.closest('button[' + attr + ']'); if (!b) return;
      this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fn(b.getAttribute(attr));
    });
  }
  seg('#periodo', 'data-dias', function (v) { st.dias = +v; carrega(); });
  seg('#metrica', 'data-m', function (v) { st.metrica = v; grafico(); });

  $('#btn-emails').addEventListener('click', function () {
    st.emails = !st.emails; this.setAttribute('aria-pressed', String(st.emails));
    this.textContent = st.emails ? 'Esconder e-mails' : 'Mostrar e-mails'; carrega();
  });
  $('#btn-apresentar').addEventListener('click', function () {
    st.apresentacao = !st.apresentacao; st.emails = false;
    var be = $('#btn-emails'); be.setAttribute('aria-pressed', 'false'); be.textContent = 'Mostrar e-mails';
    document.body.classList.toggle('apresentacao', st.apresentacao);
    this.setAttribute('aria-pressed', String(st.apresentacao));
    this.textContent = st.apresentacao ? 'Sair da apresentação' : 'Modo apresentação';
    try {
      if (st.apresentacao && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      else if (!st.apresentacao && document.fullscreenElement) document.exitFullscreen();
    } catch (e) {}
    carrega();
  });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && st.apresentacao) $('#btn-apresentar').click();
  });
  $('#btn-sair').addEventListener('click', function () { api('sair').then(function () { st.dados = null; mostraEntrar(''); }); });

  $('#form-entrar').addEventListener('submit', function (e) {
    e.preventDefault();
    var bt = this.querySelector('button'); bt.disabled = true;
    api('entrar', { chave: $('#chave').value }).then(function (r) {
      bt.disabled = false; $('#chave').value = '';
      if (r.ok) { $('#erro-entrar').hidden = true; carrega().then(function () { $('#painel').focus(); }); }
      else mostraEntrar(r.message || 'Não deu para entrar.');
    }).catch(function () { bt.disabled = false; mostraEntrar('Sem conexão. Tente de novo.'); });
  });

  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (st.dados) grafico(); }, 150); });
  carrega();
})();
