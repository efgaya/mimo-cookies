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

let products = [];

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
  await loadProducts();
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
  await loadProducts();
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

verifyAdmin();
