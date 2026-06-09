const products = Array.from({ length: 2000 }, (_, index) => ({
  id: index + 1,
  name: `Rescue Kit ${String(index + 1).padStart(4, '0')}`,
  category: ['Analytics', 'Commerce', 'Automation', 'Security'][index % 4],
  score: Math.round(Math.abs(Math.sin(index * 31.7)) * 1000),
  description: 'A product card rendered through a smaller visible window.'
}));

const list = document.querySelector('#productList');
const count = document.querySelector('#resultCount');
const searchInput = document.querySelector('#searchInput');
const sortButton = document.querySelector('#sortButton');
const addButton = document.querySelector('#addButton');

let visibleProducts = products;
let sortDescending = true;
const windowSize = 48;

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function createCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="product-image"></div>
    <h3>${product.name}</h3>
    <p>${product.category} · Score ${product.score}</p>
    <button>View details</button>
  `;
  return card;
}

function renderWindow(items) {
  list.textContent = '';
  const fragment = document.createDocumentFragment();
  for (const product of items.slice(0, windowSize)) {
    fragment.appendChild(createCard(product));
  }
  list.appendChild(fragment);
  count.textContent = `${items.length} matching products, ${Math.min(items.length, windowSize)} rendered`;
}

function applySearch(query) {
  const start = performance.now();
  const normalized = query.trim().toLowerCase();
  visibleProducts = normalized
    ? products.filter((product) => product.name.toLowerCase().includes(normalized))
    : products;
  renderWindow(visibleProducts);
  window.perfRescue.measureInteraction('SearchInputOptimized', start);
}

const debouncedSearch = debounce((event) => applySearch(event.target.value), 180);

searchInput.addEventListener('input', debouncedSearch);

sortButton.addEventListener('click', () => {
  const start = performance.now();
  sortDescending = !sortDescending;
  const direction = sortDescending ? -1 : 1;
  visibleProducts = [...visibleProducts].sort((a, b) => direction * (a.score - b.score));
  renderWindow(visibleProducts);
  window.perfRescue.measureInteraction('SortProductsOptimized', start);
});

addButton.addEventListener('click', () => {
  const start = performance.now();
  addButton.disabled = true;
  let total = 0;
  let chunk = 0;

  function runChunk() {
    const end = Math.min(chunk + 12000, 120000);
    for (; chunk < end; chunk++) total += chunk % 13;
    if (chunk < 120000) {
      setTimeout(runChunk, 0);
    } else {
      addButton.disabled = false;
      addButton.textContent = `Added bundle (${total})`;
      window.perfRescue.measureInteraction('AddToCartOptimized', start);
    }
  }

  runChunk();
});

setTimeout(() => {
  const slot = document.querySelector('.promo-slot span');
  slot.textContent = 'Async promo updated without shifting the layout.';
}, 1600);

renderWindow(products);
