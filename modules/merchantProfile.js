// ===== Merchant Accounting Screen =====

let _profileMerchant = null;
let _profileInventory = null;
let _profilePrices = [];
let _profileTransactions = [];
let _profileInstallations = [];
let _profileUnsubscribers = [];

let editCategoryRow = null;
let editCategoryValue = "";

// Timezone-safe local date helpers
function getLocalYearMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getLocalYearMonthDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Month navigation: YYYY-MM string
let _selectedMonth = getLocalYearMonth();

// ===== Month Navigation =====

function changeAcctMonth(delta) {
  const [y, m] = _selectedMonth.split("-").map(Number);
  // Construct date in local timezone
  const d = new Date(y, m - 1 + delta, 1);
  _selectedMonth = getLocalYearMonth(d);
  renderAcctMonthLabel();
  renderAcctSummary();
  renderAcctStatement();
}

function renderAcctMonthLabel() {
  const el = document.getElementById("acctMonthLabel");
  if (!el) return;
  const [y, m] = _selectedMonth.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
  el.textContent = label;
}

function getSelectedMonthRange() {
  const [y, m] = _selectedMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    start: getLocalYearMonthDay(start),
    end: getLocalYearMonthDay(end),
  };
}

// ===== Open / Close =====

async function openMerchantProfile(merchantId) {
  stopProfileListeners();
  _profileMerchant = merchantsCache.find((m) => m.id === merchantId);
  if (!_profileMerchant) return;

  currentMerchantProfileId = merchantId;
  $("merchantListView").style.display = "none";
  $("accountingScreenView").style.display = "block";

  // Reset to current month on each open
  _selectedMonth = getLocalYearMonth();
  renderAcctMonthLabel();
  renderAcctSkeleton();
  await renderAcctData();
  startProfileListeners(merchantId);
}

function backToMerchantList() {
  stopProfileListeners();
  currentMerchantProfileId = null;
  _profileMerchant = null;
  _profileInventory = null;
  editCategoryRow = null;
  editCategoryValue = "";
  $("merchantListView").style.display = "block";
  $("accountingScreenView").style.display = "none";
}

function stopProfileListeners() {
  _profileUnsubscribers.forEach((u) => { try { u(); } catch {} });
  _profileUnsubscribers = [];
}

function startProfileListeners(merchantId) {
  const merchantUnsub = db.collection("merchants").doc(merchantId)
    .onSnapshot((snap) => {
      if (!snap.exists) return;
      _profileMerchant = { id: snap.id, ...snap.data() };
      const idx = merchantsCache.findIndex((m) => m.id === merchantId);
      if (idx !== -1) merchantsCache[idx] = _profileMerchant;
      if (!editCategoryRow) {
        renderAcctHeader();
        renderAcctSummary();
        renderAcctSettlement();
      }
    }, (err) => console.warn("[Profile] Merchant listener:", err));
  _profileUnsubscribers.push(merchantUnsub);

  const invUnsub = db.collection("merchant_inventory").doc(merchantId)
    .onSnapshot((snap) => {
      _profileInventory = snap.exists ? { id: snap.id, ...snap.data() } : null;
      if (!editCategoryRow) {
        renderAcctTable();
      }
    }, (err) => console.warn("[Profile] Inventory listener:", err));
  _profileUnsubscribers.push(invUnsub);

  const pricesUnsub = db.collection("merchant_card_prices")
    .orderBy("sortOrder", "asc")
    .onSnapshot((snap) => {
      _profilePrices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      inventoryCardPrices = _profilePrices;
      if (!editCategoryRow) {
        renderAcctTable();
      }
    }, (err) => console.warn("[Profile] Prices listener:", err));
  _profileUnsubscribers.push(pricesUnsub);

  const instUnsub = db.collection("merchant_installations")
    .where("merchantId", "==", merchantId)
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      _profileInstallations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!editCategoryRow) {
        renderAcctTable();
        renderAcctInstallations();
      }
    }, (err) => console.warn("[Profile] Installations listener:", err));
  _profileUnsubscribers.push(instUnsub);

  const txnsUnsub = db.collection("merchant_transactions").doc(merchantId).collection("items")
    .orderBy("createdAt", "desc")
    .limit(300)
    .onSnapshot((snap) => {
      _profileTransactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!editCategoryRow) {
        renderAcctSummary();
        renderAcctStatement();
      }
    }, (err) => console.warn("[Profile] Transactions listener:", err));
  _profileUnsubscribers.push(txnsUnsub);
}

// ===== Denormalize monthly stats to merchant doc (for list card display) =====

async function writeDenormalizedMonthlyStats(merchantId) {
  const currentMonth = getLocalYearMonth();
  const { start, end } = getSelectedMonthRange();

  let cardsAdded = 0;
  let cashCollected = 0;
  let installationsValue = 0;

  const [y, m] = currentMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const curEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

  const supportsInstallations = _profileMerchant && _profileMerchant.supportsInstallations !== false;

  _profileTransactions.forEach((tx) => {
    if (!tx.date || tx.date < `${currentMonth}-01` || tx.date > curEnd) return;
    if (tx.type === "card_inventory_added") {
      const meta = tx.metadata;
      if (meta?.entries) cardsAdded += meta.entries.reduce((s, e) => s + (e.count || 0), 0);
      else if (meta?.totalCards) cardsAdded += meta.totalCards;
    } else if (tx.type === "cash_collection") {
      cashCollected += Math.abs(tx.amount || 0);
    } else if (tx.type === "installation" && supportsInstallations) {
      installationsValue += Math.abs(tx.amount || 0);
    }
  });

  try {
    await db.collection("merchants").doc(merchantId).update({
      monthlyStatsPeriod: currentMonth,
      monthlyCardsAdded: cardsAdded,
      monthlyCashCollected: cashCollected,
      monthlyInstallationsValue: installationsValue,
    });
  } catch (err) {
    console.warn("[Profile] Failed to write monthly stats:", err.message);
  }
}

// ===== Skeleton =====

function renderAcctSkeleton() {
  const s = (w) => `<div class="acct-skeleton-line" style="width:${w};height:20px;background:var(--border);border-radius:4px;margin:4px 0;"></div>`;
  $("acctSummary").innerHTML = [1,2,3].map(() =>
    `<div style="padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">${s("40%")}${s("60%")}</div>`
  ).join("");
  $("acctTableBody").innerHTML = `<tr><td colspan="3" style="padding:32px;text-align:center;color:var(--text-muted);">جاري التحميل...</td></tr>`;
  $("acctSettlement").innerHTML = `<div style="height:100px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:12px;"></div>`;
}

// ===== Load Data =====

async function renderAcctData() {
  try {
    const m = _profileMerchant;
    await Promise.all([
      loadMerchantInventory(m.id).then((inv) => { _profileInventory = inv; }),
      loadInventoryPrices().then(() => { _profilePrices = inventoryCardPrices; }),
      loadTransactionHistory(m.id, 300).then((txns) => { _profileTransactions = txns; }),
      loadMerchantInstallations(m.id).then((insts) => { _profileInstallations = insts; }),
    ]);
    renderAcctHeader();
    renderAcctSummary();
    renderAcctTable();
    renderAcctSettlement();
    renderAcctStatement();
    renderAcctInstallations();
  } catch (err) {
    console.error("[Profile] renderAcctData error:", err);
  }
}

// ===== Header =====

function renderAcctHeader() {
  const m = _profileMerchant;
  if (!m) return;
  const statusLabel = m.status === "active" ? "نشط" : "غير نشط";
  const statusClass = m.status === "active" ? "active" : "disabled";
  const fbOk = m.firebaseAuthUid && m.firebaseAuthStatus === "active";
  const fbHtml = fbOk
    ? '<span style="color:#22c55e;">🟢 Firebase مفعل</span>'
    : m.firebaseAuthUid ? '<span style="color:#eab308;">🟡 يحتاج مزامنة</span>'
      : '<span style="color:#ef4444;">🔴 غير مفعل</span>';
  const lastAct = m.updatedAt
    ? (m.updatedAt.toDate ? m.updatedAt.toDate() : new Date(m.updatedAt)).toLocaleString("ar-EG")
    : "-";

  $("acctAvatar").textContent = (m.name || "?").charAt(0);
  $("acctName").textContent = m.name || "";
  $("acctStatusBadge").textContent = statusLabel;
  $("acctStatusBadge").className = "status-badge " + statusClass;
  $("acctCode").innerHTML = `<span style="font-family:monospace;direction:ltr;display:inline-block;">#${m.id}</span>`;
  $("acctPhone").innerHTML = `📞 ${escapeHtml(m.phone || "-")}`;
  $("acctFirebaseStatus").innerHTML = fbHtml;
  $("acctLastActivity").innerHTML = `🕐 ${lastAct}`;

  // Hide installations action button if supportsInstallations is false
  const supportsInstallations = m.supportsInstallations !== false;
  const addInstBtn = document.querySelector("#acctMoreMenu button[onclick*='openInstallationModal']");
  if (addInstBtn) {
    addInstBtn.style.display = supportsInstallations ? "block" : "none";
  }
}

// ===== Monthly Summary Calculation (filtered by selected month) =====

function getFilteredMonthlySummary() {
  const { start, end } = getSelectedMonthRange();
  let totalCardsAdded = 0;
  let totalCashCollected = 0;
  let totalInstallationsValue = 0;

  const supportsInstallations = _profileMerchant && _profileMerchant.supportsInstallations !== false;

  _profileTransactions.forEach((tx) => {
    if (!tx.date || tx.date < start || tx.date > end) return;
    if (tx.type === "card_inventory_added") {
      const meta = tx.metadata;
      if (meta?.entries) {
        meta.entries.forEach((e) => {
          totalCardsAdded += e.count || 0;
        });
      } else if (meta?.totalCards) {
        totalCardsAdded += meta.totalCards;
      }
    } else if (tx.type === "cash_collection") {
      totalCashCollected += Math.abs(tx.amount || 0);
    } else if (tx.type === "installation" && supportsInstallations) {
      totalInstallationsValue += Math.abs(tx.amount || 0);
    }
  });

  // Expected profit from CURRENT inventory, not from transactions
  const acctStats = getAccountingStats();
  const totalExpectedProfit = acctStats.grandExpectedProfit;

  return { totalCardsAdded, totalCashCollected, totalInstallationsValue, totalExpectedProfit };
}

// ===== Summary Dashboard =====

function renderAcctSummary() {
  if (!_profileMerchant) return;
  const stats = getFilteredMonthlySummary();
  const supportsInstallations = _profileMerchant.supportsInstallations !== false;

  let summaryHtml = `
    <div class="acct-summary-card" style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.15);">
      <div class="acct-summary-icon" style="color:var(--primary);">📦</div>
      <div class="acct-summary-value info">${stats.totalCardsAdded.toLocaleString("ar-SA")}</div>
      <div class="acct-summary-label">كروت مضافة هذا الشهر</div>
    </div>
    <div class="acct-summary-card" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);">
      <div class="acct-summary-icon" style="color:var(--success);">💵</div>
      <div class="acct-summary-value positive">${stats.totalCashCollected.toLocaleString("ar-SA")} ج.م</div>
      <div class="acct-summary-label">محصل نقداً هذا الشهر</div>
    </div>`;

  if (supportsInstallations) {
    summaryHtml += `
      <div class="acct-summary-card" style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);">
        <div class="acct-summary-icon" style="color:#8b5cf6;">🔧</div>
        <div class="acct-summary-value purple">${stats.totalInstallationsValue.toLocaleString("ar-SA")} ج.م</div>
        <div class="acct-summary-label">قيمة التركيبات هذا الشهر</div>
      </div>`;
  }

  summaryHtml += `
    <div class="acct-summary-card" style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);">
      <div class="acct-summary-icon" style="color:#f59e0b;">💰</div>
      <div class="acct-summary-value warning">${stats.totalExpectedProfit.toLocaleString("ar-SA")} ج.م</div>
      <div class="acct-summary-label">الربح المتوقع</div>
    </div>
    <div class="acct-summary-card" style="background:rgba(16,185,129,0.1);border:2px solid rgba(16,185,129,0.3);">
      <div class="acct-summary-icon" style="color:#10b981;">⚖️</div>
      <div class="acct-summary-value positive">${(_profileMerchant.currentBalance || 0).toLocaleString("ar-SA")} ج.م</div>
      <div class="acct-summary-label">الرصيد الحالي</div>
    </div>`;

  $("acctSummary").innerHTML = summaryHtml;
}

// ===== Accounting Stats (live inventory — NEVER affected by month) =====

function getAccountingStats() {
  const inv = _profileInventory;
  const categories = _profilePrices
    .filter((p) => p.status !== "inactive" || (inv?.entries?.find((e) => e.category === p.id || e.category === p.category)?.count ?? 0) > 0)
    .map((p) => p.category);

  if (inv?.entries) {
    inv.entries.forEach((e) => {
      if (e.count > 0) {
        const match = _profilePrices.find((p) => p.id === e.category || p.category === e.category);
        const name = match ? match.category : e.category;
        if (!categories.includes(name)) categories.push(name);
      }
    });
  }

  let grandCardsCount = 0;
  let grandCategoryTotal = 0;
  let grandExpectedProfit = 0;

  const rows = categories.map((cat) => {
    const priceDoc = _profilePrices.find((p) => p.category === cat || p.id === cat);
    const merchantPrice = priceDoc ? (priceDoc.merchantPrice || 0) : 0;
    const sellingPrice = priceDoc ? (priceDoc.sellingPrice || 0) : 0;
    const docId = priceDoc ? priceDoc.id : cat;

    const invEntry = inv?.entries?.find((e) => e.category === docId || e.category === cat);
    const cardsCount = invEntry?.count ?? 0;
    const rowTotal = cardsCount * merchantPrice;
    const profitPerCard = sellingPrice - merchantPrice;
    const categoryProfit = cardsCount * profitPerCard;

    grandCardsCount += cardsCount;
    grandCategoryTotal += rowTotal;
    grandExpectedProfit += categoryProfit;

    return { category: cat, id: docId, merchantPrice, sellingPrice, cardsCount, rowTotal, profitPerCard, categoryProfit };
  });

  return { rows, grandCardsCount, grandCategoryTotal, grandExpectedProfit };
}

// ===== Accounting Table =====

function renderAcctTable() {
  const tbody = $("acctTableBody");
  const tfoot = $("acctTableTotals");
  if (!tbody) return;

  const stats = getAccountingStats();
  const supportsInstallations = _profileMerchant && _profileMerchant.supportsInstallations !== false;

  let rowsHtml = stats.rows.map((row) => {
    const isEditing = editCategoryRow === row.id;
    let countCell;
    let profitCell;

    if (isEditing) {
      const numVal = parseInt(editCategoryValue) || 0;
      const diff = numVal - row.cardsCount;
      const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff >= 0 ? "var(--success)" : "var(--danger)";

      countCell = `
        <td style="background:rgba(59,130,246,0.1);padding:8px;vertical-align:middle;">
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px;">
            <input type="number" id="inlineEditInput" value="${editCategoryValue}"
              oninput="handleInlineEditInput('${row.id}',this.value,${row.cardsCount},${row.merchantPrice})"
              style="width:72px;padding:4px 6px;border:1px solid var(--primary);border-radius:4px;text-align:center;background:var(--surface);color:var(--text);font-size:14px;" />
            <button onclick="saveInlineEdit('${row.id}')" style="background:var(--success);color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:13px;">✓</button>
            <button onclick="cancelInlineEdit()" style="background:var(--text-muted);color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:13px;">×</button>
          </div>
          <div style="font-size:10px;color:var(--text-muted);text-align:center;">
            السابق: ${row.cardsCount} &rarr; الجديد: <span id="previewNewVal">${numVal}</span> &rarr;
            الفرق: <span id="previewDiffVal" style="color:${diffColor};font-weight:700;">${diffText}</span>
          </div>
        </td>`;
      const editingProfit = numVal * row.profitPerCard;
      profitCell = `<td class="profit-cell" id="rowProfit_${row.id}" style="text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:var(--success);">${editingProfit.toLocaleString("ar-SA")} ج.م</td>`;
    } else {
      countCell = `
        <td class="num-cell" onclick="startInlineEdit('${row.id}',${row.cardsCount})"
          title="اضغط للتعديل"
          style="cursor:pointer;text-align:center;vertical-align:middle;font-weight:600;font-size:16px;">
          ${row.cardsCount.toLocaleString("ar-EG")}
        </td>`;
      profitCell = `<td class="profit-cell" style="text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:var(--success);">${row.categoryProfit.toLocaleString("ar-SA")} ج.م</td>`;
    }

    const displayTotal = isEditing ? (parseInt(editCategoryValue) || 0) * row.merchantPrice : row.rowTotal;

    return `
      <tr style="${isEditing ? "background:rgba(59,130,246,0.06);" : ""}">
        <td class="category-cell" style="text-align:right;vertical-align:middle;padding:10px 12px;">
          <div style="font-weight:700;font-size:14px;">فئة ${escapeHtml(row.category)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">سعر التاجر: ${row.merchantPrice.toLocaleString("ar-SA")} ج.م</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">سعر البيع: ${row.sellingPrice.toLocaleString("ar-SA")} ج.م</div>
        </td>
        ${countCell}
        <td class="total-cell" id="rowTotal_${row.id}" style="text-align:center;vertical-align:middle;font-weight:700;font-size:15px;">
          ${displayTotal.toLocaleString("ar-SA")} ج.م
        </td>
        ${profitCell}
      </tr>`;
  }).join("");

  // Installations row
  const instCount = supportsInstallations ? _profileInstallations.length : 0;
  const instTotal = supportsInstallations ? _profileInstallations.reduce((s, i) => s + (i.price || 0), 0) : 0;
  if (supportsInstallations) {
    rowsHtml += `
      <tr onclick="openInstDetailsModal()" style="cursor:pointer;background:rgba(139,92,246,0.04);">
        <td style="text-align:right;vertical-align:middle;padding:10px 12px;border-right:3px solid #8b5cf6;" colspan="2">
          <div style="font-weight:700;font-size:14px;color:#8b5cf6;">🔧 التركيبات</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">اضغط لعرض التفاصيل</div>
        </td>
        <td style="text-align:center;vertical-align:middle;font-weight:700;font-size:15px;color:#8b5cf6;">
          ${instTotal.toLocaleString("ar-SA")} ج.م
        </td>
        <td style="text-align:center;vertical-align:middle;font-weight:600;font-size:14px;color:#8b5cf6;">
          ${instCount.toLocaleString("ar-SA")} تركيب
        </td>
      </tr>`;
  }

  tbody.innerHTML = rowsHtml || `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted);">لا توجد فئات أسعار. أضف فئات من إعدادات أسعار الكروت.</td></tr>`;

  // Footer totals
  let liveCardsCount = stats.grandCardsCount;
  let liveCategoryTotal = stats.grandCategoryTotal;
  if (editCategoryRow) {
    const row = stats.rows.find((r) => r.id === editCategoryRow);
    if (row) {
      const n = parseInt(editCategoryValue) || 0;
      liveCardsCount = stats.rows.reduce((s, r) => s + (r.id === editCategoryRow ? n : r.cardsCount), 0);
      liveCategoryTotal = stats.rows.reduce((s, r) => s + (r.id === editCategoryRow ? n * r.merchantPrice : r.rowTotal), 0);
    }
  }

  const balance = _profileMerchant ? (_profileMerchant.currentBalance || 0) : 0;

  tfoot.innerHTML = `
    <tr style="background:var(--surface-hover);border-top:2px solid var(--border);">
      <td colspan="4" style="padding:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div style="text-align:center;padding:8px;background:var(--surface);border-radius:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">إجمالي الكروت</div>
            <div id="grandCardsCountCell" style="font-weight:800;font-size:18px;color:var(--primary);">${liveCardsCount.toLocaleString("ar-SA")}</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--surface);border-radius:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">قيمة الكروت</div>
            <div id="grandTotalCell" style="font-weight:800;font-size:18px;color:var(--primary);">${liveCategoryTotal.toLocaleString("ar-SA")} ج.م</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--surface);border-radius:6px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">قيمة التركيبات</div>
            <div id="grandInstTotalCell" style="font-weight:800;font-size:18px;color:#8b5cf6;">${instTotal.toLocaleString("ar-SA")} ج.م</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--surface);border-radius:6px;grid-column:span 3;border:2px solid rgba(16,185,129,0.2);">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">الرصيد الحالي</div>
            <div id="currentBalanceCell" style="font-weight:800;font-size:20px;color:#10b981;">${balance.toLocaleString("ar-SA")} ج.م</div>
          </div>
        </div>
      </td>
    </tr>`;
}

// ===== Inline Edit =====

function startInlineEdit(rowId, currentCount) {
  editCategoryRow = rowId;
  editCategoryValue = String(currentCount);
  renderAcctTable();
  setTimeout(() => {
    const inp = document.getElementById("inlineEditInput");
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

function handleInlineEditInput(rowId, val, prevCount, price) {
  editCategoryValue = val;
  const numVal = parseInt(val) || 0;
  const diff = numVal - prevCount;
  const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
  const diffColor = diff >= 0 ? "var(--success)" : "var(--danger)";

  const newValSpan = document.getElementById("previewNewVal");
  if (newValSpan) newValSpan.textContent = numVal;

  const diffValSpan = document.getElementById("previewDiffVal");
  if (diffValSpan) {
    diffValSpan.textContent = diffText;
    diffValSpan.style.color = diffColor;
  }

  const stats = getAccountingStats();
  const row = stats.rows.find((r) => r.id === rowId);
  const profitPerCard = row ? row.profitPerCard : 0;

  const rowTotalSpan = document.getElementById(`rowTotal_${rowId}`);
  if (rowTotalSpan) {
    rowTotalSpan.textContent = `${(numVal * price).toLocaleString("ar-SA")} ج.م`;
  }

  const rowProfitSpan = document.getElementById(`rowProfit_${rowId}`);
  if (rowProfitSpan) {
    rowProfitSpan.textContent = `${(numVal * profitPerCard).toLocaleString("ar-SA")} ج.م`;
  }

  // Update totals live in DOM
  const supportsInstallations = _profileMerchant && _profileMerchant.supportsInstallations !== false;
  const instTotal = supportsInstallations ? _profileInstallations.reduce((s, i) => s + (i.price || 0), 0) : 0;

  let liveCardsCount = stats.grandCardsCount;
  let liveCategoryTotal = stats.grandCategoryTotal;

  if (editCategoryRow) {
    const n = numVal;
    liveCardsCount = stats.rows.reduce((s, r) => s + (r.id === editCategoryRow ? n : r.cardsCount), 0);
    liveCategoryTotal = stats.rows.reduce((s, r) => s + (r.id === editCategoryRow ? n * r.merchantPrice : r.rowTotal), 0);
  }

  const cardsCountCell = document.getElementById("grandCardsCountCell");
  if (cardsCountCell) {
    cardsCountCell.textContent = `${liveCardsCount.toLocaleString("ar-SA")}`;
  }

  const grandTotalCell = document.getElementById("grandTotalCell");
  if (grandTotalCell) {
    grandTotalCell.textContent = `${liveCategoryTotal.toLocaleString("ar-SA")} ج.م`;
  }

  // Update grand installations total cell
  const grandInstTotalCell = document.getElementById("grandInstTotalCell");
  if (grandInstTotalCell) {
    grandInstTotalCell.textContent = `${instTotal.toLocaleString("ar-SA")} ج.م`;
  }
}

function cancelInlineEdit() {
  editCategoryRow = null;
  editCategoryValue = "";
  renderAcctTable();
}

async function saveInlineEdit(rowId) {
  const m = _profileMerchant;
  if (!m) return;
  const stats = getAccountingStats();
  const row = stats.rows.find((r) => r.id === rowId);
  if (!row) return;

  const newVal = parseInt(editCategoryValue) ?? 0;
  if (isNaN(newVal) || newVal < 0) { showToast("يرجى إدخال عدد صحيح", "warning"); return; }

  const oldVal = row.cardsCount;
  const diff = newVal - oldVal;
  if (diff === 0) { cancelInlineEdit(); return; }

  const priceDoc = _profilePrices.find((p) => p.id === rowId || p.category === row.category);
  if (!priceDoc) { showToast("فئة السعر غير متوفرة", "error"); return; }

  const merchantPrice = priceDoc.merchantPrice || 0;
  const totalValueDiff = Math.abs(diff) * merchantPrice;
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const date = getLocalYearMonthDay();
  const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const currentMonth = getLocalYearMonth();
  // Manual inventory corrections always use "adjustment" type, never card_settlement
  const txnType = "adjustment";
  const txnNotes = diff > 0
    ? `تعديل عهدة: إضافة ${diff} كارت فئة ${row.category}`
    : `تعديل عهدة: خصم ${Math.abs(diff)} كارت فئة ${row.category}`;

  try {
    await db.runTransaction(async (transaction) => {
      const invRef = db.collection("merchant_inventory").doc(m.id);
      const merchantRef = db.collection("merchants").doc(m.id);

      const [invDoc, merchantDocSnap] = await Promise.all([
        transaction.get(invRef),
        transaction.get(merchantRef),
      ]);

      // Read current merchant data for balance tracking
      const mData = merchantDocSnap.exists ? merchantDocSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;

      // Build new entries using category name as canonical key
      const invData = invDoc.exists ? invDoc.data() : { entries: [] };
      const entriesMap = {};
      (invData.entries || []).forEach((e) => {
        const priceMatch = _profilePrices.find((p) => p.id === e.category || p.category === e.category);
        const canonicalKey = priceMatch ? priceMatch.category : e.category;
        entriesMap[canonicalKey] = e.count || 0;
      });
      // Set the new value under the canonical category name
      const priceMatch = _profilePrices.find((p) => p.id === rowId || p.category === rowId);
      const canonicalRowCategory = priceMatch ? priceMatch.category : row.category;
      entriesMap[canonicalRowCategory] = newVal;

      const newEntries = Object.entries(entriesMap)
        .filter(([, cnt]) => cnt > 0)
        .map(([category, count]) => ({ category, count }));
      const newTotalCards = newEntries.reduce((s, e) => s + e.count, 0);
      const newTotalValue = newEntries.reduce((s, e) => {
        const p = _profilePrices.find((cp) => cp.id === e.category || cp.category === e.category)?.merchantPrice || 0;
        return s + e.count * p;
      }, 0);

      const newBalance = oldBalance + (diff > 0 ? totalValueDiff : -totalValueDiff);
      const isSameMonth = (mData.monthlyStatsPeriod || "") === currentMonth;

      // Inventory doc
      if (invDoc.exists) {
        transaction.update(invRef, { entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue, updatedAt: now });
      } else {
        transaction.set(invRef, { merchantId: m.id, entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue, createdAt: now, updatedAt: now });
      }

      // Merchant doc — only update counters, NOT totalSettlements (this is not a settlement)
      const updateData = {
        totalCards: newTotalCards,
        totalCardValue: newTotalValue,
        currentBalance: newBalance,
        updatedAt: now,
      };
      if (diff > 0) {
        updateData.monthlyStatsPeriod = currentMonth;
        updateData.monthlyCardsAdded = isSameMonth
          ? firebase.firestore.FieldValue.increment(diff)
          : diff;
      }
      transaction.update(merchantRef, updateData);

      // Transaction record with full balance tracing
      const txnRef = db.collection("merchant_transactions").doc(m.id).collection("items").doc();
      transaction.set(txnRef, {
        type: txnType, merchantId: m.id,
        amount: diff > 0 ? totalValueDiff : -totalValueDiff,
        balanceBefore: oldBalance,
        balanceAfter: newBalance,
        date, time, createdBy: "admin", notes: txnNotes,
        priceSnapshot: getPriceSnapshot(),
        metadata: {
          entries: [{ category: canonicalRowCategory, count: Math.abs(diff), price: merchantPrice }],
          totalCards: Math.abs(diff), totalValue: totalValueDiff,
          adjustmentType: diff > 0 ? "inventory_added" : "inventory_removed",
        },
        createdAt: now, updatedAt: now,
      });

      // Audit
      const auditRef = db.collection("merchant_audit_logs").doc();
      transaction.set(auditRef, {
        action: "create", collection: "merchant_adjustment", docId: m.id,
        oldValue: { count: oldVal, balance: oldBalance },
        newValue: { count: newVal, balance: newBalance },
        performedBy: "admin", reason: txnNotes,
        timestamp: now, date, time,
      });

      createMerchantNotification({
        merchantId: m.id, userId: mData.username,
        type: txnType, title: "تعديل عهدة",
        body: txnNotes,
        relatedDocumentId: m.id,
        data: { category: canonicalRowCategory, oldCount: oldVal, newCount: newVal, diff, price: merchantPrice },
        transaction,
      });
    });

    cancelInlineEdit();
    showToast("✅ تم حفظ التعديل", "success");
  } catch (err) {
    showToast("خطأ: " + err.message, "error");
  }
}

// ===== Cash Collection =====

function renderAcctSettlement() {
  const m = _profileMerchant;
  if (!m) return;
  const totalCollections = m.totalCollections ?? 0;

  $("acctSettlement").innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-top:12px;">
      <h4 style="margin:0 0 12px;font-size:15px;">💵 تسجيل تحصيل نقدي</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;text-align:center;">
        <div style="background:var(--surface-hover);padding:8px;border-radius:var(--radius-sm);">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">المبلغ المحصل السابق</div>
          <div style="font-weight:700;font-size:15px;">${totalCollections.toLocaleString("ar-SA")} ج.م</div>
        </div>
        <div style="background:var(--surface-hover);padding:8px;border-radius:var(--radius-sm);">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">المبلغ الجديد</div>
          <div id="newCollectVal" style="font-weight:700;font-size:15px;color:var(--success);">${totalCollections.toLocaleString("ar-SA")} ج.م</div>
        </div>
        <div style="background:var(--surface-hover);padding:8px;border-radius:var(--radius-sm);">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">الفرق</div>
          <div id="diffCollectVal" style="font-weight:700;font-size:15px;color:var(--primary);">+0 ج.م</div>
        </div>
      </div>
      <input type="number" id="settlementReceiveInput" placeholder="أدخل المبلغ المحصل نقداً" min="0" step="0.01"
        oninput="updateAcctSettlementHint()"
        style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:15px;background:var(--surface);color:var(--text);margin-bottom:10px;box-sizing:border-box;" />
      <button onclick="saveProfileSettlement()"
        style="width:100%;padding:12px;background:var(--success);color:white;border:none;border-radius:var(--radius-sm);font-size:15px;font-weight:700;cursor:pointer;">
        💾 حفظ التحصيل النقدي
      </button>
    </div>`;
}

function updateAcctSettlementHint() {
  const m = _profileMerchant;
  if (!m) return;
  const receive = parseFloat($("settlementReceiveInput")?.value) || 0;
  const prev = m.totalCollections ?? 0;
  const newEl = $("newCollectVal");
  const diffEl = $("diffCollectVal");
  if (newEl) newEl.textContent = `${(prev + receive).toLocaleString("ar-SA")} ج.م`;
  if (diffEl) diffEl.textContent = `+${receive.toLocaleString("ar-SA")} ج.م`;
}

async function saveProfileSettlement() {
  const m = _profileMerchant;
  if (!m) return;
  const receive = parseFloat($("settlementReceiveInput")?.value) || 0;
  if (receive <= 0) { showToast("يرجى إدخال مبلغ التحصيل", "warning"); return; }
  if (!confirm(`تأكيد تسجيل تحصيل نقدي بقيمة ${receive.toLocaleString("ar-SA")} ج.م؟`)) return;

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const date = getLocalYearMonthDay();
  const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const currentMonth = getLocalYearMonth();

  try {
    await db.runTransaction(async (transaction) => {
      const merchantRef = db.collection("merchants").doc(m.id);
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;
      const newBalance = oldBalance - receive;
      const oldCollections = mData.totalCollections || 0;
      const isSameMonth = (mData.monthlyStatsPeriod || "") === currentMonth;

      const beforeState = {
        currentBalance: mData.currentBalance || 0,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: mData.installationCount ?? 0,
      };
      const afterState = {
        currentBalance: newBalance,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: oldCollections + receive,
        installationCount: mData.installationCount ?? 0,
      };

      transaction.update(merchantRef, {
        totalCollections: oldCollections + receive,
        currentBalance: newBalance,
        updatedAt: now,
        monthlyStatsPeriod: currentMonth,
        monthlyCashCollected: isSameMonth
          ? (mData.monthlyCashCollected || 0) + receive
          : receive,
      });

      const txnRef = db.collection("merchant_transactions").doc(m.id).collection("items").doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        type: "cash_collection", merchantId: m.id, amount: -receive,
        balanceBefore: oldBalance, balanceAfter: newBalance,
        date, time, createdBy: "admin",
        notes: `استلام نقدي: ${receive.toLocaleString("ar-SA")} ج.م`,
        metadata: { receiveAmount: receive },
        createdAt: now, updatedAt: now,
        operationId: txnRef.id,
        operationType: "cash_collection",
        before: beforeState,
        after: afterState,
        timestamp: Date.now(),
      });

      const auditRef = db.collection("merchant_audit_logs").doc();
      transaction.set(auditRef, {
        action: "create", collection: "merchant_transactions", docId: txnRef.id,
        oldValue: { totalCollections: oldCollections },
        newValue: { totalCollections: oldCollections + receive },
        performedBy: "admin", reason: "تحصيل نقدي", timestamp: now, date, time,
      });

      createMerchantNotification({
        merchantId: m.id, userId: mData.username,
        type: "cash_collection", title: "استلام نقدي",
        body: `تم استلام ${receive.toLocaleString("ar-SA")} ج.م`,
        relatedDocumentId: m.id,
        data: { receiveAmount: receive },
        transaction,
      });
    });

    $("settlementReceiveInput").value = "";
    showToast(`✅ تم تسجيل التحصيل (${receive.toLocaleString("ar-SA")} ج.م)`, "success");
  } catch (err) {
    showToast("خطأ: " + err.message, "error");
  }
}

// ===== Account Statement =====

function renderAcctStatement() {
  const container = $("acctStatementTimeline");
  if (!container) return;

  const { start, end } = getSelectedMonthRange();
  const typeFilter = $("stmtFilterType")?.value || "";

  let txns = (_profileTransactions || []).filter((t) => {
    const dateOk = t.date && t.date >= start && t.date <= end;
    const typeOk = !typeFilter || t.type === typeFilter;
    return dateOk && typeOk;
  });

  if (!txns.length) {
    container.innerHTML = `<div class="acct-statement-empty">لا توجد معاملات للشهر المختار</div>`;
    return;
  }

  const groups = {};
  txns.forEach((t) => {
    const d = t.date || "بدون تاريخ";
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  });

  const labels = {
    card_inventory_added: { label: "كروت عهدة", icon: "📦", color: "#3B82F6" },
    card_settlement:      { label: "حساب كروت", icon: "🧮", color: "#EF4444" },
    cash_collection:      { label: "استلام نقدي", icon: "💵", color: "#10B981" },
    installation:         { label: "تركيب",       icon: "🔧", color: "#8B5CF6" },
    adjustment:           { label: "تعديل",       icon: "✏️", color: "#F59E0B" },
  };

  container.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map((date) => `
    <div class="acct-statement-day">
      <div class="acct-statement-day-header">${date}</div>
      ${groups[date].map((t) => {
        const info = labels[t.type] || { label: t.type, icon: "📋", color: "#64748B" };
        const amt = Math.abs(t.amount || 0);
        const isPos = t.type === "card_inventory_added" || t.type === "installation";
        return `
          <div class="acct-statement-item">
            <div class="acct-statement-item-icon" style="background:${info.color}20;color:${info.color};">${info.icon}</div>
            <div class="acct-statement-item-body">
              <div class="acct-statement-item-type">${info.label}</div>
              <div class="acct-statement-item-notes">${escapeHtml(t.notes || "")}</div>
            </div>
            <div class="acct-statement-item-amount" style="color:${isPos ? "var(--success)" : "var(--danger)"};font-weight:700;">
              ${isPos ? "+" : "-"}${amt.toLocaleString("ar-SA")} ج.م
            </div>
          </div>`;
      }).join("")}
    </div>`).join("");
}

function printAcctStatement() {
  const m = _profileMerchant;
  if (!m) return;
  const win = window.open("", "_blank", "width=800,height=600");
  win.document.write(`<html dir="rtl"><head><title>كشف حساب - ${m.name}</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;}h1{font-size:18px;}table{width:100%;border-collapse:collapse;font-size:13px;}th,td{border:1px solid #ddd;padding:8px;text-align:center;}th{background:#f5f5f5;}</style>
    </head><body><h1>كشف حساب: ${escapeHtml(m.name)}</h1>
    <p style="color:#666;font-size:12px;">الهاتف: ${escapeHtml(m.phone || "-")} | التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
    ${document.getElementById("acctStatementTimeline")?.innerHTML || ""}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ===== Installations Modal =====

function openInstDetailsModal() {
  renderAcctInstallations();
  $("instDetailsModal").classList.add("open");
}

function renderAcctInstallations() {
  const container = $("instDetailsList");
  if (!container) return;
  const insts = _profileInstallations || [];

  if (!insts.length) {
    container.innerHTML = `<p style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد تركيبات مسجلة</p>`;
    return;
  }

  const statusLabels = { completed: "مكتمل", pending: "معلق", cancelled: "ملغي" };
  const statusColors = { completed: "var(--success)", pending: "#eab308", cancelled: "var(--danger)" };

  container.innerHTML = insts.map((inst) => `
    <div style="padding:14px;background:var(--surface-hover);border-radius:var(--radius-sm);border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex;flex-direction:column;gap:4px;text-align:right;flex:1;">
          <span style="font-weight:700;font-size:15px;">${escapeHtml(inst.customerName || "بدون اسم")}</span>
          ${inst.customerPhone ? `<span style="font-size:12px;color:var(--text-muted);direction:ltr;text-align:right;">📞 ${escapeHtml(inst.customerPhone)}</span>` : ""}
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">
            ${inst.region ? `<span style="font-size:11px;color:var(--text-muted);background:var(--surface);padding:2px 8px;border-radius:4px;">📍 ${escapeHtml(inst.region)}</span>` : ""}
            ${inst.subscriptionType ? `<span style="font-size:11px;color:var(--text-muted);background:var(--surface);padding:2px 8px;border-radius:4px;">📋 ${escapeHtml(inst.subscriptionType)}</span>` : ""}
            <span style="font-size:11px;color:var(--text-muted);background:var(--surface);padding:2px 8px;border-radius:4px;">📅 ${inst.date || ""}</span>
            ${inst.status ? `<span style="font-size:11px;color:${statusColors[inst.status] || "var(--text-muted)"};background:var(--surface);padding:2px 8px;border-radius:4px;font-weight:600;">${statusLabels[inst.status] || inst.status}</span>` : ""}
          </div>
          ${inst.notes ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:2px;">📝 ${escapeHtml(inst.notes)}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-right:12px;">
          <span style="font-weight:700;font-size:16px;color:var(--success);white-space:nowrap;">${(inst.price || 0).toLocaleString("ar-SA")} ج.م</span>
          <button onclick="deleteInstallation('${inst.id}')"
            style="background:var(--danger);color:white;border:none;padding:4px 10px;border-radius:var(--radius-xs);cursor:pointer;font-size:12px;">حذف</button>
        </div>
      </div>
    </div>`).join("");
}

// ===== Refresh profile (called after save/delete operations) =====

function refreshMerchantProfile() {
  if (!_profileMerchant) return;
  renderAcctHeader();
  renderAcctSummary();
  renderAcctTable();
  renderAcctSettlement();
  renderAcctStatement();
  renderAcctInstallations();
}

// ===== Refresh (month change) =====

function refreshAccountingScreen() {
  renderAcctSummary();
  renderAcctStatement();
}

// ===== Reset Merchant =====

async function confirmResetMerchant() {
  if (!currentMerchantProfileId) return;
  if (!confirm(
    "هل أنت متأكد من إعادة تعيين التاجر؟\n\nسيتم مسح:\n• العهدة (الكروت)\n• التركيبات\n• سجل المعاملات\n• إجماليات المحاسبة\n\n⚠️ لن يتم حذف:\n• حساب التاجر\n• بيانات تسجيل الدخول\n• معلوماته الشخصية\n• أسعار الكروت"
  )) return;

  try {
    const id = currentMerchantProfileId;
    const batch = db.batch();

    batch.update(db.collection("merchants").doc(id), {
      totalCards: 0, totalCardValue: 0, totalSettlements: 0,
      totalCollections: 0, currentBalance: 0, installationCount: 0,
      monthlyCardsAdded: 0, monthlyCashCollected: 0, monthlyInstallationsValue: 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const invDoc = await db.collection("merchant_inventory").doc(id).get();
    if (invDoc.exists) {
      batch.update(invDoc.ref, { entries: [], totalCards: 0, totalValue: 0, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    const instSnap = await db.collection("merchant_installations").where("merchantId", "==", id).get();
    instSnap.docs.forEach((d) => batch.delete(d.ref));

    const txSnap = await db.collection("merchant_transactions").doc(id).collection("items").get();
    txSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    try {
      const resetMerchant = _profileMerchant?.username
        ? _profileMerchant
        : merchantsCache?.find((m) => m.id === id);
      await createMerchantNotification({
        merchantId: id, userId: resetMerchant?.username || "all",
        type: "merchant_reset",
        title: "إعادة تعيين بيانات التاجر",
        body: "تم إعادة تعيين جميع البيانات المحاسبية (العهدة، التركيبات، المعاملات)",
        relatedDocumentId: id,
      });
    } catch (notifErr) { console.warn("[Profile] Notification failed:", notifErr); }
    showToast("✅ تم إعادة تعيين التاجر", "success");
    await loadMerchants();
  } catch (err) {
    showToast("خطأ: " + err.message, "error");
  }
}

// ===== Audit Log =====

async function showAcctAuditLog() {
  if (!currentMerchantProfileId) return;
  const entries = await loadAuditLog(currentMerchantProfileId, 30);
  const container = $("acctStatementTimeline");
  if (!entries.length) { container.innerHTML = `<div class="acct-statement-empty">لا توجد عمليات</div>`; return; }
  const labels = { create: "إنشاء", update: "تعديل", archive: "أرشفة", delete: "حذف" };
  container.innerHTML = entries.map((e) => `
    <div class="acct-statement-item">
      <div class="acct-statement-item-icon" style="background:var(--primary)22;color:var(--primary);">📋</div>
      <div class="acct-statement-item-body">
        <div class="acct-statement-item-type">${labels[e.action] || e.action}</div>
        <div class="acct-statement-item-notes">${e.collection || ""} ${e.reason ? "— " + e.reason : ""}</div>
      </div>
      <div class="acct-statement-item-amount" style="font-size:11px;color:var(--text-muted);font-weight:400;">${e.date || ""} ${e.time || ""}</div>
    </div>`).join("");
}

// ===== Archive =====

async function toggleMerchantArchive() {
  const m = _profileMerchant;
  if (!m) return;
  if (m.status === "archived") { showToast("التاجر مؤرشف بالفعل", "warning"); return; }
  if (!confirm(`أرشفة التاجر "${m.name}"؟`)) return;
  try {
    await db.collection("merchants").doc(m.id).update({ status: "archived", updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await recordAudit("archive", "merchants", m.id, { status: m.status }, { status: "archived" }, "أرشفة");
    try {
      await createMerchantNotification({
        merchantId: m.id, userId: m.username,
        type: "merchant_archived",
        title: "أرشفة التاجر",
        body: `تم أرشفة التاجر ${m.name}`,
        relatedDocumentId: m.id,
      });
    } catch (notifErr) { console.warn("[Profile] Notification failed:", notifErr); }
    await loadMerchants();
    showToast(`✅ تم أرشفة "${m.name}"`, "success");
    backToMerchantList();
  } catch (err) { showToast("خطأ: " + err.message, "error"); }
}

// ===== More Menu =====

function toggleAcctMoreMenu() {
  const menu = $("acctMoreMenu");
  const isOpen = menu.classList.contains("open");
  menu.classList.toggle("open");
  if (!isOpen) {
    const close = (e) => {
      if (!e.target.closest(".acct-action-more-wrap")) { menu.classList.remove("open"); document.removeEventListener("click", close); }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
}

// ===== Window exports =====
window.openMerchantProfile = openMerchantProfile;
window.backToMerchantList = backToMerchantList;
window.changeAcctMonth = changeAcctMonth;
window.refreshAccountingScreen = refreshAccountingScreen;
window.refreshMerchantProfile = refreshMerchantProfile;
window.saveProfileSettlement = saveProfileSettlement;
window.updateAcctSettlementHint = updateAcctSettlementHint;
window.toggleAcctMoreMenu = toggleAcctMoreMenu;
window.showAcctAuditLog = showAcctAuditLog;
window.toggleMerchantArchive = toggleMerchantArchive;
window.printAcctStatement = printAcctStatement;
window.renderAcctStatement = renderAcctStatement;
window.confirmResetMerchant = confirmResetMerchant;
window.startInlineEdit = startInlineEdit;
window.handleInlineEditInput = handleInlineEditInput;
window.cancelInlineEdit = cancelInlineEdit;
window.saveInlineEdit = saveInlineEdit;
window.openInstDetailsModal = openInstDetailsModal;
