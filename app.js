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

// ===== FALLBACK_CONFIG data embedded for manual import =====
const FALLBACK_CONFIG = {
  version: 1,
  categories: [
    {
      id: "street_cards",
      title: "فكة الشوارع",
      icon: "wifi",
      items: [
        { title: "تسجيل الدخول", icon: "login", url: "http://10.10.10.254", action: "hotspot_login" },
        { title: "تسجيل الدخول بآخر كارت", icon: "card", url: "", action: "last_card" },
        { title: "تسجيل الدخول QR", icon: "qr", url: "", action: "qr_scanner" },
      ],
    },
    {
      id: "home_subscriptions",
      title: "اشتراكات المنازل",
      icon: "home",
      items: [
        { title: "متابعة الاستهلاك", icon: "stats", url: "http://10.10.10.254/user.php?cont=login", action: "webview" },
        { title: "تجديد باقة المنزل فودافون كاش", icon: "pay", url: "http://41.196.252.175:7171/richman/", action: "webview" },
        { title: "شرح فيديو التجديد", icon: "image", url: "http://10.10.10.254/video.php", action: "webview" },
      ],
    },
    {
      id: "merchant_services",
      title: "خدمات التاجر",
      icon: "bank",
      items: [
        { title: "شحن خارجي لتاجر بكرت شحن", icon: "card", url: "http://41.196.252.175:7171/user.php?cont=logout", action: "webview" },
        { title: "برنامج التاجر", icon: "account", url: "http://41.196.252.175:7171/admin.php", action: "webview" },
      ],
    },
  ],
  globalButtons: [
    {
      id: "prices",
      title: "قائمة الأسعار",
      icon: "bill",
      url: "http://10.10.10.254/prices",
      action: "webview",
      status: "active",
      sortOrder: 0,
    },
  ],
  whatsapp: "+201091940111",
  phone: "+201091940111",
};

// ===== State =====
let categoriesCache = [];
let globalButtonsCache = [];
let notificationsCache = [];
let regionsCache = [];
let salePointsCache = [];
let currentSalePointRegion = null;
let activeNotifUnsubscribe = null; // لإيقاف أي listener سابق قبل إرسال إشعار جديد

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
    itemsSnap.forEach((i) => items.push({ id: i.id, ...i.data() }));
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
      const newId =
        data.title.replace(/[^a-z0-9_\u0621-\u064a]/gi, "_").toLowerCase().slice(0, 30) ||
        "category_" + Date.now();
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

// ===== Items =====
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
          <span class="item-icon">${item.icon || "•"}</span>
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
    await db.collection("categories").doc(currentItemCategory).collection("items").doc(itemId).delete();
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

// ===== Sale Regions =====
async function loadRegions() {
  const snap = await db.collection("sale_regions").get();
  regionsCache = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const ptsSnap = await doc.ref.collection("sale_points").get();
    const points = [];
    ptsSnap.forEach((p) => points.push({ id: p.id, ...p.data() }));
    regionsCache.push({ id: doc.id, ...data, salePoints: sortByOrder(points) });
  }
  renderRegions();
}

function renderRegions() {
  const sorted = sortByOrder(regionsCache);
  const body = document.getElementById("regionsBody");
  if (!sorted.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">لا توجد مناطق بيع بعد</td></tr>';
    return;
  }
  body.innerHTML = sorted.map((r) => `
    <tr>
      <td>${r.sortOrder ?? "-"}</td>
      <td><strong>${r.name}</strong></td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openSalePointsModal('${r.id}','${r.name}')">
          ${(r.salePoints||[]).length} نقاط
        </button>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="editRegion('${r.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRegion('${r.id}')">حذف</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openRegionModal(region) {
  document.getElementById("regionModalTitle").textContent = region ? "تعديل منطقة بيع" : "إضافة منطقة بيع";
  document.getElementById("regionId").value = region ? region.id : "";
  document.getElementById("regionName").value = region ? region.name : "";
  document.getElementById("regionSortOrder").value = region ? region.sortOrder ?? 0 : 0;
  document.getElementById("regionStatus").value = region ? region.status || "active" : "active";
  document.getElementById("regionModal").classList.add("open");
}

document.getElementById("regionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("regionId").value.trim();
  const data = {
    name: document.getElementById("regionName").value.trim(),
    sortOrder: parseInt(document.getElementById("regionSortOrder").value) || 0,
    status: document.getElementById("regionStatus").value,
  };
  try {
    if (id) {
      await db.collection("sale_regions").doc(id).update(data);
    } else {
      const newId = data.name.replace(/[^a-z0-9_\u0621-\u064a]/gi, "_").toLowerCase().slice(0, 30) || "region_" + Date.now();
      await db.collection("sale_regions").doc(newId).set(data);
    }
    document.getElementById("regionModal").classList.remove("open");
    await loadRegions();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

window.editRegion = (id) => {
  const r = regionsCache.find((x) => x.id === id);
  if (r) openRegionModal(r);
};

window.deleteRegion = async (id) => {
  if (!confirm("هل تريد حذف هذه المنطقة وجميع نقاط البيع فيها؟")) return;
  try {
    const ptsSnap = await db.collection("sale_regions").doc(id).collection("sale_points").get();
    const batch = db.batch();
    ptsSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("sale_regions").doc(id));
    await batch.commit();
    await loadRegions();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

// ===== Sale Points =====
function openSalePointsModal(regionId, regionName) {
  currentSalePointRegion = regionId;
  document.getElementById("salePointsModalTitle").textContent = "نقاط البيع: " + regionName;
  renderSalePoints();
  document.getElementById("salePointsModal").classList.add("open");
}

function renderSalePoints() {
  const region = regionsCache.find((r) => r.id === currentSalePointRegion);
  const pts = region ? sortByOrder(region.salePoints) : [];
  let html = "";
  if (!pts.length) {
    html = '<p style="color:var(--text-muted);text-align:center;padding:16px;">لا توجد نقاط بيع</p>';
  } else {
    html = pts.map((p, i) => `
      <div class="item-entry">
        <div class="item-info">
          <strong>${p.name}</strong>
          ${p.phone ? '<br><small style="color:var(--text-muted);direction:ltr;display:block;">📞 ' + p.phone + '</small>' : ""}
          ${p.whatsapp ? '<br><small style="color:var(--text-muted);direction:ltr;display:block;">💬 ' + p.whatsapp + '</small>' : ""}
          ${p.address ? '<br><small style="color:var(--text-muted);display:block;">📍 ' + p.address + '</small>' : ""}
        </div>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="openSalePointModal('${p.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSalePoint('${p.id}')">حذف</button>
        </div>
      </div>
    `).join("");
  }
  html += '<div class="add-item-bar"><input type="text" id="quickSalePointName" placeholder="اسم نقطة البيع الجديدة" /><button class="btn btn-primary" onclick="quickAddSalePoint()">إضافة</button></div>';
  const existing = document.getElementById("salePointsModalBody");
  if (existing) existing.innerHTML = html;
  else {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "salePointsModal";
    overlay.innerHTML = '<div class="modal"><div class="modal-header"><h3 id="salePointsModalTitle">نقاط البيع</h3><button class="modal-close" onclick="document.getElementById(\'salePointsModal\').classList.remove(\'open\');currentSalePointRegion=null;">&times;</button></div><div class="modal-body" id="salePointsModalBody">' + html + '</div></div>';
    document.body.appendChild(overlay);
  }
}

window.quickAddSalePoint = async () => {
  const name = document.getElementById("quickSalePointName").value.trim();
  if (!name || !currentSalePointRegion) return;
  try {
    await db.collection("sale_regions").doc(currentSalePointRegion).collection("sale_points").add({
      name,
      phone: "", whatsapp: "", address: "", mapsUrl: "", notes: "",
      sortOrder: Date.now(),
      status: "active",
    });
    document.getElementById("quickSalePointName").value = "";
    await loadRegions();
    renderSalePoints();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

window.deleteSalePoint = async (pointId) => {
  if (!confirm("حذف نقطة البيع هذه؟")) return;
  try {
    await db.collection("sale_regions").doc(currentSalePointRegion).collection("sale_points").doc(pointId).delete();
    await loadRegions();
    renderSalePoints();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
};

function openSalePointModal(pointId) {
  const region = regionsCache.find((r) => r.id === currentSalePointRegion);
  const point = region ? region.salePoints.find((p) => p.id === pointId) : null;
  document.getElementById("salePointModalTitle").textContent = point ? "تعديل نقطة بيع" : "إضافة نقطة بيع";
  document.getElementById("salePointId").value = point ? pointId : "";
  document.getElementById("salePointName").value = point ? point.name : "";
  document.getElementById("salePointPhone").value = point ? point.phone || "" : "";
  document.getElementById("salePointWhatsapp").value = point ? point.whatsapp || "" : "";
  document.getElementById("salePointAddress").value = point ? point.address || "" : "";
  document.getElementById("salePointMapsUrl").value = point ? point.mapsUrl || "" : "";
  document.getElementById("salePointNotes").value = point ? point.notes || "" : "";
  document.getElementById("salePointSortOrder").value = point ? point.sortOrder ?? 0 : 0;
  document.getElementById("salePointStatus").value = point ? point.status || "active" : "active";
  document.getElementById("salePointModal").classList.add("open");
}

document.getElementById("salePointForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pointId = document.getElementById("salePointId").value.trim();
  const data = {
    name: document.getElementById("salePointName").value.trim(),
    phone: document.getElementById("salePointPhone").value.trim(),
    whatsapp: document.getElementById("salePointWhatsapp").value.trim(),
    address: document.getElementById("salePointAddress").value.trim(),
    mapsUrl: document.getElementById("salePointMapsUrl").value.trim(),
    notes: document.getElementById("salePointNotes").value.trim() || null,
    sortOrder: parseInt(document.getElementById("salePointSortOrder").value) || 0,
    status: document.getElementById("salePointStatus").value,
  };
  try {
    const ref = db.collection("sale_regions").doc(currentSalePointRegion).collection("sale_points");
    if (pointId) {
      await ref.doc(pointId).update(data);
    } else {
      await ref.add(data);
    }
    document.getElementById("salePointModal").classList.remove("open");
    await loadRegions();
    renderSalePoints();
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

// ===== Import App Data =====
async function importAppData() {
  const importBtn = $("importAppDataBtn");
  const importStatus = $("importAppDataStatus");
  importBtn.disabled = true;
  importBtn.textContent = "جاري الاستيراد...";
  importStatus.textContent = "";

  try {
    const catSnap = await db.collection("categories").get();
    const existingCatIds = new Set(catSnap.docs.map((d) => d.id));

    let catsAdded = 0;
    let itemsAdded = 0;
    let globalsAdded = 0;
    const ops = [];

    for (const cat of FALLBACK_CONFIG.categories) {
      if (!existingCatIds.has(cat.id)) {
        ops.push(
          db.collection("categories").doc(cat.id).set({
            title: cat.title,
            icon: cat.icon,
            password: cat.password || null,
            status: cat.status || "active",
            sortOrder: FALLBACK_CONFIG.categories.indexOf(cat),
          })
        );
        catsAdded++;
      }

      const existingItemsSnap = await db.collection("categories").doc(cat.id).collection("items").get();
      const existingItemTitles = new Set(existingItemsSnap.docs.map((d) => d.data().title));

      for (const item of cat.items) {
        if (existingItemTitles.has(item.title)) continue;
        ops.push(
          db.collection("categories").doc(cat.id).collection("items").add({
            title: item.title,
            icon: item.icon,
            url: item.url,
            action: item.action || "webview",
            password: item.password || null,
            status: item.status || "active",
            sortOrder: cat.items.indexOf(item),
          })
        );
        itemsAdded++;
      }
    }

    const globalSnap = await db.collection("global_buttons").get();
    const existingGlobalIds = new Set(globalSnap.docs.map((d) => d.id));

    for (const btn of FALLBACK_CONFIG.globalButtons) {
      if (existingGlobalIds.has(btn.id)) continue;
      ops.push(
        db.collection("global_buttons").doc(btn.id).set({
          title: btn.title,
          icon: btn.icon,
          url: btn.url,
          action: btn.action || "webview",
          password: btn.password || null,
          status: btn.status || "active",
          sortOrder: FALLBACK_CONFIG.globalButtons.indexOf(btn),
        })
      );
      globalsAdded++;
    }

    if (ops.length > 0) await Promise.all(ops);

    await db.collection("settings").doc("app").set({
      migrated: true,
      version: FALLBACK_CONFIG.version,
      whatsapp: FALLBACK_CONFIG.whatsapp,
      phone: FALLBACK_CONFIG.phone,
    }, { merge: true });

    if (catsAdded === 0 && itemsAdded === 0 && globalsAdded === 0) {
      importStatus.textContent = "جميع البيانات موجودة مسبقاً. لم يتم استيراد أي عنصر جديد.";
    } else {
      importStatus.textContent = `تم الاستيراد بنجاح: ${catsAdded} فئة, ${itemsAdded} عنصر, ${globalsAdded} زر سريع`;
    }

    await Promise.all([loadCategories(), loadGlobalButtons()]);
  } catch (err) {
    importStatus.textContent = "خطأ: " + err.message;
  }

  importBtn.disabled = false;
  importBtn.textContent = "استيراد بيانات التطبيق الحالية";
}

window.importAppData = importAppData;

// ===== Settings =====
async function loadSettings() {
  try {
    const doc = await db.collection("settings").doc("app").get();
    if (doc.exists) {
      const data = doc.data();
      $("settingsVersion").value = data.version ?? 1;
      $("settingsTheme").value = data.themeDefault || "system";
      $("settingsMaintenance").value = data.maintenanceMode ? "true" : "false";
      $("settingsWhatsapp").value = data.whatsapp || "";
      $("settingsPhone").value = data.phone || "";
      $("settingsFacebook").value = data.facebook || "";
      $("settingsTelegram").value = data.telegram || "";
      $("settingsLocation").value = data.location || "";
    } else {
      $("settingsVersion").value = 1;
      $("settingsTheme").value = "system";
      $("settingsMaintenance").value = "false";
      $("settingsWhatsapp").value = "";
      $("settingsPhone").value = "";
      $("settingsFacebook").value = "";
      $("settingsTelegram").value = "";
      $("settingsLocation").value = "";
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
      whatsapp: $("settingsWhatsapp").value.trim() || null,
      phone: $("settingsPhone").value.trim() || null,
      facebook: $("settingsFacebook").value.trim() || null,
      telegram: $("settingsTelegram").value.trim() || null,
      location: $("settingsLocation").value.trim() || null,
    });
    alert("تم حفظ الإعدادات");
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

// ===== Notifications — Simple Send =====
function soundForToken(tokenDoc) {
  const selected = tokenDoc.selectedSound || "default";
  if (selected === "sound1") return { sound: "sound1.wav", channelId: "sound-preset-1" };
  if (selected === "sound2") return { sound: "sound2.wav", channelId: "sound-preset-2" };
  if (selected === "sound3") return { sound: "sound3.wav", channelId: "sound-preset-3" };
  if (selected === "sound4") return { sound: "sound4.wav", channelId: "sound-preset-4" };
  return { sound: "notification.wav", channelId: "custom-sound" };
}

async function getRegisteredPushDevices() {
  const snap = await db.collection("push_tokens").get();
  const seen = new Set();
  const devices = [];
  snap.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    if (!data.token || seen.has(data.token)) return;
    seen.add(data.token);
    devices.push(data);
  });
  return devices;
}

async function sendExpoPushMessages(devices, notificationId, title, body, link) {
  let success = 0;
  let failure = 0;
  const messages = devices.map((device) => {
    const soundConfig = soundForToken(device);
    return {
      to: device.token,
      title,
      body,
      sound: soundConfig.sound,
      channelId: soundConfig.channelId,
      priority: "high",
      data: {
        id: notificationId,
        link: link || "",
      },
    };
  });

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const result = await response.json();
      const tickets = Array.isArray(result.data) ? result.data : [];
      tickets.forEach((ticket) => {
        if (ticket.status === "ok") success++;
        else failure++;
      });
      if (!tickets.length) failure += chunk.length;
    } catch (err) {
      failure += chunk.length;
    }
  }

  return { success, failure };
}

$("notifForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = $("notifTitle").value.trim();
  const body = $("notifBody").value.trim();
  const link = $("notifLink").value.trim() || null;

  const sendBtn = $("sendNotifBtn");
  const statusMsg = $("notifStatusMsg");
  sendBtn.disabled = true;
  sendBtn.textContent = "جاري الإرسال...";
  statusMsg.style.color = "var(--text-muted)";
  statusMsg.textContent = "جاري تحضير الإرسال وإبلاغ الخادم...";

  try {
    // إشعار داخل التطبيق فقط — يُكتب مباشرة بحالة "delivered"
    // بدون أي اعتماد على Cloud Functions أو إرسال Push حقيقي.
    // التطبيق (الموبايل) بيقرا من نفس الكولكشن ويعرضها في شاشة الإشعارات تلقائيًا.
    await db.collection("notifications").add({
      userId: "all",
      title,
      body,
      link: link || null,
      readStatus: false,
      opened: false,
      deliveryStatus: "delivered",
      createdAt: Date.now(),
    });

    statusMsg.style.color = "var(--success, #22c55e)";
    statusMsg.textContent = "✅ تم نشر الإشعار داخل التطبيق بنجاح";
    sendBtn.disabled = false;
    sendBtn.textContent = "🔔 إرسال للجميع";
    $("notifForm").reset();
    await loadNotifications();
    calculateStats();

  } catch (err) {
    statusMsg.style.color = "var(--danger, #ef4444)";
    statusMsg.textContent = "❌ خطأ: " + err.message;
    sendBtn.disabled = false;
    sendBtn.textContent = "🔔 إرسال للجميع";
  }
});

// ===== Notifications History =====
async function loadNotifications() {
  const snap = await db.collection("notifications").orderBy("createdAt", "desc").get();
  notificationsCache = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderNotifications();
}

function renderNotifications() {
  const body = $("notifHistoryBody");
  const searchVal = ($("notifSearch").value || "").toLowerCase();
  const filterStatus = $("notifFilterStatus").value;

  const filtered = notificationsCache.filter((n) => {
    const matchesSearch =
      (n.title && n.title.toLowerCase().includes(searchVal)) ||
      (n.body && n.body.toLowerCase().includes(searchVal));
    const matchesStatus = !filterStatus || n.deliveryStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">لا توجد سجلات مطابقة</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map((n) => {
      const dateLabel = n.createdAt ? new Date(n.createdAt).toLocaleString("ar-EG") : "-";
      const isDelivered = n.deliveryStatus === "delivered";
      const statusLabel = isDelivered ? "تم التسليم" : n.deliveryStatus === "failed" ? "فشل" : "معلق";
      const statusClass = isDelivered ? "delivered" : n.deliveryStatus === "failed" ? "failed" : "unread";
      const linkCell = n.link ? `<a href="${n.link}" target="_blank" style="direction:ltr;font-size:11px;word-break:break-all;">${n.link}</a>` : "-";
      return `
        <tr>
          <td><strong>${n.title || ""}</strong></td>
          <td style="font-size:12px;color:var(--text-muted);">${n.body || ""}</td>
          <td>${linkCell}</td>
          <td style="font-size:12px;">${dateLabel}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteHistoryItem('${n.id}')">حذف</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

$("notifSearch").addEventListener("input", renderNotifications);
$("notifFilterStatus").addEventListener("change", renderNotifications);

window.deleteHistoryItem = async (id) => {
  if (!confirm("هل تريد حذف هذا السجل بشكل نهائي؟")) return;
  try {
    await db.collection("notifications").doc(id).delete();
    await loadNotifications();
    calculateStats();
  } catch (err) {
    alert("خطأ في الحذف: " + err.message);
  }
};

function calculateStats() {
  let sent = 0;
  let delivered = 0;
  let opened = 0;
  let unread = 0;

  notificationsCache.forEach((n) => {
    sent++;
    if (n.deliveryStatus === "delivered") {
      delivered++;
      if (n.opened) opened++;
      else if (!n.readStatus) unread++;
    }
  });

  $("statsSent").textContent = sent;
  $("statsDelivered").textContent = delivered;
  $("statsOpened").textContent = opened;
  $("statsUnread").textContent = unread;
}

// ===== Device Statistics =====
async function loadDeviceStats() {
  try {
    const snap = await db.collection("push_tokens").get();
    const tokenDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const totalDevices = tokenDocs.length;
    const activeTokens = tokenDocs.filter((d) => d.token).length;
    const availableDevices = activeTokens;

    let lastRegTimestamp = null;
    tokenDocs.forEach((d) => {
      if (d.updatedAt) {
        if (!lastRegTimestamp || d.updatedAt > lastRegTimestamp) {
          lastRegTimestamp = d.updatedAt;
        }
      }
    });

    const lastRegLabel = lastRegTimestamp 
      ? new Date(lastRegTimestamp).toLocaleString("ar-EG") 
      : "-";

    $("statsDevices").textContent = totalDevices;
    $("statsActiveTokens").textContent = activeTokens;
    $("statsAvailableDevices").textContent = availableDevices;
    $("statsLastReg").textContent = lastRegLabel;

    // Conditionally show/hide warning message if it exists
    const statusMsg = ["", "⚠️ لا توجد أجهزة مسجلة حتى الآن."];
    const statusMsgElement = $("notifStatusMsg");
    if (activeTokens === 0) {
      statusMsgElement.textContent = "⚠️ لا توجد أجهزة مسجلة حتى الآن.";
      statusMsgElement.style.color = "var(--text-muted)";
    } else {
      if (statusMsgElement.textContent === "⚠️ لا توجد أجهزة مسجلة حتى الآن.") {
        statusMsgElement.textContent = "";
      }
    }
  } catch (err) {
    console.error("loadDeviceStats error:", err);
  }
}

// ===== Authentication =====
const ADMIN_CRED_DOC = "admin_credentials";
let isAuthenticated = false;

function checkAuth() {
  const session = sessionStorage.getItem("admin_auth");
  if (session === "true") {
    isAuthenticated = true;
    $("loginOverlay").classList.remove("open");
    $("logoutBtn").style.display = "inline-flex";
    return true;
  }
  isAuthenticated = false;
  $("loginOverlay").classList.add("open");
  $("logoutBtn").style.display = "none";
  return false;
}

async function verifyCredentials(username, password) {
  try {
    const doc = await db.collection("settings").doc(ADMIN_CRED_DOC).get();
    if (!doc.exists) {
      // First run: create default credentials
      const defaultUser = "admin";
      const defaultPass = "admin123";
      await db.collection("settings").doc(ADMIN_CRED_DOC).set({
        username: defaultUser,
        password: defaultPass,
        updatedAt: Date.now(),
      });
      return username === defaultUser && password === defaultPass;
    }
    const data = doc.data();
    return username === data.username && password === data.password;
  } catch (err) {
    console.error("Auth check error:", err);
    return false;
  }
}

async function handleLogin() {
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value.trim();
  const errorEl = $("loginError");

  if (!username || !password) {
    errorEl.textContent = "الرجاء إدخال اسم المستخدم وكلمة المرور";
    errorEl.style.display = "block";
    return;
  }

  const loginBtn = $("loginBtn");
  loginBtn.disabled = true;
  loginBtn.textContent = "جاري التحقق...";

  const valid = await verifyCredentials(username, password);
  if (valid) {
    sessionStorage.setItem("admin_auth", "true");
    isAuthenticated = true;
    $("loginOverlay").classList.remove("open");
    $("logoutBtn").style.display = "inline-flex";
    $("loginUsername").value = "";
    $("loginPassword").value = "";
    errorEl.style.display = "none";
  } else {
    errorEl.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
    errorEl.style.display = "block";
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "دخول";
}

function handleLogout() {
  sessionStorage.removeItem("admin_auth");
  isAuthenticated = false;
  $("logoutBtn").style.display = "none";
  $("loginOverlay").classList.add("open");
  $("loginUsername").value = "";
  $("loginPassword").value = "";
  $("loginError").style.display = "none";
}

async function loadAdminCredentials() {
  try {
    const doc = await db.collection("settings").doc(ADMIN_CRED_DOC).get();
    if (doc.exists) {
      $("adminUsername").value = doc.data().username || "admin";
      $("adminPassword").value = "";
    } else {
      $("adminUsername").value = "admin";
      $("adminPassword").value = "";
    }
  } catch {}
}

async function saveAdminCredentials() {
  const username = $("adminUsername").value.trim();
  const password = $("adminPassword").value.trim();
  const statusEl = $("adminCredStatus");

  if (!username || !password) {
    statusEl.textContent = "الرجاء إدخال اسم المستخدم وكلمة المرور";
    statusEl.style.color = "var(--danger)";
    return;
  }

  try {
    await db.collection("settings").doc(ADMIN_CRED_DOC).set({
      username,
      password,
      updatedAt: Date.now(),
    });
    statusEl.textContent = "✅ تم حفظ بيانات الدخول بنجاح";
    statusEl.style.color = "var(--success)";
    $("adminPassword").value = "";
  } catch (err) {
    statusEl.textContent = "❌ خطأ: " + err.message;
    statusEl.style.color = "var(--danger)";
  }
}

// Allow pressing Enter in login form
$("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});
$("loginUsername").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

// ===== Prices Management =====
const CLOUDINARY_CLOUD = "dnezvioxe";
const CLOUDINARY_UPLOAD_PRESET = "samara_uploads";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

let pricesCache = [];
let editingPriceId = null;
let priceUploadXhr = null;

async function loadPrices() {
  try {
    const snap = await db.collection("prices").orderBy("sortOrder", "asc").get();
    pricesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPrices();
  } catch (err) {
    console.error("loadPrices error:", err);
    pricesCache = [];
  }
}

function renderPrices() {
  const body = $("pricesBody");
  if (!pricesCache.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">لا توجد أسعار بعد</td></tr>';
    return;
  }
  body.innerHTML = pricesCache.map((p) => `
    <tr>
      <td>${p.sortOrder ?? "-"}</td>
      <td>${p.imageUrl ? `<img src="${p.imageUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" />` : "-"}</td>
      <td><strong>${p.title}</strong></td>
      <td style="color:var(--primary);font-weight:700;">${p.price}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.description || "-"}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick="editPrice('${p.id}')">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deletePrice('${p.id}')">حذف</button>
        </div>
      </td>
    </tr>
  `).join("");
}

$("addPriceBtn").addEventListener("click", () => openPriceForm(null));
$("priceCancelBtn").addEventListener("click", cancelPriceEdit);

function openPriceForm(item) {
  editingPriceId = item ? item.id : null;
  $("priceId").value = item ? item.id : "";
  $("priceTitle").value = item ? item.title : "";
  $("priceAmount").value = item ? item.price : "";
  $("priceDescription").value = item ? item.description || "" : "";
  $("priceSortOrder").value = item ? item.sortOrder ?? 0 : 0;
  $("priceImagePreview").style.display = item && item.imageUrl ? "block" : "none";
  if (item && item.imageUrl) {
    $("priceImagePreviewImg").src = item.imageUrl;
  }
  $("priceImageInput").value = "";
  $("priceCancelBtn").style.display = editingPriceId ? "inline-flex" : "none";
  hideUploadProgress();
  $("priceImageValidation").style.display = "none";
  updatePricePreview();
}

$("priceTitle").addEventListener("input", updatePricePreview);
$("priceAmount").addEventListener("input", updatePricePreview);
$("priceDescription").addEventListener("input", updatePricePreview);

function updatePricePreview() {
  const title = $("priceTitle").value.trim();
  const price = $("priceAmount").value.trim();
  const desc = $("priceDescription").value.trim();
  const previewImg = $("priceImagePreviewImg").src;
  let html = "";
  if (previewImg && $("priceImagePreview").style.display !== "none") {
    html += `<img src="${previewImg}" style="width:100%;max-width:200px;border-radius:12px;margin-bottom:12px;" />`;
  }
  html += title ? `<h3 style="font-size:18px;margin-bottom:4px;">${title}</h3>` : "";
  html += price ? `<p style="font-size:22px;font-weight:700;color:var(--primary);margin-bottom:8px;">${price}</p>` : "";
  html += desc ? `<p style="font-size:13px;color:var(--text-muted);line-height:1.6;">${desc}</p>` : "";
  $("pricePreview").innerHTML = html || '<span style="color:var(--text-muted);">سيتم عرض المعاينة هنا بعد إدخال البيانات.</span>';
}

function cancelPriceEdit() {
  if (priceUploadXhr) {
    priceUploadXhr.abort();
    priceUploadXhr = null;
  }
  editingPriceId = null;
  $("priceForm").reset();
  $("priceImagePreview").style.display = "none";
  $("priceCancelBtn").style.display = "none";
  hideUploadProgress();
  $("priceImageValidation").style.display = "none";
  $("pricePreview").innerHTML = '<span style="color:var(--text-muted);">سيتم عرض المعاينة هنا بعد إدخال البيانات.</span>';
}

function hideUploadProgress() {
  $("priceUploadProgress").style.display = "none";
  $("priceUploadProgressBar").style.width = "0%";
  $("priceUploadProgressText").textContent = "0%";
}

function showUploadProgress(percent) {
  $("priceUploadProgress").style.display = "block";
  $("priceUploadProgressBar").style.width = percent + "%";
  $("priceUploadProgressText").textContent = percent + "%";
}

$("priceImageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  const valEl = $("priceImageValidation");
  if (!ALLOWED_TYPES.includes(file.type)) {
    valEl.textContent = "نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP";
    valEl.style.display = "block";
    $("priceImageInput").value = "";
    return;
  }
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    valEl.textContent = "حجم الملف كبير جدًا. الحد الأقصى 5 ميجابايت";
    valEl.style.display = "block";
    $("priceImageInput").value = "";
    return;
  }
  valEl.style.display = "none";

  // Show local preview
  const reader = new FileReader();
  reader.onload = (ev) => {
    $("priceImagePreviewImg").src = ev.target.result;
    $("priceImagePreview").style.display = "block";
    updatePricePreview();
  };
  reader.readAsDataURL(file);
});

async function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    priceUploadXhr = xhr;

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      priceUploadXhr = null;
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch (err) {
          reject(new Error("فشل تحليل رد الخادم"));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error?.message || "فشل رفع الصورة"));
        } catch {
          reject(new Error("فشل رفع الصورة (كود: " + xhr.status + ")"));
        }
      }
    };

    xhr.onerror = () => {
      priceUploadXhr = null;
      reject(new Error("خطأ في الاتصال بالخادم"));
    };

    xhr.onabort = () => {
      priceUploadXhr = null;
      reject(new Error("تم إلغاء الرفع"));
    };

    xhr.send(formData);
  });
}

async function deleteCloudinaryImage(publicId) {
  // Try callable function; if unavailable (Spark plan / not deployed), silently skip
  try {
    const deleteFn = firebase.functions().httpsCallable("deleteCloudinaryImage");
    await deleteFn({ publicId });
  } catch (err) {
    // Not deployed or no Blaze plan — image stays orphaned on Cloudinary, which is harmless
    console.warn("Cloudinary delete skipped (function not deployed):", err.message);
  }
}

function extractPublicId(imageUrl) {
  // Cloudinary secure_url format:
  // https://res.cloudinary.com/{cloud}/image/upload/v1234567/{public_id}.{ext}
  try {
    const parts = imageUrl.split("/");
    const last = parts[parts.length - 1]; // e.g., abc123.jpg
    const secondLast = parts[parts.length - 2]; // e.g., v1234567
    if (secondLast && secondLast.startsWith("v") && !isNaN(parseInt(secondLast.substring(1)))) {
      // Versioned URL: /v1234567/abc123.jpg
      const dotIdx = last.lastIndexOf(".");
      return dotIdx > -1 ? last.substring(0, dotIdx) : last;
    }
    // Non-versioned URL: /abc123.jpg
    const dotIdx = last.lastIndexOf(".");
    return dotIdx > -1 ? last.substring(0, dotIdx) : last;
  } catch {
    return null;
  }
}

$("priceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("priceTitle").value.trim();
  const price = $("priceAmount").value.trim();
  const description = $("priceDescription").value.trim();
  const sortOrder = parseInt($("priceSortOrder").value) || 0;

  if (!title || !price) {
    alert("العنوان والسعر مطلوبان");
    return;
  }

  const saveBtn = e.target.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";

  try {
    let imageUrl = null;
    const fileInput = $("priceImageInput");

    if (fileInput.files && fileInput.files[0]) {
      showUploadProgress(0);
      imageUrl = await uploadToCloudinary(fileInput.files[0], showUploadProgress);
    } else if (editingPriceId) {
      const existing = pricesCache.find((p) => p.id === editingPriceId);
      if (existing && existing.imageUrl) imageUrl = existing.imageUrl;
    }

    const data = { title, price, description: description || null, imageUrl, sortOrder, updatedAt: Date.now() };

    if (editingPriceId) {
      await db.collection("prices").doc(editingPriceId).update(data);
    } else {
      data.createdAt = Date.now();
      await db.collection("prices").add(data);
    }

    cancelPriceEdit();
    await loadPrices();
    alert("تم حفظ السعر بنجاح");
  } catch (err) {
    hideUploadProgress();
    alert("خطأ: " + err.message);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "حفظ";
});

window.editPrice = (id) => {
  const item = pricesCache.find((p) => p.id === id);
  if (item) openPriceForm(item);
};

window.deletePrice = async (id) => {
  if (!confirm("هل تريد حذف هذا السعر؟")) return;
  try {
    const item = pricesCache.find((p) => p.id === id);

    // Delete image from Cloudinary if present
    if (item && item.imageUrl) {
      const publicId = extractPublicId(item.imageUrl);
      if (publicId) {
        await deleteCloudinaryImage(publicId);
      }
    }

    await db.collection("prices").doc(id).delete();
    await loadPrices();
  } catch (err) {
    alert("خطأ في الحذف: " + err.message);
  }
};

// ===== Init =====
async function init() {
  await loadAdminCredentials();

  if (!checkAuth()) {
    // Not authenticated — only show login, don't load data
    return;
  }

  await Promise.all([
    loadCategories(),
    loadGlobalButtons(),
    loadSettings(),
    loadNotifications().then(calculateStats),
    loadDeviceStats(),
    loadPrices(),
    loadRegions(),
  ]);
}

init();
