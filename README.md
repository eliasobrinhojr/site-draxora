# Draxora — site

Site da Draxora: a home da marca (o "corredor de portas") e a página da Porta 00 — Mapa dos Sintomas.

Site estático, sem build: HTML, CSS e JavaScript puros. Abra `index.html` no navegador para ver.

## Estrutura

```
index.html                    Home da Draxora (portas / método / criador)
mapa-dos-sintomas/index.html  Porta 00: página de vendas do Mapa dos Sintomas
mapa-dos-sintomas/checkout/   Revisão do pedido antes do pagamento na Hotmart
privacidade/  termos/         Política de privacidade (LGPD) e termos de uso
assets/css/draxora.css     Tokens e componentes do design system Draxora
assets/js/main.js          Header, animações de entrada e formulários
assets/img/                Logomarca (assinatura, símbolo, ícone, wordmark, selo de nicho)
```

## Cadastro "Avisar-me" (PHP + MySQL)

O formulário da porta 01 envia para `api/inscrever.php`, que grava na tabela `inscritos` (criada sozinha na primeira chamada). Proteções: caixa de consentimento (LGPD), campo-armadilha contra robôs, limite de 5 envios por aparelho a cada 10 min, aceita só envios do próprio site, guarda o IP apenas como hash.

| Arquivo | Para que serve |
| --- | --- |
| `api/inscrever.php` | Recebe o e-mail (POST) |
| `api/contador.php?lista=porta-01` | Total de pessoas esperando (só aparece a partir de `min_publico`) |
| `api/exportar.php?chave=…&lista=porta-01` | Baixa a lista em CSV |
| `api/config.exemplo.txt` | Modelo do arquivo de configuração |

**Configuração no servidor (uma vez só):** as senhas não ficam no GitHub. Crie `draxora-config.php` em `domains/<seu-dominio>/` (uma pasta acima da `public_html`) copiando `api/config.exemplo.txt` e preenchendo os dados do banco criado em hPanel → Bancos de dados.

Para criar uma lista nova (porta 02…), adicione o nome em `DX_LISTAS` no fim de `api/_db.php`.

## Publicar

**Vercel ou Netlify:** importe o repositório; não há comando de build e a pasta de saída é a raiz.

## Configuração (topo de `assets/js/main.js`)

| Variável | Valor atual | Para que serve |
| --- | --- | --- |
| `CHECKOUT_URL` | `https://pay.hotmart.com/Y108011719G` | Botão "Ir para o pagamento seguro" (repassa os utm_* da página) |
| `META_PIXEL_ID` | vazio | Pixel da Meta: PageView, ViewContent, InitiateCheckout, Lead (só após aceite de cookies) |
| `GTAG_ID` | vazio | GA4 (`G-…`) ou Google Ads (`AW-…`): view_item, begin_checkout, generate_lead |
| `WHATSAPP` / `EMAIL` | 5548991851531 / elias.dvlpr@gmail.com | Formulário "Sugerir um tema" e contato |

A compra (Purchase) é registrada pela Hotmart: configure o mesmo Pixel em Hotmart → Ferramentas → Pixel de rastreamento.

## Pendências conhecidas

- [ ] `og:image` usa caminho relativo; troque por URL absoluta quando o domínio estiver definido.

## Publicar na Hostinger com deploy automático

1. hPanel → seu site → **Avançado → Git** → **Connect with GitHub** e autorize o repositório `site-draxora`.
2. Branch `main`, diretório `public_html` → **Deploy**.
3. A partir daí, todo push na `main` atualiza o site sozinho.

## Cache

O `.htaccess` faz o HTML sempre buscar a versão nova. CSS e JS são chamados com `?v=` no HTML: ao mudar esses arquivos, atualize esse número nas duas páginas para os visitantes receberem a versão nova.

## Identidade

Cores, tipografia e regras de uso vêm do design system Draxora. Tokens principais em `:root` no topo de `assets/css/draxora.css` — mude lá e o site inteiro acompanha.
