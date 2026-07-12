// === اختبار 12: Transactions (سجل المعاملات) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core transaction logic across all modules ----

const TXN_TYPES = {
  CARD_INVENTORY_ADDED: "card_inventory_added",
  CARD_SETTLEMENT: "card_settlement",
  INSTALLATION: "installation",
  CASH_COLLECTION: "cash_collection",
};

function createTransaction(type, merchantId, amount, notes, metadata) {
  return {
    type,
    merchantId,
    amount,
    date: new Date().toISOString().split("T")[0],
    time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    createdBy: "admin",
    notes,
    priceSnapshot: metadata?.priceSnapshot || [],
    metadata: metadata || {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function getInventoryTransactionNote(entries) {
  return `إضافة عهدة: ${entries.map((e) => `${e.count} كارت فئة ${e.category}`).join("، ")}`;
}

function getSettlementTransactionNote(entries) {
  return `حساب كروت: ${entries.map((e) => `${e.count} من فئة ${e.category}`).join("، ")}`;
}

function getInstallationTransactionNote(customerName, region, subscriptionType) {
  let note = `تركيب: ${customerName} - ${region || "بدون منطقة"}`;
  if (subscriptionType) note += ` (${subscriptionType})`;
  return note;
}

function getCollectionTransactionNote(amount) {
  return `تسوية نقدية: ${amount.toLocaleString("ar-SA")} ج.م`;
}

console.log("\n=== اختبار 12: Transactions ===\n");

// Test 1: Create inventory transaction
{
  const entries = [{ category: "A", count: 100 }, { category: "B", count: 50 }];
  const txn = createTransaction(
    TXN_TYPES.CARD_INVENTORY_ADDED,
    "m1",
    0,
    getInventoryTransactionNote(entries),
    { entries, totalCards: 150, totalValue: 8750 }
  );
  assert(txn.type === "card_inventory_added", "نوع المعاملة = card_inventory_added");
  assert(txn.merchantId === "m1", "merchantId = m1");
  assert(txn.amount === 0, "amount = 0 (عهدة لا تغير amount مباشرة)");
  assert(txn.metadata.totalCards === 150, "metadata.totalCards = 150");
  assert(txn.metadata.totalValue === 8750, "metadata.totalValue = 8750");
  assert(txn.notes.includes("100 كارت"), "البيان يحتوي على تفاصيل العهدة");
}

// Test 2: Create settlement transaction
{
  const entries = [{ category: "A", count: 30 }, { category: "B", count: 10 }];
  const txn = createTransaction(
    TXN_TYPES.CARD_SETTLEMENT,
    "m1",
    -2000,
    getSettlementTransactionNote(entries),
    { entries, grandTotal: 2000 }
  );
  assert(txn.type === "card_settlement", "نوع المعاملة = card_settlement");
  assert(txn.amount === -2000, "amount = -2000 (خصم من الرصيد)");
  assert(txn.metadata.grandTotal === 2000, "grandTotal = 2000");
  assert(txn.notes.includes("30 من فئة A"), "البيان يحتوي على تفاصيل الحساب");
}

// Test 3: Create installation transaction
{
  const txn = createTransaction(
    TXN_TYPES.INSTALLATION,
    "m1",
    500,
    getInstallationTransactionNote("أحمد", "القاهرة", "سنوي"),
    { installationId: "inst1", customerName: "أحمد", region: "القاهرة", subscriptionType: "سنوي" }
  );
  assert(txn.type === "installation", "نوع المعاملة = installation");
  assert(txn.amount === 500, "amount = 500 (إضافة للرصيد)");
  assert(txn.metadata.installationId === "inst1", "metadata يحتوي installationId");
  assert(txn.metadata.customerName === "أحمد", "metadata يحتوي customerName");
}

// Test 4: Create cash collection transaction
{
  const txn = createTransaction(
    TXN_TYPES.CASH_COLLECTION,
    "m1",
    -3000,
    getCollectionTransactionNote(3000),
    { receiveAmount: 3000, balanceBefore: 5000, balanceAfter: 2000 }
  );
  assert(txn.type === "cash_collection", "نوع المعاملة = cash_collection");
  assert(txn.amount === -3000, "amount = -3000 (خصم من الرصيد)");
  assert(txn.metadata.balanceBefore === 5000, "balanceBefore = 5000");
  assert(txn.metadata.balanceAfter === 2000, "balanceAfter = 2000");
}

// Test 5: All transactions have mandatory fields
{
  const types = Object.values(TXN_TYPES);
  types.forEach(type => {
    const txn = createTransaction(type, "m1", 100, `اختبار ${type}`, {});
    assert(!!txn.type, `${type}: type موجود`);
    assert(!!txn.merchantId, `${type}: merchantId موجود`);
    assert(!!txn.date, `${type}: date موجود`);
    assert(!!txn.time, `${type}: time موجود`);
    assert(txn.createdBy === "admin", `${type}: createdBy = admin`);
    assert(txn.createdAt > 0, `${type}: createdAt موجود`);
  });
}

// Test 6: Transaction notes for each type
{
  assert(getInventoryTransactionNote([{ category: "A", count: 50 }]).includes("50 كارت"), "صيغة بيان العهدة");
  assert(getSettlementTransactionNote([{ category: "A", count: 20 }]).includes("20 من فئة A"), "صيغة بيان الحساب");
  assert(getInstallationTransactionNote("محمد", "", "").includes("بدون منطقة"), "صيغة بيان التركيب (بدون منطقة)");
  const note = getCollectionTransactionNote(1500);
  assert(note.includes("تسوية نقدية") && note.includes("ج.م"), "صيغة بيان التسوية");
}

// Test 7: Price snapshot is included in relevant transactions
{
  const priceSnapshot = [{ category: "A", merchantPrice: 50 }];
  const txn = createTransaction("card_inventory_added", "m1", 0, "عهدة", { priceSnapshot, entries: [] });
  assert(txn.priceSnapshot.length === 1, "priceSnapshot موجود في معاملة العهدة");
  assert(txn.priceSnapshot[0].merchantPrice === 50, "سعر الفئة A = 50");
}

// Test 8: Amount convention — settlement negative, installation positive
{
  assert(createTransaction("card_settlement", "m1", -1500, "", {}).amount < 0, "التسوية amount سالب");
  assert(createTransaction("cash_collection", "m1", -2000, "", {}).amount < 0, "التحصيل amount سالب");
  assert(createTransaction("installation", "m1", 500, "", {}).amount > 0, "التركيب amount موجب");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
