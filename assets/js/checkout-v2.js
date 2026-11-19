(() => {
  const cart = Storefront.getCart();
  if (!cart) { location.replace('/cart'); return; }

  const $ = id => document.getElementById(id);
  const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  const quantity = Math.min(10, Math.max(1, Number(cart.quantity) || 1));
  const state = {
    country: NewbooxI18n.detectCountry(), locale: 'en-US', currency: 'USD', rates: { USD: 1 },
    customer: null, unitUsd: 69, totalUsd: 69 * quantity, sdk: null, config: null
  };

  const money = (value, currency = 'USD', locale = 'en-US') => NewbooxI18n.money(value, currency, locale);
  const text = key => NewbooxI18n.text(key, state.locale);
  const deviceFingerprint = () => {
    let value = localStorage.getItem('newboox_device_fingerprint');
    if (!value) { value = crypto.randomUUID(); localStorage.setItem('newboox_device_fingerprint', value); }
    return value;
  };
  const normalizedPhone = value => {
    let phone = String(value || '').replace(/\D/g, '');
    if (state.country === 'US' && phone.length === 10) phone = `1${phone}`;
    if (state.country === 'BR' && phone.length <= 11) phone = `55${phone}`;
    return phone;
  };
  const metadata = () => {
    const query = new URLSearchParams(location.search);
    const values = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','sck'].map(key => [key, query.get(key) || sessionStorage.getItem(`newboox_${key}`) || '']));
    if (!values.sck) values.sck = `model:${String(cart.title || 'Motor Scent').replace(/^Motor Scent\s*[—-]?\s*/i, '').slice(0, 180)}`;
    return values;
  };
  const setStatus = (id, message, error = false) => {
    const node = $(id); if (!node) return;
    node.textContent = message; node.classList.toggle('show', Boolean(message)); node.dataset.error = error ? 'true' : 'false';
  };
  const luhn = value => {
    const digits = String(value).replace(/\D/g, ''); let sum = 0; let alternate = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) { let digit = Number(digits[index]); if (alternate && (digit *= 2) > 9) digit -= 9; sum += digit; alternate = !alternate; }
    return digits.length >= 12 && sum % 10 === 0;
  };

  function applyCopy() {
    document.documentElement.lang = state.locale;
    const fields = { backLink:'back', homeLink:'home', pageTitle:'title', deliveryTitle:'delivery', nameLabel:'name', emailLabel:'email', phoneLabel:'phone', taxLabel:'tax', postalLabel:'postal', addressLabel:'address', numberLabel:'number', complementLabel:'complement', districtLabel:'district', cityLabel:'city', continueButton:'continue', paymentTitle:'payment', cardTitle:'card', cardNameLabel:'cardName', cardNumberLabel:'cardNumber', expiryLabel:'expiry', cvvLabel:'cvv', installmentsLabel:'installments', payButton:'pay', summaryTitle:'summary', totalLabel:'total', secureLabel:'secure' };
    Object.entries(fields).forEach(([id, key]) => { if ($(id)) $(id).textContent = text(key); });
    $('chargedNote').textContent = text('charged');
    $('deliveryNote').textContent = text('deliveryNote');
  }
  function renderCountryOptions() {
    const displayNames = new Intl.DisplayNames([state.locale || 'en-US'], { type: 'region' });
    $('country').innerHTML = COUNTRY_CODES.map(code => `<option value="${code}" ${code === state.country ? 'selected' : ''}>${displayNames.of(code) || code}</option>`).join('');
  }
  function renderSummary() {
    state.totalUsd = Number((state.unitUsd * quantity).toFixed(2));
    const localRate = state.rates[state.currency];
    const local = state.currency !== 'USD' && localRate ? `${money(state.totalUsd * localRate, state.currency, state.locale)} ≈ ` : '';
    const total = `${local}${money(state.totalUsd)}`;
    $('checkoutItem').innerHTML = `<div class="cart-line"><img src="${cart.image}" alt="${String(cart.title || 'Motor Scent').replace(/"/g, '&quot;')}"><div><p class="cart-name">${cart.title || 'Motor Scent'}</p><span class="cart-meta">${text('quantity')}: ${quantity}</span><span class="cart-meta">${money(state.unitUsd)} / unit</span></div><b class="cart-price">${total}</b></div>`;
    $('checkoutTotal').textContent = total; $('checkoutTotalBottom').textContent = total;
    $('footerCurrency').textContent = `Charged in USD · ${state.currency === 'USD' ? 'USD' : `${state.currency} estimate`}`;
    $('installments').innerHTML = `<option value="1">1x ${money(state.totalUsd)}</option>`;
    $('cartCount').textContent = String(quantity);
  }
  async function chooseCountry(country) {
    state.country = country;
    const regional = NewbooxI18n.config(country);
    state.locale = regional.locale; state.currency = regional.currency;
    const taxField = $('taxField');
    const requiresBrazilianDocument = country === 'BR';
    taxField?.classList.toggle('hidden', !requiresBrazilianDocument);
    $('tax').required = requiresBrazilianDocument;
    sessionStorage.setItem('newboox_country', country);
    applyCopy(); renderSummary();
  }
  async function loadCaktoSdk() {
    if (window.Cakto?.CaktoSDK) return;
    const previous = document.querySelector('script[src*="cakto-sdk"]'); if (previous) previous.remove();
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://cakto-sdk.pages.dev/cakto-sdk.min.js'; script.async = true;
      script.onload = resolve; script.onerror = () => reject(new Error('Unable to load Cakto secure card services. Check your connection and reload.'));
      document.head.append(script);
    });
    if (!window.Cakto?.CaktoSDK) throw new Error('Cakto secure card services did not initialize.');
  }
  async function initializeCheckout() {
    const [configResponse, ratesResponse] = await Promise.all([fetch('/api/config', { cache: 'no-store' }), fetch('/api/exchange-rates')]);
    state.config = await configResponse.json();
    const rates = await ratesResponse.json().catch(() => ({ rates: { USD: 1 } }));
    state.rates = rates.rates || { USD: 1 };
    if (!state.config.caktoCheckoutReady || !state.config.caktoClientId) throw new Error(state.config.caktoConfigurationError || 'International checkout is temporarily unavailable.');
    state.unitUsd = Number(state.config.displayUnitPrice || state.config.product?.unitPrice || 69);
    renderSummary();
    await loadCaktoSdk();
    state.sdk = new window.Cakto.CaktoSDK({ client_id: state.config.caktoClientId, environment: 'production' });
    await state.sdk.initAntifraud();
    return state.sdk;
  }

  Storefront.applyBrand?.(cart);
  renderCountryOptions(); renderSummary(); applyCopy();
  let initializationError = null;
  const sdkReady = Promise.all([NewbooxI18n.resolveCountry(), initializeCheckout()]).then(async ([country]) => { state.country = COUNTRY_CODES.includes(country) ? country : 'US'; renderCountryOptions(); await chooseCountry(state.country); setStatus('checkoutStatus', ''); return state.sdk; }).catch(error => { initializationError = error; setStatus('checkoutStatus', error.message || 'International checkout is temporarily unavailable.', true); return null; });

  $('country').addEventListener('change', event => chooseCountry(event.target.value));
  $('customerForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!event.currentTarget.checkValidity()) return event.currentTarget.reportValidity();
    const phone = normalizedPhone($('phone').value);
    if (!/^\d{8,15}$/.test(phone)) return setStatus('checkoutStatus', 'Enter your phone number with country code.', true);
    state.customer = Object.fromEntries(new FormData(event.currentTarget).entries());
    localStorage.setItem(Storefront.CUSTOMER, JSON.stringify(state.customer));
    try {
      const sdk = await sdkReady; if (!sdk) throw initializationError || new Error('Unable to initialize secure payment.');
      event.currentTarget.classList.add('hidden'); $('paymentArea').classList.remove('hidden'); $('paymentArea').scrollIntoView({ behavior: 'smooth' });
    } catch (error) { setStatus('checkoutStatus', error.message || 'Unable to initialize secure payment.', true); }
  });
  $('cardNumber').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim(); });
  $('expiry').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g,'').slice(0,4).replace(/^(\d{2})(\d)/,'$1/$2'); });
  $('cvv').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g,'').slice(0,4); });
  $('cardForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!event.currentTarget.checkValidity()) return event.currentTarget.reportValidity();
    const button = $('payButton'); const originalLabel = text('pay'); button.disabled = true; button.textContent = text('processing'); setStatus('paymentStatus', '');
    try {
      const sdk = await sdkReady; if (!sdk) throw initializationError || new Error('Unable to initialize secure payment.');
      const [month, year] = $('expiry').value.split('/');
      const rawCardNumber = $('cardNumber').value.replace(/\D/g,'');
      if (!luhn(rawCardNumber)) throw new Error('Check the card number and try again.');
      if (!/^(0[1-9]|1[0-2])$/.test(month || '') || !/^\d{2}$/.test(year || '')) throw new Error('Enter a valid card expiry date.');
      const card = { holderName: $('cardName').value.trim(), cardNumber: rawCardNumber, cvv: $('cvv').value.trim(), expMonth: month, expYear: year };
      const { cardToken } = await sdk.createToken(card);
      if (!cardToken) throw new Error('Cakto did not return a valid card token.');
      const authResult = await sdk.authenticate3DS({ card, customer: { amount: Math.round(state.totalUsd * 100), currency: 'USD', email: state.customer.email, name: state.customer.name, phone: normalizedPhone(state.customer.phone), paymentMethod: 'credit', address: { street: state.customer.address, number: state.customer.number, complement: state.customer.complement, city: state.customer.city, state: state.customer.district, zipcode: state.customer.zip } } });
      if (!authResult?.success) throw new Error(authResult?.error || '3D Secure authentication was not approved.');
      await sdk.completeAntifraudProfile();
      const antifraudReference = sdk.getAntifraudReference?.();
      if (!antifraudReference) throw new Error('Unable to complete the security profile. Please try again.');
      const documentNumber = String(state.customer.tax || '').replace(/\D/g, '');
      const response = await fetch('/api/cakto/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        country: state.country, quantity, cardToken, installments: 1, idempotencyKey: crypto.randomUUID(), metadata: metadata(),
        threeDSecure: { cavv: authResult.cavv, eci: authResult.eci, xid: authResult.xid, referenceId: authResult.referenceId, version: authResult.version, dataOnly: authResult.dataOnly === true },
        antifraudReference,
        customer: { name: state.customer.name, email: state.customer.email, phone: normalizedPhone(state.customer.phone), fingerprint: deviceFingerprint(), docType: state.country === 'BR' ? (documentNumber.length > 11 ? 'cnpj' : 'cpf') : '', docNumber: documentNumber },
        address: { country: state.country, state: state.customer.district, city: state.customer.city, zipcode: state.customer.zip, street: state.customer.address, number: state.customer.number, neighborhood: state.customer.district, complement: state.customer.complement }
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Payment was not approved.');
      sessionStorage.setItem(Storefront.PAYMENT, JSON.stringify(result));
      if (result.status === 'paid') Storefront.track?.('Purchase', cart, { value: Number(result.amount || state.totalUsd), currency: 'USD', order_id: result.orderId });
      sdk.cleanupAntifraud?.(); location.assign('/thank-you');
    } catch (error) {
      setStatus('paymentStatus', error.message || 'Payment could not be completed.', true); button.disabled = false; button.textContent = originalLabel;
    }
  });

  try { const saved = JSON.parse(localStorage.getItem(Storefront.CUSTOMER) || '{}'); Object.entries(saved).forEach(([key, value]) => { if ($(key)) $(key).value = value; }); } catch {}
})();
