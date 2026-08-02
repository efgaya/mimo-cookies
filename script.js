const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const cart = new Map();
let PRODUCTS = [];
let isSubmitting = false;
let lastRegisteredSignature = null;
let lastWhatsAppUrl = null;
let turnstileToken = null;
let turnstileWidgetId = null;

const TURNSTILE_ACTION = "create_order";

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function getSafeImageSource(value) {
  const source = String(value ?? "").trim();

  if (!source) return "";

  try {
    const url = new URL(source, window.location.href);

    return ["http:", "https:"].includes(url.protocol)
      ? escapeHtml(source)
      : "";
  } catch {
    return "";
  }
}

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
const turnstileMessage = document.querySelector("#turnstile-message");

function setTurnstileMessage(text, type = "") {
  turnstileMessage.textContent = text;
  turnstileMessage.className = "turnstile-message";

  if (type) {
    turnstileMessage.classList.add(type);
  }
}

function handleTurnstileUnavailable() {
  turnstileToken = null;
  setTurnstileMessage(
    "Não foi possível carregar a verificação de segurança.",
    "error"
  );
  refreshWhatsappButton();
}

function initializeTurnstile() {
  if (turnstileWidgetId !== null) return;

  const siteKey =
    String(STORE_CONFIG.turnstileSiteKey || "").trim();

  if (!siteKey) {
    setTurnstileMessage(
      "A verificação de segurança ainda não foi configurada.",
      "error"
    );
    refreshWhatsappButton();
    return;
  }

  if (!window.turnstile) {
    handleTurnstileUnavailable();
    return;
  }

  turnstileWidgetId = window.turnstile.render(
    "#turnstile-widget",
    {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      size: window.matchMedia("(max-width: 370px)").matches
        ? "compact"
        : "flexible",
      callback: token => {
        turnstileToken = token;
        setTurnstileMessage(
          "Verificação concluída.",
          "success"
        );
        refreshWhatsappButton();
      },
      "expired-callback": () => {
        turnstileToken = null;
        setTurnstileMessage(
          "A verificação expirou. Tente novamente.",
          "error"
        );
        refreshWhatsappButton();
      },
      "timeout-callback": () => {
        turnstileToken = null;
        setTurnstileMessage(
          "A verificação expirou. Tente novamente.",
          "error"
        );
        refreshWhatsappButton();
      },
      "error-callback": () => {
        handleTurnstileUnavailable();
      }
    }
  );
}

function resetTurnstile() {
  turnstileToken = null;

  if (
    window.turnstile &&
    turnstileWidgetId !== null
  ) {
    window.turnstile.reset(turnstileWidgetId);
    setTurnstileMessage("Faça uma nova verificação.");
  }
}

async function getEdgeFunctionErrorMessage(error) {
  try {
    if (error?.context instanceof Response) {
      const payload = await error.context.clone().json();

      if (payload?.error) {
        return payload.error;
      }
    }
  } catch {
    // Usa a mensagem genérica abaixo.
  }

  return error?.message ||
    "Não foi possível registrar o pedido. Tente novamente.";
}

function loadTurnstileApi() {
  if (!String(STORE_CONFIG.turnstileSiteKey || "").trim()) {
    setTurnstileMessage(
      "A verificação de segurança ainda não foi configurada.",
      "error"
    );
    refreshWhatsappButton();
    return;
  }

  const script = document.createElement("script");

  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", initializeTurnstile);
  script.addEventListener("error", handleTurnstileUnavailable);

  document.head.append(script);
}

function getCurrentOrderSignature() {
  const cartItemsSignature = [...cart.entries()]
    .sort(([idA], [idB]) => idA.localeCompare(idB))
    .map(([id, quantity]) => ({
      id,
      quantity
    }));

  const delivery =
    document.querySelector('input[name="delivery"]:checked')
      ?.value || "";

  const payment =
    document.querySelector('input[name="payment"]:checked')
      ?.value || "";

  const name =
    document.querySelector("#customer-name")
      ?.value.trim() || "";

  const address =
    addressInput?.value.trim() || "";

  const notes =
    document.querySelector("#customer-notes")
      ?.value.trim() || "";

  return JSON.stringify({
    cart: cartItemsSignature,
    delivery,
    payment,
    name,
    address,
    notes
  });
}

function refreshWhatsappButton() {
  const quantity = [...cart.values()]
    .reduce((sum, value) => sum + value, 0);

  const sameRegisteredOrder =
    quantity > 0 &&
    lastRegisteredSignature === getCurrentOrderSignature();

  if (isSubmitting) {
    whatsappButton.disabled = true;
    whatsappButton.textContent = "Registrando pedido...";
    return;
  }

  if (quantity === 0) {
    whatsappButton.disabled = true;
    whatsappButton.textContent = "Pedir pelo WhatsApp";
    return;
  }

  if (sameRegisteredOrder) {
    whatsappButton.disabled = false;
    whatsappButton.textContent = "Abrir WhatsApp novamente";
    return;
  }

  if (!turnstileToken) {
    whatsappButton.disabled = true;
    whatsappButton.textContent = "Conclua a verificação";
    return;
  }

  whatsappButton.disabled = false;
  whatsappButton.textContent = "Pedir pelo WhatsApp";
}

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
      text: "ESGOTADO :(",
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
      text: "ACABANDO :O",
      className: "status-low-stock"
    };
  }

  return {
    text: "DISPONÍVEL :D",
    className: "status-available"
  };
}

function renderProducts() {
  grid.innerHTML = PRODUCTS.map(product => {
    const status = getProductStatus(product);
    const productId = escapeHtml(product.id);
    const productName = escapeHtml(product.name);

    return `
      <article class="product-card">
        <div class="product-image-wrap">
          <img
            class="product-image"
            src="${getSafeImageSource(product.image)}"
            alt="${productName}"
            loading="lazy"
          >

          <span class="status-pill ${status.className}">
            ${status.text}
          </span>
        </div>

        <div class="product-body">
          <div class="product-title-row">
            <h3>${productName}</h3>
            <span class="price">${BRL.format(product.price)}</span>
          </div>

          <p>${escapeHtml(product.description)}</p>

          <button
            class="add-button"
            type="button"
            data-add="${productId}"
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
  
  refreshWhatsappButton();

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

      const productId = escapeHtml(id);

      return `
        <div class="cart-item">
          <img src="${getSafeImageSource(product.image)}" alt="">

          <div>
            <h4>${escapeHtml(product.name)}</h4>
            <small>
              ${BRL.format(product.price * qty)}
            </small>
          </div>

          <div class="quantity">
            <button
              type="button"
              data-change="${productId}"
              data-delta="-1"
              aria-label="Remover uma unidade"
            >
              −
            </button>

            <strong>${qty}</strong>

            <button
  type="button"
              data-change="${productId}"
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

form.addEventListener("input", refreshWhatsappButton);
form.addEventListener("change", refreshWhatsappButton);

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!cart.size || isSubmitting) return;

  const currentSignature = getCurrentOrderSignature();

  /*
   * O pedido já foi registrado e nada foi alterado.
   * Apenas reabre a mesma mensagem no WhatsApp.
   */
  if (
    currentSignature === lastRegisteredSignature &&
    lastWhatsAppUrl
  ) {
    window.open(lastWhatsAppUrl, "_blank", "noopener");
    return;
  }

  if (!turnstileToken) {
    alert("Conclua a verificação de segurança para continuar.");
    return;
  }

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

  const payment = document
    .querySelector('input[name="payment"]:checked')
    .value;

  const address = addressInput.value.trim();

  const notes = document
    .querySelector("#customer-notes")
    .value
    .trim();

  const items = [...cart.entries()].map(([id, qty]) => ({
    slug: id,
    quantity: qty
  }));

  const submissionTurnstileToken = turnstileToken;
  turnstileToken = null;

  isSubmitting = true;
  refreshWhatsappButton();

  try {
    const functionName =
      STORE_CONFIG.orderFunctionName || "create-order";

    const { data, error } =
      await supabaseClient.functions.invoke(
        functionName,
        {
          body: {
            turnstileToken: submissionTurnstileToken,
            order: {
              p_customer_name: name,
              p_delivery_method: delivery,
              p_payment_method: payment,
              p_customer_address:
                delivery === "Entrega" ? address : "",
              p_notes: notes,
              p_items: items
            }
          }
        }
      );

    if (error) {
      throw new Error(
        await getEdgeFunctionErrorMessage(error)
      );
    }

    if (!data || data.error) {
      throw new Error(
        data?.error ||
        "A resposta do servidor foi inválida."
      );
    }

    const orderNumber = data.order_number;
    const subtotal = Number(data.subtotal);

    const lines = [
      `Olá! Gostaria de fazer um pedido na ${STORE_CONFIG.storeName} ${greetingEmojis}`,
      "",
      `*Pedido Mimo nº ${orderNumber}*`,
      "",
      "*Itens:*",

      ...[...cart.entries()].map(([id, qty]) => {
        const product = getProduct(id);
        const emoji = PRODUCT_EMOJIS[id] || "";

        return `${emoji} ${qty}x ${product.name} — ${BRL.format(
          product.price * qty
        )}`;
      }),

      "",
      `*Produtos:* ${BRL.format(subtotal)}`,
      `*Recebimento:* ${delivery}`,
      `*Pagamento:* ${payment}`,

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

      payment === "Pix"
        ? "Aguardando envio da chave Pix."
        : "Aguardando envio do link de pagamento.",

      delivery === "Entrega"
        ? `*Total parcial:* ${BRL.format(subtotal)} + frete`
        : `*Total:* ${BRL.format(subtotal)}`
    ].filter(Boolean);

    lastWhatsAppUrl =
      `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        lines.join("\n")
      )}`;

    lastRegisteredSignature = currentSignature;

    window.open(lastWhatsAppUrl, "_blank", "noopener");

  } catch (error) {
    console.error("Erro ao registrar pedido:", error);

    alert(
      error.message ||
      "Não foi possível registrar o pedido. Tente novamente."
    );
  } finally {
    resetTurnstile();
    isSubmitting = false;
    refreshWhatsappButton();
  }
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
loadTurnstileApi();
