const ADMIN_USER_ID = "dcf88d88-cb5e-4378-89e1-ba1020cb20e8";
const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const PRODUCT_IMAGE_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

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
const productImageFile = document.querySelector("#product-image-file");
const productImagePreview = document.querySelector("#product-image-preview");
const productImagePreviewWrap = document.querySelector(
  "#product-image-preview-wrap"
);
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

const settingsForm = document.querySelector("#settings-form");
const storeIsPaused = document.querySelector("#store-is-paused");
const storeReturnTime = document.querySelector("#store-return-time");
const storePauseMessage = document.querySelector("#store-pause-message");
const saveSettingsButton = document.querySelector("#save-settings-button");
const settingsMessage = document.querySelector("#settings-message");
const settingsStatus = document.querySelector("#settings-status");

const tabButtons =
  document.querySelectorAll("[data-tab]");

const tabPanels =
  document.querySelectorAll("[data-panel]");

let products = [];
let orders = [];
let productImagePreviewUrl = "";
let isSavingProduct = false;
let isSavingSettings = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function getSafeImageSource(value, escapeForHtml = true) {
  const source = String(value ?? "").trim();

  if (!source) return "";

  const absoluteHttpUrl = /^https?:\/\//i;
  const explicitProtocol = /^[a-z][a-z\d+.-]*:/i;

  if (absoluteHttpUrl.test(source)) {
    try {
      const url = new URL(source);

      if (!["http:", "https:"].includes(url.protocol)) return "";

      return escapeForHtml ? escapeHtml(source) : source;
    } catch {
      return "";
    }
  }

  if (
    explicitProtocol.test(source) ||
    source.startsWith("/")
  ) {
    return "";
  }

  try {
    new URL(source, "https://local.invalid/");

    const relativeSource = source.startsWith("../")
      ? source
      : `../${source.replace(/^\.\/+/, "")}`;

    return escapeForHtml
      ? escapeHtml(relativeSource)
      : relativeSource;
  } catch {
    return "";
  }
}

function clearLocalImagePreview() {
  if (productImagePreviewUrl) {
    URL.revokeObjectURL(productImagePreviewUrl);
    productImagePreviewUrl = "";
  }
}

function showProductImagePreview(source = "", isLocal = false) {
  clearLocalImagePreview();

  const safeSource = isLocal
    ? source
    : getSafeImageSource(source, false);

  if (!safeSource) {
    productImagePreview.removeAttribute("src");
    productImagePreviewWrap.hidden = true;
    return;
  }

  if (isLocal) {
    productImagePreviewUrl = source;
  }

  productImagePreview.src = safeSource;
  productImagePreviewWrap.hidden = false;
}

function validateProductImage(file) {
  if (!file) return "";

  if (!Object.hasOwn(PRODUCT_IMAGE_EXTENSIONS, file.type)) {
    return "Escolha uma imagem JPEG, PNG ou WebP.";
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return "A imagem deve ter no máximo 5 MB.";
  }

  return "";
}

function setProductFormSaving(saving, status = "Salvando...") {
  isSavingProduct = saving;

  Array.from(productForm.elements).forEach(element => {
    element.disabled = saving;
  });

  cancelEditButton.disabled = saving;
  logoutButton.disabled = saving;
  saveProductButton.textContent = saving
    ? status
    : "Salvar produto";
}

async function uploadProductImage(file) {
  const validationError = validateProductImage(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const {
    data: { user },
    error: userError
  } = await supabaseClient.auth.getUser();

  if (userError || !user || user.id !== ADMIN_USER_ID) {
    throw new Error(
      "Sua sessão administrativa expirou. Entre novamente para enviar a imagem."
    );
  }

  const extension = PRODUCT_IMAGE_EXTENSIONS[file.type];
  const objectPath = `products/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(
      `Não foi possível enviar a imagem: ${uploadError.message}`
    );
  }

  const { data } = supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(objectPath);

  if (!data?.publicUrl) {
    throw new Error(
      "A imagem foi enviada, mas não foi possível obter a URL pública."
    );
  }

  return data.publicUrl;
}

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

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = number => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function renderSettingsStatus(isPaused) {
  settingsStatus.textContent = isPaused
    ? "Loja em pausa"
    : "Loja funcionando";
  settingsStatus.classList.toggle("paused", isPaused);
}

function setSettingsSaving(saving) {
  isSavingSettings = saving;

  Array.from(settingsForm.elements).forEach(element => {
    element.disabled = saving;
  });

  saveSettingsButton.textContent = saving
    ? "Salvando..."
    : "Salvar funcionamento";
}

async function loadStoreSettings() {
  setMessage(settingsMessage);

  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("is_paused, return_time, pause_message")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("A configuração da loja ainda não foi criada.");
    }

    storeIsPaused.checked = data.is_paused === true;
    storeReturnTime.value = toLocalDateTimeInput(data.return_time);
    storePauseMessage.value = data.pause_message || "";
    renderSettingsStatus(storeIsPaused.checked);
  } catch (error) {
    console.error(error);
    settingsStatus.textContent = "Status indisponível";
    settingsStatus.classList.remove("paused");
    setMessage(
      settingsMessage,
      "Não foi possível carregar o funcionamento. Confirme se a migration foi aplicada no Supabase.",
      "error"
    );
  }
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
    loadOrders(),
    loadStoreSettings()
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
    loadOrders(),
    loadStoreSettings()
]);
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  productForm.reset();
  resetProductForm();
  settingsForm.reset();
  settingsStatus.textContent = "Carregando...";
  settingsStatus.classList.remove("paused");
  showLogin();
});

settingsForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSavingSettings) return;

  setMessage(settingsMessage);

  let returnTime = null;

  if (storeReturnTime.value) {
    const parsedReturnTime = new Date(storeReturnTime.value);

    if (Number.isNaN(parsedReturnTime.getTime())) {
      setMessage(
        settingsMessage,
        "Informe um horário de retorno válido.",
        "error"
      );
      return;
    }

    returnTime = parsedReturnTime.toISOString();
  }

  const values = {
    is_paused: storeIsPaused.checked,
    return_time: returnTime,
    pause_message: storePauseMessage.value.trim() || null
  };

  setSettingsSaving(true);

  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .update(values)
      .eq("id", 1)
      .select("is_paused, return_time, pause_message")
      .single();

    if (error) throw error;

    storeIsPaused.checked = data.is_paused === true;
    storeReturnTime.value = toLocalDateTimeInput(data.return_time);
    storePauseMessage.value = data.pause_message || "";
    renderSettingsStatus(storeIsPaused.checked);
    setMessage(
      settingsMessage,
      "Funcionamento atualizado com sucesso.",
      "success"
    );
  } catch (error) {
    console.error(error);
    setMessage(
      settingsMessage,
      `Não foi possível salvar o funcionamento: ${error.message}`,
      "error"
    );
  } finally {
    setSettingsSaving(false);
  }
});

productName.addEventListener("input", () => {
  if (!productId.value) {
    productSlug.value = slugify(productName.value);
  }
});

productImage.addEventListener("input", () => {
  if (!productImageFile.files?.length) {
    showProductImagePreview(productImage.value.trim());
  }
});

productImageFile.addEventListener("change", () => {
  setMessage(productMessage);

  const [file] = productImageFile.files;

  if (!file) {
    showProductImagePreview(productImage.value.trim());
    return;
  }

  const validationError = validateProductImage(file);

  if (validationError) {
    productImageFile.value = "";
    showProductImagePreview(productImage.value.trim());
    setMessage(productMessage, validationError, "error");
    return;
  }

  showProductImagePreview(URL.createObjectURL(file), true);
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
        src="${getSafeImageSource(product.image_url)}"
        alt="${escapeHtml(product.name)}"
      >

      <div class="product-info">
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>

        <div class="product-meta">
          ${BRL.format(Number(product.price))}
          · ordem ${escapeHtml(product.display_order)}
          · ${product.available ? "disponível" : "esgotado"}
          ${product.stock === null ? "" : ` · estoque ${escapeHtml(product.stock)}`}
        </div>
      </div>

      <div class="product-actions">
        <button
          type="button"
          data-edit="${escapeHtml(product.id)}"
        >
          Editar
        </button>

        <button
          class="delete-button"
          type="button"
          data-delete="${escapeHtml(product.id)}"
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
    const orderId = escapeHtml(order.id);
    const orderStatus = Object.hasOwn(
      ORDER_STATUS_LABELS,
      order.status
    ) ? order.status : "unknown";

    const itemsHtml = items.map(item => `
      <div class="order-item-line">
        <span>
          ${escapeHtml(item.quantity)}x ${escapeHtml(item.product_name)}
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
      <article class="order-card ${orderStatus}">
        <div class="order-header">
          <div>
            <h3>
              Pedido nº ${escapeHtml(order.order_number)}
              — ${escapeHtml(order.customer_name)}
            </h3>

            <p>
              Registrado em ${escapeHtml(formatDate(order.created_at))}
            </p>
          </div>

          <span class="order-status ${orderStatus}">
            ${escapeHtml(ORDER_STATUS_LABELS[order.status] || order.status)}
          </span>
        </div>

        <div class="order-details">
          <div class="order-detail">
            <small>Recebimento</small>
            <strong>${escapeHtml(order.delivery_method)}</strong>
          </div>

          <div class="order-detail">
            <small>Pagamento</small>
            <strong>${escapeHtml(order.payment_method)}</strong>
          </div>

          <div class="order-detail">
            <small>Situação do pagamento</small>
            <strong>
              ${escapeHtml(
                PAYMENT_STATUS_LABELS[order.payment_status]
                  || order.payment_status
              )}
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
                ${escapeHtml(order.customer_address || "Não informado")}
              </div>
            `
            : ""
        }

        ${
          order.notes
            ? `
              <div class="order-notes">
                <strong>Observações:</strong>
                ${escapeHtml(order.notes)}
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
                        data-confirm-order="${orderId}"
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
                        data-cancel-order="${orderId}"
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

  if (isSavingProduct) return;

  setMessage(productMessage);

  const [selectedImage] = productImageFile.files;
  const imageValidationError = validateProductImage(selectedImage);
  const editingProductId = productId.value;

  if (imageValidationError) {
    setMessage(productMessage, imageValidationError, "error");
    return;
  }

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

  if (!values.slug || !values.name || (!values.image_url && !selectedImage)) {
    setMessage(
      productMessage,
      "Preencha os campos obrigatórios e informe ou escolha uma imagem.",
      "error"
    );
    return;
  }

  setProductFormSaving(
    true,
    selectedImage ? "Enviando imagem..." : "Salvando..."
  );

  if (selectedImage) {
    setMessage(productMessage, "Enviando imagem...", "loading");

    try {
      values.image_url = await uploadProductImage(selectedImage);
      productImage.value = values.image_url;
      productImageFile.value = "";
      showProductImagePreview(values.image_url);
    } catch (error) {
      console.error(error);
      setProductFormSaving(false);
      setMessage(
        productMessage,
        error.message || "Não foi possível enviar a imagem.",
        "error"
      );
      return;
    }

    saveProductButton.textContent = "Salvando produto...";
    setMessage(
      productMessage,
      "Imagem enviada. Salvando produto...",
      "loading"
    );
  }

  let error;

  try {
    if (editingProductId) {
      ({ error } = await supabaseClient
        .from("products")
        .update(values)
        .eq("id", editingProductId));
    } else {
      ({ error } = await supabaseClient
        .from("products")
        .insert(values));
    }
  } catch (saveError) {
    error = saveError;
  }

  setProductFormSaving(false);

  if (error) {
    console.error(error);

    let message = `Não foi possível salvar: ${error.message}`;

    if (error.code === "23505") {
      message = "Já existe um produto com esse identificador.";
    } else if (selectedImage) {
      message =
        `A imagem foi enviada, mas não foi possível salvar o produto: ${error.message}. `
        + "Tente salvar novamente.";
    }

    setMessage(productMessage, message, "error");
    return;
  }

  setMessage(
    productMessage,
    editingProductId
      ? "Produto atualizado com sucesso."
      : "Produto adicionado com sucesso.",
    "success"
  );

  resetProductForm();
  await loadProducts();
});

productsList.addEventListener("click", async event => {
  if (isSavingProduct) return;

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
  productImageFile.value = "";
  showProductImagePreview(product.image_url);
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

  setProductFormSaving(false);
  showProductImagePreview();

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

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const selectedTab = button.dataset.tab;

    tabButtons.forEach(tabButton => {
      const isSelected =
        tabButton.dataset.tab === selectedTab;

      tabButton.classList.toggle("active", isSelected);
      tabButton.setAttribute(
        "aria-selected",
        String(isSelected)
      );
    });

    tabPanels.forEach(panelElement => {
      const isSelected =
        panelElement.dataset.panel === selectedTab;

      panelElement.hidden = !isSelected;

      panelElement.classList.toggle(
        "active",
        isSelected
      );
    });

    if (selectedTab === "orders") {
      loadOrders();
    } else if (selectedTab === "settings") {
      loadStoreSettings();
    }
  });
});

verifyAdmin();
