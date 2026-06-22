const firebaseConfig = {
  apiKey: "AIzaSyD15jjDHKnJJSTIiS1qkqHOp8LGN7gIRD4",
  authDomain: "samara-560ad.firebaseapp.com",
  projectId: "samara-560ad",
  storageBucket: "samara-560ad.firebasestorage.app",
  messagingSenderId: "838230946676",
  appId: "1:838230946676:web:9ac33c5ee94f47c8407221",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== State =====
let categoriesCache = [];
let globalButtonsCache = [];

// ===== DOM refs =====
const $ = (id) => document.getElementById(id);
const categoriesBody = $("categoriesBody");
const globalButtonsBody = $("globalButtonsBody");

// ===== Firebase Status =====
const fbStatus = $("fbStatus");
const fbStatusText = $("fbStatusText");

db.app
  .firestore()
  .enableNetwork()
  .then(() => {
    fbStatus.classList.add("connected");
    fbStatusText.textContent = "Firebase متصل";
  })
  .catch(() => {
    fbStatus.classList.add("error");
    fbStatusText.textContent = "فشل الاتصال";
  });

// ===== Helpers =====
function statusBadge(status) {
  const s = status || "active";
  const label = s === "active" ? "نشط" : "معطل";
  return `<span class="status-badge ${s}">${label}</span>`;
}

function sortByOrder(arr) {
  return [...arr].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

function getIconSvg(name) {
  return name || "radio-button-off";
}

// ===== Tabs =====
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ===== Categories =====
async function loadCategories() {
  const snap = await db.collection("categories").get();
  categoriesCache = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const itemsSnap = await doc.ref.collection("items").get();
    const items = [];
    itemsSnap.forEach((i) =>
      items.push({ id: i.id, ...i.data() })
    );
    categoriesCache.push({ id: doc.id, ...data, items: sortByOrder(items) });
  }
  renderCategories();
}

function renderCategories() {
  const sorted = sortByOrder(categoriesCache);
  if (!sorted.length) {
    categoriesBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">لا توجد فئات بعد</td></tr>';
    return;
  }
  categoriesBody.innerHTML = sorted
    .map(
      (cat) => `
    <tr>
      <td>${cat.sortOrder ?? "-"}</td>
      <td><code>${cat.id}</code></td>
      <td>${cat.title}</td>
      <td>${cat.icon || "-"}</td>
      <td>${statusBadge(cat.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openItemsModal('${cat.id}','${cat.title}')">
          ${cat.items.length} عناصر
        </button>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="editCategory('${cat.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">حذف</button>
        </div>
      </td>
    </tr>`
    )
    .join("");
}

function openCategoryModal(cat) {
  $("catModalTitle").textContent = cat ? "تعديل فئة" : "إضافة فئة";
  $("catId").value = cat ? cat.id : "";
  $("catTitle").value = cat ? cat.title : "";
  $("catIcon").value = cat ? cat.icon || "" : "";
  $("catPassword").value = cat ? cat.password || "" : "";
  $("catSortOrder").value = cat ? cat.sortOrder ?? 0 : 0;
  $("catStatus").value = cat ? cat.status || "active" : "active";
  $("catModal").classList.add("open");
}

$("addCategoryBtn").addEventListener("click", () => openCategoryModal(null));
$("catModalClose").addEventListener("click", () => $("catModal").classList.remove("open"));

$("catForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("catId").value.trim();
  const data = {
    title: $("catTitle").value.trim(),
    icon: $("catIcon").value.trim(),
    password: $("catPassword").value.trim() || null,
    sortOrder: parseInt($("catSortOrder").value) || 0,
    status: $("catStatus").value,
  };
  try {
    if (id) {
      await db.collection("categories").doc(id).update(data);
    } else {
      const newId = data.title
        .replace(/[^a-z0-9_\u0621-\u064a]/gi, "_")
        .toLowerCase()
        .slice(0, 30) || "category_" + Date.now();
      await db.collection("categories").doc(newId).set(data);
    }
    $("catModal").classList.remove("open");
    await loadCategories();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

window.editCategory = (id) => {
  const cat = categoriesCache.find((c) => c.id === id);
  if (cat) openCategoryModal(cat);
};

window.deleteCategory = async (id) => {
  if (!confirm("هل تريد حذف هذه الفئة وجميع عناصرها؟")) return;
  try {
    const itemsSnap = await db.collection("categories").doc(id).collection("items").get();
    const batch = db.batch();
    itemsSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("categories").doc(id));
    await batch.commit();
    await loadCategories();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

// ===== Items (nested in Modal) =====
let currentItemCategory = null;

function openItemsModal(catId, catTitle) {
  currentItemCategory = catId;
  $("itemsModalTitle").textContent = `عناصر: ${catTitle}`;
  renderItems();
  $("itemsModal").classList.add("open");
}

$("itemsModalClose").addEventListener("click", () => {
  $("itemsModal").classList.remove("open");
  currentItemCategory = null;
});

function renderItems() {
  const cat = categoriesCache.find((c) => c.id === currentItemCategory);
  const items = cat ? sortByOrder(cat.items) : [];
  const body = $("itemsModalBody");
  if (!items.length) {
    body.innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:16px;">لا توجد عناصر</p>';
  } else {
    body.innerHTML = items
      .map(
        (item, i) => `
      <div class="item-entry">
        <div class="item-info">
          <span class="item-icon">${getIconSvg(item.icon)}</span>
          <span class="item-title">${item.title}</span>
          <span class="item-status">${statusBadge(item.status)}</span>
        </div>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="openItemModal('${item.id || i}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id || i}')">حذف</button>
        </div>
      </div>`
      )
      .join("");
  }
  body.innerHTML += `
    <div class="add-item-bar">
      <input type="text" id="quickItemTitle" placeholder="عنوان العنصر الجديد" />
      <button class="btn btn-primary" onclick="quickAddItem()">إضافة</button>
    </div>
  `;
}

window.quickAddItem = async () => {
  const title = $("quickItemTitle").value.trim();
  if (!title) return;
  try {
    await db.collection("categories").doc(currentItemCategory).collection("items").add({
      title,
      icon: "",
      url: "",
      action: "webview",
      status: "active",
      sortOrder: Date.now(),
    });
    $("quickItemTitle").value = "";
    await loadCategories();
    renderItems();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

window.deleteItem = async (itemId) => {
  if (!confirm("حذف هذا العنصر؟")) return;
  try {
    await db
      .collection("categories")
      .doc(currentItemCategory)
      .collection("items")
      .doc(itemId)
      .delete();
    await loadCategories();
    renderItems();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

function openItemModal(itemId) {
  const cat = categoriesCache.find((c) => c.id === currentItemCategory);
  const item = cat ? cat.items.find((i) => i.id === itemId) : null;
  $("itemModalTitle").textContent = item ? "تعديل عنصر" : "إضافة عنصر";
  $("itemParentCategory").value = currentItemCategory;
  $("itemId").value = item ? itemId : "";
  $("itemTitle").value = item ? item.title : "";
  $("itemIcon").value = item ? item.icon || "" : "";
  $("itemUrl").value = item ? item.url || "" : "";
  $("itemAction").value = item ? item.action || "webview" : "webview";
  $("itemPassword").value = item ? item.password || "" : "";
  $("itemSortOrder").value = item ? item.sortOrder ?? 0 : 0;
  $("itemStatus").value = item ? item.status || "active" : "active";
  $("itemModal").classList.add("open");
}

$("itemModalClose").addEventListener("click", () => $("itemModal").classList.remove("open"));

$("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const catId = $("itemParentCategory").value;
  const itemId = $("itemId").value;
  const data = {
    title: $("itemTitle").value.trim(),
    icon: $("itemIcon").value.trim(),
    url: $("itemUrl").value.trim(),
    action: $("itemAction").value,
    password: $("itemPassword").value.trim() || null,
    sortOrder: parseInt($("itemSortOrder").value) || 0,
    status: $("itemStatus").value,
  };
  try {
    const ref = db.collection("categories").doc(catId).collection("items");
    if (itemId) {
      await ref.doc(itemId).update(data);
    } else {
      await ref.add(data);
    }
    $("itemModal").classList.remove("open");
    await loadCategories();
    renderItems();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

// ===== Global Buttons =====
async function loadGlobalButtons() {
  const snap = await db.collection("global_buttons").get();
  globalButtonsCache = [];
  snap.forEach((d) => globalButtonsCache.push({ id: d.id, ...d.data() }));
  renderGlobalButtons();
}

function renderGlobalButtons() {
  const sorted = sortByOrder(globalButtonsCache);
  if (!sorted.length) {
    globalButtonsBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">لا توجد أزرار سريعة</td></tr>';
    return;
  }
  globalButtonsBody.innerHTML = sorted
    .map(
      (btn) => `
    <tr>
      <td>${btn.sortOrder ?? "-"}</td>
      <td><code>${btn.id}</code></td>
      <td>${btn.title}</td>
      <td>${btn.icon || "-"}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;direction:ltr;">${btn.url || "-"}</td>
      <td>${statusBadge(btn.status)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="editGlobalBtn('${btn.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteGlobalBtn('${btn.id}')">حذف</button>
        </div>
      </td>
    </tr>`
    )
    .join("");
}

function openGlobalModal(btn) {
  $("globalModalTitle").textContent = btn ? "تعديل زر سريع" : "إضافة زر سريع";
  $("globalId").value = btn ? btn.id : "";
  $("globalTitle").value = btn ? btn.title : "";
  $("globalIcon").value = btn ? btn.icon || "" : "";
  $("globalUrl").value = btn ? btn.url || "" : "";
  $("globalAction").value = btn ? btn.action || "webview" : "webview";
  $("globalPassword").value = btn ? btn.password || "" : "";
  $("globalSortOrder").value = btn ? btn.sortOrder ?? 0 : 0;
  $("globalStatus").value = btn ? btn.status || "active" : "active";
  $("globalModal").classList.add("open");
}

$("addGlobalBtn").addEventListener("click", () => openGlobalModal(null));
$("globalModalClose").addEventListener("click", () => $("globalModal").classList.remove("open"));

$("globalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("globalId").value.trim();
  const data = {
    title: $("globalTitle").value.trim(),
    icon: $("globalIcon").value.trim(),
    url: $("globalUrl").value.trim(),
    action: $("globalAction").value,
    password: $("globalPassword").value.trim() || null,
    sortOrder: parseInt($("globalSortOrder").value) || 0,
    status: $("globalStatus").value,
  };
  try {
    if (id) {
      await db.collection("global_buttons").doc(id).update(data);
    } else {
      const newId =
        data.title.replace(/[^a-z0-9_\u0621-\u064a]/gi, "_").toLowerCase().slice(0, 30) ||
        "btn_" + Date.now();
      await db.collection("global_buttons").doc(newId).set(data);
    }
    $("globalModal").classList.remove("open");
    await loadGlobalButtons();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

window.editGlobalBtn = (id) => {
  const btn = globalButtonsCache.find((b) => b.id === id);
  if (btn) openGlobalModal(btn);
};

window.deleteGlobalBtn = async (id) => {
  if (!confirm("هل تريد حذف هذا الزر؟")) return;
  try {
    await db.collection("global_buttons").doc(id).delete();
    await loadGlobalButtons();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

// ===== Settings =====
async function loadSettings() {
  try {
    const doc = await db.collection("settings").doc("app").get();
    if (doc.exists) {
      const data = doc.data();
      $("settingsVersion").value = data.version ?? 1;
      $("settingsTheme").value = data.themeDefault || "system";
      $("settingsMaintenance").value = data.maintenanceMode ? "true" : "false";
    } else {
      $("settingsVersion").value = 1;
      $("settingsTheme").value = "system";
      $("settingsMaintenance").value = "false";
    }
  } catch {}
}

$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await db.collection("settings").doc("app").set({
      version: parseInt($("settingsVersion").value) || 1,
      themeDefault: $("settingsTheme").value,
      maintenanceMode: $("settingsMaintenance").value === "true",
    });
    alert("تم حفظ الإعدادات");
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

// ===== Init =====
async function init() {
  await Promise.all([loadCategories(), loadGlobalButtons(), loadSettings()]);
}

init();
