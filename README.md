# E-commerce TOYADENT

## Fluxo implementado

`index.html` → `/cart` → `/checkout` → `/thank-you`

O kit escolhido fica salvo no navegador até a finalização. A landing page, o carrinho e o checkout compartilham o mesmo catálogo validado no servidor.

## Mercado Pago — ambiente de teste

1. Copie `.env.example` para `.env`.
2. Preencha `MP_PUBLIC_KEY` e `MP_ACCESS_TOKEN` com as credenciais de **teste** da sua aplicação Mercado Pago.
3. Execute `npm start` nesta pasta.
4. Abra `http://localhost:4173`.

O checkout usa os componentes oficiais do Mercado Pago para cartão, Pix e saldo Mercado Pago. Os campos de cartão são hospedados/tokenizados pelo Mercado Pago: este projeto não grava número de cartão, CVV ou senha.

## Oferta

- 1 unidade: **R$ 22,90** + **R$ 9,32** de frete.
- 2 unidades: **R$ 39,90** + **R$ 9,32** de frete.
- 3 unidades: **R$ 44,90** com **frete grátis**.
- A Entrega Full é consultada pelo CEP e exibe uma janela entre os dias da semana correspondentes a 3 e 5 dias após a consulta.

## Antes de produção

- No Vercel, use o repositório `newdester/Newboox.store`, selecione a branch `main` e mantenha o diretório raiz como `./`.
- Em **Settings → Environment Variables**, cadastre `MP_PUBLIC_KEY` e `MP_ACCESS_TOKEN`; não as coloque em arquivos do projeto.
- Use uma URL pública com HTTPS em `PUBLIC_BASE_URL`.
- Configure uma notificação (webhook) do Mercado Pago apontando para `/api/mercadopago/webhook`; a assinatura HMAC é validada por `MP_WEBHOOK_SECRET`.
- Troque as chaves de teste pelas chaves de produção somente depois de concluir uma compra de teste aprovada.
- Publique este servidor Node; hospedar somente os arquivos HTML não processará pagamentos.

## Painel de operações

O painel fica em `/admin`. Ele consulta o Mercado Pago no servidor, resume vendas, pagamentos pendentes, meios de pagamento, parcelas, comparativo entre períodos e recomendações operacionais. Dados de contato só são liberados com `ADMIN_DASHBOARD_TOKEN`; cartão, CPF e segredos nunca são exibidos.

Para incorporar desempenho de anúncios por campanha, configure também `META_AD_ACCOUNT_ID`, `META_ADS_ACCESS_TOKEN` (com permissões `ads_read` e `read_insights`) e `META_GRAPH_API_VERSION`. O token da Conversions API não deve ser reutilizado para esse fim.

Limites atuais: a API do Mercado Pago fornece até doze meses de pagamentos, e o painel filtra as transações pelo prefixo `NB-` e pelos kits TOYADENT. Os eventos de navegação já são enviados ao Pixel, mas ainda não são persistidos em um banco próprio.

## Verificações realizadas

- Sintaxe do servidor e dos scripts JavaScript.
- Resposta HTTP das quatro páginas e da rota de configuração.
- Proteção do endpoint de pagamento sem credenciais: retorna `503`, sem criar cobrança.
