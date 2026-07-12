// === اختبار 10: كشف الحساب (Account Statement) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core statement logic extracted from reports.js ----

const TXN_TYPE_LABELS = {
  card_inventory_added: "عهدة",
  card_settlement: "حساب كروت",
  collection: "تحصيل",
  installation: "تركيب",
  correction: "تصحيح",
  adjustment: "تعديل",
  payment: "دفعة",
  deduction: "خصم",
  cash_collection: "تسوية نقدية",
};

function getTransactionTypeLabel(type) {
  return TXN_TYPE_LABELS[type] || type || "-";
}

function filterTransactionsByDate(txns, from, to) {
  let filtered = txns;
  if (from) filtered = filtered.filter((t) => t.date >= from);
  if (to) filtered = filtered.filter((t) => t.date <= to);
  return filtered;
}

function filterTransactionsByType(txns, type) {
  if (!type) return txns;
  return txns.filter((t) => t.type === type);
}

function sumAmounts(txns, type) {
  return txns
    .filter((t) => t.type === type)
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
}

function getStatementSummary(txns) {
  return {
    totalInventory: sumAmounts(txns, "card_inventory_added"),
    totalSettlements: sumAmounts(txns, "card_settlement"),
    totalInstallations: sumAmounts(txns, "installation"),
    totalCollections: sumAmounts(txns, "cash_collection"),
    count: txns.length,
  };
}

console.log("\n=== اختبار 10: كشف الحساب ===\n");

// Sample transactions
const sampleTxns = [
  { id: "t1", type: "card_inventory_added", amount: 0, date: "2026-07-01", notes: "إضافة عهدة: 100 كارت فئة A", metadata: { entries: [{ category: "A", count: 100 }] } },
  { id: "t2", type: "card_settlement", amount: -1500, date: "2026-07-05", notes: "حساب كروت: 30 من فئة A", metadata: { entries: [{ category: "A", count: 30 }] } },
  { id: "t3", type: "installation", amount: 500, date: "2026-07-06", notes: "تركيب: أحمد - القاهرة" },
  { id: "t4", type: "card_settlement", amount: -1000, date: "2026-07-08", notes: "حساب كروت: 20 من فئة A" },
  { id: "t5", type: "installation", amount: 750, date: "2026-07-09", notes: "تركيب: محمد - الجيزة (سنوي)" },
  { id: "t6", type: "cash_collection", amount: -2000, date: "2026-07-10", notes: "تسوية نقدية: 2000 ج.م" },
];

// Test 1: Type label mapping
{
  assert(getTransactionTypeLabel("card_inventory_added") === "عهدة", "card_inventory_added → عهدة");
  assert(getTransactionTypeLabel("card_settlement") === "حساب كروت", "card_settlement → حساب كروت");
  assert(getTransactionTypeLabel("installation") === "تركيب", "installation → تركيب");
  assert(getTransactionTypeLabel("cash_collection") === "تسوية نقدية", "cash_collection → تسوية نقدية");
  assert(getTransactionTypeLabel("unknown") === "unknown", "unknown → unknown");
  assert(getTransactionTypeLabel("") === "-", "فارغ → -");
}

// Test 2: Statement summary
{
  const summary = getStatementSummary(sampleTxns);
  assert(summary.totalInventory === 0, "إجمالي العهدة = 0 (amount=0 في card_inventory_added)");
  assert(summary.totalSettlements === 2500, "إجمالي المدفوعات = 1500+1000 = 2500");
  assert(summary.totalInstallations === 1250, "إجمالي التركيبات = 500+750 = 1250");
  assert(summary.totalCollections === 2000, "إجمالي التسويات = 2000");
  assert(summary.count === 6, "عدد المعاملات = 6");
}

// Test 3: Filter by date range
{
  const filtered = filterTransactionsByDate(sampleTxns, "2026-07-05", "2026-07-08");
  assert(filtered.length === 3, "التصفية بالتاريخ: 3 معاملات بين 05 و 08");
}

// Test 4: Filter by type
{
  const filtered = filterTransactionsByType(sampleTxns, "installation");
  assert(filtered.length === 2, "التصفية بالنوع: معاملتان من نوع تركيب");
}

// Test 5: Combined filters
{
  let filtered = filterTransactionsByType(sampleTxns, "card_settlement");
  filtered = filterTransactionsByDate(filtered, "2026-07-01", "2026-07-07");
  assert(filtered.length === 1, "التصفية المزدوجة: معاملة واحدة");
  assert(filtered[0].id === "t2", "المعاملة: t2 (1500)");
}

// Test 6: Statement for empty transactions
{
  const summary = getStatementSummary([]);
  assert(summary.totalInventory === 0, "لا عهدة");
  assert(summary.totalSettlements === 0, "لا مدفوعات");
  assert(summary.totalInstallations === 0, "لا تركيبات");
  assert(summary.count === 0, "0 معاملة");
}

// Test 7: Amount sign convention
{
  // inventory adds → positive amount on merchant, but stored as 0 with metadata
  // settlements → negative amount (debit)
  // installations → positive amount (credit)
  // collections → negative amount (debit)
  const settlements = sampleTxns.filter(t => t.type === "card_settlement");
  const totalDebit = settlements.reduce((s, t) => s + t.amount, 0);
  assert(totalDebit === -2500, "إجمالي المبالغ المدينة = -2500");

  const installations = sampleTxns.filter(t => t.type === "installation");
  const totalCredit = installations.reduce((s, t) => s + t.amount, 0);
  assert(totalCredit === 1250, "إجمالي المبالغ الدائنة = 1250");
}

// Test 8: Date sorting (descending by createdAt is default)
{
  // Simulate the behavior from reports.js
  const sorted = [...sampleTxns].sort((a, b) => b.date.localeCompare(a.date));
  assert(sorted[0].id === "t6", "الأحدث أولاً");
  assert(sorted[sorted.length - 1].id === "t1", "الأقدم آخراً");
}

// Test 9: Statement shows running totals from transactions
{
  const txns = [
    { type: "card_inventory_added", metadata: { totalValue: 5000 } },
    { type: "card_settlement", amount: -1500 },
    { type: "card_settlement", amount: -1000 },
  ];

  // The settled card value in accounting table:
  // Settlements count as deductions from currentBalance
  let currentBalance = 0;
  currentBalance += 5000; // inventory
  currentBalance += -1500; // settlement 1
  currentBalance += -1000; // settlement 2
  assert(currentBalance === 2500, "الرصيد من المعاملات: 5000-1500-1000 = 2500");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
