const modelForm = document.querySelector('#model-form');
const delivery = document.querySelector('#delivery');
const deliveryForm = document.querySelector('#delivery-form');
const deliveryStatus = document.querySelector('#delivery-status');
const viewDelivery = document.querySelector('#view-delivery');

if (typeof delivery.showModal === 'function') {
  viewDelivery.hidden = false;
  viewDelivery.addEventListener('click', () => {
    deliveryForm.reset();
    deliveryStatus.textContent = '';
    const selection = modelForm.querySelector('input[name="modelo"]:checked').closest('.model');
    const title = selection.querySelector('.model-title').textContent;
    const price = selection.querySelector('.model-price').textContent;
    document.querySelector('#delivery-summary').textContent = `Calcule ${title.toLowerCase()} · ${price}`;
    delivery.showModal();
  });
  document.querySelector('#close-delivery').addEventListener('click', () => delivery.close());
  deliveryForm.addEventListener('submit', event => {
    event.preventDefault();
    deliveryStatus.textContent = 'Los campos obligatorios están completos. El pago aún no está disponible.';
  });
  deliveryForm.addEventListener('input', () => { deliveryStatus.textContent = ''; });
  delivery.addEventListener('close', () => {
    deliveryForm.reset();
    deliveryStatus.textContent = '';
  });
}
