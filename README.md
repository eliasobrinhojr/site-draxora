# Draxora — site

Site da Draxora: a home da marca (o "corredor de portas") e a página da Porta 00 — Mapa dos Sintomas.

Site estático, sem build: HTML, CSS e JavaScript puros. Abra `index.html` no navegador para ver.

## Estrutura

```
index.html                    Home da Draxora (portas / método / criador)
mapa-dos-sintomas/index.html  Porta 00: página de vendas do Mapa dos Sintomas
assets/css/draxora.css     Tokens e componentes do design system Draxora
assets/js/main.js          Header, animações de entrada e formulários
assets/img/                Logomarca (assinatura, símbolo, ícone, wordmark, selo de nicho)
```

## Publicar

**Vercel ou Netlify:** importe o repositório; não há comando de build e a pasta de saída é a raiz.

## Antes de lançar — o que substituir

Os trechos marcados em amarelo na página (`[...]`, classe `placeholder-note`) são lembretes; remova-os depois de ajustar.

- [ ] Link de checkout da Hotmart: botão com `data-checkout` em `mapa-dos-sintomas/index.html`.
- [ ] Nome e registro (CRM ou CRP) do profissional que revisou o conteúdo (seção "Quem criou" e FAQ).
- [ ] Sua foto nas seções "Quem está por trás" (home) e "Quem criou" (porta 00).
- [ ] Formulário "Avisar-me" da porta 01: URL da sua ferramenta de e-mail no `data-endpoint`.
- [ ] WhatsApp e e-mail do formulário "Sugerir um tema": variáveis `WHATSAPP` e `EMAIL` no topo de `assets/js/main.js` (sem número, o botão de WhatsApp fica escondido).
- [ ] E-mail de contato do rodapé (`contato@draxora.com.br` é provisório).
- [ ] Termos de uso e política de privacidade (links no rodapé).

## Publicar na Hostinger com deploy automático

1. hPanel → seu site → **Avançado → Git** → **Connect with GitHub** e autorize o repositório `site-draxora`.
2. Branch `main`, diretório `public_html` → **Deploy**.
3. A partir daí, todo push na `main` atualiza o site sozinho.

## Cache

O `.htaccess` faz o HTML sempre buscar a versão nova. CSS e JS são chamados com `?v=` no HTML: ao mudar esses arquivos, atualize esse número nas duas páginas para os visitantes receberem a versão nova.

## Identidade

Cores, tipografia e regras de uso vêm do design system Draxora. Tokens principais em `:root` no topo de `assets/css/draxora.css` — mude lá e o site inteiro acompanha.
