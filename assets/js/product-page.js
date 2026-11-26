export function startCountdown() {
  const clock = document.querySelector('#black-friday-countdown');
  if (!clock) return;
  const timeInBrasilia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const update = () => {
    const [hours, minutes, seconds] = timeInBrasilia.format(new Date()).split(':').map(Number);
    const remaining = 86400 - (hours * 3600 + minutes * 60 + seconds);
    clock.textContent = [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60]
      .map(value => String(value).padStart(2, '0')).join(':');
  };
  update();
  clock.hidden = false;
  window.setInterval(update, 1000);
}

export function setupGallery() {
  const photos = [...document.querySelectorAll('.gallery-thumb[data-photo]')];
  const image = document.querySelector('#gallery-image');
  const counter = document.querySelector('#photo-counter');
  const frame = image.parentElement;
  let active = 0;
  let touchStart;

  function show(index) {
    const photo = photos[index];
    if (!photo || active === index) return;
    image.src = photo.dataset.photo;
    image.alt = photo.dataset.alt;
    counter.textContent = `${index + 1} de ${photos.length}`;
    photos[active].setAttribute('aria-pressed', 'false');
    photo.setAttribute('aria-pressed', 'true');
    active = index;
    const strip = photo.parentElement;
    if (strip.scrollWidth > strip.clientWidth) {
      const buttonBox = photo.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      const offset = buttonBox.left < stripBox.left
        ? buttonBox.left - stripBox.left - 3
        : Math.max(0, buttonBox.right - stripBox.right + 3);
      if (offset) strip.scrollBy({ left: offset });
    }
  }

  function nextIndex(index, offset) {
    return (index + offset + photos.length) % photos.length;
  }

  frame.querySelectorAll('[data-gallery-step]').forEach(button => {
    button.hidden = photos.length < 2;
    button.addEventListener('click', () => show(nextIndex(active, Number(button.dataset.galleryStep))));
  });

  photos.forEach((photo, index) => {
    photo.addEventListener('click', () => show(index));
    photo.addEventListener('keydown', event => {
      const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!offset) return;
      event.preventDefault();
      const next = nextIndex(index, offset);
      show(next);
      photos[next].focus({ preventScroll: true });
    });
  });
  frame.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });
  frame.addEventListener('touchend', event => {
    if (!touchStart || event.touches.length) return;
    const { clientX, clientY } = event.changedTouches[0];
    const horizontal = clientX - touchStart.clientX;
    const vertical = clientY - touchStart.clientY;
    touchStart = null;
    if (Math.abs(horizontal) > Math.max(40, Math.abs(vertical))) show(active - Math.sign(horizontal));
  }, { passive: true });
  frame.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  return { showImage: src => show(photos.findIndex(photo => photo.dataset.photo === src)) };
}
