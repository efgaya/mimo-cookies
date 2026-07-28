const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const cart = new Map();

const grid = document.querySelector("#product-grid");
const cartFab = document.querySelector("#cart-fab");
const cartFabSummary = document.querySelector("#cart-fab-summary");
const panel = document.querySelector("#cart-panel");
const overlay = document.querySelector("#overlay");
const closeCartButton = document.querySelector("#close-cart");
const cartItems = document.querySelector("#cart-items");
const subtotalEl = document.querySelector("#subtotal");
const totalEl = document.querySelector("#total");
const shippingEl = document.querySelector("#shipping");
const form = document.querySelector("#checkout-form");
const addressFields = document.querySelector("#address-fields");
const addressInput = document.querySelector("#customer-address");
const whatsappButton = document.querySelector("#whatsapp-button");

function renderProducts() {
  grid.innerHTML = PRODUCTS.map(product => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="status-pill">${product.available ? "Disponível" : "Esgotado"}</span>
      </div>
      <div class="product-body">
        <div class="product-title-row">
          <h3>${product.name}</h3>
          <span class="price">${BRL.format(product.price)}</span>
        </div>
        <p>${product.description}</p>
        <button class="add-button" type="button" data-add="${product.id}" ${product.available ? "" : "disabled"}>
          ${product.available ? "Adicionar ao pedido" : "Indisponível"}
        </button>
      </div>
    </article>
  `).join("");

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    addItem(button.dataset.add);
  });
}

function addItem(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  updateCart();
  openCart();
}

function changeQuantity(id, delta) {
  const current = cart.get(id) || 0;
  const next = current + delta;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  updateCart();
}

function getProduct(id) {
  return PRODUCTS.find(product => product.id === id);
}

function calculateSubtotal() {
  return [...cart.entries()].reduce((sum, [id, qty]) => {
    return sum + getProduct(id).price * qty;
  }, 0);
}

function updateCart() {
  const quantity = [...cart.values()].reduce((sum, value) => sum + value, 0);
  const subtotal = calculateSubtotal();

  cartFabSummary.textContent = `${quantity} ${quantity === 1 ? "item" : "itens"} · ${BRL.format(subtotal)}`;
  subtotalEl.textContent = BRL.format(subtotal);
  totalEl.textContent = BRL.format(subtotal);
  whatsappButton.disabled = quantity === 0;

  if (!quantity) {
    cartItems.innerHTML = `<div class="empty-cart">Seu carrinho ainda está vazio.</div>`;
    return;
  }

  cartItems.innerHTML = [...cart.entries()].map(([id, qty]) => {
    const product = getProduct(id);
    return `
      <div class="cart-item">
        <img src="${product.image}" alt="">
        <div>
          <h4>${product.name}</h4>
          <small>${BRL.format(product.price * qty)}</small>
        </div>
        <div class="quantity">
          <button type="button" data-change="${id}" data-delta="-1" aria-label="Remover uma unidade">−</button>
          <strong>${qty}</strong>
          <button type="button" data-change="${id}" data-delta="1" aria-label="Adicionar uma unidade">+</button>
        </div>
      </div>
    `;
  }).join("");
}

cartItems.addEventListener("click", event => {
  const button = event.target.closest("[data-change]");
  if (!button) return;
  changeQuantity(button.dataset.change, Number(button.dataset.delta));
});

function openCart() {
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  cartFab.setAttribute("aria-expanded", "true");
  overlay.hidden = false;
  document.body.classList.add("cart-open");
}

function closeCart() {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  cartFab.setAttribute("aria-expanded", "false");
  overlay.hidden = true;
  document.body.classList.remove("cart-open");
}

cartFab.addEventListener("click", openCart);
closeCartButton.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeCart();
});

document.querySelectorAll('input[name="delivery"]').forEach(input => {
  input.addEventListener("change", () => {
    const isDelivery = input.value === "Entrega" && input.checked;
    addressFields.hidden = !isDelivery;
    addressInput.required = isDelivery;
    shippingEl.textContent = isDelivery ? "A calcular" : "Grátis";
  });
});

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!cart.size) return;

  const whatsapp = STORE_CONFIG.whatsappNumber.replace(/\D/g, "");
  if (!whatsapp) {
    alert("Falta configurar o número do WhatsApp no arquivo config.js.");
    return;
  }

  const name = document.querySelector("#customer-name").value.trim();
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  const address = addressInput.value.trim();
  const notes = document.querySelector("#customer-notes").value.trim();
  const subtotal = calculateSubtotal();

  const lines = [
    `Olá! Gostaria de fazer um pedido na ${STORE_CONFIG.storeName} 🍪`,
    "",
    "*Pedido:*",
    ...[...cart.entries()].map(([id, qty]) => {
      const product = getProduct(id);
      return `${qty}x ${product.name} — ${BRL.format(product.price * qty)}`;
    }),
    "",
    `*Produtos:* ${BRL.format(subtotal)}`,
    `*Recebimento:* ${delivery}`,
    delivery === "Entrega" ? "*Frete:* a calcular" : "*Frete:* grátis",
    delivery === "Entrega" ? `*Endereço:* ${address}` : `*Retirada:* ${STORE_CONFIG.pickupAddress}`,
    "",
    `*Nome:* ${name}`,
    notes ? `*Observações:* ${notes}` : "",
    "",
    delivery === "Entrega"
      ? `*Total parcial:* ${BRL.format(subtotal)} + frete`
      : `*Total:* ${BRL.format(subtotal)}`
  ].filter(Boolean);

  const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");
});

renderProducts();
updateCart();
