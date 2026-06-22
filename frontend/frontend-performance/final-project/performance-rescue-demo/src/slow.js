const products = Array.from({ length: 2000 }, (_, index) => ({
  id: index + 1,
  name: `Rescue Kit ${String(index + 1).padStart(4, '0')}`,
  category: ['Analytics', 'Commerce', 'Automation', 'Security'][index % 4],
  score: Math.round(Math.abs(Math.sin(index * 31.7)) * 1000),
  description: 'A deliberately over-rendered product card used to stress the main thread.'
}));

const list = document.querySelector('#productList');
const count = document.querySelector('#resultCount');
const template = document.querySelector('#productTemplate');
const searchInput = document.querySelector('#searchInput');
const sortButton = document.querySelector('#sortButton');
const addButton = document.querySelector('#addButton');

function expensiveFormat(product) {
  let checksum = 0;
  for (let i = 0; i < 1800; i++) {
    checksum += Math.sqrt(product.score + i) % 7;
  }
  return checksum.toFixed(2);
}

function renderProducts(items) {
  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const product of items) {
    const node = template.content.cloneNode(true);
    node.querySelector('h3').textContent = product.name;
    node.querySelector('p').textContent = `${product.category} · Score ${product.score} · Cost ${expensiveFormat(product)}`;
    fragment.appendChild(node);
  }
  list.appendChild(fragment);
  count.textContent = `${items.length} products rendered`;
}

function filterProducts(query) {
  const normalized = query.trim().toLowerCase();
  return normalized
    ? products.filter((product) => product.name.toLowerCase().includes(normalized))
    : products;
}

searchInput.addEventListener('input', (event) => {
  const start = performance.now();
  renderProducts(filterProducts(event.target.value));
  window.perfRescue.measureInteraction('SearchInput', start);
});

sortButton.addEventListener('click', () => {
  const start = performance.now();
  products.sort((a, b) => b.score - a.score);
  renderProducts(filterProducts(searchInput.value));
  window.perfRescue.measureInteraction('SortProducts', start);
});

addButton.addEventListener('click', () => {
  const start = performance.now();
  const cart = [];
  for (let i = 0; i < 300000; i++) {
    cart.push(i % 13);
  }
  addButton.textContent = `Added ${cart.length.toLocaleString()} items`;
  window.perfRescue.measureInteraction('AddToCart', start);
});

setTimeout(() => {
  const promo = document.createElement('div');
  promo.className = 'promo';
  promo.textContent = 'Async promo inserted after load. This intentionally causes layout shift.';
  document.querySelector('#promoMount').prepend(promo);
}, 1600);

renderProducts(products);
