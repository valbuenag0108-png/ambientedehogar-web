var firebaseConfig = null;

var categories = [];
var products = [];
var storeSettings = { whatsapp: "", storeName: "Ambiente de Hogar" };
var cart = {};
var searchTerm = "";

var gotCategories = false;
var gotProducts = false;

/* ---------- Firebase: arrancar solo si hay credenciales reales ---------- */

function isPlaceholderConfig() {
  return !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("TU_") === 0;
}

import("./firebase-config.js").then(function (mod) {
  firebaseConfig = mod.firebaseConfig;
  if (isPlaceholderConfig()) {
    document.getElementById("configBanner").hidden = false;
    document.getElementById("catalogStatus").textContent =
      "El catálogo se activa en cuanto conectes tu proyecto de Firebase (ver el aviso de arriba).";
    return;
  }
  initFirebase();
}).catch(function (err) {
  console.error(err);
  document.getElementById("configBanner").hidden = false;
  document.getElementById("catalogStatus").textContent =
    "No se pudo leer firebase-config.js. Revisa que solo tenga el bloque export const firebaseConfig = { ... };";
});

function initFirebase() {
  import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js").then(function (appMod) {
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js").then(function (fsMod) {
      var app = appMod.initializeApp(firebaseConfig);
      var db = fsMod.getFirestore(app);

      fsMod.onSnapshot(fsMod.query(fsMod.collection(db, "categories"), fsMod.orderBy("order", "asc")), function (snap) {
        categories = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        gotCategories = true;
        render();
      }, showError);

      fsMod.onSnapshot(fsMod.collection(db, "products"), function (snap) {
        products = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        gotProducts = true;
        render();
      }, showError);

      fsMod.onSnapshot(fsMod.doc(db, "settings", "store"), function (snap) {
        if (snap.exists()) {
          var data = snap.data();
          storeSettings.whatsapp = data.whatsapp || "";
          storeSettings.storeName = data.storeName || "Ambiente de Hogar";
        }
      });
    });
  }).catch(showError);
}

function showError(err) {
  var status = document.getElementById("catalogStatus");
  if (status) {
    status.textContent = "No se pudo conectar con el catálogo. Revisa tu conexión o la configuración de Firebase (ver README).";
  }
  console.error(err);
}

/* ---------- Carrito local ---------- */

function loadCart() {
  try {
    var saved = localStorage.getItem("adh_cart");
    if (saved) cart = JSON.parse(saved);
  } catch (e) { cart = {}; }
}

function saveCart() {
  try { localStorage.setItem("adh_cart", JSON.stringify(cart)); } catch (e) {}
}

/* ---------- Utilidades ---------- */

function money(p) { return (p.currency || "$") + p.price; }

function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* ---------- Render principal ---------- */

function render() {
  if (!gotCategories || !gotProducts) return;
  renderCatShowcase();
  renderNav();
  renderCatalog();
  renderCart();
}

function renderCatShowcase() {
  var wrap = document.getElementById("catShowcase");
  wrap.innerHTML = "";
  categories.forEach(function (cat) {
    var items = products.filter(function (p) { return p.categoryId === cat.id; });
    if (items.length === 0) return;

    var withPhoto = items.find(function (p) { return p.image; });
    var card = document.createElement("a");
    card.href = "#cat-" + cat.id;
    card.className = "cat-card";
    card.addEventListener("click", function () { clearSearch(); });

    var photo = document.createElement("div");
    photo.className = "cat-card-photo";
    if (withPhoto) {
      var img = document.createElement("img");
      img.src = withPhoto.image;
      img.alt = "";
      photo.appendChild(img);
    } else {
      photo.textContent = cat.name.charAt(0);
    }
    card.appendChild(photo);

    var label = document.createElement("span");
    label.className = "cat-card-name";
    label.textContent = cat.name;
    card.appendChild(label);

    var count = document.createElement("span");
    count.className = "cat-card-count";
    count.textContent = items.length + (items.length === 1 ? " producto" : " productos");
    card.appendChild(count);

    wrap.appendChild(card);
  });
}

function renderNav() {
  var nav = document.getElementById("catNav");
  nav.innerHTML = "";
  categories.forEach(function (cat) {
    var hasProducts = products.some(function (p) { return p.categoryId === cat.id; });
    if (!hasProducts) return;
    var a = document.createElement("a");
    a.href = "#cat-" + cat.id;
    a.textContent = cat.name;
    nav.appendChild(a);
  });
}

function renderCatalog() {
  var main = document.getElementById("catalog");
  main.innerHTML = "";

  if (categories.length === 0 || products.length === 0) {
    var msg = document.createElement("p");
    msg.className = "catalog-status";
    msg.textContent = "Todavía no hay productos cargados. Se irán mostrando aquí en cuanto se agreguen desde el panel.";
    main.appendChild(msg);
    return;
  }

  if (searchTerm) {
    renderSearchResults(main);
    return;
  }

  categories.forEach(function (cat) {
    var items = products.filter(function (p) { return p.categoryId === cat.id; });
    if (items.length === 0) return;

    var section = document.createElement("section");
    section.className = "cat-section";
    section.id = "cat-" + cat.id;

    var h2 = document.createElement("h2");
    h2.textContent = cat.name;
    section.appendChild(h2);

    if (cat.desc) {
      var desc = document.createElement("p");
      desc.className = "cat-desc";
      desc.textContent = cat.desc;
      section.appendChild(desc);
    }

    var grid = document.createElement("div");
    grid.className = "product-grid";
    items.forEach(function (p) { grid.appendChild(buildCard(p)); });
    section.appendChild(grid);

    main.appendChild(section);
  });
}

function renderSearchResults(main) {
  var term = normalize(searchTerm);
  var matches = products.filter(function (p) { return normalize(p.name).indexOf(term) !== -1; });

  var section = document.createElement("section");
  section.className = "cat-section";

  var h2 = document.createElement("h2");
  h2.textContent = matches.length > 0
    ? "Resultados para \u201c" + searchTerm + "\u201d"
    : "Sin resultados para \u201c" + searchTerm + "\u201d";
  section.appendChild(h2);

  if (matches.length === 0) {
    var empty = document.createElement("p");
    empty.className = "cat-desc";
    empty.textContent = "No encontramos nada con ese nombre. Prueba con otra palabra, o mira las categorías arriba.";
    section.appendChild(empty);
  } else {
    var grid = document.createElement("div");
    grid.className = "product-grid";
    matches.forEach(function (p) { grid.appendChild(buildCard(p)); });
    section.appendChild(grid);
  }

  main.appendChild(section);
}

function buildCard(p) {
  var card = document.createElement("article");
  card.className = "product-card";

  var photo = document.createElement("div");
  photo.className = "product-photo";
  if (p.image) {
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    photo.appendChild(img);
    photo.classList.add("zoomable");
    photo.setAttribute("role", "button");
    photo.setAttribute("tabindex", "0");
    photo.setAttribute("aria-label", "Ampliar foto de " + p.name);
    photo.addEventListener("click", function () { openLightbox(p); });
    photo.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(p); }
    });
  } else {
    photo.textContent = p.name;
  }
  if (p.badge) {
    var badge = document.createElement("span");
    badge.className = "product-badge";
    badge.textContent = p.badge;
    photo.appendChild(badge);
  }
  card.appendChild(photo);

  var body = document.createElement("div");
  body.className = "product-body";

  var name = document.createElement("p");
  name.className = "product-name";
  name.textContent = p.name;
  body.appendChild(name);

  var price = document.createElement("p");
  price.className = "product-price";
  price.textContent = money(p);
  body.appendChild(price);

  if (p.desc) {
    var desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = p.desc;
    body.appendChild(desc);
  }

  var btn = document.createElement("button");
  btn.className = "product-add";
  btn.textContent = "Agregar";
  btn.addEventListener("click", function () {
    addToCart(p.id);
    btn.textContent = "Agregado ✓";
    btn.classList.add("added");
    setTimeout(function () {
      btn.textContent = "Agregar";
      btn.classList.remove("added");
    }, 900);
  });
  body.appendChild(btn);

  card.appendChild(body);
  return card;
}

/* ---------- Buscador ---------- */

function setupSearch() {
  var input = document.getElementById("searchInput");
  var clearBtn = document.getElementById("searchClear");

  input.addEventListener("input", function () {
    searchTerm = input.value.trim();
    clearBtn.hidden = searchTerm.length === 0;
    renderCatalog();
    if (searchTerm) {
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    clearSearch();
    input.focus();
  });
}

function clearSearch() {
  searchTerm = "";
  document.getElementById("searchClear").hidden = true;
  var input = document.getElementById("searchInput");
  if (input) input.value = "";
  renderCatalog();
}

/* ---------- Visor de imagen ampliada ---------- */

function openLightbox(p) {
  document.getElementById("lightboxImg").src = p.image;
  document.getElementById("lightboxImg").alt = p.name;
  var caption = p.name + " — " + money(p);
  if (p.desc) caption += "\n" + p.desc;
  document.getElementById("lightboxCaption").textContent = caption;
  document.getElementById("lightbox").hidden = false;
}

function closeLightbox() {
  document.getElementById("lightbox").hidden = true;
  document.getElementById("lightboxImg").src = "";
}

function setupLightbox() {
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightbox").addEventListener("click", function (e) {
    if (e.target.id === "lightbox") closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });
}

/* ---------- Carrito: acciones ---------- */

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart();
}

function cartTotalCount() {
  return Object.keys(cart).reduce(function (sum, id) { return sum + cart[id]; }, 0);
}

function renderCart() {
  var countEl = document.getElementById("cartCount");
  if (countEl) countEl.textContent = cartTotalCount();

  var itemsEl = document.getElementById("cartItems");
  if (!itemsEl) return;
  itemsEl.innerHTML = "";

  var ids = Object.keys(cart).filter(function (id) {
    return products.some(function (p) { return p.id === id; });
  });

  if (ids.length === 0) {
    var empty = document.createElement("p");
    empty.className = "cart-empty";
    empty.textContent = "Todavía no agregaste nada. Explora el catálogo y toca \"Agregar\" en lo que te guste.";
    itemsEl.appendChild(empty);
    document.getElementById("checkoutBtn").disabled = true;
    return;
  }

  document.getElementById("checkoutBtn").disabled = false;

  ids.forEach(function (id) {
    var p = products.find(function (x) { return x.id === id; });
    var qty = cart[id];

    var line = document.createElement("div");
    line.className = "cart-line";

    var info = document.createElement("div");
    info.className = "cart-line-info";
    var nm = document.createElement("p");
    nm.className = "cart-line-name";
    nm.textContent = p.name;
    var pr = document.createElement("p");
    pr.className = "cart-line-price";
    pr.textContent = money(p) + " c/u";
    info.appendChild(nm);
    info.appendChild(pr);

    var qtyBox = document.createElement("div");
    qtyBox.className = "cart-qty";
    var minus = document.createElement("button");
    minus.textContent = "–";
    minus.addEventListener("click", function () { changeQty(id, -1); });
    var qtyLabel = document.createElement("span");
    qtyLabel.textContent = qty;
    var plus = document.createElement("button");
    plus.textContent = "+";
    plus.addEventListener("click", function () { changeQty(id, 1); });
    qtyBox.appendChild(minus);
    qtyBox.appendChild(qtyLabel);
    qtyBox.appendChild(plus);

    line.appendChild(info);
    line.appendChild(qtyBox);
    itemsEl.appendChild(line);
  });
}

function buildWhatsAppMessage() {
  var name = document.getElementById("customerName").value.trim();
  var lines = [];
  lines.push("¡Hola! Soy " + (name || "un cliente") + " y quiero hacer este pedido:");
  lines.push("");

  var total = 0;
  var currency = "$";
  Object.keys(cart).forEach(function (id) {
    var p = products.find(function (x) { return x.id === id; });
    if (!p) return;
    var qty = cart[id];
    var subtotal = p.price * qty;
    total += subtotal;
    currency = p.currency || currency;
    lines.push("• " + p.name + " x" + qty + " — " + (p.currency || "$") + subtotal);
  });

  lines.push("");
  lines.push("Total estimado: " + currency + total);

  return lines.join("\n");
}

function openCart() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
}

function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
}

function setupCartNav() {
  document.getElementById("cartToggle").addEventListener("click", openCart);
  document.getElementById("cartClose").addEventListener("click", closeCart);
  document.getElementById("cartOverlay").addEventListener("click", closeCart);

  document.getElementById("checkoutBtn").addEventListener("click", function () {
    if (!storeSettings.whatsapp) {
      alert("Falta configurar el número de WhatsApp de la tienda en el panel de administración.");
      return;
    }
    var msg = encodeURIComponent(buildWhatsAppMessage());
    var url = "https://wa.me/" + storeSettings.whatsapp + "?text=" + msg;
    window.open(url, "_blank");
  });
}

function setupActiveNav() {
  window.addEventListener("scroll", function () {
    var links = Array.prototype.slice.call(document.querySelectorAll(".cat-nav a"));
    if (links.length === 0) return;
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var pos = window.scrollY + 150;
    var current = null;
    sections.forEach(function (s) { if (s && s.offsetTop <= pos) current = s; });
    links.forEach(function (a) {
      a.classList.toggle("active", !!current && a.getAttribute("href") === "#" + current.id);
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadCart();
  setupSearch();
  setupCartNav();
  setupActiveNav();
  setupLightbox();
});
