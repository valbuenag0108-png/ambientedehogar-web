var firebaseConfig = null;
window.__adminReady = true;

var categories = [];
var products = [];

function isPlaceholderConfig() {
  return !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("TU_") === 0;
}

function showStatus(msg, type) {
  var el = document.getElementById("adminStatus");
  el.textContent = msg;
  el.className = "admin-status " + (type || "ok");
  el.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (type !== "error") {
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(function () { el.hidden = true; }, 3000);
  }
}

function explainError(err) {
  var code = (err && err.code) || "";
  var text = (err && err.message) || "";
  console.error(err);
  if (code === "permission-denied" || text.indexOf("permission") !== -1) {
    return "No se guardó: Firebase rechazó el permiso. Ve a Firestore Database → Reglas, pega las reglas del README (allow read, write: if true;) y toca Publicar.";
  }
  if (code === "not-found" || text.indexOf("does not exist") !== -1 || text.indexOf("NOT_FOUND") !== -1) {
    return "No se guardó: la base de datos Firestore no existe todavía. Ve a Firebase → Compilación → Firestore Database → Crear base de datos.";
  }
  if (code === "failed-precondition") {
    return "No se guardó: Firestore no está listo. Revisa que la base de datos esté creada en Firebase → Firestore Database.";
  }
  if (code === "unavailable") {
    return "No se guardó: no hay conexión con Firebase. Revisa tu internet e intenta de nuevo.";
  }
  if (text.indexOf("API key") !== -1 || code.indexOf("api-key") !== -1) {
    return "No se guardó: la apiKey de firebase-config.js no es válida. Vuelve a copiarla desde Configuración del proyecto → Tus apps.";
  }
  return "No se guardó. Error de Firebase: " + (code || text || "desconocido");
}

var connected = false;

// Evita que los formularios recarguen la página si Firebase no está conectado
["settingsForm", "categoryForm", "productForm"].forEach(function (id) {
  document.getElementById(id).addEventListener("submit", function (e) {
    e.preventDefault();
    if (!connected) {
      showStatus("No se puede guardar todavía: el panel no está conectado a Firebase. Revisa que firebase-config.js tenga tus datos reales (no los TU_...).", "error");
    }
  });
});

import("./firebase-config.js").then(function (mod) {
  firebaseConfig = mod.firebaseConfig;
  if (!firebaseConfig) {
    showStatus("firebase-config.js no tiene la línea 'export const firebaseConfig = {'. Asegúrate de que empiece exactamente así (con la palabra export).", "error");
    return;
  }
  if (isPlaceholderConfig()) {
    document.getElementById("configWarning").hidden = false;
    showStatus("firebase-config.js todavía tiene los valores de ejemplo (TU_API_KEY...). Pega ahí tu configuración real de Firebase y vuelve a subirlo a GitHub.", "error");
    return;
  }
  initFirebase();
}).catch(function (err) {
  console.error(err);
  showStatus("firebase-config.js tiene un error y no se puede leer. Casi siempre es porque se pegaron líneas de 'import' o 'initializeApp' de Firebase. El archivo solo debe tener el bloque 'export const firebaseConfig = { ... };'.", "error");
});

function initFirebase() {
  Promise.all([
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js")
  ]).then(function (mods) {
    var appMod = mods[0], fsMod = mods[1];
    var app = appMod.initializeApp(firebaseConfig);
    var db = fsMod.getFirestore(app);
    connected = true;
    start(fsMod, db);
  }).catch(function (err) {
    document.getElementById("configWarning").hidden = false;
    showStatus(explainError(err), "error");
  });
}

function start(fsMod, db) {
  var collection = fsMod.collection, onSnapshot = fsMod.onSnapshot, query = fsMod.query,
      orderBy = fsMod.orderBy, addDoc = fsMod.addDoc, updateDoc = fsMod.updateDoc,
      deleteDoc = fsMod.deleteDoc, doc = fsMod.doc, setDoc = fsMod.setDoc, getDoc = fsMod.getDoc;

  onSnapshot(query(collection(db, "categories"), orderBy("order", "asc")), function (snap) {
    categories = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    renderCategoryTable();
    renderCategorySelect();
  }, function (err) { showStatus(explainError(err), "error"); });

  onSnapshot(collection(db, "products"), function (snap) {
    products = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    renderProductTable();
    document.getElementById("seedCard").hidden = products.length > 0;
  }, function (err) { showStatus(explainError(err), "error"); });

  getDoc(doc(db, "settings", "store")).then(function (snap) {
    if (snap.exists()) {
      var data = snap.data();
      document.getElementById("storeWhatsapp").value = data.whatsapp || "";
      document.getElementById("storeName").value = data.storeName || "";
    }
  });

  document.getElementById("settingsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    setDoc(doc(db, "settings", "store"), {
      whatsapp: document.getElementById("storeWhatsapp").value.trim(),
      storeName: document.getElementById("storeName").value.trim()
    }, { merge: true })
      .then(function () { showStatus("Datos de la tienda guardados ✓"); })
      .catch(function (err) { showStatus(explainError(err), "error"); });
  });

  document.getElementById("categoryForm").addEventListener("submit", function (e) {
    e.preventDefault();
    addDoc(collection(db, "categories"), {
      name: document.getElementById("catName").value.trim(),
      desc: document.getElementById("catDesc").value.trim(),
      order: Number(document.getElementById("catOrder").value) || 0
    }).then(function () {
      e.target.reset();
      showStatus("Categoría guardada ✓");
    }).catch(function (err) { showStatus(explainError(err), "error"); });
  });

  function renderCategoryTable() {
    var tbody = document.querySelector("#categoryTable tbody");
    tbody.innerHTML = "";
    categories.forEach(function (cat) {
      var tr = document.createElement("tr");

      var tdOrder = document.createElement("td");
      tdOrder.textContent = cat.order;
      tr.appendChild(tdOrder);

      var tdName = document.createElement("td");
      tdName.textContent = cat.name;
      tr.appendChild(tdName);

      var tdDesc = document.createElement("td");
      tdDesc.textContent = cat.desc || "—";
      tr.appendChild(tdDesc);

      var tdActions = document.createElement("td");
      var delBtn = document.createElement("button");
      delBtn.className = "admin-btn admin-btn-danger admin-btn-sm";
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", function () {
        var inUse = products.some(function (p) { return p.categoryId === cat.id; });
        if (inUse) {
          alert("Esta categoría tiene productos asignados. Cámbialos de categoría o bórralos primero.");
          return;
        }
        if (confirm("¿Eliminar la categoría \"" + cat.name + "\"?")) {
          deleteDoc(doc(db, "categories", cat.id))
            .then(function () { showStatus("Categoría eliminada"); })
            .catch(function (err) { showStatus(explainError(err), "error"); });
        }
      });
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function renderCategorySelect() {
    var select = document.getElementById("prodCategory");
    var current = select.value;
    select.innerHTML = "";
    categories.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  var productForm = document.getElementById("productForm");
  var prodSubmitBtn = document.getElementById("prodSubmitBtn");
  var prodCancelEdit = document.getElementById("prodCancelEdit");

  productForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (categories.length === 0) {
      alert("Primero crea al menos una categoría.");
      return;
    }
    var data = {
      name: document.getElementById("prodName").value.trim(),
      price: Number(document.getElementById("prodPrice").value) || 0,
      currency: document.getElementById("prodCurrency").value.trim() || "$",
      categoryId: document.getElementById("prodCategory").value,
      image: document.getElementById("prodImage").value.trim(),
      desc: document.getElementById("prodDesc").value.trim(),
      badge: document.getElementById("prodBadge").value.trim()
    };
    var editId = document.getElementById("prodEditId").value;
    var task = editId ? updateDoc(doc(db, "products", editId), data) : addDoc(collection(db, "products"), data);
    task.then(function () {
      resetProductForm();
      showStatus(editId ? "Producto actualizado ✓" : "Producto guardado ✓");
    }).catch(function (err) { showStatus(explainError(err), "error"); });
  });

  prodCancelEdit.addEventListener("click", resetProductForm);

  function resetProductForm() {
    productForm.reset();
    document.getElementById("prodEditId").value = "";
    document.getElementById("prodCurrency").value = "$";
    prodSubmitBtn.textContent = "Agregar producto";
    prodCancelEdit.hidden = true;
  }

  function editProduct(p) {
    document.getElementById("prodEditId").value = p.id;
    document.getElementById("prodName").value = p.name;
    document.getElementById("prodPrice").value = p.price;
    document.getElementById("prodCurrency").value = p.currency || "$";
    document.getElementById("prodCategory").value = p.categoryId;
    document.getElementById("prodImage").value = p.image || "";
    document.getElementById("prodDesc").value = p.desc || "";
    document.getElementById("prodBadge").value = p.badge || "";
    prodSubmitBtn.textContent = "Guardar cambios";
    prodCancelEdit.hidden = false;
    window.scrollTo({ top: productForm.offsetTop - 20, behavior: "smooth" });
  }

  function renderProductTable() {
    var tbody = document.querySelector("#productTable tbody");
    tbody.innerHTML = "";
    products.forEach(function (p) {
      var tr = document.createElement("tr");

      var tdImg = document.createElement("td");
      if (p.image) {
        var img = document.createElement("img");
        img.src = p.image;
        img.alt = p.name;
        img.className = "admin-thumb";
        tdImg.appendChild(img);
      } else {
        tdImg.textContent = "—";
      }
      tr.appendChild(tdImg);

      var tdName = document.createElement("td");
      tdName.textContent = p.name;
      tr.appendChild(tdName);

      var tdPrice = document.createElement("td");
      tdPrice.textContent = (p.currency || "$") + p.price;
      tr.appendChild(tdPrice);

      var tdCat = document.createElement("td");
      var cat = categories.find(function (c) { return c.id === p.categoryId; });
      tdCat.textContent = cat ? cat.name : "(sin categoría)";
      tr.appendChild(tdCat);

      var tdActions = document.createElement("td");
      var editBtn = document.createElement("button");
      editBtn.className = "admin-btn admin-btn-sm";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", function () { editProduct(p); });

      var delBtn = document.createElement("button");
      delBtn.className = "admin-btn admin-btn-danger admin-btn-sm";
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", function () {
        if (confirm("¿Eliminar \"" + p.name + "\"?")) {
          deleteDoc(doc(db, "products", p.id))
            .then(function () { showStatus("Producto eliminado"); })
            .catch(function (err) { showStatus(explainError(err), "error"); });
        }
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  document.getElementById("seedBtn").addEventListener("click", function () {
    if (!confirm("Esto crea 5 categorías y 11 productos de ejemplo para que veas cómo luce el sitio. ¿Continuar?")) return;

    var seedCategories = [
      { name: "Cojines y textiles", desc: "Cojines, mantas y textiles para sumar textura y calidez.", order: 1 },
      { name: "Velas y aromas", desc: "Velas aromáticas, difusores y detalles que perfuman el ambiente.", order: 2 },
      { name: "Cuadros y espejos", desc: "Piezas de pared para darle carácter a cualquier rincón.", order: 3 },
      { name: "Floreros y plantas", desc: "Floreros, macetas y flores artificiales.", order: 4 },
      { name: "Organización y detalles", desc: "Bandejas, cestas y pequeños objetos que ordenan y decoran.", order: 5 }
    ];

    var catIds = {};
    Promise.all(seedCategories.map(function (c) {
      return addDoc(collection(db, "categories"), c).then(function (ref) { catIds[c.name] = ref.id; });
    })).then(function () {
      var seedProducts = [
        { name: "Cojín lino natural", price: 8, cat: "Cojines y textiles" },
        { name: "Cojín rayas salvia", price: 9, cat: "Cojines y textiles" },
        { name: "Manta tejida crema", price: 15, cat: "Cojines y textiles" },
        { name: "Vela vainilla y sándalo", price: 6, cat: "Velas y aromas" },
        { name: "Difusor de lavanda", price: 10, cat: "Velas y aromas" },
        { name: "Espejo forma de arco", price: 22, cat: "Cuadros y espejos" },
        { name: "Cuadro botánico set x2", price: 14, cat: "Cuadros y espejos" },
        { name: "Florero de cerámica", price: 11, cat: "Floreros y plantas" },
        { name: "Maceta rayada terracota", price: 7, cat: "Floreros y plantas" },
        { name: "Bandeja decorativa madera", price: 9, cat: "Organización y detalles" },
        { name: "Cesta de mimbre chica", price: 8, cat: "Organización y detalles" }
      ];
      return Promise.all(seedProducts.map(function (p) {
        return addDoc(collection(db, "products"), {
          name: p.name, price: p.price, currency: "$", categoryId: catIds[p.cat], image: ""
        });
      }));
    }).then(function () {
      showStatus("Catálogo de ejemplo cargado ✓ Ya puedes editarlo.");
    }).catch(function (err) { showStatus(explainError(err), "error"); });
  });
}
