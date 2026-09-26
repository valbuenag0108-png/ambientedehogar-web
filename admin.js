import { firebaseConfig } from "./firebase-config.js";

var categories = [];
var products = [];

function isPlaceholderConfig() {
  return !firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("TU_") === 0;
}

if (isPlaceholderConfig()) {
  document.getElementById("configWarning").hidden = false;
} else {
  initFirebase();
}

function initFirebase() {
  Promise.all([
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js")
  ]).then(function (mods) {
    var appMod = mods[0], fsMod = mods[1];
    var app = appMod.initializeApp(firebaseConfig);
    var db = fsMod.getFirestore(app);
    start(fsMod, db);
  }).catch(function (err) {
    document.getElementById("configWarning").hidden = false;
    console.error(err);
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
  });

  onSnapshot(collection(db, "products"), function (snap) {
    products = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    renderProductTable();
    document.getElementById("seedCard").hidden = products.length > 0;
  });

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
    }, { merge: true });
  });

  document.getElementById("categoryForm").addEventListener("submit", function (e) {
    e.preventDefault();
    addDoc(collection(db, "categories"), {
      name: document.getElementById("catName").value.trim(),
      desc: document.getElementById("catDesc").value.trim(),
      order: Number(document.getElementById("catOrder").value) || 0
    }).then(function () { e.target.reset(); });
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
          deleteDoc(doc(db, "categories", cat.id));
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
      image: document.getElementById("prodImage").value.trim()
    };
    var editId = document.getElementById("prodEditId").value;
    var task = editId ? updateDoc(doc(db, "products", editId), data) : addDoc(collection(db, "products"), data);
    task.then(resetProductForm);
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
        if (confirm("¿Eliminar \"" + p.name + "\"?")) deleteDoc(doc(db, "products", p.id));
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
      alert("Listo, catálogo de ejemplo cargado. Ya puedes editarlo.");
    });
  });
}
