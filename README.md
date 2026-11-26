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

PageView, ViewContent, AddToCart, InitiateCheckout e AddPaymentInfo são enviados pelo Pixel e pela Conversions API com o mesmo `event_id` para deduplicação. Compras aprovadas são confirmadas no servidor e enviadas à Meta. A atribuição usa `_fbp`, `_fbc`/`fbclid`, navegador e IP, além de dados normalizados disponíveis no pagamento. Não mantenha `META_TEST_EVENT_CODE` configurado no ambiente de produção.

O checkout envia InitiateCheckout e AddPaymentInfo no primeiro pagamento iniciado para o carrinho, ao receber um Pix válido, enviar o cartão tokenizado para processamento ou abrir o pagamento com a conta Mercado Pago. Uma troca de método ou uma nova tentativa com o mesmo carrinho usa o mesmo registro.

## Oferta

- Preço de referência: **R$ 37,20 por unidade**.
- Black Friday: 1 unidade por **R$ 22,90**, 2 por **R$ 39,90** ou 3 por **R$ 44,90**.
- **Entrega padrão grátis** em todos os kits, com prazo estimado de **8 a 12 dias úteis**.
- **SEDEX** por **R$ 12,36**, com prazo estimado de **2 a 3 dias úteis**.
- Ao concluir os dados, o cliente escolhe saldo Mercado Pago, Pix ou cartão de crédito. O checkout só gera um Pix após a escolha desse meio e cancela o Pix pendente antes de trocar para cartão ou saldo Mercado Pago.

## Antes de produção

- No Vercel, use o repositório `newdester/Newboox.store`, selecione a branch `main` e mantenha o diretório raiz como `./`.
- Em **Settings → Environment Variables**, cadastre `MP_PUBLIC_KEY` e `MP_ACCESS_TOKEN`; não as coloque em arquivos do projeto.
- Para salvar o funil no painel entre deploys, crie um banco Redis REST no Upstash e cadastre `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` como variáveis protegidas da Production na Vercel.
- Use uma URL pública com HTTPS em `PUBLIC_BASE_URL`.
- Configure uma notificação (webhook) do Mercado Pago apontando para `/api/mercadopago/webhook`; a assinatura HMAC é validada por `MP_WEBHOOK_SECRET`.
- Troque as chaves de teste pelas chaves de produção somente depois de concluir uma compra de teste aprovada.
- Publique este servidor Node; hospedar somente os arquivos HTML não processará pagamentos.

## Painel de operações

O painel fica em `/admin`. Ele consulta o Mercado Pago no servidor, resume vendas, pagamentos pendentes, meios de pagamento, parcelas, compara períodos e mostra o funil do site, eventos aceitos pela Meta, presença de identificadores de atribuição e os eventos recentes sem dados pessoais. O histórico do funil usa Redis REST do Upstash. Dados de contato só são liberados com `ADMIN_DASHBOARD_TOKEN`; cartão, CPF e segredos nunca são exibidos.

Para incorporar desempenho de anúncios por campanha, configure também `META_AD_ACCOUNT_ID`, `META_ADS_ACCESS_TOKEN` (com permissões `ads_read` e `read_insights`) e `META_GRAPH_API_VERSION`. O token da Conversions API não deve ser reutilizado para esse fim.

Limites atuais: a API do Mercado Pago fornece até doze meses de pagamentos; as contagens agregadas do funil são retidas por até 400 dias e a lista de eventos recentes não inclui dados pessoais. O histórico anterior à configuração do Redis não pode ser reconstruído pelo site.

## Verificações realizadas

- Sintaxe do servidor e dos scripts JavaScript.
- Resposta HTTP das quatro páginas e da rota de configuração.
- Proteção do endpoint de pagamento sem credenciais: retorna `503`, sem criar cobrança.
