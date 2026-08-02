const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const cart = new Map();
let PRODUCTS = [];

const PRODUCT_EMOJIS = {
  tradicional: String.fromCodePoint(0x1F90E),
  chocolatudo: String.fromCodePoint(0x1F36B),
  "caramelo-salgado": String.fromCodePoint(0x1F36F),
  kitkat: String.fromCodePoint(0x1F36B),
  biscoff: String.fromCodePoint(0x1F950),
  "red-velvet": String.fromCodePoint(0x2764, 0xFE0F)
};

const greetingEmojis = String.fromCodePoint(
  0x1F36A,
  0x1F497
);

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

async function loadProducts() {
  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select(`
        id,
        slug,
        name,
        price,
        description,
        image_url,
        available,
        stock,
        display_order
      `)
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn(
        "Nenhum produto encontrado no Supabase. Usando produtos locais."
      );

      return FALLBACK_PRODUCTS;
    }

    return data.map(product => ({
      id: product.slug,
      databaseId: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image_url,
      description: product.description,
      available:
        product.available &&
        (product.stock === null || product.stock > 0),
      stock: product.stock,
      displayOrder: product.display_order
    }));
  } catch (error) {
    console.error(
      "Erro ao carregar produtos do Supabase:",
      error
    );

    return FALLBACK_PRODUCTS;
  }
}

function getProductStatus(product) {
  if (!product.available || product.stock === 0) {
    return {
      text: "Esgotado",
      className: "status-sold-out"
    };
  }

  if (
    product.stock !== null &&
    product.stock !== undefined &&
    product.stock >= 1 &&
    product.stock <= 3
  ) {
    return {
      text: "Últimas unidades",
      className: "status-low-stock"
    };
  }

  return {
    text: "Disponível",
    className: "status-available"
  };
}

function renderProducts() {
  grid.innerHTML = PRODUCTS.map(product => {
    const status = getProductStatus(product);

    return `
      <article class="product-card">
        <div class="product-image-wrap">
          <img
            class="product-image"
            src="${product.image}"
            alt="${product.name}"
            loading="lazy"
          >

          <span class="status-pill ${status.className}">
            ${status.text}
          </span>
        </div>

        <div class="product-body">
          <div class="product-title-row">
            <h3>${product.name}</h3>
            <span class="price">${BRL.format(product.price)}</span>
          </div>

          <p>${product.description}</p>

          <button
            class="add-button"
            type="button"
            data-add="${product.id}"
            ${product.available ? "" : "disabled"}
          >
            ${product.available
              ? "Adicionar ao pedido"
              : "Indisponível"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (!button) return;

  addItem(button.dataset.add);
});

function addItem(id) {
  const product = getProduct(id);

  if (!product || !product.available) return;

  const currentQuantity = cart.get(id) || 0;

  if (
    product.stock !== null &&
    product.stock !== undefined &&
    currentQuantity >= product.stock
  ) {
    alert(`Há apenas ${product.stock} unidade(s) de ${product.name} disponível(is).`);
    return;
  }

  cart.set(id, currentQuantity + 1);

  updateCart();
  openCart();
}

function changeQuantity(id, delta) {
  const product = getProduct(id);

  if (!product) return;

  const current = cart.get(id) || 0;
  const next = current + delta;

  if (next <= 0) {
    cart.delete(id);
    updateCart();
    return;
  }

  if (
    delta > 0 &&
    product.stock !== null &&
    product.stock !== undefined &&
    next > product.stock
  ) {
    alert(`Há apenas ${product.stock} unidade(s) de ${product.name} disponível(is).`);
    return;
  }

  cart.set(id, next);
  updateCart();
}

function getProduct(id) {
  return PRODUCTS.find(product => product.id === id);
}

function calculateSubtotal() {
  return [...cart.entries()].reduce((sum, [id, qty]) => {
    const product = getProduct(id);

    if (!product) return sum;

    return sum + product.price * qty;
  }, 0);
}

function updateCart() {
  const quantity = [...cart.values()]
    .reduce((sum, value) => sum + value, 0);

  const subtotal = calculateSubtotal();

  cartFabSummary.textContent =
    `${quantity} ${quantity === 1 ? "item" : "itens"} · ${BRL.format(subtotal)}`;

  subtotalEl.textContent = BRL.format(subtotal);
  totalEl.textContent = BRL.format(subtotal);
  whatsappButton.disabled = quantity === 0;

  if (!quantity) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        Seu carrinho ainda está vazio.
      </div>
    `;

    return;
  }

  cartItems.innerHTML = [...cart.entries()]
    .map(([id, qty]) => {
      const product = getProduct(id);

      if (!product) return "";

      return `
        <div class="cart-item">
          <img src="${product.image}" alt="">

          <div>
            <h4>${product.name}</h4>
            <small>
              ${BRL.format(product.price * qty)}
            </small>
          </div>

          <div class="quantity">
            <button
              type="button"
              data-change="${id}"
              data-delta="-1"
              aria-label="Remover uma unidade"
            >
              −
            </button>

            <strong>${qty}</strong>

            <button
  type="button"
  data-change="${id}"
  data-delta="1"
  aria-label="Adicionar uma unidade"
  ${
    product.stock !== null &&
    product.stock !== undefined &&
    qty >= product.stock
      ? "disabled"
      : ""
  }
>
  +
</button>
          </div>
        </div>
      `;
    })
    .join("");
}

cartItems.addEventListener("click", event => {
  const button = event.target.closest("[data-change]");

  if (!button) return;

  changeQuantity(
    button.dataset.change,
    Number(button.dataset.delta)
  );
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
  if (event.key === "Escape") {
    closeCart();
  }
});

document
  .querySelectorAll('input[name="delivery"]')
  .forEach(input => {
    input.addEventListener("change", () => {
      const isDelivery =
        input.value === "Entrega" &&
        input.checked;

      addressFields.hidden = !isDelivery;
      addressInput.required = isDelivery;

      shippingEl.textContent =
        isDelivery ? "A calcular" : "Grátis";
    });
  });

form.addEventListener("submit", event => {
  event.preventDefault();

  if (!cart.size) return;

  const whatsapp =
    STORE_CONFIG.whatsappNumber.replace(/\D/g, "");

  if (!whatsapp) {
    alert(
      "Falta configurar o número do WhatsApp no arquivo config.js."
    );

    return;
  }

  const name = document
    .querySelector("#customer-name")
    .value
    .trim();

  const delivery = document
    .querySelector('input[name="delivery"]:checked')
    .value;

  const address = addressInput.value.trim();

  const notes = document
    .querySelector("#customer-notes")
    .value
    .trim();

  const subtotal = calculateSubtotal();

  const lines = [
    `Olá! Gostaria de fazer um pedido na ${STORE_CONFIG.storeName} ${greetingEmojis}`,
    "",
    "*Pedido:*",

    ...[...cart.entries()].map(([id, qty]) => {
      const product = getProduct(id);
      const emoji = PRODUCT_EMOJIS[id] || "";

      return `${emoji} ${qty}x ${product.name} — ${BRL.format(product.price * qty)}`;
    }),

    "",
    `*Produtos:* ${BRL.format(subtotal)}`,
    `*Recebimento:* ${delivery}`,

    delivery === "Entrega"
      ? "*Frete:* a calcular"
      : "*Frete:* grátis",

    delivery === "Entrega"
      ? `*Endereço:* ${address}`
      : `*Retirada:* ${STORE_CONFIG.pickupAddress}`,

    "",
    `*Nome:* ${name}`,

    notes
      ? `*Observações:* ${notes}`
      : "",

    "",

    delivery === "Entrega"
      ? `*Total parcial:* ${BRL.format(subtotal)} + frete`
      : `*Total:* ${BRL.format(subtotal)}`
  ].filter(Boolean);

  const url =
    `https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;

  window.open(url, "_blank", "noopener");
});

async function initializeStore() {
  grid.innerHTML = `
    <p class="loading-products">
      Carregando cardápio...
    </p>
  `;

  PRODUCTS = await loadProducts();

  renderProducts();
  updateCart();
}

initializeStore();
