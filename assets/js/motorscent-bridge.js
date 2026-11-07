(() => {
  const priceFor = quantity => quantity === 1 ? 69 : quantity === 2 ? 59 : 49;
  let displayLocale = 'en-US', displayCurrency = 'USD', displayRate = 1;
  const brl = value => Number(value * displayRate).toLocaleString(displayLocale, { style: 'currency', currency: displayCurrency });
  const analyticsProduct = { id: 'motor-scent', title: 'Motor Scent — Automotive Diffuser', price: 69, currency: 'USD' };
  const withPixel = callback => {
    if (window.MetaPixel) { callback(); return; }
    if (!document.querySelector('script[src="assets/js/meta-pixel.js"]')) { const script = document.createElement('script'); script.src = 'assets/js/meta-pixel.js'; document.head.append(script); }
    window.addEventListener('meta-pixel-ready', callback, { once: true });
  };
  const trackMotor = (event, extra = {}) => withPixel(() => window.MetaPixel?.track(event, { ...window.MetaPixel.content(analyticsProduct), ...extra }));
  const translations = new Map([
    ['Your car. Your scent. Your space.', 'Seu carro. Seu aroma. Seu espaço.'],
    ['Motor Scent is a desk humidifier shaped like your dream ride.', 'Motor Scent é um umidificador de mesa no formato do carro dos seus sonhos.'],
    ['Choose your ride', 'Escolha seu carro'], ['Add to cart', 'Adicionar ao carrinho'], ['Buy it now', 'Comprar agora'],
    ['Quantity', 'Quantidade'], ['Free shipping', 'Frete grátis'], ['Shipping', 'Envio'], ['Cart', 'Carrinho'],
    ['Checkout', 'Finalizar compra'], ['Sold out', 'Esgotado'], ['In stock', 'Em estoque'], ['Save', 'Economize'],
    ['Order now', 'Compre agora'], ['Secure checkout', 'Pagamento seguro'], ['Shipping protection', 'Proteção de envio'],
    ['Lavender Oil for Motor Scent', 'Óleo de lavanda para Motor Scent'], ['Frequently bought together', 'Comprados juntos com frequência'],
    ['Realistic lights, exhaust mist and a quiet motor turn any room into a garage at night.', 'Luzes realistas, névoa pelo escapamento e um motor silencioso transformam qualquer ambiente em uma garagem à noite.'],
    ['Black 911 GT3 RS', '911 GT3 RS preto'], ['Red Bull F1', 'Fórmula 1 Red Bull'], ['Green M4', 'M4 verde'],
    ['Orange Raptor', 'Raptor laranja'], ['Blue Raptor', 'Raptor azul'], ['Red Raptor', 'Raptor vermelho'],
    ['Green Aventador SVJ', 'Aventador SVJ verde'], ['Orange Aventador SVJ', 'Aventador SVJ laranja'],
    ['Green McLaren Senna', 'McLaren Senna verde'], ['Black C63 AMG', 'C63 AMG preto'], ['Black G-Wagon', 'G-Wagon preto'],
    ['Black Corvette Z06', 'Corvette Z06 preto'], ['Purple Hellcat', 'Hellcat roxo'], ['Black RS6 Avant', 'RS6 Avant preto'],
    ['Black Ram TRX', 'Ram TRX preta'], ['Grey Shelby GT500', 'Shelby GT500 cinza'], ['Grey Audi R8', 'Audi R8 cinza'],
    ['18 MODELS · LIGHTS & EXHAUST MIST', '18 MODELOS · LUZES E NÉVOA NO ESCAPAMENTO'], ['18 Models', '18 modelos'],
    ['17 detailed models to choose from', '17 modelos detalhados para escolher'], ['limited holiday stock', 'estoque limitado'],
    ['SELLING FAST · LIMITED HOLIDAY STOCK', 'VENDENDO RÁPIDO · ESTOQUE LIMITADO'], ['Selling fast', 'Vendendo rápido'],
    ['50% OFF LAUNCH SALE', 'OFERTA DE LANÇAMENTO: 50% OFF'], ['SAVE 50%', 'ECONOMIZE 50%'], ['BUNDLE & SAVE', 'COMBO E ECONOMIA'],
    ['Buy 1', 'Compre 1'], ['Buy 2', 'Compre 2'], ['Buy 3', 'Compre 3'], ['BEST VALUE', 'MELHOR OFERTA'], ['MOST POPULAR', 'MAIS POPULAR'],
    ['Built For Car Lovers', 'Feito para quem ama carros'], ['Not Just Another Model On A Shelf', 'Não é apenas mais uma miniatura na estante'],
    ['Complete your setup', 'Complete seu setup'],
    ['The perfect gift for any car enthusiast', 'O presente perfeito para qualquer apaixonado por carros'],
    ['Real Mist, No Heat', 'Névoa de verdade, sem calor'], ['Quiet Enough For The Bedroom', 'Silencioso para o quarto'],
    ['Realistic headlights & exhaust mist', 'Faróis realistas e névoa pelo escapamento'], ['Night light with attitude', 'Luz noturna cheia de personalidade'],
    ['Add a scent.', 'Adicione um aroma.'], ['Can I add scent?', 'Posso adicionar aroma?'], ['How does it work?', 'Como funciona?'],
    ['How big is it?', 'Qual é o tamanho?'], ['Is it real smoke?', 'É fumaça de verdade?'], ['How long does shipping take?', 'Quanto tempo leva a entrega?'],
    ["What's the return policy?", 'Qual é a política de devolução?'], ['Frequently Asked Questions', 'Perguntas frequentes'],
    ['A few drops of lavender oil in the tank and the whole room smells like it.', 'Algumas gotas de óleo de lavanda no reservatório perfumam todo o ambiente.'],
    ['About the size of a 1:24 scale model car, roughly 20 cm long. It fits on a desk, nightstand or shelf.', 'Tem aproximadamente o tamanho de uma miniatura em escala 1:24, com cerca de 20 cm. Cabe na mesa, no criado-mudo ou na estante.'],
    ['Fill. Tap. Watch it idle.', 'Encha. Toque. Veja funcionar.'], ['Runs for hours.', 'Funciona por horas.'],
    ['Whisper-quiet ultrasonic mist, USB powered, auto shut-off when the tank is empty.', 'Névoa ultrassônica silenciosa, alimentação USB e desligamento automático quando o reservatório esvazia.'],
    ['Fill the tank with water, plug in the USB cable and press the button. The ultrasonic plate turns the water into cool mist that comes out of the exhaust while the headlights light up.', 'Encha o reservatório com água, conecte o cabo USB e aperte o botão. A placa ultrassônica transforma a água em névoa fria que sai pelo escapamento enquanto os faróis acendem.'],
    ['Motor Scent is a working humidifier with the body of a sports car, bike or truck. Fill the tank, tap the button, and the headlights come on while cool mist rolls out of the exhaust.', 'Motor Scent é um umidificador funcional com corpo de carro esportivo, moto ou caminhonete. Encha o reservatório, toque no botão e os faróis acendem enquanto a névoa fria sai pelo escapamento.'],
    ['No. It is cool water mist, the same as a regular humidifier. No heat, no smell, safe on any desk or shelf.', 'Não. É névoa fria de água, como em um umidificador comum. Sem calor e segura para qualquer mesa ou estante.'],
    ['Yes. Add a few drops of the Lavender Oil (or any water-soluble essential oil) to the tank and the mist carries the scent.', 'Sim. Adicione algumas gotas do óleo de lavanda (ou qualquer óleo essencial solúvel em água) ao reservatório e a névoa leva o aroma.'],
    ['One fill lasts an evening, and it shuts off by itself when the tank is empty.', 'Um reservatório dura uma noite e o aparelho desliga sozinho quando a água acaba.'],
    ['Orders ship within 1-3 business days and usually arrive in 7-12 business days. You get a tracking link by email.', 'Os pedidos são enviados em 1 a 3 dias úteis e normalmente chegam em 7 a 12 dias úteis. Você recebe o rastreio por e-mail.'],
    ['30 days. If you are not happy with your Motor Scent, contact us and we sort it out.', '30 dias. Se você não ficar satisfeito com seu Motor Scent, entre em contato para resolvermos.'],
    ['Shipping & Delivery', 'Envio e entrega'], ['Free Shipping', 'Frete grátis'], ['Shipping Protection', 'Proteção de envio'],
    ['Protect your order from potential damage, loss, or theft during shipping', 'Proteja seu pedido contra danos, perda ou roubo durante o envio'],
    ['Covers loss, theft or damage in transit. We ship a replacement for free.', 'Cobre perda, roubo ou danos no transporte. Enviamos uma reposição gratuitamente.'],
    ['Cart reserved for', 'Carrinho reservado por'], ['Cart • 0 Item', 'Carrinho • 0 item'], ['Your cart is empty', 'Seu carrinho está vazio'],
    ['Continue shopping', 'Continuar comprando'], ['Check out', 'Finalizar compra'], ['Payment methods', 'Formas de pagamento'],
    ['Skip to content', 'Ir para o conteúdo'], ['Skip to product information', 'Ir para as informações do produto'], ['Slide left', 'Deslizar para a esquerda'], ['Slide right', 'Deslizar para a direita'],
    ['Previous slide', 'Slide anterior'], ['Next slide', 'Próximo slide'], ['Select a slide to show', 'Selecione um slide para exibir'], ['Go to slide', 'Ir para o slide'],
    ['Regular price', 'Preço normal'], ['Sale price', 'Preço promocional'], ['Unit price', 'Preço unitário'], ['Total amount', 'Valor total'], ['You save', 'Você economiza'],
    ['Product variants', 'Variações do produto'], ['View full details', 'Ver todos os detalhes'], ['Search', 'Buscar'], ['Menu', 'Menu'], ['Home', 'Início'], ['Contact', 'Contato'],
    ['Privacy policy', 'Política de privacidade'], ['Cookie preferences', 'Preferências de cookies'], ['Log in', 'Entrar'], ['Have an account?', 'Já tem uma conta?'], ['Catalog', 'Catálogo'],
    ['Loading...', 'Carregando...'], ["Couldn't load pickup availability", 'Não foi possível carregar a disponibilidade de retirada'],
    ['Real homes, real mist', 'Casas reais, névoa de verdade'], ['Photos from customers across the 18 models.', 'Fotos de clientes com os 18 modelos.'], ['by 300+ car lovers', 'por mais de 300 apaixonados por carros'],
    ['Rated 4.8/5', 'Avaliado em 4,8/5'], ['Excellent', 'Excelente'], ['Trustpilot Reviews', 'Avaliações Trustpilot'],
    ['Better in person', 'Ainda melhor ao vivo'], ['Better than the TV', 'Melhor do que a TV'], ['Looks wild at night', 'Fica incrível à noite'],
    ['Desk upgrade', 'Um novo nível para sua mesa'], ['Office conversation starter', 'Assunto garantido no escritório'], ['Perfect gift for car guys', 'Presente perfeito para quem ama carros'],
    ['Looks like a display piece', 'Parece uma peça de exposição'], ['Kitchen counter truck', 'Caminhonete para a bancada'], ['Windowsill hero', 'Destaque na janela'],
    ['Bought it as a gift and kept it. Fills the kitchen with a light mist in the morning.', 'Comprei de presente e acabei ficando. Enche a cozinha com uma névoa suave pela manhã.'],
    ['Bought the Green V12 for my brother. Feels like a display piece, not a toy. Two of his friends already asked where it came from.', 'Comprei o V12 verde para meu irmão. Parece uma peça de exposição, não um brinquedo. Dois amigos dele já perguntaram onde ele comprou.'],
    ['Cannon mist is insane', 'A névoa saindo do canhão é incrível'], ['Didn\'t expect the humidifier part to work this well. At night it looks unreal.', 'Não esperava que a função de umidificador funcionasse tão bem. À noite fica impressionante.'],
    ['Got the Black GT. Lights plus exhaust mist on my desk after 9pm is the reason I bought it. Photos do not do it justice.', 'Comprei o GT preto. As luzes e a névoa no escapamento sobre minha mesa à noite foram o motivo da compra. As fotos não fazem justiça.'],
    ['Got the Green V12 for my boyfriend. He has not stopped showing it to people.', 'Comprei o V12 verde para meu namorado. Ele não para de mostrar para todo mundo.'],
    ['Looks way better in person. Lights on, mist running, my desk finally has a centerpiece.', 'Ao vivo é muito melhor. Com as luzes acesas e a névoa saindo, minha mesa finalmente tem um destaque.'],
    ['On my desk at work. Three colleagues have ordered one since.', 'Está na minha mesa no trabalho. Três colegas já pediram um desde então.'],
    ['Orange against the window light looks unreal. Mist works great with the lavender oil.', 'O modelo laranja contra a luz da janela fica incrível. A névoa funciona muito bem com óleo de lavanda.'],
    ['Parked on the TV stand. Guests ask about it before they ask about the TV.', 'Fica sobre o rack da TV. As visitas perguntam dele antes de perguntarem da televisão.'],
    ['Pour water into the hidden tank, press the button once and the ultrasonic plate turns it into cool mist that rolls out of the exhaust. No heat, no smell, safe on any desk.', 'Coloque água no reservatório escondido, aperte o botão uma vez e a placa ultrassônica a transforma em névoa fria que sai pelo escapamento. Sem calor, sem cheiro e segura para qualquer mesa.'],
    ['Runs on my nightstand every evening. The light bar and the mist are honestly calming.', 'Funciona no meu criado-mudo todas as noites. A barra de luz e a névoa são realmente relaxantes.'],
    ['Sits next to my keyboard all day. The mist out of the exhaust gets a comment from everyone on video calls.', 'Fica ao lado do meu teclado o dia todo. A névoa saindo do escapamento chama a atenção de todos nas videochamadas.'],
    ['The tank fires mist from the barrel. My setup finally has something nobody else has.', 'O reservatório solta névoa pelo cano. Meu setup finalmente tem algo que ninguém mais tem.'],
    ['Took the spot between my books. The green paint is exactly like the photos.', 'Ficou no espaço entre meus livros. A pintura verde é exatamente como nas fotos.'],
    ['Two bottles of lavender oil. A few drops in the tank and the exhaust mist smells amazing.', 'Duas garrafas de óleo de lavanda. Algumas gotas no reservatório e a névoa do escapamento fica com um aroma incrível.'],
    ['Was not sure it would look like the photos. The bodywork is cleaner than I expected and the mist with the lights on is the whole show.', 'Não tinha certeza se seria igual às fotos. O acabamento é melhor do que eu esperava e a névoa com as luzes acesas é o grande destaque.'],
    ['From a Fórmula 1 Red Bull car to a GT3 RS, an RS6, a Ram TRX, a G-Wagon or a desert tank. There is one for every garage.', 'De um Fórmula 1 Red Bull a um GT3 RS, RS6, Ram TRX, G-Wagon ou tanque do deserto. Há um modelo para cada garagem.'],
    ['Ordered', 'Pedido realizado'], ['Shipped', 'Enviado'], ['Delivered', 'Entregue'], ['Processing:', 'Processamento:'], ['Delivery:', 'Entrega:'], ['Tracking:', 'Rastreamento:'],
    ['sent by email as soon as your order ships', 'enviado por e-mail assim que seu pedido for postado'], ['Every Motor Scent is checked before it leaves the warehouse.', 'Todo Motor Scent é revisado antes de sair do estoque.'],
    ['Customer photo', 'Foto de cliente'], ['Load image', 'Carregar imagem'], ['in gallery view', 'na galeria'], ['Free', 'Grátis'], ['Protection', 'Proteção']
  ]);
  const translate = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => /^(SCRIPT|STYLE)$/i.test(node.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const localize = value => { translations.forEach((to, from) => { value = value.replaceAll(from, to); }); return value.replace(/\$99\.95/g, '$69.00').replace(/1-3 business days/g, '7–9 calendar days').replace(/7-12 business days \(varies by location\)/g, '7–9 calendar days').replace(/Open media (\d+) in modal/g, 'Open media $1 in modal').replace(/Model: /g, 'Model: '); };
    for (let node; node = walker.nextNode();) node.nodeValue = localize(node.nodeValue);
    root.querySelectorAll('[aria-label],[title],[alt],[placeholder]').forEach(element => ['aria-label','title','alt','placeholder'].forEach(attribute => { if (element.hasAttribute(attribute)) element.setAttribute(attribute, localize(element.getAttribute(attribute))); }));
  };
  const modelNames = new Map([['Black 911 GT3 RS', '911 GT3 RS preto'], ['Red Bull F1', 'Fórmula 1 Red Bull'], ['Green M4', 'M4 verde'], ['Orange Raptor', 'Raptor laranja'], ['Blue Raptor', 'Raptor azul'], ['Red Raptor', 'Raptor vermelho'], ['Green Aventador SVJ', 'Aventador SVJ verde'], ['Orange Aventador SVJ', 'Aventador SVJ laranja'], ['Green McLaren Senna', 'McLaren Senna verde'], ['Black C63 AMG', 'C63 AMG preto'], ['Black G-Wagon', 'G-Wagon preto'], ['Black Corvette Z06', 'Corvette Z06 preto'], ['Purple Hellcat', 'Hellcat roxo'], ['Black RS6 Avant', 'RS6 Avant preto'], ['Black Ram TRX', 'Ram TRX preta'], ['Grey Shelby GT500', 'Shelby GT500 cinza'], ['Grey Audi R8', 'Audi R8 cinza']]);
  const selectedModelInput = () => document.querySelector('input[name="Model"]:checked');
  const selectedVariant = () => { const value = selectedModelInput()?.value; return modelNames.get(value) || value || 'Motor Scent'; };
  const selectedImage = () => { const input = selectedModelInput(); const image = input && document.querySelector(`label[for="${input.id}"]`)?.closest('.color-swatch')?.querySelector('img'); return image?.getAttribute('src') || document.querySelector('[data-media-id] img, .product__media img, .product-media img')?.getAttribute('src') || 'motorscent-assets/images/motor-scent-gt3.png'; };
  const syncSelectedModel = () => { const model = selectedVariant(); document.querySelectorAll('[id^="custom-label-"]').forEach(label => { label.textContent = `Modelo: ${model}`; }); };
  const updateOffer = () => {
    const quantity = Math.max(1, Number(document.querySelector('[name="quantity"]')?.value || 1));
    const unit = priceFor(quantity), total = unit * quantity;
    document.querySelectorAll('.main-price, .sticky-atc__price .price-item--sale').forEach(element => { element.textContent = brl(total); });
    document.querySelectorAll('.price__compare-price, .price__badge-sale').forEach(element => { element.style.display = 'none'; });
    document.querySelectorAll('.quantity-break').forEach(card => {
      const units = Number(card.dataset.quantity || 1), tier = priceFor(units), cardTotal = tier * units;
      const label = card.querySelector('.quantity-break__label-text'); if (label) label.textContent = units === 1 ? '1 unidade' : units === 2 ? '2 unidades' : '3 unidades ou mais';
      const caption = card.querySelector('.quantity-break__caption'); if (caption) caption.textContent = `${brl(tier)} por unidade`;
      const price = card.querySelector('.quantity-break__price'); if (price) price.textContent = brl(cardTotal);
      const compare = card.querySelector('.quantity-break__compare-price'); if (compare) compare.style.display = 'none';
      const benefit = card.querySelector('.quantity-break__benefit'); if (benefit) benefit.textContent = 'Frete grátis';
    });
    document.querySelectorAll('[data-handle="shipping-protection"] .upsell__title, [data-handle="shipping-protection"] h3, [data-handle="shipping-protection"] h4').forEach(element => { element.textContent = 'Proteção de envio'; });
    let note = document.querySelector('#motorscent-local-offer');
    if (!note) { note = document.createElement('p'); note.id = 'motorscent-local-offer'; note.style.cssText = 'font-weight:700;margin:12px 0;color:#111'; const anchor = document.querySelector('form[action*="cart/add"], form.shopify-product-form'); anchor?.prepend(note); }
    if (note) note.textContent = quantity === 1 ? '1 unit for $69.00' : quantity === 2 ? '2 units for $59.00 each' : `${quantity} units for $49.00 each`;
  };
  const goToCheckout = (event, destination = '/carrinho') => {
    const target = event.target instanceof Element ? event.target : null;
    const form = target?.closest('form[action*="cart/add"], form.shopify-product-form') || target?.form || (target?.getAttribute('form') && document.getElementById(target.getAttribute('form')));
    if (!form) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const quantity = Math.min(10, Math.max(1, Number(form.querySelector('[name="quantity"]')?.value || 1)));
    const unit = priceFor(quantity);
    const lavenderOil = document.querySelector('[data-handle="lavender-oil"]')?.dataset.selected === 'true';
    localStorage.setItem('chefpro_cart_v1', JSON.stringify({ id: 'motor-scent', title: `Motor Scent — ${selectedVariant()}`, image: selectedImage(), quantity, price: unit, extras: { lavenderOil } }));
    trackMotor('AddToCart', { value: Number((unit * quantity + (lavenderOil ? 20 : 0)).toFixed(2)), contents: [{ id: 'motor-scent', quantity }] });
    location.assign(destination);
  };
  const optimizeImages = () => {
    const images = [...document.images];
    images.forEach((image, index) => {
      image.decoding = 'async';
      if (index > 1) image.loading = 'lazy';
    });
    const hero = document.querySelector('[data-media-id] img, .product__media img, .product-media img');
    if (hero) hero.fetchPriority = 'high';
  };
  const addPaymentNote = () => {
    if (document.querySelector('#motorscent-payment-note')) return;
    const form = document.querySelector('form[action*="cart/add"], form.shopify-product-form');
    if (!form) return;
    const note = document.createElement('p');
    note.id = 'motorscent-payment-note';
    note.textContent = 'Secure payment via Cakto. The final charge is processed in USD; your local currency amount is shown as an estimate.';
    form.append(note);
  };
  const configureLavenderUpsell = () => {
    const lavender = document.querySelector('[data-handle="lavender-oil"]');
    if (!lavender) return;
    const price = lavender.querySelector('.regular-price');
    const compare = lavender.querySelector('.compare-price');
    const title = lavender.querySelector('.upsell__title h3');
    const description = lavender.querySelector('.upsell__desc');
    const toggle = lavender.querySelector('.upsell-toggle-btn, .upsell__toggle-switch');
    if (title) title.textContent = 'Óleo de lavanda para Motor Scent';
    if (description) description.textContent = 'Adicione algumas gotas ao reservatório para perfumar a névoa.';
    if (price) price.textContent = '$20.00';
    if (compare) compare.style.display = 'none';
    lavender.dataset.selected = 'false';
    toggle?.setAttribute('aria-pressed', 'false');
    document.addEventListener('click', event => {
      const button = event.target instanceof Element && event.target.closest('[data-handle="lavender-oil"] .upsell-toggle-btn, [data-handle="lavender-oil"] .upsell__toggle-switch');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const selected = lavender.dataset.selected !== 'true';
      lavender.dataset.selected = String(selected);
      lavender.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }, true);
    document.querySelector('[data-handle="shipping-protection"]')?.remove();
  };
  const addShippingEstimator = () => {
    if (document.querySelector('#motorscent-shipping-estimator')) return;
    const form = document.querySelector('form[action*="cart/add"], form.shopify-product-form');
    if (!form) return;
    const section = document.createElement('section');
    section.id = 'motorscent-shipping-estimator';
    section.className = 'motorscent-shipping-estimator';
    section.innerHTML = `<h2>Check shipping and delivery</h2><div class="motorscent-shipping-form"><label class="visually-hidden" for="motorscent-zip">Postal code</label><input id="motorscent-zip" autocomplete="postal-code" maxlength="16" placeholder="Enter your postal code"><button type="button">Check</button></div><p class="motorscent-shipping-message" aria-live="polite"></p><div class="motorscent-shipping-results" hidden><table><thead><tr><th>Delivery</th><th>Time</th><th>Price</th></tr></thead><tbody><tr><td><strong>Worldwide standard</strong></td><td>7–9 calendar days</td><td><strong>FREE</strong></td></tr></tbody></table><p>Free shipping is applied automatically at checkout.</p></div><div class="motorscent-delivery-card"><span class="motorscent-delivery-icon" aria-hidden="true">🚚</span><p><strong>Free worldwide shipping</strong> <span data-shipping-location>to your region</span><br><span>Estimated delivery in 7–9 calendar days</span></p></div><div class="motorscent-delivery-card"><span class="motorscent-delivery-icon motorscent-delivery-icon--return" aria-hidden="true">▣</span><p><strong>Guaranteed returns</strong><br><span>Money back within 7 days</span></p></div>`;
    const timeline = document.querySelector('dynamic-dates.shipping-checkpoints');
    if (timeline) timeline.replaceWith(section); else form.after(section);
    [...document.querySelectorAll('.product__accordion')].filter(accordion => /shipping|envio/i.test(accordion.textContent)).forEach(accordion => accordion.remove());
    const input = section.querySelector('input');
    const button = section.querySelector('button');
    const message = section.querySelector('.motorscent-shipping-message');
    const results = section.querySelector('.motorscent-shipping-results');
    const locationLabel = section.querySelector('[data-shipping-location]');
    const setLocation = (city, state) => { locationLabel.textContent = city ? `para ${city}${state ? `, ${state}` : ''} e região` : 'para sua região'; };
    const calculate = async () => {
      const zip = input.value.replace(/\D/g, '');
      input.value = zip.replace(/(\d{5})(\d)/, '$1-$2');
      results.hidden = true;
      if (zip.length !== 8) { message.textContent = 'Informe um CEP válido com 8 números.'; return; }
      button.disabled = true; message.textContent = 'Calculando opções de entrega…';
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
        const address = await response.json();
        if (!response.ok || address.erro) throw new Error('CEP inválido');
        const location = [address.localidade, address.uf].filter(Boolean).join(' / ');
        message.textContent = `Entrega para ${location}.`;
        setLocation(address.localidade, address.uf);
        results.hidden = false;
        localStorage.setItem('motorscent_shipping_v1', JSON.stringify({ zip, city: address.localidade || '', state: address.uf || '', method: 'standard' }));
      } catch {
        message.textContent = 'Não encontramos esse CEP. Revise e tente novamente.';
      } finally { button.disabled = false; }
    };
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'); if (input.value.replace(/\D/g, '').length === 8) calculate(); });
    button.addEventListener('click', calculate);
    const stateCodes = { 'Acre':'AC', 'Alagoas':'AL', 'Amapá':'AP', 'Amazonas':'AM', 'Bahia':'BA', 'Ceará':'CE', 'Distrito Federal':'DF', 'Espírito Santo':'ES', 'Goiás':'GO', 'Maranhão':'MA', 'Mato Grosso':'MT', 'Mato Grosso do Sul':'MS', 'Minas Gerais':'MG', 'Pará':'PA', 'Paraíba':'PB', 'Paraná':'PR', 'Pernambuco':'PE', 'Piauí':'PI', 'Rio de Janeiro':'RJ', 'Rio Grande do Norte':'RN', 'Rio Grande do Sul':'RS', 'Rondônia':'RO', 'Roraima':'RR', 'Santa Catarina':'SC', 'São Paulo':'SP', 'Sergipe':'SE', 'Tocantins':'TO' };
    const detectLocation = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch('https://ipwho.is/', { signal: controller.signal });
        const location = await response.json();
        if (response.ok && location.success !== false && location.country_code === 'BR') setLocation(location.city, stateCodes[location.region] || location.region);
      } catch {} finally { clearTimeout(timeout); }
    };
    try { const saved = JSON.parse(localStorage.getItem('motorscent_shipping_v1') || 'null'); if (saved?.zip) { input.value = saved.zip.replace(/(\d{5})(\d)/, '$1-$2'); calculate(); } else detectLocation(); } catch { detectLocation(); }
  };
  document.addEventListener('DOMContentLoaded', async () => { const country = window.NewbooxI18n?.detectCountry?.() || 'US'; const cfg = window.NewbooxI18n?.config?.(country); displayLocale = cfg?.locale || 'en-US'; displayCurrency = cfg?.currency || 'USD'; document.documentElement.lang = displayLocale; if (displayLocale.startsWith('pt')) translate(document.body); try { const rates = await fetch('/api/exchange-rates').then(response => response.json()); displayRate = Number(rates.rates?.[displayCurrency] || 1); } catch {} optimizeImages(); trackMotor('ViewContent'); syncSelectedModel(); configureLavenderUpsell(); addPaymentNote(); addShippingEstimator(); updateOffer(); document.querySelectorAll('[name="quantity"]').forEach(input => input.addEventListener('change', updateOffer)); document.querySelectorAll('input[name="Model"]').forEach(input => input.addEventListener('change', syncSelectedModel)); }, { once: true });
  document.addEventListener('submit', goToCheckout, true);
  document.addEventListener('click', event => {
    const button = event.target instanceof Element && event.target.closest('#ProductSubmitButton-template--30990084735359__main, [id^="SectionAtcBtn-"], [id^="ProductSubmitButton-"], .shopify-payment-button button, [data-shopify="payment-button"]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const isBuyNow = /buy it now|comprar agora/i.test(button.textContent || '') || button.matches('.shopify-payment-button button, [data-shopify="payment-button"]');
    goToCheckout({ target: button, preventDefault() {}, stopImmediatePropagation() {} }, isBuyNow ? '/checkout' : '/carrinho');
  }, true);
  document.addEventListener('click', event => { const anchor = event.target instanceof Element && event.target.closest('a[href]'); if (anchor?.href) withPixel(() => window.MetaPixel?.trackCustom('LinkClick', { link_url: anchor.href, link_text: anchor.textContent.trim().slice(0, 120) })); const link = anchor?.matches('a[href*="/cart"], a[href*="/checkout"]') && anchor; if (!link) return; event.preventDefault(); const form = document.querySelector('form[action*="cart/add"], form.shopify-product-form'); if (form) goToCheckout({ target: form, preventDefault() {}, stopImmediatePropagation() {} }); }, true);
})();
