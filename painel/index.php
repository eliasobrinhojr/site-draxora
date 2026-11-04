<?php
// Painel da Draxora (só leitura). Fora do Google, sem Pixel, sem cache.
// Proteção recomendada: hPanel → Avançado → Proteger diretórios → /public_html/painel (usuário e senha).
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
$v = '202611041950';
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#294F46">
  <title>Painel · Draxora</title>
  <link rel="icon" href="/assets/img/draxora-simbolo-claro.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="painel.css?v=<?= $v ?>">
  <script src="painel.js?v=<?= $v ?>" defer></script>
  <script src="teste.js?v=<?= $v ?>" defer></script>
</head>
<body>
<a class="skip" href="#painel">Pular para o conteúdo</a>

<!-- Entrada -->
<main class="entrar" id="entrar" hidden>
  <form class="entrar-box" id="form-entrar" autocomplete="off">
    <img src="/assets/img/v5/draxora-v5.svg" alt="Draxora" width="150" height="24">
    <h1>Painel</h1>
    <p class="muted">Área restrita. Os dados são só para leitura.</p>
    <label for="chave">Chave do painel</label>
    <input id="chave" name="chave" type="password" required minlength="16" autocomplete="current-password">
    <p class="erro" id="erro-entrar" role="alert" hidden></p>
    <button class="btn" type="submit">Entrar</button>
  </form>
</main>

<!-- Painel -->
<div class="app" id="app" hidden>
  <header class="topo">
    <div class="topo-marca">
      <img class="logo" src="/assets/img/v5/draxora-v5.svg" alt="Draxora" width="120" height="19">
      <span class="topo-titulo">Painel</span>
    </div>
    <div class="topo-acoes">
      <button class="btn-txt" type="button" id="btn-apresentar" aria-pressed="false">Modo apresentação</button>
      <button class="btn-txt" type="button" id="btn-sair">Sair</button>
    </div>
  </header>

  <main id="painel" tabindex="-1">
    <div class="filtros" role="group" aria-label="Período">
      <div class="seg" id="periodo">
        <button type="button" data-dias="7">7 dias</button>
        <button type="button" data-dias="30" aria-pressed="true">30 dias</button>
        <button type="button" data-dias="90">90 dias</button>
        <button type="button" data-dias="0">Tudo</button>
      </div>
      <p class="muted pequeno" id="periodo-txt" aria-live="polite"></p>
    </div>

    <div id="conteudo" class="conteudo">
      <section class="destaque" aria-labelledby="h-destaque">
        <h2 id="h-destaque" class="sr">Resumo do período</h2>
        <div class="hero card">
          <p class="rotulo">Cadastros do guia</p>
          <p class="hero-num" id="k-cadastros">–</p>
          <p class="delta" id="d-cadastros"></p>
        </div>
        <div class="tiles">
          <div class="card tile"><p class="rotulo">Baixaram o guia</p><p class="tile-num" id="k-baixou_guia">–</p><p class="delta" id="d-baixou_guia"></p></div>
          <div class="card tile"><p class="rotulo">Baixaram as folhas</p><p class="tile-num" id="k-baixou_folhas">–</p><p class="delta" id="d-baixou_folhas"></p></div>
          <div class="card tile"><p class="rotulo">Contaram como foi</p><p class="tile-num" id="k-relatos">–</p><p class="delta" id="d-relatos"></p></div>
          <div class="card tile"><p class="rotulo">Interessados no app</p><p class="tile-num" id="k-interessados_app">–</p><p class="delta" id="d-interessados_app"></p></div>
        </div>
      </section>

      <section class="card" aria-labelledby="h-funil">
        <h2 id="h-funil">Caminho no período</h2>
        <p class="muted pequeno">Pessoas em cada etapa dentro do período. Downloads contam pessoas únicas pelos links dos e-mails.</p>
        <div class="hbars funil" id="funil"></div>
      </section>

      <section class="card" aria-labelledby="h-dia">
        <div class="card-topo">
          <h2 id="h-dia">Por dia</h2>
          <div class="seg seg-pequeno" id="metrica" role="group" aria-label="O que mostrar por dia">
            <button type="button" data-m="cadastros" aria-pressed="true">Cadastros</button>
            <button type="button" data-m="baixou_guia">Guia</button>
            <button type="button" data-m="baixou_folhas">Folhas</button>
            <button type="button" data-m="relatos">Relatos</button>
            <button type="button" data-m="interessados_app">App</button>
          </div>
        </div>
        <div class="grafico" id="grafico-dia"></div>
        <details class="tabela-view"><summary>Ver tabela</summary><div id="tabela-dia"></div></details>
      </section>

      <div class="duas">
        <section class="card" aria-labelledby="h-fontes">
          <h2 id="h-fontes">De onde vieram os cadastros</h2>
          <div class="hbars" id="fontes"></div>
          <h3 class="sub" id="h-anuncios" hidden>Anúncios que mais trouxeram cadastros</h3>
          <div class="hbars" id="anuncios"></div>
        </section>

        <section class="card" aria-labelledby="h-dl">
          <h2 id="h-dl">Downloads por link de e-mail</h2>
          <div class="legenda" aria-hidden="true"><span><i class="sw s1"></i>Guia</span><span><i class="sw s2"></i>Folhas</span></div>
          <div class="hbars duplas" id="downloads"></div>
        </section>
      </div>

      <section class="card" aria-labelledby="h-relatos">
        <h2 id="h-relatos">O que contaram na /conte/</h2>
        <div class="dist-grid" id="relatos-resumo"></div>
      </section>

      <section class="card pii" aria-labelledby="h-lista-relatos">
        <div class="card-topo">
          <h2 id="h-lista-relatos">Relatos</h2>
          <button class="btn-txt" type="button" id="btn-emails" aria-pressed="false">Mostrar e-mails</button>
        </div>
        <div id="lista-relatos" class="lista"></div>
      </section>

      <section class="card pii" aria-labelledby="h-lista-app">
        <h2 id="h-lista-app">Interessados no app</h2>
        <div id="lista-app" class="lista"></div>
      </section>

      <section class="card" aria-labelledby="h-teste" id="teste" hidden>
        <div class="card-topo">
          <h2 id="h-teste">Teste do app (/teste/)</h2>
          <button class="btn-txt" type="button" id="btn-teste-csv">Baixar planilha</button>
        </div>
        <p class="muted pequeno">Só contagens anônimas: nenhum registro de sono, humor ou remédio sai do celular. Semana ativa = 4 dias ou mais com registro, contando do dia do aceite. Critério do plano na semana 4: 40% ou mais ativos, seguir; menos de 15%, pivotar.</p>
        <div class="seg seg-pequeno" id="teste-filtro" role="group" aria-label="Turma"></div>
        <div id="teste-conteudo" class="teste-grid"></div>
        <details class="teste-turmas">
          <summary>Turmas e convites</summary>
          <div id="teste-turmas" class="lista"></div>
          <form id="f-turma" class="f-turma" autocomplete="off">
            <label>Código <input name="codigo" required pattern="[A-Za-z0-9-]{4,20}" placeholder="ONDA1-TATI"></label>
            <label>Nome <input name="nome" required maxlength="60" placeholder="Onda 1 · pacientes da Tatiane"></label>
            <button class="btn-txt" type="submit">Criar turma</button>
            <p class="pequeno" id="turma-msg" role="status"></p>
          </form>
        </details>
      </section>

      <p class="muted pequeno rodape" id="gerado"></p>
    </div>
  </main>
</div>
<div class="tooltip" id="tooltip" role="status" hidden></div>
</body>
</html>
