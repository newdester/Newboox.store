(() => {
  const cart = Storefront.getCart();
  if (!cart) { location.replace('/cart'); return; }
  const $ = id => document.getElementById(id);
  const quantity = 1;
  const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  let config;
  let selectedProduct;
  let customer;
  let cardBrick;

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
    customer: { name: customer.name, email: customer.email, phone: customer.phone }
  });

  function renderSummary() {
    const total = Number((selectedProduct.price + selectedProduct.shipping).toFixed(2));
    $('checkoutItem').innerHTML = `<div class="cart-line"><img src="${cart.image}" alt="TOYADENT"><div><p class="cart-name">${selectedProduct.title}</p><span class="cart-meta">${selectedProduct.units} ${selectedProduct.units === 1 ? 'unidade' : 'unidades'} de 90g</span><span class="cart-meta">Loggi · 3 a 5 dias úteis</span></div><b class="cart-price">${brl(selectedProduct.price)}</b></div>`;
    $('productSubtotal').textContent = brl(selectedProduct.price);
    $('checkoutShipping').textContent = selectedProduct.shipping ? brl(selectedProduct.shipping) : 'GRÁTIS';
    $('checkoutTotal').textContent = brl(total);
    $('checkoutTotalBottom').textContent = brl(total);
    document.querySelectorAll('[data-payment-total]').forEach(node => { node.textContent = brl(total); });
  }

  async function postPayment(formData) {
    setStatus('Processando pagamento com segurança…');
    const response = await fetch('/api/process_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadBase(formData)) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.cause || result.error || 'Pagamento não autorizado.');
    sessionStorage.setItem(Storefront.PAYMENT, JSON.stringify(result));
    if (formData.payment_method_id === 'pix') { renderPix(result); return result; }
    if (result.status === 'approved') {
      Storefront.track?.('Purchase', cart, { value: result.amount, currency: 'BRL', order_id: result.orderId });
      location.assign('/thank-you');
      return result;
    }
    location.assign(`/thank-you?status=${encodeURIComponent(result.status || 'pending')}`);
    return result;
  }

  function renderPix(result) {
    const pix = result.pix || {};
    $('pixActions').classList.add('hidden');
    $('pixResult').classList.remove('hidden');
    if (pix.qr_code_base64) $('pixQr').src = `data:image/png;base64,${pix.qr_code_base64}`;
    $('pixCode').value = pix.qr_code || '';
    $('pixLink').href = pix.ticket_url || '#';
    setStatus('Pix gerado. Pague pelo aplicativo do seu banco.');
    pollPix(result.paymentId);
  }

  async function pollPix(paymentId) {
    if (!paymentId) return;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        const response = await fetch(`/api/payment-status?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
        if (!response.ok) continue;
        const payment = await response.json();
        if (payment.status === 'approved') {
          const saved = { ...JSON.parse(sessionStorage.getItem(Storefront.PAYMENT) || '{}'), ...payment, status: 'approved' };
          sessionStorage.setItem(Storefront.PAYMENT, JSON.stringify(saved));
          Storefront.track?.('Purchase', cart, { value: payment.amount, currency: 'BRL', order_id: saved.orderId });
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

  async function renderCardBrick() {
    if (cardBrick) return;
    const mp = new MercadoPago(config.publicKey, { locale: 'pt-BR' });
    cardBrick = await mp.bricks().create('cardPayment', 'cardPaymentBrick', {
      initialization: {
        amount: Number((selectedProduct.price + selectedProduct.shipping).toFixed(2)),
        payer: { email: customer.email, identification: { type: 'CPF', number: String(customer.tax || '').replace(/\D/g, '') } }
      },
      customization: { paymentMethods: { minInstallments: 1, maxInstallments: 1 } },
      callbacks: {
        onReady: () => setStatus('Cartão carregado com segurança pelo Mercado Pago.'),
        onSubmit: formData => postPayment(formData).catch(error => { setStatus(error.message, true); throw error; }),
        onError: () => setStatus('Confira os dados do cartão e tente novamente.', true)
      }
    });
  }

  function selectMethod(method) {
    document.querySelectorAll('[data-method]').forEach(button => button.classList.toggle('active', button.dataset.method === method));
    document.querySelectorAll('[data-method-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.methodPanel !== method));
    renderSummary();
    setStatus('');
    if (method === 'card') renderCardBrick().catch(error => setStatus(error.message || 'Não foi possível carregar o pagamento.', true));
  }

  async function initialize() {
    config = await fetch('/api/config', { cache: 'no-store' }).then(response => response.json());
    if (!config.paymentEnabled || !config.publicKey) throw new Error('Mercado Pago ainda não está ativo neste deploy.');
    selectedProduct = config.kits?.find(product => product.id === cart.id) || config.product;
    renderSummary();
    $('cartCount').textContent = String(selectedProduct.units);
    Storefront.track?.('InitiateCheckout', cart, {
      value: Number((selectedProduct.price + selectedProduct.shipping).toFixed(2)),
      currency: 'BRL',
      num_items: selectedProduct.units
    });
  }

  $('customerForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return event.currentTarget.reportValidity();
    if ($('tax').value.replace(/\D/g, '').length !== 11) {
      $('checkoutStatus').textContent = 'Digite um CPF com 11 números.';
      $('checkoutStatus').classList.add('show');
      $('checkoutStatus').dataset.error = 'true';
      $('tax').focus();
      return;
    }
    customer = Object.fromEntries(new FormData(event.currentTarget).entries());
    localStorage.setItem(Storefront.CUSTOMER, JSON.stringify(customer));
    Storefront.track?.('AddPaymentInfo', cart, {
      value: Number((selectedProduct.price + selectedProduct.shipping).toFixed(2)),
      currency: 'BRL',
      num_items: selectedProduct.units
    });
    event.currentTarget.classList.add('hidden');
    $('paymentArea').classList.remove('hidden');
    selectMethod('card');
    $('paymentArea').scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => selectMethod(button.dataset.method)));
  $('generatePix').addEventListener('click', () => postPayment({ payment_method_id: 'pix', payment_type_id: 'bank_transfer', installments: 1, payer: { email: customer.email, identification: { type: 'CPF', number: String(customer.tax || '').replace(/\D/g, '') } } }).catch(error => setStatus(error.message, true)));
  $('copyPix').addEventListener('click', async () => { await navigator.clipboard.writeText($('pixCode').value); $('copyPix').textContent = 'Código copiado'; });
  $('payWithMercadoPago').addEventListener('click', async () => {
    try {
      setStatus('Abrindo ambiente seguro do Mercado Pago…');
      const response = await fetch('/api/mercadopago/preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: 1, productId: selectedProduct.id }) });
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
      $('zipFeedback').textContent = 'Endereço preenchido automaticamente. Confira o número e o complemento.';
      $('number').focus();
    } catch { $('zipFeedback').textContent = 'Não foi possível localizar o CEP. Preencha o endereço manualmente.'; }
  });

  try { const saved = JSON.parse(localStorage.getItem(Storefront.CUSTOMER) || '{}'); Object.entries(saved).forEach(([key, value]) => { if ($(key)) $(key).value = value; }); if ($('zip').value) $('zip').dispatchEvent(new Event('blur')); } catch {}
  initialize().catch(error => { $('continueButton').disabled = true; $('checkoutStatus').textContent = error.message; $('checkoutStatus').classList.add('show'); $('checkoutStatus').dataset.error = 'true'; });
})();
