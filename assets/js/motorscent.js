(() => {
  const product = { id: 'motor-scent', title: 'Motor Scent — Umidificador Automotivo', image: 'assets/images/motorscent/gt3.png' };
  const priceFor = qty => qty === 1 ? 139.90 : qty === 2 ? 129.90 : 99.90;
  const brl = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let quantity = 1;
  const update = () => {
    const unit = priceFor(quantity), total = unit * quantity;
    document.querySelectorAll('[data-qty]').forEach(button => button.classList.toggle('selected', Number(button.dataset.qty) === quantity));
    document.querySelector('#price').textContent = brl(total);
    document.querySelector('#unitPrice').textContent = `${brl(unit)} por unidade`;
  };
  document.querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', () => { quantity = Number(button.dataset.qty); update(); }));
  document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => { document.querySelector('#mainImage').src = button.dataset.image; document.querySelectorAll('[data-image]').forEach(item => item.classList.toggle('active', item === button)); }));
  document.querySelector('#buyButton').addEventListener('click', () => {
    const unit = priceFor(quantity);
    localStorage.setItem('chefpro_cart_v1', JSON.stringify({ ...product, quantity, price: unit }));
    location.assign('/cart');
  });
})();
