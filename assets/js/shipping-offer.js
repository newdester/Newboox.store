import { standardDeliveryRange } from './shipping-rules.js?v=1';
import { approximateDeliveryDestination, formatPostalCode, lookupPostalCode, postalDigits, readDeliveryPreference, saveDeliveryPreference } from './shipping-location.js?v=1';

const copy = {
  'pt-BR': {
    unknown: 'Destino: informe seu CEP',
    approximate: 'Localização aproximada',
    destination: 'Entrega para',
    edit: 'Alterar CEP',
    between: (start, end) => `Entre ${start} e ${end}`,
    invalid: 'Digite um CEP com 8 números.',
    missing: 'CEP não encontrado. Confira os números e tente novamente.',
    failed: 'Não foi possível consultar o CEP. Tente de novo em instantes.',
    loading: 'Consultando CEP…',
    confirmed: 'Destino atualizado.'
  },
  'es': {
    unknown: 'Ingresa un código postal de Brasil',
    approximate: 'Ubicación aproximada',
    destination: 'Entrega en',
    edit: 'Cambiar código postal',
    between: (start, end) => `Entre ${start} y ${end}`,
    invalid: 'Ingresa un código postal de 8 dígitos.',
    missing: 'Código postal no encontrado. Revisa los números.',
    failed: 'No pudimos consultar el código postal. Inténtalo de nuevo.',
    loading: 'Consultando código postal…',
    confirmed: 'Destino actualizado.'
  }
};

for (const block of document.querySelectorAll('[data-offer-delivery]')) {
  const locale = block.dataset.locale === 'es' ? 'es' : 'pt-BR';
  const words = copy[locale];
  const place = block.querySelector('[data-delivery-place]');
  const windowLabel = block.querySelector('[data-delivery-window]');
  const form = block.querySelector('form');
  const field = form.elements.postalCode;
  const submit = form.querySelector('button');
  const status = block.querySelector('[data-delivery-status]');
  const details = block.querySelector('details');
  const summary = details.querySelector('summary');
  let destination = readDeliveryPreference();
  let lookup;

  const renderWindow = () => { windowLabel.textContent = words.between(...standardDeliveryRange(new Date(), locale)); };
  const renderPlace = () => {
    if (!destination) {
      place.textContent = words.unknown;
      return;
    }
    const prefix = destination.postalCode ? words.destination : words.approximate;
    place.textContent = `${prefix}: ${destination.city}, ${destination.region}`;
    if (destination.postalCode) summary.textContent = words.edit;
  };

  renderWindow();
  renderPlace();
  window.addEventListener('pageshow', renderWindow);
  details.hidden = false;
  if (destination) {
    field.value = formatPostalCode(destination.postalCode);
  } else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    approximateDeliveryDestination(controller.signal).then(approximate => {
      if (!destination && approximate) {
        destination = approximate;
        renderPlace();
      }
    }).catch(() => {}).finally(() => clearTimeout(timeout));
  }

  field.addEventListener('input', () => {
    lookup?.abort();
    lookup = null;
    submit.disabled = false;
    status.textContent = '';
    const formatted = formatPostalCode(field.value);
    if (field.value !== formatted) field.value = formatted;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const postalCode = postalDigits(field.value);
    if (postalCode.length !== 8) {
      status.textContent = words.invalid;
      field.focus();
      return;
    }
    lookup?.abort();
    const controller = new AbortController();
    lookup = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    submit.disabled = true;
    status.textContent = words.loading;
    try {
      const confirmed = await lookupPostalCode(postalCode, controller.signal);
      if (lookup !== controller) return;
      if (!confirmed) {
        status.textContent = words.missing;
        return;
      }
      destination = confirmed;
      saveDeliveryPreference(confirmed);
      renderPlace();
      renderWindow();
      status.textContent = words.confirmed;
    } catch {
      if (lookup === controller) status.textContent = words.failed;
    } finally {
      clearTimeout(timeout);
      if (lookup === controller) {
        lookup = null;
        submit.disabled = false;
      }
    }
  });
}
