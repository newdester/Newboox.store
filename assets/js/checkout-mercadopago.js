import { Storefront } from './storefront.js?v=soarfly-4';

const cardBrickErrors = {
  get_payment_methods_failed: 'Não foi possível consultar os cartões aceitos pelo Mercado Pago. Tente novamente.',
  get_card_bin_payment_methods_failed: 'O Mercado Pago não conseguiu identificar o cartão. Confira o número ou tente outro cartão de crédito.',
  get_card_issuers_failed: 'O Mercado Pago não conseguiu consultar o emissor. Tente novamente ou use outro cartão de crédito.',
  get_payment_installments_failed: 'Não foi possível consultar as parcelas deste cartão. Confira o número e tente novamente.',
  card_token_creation_failed: 'Confira a validade e o código de segurança ou tente novamente.',
  fields_setup_failed: 'Os campos seguros do Mercado Pago não carregaram. Atualize a página e tente novamente.'
};

const cardDeclines = {
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão e tente novamente.',
  cc_rejected_bad_filled_date: 'Confira a validade do cartão e tente novamente.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança e tente novamente.',
  cc_rejected_insufficient_amount: 'O pagamento não foi autorizado por falta de limite. Use outro cartão ou Pix.',
  cc_rejected_invalid_installments: 'O cartão não aceitou o parcelamento escolhido. Selecione outra opção ou pague à vista.'
};

(() => {
  const cart = Storefront.getCart();
  if (!cart) { location.replace('/cart'); return; }
  const $ = id => document.getElementById(id);
  const quantity = Storefront.kitQuantityFor(cart);
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  let config;
  let selectedProduct;
  let customer;
  let cardBrick;
  let activeStep = 1;
  let activeMethod = '';
  let pendingPixPaymentId = null;
  let pixPollVersion = 0;
  let pixGenerating = false;

  const showStep = step => {
    activeStep = step;
    document.querySelectorAll('[data-checkout-step]').forEach(section => section.classList.toggle('hidden', Number(section.dataset.checkoutStep) !== step));
    document.querySelectorAll('[data-progress]').forEach(item => {
      const value = Number(item.dataset.progress);
      item.classList.toggle('active', value === step);
      item.classList.toggle('complete', value < step);
    });
    document.querySelector('[data-checkout-step]:not(.hidden)')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validateStep = step => {
    const section = document.querySelector(`[data-checkout-step="${step}"]`);
    const fields = [...section.querySelectorAll('input[required]')];
    const invalid = fields.find(field => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return false; }
    if (step === 1 && $('tax').value.replace(/\D/g, '').length !== 11) {
      $('checkoutStatus').textContent = 'Digite um CPF com 11 números.';
      $('checkoutStatus').classList.add('show');
      $('checkoutStatus').dataset.error = 'true';
      $('tax').focus();
      return false;
    }
    if (step === 2 && $('zip').value.replace(/\D/g, '').length !== 8) {
      $('zipFeedback').textContent = 'Digite um CEP válido com 8 números.';
      $('zip').focus();
      return false;
    }
    $('checkoutStatus').classList.remove('show');
    return true;
  };

  const setStatus = (message, error = false) => {
    const node = $('paymentStatus');
    node.textContent = message || '';
    node.classList.toggle('show', Boolean(message));
    node.dataset.error = error ? 'true' : 'false';
  };

  const payloadBase = formData => ({
    formData,
    quantity,
    productId: selectedProduct.id,
    shippingService: Storefront.shippingServiceFor(cart),
    attribution: window.MetaPixel?.attribution?.() || {},
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      tax: customer.tax,
      zip: customer.zip,
      address: customer.address,
      number: customer.number,
      complement: customer.complement,
      city: customer.city,
      state: customer.district
    }
  });

  function renderSummary() {
    if (!selectedProduct) return;
    const total = Storefront.totalFor(cart);
    const subtotal = Storefront.subtotalFor(cart);
    const shipping = Storefront.extrasFor(cart);
    const totalUnits = selectedProduct.units * quantity;
    const isSedex = Storefront.shippingServiceFor(cart) === 'sedex';
    const deliveryText = isSedex ? 'SEDEX · 2 a 3 dias úteis' : (cart.deliveryEstimate || 'Entrega padrão grátis · 8 a 12 dias úteis');
    $('checkoutItem').innerHTML = `<div class="cart-line"><img src="${cart.image}" alt="Lavadora SOARFLY"><div><p class="cart-name">${selectedProduct.title}</p><span class="cart-meta">${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'} · ${brl(selectedProduct.price)} por unidade</span></div><b class="cart-price">${brl(subtotal)}</b></div>`;
    $('productSubtotal').textContent = brl(subtotal);
    $('checkoutShipping').textContent = shipping ? brl(shipping) : 'GRÁTIS';
    $('shippingLabel').textContent = isSedex ? 'SEDEX' : 'Entrega padrão';
    const expressPrice = $('expressShippingPrice');
    expressPrice.classList.toggle('hidden', !isSedex);
    expressPrice.textContent = isSedex ? brl(shipping) : '';
    $('checkoutTotalBottom').textContent = brl(total);
    document.querySelectorAll('[data-payment-total]').forEach(node => { node.textContent = brl(total); });
    $('footerCurrency').textContent = `${deliveryText} · Pagamento em BRL`;
  }

  async function postPayment(formData) {
    setStatus('Processando pagamento com segurança…');
    const response = await fetch('/api/process_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadBase(formData)) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.cause || result.error || 'Pagamento não autorizado.');
    if (formData.payment_method_id !== 'pix' && result.status === 'rejected') {
      throw new Error(cardDeclines[result.statusDetail] || 'Pagamento recusado. Tente outro cartão ou escolha Pix.');
    }
    sessionStorage.setItem(Storefront.PAYMENT, JSON.stringify(result));
    if (formData.payment_method_id === 'pix') {
      if (!['pending', 'in_process', 'authorized'].includes(result.status)) throw new Error('Não foi possível gerar este Pix. Tente novamente.');
      renderPix(result);
      return result;
    }
    if (result.status === 'approved') {
      Storefront.track?.('Purchase', cart, { value: result.amount, currency: 'BRL', order_id: result.orderId }, `mp_payment_${result.paymentId}`);
      location.assign('/thank-you');
      return result;
    }
    location.assign(`/thank-you?status=${encodeURIComponent(result.status || 'pending')}`);
    return result;
  }

  function renderPix(result) {
    const pix = result.pix || {};
    pendingPixPaymentId = String(result.paymentId || '');
    const pollVersion = ++pixPollVersion;
    $('pixActions').classList.add('hidden');
    $('pixResult').classList.remove('hidden');
    if (pix.qr_code_base64) $('pixQr').src = `data:image/png;base64,${pix.qr_code_base64}`;
    $('pixCode').value = pix.qr_code || '';
    $('pixLink').href = pix.ticket_url || '#';
    setStatus('Pix gerado. Pague pelo aplicativo do seu banco.');
    pollPix(result.paymentId, pollVersion);
  }

  async function pollPix(paymentId, pollVersion) {
    if (!paymentId) return;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (pollVersion !== pixPollVersion || String(paymentId) !== pendingPixPaymentId) return;
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
        if (!response.ok) continue;
        const payment = await response.json();
        if (payment.status === 'approved') {
          const saved = { ...JSON.parse(sessionStorage.getItem(Storefront.PAYMENT) || '{}'), ...payment, status: 'approved' };
          sessionStorage.setItem(Storefront.PAYMENT, JSON.stringify(saved));
          Storefront.track?.('Purchase', cart, { value: payment.amount, currency: 'BRL', order_id: saved.orderId }, `mp_payment_${payment.paymentId || paymentId}`);
          location.assign('/thank-you');
          return;
        }
        if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status)) {
          setStatus('O Pix não pôde ser concluído. Gere um novo código para tentar novamente.', true);
          return;
        }
      } catch {}
    }
  }

  function resetPix() {
    pendingPixPaymentId = null;
    pixPollVersion += 1;
    $('pixResult').classList.add('hidden');
    $('pixActions').classList.remove('hidden');
    $('pixQr').removeAttribute('src');
    $('pixCode').value = '';
    $('pixLink').removeAttribute('href');
    $('generatePix').disabled = false;
    $('generatePix').textContent = 'Gerar novo Pix';
  }

  async function cancelPendingPix() {
    if (!pendingPixPaymentId) return true;
    const paymentId = pendingPixPaymentId;
    setStatus('Cancelando o Pix pendente antes de trocar o pagamento…');
    const response = await fetch('/api/cancel-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || (!result.cancelled && !['cancelled', 'rejected', 'refunded'].includes(result.status))) {
      throw new Error(result.error || 'Não foi possível cancelar o Pix pendente. Tente novamente.');
    }
    resetPix();
    const saved = JSON.parse(sessionStorage.getItem(Storefront.PAYMENT) || '{}');
    if (String(saved.paymentId || '') === paymentId) sessionStorage.removeItem(Storefront.PAYMENT);
    return true;
  }

  async function generatePix() {
    if (pixGenerating || pendingPixPaymentId) return;
    pixGenerating = true;
    $('generatePix').disabled = true;
    $('generatePix').textContent = 'Gerando Pix…';
    try {
      await postPayment({ payment_method_id: 'pix', payment_type_id: 'bank_transfer', installments: 1, payer: { email: customer.email, identification: { type: 'CPF', number: String(customer.tax || '').replace(/\D/g, '') } } });
    } catch (error) {
      $('generatePix').disabled = false;
      $('generatePix').textContent = 'Tentar gerar Pix novamente';
      setStatus(error.message, true);
    } finally {
      pixGenerating = false;
    }
  }

  async function renderCardBrick() {
    if (cardBrick) return cardBrick;
    if (typeof window.MercadoPago !== 'function') {
      throw new Error(window.StoreWebview?.isEmbeddedBrowser ? window.StoreWebview.paymentFallback : 'Não foi possível carregar o pagamento. Atualize a página ou tente novamente.');
    }
    const mp = new MercadoPago(config.publicKey, { locale: 'pt-BR' });
    const amount = Storefront.totalFor(cart);
    cardBrick = mp.bricks().create('cardPayment', 'cardPaymentBrick', {
      initialization: {
        amount,
        payer: { email: customer.email, identification: { type: 'CPF', number: String(customer.tax || '').replace(/\D/g, '') } }
      },
      customization: {
        visual: { texts: { formTitle: 'Cartão de crédito', installmentsSectionTitle: 'Número de parcelas' } },
        paymentMethods: {
          minInstallments: 1,
          maxInstallments: selectedProduct.maxInstallments,
          types: { excluded: ['debit_card', 'prepaid_card'] }
        }
      },
      callbacks: {
        onReady: () => { if (activeMethod === 'card') setStatus(''); },
        onSubmit: async (formData, additionalData) => {
          try {
            const installmentCount = Number(formData.installments);
            if (installmentCount > 1) {
              setStatus('Conferindo o valor das parcelas…');
              const bin = String(additionalData?.bin || '');
              const availableQuotes = /^\d{6,8}$/.test(bin)
                ? await mp.getInstallments({ amount: amount.toFixed(2), bin, processingMode: 'aggregator' }).catch(() => [])
                : [];
              const eligiblePlans = (Array.isArray(availableQuotes) ? availableQuotes : [])
                .filter(quote => quote.payment_method_id === formData.payment_method_id)
                .flatMap(quote => quote.payer_costs || [])
                .filter(plan => plan.installments === installmentCount && (
                  !formData.payment_method_option_id || plan.payment_method_option_id === formData.payment_method_option_id
                ));
              const cents = Math.round(amount * 100);
              if (!eligiblePlans.length || eligiblePlans.some(plan => Math.round(Number(plan.total_amount) * 100) !== cents)) {
                throw new Error('Essa condição sem juros não pôde ser confirmada para o cartão. Selecione outra parcela sem acréscimo ou pague à vista.');
              }
            }
            await postPayment({ ...formData, payer: { ...formData.payer, email: customer.email } });
          } catch (error) {
            setStatus(error.message, true);
            throw error;
          }
        },
        onError: error => {
          if (activeMethod !== 'card') return;
          const message = cardBrickErrors[error?.cause];
          if (message || $('paymentStatus').dataset.error !== 'true') {
            setStatus(message || 'Confira os dados do cartão e tente novamente.', true);
          }
        }
      }
    }).catch(error => {
      cardBrick = null;
      throw error;
    });
    return cardBrick;
  }

  async function selectMethod(method, autoGeneratePix = false) {
    if (method !== 'pix' && pixGenerating) throw new Error('Aguarde alguns segundos enquanto o Pix é gerado. Depois você poderá trocar o pagamento.');
    if (method === activeMethod) {
      if (method === 'card') await renderCardBrick();
      if (method === 'pix' && autoGeneratePix && !pendingPixPaymentId) await generatePix();
      return;
    }
    if (method !== 'pix' && pendingPixPaymentId) await cancelPendingPix();
    activeMethod = method;
    document.querySelectorAll('[data-method]').forEach(button => button.classList.toggle('active', button.dataset.method === method));
    document.querySelectorAll('[data-method-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.methodPanel !== method));
    renderSummary();
    setStatus('');
    if (method === 'card') await renderCardBrick();
    if (method === 'pix' && autoGeneratePix && !pendingPixPaymentId) await generatePix();
  }

  async function initialize() {
    config = await Storefront.loadConfig();
    if (!config.paymentEnabled || !config.publicKey) throw new Error('Mercado Pago ainda não está ativo neste deploy.');
    selectedProduct = config.kits?.find(product => product.id === cart.id && product.available);
    if (!selectedProduct) throw new Error('Volte ao carrinho e escolha uma voltagem disponível.');
    document.querySelectorAll('input[name="shippingService"]').forEach(input => {
      input.checked = input.value === Storefront.shippingServiceFor(cart);
      input.closest('.delivery-choice')?.classList.toggle('selected', input.checked);
    });
    renderSummary();
    $('cartCount').textContent = String(selectedProduct.units * quantity);
    Storefront.track?.('InitiateCheckout', cart, {
      value: Storefront.totalFor(cart),
      currency: 'BRL',
      num_items: selectedProduct.units * quantity
    });
  }

  $('customerForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedProduct) return;
    if (!event.currentTarget.checkValidity()) return event.currentTarget.reportValidity();
    customer = Object.fromEntries(new FormData(event.currentTarget).entries());
    localStorage.setItem(Storefront.CUSTOMER, JSON.stringify(customer));
    Storefront.track?.('AddPaymentInfo', cart, {
      value: Storefront.totalFor(cart),
      currency: 'BRL',
      num_items: selectedProduct.units * quantity
    });
    event.currentTarget.classList.add('hidden');
    $('paymentArea').classList.remove('hidden');
    document.querySelectorAll('[data-progress]').forEach(item => { const value = Number(item.dataset.progress); item.classList.toggle('active', value === 4); item.classList.toggle('complete', value < 4); });
    await selectMethod('pix');
    $('paymentArea').scrollIntoView({ behavior: 'smooth' });
    await generatePix();
  });

  document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', async () => {
    try { await selectMethod(button.dataset.method, button.dataset.method === 'pix'); }
    catch (error) { setStatus(error.message || 'Não foi possível abrir este meio de pagamento. Tente novamente.', true); }
  }));
  document.querySelectorAll('[data-next-step]').forEach(button => button.addEventListener('click', () => { if (validateStep(activeStep)) showStep(Number(button.dataset.nextStep)); }));
  document.querySelectorAll('[data-back-step]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.backStep))));
  $('generatePix').addEventListener('click', generatePix);
  $('copyPix').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText($('pixCode').value);
    } catch {
      $('pixCode').focus();
      $('pixCode').select();
      document.execCommand('copy');
    }
    $('copyPix').textContent = 'Código copiado';
  });
  $('payWithMercadoPago').addEventListener('click', async () => {
    try {
      setStatus('Abrindo ambiente seguro do Mercado Pago…');
      const response = await fetch('/api/mercadopago/preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity, productId: selectedProduct.id, shippingService: Storefront.shippingServiceFor(cart) }) });
      const result = await response.json();
      if (!response.ok || !result.initPoint) throw new Error(result.error || 'Não foi possível abrir o Mercado Pago.');
      location.assign(result.initPoint);
    } catch (error) { setStatus(error.message, true); }
  });

  $('tax').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 11); });
  const zipField = $('zip');
  const zipFeedback = $('zipFeedback');
  const zipFields = [['address', 'logradouro'], ['city', 'localidade'], ['district', 'uf']];
  const autofilled = new Map();
  let lastZip = '';
  let zipLookup;

  function saveShippingEstimate(estimate) {
    cart.deliveryEstimate = estimate;
    Storefront.putCart(cart);
    renderSummary();
  }

  function addressEstimate() {
    const city = $('city').value.trim();
    const state = $('district').value.trim();
    return city && state ? `Entrega padrão grátis para ${city} - ${state} · 8 a 12 dias úteis` : '';
  }

  async function lookupZip() {
    const zip = zipField.value.replace(/\D/g, '').slice(0, 8);
    const formatted = zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
    if (zipField.value !== formatted) zipField.value = formatted;
    if (zip === lastZip) return;
    zipLookup?.abort();
    zipLookup = null;
    for (const [field, value] of autofilled) {
      if (field.value === value) field.value = '';
    }
    autofilled.clear();
    if (lastZip.length === 8) saveShippingEstimate('');
    lastZip = zip;
    zipFeedback.textContent = '';
    if (zip.length !== 8) return;

    const controller = new AbortController();
    zipLookup = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    const fields = zipFields.map(([id, key]) => ({ field: $(id), key, before: $(id).value }));
    zipFeedback.textContent = 'Buscando endereço…';
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const address = await response.json();
      if (controller !== zipLookup) return;
      if (address.erro || !address.localidade || !address.uf) throw new Error();
      for (const { field, key, before } of fields) {
        if (address[key] && field.value === before) {
          field.value = address[key];
          autofilled.set(field, address[key]);
        }
      }
      saveShippingEstimate(addressEstimate());
      zipFeedback.textContent = $('address').value
        ? 'Confira o endereço e informe o número.'
        : 'Cidade e estado localizados. Informe a rua e o número.';
    } catch {
      if (controller === zipLookup) zipFeedback.textContent = 'Confira o CEP ou preencha o endereço manualmente.';
    } finally {
      clearTimeout(timeout);
    }
  }

  zipField.addEventListener('input', lookupZip);
  zipField.addEventListener('change', lookupZip);

  document.querySelectorAll('input[name="shippingService"]').forEach(input => input.addEventListener('change', event => {
    cart.shippingService = event.target.value === 'sedex' ? 'sedex' : 'standard';
    document.querySelectorAll('.delivery-choice').forEach(label => label.classList.toggle('selected', label.contains(event.target)));
    saveShippingEstimate(addressEstimate());
  }));

  try { const saved = JSON.parse(localStorage.getItem(Storefront.CUSTOMER) || '{}'); Object.entries(saved).forEach(([key, value]) => { if ($(key)) $(key).value = value; }); if (zipField.value) lookupZip(); } catch {}
  if (window.StoreWebview?.isEmbeddedBrowser) $('webviewNotice').classList.remove('hidden');
  showStep(1);
  $('continueButton').disabled = true;
  initialize().then(() => { $('continueButton').disabled = false; }).catch(error => { $('continueButton').disabled = true; $('checkoutStatus').textContent = error.message; $('checkoutStatus').classList.add('show'); $('checkoutStatus').dataset.error = 'true'; });
})();
