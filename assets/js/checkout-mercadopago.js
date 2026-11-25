import { Storefront } from './storefront.js?v=soarfly-1';

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
    $('checkoutTotalBottom').textContent = brl(total);
    document.querySelectorAll('[data-payment-total]').forEach(node => { node.textContent = brl(total); });
    $('footerCurrency').textContent = `${deliveryText} · Pagamento em BRL`;
  }

  async function postPayment(formData) {
    setStatus('Processando pagamento com segurança…');
    const response = await fetch('/api/process_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadBase(formData)) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.cause || result.error || 'Pagamento não autorizado.');
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
    if (cardBrick) return;
    if (typeof window.MercadoPago !== 'function') {
      throw new Error(window.StoreWebview?.isEmbeddedBrowser ? window.StoreWebview.paymentFallback : 'Não foi possível carregar o pagamento. Atualize a página ou tente novamente.');
    }
    const mp = new MercadoPago(config.publicKey, { locale: 'pt-BR' });
    const amount = Storefront.totalFor(cart);
    cardBrick = await mp.bricks().create('cardPayment', 'cardPaymentBrick', {
      initialization: {
        amount,
        payer: { email: customer.email, identification: { type: 'CPF', number: String(customer.tax || '').replace(/\D/g, '') } }
      },
      customization: { paymentMethods: { minInstallments: 1, maxInstallments: selectedProduct.maxInstallments, types: { included: ['credit_card'] } } },
      callbacks: {
        onReady: () => setStatus('Cartão carregado com segurança pelo Mercado Pago.'),
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
            await postPayment(formData);
          } catch (error) {
            setStatus(error.message, true);
            throw error;
          }
        },
        onError: () => setStatus('Confira os dados do cartão e tente novamente.', true)
      }
    });
  }

  async function selectMethod(method, autoGeneratePix = false) {
    if (method !== 'pix' && pixGenerating) throw new Error('Aguarde alguns segundos enquanto o Pix é gerado. Depois você poderá trocar o pagamento.');
    if (method === activeMethod) {
      if (method === 'pix' && autoGeneratePix && !pendingPixPaymentId) await generatePix();
      return;
    }
    if (method !== 'pix' && pendingPixPaymentId) await cancelPendingPix();
    activeMethod = method;
    document.querySelectorAll('[data-method]').forEach(button => button.classList.toggle('active', button.dataset.method === method));
    document.querySelectorAll('[data-method-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.methodPanel !== method));
    renderSummary();
    setStatus('');
    if (method === 'card') renderCardBrick().catch(error => setStatus(error.message || 'Não foi possível carregar o pagamento.', true));
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
    catch (error) { setStatus(error.message, true); }
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
  $('zip').addEventListener('input', event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 8); event.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits; });
  $('zip').addEventListener('blur', async event => {
    const zip = event.target.value.replace(/\D/g, '');
    if (zip.length !== 8) return;
    $('zipFeedback').textContent = 'Buscando endereço…';
    try {
      const address = await fetch(`https://viacep.com.br/ws/${zip}/json/`).then(response => response.json());
      if (address.erro) throw new Error();
      $('address').value = address.logradouro || $('address').value;
      $('city').value = address.localidade || $('city').value;
      $('district').value = address.uf || $('district').value;
      cart.deliveryEstimate = `Entrega padrão grátis para ${address.localidade} - ${address.uf} · 8 a 12 dias úteis`;
      Storefront.putCart(cart);
      renderSummary();
      $('zipFeedback').textContent = 'Endereço preenchido automaticamente. Confira o número e o complemento.';
      $('number').focus();
    } catch { $('zipFeedback').textContent = 'Não foi possível localizar o CEP. Preencha o endereço manualmente.'; }
  });

  document.querySelectorAll('input[name="shippingService"]').forEach(input => input.addEventListener('change', event => {
    cart.shippingService = event.target.value === 'sedex' ? 'sedex' : 'standard';
    if (cart.shippingService === 'sedex') cart.deliveryEstimate = 'SEDEX · 2 a 3 dias úteis';
    else cart.deliveryEstimate = $('city').value ? `Entrega padrão grátis para ${$('city').value} - ${$('district').value} · 8 a 12 dias úteis` : 'Entrega padrão grátis · 8 a 12 dias úteis';
    Storefront.putCart(cart);
    document.querySelectorAll('.delivery-choice').forEach(label => label.classList.toggle('selected', label.contains(event.target)));
    renderSummary();
  }));

  try { const saved = JSON.parse(localStorage.getItem(Storefront.CUSTOMER) || '{}'); Object.entries(saved).forEach(([key, value]) => { if ($(key)) $(key).value = value; }); if ($('zip').value) $('zip').dispatchEvent(new Event('blur')); } catch {}
  if (window.StoreWebview?.isEmbeddedBrowser) $('webviewNotice').classList.remove('hidden');
  showStep(1);
  $('continueButton').disabled = true;
  initialize().then(() => { $('continueButton').disabled = false; }).catch(error => { $('continueButton').disabled = true; $('checkoutStatus').textContent = error.message; $('checkoutStatus').classList.add('show'); $('checkoutStatus').dataset.error = 'true'; });
})();
