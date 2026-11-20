(() => {
  const userAgent = navigator.userAgent || '';
  const isEmbeddedBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\//i.test(userAgent);
  document.documentElement.classList.toggle('embedded-browser', isEmbeddedBrowser);
  window.StoreWebview = {
    isEmbeddedBrowser,
    paymentFallback: 'O navegador interno pode bloquear o formulário de pagamento. Abra o menu ⋮ e escolha “Abrir no navegador” para concluir no Chrome ou Safari.'
  };
})();
