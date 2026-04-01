// Mobile menu toggle
const mobileToggle = document.getElementById('mobileToggle');
const siteNav = document.getElementById('siteNav');

mobileToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  mobileToggle.setAttribute('aria-expanded', String(isOpen));
});

// Close mobile nav after clicking a link
siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
  });
});

// Variant selection state
const watchImage = document.getElementById('watchImage');
const selectionNote = document.getElementById('selectionNote');
const productName = document.getElementById('productName');

const imageByColor = {
  'Midnight Black': 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1200&q=80',
  'Champagne Gold': 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=1200&q=80',
  'Silver Steel': 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1200&q=80'
};

let selectedColor = 'Midnight Black';
let selectedSize = '40 mm';

const syncSelectionUI = () => {
  selectionNote.textContent = `Selected: ${selectedColor} · ${selectedSize}`;
  productName.textContent = `Signature One — ${selectedColor} / ${selectedSize}`;
  watchImage.src = imageByColor[selectedColor];
  watchImage.alt = `Aurelius Atelier ${selectedColor} watch`;
};

const handleChipGroup = (groupId, key) => {
  const group = document.getElementById(groupId);
  if (!group) return;

  group.addEventListener('click', (event) => {
    const button = event.target.closest('.chip');
    if (!button) return;

    group.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
    button.classList.add('active');

    if (key === 'color') {
      selectedColor = button.dataset.color;
    } else {
      selectedSize = button.dataset.size;
    }

    syncSelectionUI();
  });
};

handleChipGroup('colorOptions', 'color');
handleChipGroup('sizeOptions', 'size');

// Multi-step flow logic
const stepDots = document.querySelectorAll('.step-dot');
const stepPanels = document.querySelectorAll('.step-panel');
let currentStep = 1;

const goToStep = (stepNumber) => {
  currentStep = stepNumber;

  stepDots.forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.step) === stepNumber);
  });

  stepPanels.forEach((panel) => {
    panel.classList.toggle('active', Number(panel.dataset.panel) === stepNumber);
  });
};

stepDots.forEach((dot) => {
  dot.addEventListener('click', () => goToStep(Number(dot.dataset.step)));
});

document.querySelectorAll('.next-step').forEach((button) => {
  button.addEventListener('click', () => {
    if (currentStep < 3) {
      goToStep(currentStep + 1);
    }
  });
});

document.querySelectorAll('.prev-step').forEach((button) => {
  button.addEventListener('click', () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  });
});

document.getElementById('jumpToPurchase')?.addEventListener('click', () => {
  document.getElementById('addToCart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Purchase interactions
const qtyInput = document.getElementById('qtyInput');
const qtyMinus = document.getElementById('qtyMinus');
const qtyPlus = document.getElementById('qtyPlus');
const addToCart = document.getElementById('addToCart');
const cartFeedback = document.getElementById('cartFeedback');

const normalizeQty = () => {
  let qty = Number(qtyInput.value);
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  qtyInput.value = qty;
  return qty;
};

qtyPlus?.addEventListener('click', () => {
  qtyInput.value = normalizeQty() + 1;
});

qtyMinus?.addEventListener('click', () => {
  qtyInput.value = Math.max(1, normalizeQty() - 1);
});

qtyInput?.addEventListener('input', normalizeQty);

addToCart?.addEventListener('click', () => {
  const qty = normalizeQty();
  const message = `${qty} × Signature One (${selectedColor}, ${selectedSize}) added to your cart.`;
  cartFeedback.textContent = message;

  addToCart.classList.add('added');
  addToCart.textContent = 'Added';

  setTimeout(() => {
    addToCart.classList.remove('added');
    addToCart.textContent = 'Add to Cart';
  }, 1600);
});

// Scroll reveal animation
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// Initialize dynamic state
syncSelectionUI();
goToStep(1);
