# Draxora — site

Site da Draxora: a home da marca (o "corredor de portas") e a página de vendas do Lançamento 01 — Saúde Mental.

Site estático, sem build: HTML, CSS e JavaScript puros. Abra `index.html` no navegador para ver.

## Estrutura

```
index.html                 Home da Draxora (portas / método / criador)
saude-mental/index.html    Página de vendas do Método Porta Aberta
assets/css/draxora.css     Tokens e componentes do design system Draxora
assets/js/main.js          Header, animações de entrada e formulários
assets/img/                Logomarca (assinatura, símbolo, ícone, wordmark, selo de nicho)
```

## Publicar

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / `root`.
**Vercel ou Netlify:** importe o repositório; não há comando de build e a pasta de saída é a raiz.

## Antes de lançar — o que substituir

Os trechos marcados em amarelo na página (`[...]`, classe `placeholder-note`) são lembretes; remova-os depois de ajustar.

- [ ] Nome do produto ("Método Porta Aberta" é provisório), módulos e quantidade de aulas.
- [ ] Preço e parcelamento na seção `#oferta`.
- [ ] Link de checkout: botão com `data-checkout` em `saude-mental/index.html` (Hotmart, Kiwify, Eduzz…).
- [ ] Formulários de e-mail: coloque a URL da sua ferramenta no atributo `data-endpoint` de cada `<form class="dx-lead">`.
- [ ] Foto e nome do criador (seções "Quem está por trás" e "Quem criou").
- [ ] Depoimentos reais e autorizados (ou remova a seção até ter).
- [ ] E-mail de contato (`contato@draxora.com.br` é provisório).
- [ ] Termos de uso e política de privacidade (links no rodapé).
- [ ] Revisão do conteúdo de saúde mental por um(a) profissional da área.

## Identidade

Cores, tipografia e regras de uso vêm do design system Draxora. Tokens principais em `:root` no topo de `assets/css/draxora.css` — mude lá e o site inteiro acompanha.
