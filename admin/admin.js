const ADMIN_USER_ID = "dcf88d88-cb5e-4378-89e1-ba1020cb20e8";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const loginSection = document.querySelector("#login-section");
const dashboard = document.querySelector("#dashboard");

const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginMessage = document.querySelector("#login-message");

const logoutButton = document.querySelector("#logout-button");
const adminEmail = document.querySelector("#admin-email");

const productForm = document.querySelector("#product-form");
const productId = document.querySelector("#product-id");
const productName = document.querySelector("#product-name");
const productSlug = document.querySelector("#product-slug");
const productPrice = document.querySelector("#product-price");
const productDescription = document.querySelector("#product-description");
const productImage = document.querySelector("#product-image");
const productStock = document.querySelector("#product-stock");
const productOrder = document.querySelector("#product-order");
const productAvailable = document.querySelector("#product-available");

const formTitle = document.querySelector("#form-title");
const formEyebrow = document.querySelector("#form-eyebrow");
const productMessage = document.querySelector("#product-message");
const saveProductButton = document.querySelector("#save-product-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");

const productsList = document.querySelector("#products-list");
const refreshButton = document.querySelector("#refresh-button");

const ordersList = document.querySelector("#orders-list");
const refreshOrdersButton =
  document.querySelector("#refresh-orders-button");

let products = [];
let orders = [];

function setMessage(element, text = "", type = "") {
  element.textContent = text;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function showLogin() {
  loginSection.hidden = false;
  dashboard.hidden = true;
}

function showDashboard(user) {
  loginSection.hidden = true;
  dashboard.hidden = false;
  adminEmail.textContent = user.email || "";
}

async function verifyAdmin() {
  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    showLogin();
    return;
  }

  if (user.id !== ADMIN_USER_ID) {
    await supabaseClient.auth.signOut();
    setMessage(
      loginMessage,
      "Esta conta não possui acesso administrativo.",
      "error"
    );
    showLogin();
    return;
  }

  showDashboard(user);

  await Promise.all([
    loadProducts(),
    loadOrders()
]);
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  setMessage(loginMessage);
  const button = loginForm.querySelector('button[type="submit"]');

  button.disabled = true;
  button.textContent = "Entrando...";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value
    });

  button.disabled = false;
  button.textContent = "Entrar";

  if (error) {
    setMessage(
      loginMessage,
      "E-mail ou senha incorretos.",
      "error"
    );
    return;
  }

  if (!data.user || data.user.id !== ADMIN_USER_ID) {
    await supabaseClient.auth.signOut();

    setMessage(
      loginMessage,
      "Esta conta não possui acesso administrativo.",
      "error"
    );
    return;
  }

  loginPassword.value = "";
  showDashboard(data.user);

  await Promise.all([
    loadProducts(),
    loadOrders()
]);
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  productForm.reset();
  resetProductForm();
  showLogin();
});

productName.addEventListener("input", () => {
  if (!productId.value) {
    productSlug.value = slugify(productName.value);
  }
});

async function loadProducts() {
  productsList.innerHTML = '<p class="muted">Carregando produtos...</p>';

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
    productsList.innerHTML = `
      <p class="message error">
        Não foi possível carregar os produtos.
      </p>
    `;

    console.error(error);
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  if (!products.length) {
    productsList.innerHTML = `
      <p class="muted">
        Nenhum produto cadastrado.
      </p>
    `;
    return;
  }

  productsList.innerHTML = products.map(product => `
    <article
      class="product-row ${product.available ? "" : "status-off"}"
    >
      <img
        src="../${product.image_url}"
        alt="${product.name}"
      >

      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>

        <div class="product-meta">
          ${BRL.format(Number(product.price))}
          · ordem ${product.display_order}
          · ${product.available ? "disponível" : "esgotado"}
          ${product.stock === null ? "" : ` · estoque ${product.stock}`}
        </div>
      </div>

      <div class="product-actions">
        <button
          type="button"
          data-edit="${product.id}"
        >
          Editar
        </button>

        <button
          class="delete-button"
          type="button"
          data-delete="${product.id}"
        >
          Excluir
        </button>
      </div>
    </article>
  `).join("");
}

const ORDER_STATUS_LABELS = {
  new: "Novo",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado"
};

const PAYMENT_STATUS_LABELS = {
  pending: "Pendente",
  paid: "Pago",
  refunded: "Estornado",
  cancelled: "Cancelado"
};

function formatDate(dateValue) {
  if (!dateValue) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(dateValue));
}

async function loadOrders() {
  ordersList.innerHTML =
    '<p class="muted">Carregando pedidos...</p>';

  const { data, error } = await supabaseClient
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      delivery_method,
      customer_address,
      payment_method,
      payment_status,
      notes,
      subtotal,
      delivery_fee,
      total,
      status,
      created_at,
      confirmed_at,
      cancelled_at,
      order_items (
        id,
        product_slug,
        product_name,
        unit_price,
        quantity,
        line_total
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    ordersList.innerHTML = `
      <p class="message error">
        Não foi possível carregar os pedidos.
      </p>
    `;

    return;
  }

  orders = data || [];
  renderOrders();
}

function renderOrders() {
  if (!orders.length) {
    ordersList.innerHTML = `
      <p class="muted">
        Nenhum pedido registrado.
      </p>
    `;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const items = order.order_items || [];

    const itemsHtml = items.map(item => `
      <div class="order-item-line">
        <span>
          ${item.quantity}x ${item.product_name}
        </span>

        <strong>
          ${BRL.format(Number(item.line_total))}
        </strong>
      </div>
    `).join("");

    const canConfirm = order.status === "new";

    const canCancel = ![
      "cancelled",
      "completed"
    ].includes(order.status);

    return `
      <article class="order-card ${order.status}">
        <div class="order-header">
          <div>
            <h3>
              Pedido nº ${order.order_number}
              — ${order.customer_name}
            </h3>

            <p>
              Registrado em ${formatDate(order.created_at)}
            </p>
          </div>

          <span class="order-status ${order.status}">
            ${ORDER_STATUS_LABELS[order.status] || order.status}
          </span>
        </div>

        <div class="order-details">
          <div class="order-detail">
            <small>Recebimento</small>
            <strong>${order.delivery_method}</strong>
          </div>

          <div class="order-detail">
            <small>Pagamento</small>
            <strong>${order.payment_method}</strong>
          </div>

          <div class="order-detail">
            <small>Situação do pagamento</small>
            <strong>
              ${PAYMENT_STATUS_LABELS[order.payment_status]
                || order.payment_status}
            </strong>
          </div>

          <div class="order-detail">
            <small>Total dos produtos</small>
            <strong>${BRL.format(Number(order.subtotal))}</strong>
          </div>
        </div>

        ${
          order.delivery_method === "Entrega"
            ? `
              <div class="order-notes">
                <strong>Endereço:</strong>
                ${order.customer_address || "Não informado"}
              </div>
            `
            : ""
        }

        ${
          order.notes
            ? `
              <div class="order-notes">
                <strong>Observações:</strong>
                ${order.notes}
              </div>
            `
            : ""
        }

        <div class="order-items">
          ${itemsHtml}
        </div>

        ${
          canConfirm || canCancel
            ? `
              <div class="order-actions">
                ${
                  canConfirm
                    ? `
                      <button
                        class="confirm-order-button"
                        type="button"
                        data-confirm-order="${order.id}"
                      >
                        Confirmar e baixar estoque
                      </button>
                    `
                    : ""
                }

                ${
                  canCancel
                    ? `
                      <button
                        class="cancel-order-button"
                        type="button"
                        data-cancel-order="${order.id}"
                      >
                        Cancelar pedido
                      </button>
                    `
                    : ""
                }
              </div>
            `
            : ""
        }
      </article>
    `;
  }).join("");
}

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  setMessage(productMessage);

  const values = {
    slug: slugify(productSlug.value),
    name: productName.value.trim(),
    price: Number(productPrice.value),
    description: productDescription.value.trim(),
    image_url: productImage.value.trim(),
    available: productAvailable.checked,
    stock:
      productStock.value === ""
        ? null
        : Number(productStock.value),
    display_order: Number(productOrder.value)
  };

  if (!values.slug || !values.name || !values.image_url) {
    setMessage(
      productMessage,
      "Preencha todos os campos obrigatórios.",
      "error"
    );
    return;
  }

  saveProductButton.disabled = true;
  saveProductButton.textContent = "Salvando...";

  let error;

  if (productId.value) {
    ({ error } = await supabaseClient
      .from("products")
      .update(values)
      .eq("id", productId.value));
  } else {
    ({ error } = await supabaseClient
      .from("products")
      .insert(values));
  }

  saveProductButton.disabled = false;
  saveProductButton.textContent = "Salvar produto";

  if (error) {
    console.error(error);

    const message =
      error.code === "23505"
        ? "Já existe um produto com esse identificador."
        : `Não foi possível salvar: ${error.message}`;

    setMessage(productMessage, message, "error");
    return;
  }

  setMessage(
    productMessage,
    productId.value
      ? "Produto atualizado com sucesso."
      : "Produto adicionado com sucesso.",
    "success"
  );

  resetProductForm();
  await loadProducts();
});

productsList.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    startEditing(editButton.dataset.edit);
    return;
  }

  if (deleteButton) {
    await deleteProduct(deleteButton.dataset.delete);
  }
});

function startEditing(id) {
  const product = products.find(item => item.id === id);

  if (!product) return;

  productId.value = product.id;
  productName.value = product.name;
  productSlug.value = product.slug;
  productPrice.value = Number(product.price);
  productDescription.value = product.description;
  productImage.value = product.image_url;
  productStock.value =
    product.stock === null ? "" : product.stock;
  productOrder.value = product.display_order;
  productAvailable.checked = product.available;

  formEyebrow.textContent = "Editando sabor";
  formTitle.textContent = product.name;
  cancelEditButton.hidden = false;

  setMessage(productMessage);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function deleteProduct(id) {
  const product = products.find(item => item.id === id);

  if (!product) return;

  const confirmed = window.confirm(
    `Excluir o sabor "${product.name}"? Esta ação não pode ser desfeita.`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);

    window.alert(
      `Não foi possível excluir: ${error.message}`
    );

    return;
  }

  if (productId.value === id) {
    resetProductForm();
  }

  await loadProducts();
}

function resetProductForm() {
  productForm.reset();

  productId.value = "";
  productOrder.value = "0";
  productAvailable.checked = true;

  formEyebrow.textContent = "Novo sabor";
  formTitle.textContent = "Adicionar produto";
  cancelEditButton.hidden = true;
}

cancelEditButton.addEventListener("click", () => {
  resetProductForm();
  setMessage(productMessage);
});

refreshButton.addEventListener("click", loadProducts);

supabaseClient.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT") {
    showLogin();
  }
});

ordersList.addEventListener("click", async event => {
  const confirmButton =
    event.target.closest("[data-confirm-order]");

  const cancelButton =
    event.target.closest("[data-cancel-order]");

  if (confirmButton) {
    await confirmOrder(confirmButton.dataset.confirmOrder);
    return;
  }

  if (cancelButton) {
    await cancelOrder(cancelButton.dataset.cancelOrder);
  }
});

async function confirmOrder(orderId) {
  const order = orders.find(item => item.id === orderId);

  if (!order) return;

  const confirmed = window.confirm(
    `Confirmar o pedido nº ${order.order_number} e baixar o estoque?`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient.rpc(
    "confirm_order",
    {
      p_order_id: orderId
    }
  );

  if (error) {
    console.error(error);
    window.alert(error.message);
    return;
  }

  await Promise.all([
    loadOrders(),
    loadProducts()
  ]);
}

async function cancelOrder(orderId) {
  const order = orders.find(item => item.id === orderId);

  if (!order) return;

  const confirmed = window.confirm(
    `Cancelar o pedido nº ${order.order_number}?`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient.rpc(
    "cancel_order",
    {
      p_order_id: orderId
    }
  );

  if (error) {
    console.error(error);
    window.alert(error.message);
    return;
  }

  await Promise.all([
    loadOrders(),
    loadProducts()
  ]);
}

refreshOrdersButton.addEventListener("click", loadOrders);

verifyAdmin();
