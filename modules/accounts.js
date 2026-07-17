// ===== Accounts Module (Orchestrator) — New ERP Design =====

let currentMerchantProfileId = null;
let _accountsData = null;
let _accountsDataDirty = true;
let _pricesLoaded = false;
let _currentFilter = "all";
let _searchTerm = "";

const FILTER_OPTIONS = [
  { id: "all", label: "الكل" },
  { id: "active", label: "نشط" },
  { id: "inactive", label: "غير نشط" },
  { id: "archived", label: "مؤرشف" },
  { id: "has_balance", label: "لديه رصيد" },
  { id: "zero_balance", label: "رصيد صفري" },
  { id: "has_inventory", label: "لديه كروت" },
  { id: "supports_installations", label: "يدعم التركيبات" },
];

function markAccountsDirty() {
  _accountsDataDirty = true;
}

async function _ensureAccountsData() {
  if (!_pricesLoaded) {
    try { await loadInventoryPrices(); } catch (e) { console.warn("[Accounts] Prices load failed:", e); }
    _pricesLoaded = true;
  }
  if (_accountsDataDirty || !_accountsData) {
    try {
      const snap = await db.collection("merchants")
        .orderBy("createdAt", "desc")
        .get();
      _accountsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log("[Accounts] Fetched", _accountsData.length, "merchants");
    } catch (e) {
      console.error("[Accounts] Failed to load merchants:", e);
      _accountsData = [];
    }
    merchantsCache = _accountsData;
    _accountsDataDirty = false;
  }
  return _accountsData;
}

// Composite index required for server-side archived filtering:
// firestore.indexes.json:
// {
//   "indexes": [
//     {
//       "collectionGroup": "merchants",
//       "queryScope": "COLLECTION",
//       "fields": [
//         { "fieldPath": "status", "order": "ASCENDING" },
//         { "fieldPath": "createdAt", "order": "DESCENDING" }
//       ]
//     }
//   ]
// }

function initAccounts() {
  return _ensureAccountsData();
}

function getFilteredMerchants() {
  let data = _accountsData || [];
  const rawCount = data.length;
  const term = _searchTerm.toLowerCase().trim();

  if (term) {
    data = data.filter((m) =>
      (m.name || "").toLowerCase().includes(term) ||
      (m.phone || "").includes(term) ||
      (m.username || "").toLowerCase().includes(term) ||
      (m.id || "").toLowerCase().includes(term)
    );
    console.log("[Accounts] Search filter:", term, "reduced from", rawCount, "to", data.length);
  }

  switch (_currentFilter) {
    case "all":
      data = data.filter((m) => m.status !== "archived");
      break;
    case "active":
      data = data.filter((m) => m.status === "active");
      break;
    case "inactive":
      data = data.filter((m) => m.status === "inactive");
      break;
    case "archived":
      data = data.filter((m) => m.status === "archived");
      break;
    case "has_balance":
      data = data.filter((m) => (m.currentBalance || 0) > 0);
      break;
    case "zero_balance":
      data = data.filter((m) => !m.currentBalance || m.currentBalance === 0);
      break;
    case "has_inventory":
      data = data.filter((m) => (m.totalCards || 0) > 0);
      break;
    case "supports_installations":
      data = data.filter((m) => m.supportsInstallations === true);
      break;
  }

  console.log("[Accounts] Filtered: raw=", rawCount, "filter=", _currentFilter, "result=", data.length);
  return data;
}

function renderFilterChips() {
  const container = $("merchantFilterChips");
  if (!container) return;
  container.innerHTML = FILTER_OPTIONS.map((f) =>
    `<button class="filter-chip${_currentFilter === f.id ? " active" : ""}" onclick="setMerchantFilter('${f.id}')">${f.label}</button>`
  ).join("");
}

function setMerchantFilter(filterId) {
  _currentFilter = filterId;
  renderFilterChips();
  renderMerchantCards();
}

function filterMerchantCards() {
  _searchTerm = $("merchantSearchInput")?.value || "";
  renderMerchantCards();
}

function renderMerchantCards() {
  const grid = $("merchantGrid");
  const stats = $("merchantListStats");
  if (!grid) return;

  const filtered = getFilteredMerchants();

  // Stats bar
  const total = _accountsData ? _accountsData.length : 0;
  const active = _accountsData ? _accountsData.filter((m) => m.status === "active").length : 0;
  const totalBal = _accountsData ? _accountsData.reduce((s, m) => s + (m.currentBalance || 0), 0) : 0;
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><span class="stat-num">${total}</span><span class="stat-label">إجمالي التجار</span></div>
      <div class="stat-card"><span class="stat-num">${active}</span><span class="stat-label">نشط</span></div>
      <div class="stat-card"><span class="stat-num">${filtered.length}</span><span class="stat-label">المعروض</span></div>
      <div class="stat-card"><span class="stat-num">${totalBal.toLocaleString("ar-SA")}</span><span class="stat-label">إجمالي الرصيد</span></div>
    `;
  }

  console.log("[Accounts] renderMerchantCards: total=", total, "filtered=", filtered.length, "filter=", _currentFilter, "search=", _searchTerm);

  if (!filtered.length) {
    const hasFilters = _currentFilter !== "all" || _searchTerm;
    grid.innerHTML = hasFilters
      ? `<div class="merchant-empty-state"><div class="merchant-empty-state-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><div class="merchant-empty-state-text">لا توجد نتائج</div><div class="merchant-empty-state-hint">حاول تغيير معايير البحث أو الفلتر</div></div>`
      : `<div class="merchant-empty-state"><div class="merchant-empty-state-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></div><div class="merchant-empty-state-text">لا يوجد تجار بعد</div><div class="merchant-empty-state-hint">قم بإضافة تاجر جديد للبدء</div><button class="btn btn-primary" onclick="openMerchantModal()">+ إضافة تاجر</button></div>`;
    return;
  }

  grid.innerHTML = filtered.map((m) => renderMerchantCard(m)).join("");
  console.log("[Accounts] Rendered", filtered.length, "merchant cards (total fetched:", total + ")");
}

function renderMerchantCard(m) {
  const initial = (m.name || "?").charAt(0);
  const statusLabel = m.status === "active" ? "نشط" : m.status === "inactive" ? "موقوف" : "مؤرشف";
  const statusClass = m.status === "active" ? "active" : m.status === "inactive" ? "inactive" : "archived";
  const fbOk = m.firebaseAuthUid && m.firebaseAuthStatus === "active";
  const fbLabel = fbOk ? "Firebase مفعل" : m.firebaseAuthUid ? "يحتاج مزامنة" : "غير مفعل";
  const fbClass = fbOk ? "firebase-ok" : m.firebaseAuthUid ? "firebase-pending" : "firebase-missing";
  const lastAct = m.updatedAt
    ? (m.updatedAt.toDate ? m.updatedAt.toDate() : new Date(m.updatedAt)).toLocaleString("ar-EG")
    : "-";

  // Monthly stats — read from denormalized fields on the merchant document
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const statsMonth = m.monthlyStatsPeriod || "";
  const isSameMonth = statsMonth === currentMonth;

  const monthlyCardsAdded = isSameMonth ? (m.monthlyCardsAdded || 0) : 0;
  const monthlyCashCollected = isSameMonth ? (m.monthlyCashCollected || 0) : 0;
  const monthlyInstallationsValue = isSameMonth ? (m.monthlyInstallationsValue || 0) : 0;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("ar-SA", { month: "long", year: "numeric" });

  return `
    <div class="merchant-card" onclick="openMerchantProfile('${m.id}')">
      <div class="merchant-card-top">
        <div class="merchant-avatar">${initial}</div>
        <div class="merchant-card-info">
          <div class="merchant-card-name">
            ${escapeHtml(m.name || "")}
          </div>
          <div class="merchant-card-code">#${m.id}</div>
          <div class="merchant-card-phone" dir="ltr">${escapeHtml(m.phone || "")}</div>
        </div>
        <div class="merchant-card-badges">
          <span class="merchant-card-badge ${statusClass}">${statusLabel}</span>
          <span class="merchant-card-badge ${fbClass}" title="حالة Firebase Auth">${fbLabel}</span>
        </div>
      </div>

      <div style="font-size:10px;color:var(--text-muted);text-align:center;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border);">
        إحصائيات ${monthLabel}
      </div>

      <div class="merchant-card-stats">
        <div class="merchant-card-stat">
          <div class="merchant-card-stat-value info">${monthlyCardsAdded.toLocaleString("ar-SA")}</div>
          <div class="merchant-card-stat-label">كروت مضافة</div>
        </div>
        <div class="merchant-card-stat">
          <div class="merchant-card-stat-value positive">${monthlyCashCollected.toLocaleString("ar-SA")}</div>
          <div class="merchant-card-stat-label">محصل نقداً</div>
        </div>
        <div class="merchant-card-stat">
          <div class="merchant-card-stat-value" style="color:#8b5cf6;">${monthlyInstallationsValue.toLocaleString("ar-SA")}</div>
          <div class="merchant-card-stat-label">قيمة التركيبات</div>
        </div>
      </div>

      <div class="merchant-card-last-activity">آخر نشاط: ${lastAct}</div>
      <div class="merchant-card-actions" onclick="event.stopPropagation()">
        <button class="merchant-card-action primary" onclick="openMerchantProfile('${m.id}')">فتح</button>
        <button class="merchant-card-action" onclick="openMerchantModal('${m.id}')">تعديل</button>
        <button class="merchant-card-action ${m.status === 'archived' ? '' : 'danger'}" onclick="toggleMerchantCardStatus('${m.id}')">
          ${m.status === "archived" ? "إلغاء الأرشفة" : m.status === "active" ? "إيقاف" : "تفعيل"}
        </button>
        <div class="merchant-card-more">
          <button class="merchant-card-action" onclick="toggleCardMoreMenu(event, '${m.id}')">المزيد ▼</button>
        </div>
      </div>
    </div>
  `;
}

function toggleCardMoreMenu(event, merchantId) {
  event.stopPropagation();
  
  let menu = $("globalMerchantMoreMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "globalMerchantMoreMenu";
    menu.className = "merchant-card-more-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = "99999";
    menu.style.display = "none";
    document.body.appendChild(menu);
  }

  const isCurrentlyOpenForThisMerchant = menu.style.display === "block" && menu.dataset.merchantId === merchantId;
  
  if (isCurrentlyOpenForThisMerchant) {
    menu.style.display = "none";
    return;
  }

  menu.dataset.merchantId = merchantId;
  const m = (_accountsData || []).find((x) => x.id === merchantId) || (merchantsCache || []).find((x) => x.id === merchantId) || {};
  
  menu.innerHTML = `
    <button onclick="openStatementModal('${m.id}'); closeGlobalMerchantMenu();">📊 كشف الحساب</button>
    <button onclick="openInstallationModal('${m.id}'); closeGlobalMerchantMenu();">🔧 إضافة تركيب</button>
    <button onclick="archiveMerchant('${m.id}'); closeGlobalMerchantMenu();">📦 أرشفة</button>
    <button onclick="resetMerchantFromCard('${m.id}'); closeGlobalMerchantMenu();">🔄 إعادة تعيين المحاسبة</button>
    <button onclick="viewMerchantAuditLogFromCard('${m.id}'); closeGlobalMerchantMenu();">📋 سجل العمليات</button>
    <button onclick="deleteMerchant('${m.id}'); closeGlobalMerchantMenu();" style="color:var(--danger); font-weight:600;">🗑️ حذف التاجر</button>
  `;

  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  
  menu.style.visibility = "hidden";
  menu.style.display = "block";
  const menuHeight = menu.offsetHeight || 250;
  menu.style.visibility = "visible";
  
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  
  let top;
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    top = rect.top - menuHeight - 4;
  } else {
    top = rect.bottom + 4;
  }
  
  let left = rect.left;
  const menuWidth = menu.offsetWidth || 180;
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 12;
  }
  
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  const closeHandler = (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.style.display = "none";
      document.removeEventListener("click", closeHandler);
    }
  };
  
  setTimeout(() => {
    document.addEventListener("click", closeHandler);
  }, 0);
}

function closeGlobalMerchantMenu() {
  const menu = $("globalMerchantMoreMenu");
  if (menu) {
    menu.style.display = "none";
  }
}
window.closeGlobalMerchantMenu = closeGlobalMerchantMenu;


async function toggleMerchantCardStatus(id) {
  const m = merchantsCache.find((x) => x.id === id);
  if (!m) return;
  const newStatus = m.status === "active" ? "inactive" : "active";
  try {
    await db.collection("merchants").doc(id).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await recordAudit("update", "merchants", id, { status: m.status }, { status: newStatus },
      newStatus === "active" ? "تفعيل التاجر" : "إيقاف التاجر");

    createMerchantNotification({
      merchantId: id, userId: m.username,
      type: newStatus === "active" ? "merchant_restored" : "merchant_archived",
      title: newStatus === "active" ? "تفعيل التاجر" : "إيقاف التاجر",
      body: `تم ${newStatus === "active" ? "تفعيل" : "إيقاف"} التاجر ${m.name}`,
      relatedDocumentId: id,
    });

    await loadMerchants();
    _accountsData = merchantsCache;
    _accountsDataDirty = false;
    renderMerchantCards();
    showToast(newStatus === "active" ? "تم تفعيل التاجر بنجاح" : "تم إيقاف التاجر", "success");
  } catch (err) {
    showToast("خطأ: " + err.message, "error");
  }
}

async function deleteMerchant(id) {
  const m = (_accountsData || []).find((x) => x.id === id) || (merchantsCache || []).find((x) => x.id === id);
  if (!m) {
    showToast("خطأ: لم يتم العثور على بيانات التاجر", "error");
    return;
  }

  const confirmMsg = `هل أنت متأكد من حذف التاجر "${m.name}" وكل بياناته المحاسبية بشكل نهائي؟\n\n⚠️ تحذير: سيتم حذف:\n• الحساب وبيانات تسجيل الدخول\n• العهدة والمخزون\n• التركيبات والعمليات السابقة\n\nلا يمكن التراجع عن هذا الإجراء!`;
  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    const batch = db.batch();

    // 1. Delete merchant document
    batch.delete(db.collection("merchants").doc(id));

    // 2. Delete merchant inventory document
    batch.delete(db.collection("merchant_inventory").doc(id));

    // 3. Delete merchant installations
    const instSnap = await db.collection("merchant_installations").where("merchantId", "==", id).get();
    instSnap.docs.forEach((d) => batch.delete(d.ref));

    // 4. Delete merchant transactions subcollection items & parent doc
    const txSnap = await db.collection("merchant_transactions").doc(id).collection("items").get();
    txSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("merchant_transactions").doc(id));

    // 5. Delete merchant notifications (both collections)
    const notifSnap = await db.collection("merchant_notifications").where("merchantId", "==", id).get();
    notifSnap.docs.forEach((d) => batch.delete(d.ref));
    const notifSnap2 = await db.collection("notifications").where("merchantId", "==", id).get();
    notifSnap2.docs.forEach((d) => batch.delete(d.ref));

    // Commit all deletions in a single batch
    await batch.commit();

    // 6. Log the operation in the audit log
    const oldValue = { name: m.name, phone: m.phone, username: m.username, status: m.status };
    await recordAudit("delete", "merchants", id, oldValue, null, "حذف التاجر وكل بياناته بشكل نهائي");

    createMerchantNotification({
      merchantId: id, userId: m.username,
      type: "merchant_deleted",
      title: "حذف التاجر",
      body: `تم حذف التاجر ${m.name} وكل بياناته بشكل نهائي`,
      relatedDocumentId: id,
    });

    showToast(`تم حذف التاجر "${m.name}" بنجاح`, "success");

    // 7. Refresh list immediately
    markAccountsDirty();
    if (typeof loadMerchants === "function") {
      await loadMerchants();
    }
    _accountsData = merchantsCache;
    _accountsDataDirty = false;
    renderMerchantCards();
  } catch (err) {
    console.error("[Accounts] Delete merchant failed:", err);
    showToast("خطأ أثناء حذف التاجر: " + err.message, "error");
  }
}

async function resetMerchantFromCard(merchantId) {
  // Set the current merchant profile ID first so confirmResetMerchant knows which merchant to reset
  currentMerchantProfileId = merchantId;
  if (typeof confirmResetMerchant === "function") {
    await confirmResetMerchant();
  } else {
    showToast("خطأ: وظيفة إعادة التعيين غير متوفرة", "error");
  }
  // Reset currentMerchantProfileId to null if profile is not open
  currentMerchantProfileId = null;
  
  // Refresh accounts UI
  markAccountsDirty();
  if (typeof loadMerchants === "function") {
    await loadMerchants();
  }
  _accountsData = merchantsCache;
  _accountsDataDirty = false;
  renderMerchantCards();
}

async function viewMerchantAuditLogFromCard(merchantId) {
  if (typeof openMerchantProfile === "function" && typeof showAcctAuditLog === "function") {
    await openMerchantProfile(merchantId);
    await showAcctAuditLog();
    const el = $("acctStatementTimeline");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  } else {
    showToast("خطأ: وظيفة سجل العمليات غير متوفرة", "error");
  }
}

async function renderAccountsDashboard() {
  const container = $("accountsDashboard");
  if (!container) return;
  // Dashboard is now inline in merchantGrid stats; this is a no-op for back compat
}

async function renderAccountsMerchantList() {
  await _ensureAccountsData();
  renderFilterChips();
  renderMerchantCards();
}

// ===== Tab Activation =====

async function onAccountsTabActivated(subTab) {
  if (typeof closeGlobalMerchantMenu === "function") {
    closeGlobalMerchantMenu();
  }
  // Always re-fetch from Firestore when tab is activated
  _accountsDataDirty = true;
  _pricesLoaded = false;
  _currentFilter = "all";
  _searchTerm = "";
  await initAccounts();

  if (subTab === "profile" && currentMerchantProfileId) {
    $("merchantListView").style.display = "none";
    $("accountingScreenView").style.display = "block";
    if (typeof openMerchantProfile === "function") {
      await openMerchantProfile(currentMerchantProfileId);
    }
  } else {
    $("merchantListView").style.display = "block";
    $("accountingScreenView").style.display = "none";
    // Reset search input
    const searchInput = $("merchantSearchInput");
    if (searchInput) searchInput.value = "";
    await renderAccountsMerchantList();
  }
}

async function refreshAccountsUI() {
  if ($("merchantListView")?.style.display !== "none") {
    await renderAccountsMerchantList();
  }
}

// ===== Toast System =====

function showToast(message, type) {
  type = type || "success";
  const container = $("toastContainer");
  if (!container) return;

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Window exports =====

window.showToast = showToast;
window.refreshAccountsUI = refreshAccountsUI;
window.markAccountsDirty = markAccountsDirty;
window.initAccounts = initAccounts;
window.onAccountsTabActivated = onAccountsTabActivated;
window.renderAccountsDashboard = renderAccountsDashboard;
window.renderAccountsMerchantList = renderAccountsMerchantList;
window.filterMerchantCards = filterMerchantCards;
window.setMerchantFilter = setMerchantFilter;
window.toggleCardMoreMenu = toggleCardMoreMenu;
window.toggleMerchantCardStatus = toggleMerchantCardStatus;
window.deleteMerchant = deleteMerchant;
window.resetMerchantFromCard = resetMerchantFromCard;
window.viewMerchantAuditLogFromCard = viewMerchantAuditLogFromCard;

// ===== Debug helper =====
window.debugAccounts = function() {
  console.log("[Accounts DEBUG] ============");
  console.log("[Accounts DEBUG] _accountsData:", _accountsData ? _accountsData.length + " items" : "null");
  console.log("[Accounts DEBUG] _accountsDataDirty:", _accountsDataDirty);
  console.log("[Accounts DEBUG] _currentFilter:", _currentFilter);
  console.log("[Accounts DEBUG] _searchTerm:", _searchTerm);
  console.log("[Accounts DEBUG] merchantsCache:", merchantsCache ? merchantsCache.length + " items" : "null");
  console.log("[Accounts DEBUG] currentMerchantProfileId:", currentMerchantProfileId);
  if (_accountsData && _accountsData.length > 0) {
    console.log("[Accounts DEBUG] First merchant:", JSON.stringify(_accountsData[0], null, 2));
    console.log("[Accounts DEBUG] All merchant IDs:", _accountsData.map(m => m.id + "(" + m.name + ",status=" + m.status + ",createdAt=" + (m.createdAt ? "yes" : "no") + ")").join(", "));
  }
  console.log("[Accounts DEBUG] Filtered count:", getFilteredMerchants().length);
  console.log("[Accounts DEBUG] ============");
};
