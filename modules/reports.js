// ===== Reports Module =====
// Financial reports: transaction history, merchant statement, PDF/Excel export

let currentReportMerchantId = null;

async function loadTransactionHistory(merchantId, limit = 100) {
  try {
    const snap = await db.collection("merchant_transactions").doc(merchantId)
      .collection("items")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Reports] Load transactions failed:", err.message);
    return [];
  }
}

function renderTransactionTable(transactions, containerId) {
  const container = $(containerId);
  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">لا توجد معاملات</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table" style="font-size:13px;">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الوقت</th>
          <th>النوع</th>
          <th>البيان</th>
          <th style="text-align:left;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map((t) => `
          <tr>
            <td style="font-size:12px;">${escapeHtml(t.date || "-")}</td>
            <td style="font-size:12px;">${escapeHtml(t.time || "-")}</td>
            <td>${getTransactionTypeLabel(t.type)}</td>
            <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.notes || "-")}</td>
            <td style="text-align:left;font-weight:600;color:${t.amount < 0 ? "var(--danger)" : "var(--success)"};">${(t.amount || 0).toLocaleString("ar-SA")} ج.م</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function getTransactionTypeLabel(type) {
  const labels = {
    card_inventory_added: "عهدة",
    card_settlement: "تسوية كروت",
    cash_collection: "تحصيل نقدي",
    installation: "تركيب",
    adjustment: "تعديل",
    inventory_added: "إضافة كروت",
    migration: "ترحيل",
  };
  return labels[type] || type || "-";
}

function renderReportMetrics(txns) {
  // Use AccountingEngine for all summary calculations
  var settlementTotal = AccountingEngine.computeSettlementTotal(txns);
  var summary = AccountingEngine.computeMonthlySummary(txns, null, null);
  var cardsValue = 0;
  (txns || []).forEach(function (t) {
    if (t.type === "card_inventory_added") cardsValue += Math.abs(t.amount || 0);
  });
  return `
    <div class="metric-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:12px;">
      <div style="font-size:12px;color:var(--text-muted);">قيمة الكروت المضافة</div>
      <div style="font-size:18px;font-weight:700;color:var(--success);">
        ${cardsValue.toLocaleString("ar-SA")} ج.م
      </div>
    </div>
    <div class="metric-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:12px;">
      <div style="font-size:12px;color:var(--text-muted);">قيمة تسويات الكروت</div>
      <div style="font-size:18px;font-weight:700;color:var(--danger);">
        ${settlementTotal.toLocaleString("ar-SA")} ج.م
      </div>
    </div>
    <div class="metric-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xs);padding:12px;">
      <div style="font-size:12px;color:var(--text-muted);">قيمة التركيبات</div>
      <div style="font-size:18px;font-weight:700;">
        ${summary.installationsValue.toLocaleString("ar-SA")} ج.م
      </div>
    </div>`;
}

function openStatementModal(merchantId) {
  const merchant = merchantsCache.find((m) => m.id === merchantId);
  currentReportMerchantId = merchantId;
  $("stmtModalTitle").textContent = `كشف حساب — ${merchant ? merchant.name : ""}`;
  $("stmtLoading").style.display = "block";
  $("stmtContent").innerHTML = "";
  $("stmtModal").classList.add("open");

  // Load last 50 transactions immediately
  loadTransactionHistory(merchantId, 50).then((txns) => {
    $("stmtLoading").style.display = "none";
    window._stmtTxns = txns;
    renderStatementContent(txns);
  });
}

function renderStatementContent(txns) {
  $("stmtContent").innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <input type="date" id="stmtFilterFrom" class="search-input" style="width:auto;flex:1;min-width:120px;" />
      <input type="date" id="stmtFilterTo" class="search-input" style="width:auto;flex:1;min-width:120px;" />
      <select id="stmtFilterType" class="search-input" style="width:auto;flex:1;min-width:120px;">
        <option value="">جميع المعاملات</option>
        <option value="card_inventory_added">عهدة</option>
        <option value="card_settlement">تسوية كروت</option>
        <option value="cash_collection">تحصيل نقدي</option>
        <option value="installation">تركيب</option>
        <option value="adjustment">تعديل</option>
      </select>
      <button class="btn btn-sm" onclick="applyStmtFilters()" style="background:var(--primary);color:white;border:none;padding:8px 16px;border-radius:var(--radius-xs);cursor:pointer;">تصفية</button>
      <button class="btn btn-sm" onclick="printStatement()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);padding:8px 16px;border-radius:var(--radius-xs);cursor:pointer;">🖨️ طباعة</button>
    </div>
    <div style="margin-bottom:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
      ${renderReportMetrics(txns)}
    </div>
    <div id="stmtTableContainer"></div>
  `;

  renderTransactionTable(txns.slice(0, 50), "stmtTableContainer");
  window._stmtFilteredTxns = txns;
}

function applyStmtFilters() {
  const from = $("stmtFilterFrom")?.value;
  const to = $("stmtFilterTo")?.value;
  const type = $("stmtFilterType")?.value;

  let filtered = window._stmtTxns || [];

  if (from) filtered = filtered.filter((t) => t.date >= from);
  if (to) filtered = filtered.filter((t) => t.date <= to);
  if (type) filtered = filtered.filter((t) => t.type === type);

  renderStatementContent(filtered);
}

function printStatement() {
  const merchant = merchantsCache.find((m) => m.id === currentReportMerchantId);
  if (!merchant) return;

  const content = document.getElementById("stmtContent");
  if (!content) return;

  const printWin = window.open("", "_blank", "width=800,height=600");
  printWin.document.write(`
    <html dir="rtl">
    <head><title>كشف حساب - ${merchant.name}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 40px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
      th { background: #f5f5f5; }
      .total { font-weight: bold; font-size: 15px; margin-top: 16px; }
      @media print { body { padding: 20px; } }
    </style>
    </head>
    <body>
      <h1>كشف حساب التاجر: ${escapeHtml(merchant.name)}</h1>
      <div class="meta">الهاتف: ${escapeHtml(merchant.phone || "-")} | التاريخ: ${new Date().toLocaleDateString("ar-SA")}</div>
      ${content.querySelector("#stmtTableContainer")?.innerHTML || content.innerHTML}
    </body>
    </html>
  `);
  printWin.document.close();
  setTimeout(() => printWin.print(), 500);
}

// Make global
window.openStatementModal = openStatementModal;
window.applyStmtFilters = applyStmtFilters;
window.printStatement = printStatement;
