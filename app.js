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
    } else {
      $("settingsVersion").value = 1;
      $("settingsTheme").value = "system";
      $("settingsMaintenance").value = "false";
      $("settingsWhatsapp").value = "";
      $("settingsPhone").value = "";
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
    });
    alert("تم حفظ الإعدادات");
  } catch (err) {
    alert("خطأ: " + err.message);
  }
});

// ===== Notifications — Simple Send =====
$("notifForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = $("notifTitle").value.trim();
  const body = $("notifBody").value.trim();
  const link = $("notifLink").value.trim() || null;

  const sendBtn = $("sendNotifBtn");
  const statusMsg = $("notifStatusMsg");
  sendBtn.disabled = true;
  sendBtn.textContent = "جاري الإرسال...";
  statusMsg.textContent = "";

  try {
    // Fetch all registered push tokens
    const snap = await db.collection("push_tokens").get();
    const tokenDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.token);

    if (tokenDocs.length === 0) {
      statusMsg.textContent = "⚠️ لا توجد أجهزة مسجلة حتى الآن.";
      return;
    }

    // Build per-device messages (respect per-device channel preference)
    const messages = tokenDocs.map((d) => {
      const soundKey = d.selectedSound || d.sound || "default";
      const channelId = d.channelId || "custom-sound";
      return {
        to: d.token,
        sound: soundKey === "default" ? "default" : (soundKey.endsWith(".wav") ? soundKey : `${soundKey}.wav`),
        title,
        body,
        channelId,
        priority: "high",
        data: {
          screen: "notifications",
          link: link || "",
          createdAt: Date.now(),
        },
      };
    });

    let successCount = 0;
    let failureCount = 0;
    const now = Date.now();
    const batch = db.batch();

    // Send in chunks of 100 (Expo limit)
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const result = await resp.json();

      if (result.data) {
        for (let j = 0; j < result.data.length; j++) {
          const ticket = result.data[j];
          const isSuccess = ticket.status === "ok";
          if (isSuccess) {
            successCount++;
          } else {
            failureCount++;
            // Automatically clean up invalid tokens
            if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
              const failedToken = chunk[j].to;
              db.collection("push_tokens")
                .where("token", "==", failedToken)
                .get()
                .then((snap) => {
                  snap.forEach((doc) => {
                    doc.ref.delete().then(() => {
                      console.log("Automatically removed invalid token from Firestore:", failedToken);
                    });
                  });
                })
                .catch((e) => console.error("Error deleting stale token doc:", e));
            }
          }
        }
      }
    }

    // Save one summary record to notifications collection
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      userId: "all",
      title,
      body,
      link: link || null,
      deliveryStatus: successCount > 0 ? "delivered" : "failed",
      readStatus: false,
      opened: false,
      createdAt: now,
    });
    await batch.commit();

    statusMsg.style.color = successCount > 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)";
    statusMsg.textContent = `✅ تم الإرسال: ${successCount} جهاز بنجاح${failureCount > 0 ? ` · ${failureCount} فشل` : ""}`;
    $("notifForm").reset();
    await loadNotifications();
    calculateStats();
    await loadDeviceStats(); // Refresh device stats
  } catch (err) {
    statusMsg.style.color = "var(--danger, #ef4444)";
    statusMsg.textContent = "❌ خطأ: " + err.message;
  } finally {
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

// ===== Init =====
async function init() {
  await Promise.all([
    loadCategories(),
    loadGlobalButtons(),
    loadSettings(),
    loadNotifications().then(calculateStats),
    loadDeviceStats(),
  ]);
}

init();
