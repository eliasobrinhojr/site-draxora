// Teste do fluxo completo do site num navegador de verdade (Chromium).
//
//   node .github/testes/fluxo.js <BASE> <modo>
//
//   modo "local"   — site servido por `php -S` com banco SQLite de teste: os formulários enviam DE VERDADE
//                    e o teste confere a resposta do servidor e o painel. Roda a cada push (revisao.yml).
//   modo "ao-vivo" — https://draxora.com.br: os envios dos formulários são INTERCEPTADOS no navegador
//                    (nenhum cadastro, relato ou download falso entra no banco nem no Brevo). Confere a página,
//                    o JavaScript, o que o formulário mandaria, o banco (status.php) e os links de download.
//                    Roda de hora em hora e depois de cada publicação (monitor.yml).
//
// Nasceu do erro de 04/11 (12h58–22h04): um ReferenceError no clique de "Quero o guia" impedia o envio,
// sem nenhuma mensagem na tela, e a revisão de sintaxe não pegava.
'use strict';
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/$/, '');
const MODO = process.argv[3] || 'local';
const AO_VIVO = MODO === 'ao-vivo';
const CHAVE_TESTE = process.env.DX_CHAVE_TESTE || '';
const UA_ROBO = 'Mozilla/5.0 (X11; Linux x86_64) DraxoraMonitor/1.0 headless bot';

const falhas = [];
const ok = (nome) => console.log('  ✓ ' + nome);
const falha = (nome, det) => { falhas.push(nome); console.log('  ✗ ' + nome + (det ? '\n      ' + String(det).slice(0, 400) : '')); };
async function etapa(nome, fn) { try { const r = await fn(); if (r === false) falha(nome); else ok(nome + (typeof r === 'string' ? ' — ' + r : '')); } catch (e) { falha(nome, e && e.message || e); } }

(async () => {
  console.log(`Fluxo do site · ${BASE} · modo ${MODO}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  // Meta e Google nunca são chamados de verdade no teste (não sujam os números dos anúncios).
  await ctx.route(/(facebook\.(com|net)|google(tagmanager|adservices)?\.com|doubleclick\.net|google-analytics\.com)/, r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  // Envios interceptados no modo ao vivo: guardamos o que o formulário mandaria e respondemos como o servidor.
  const enviados = [];
  if (AO_VIVO) {
    await ctx.route(/\/api\/(inscrever|feedback)\.php/, async r => {
      const req = r.request();
      enviados.push({ url: req.url(), corpo: req.postData() || '' });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  }

  async function abre(caminho) {
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push('JS: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && /ReferenceError|TypeError|SyntaxError/.test(m.text())) erros.push('console: ' + m.text()); });
    const resp = await page.goto(BASE + caminho, { waitUntil: 'load' });
    return { page, erros, status: resp ? resp.status() : 0 };
  }

  // 1. Páginas abrem sem erro de JavaScript (inclusive com cookies aceitos)
  console.log('\n1. Páginas');
  const paginas = ['/', '/mapa-dos-sintomas/', '/sobre/', '/guias/', '/guias/primeira-consulta-psiquiatra/', '/conte/', '/privacidade/', '/termos/', '/404.html'];
  for (const p of paginas) {
    await etapa(`${p} abre sem erro`, async () => {
      const { page, erros, status } = await abre(p);
      await page.waitForTimeout(600);
      const barra = page.locator('.dx-consent [data-consent="yes"]');
      if (await barra.count()) { await barra.click(); await page.waitForTimeout(300); }
      await page.close();
      if (status >= 400) throw new Error('HTTP ' + status);
      if (erros.length) throw new Error(erros.join(' | '));
    });
  }
  await etapa('/app/ leva à lista do app', async () => {
    const { page, erros } = await abre('/app/');
    await page.waitForURL(/mapa-dos-sintomas\/.*#app/, { timeout: 8000 });
    await page.close();
    if (erros.length) throw new Error(erros.join(' | '));
  });

  // 2. Formulários (o clique de verdade, como uma pessoa faria)
  console.log('\n2. Formulários');
  const carimbo = Date.now();
  async function testaLead(caminho, seletorForm, lista, textoSucesso) {
    const { page, erros } = await abre(caminho);
    const form = page.locator(seletorForm).first();
    await form.scrollIntoViewIfNeeded();
    const email = `teste-ci+${lista}-${carimbo}@exemplo.com`;
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[name="consentimento"]').check();
    await page.waitForTimeout(2600); // o servidor ignora envios com menos de 2 s na página (anti-robô)
    const antes = enviados.length;
    await form.locator('button[type="submit"]').click();
    await page.locator(seletorForm + '.is-done').first().waitFor({ timeout: 8000 }).catch(() => {});
    const feito = await form.evaluate(f => f.classList.contains('is-done'));
    const texto = await form.locator('.dx-lead-ok').innerText().catch(() => '');
    const erroTela = await form.locator('[data-lead-error]').innerText().catch(() => '');
    await page.close();
    if (erros.length) throw new Error(erros.join(' | '));
    if (AO_VIVO) {
      const env = enviados[antes];
      if (!env) throw new Error('o clique não enviou nada');
      for (const campo of ['email', 'lista', 'consentimento', 'dx_t', 'origem']) {
        if (!env.corpo.includes('name="' + campo + '"')) throw new Error('envio sem o campo ' + campo);
      }
      if (!env.corpo.includes(lista) || !env.corpo.includes(email)) throw new Error('envio com lista ou e-mail errado');
    }
    if (!feito || !texto.includes(textoSucesso)) throw new Error('sem confirmação na tela' + (erroTela ? ': ' + erroTela : ''));
    return email;
  }
  await etapa('Cadastro do guia (página do Mapa, #amostra)', () => testaLead('/mapa-dos-sintomas/?utm_source=teste-ci#amostra', 'form.dx-lead[data-lead="amostra"]', 'amostra', 'Enviamos o guia'));
  await etapa('Lista do app (página do Mapa, #app)', () => testaLead('/mapa-dos-sintomas/#app', '#app form.dx-lead', 'mapa-dos-sintomas', 'Cadastramos'));
  await etapa('Lista do app (home)', () => testaLead('/', 'form.dx-lead', 'mapa-dos-sintomas', ''));
  await etapa('Relato na /conte/', async () => {
    const { page, erros } = await abre('/conte/?de=teste-ci');
    const form = page.locator('form.dx-feedback');
    for (const [nome, valor] of [['usou', 'alguns-dias'], ['consulta', 'ainda-nao'], ['ajudou', 'nao-se-aplica']]) {
      await form.locator(`input[name="${nome}"][value="${valor}"]`).check({ force: true });
    }
    await form.locator('textarea[name="texto"]').fill('Teste automático (CI), pode apagar.');
    await form.locator('input[name="consentimento"]').check({ force: true });
    await page.waitForTimeout(2600);
    await form.locator('button[type="submit"]').click();
    await page.locator('.dx-fb-ok:not([hidden])').waitFor({ timeout: 8000 }).catch(() => {});
    const visivel = await page.locator('.dx-fb-ok').isVisible();
    const erroTela = await form.locator('[data-fb-error]').innerText().catch(() => '');
    await page.close();
    if (erros.length) throw new Error(erros.join(' | '));
    if (!visivel) throw new Error('sem confirmação na tela' + (erroTela ? ': ' + erroTela : ''));
  });

  // 3. Servidor, banco e downloads
  console.log('\n3. Servidor e downloads');
  const api = await (await browser.newContext({ userAgent: UA_ROBO, extraHTTPHeaders: { Origin: BASE.replace(/\/$/, '') } })).request;
  await etapa('Banco de dados respondendo (status.php)', async () => {
    const r = await api.get(BASE + '/api/status.php');
    const j = await r.json();
    if (!j.ok) throw new Error(JSON.stringify(j));
  });
  await etapa('Cadastro recusa envio sem autorização (validação do servidor)', async () => {
    const r = await api.post(BASE + '/api/inscrever.php', { form: { email: 'teste-ci@exemplo.com', lista: 'amostra', site: '', dx_t: '9' } });
    const j = await r.json().catch(() => ({}));
    if (r.status() !== 422 || j.error !== 'consentimento') throw new Error('HTTP ' + r.status() + ' ' + JSON.stringify(j));
  });
  for (const f of ['guia', 'folhas']) {
    await etapa(`Download /baixar/${f} entrega um PDF`, async () => {
      const url = AO_VIVO ? `${BASE}/baixar/${f}?de=teste-ci` : `${BASE}/api/baixar.php?f=${f}&de=teste-ci`;
      const r = await api.get(url, { maxRedirects: 0 });
      const destino = r.headers()['location'];
      if (r.status() !== 302 || !destino) throw new Error('HTTP ' + r.status() + ' sem redirecionamento');
      const pdf = await api.head(new URL(destino, BASE + '/').toString());
      const tipo = pdf.headers()['content-type'] || '';
      if (pdf.status() !== 200 || !/pdf/.test(tipo)) throw new Error(`PDF ${destino}: HTTP ${pdf.status()} ${tipo}`);
      return destino.replace(/^https?:\/\/[^/]+/, '') + ' · ' + Math.round((+pdf.headers()['content-length'] || 0) / 1024) + ' KB';
    });
  }
  await etapa('Painel protegido (sem login = 401)', async () => {
    const r = await api.post(BASE + '/painel/dados.php?acao=dados', { data: {} });
    if (r.status() !== 401) throw new Error('HTTP ' + r.status());
  });

  // 4. Só no teste local: o que foi enviado chegou ao banco e aparece no painel
  if (!AO_VIVO && CHAVE_TESTE) {
    console.log('\n4. Painel com os dados do teste');
    await etapa('Painel mostra o cadastro e o relato do teste', async () => {
      const { page, erros } = await abre('/painel/');
      await page.locator('#chave').fill(CHAVE_TESTE);
      await page.locator('#form-entrar button').click();
      await page.locator('#app:not([hidden])').waitFor({ timeout: 8000 });
      await page.waitForTimeout(500);
      const cad = await page.locator('#k-cadastros').innerText();
      const rel = await page.locator('#k-relatos').innerText();
      await page.close();
      if (erros.filter(e => !/401/.test(e)).length) throw new Error(erros.join(' | '));
      if (+cad < 1 || +rel < 1) throw new Error(`cadastros=${cad} relatos=${rel}`);
      return `cadastros=${cad}, relatos=${rel}`;
    });
  }

  await browser.close();
  console.log(falhas.length ? `\n${falhas.length} falha(s): ${falhas.join('; ')}` : '\nTudo certo.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
