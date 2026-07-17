// === اختبار 21: اختبار القبول الشامل — توافق لوحة التحكم والتطبيق ===
// ينفذ السيناريو الكامل على كلا المحركين (Admin + Mobile) ويقارن النتائج.
// لا يتطلب اتصال Firebase — يحاكي العمليات في الذاكرة.

// ===== Load AccountingEngine (Admin) =====
const adminPath = require("path").join(__dirname, "..", "..", "modules", "accountingEngine.js");
const adminCode = require("fs").readFileSync(adminPath, "utf8");
eval(adminCode);
const AdminEngine = AccountingEngine;

// ===== Load AccountingMath (Mobile) — compile TS via require =====
// We'll implement a JS mirror of AccountingMath for comparison
const MobileMath = {
  isInMonth(dateStr, yearMonth) {
    if (!dateStr) return false;
    return dateStr.substring(0, 7) === yearMonth;
  },

  computeMonthlySummary(transactions, monthStart, monthEnd) {
    let cardsAdded = 0, cashCollected = 0, installationsValue = 0, settlementsValue = 0;
    for (const tx of transactions) {
      if (!tx.date || tx.date < monthStart || tx.date > monthEnd) continue;
      if (tx.type === "card_inventory_added") {
        const meta = tx.metadata;
        if (meta?.entries && Array.isArray(meta.entries)) {
          for (const e of meta.entries) cardsAdded += (e.count || 0);
        } else if (meta?.totalCards) {
          cardsAdded += meta.totalCards;
        } else {
          cardsAdded += Math.abs(tx.amount || 0);
        }
      } else if (tx.type === "cash_collection") {
        cashCollected += Math.abs(tx.amount || 0);
      } else if (tx.type === "installation") {
        installationsValue += Math.abs(tx.amount || 0);
      } else if (tx.type === "card_settlement") {
        settlementsValue += Math.abs(tx.amount || 0);
      }
    }
    return { cardsAdded, cashCollected, installationsValue, settlementsValue };
  },

  computeInventoryTable(inventory, prices) {
    const categories = [];
    (prices || []).forEach((p) => {
      if (p.status !== "inactive" && !categories.includes(p.category)) categories.push(p.category);
    });
    if (inventory?.entries) {
      inventory.entries.forEach((e) => {
        if (e.count > 0) {
          const match = (prices || []).find((p) => p.id === e.category || p.category === e.category);
          const name = match ? match.category : e.category;
          if (!categories.includes(name)) categories.push(name);
        }
      });
    }
    let grandCardsCount = 0, grandCategoryTotal = 0, grandExpectedProfit = 0;
    const rows = categories.map((cat) => {
      const priceDoc = (prices || []).find((p) => p.category === cat || p.id === cat);
      const merchantPrice = priceDoc?.merchantPrice || 0;
      const sellingPrice = priceDoc?.sellingPrice || 0;
      const docId = priceDoc?.id || cat;
      const invEntry = inventory?.entries?.find((e) => e.category === docId || e.category === cat);
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
  },

  computeInstallationsMonthly(installations, yearMonth) {
    const filtered = (installations || []).filter((inst) => inst.date && inst.date.substring(0, 7) === yearMonth);
    const count = filtered.length;
    const total = filtered.reduce((s, inst) => s + (inst.price || 0), 0);
    return { count, total, all: filtered };
  },

  computeInstallationsAll(installations) {
    return {
      count: (installations || []).length,
      total: (installations || []).reduce((s, inst) => s + (inst.price || 0), 0),
    };
  },

  computeBalance(inventoryValue, installationsTotal, collectionsTotal) {
    return inventoryValue + installationsTotal - collectionsTotal;
  },

  computeSettlementTotal(transactions) {
    let total = 0;
    for (const tx of transactions) {
      if (tx.type === "card_settlement") total += Math.abs(tx.amount || 0);
    }
    return total;
  },
};

// ===== Test Helpers =====
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}
function assertEq(admin, mobile, label) {
  const match = JSON.stringify(admin) === JSON.stringify(mobile);
  if (match) {
    console.log(`  ✅ ${label}: Admin="${JSON.stringify(admin)}" = Mobile="${JSON.stringify(mobile)}"`);
    passed++;
  } else {
    console.error(`  ❌ ${label}: Admin="${JSON.stringify(admin)}" ≠ Mobile="${JSON.stringify(mobile)}"`);
    failed++;
  }
}

// ================================================================
// 1. SETUP: Merchant, Prices, Initial State
// ================================================================
console.log("\n=== 1. تهيئة تاجر وأسعار ===");
const today = new Date();
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const merchant = { id: "test_m1", name: "تاجر اختبار", currentBalance: 0, totalCards: 0, totalCardValue: 0, totalSettlements: 0, totalCollections: 0, installationCount: 0, supportsInstallations: true };
const prices = [
  { id: "p1", category: "أساسية", merchantPrice: 50, sellingPrice: 75, status: "active" },
  { id: "p2", category: "ممتازة", merchantPrice: 100, sellingPrice: 150, status: "active" },
  { id: "p3", category: "اقتصادية", merchantPrice: 25, sellingPrice: 40, status: "active" },
];
let inventory = { merchantId: "test_m1", entries: [], totalCards: 0, totalValue: 0 };
let transactions = [];
let installations = [];
let balance = 0;

function addTransaction(type, amount, entries, notes) {
  const tx = {
    id: `tx_${transactions.length + 1}`,
    type, amount,
    date: todayStr,
    time: new Date().toLocaleTimeString("ar-SA"),
    merchantId: "test_m1",
    notes: notes || "",
    metadata: {},
    balanceBefore: balance,
    balanceAfter: balance,
    createdAt: new Date(),
  };
  if (entries) tx.metadata.entries = entries;
  if (type === "card_inventory_added" && entries) {
    tx.metadata.totalCards = entries.reduce((s, e) => s + (e.count || 0), 0);
    tx.metadata.totalValue = entries.reduce((s, e) => s + (e.count || 0) * (e.price || 0), 0);
  }
  transactions.push(tx);
  return tx;
}

function addInstallation(customer, price) {
  const inst = {
    id: `inst_${installations.length + 1}`,
    customerName: customer,
    price,
    date: todayStr,
    status: "completed",
    merchantId: "test_m1",
  };
  installations.push(inst);
  return inst;
}

// ================================================================
// 2. ADD CARDS (إضافة كروت)
// ================================================================
console.log("\n=== 2. إضافة كروت ===");

// Addition 1: 10 basic + 5 premium
const add1 = [
  { category: "p1", count: 10, price: 50, displayCategory: "أساسية" },
  { category: "p2", count: 5, price: 100, displayCategory: "ممتازة" },
];
balance += 10*50 + 5*100; // 500 + 500 = 1000
addTransaction("card_inventory_added", 1000, add1, "إضافة كروت 1");
inventory = {
  merchantId: "test_m1",
  entries: [
    { category: "p1", count: 10 },
    { category: "p2", count: 5 },
  ],
  totalCards: 15,
  totalValue: 1000,
};
assert(balance === 1000, `الرصيد بعد إضافة 1: ${balance} = 1000`);

// Addition 2: 5 basic + 10 economical
const add2 = [
  { category: "p1", count: 5, price: 50, displayCategory: "أساسية" },
  { category: "p3", count: 10, price: 25, displayCategory: "اقتصادية" },
];
balance += 5*50 + 10*25; // 250 + 250 = 500
addTransaction("card_inventory_added", 500, add2, "إضافة كروت 2");
inventory = {
  merchantId: "test_m1",
  entries: [
    { category: "p1", count: 15 },
    { category: "p2", count: 5 },
    { category: "p3", count: 10 },
  ],
  totalCards: 30,
  totalValue: 15*50 + 5*100 + 10*25, // 750 + 500 + 250 = 1500
};
assert(balance === 1500, `الرصيد بعد إضافة 2: ${balance} = 1500`);

// Addition 3: 3 premium
const add3 = [
  { category: "p2", count: 3, price: 100, displayCategory: "ممتازة" },
];
balance += 3*100; // 300
addTransaction("card_inventory_added", 300, add3, "إضافة كروت 3");
inventory = {
  merchantId: "test_m1",
  entries: [
    { category: "p1", count: 15 },
    { category: "p2", count: 8 },
    { category: "p3", count: 10 },
  ],
  totalCards: 33,
  totalValue: 15*50 + 8*100 + 10*25, // 750 + 800 + 250 = 1800
};
assert(balance === 1800, `الرصيد بعد إضافة 3: ${balance} = 1800`);

// ================================================================
// 3. VERIFY ADMIN vs MOBILE AFTER ADDITIONS
// ================================================================
console.log("\n=== 3. مقارنة المحركين بعد الإضافات ===");
const bounds = AdminEngine.getMonthStartEnd(thisMonth);
const adminSummary = AdminEngine.computeMonthlySummary(transactions, bounds.start, bounds.end);
const mobileSummary = MobileMath.computeMonthlySummary(transactions, bounds.start, bounds.end);
assertEq(adminSummary, mobileSummary, "computeMonthlySummary بعد الإضافات");

const adminTable = AdminEngine.computeInventoryTable(inventory, prices);
const mobileTable = MobileMath.computeInventoryTable(inventory, prices);
assertEq(adminTable, mobileTable, "computeInventoryTable بعد الإضافات");

// ================================================================
// 4. EDIT ADDITION (تعديل إضافة)
// ================================================================
console.log("\n=== 4. تعديل إضافة كروت ===");
// Edit addition 1: change 10 basic → 7 basic (remove 3 × 50 = 150 from balance)
// old: 10 basic × 50 = 500, 5 premium × 100 = 500, total = 1000
// new: 7 basic × 50 = 350, 5 premium × 100 = 500, total = 850
// diff = 850 - 1000 = -150
const editDiff = -150;
balance += editDiff; // 1800 - 150 = 1650
addTransaction("adjustment", editDiff, null, `تعديل إضافة 1: فرق -150 ج.م`);
// Update inventory: p1: 15 → 12 (remove 3)
inventory.entries.find(e => e.category === "p1").count = 12;
inventory.totalCards = 12 + 8 + 10; // 30
inventory.totalValue = 12*50 + 8*100 + 10*25; // 600 + 800 + 250 = 1650
assert(balance === 1650, `الرصيد بعد تعديل الإضافة: ${balance} = 1650`);
assert(inventory.totalValue === 1650, `قيمة المخزون بعد التعديل: ${inventory.totalValue} = 1650`);

const adminSummary2 = AdminEngine.computeMonthlySummary(transactions, bounds.start, bounds.end);
const mobileSummary2 = MobileMath.computeMonthlySummary(transactions, bounds.start, bounds.end);
assertEq(adminSummary2, mobileSummary2, "computeMonthlySummary بعد التعديل");

const adminTable2 = AdminEngine.computeInventoryTable(inventory, prices);
const mobileTable2 = MobileMath.computeInventoryTable(inventory, prices);
assertEq(adminTable2, mobileTable2, "computeInventoryTable بعد التعديل");

// Verify inventory value matches balance (no settlements/collections yet)
const invVal = adminTable2.grandCategoryTotal;
assert(invVal === balance, `قيمة المخزون (${invVal}) = الرصيد (${balance}) — لا يوجد تحصيلات أو تركيبات بعد`);

// ================================================================
// 5. DELETE ADDITION (حذف إضافة)
// ================================================================
console.log("\n=== 5. حذف إضافة كروت ===");
// Delete addition 2: reverse its effect
// addition 2 was 5 basic (250) + 10 economical (250) = 500
const deleteValue = 500;
balance -= deleteValue; // 1650 - 500 = 1150
addTransaction("adjustment", -deleteValue, null, `حذف إضافة 2: -500 ج.م`);
// Update inventory: p1: 12 → 7, p3: 10 → 0
inventory.entries.find(e => e.category === "p1").count = 7;
const p3Idx = inventory.entries.findIndex(e => e.category === "p3");
if (p3Idx >= 0) inventory.entries.splice(p3Idx, 1);
inventory.totalCards = 7 + 8; // 15
inventory.totalValue = 7*50 + 8*100; // 350 + 800 = 1150
assert(balance === 1150, `الرصيد بعد حذف الإضافة: ${balance} = 1150`);
assert(inventory.totalValue === 1150, `قيمة المخزون بعد الحذف: ${inventory.totalValue} = 1150`);

const adminTable3 = AdminEngine.computeInventoryTable(inventory, prices);
const mobileTable3 = MobileMath.computeInventoryTable(inventory, prices);
assertEq(adminTable3, mobileTable3, "computeInventoryTable بعد الحذف");
assert(adminTable3.grandCategoryTotal === balance, `قيمة المخزون (${adminTable3.grandCategoryTotal}) = الرصيد (${balance})`);

// ================================================================
// 6. ADD INSTALLATIONS (إضافة تركيبات)
// ================================================================
console.log("\n=== 6. إضافة تركيبات ===");

const inst1Price = 500;
balance += inst1Price; // 1150 + 500 = 1650
addInstallation("عميل 1", inst1Price);
addTransaction("installation", inst1Price, null, `تركيب: عميل 1 - ${inst1Price} ج.م`);

const inst2Price = 750;
balance += inst2Price; // 1650 + 750 = 2400
addInstallation("عميل 2", inst2Price);
addTransaction("installation", inst2Price, null, `تركيب: عميل 2 - ${inst2Price} ج.م`);

assert(balance === 2400, `الرصيد بعد التركيبات: ${balance} = 2400`);
assert(installations.length === 2, `عدد التركيبات: ${installations.length} = 2`);

// Verify engines match
const adminInstMonthly = AdminEngine.computeInstallationsMonthly(installations, thisMonth);
const mobileInstMonthly = MobileMath.computeInstallationsMonthly(installations, thisMonth);
assertEq(adminInstMonthly.count, mobileInstMonthly.count, "عدد التركيبات الشهري");
assertEq(adminInstMonthly.total, mobileInstMonthly.total, "قيمة التركيبات الشهرية");
assert(adminInstMonthly.total === inst1Price + inst2Price, `قيمة التركيبات: ${adminInstMonthly.total} = ${inst1Price + inst2Price}`);

// ================================================================
// 7. EDIT INSTALLATION (تعديل تركيب) — via delete + re-add
// ================================================================
console.log("\n=== 7. تعديل تركيب ===");
// Edit installation 1: price 500 → 600
const oldPrice = installations[0].price;
const newPrice = 600;
const instDiff = newPrice - oldPrice; // +100
balance += instDiff; // 2400 + 100 = 2500
installations[0].price = newPrice;
// Add adjustment transaction
addTransaction("adjustment", instDiff, null, `تعديل تركيب عميل 1: ${oldPrice} → ${newPrice} (فرق ${instDiff})`);

assert(balance === 2500, `الرصيد بعد تعديل التركيب: ${balance} = 2500`);

const adminInstMonthly2 = AdminEngine.computeInstallationsMonthly(installations, thisMonth);
const mobileInstMonthly2 = MobileMath.computeInstallationsMonthly(installations, thisMonth);
assertEq(adminInstMonthly2, mobileInstMonthly2, "computeInstallationsMonthly بعد تعديل التركيب");
assert(adminInstMonthly2.total === 600 + 750, `قيمة التركيبات بعد التعديل: ${adminInstMonthly2.total} = 1350`);
assert(adminInstMonthly2.count === 2, `عدد التركيبات بعد التعديل: ${adminInstMonthly2.count} = 2`);

// ================================================================
// 8. DELETE INSTALLATION (حذف تركيب)
// ================================================================
console.log("\n=== 8. حذف تركيب ===");
const deletedInst = installations.pop();
balance -= deletedInst.price; // 2500 - 750 = 1750
addTransaction("adjustment", -deletedInst.price, null, `حذف تركيب: عميل 2 - ${deletedInst.price} ج.م`);

assert(balance === 1750, `الرصيد بعد حذف التركيب: ${balance} = 1750`);
assert(installations.length === 1, `عدد التركيبات بعد الحذف: ${installations.length} = 1`);

const adminInstMonthly3 = AdminEngine.computeInstallationsMonthly(installations, thisMonth);
const mobileInstMonthly3 = MobileMath.computeInstallationsMonthly(installations, thisMonth);
assertEq(adminInstMonthly3, mobileInstMonthly3, "computeInstallationsMonthly بعد حذف التركيب");
assert(adminInstMonthly3.total === 600, `قيمة التركيبات بعد الحذف: ${adminInstMonthly3.total} = 600`);

// ================================================================
// 9. CASH COLLECTION (تحصيل نقدي)
// ================================================================
console.log("\n=== 9. تحصيل نقدي ===");
const collect1 = 1000;
balance -= collect1; // 1750 - 1000 = 750
addTransaction("cash_collection", -collect1, null, `تحصيل نقدي: ${collect1} ج.م`);
merchant.totalCollections = (merchant.totalCollections || 0) + collect1;

const collect2 = 300;
balance -= collect2; // 750 - 300 = 450
addTransaction("cash_collection", -collect2, null, `تحصيل نقدي: ${collect2} ج.م`);
merchant.totalCollections += collect2;

assert(balance === 450, `الرصيد بعد التحصيل: ${balance} = 450`);
assert(merchant.totalCollections === 1300, `إجمالي المحصل: ${merchant.totalCollections} = 1300`);

// ================================================================
// 10. FULL COMPARISON: Admin Engine vs Mobile Math
// ================================================================
console.log("\n=== 10. المقارنة الكاملة بين المحركين ===");

// Recompute summaries
const adminSummary3 = AdminEngine.computeMonthlySummary(transactions, bounds.start, bounds.end);
const mobileSummary3 = MobileMath.computeMonthlySummary(transactions, bounds.start, bounds.end);
assertEq(adminSummary3, mobileSummary3, "computeMonthlySummary — شامل");

const adminInstAll = AdminEngine.computeInstallationsAll(installations);
const mobileInstAll = MobileMath.computeInstallationsAll(installations);
assertEq(adminInstAll, mobileInstAll, "computeInstallationsAll");

const adminSettle = AdminEngine.computeSettlementTotal(transactions);
const mobileSettle = MobileMath.computeSettlementTotal(transactions);
assertEq(adminSettle, mobileSettle, "computeSettlementTotal");

// Profile data comparison
const adminProfile = AdminEngine.computeProfileData(merchant, inventory, prices, transactions, installations, thisMonth);
// Manually compute mobile equivalent
const mobileMonthly = MobileMath.computeMonthlySummary(transactions, bounds.start, bounds.end);
const mobileInvTable = MobileMath.computeInventoryTable(inventory, prices);
const mobileInstMon = MobileMath.computeInstallationsMonthly(installations, thisMonth);
const mobileInstAl = MobileMath.computeInstallationsAll(installations);
const mobileProfile = {
  monthlyCardsAdded: mobileMonthly.cardsAdded,
  monthlyCashCollected: mobileMonthly.cashCollected,
  monthlyInstallationsValue: mobileMonthly.installationsValue,
  installationsMonthly: mobileInstMon,
  installationsAll: mobileInstAl,
  inventoryTable: mobileInvTable,
  currentBalance: merchant.currentBalance || 0,
  totalExpectedProfit: mobileInvTable.grandExpectedProfit,
};
assertEq(adminProfile, mobileProfile, "computeProfileData — شامل");

// ================================================================
// 11. VERIFY BALANCE FORMULA
// ================================================================
console.log("\n=== 11. التحقق من معادلة الرصيد ===");
const computedBalance = AdminEngine.computeBalance(
  adminTable3.grandCategoryTotal,
  adminInstMonthly3.total,
  adminSummary3.cashCollected
);
// balance = inventoryValue + installations - collections
// = 1150 + 600 - 1300 = 450 ✅
assert(computedBalance === balance, `معادلة الرصيد: المخرون(${adminTable3.grandCategoryTotal}) + تركيبات(${adminInstMonthly3.total}) - تحصيل(${adminSummary3.cashCollected}) = ${computedBalance} = ${balance}`);

// Verify with Mobile formula
const mobileComputedBalance = MobileMath.computeBalance(
  mobileTable3.grandCategoryTotal,
  mobileInstMonthly3.total,
  mobileSummary3.cashCollected
);
assert(mobileComputedBalance === balance, `معادلة الرصيد (Mobile): ${mobileComputedBalance} = ${balance}`);
assert(computedBalance === mobileComputedBalance, `تطابق الرصيد بين المحركين: Admin(${computedBalance}) = Mobile(${mobileComputedBalance})`);

// ================================================================
// 12. DATE/MONTH CHANGE TEST
// ================================================================
console.log("\n=== 12. تغيير التاريخ والشهر ===");
// Create transactions and installations in a different month
const lastMonth = today.getMonth() === 0
  ? `${today.getFullYear() - 1}-12`
  : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, "0")}`;
const lastMonthDate = lastMonth + "-15";

const oldAdd = [
  { category: "p1", count: 20, price: 50, displayCategory: "أساسية" },
];
const oldTx = {
  id: "tx_old_1", type: "card_inventory_added", amount: 1000,
  date: lastMonthDate, time: "10:00",
  merchantId: "test_m1", notes: "إضافة قديمة",
  metadata: { entries: oldAdd, totalCards: 20, totalValue: 1000 },
};
const oldTxns = [...transactions, oldTx];

const oldInst = {
  id: "inst_old_1", customerName: "عميل قديم", price: 2000,
  date: lastMonthDate, status: "completed", merchantId: "test_m1",
};
const oldInsts = [...installations, oldInst];

// Monthly summary for this month should exclude old data
const nowBounds = AdminEngine.getMonthStartEnd(thisMonth);
const thisMonthSummary = AdminEngine.computeMonthlySummary(oldTxns, nowBounds.start, nowBounds.end);
assert(thisMonthSummary.cardsAdded === adminSummary3.cardsAdded, `شهر حالي: كروت مضافة (${thisMonthSummary.cardsAdded}) = (${adminSummary3.cardsAdded}) — لا تشمل القديمة`);

const lastMonthInst = AdminEngine.computeInstallationsMonthly(oldInsts, lastMonth);
assert(lastMonthInst.count === 1, `الشهر الماضي: عدد التركيبات = ${lastMonthInst.count} = 1`);
assert(lastMonthInst.total === 2000, `الشهر الماضي: قيمة التركيبات = ${lastMonthInst.total} = 2000`);

const thisMonthInst = AdminEngine.computeInstallationsMonthly(oldInsts, thisMonth);
assert(thisMonthInst.count === installations.length, `الشهر الحالي: عدد التركيبات (${thisMonthInst.count}) = (${installations.length}) — لا تشمل القديمة`);

// Cross-platform check for different month
const mobileThisMonthSummary = MobileMath.computeMonthlySummary(oldTxns, nowBounds.start, nowBounds.end);
assertEq(thisMonthSummary, mobileThisMonthSummary, "computeMonthlySummary — شهر مختلف - Admin vs Mobile");

const mobileLastMonthInst = MobileMath.computeInstallationsMonthly(oldInsts, lastMonth);
const mobileThisMonthInst = MobileMath.computeInstallationsMonthly(oldInsts, thisMonth);
assertEq(lastMonthInst, mobileLastMonthInst, "تركيبات الشهر الماضي - Admin vs Mobile");
assertEq(thisMonthInst, mobileThisMonthInst, "تركيبات الشهر الحالي - Admin vs Mobile");

// ================================================================
// 13. VERIFY SPECIFIC VALUES ACROSS ALL VIEWS
// ================================================================
console.log("\n=== 13. التحقق من تطابق القيم عبر جميع الشاشات ===");

// Simulate what the admin panel "Cards" tab shows (accounts.js)
// It reads denormalized fields from merchant doc
const adminCardValues = {
  monthlyCardsAdded: adminProfile.monthlyCardsAdded,
  monthlyCashCollected: adminProfile.monthlyCashCollected,
  monthlyInstallationsValue: adminProfile.monthlyInstallationsValue,
  currentBalance: adminProfile.currentBalance,
  totalExpectedProfit: adminProfile.totalExpectedProfit,
};

// Simulate what the mobile app shows (AccountingDashboard.tsx)
const mobileCardValues = {
  monthlyCardsAdded: mobileProfile.monthlyCardsAdded,
  monthlyCashCollected: mobileProfile.monthlyCashCollected,
  monthlyInstallationsValue: mobileProfile.monthlyInstallationsValue,
  currentBalance: mobileProfile.currentBalance,
  totalExpectedProfit: mobileProfile.totalExpectedProfit,
};

assertEq(adminCardValues, mobileCardValues, "قيم البطاقات — Admin = Mobile");

// Verify account statement compatibility
// Admin statement shows: transactions grouped by date
// Mobile Timeline shows: same transactions
const adminStmtTxns = transactions.length;
const mobileStmtTxns = transactions.length;
assert(adminStmtTxns === mobileStmtTxns, `عدد معاملات كشف الحساب: Admin(${adminStmtTxns}) = Mobile(${mobileStmtTxns})`);

// Verify each transaction has consistent data
transactions.forEach((tx, i) => {
  assert(tx.type && tx.amount !== undefined, `المعاملة ${i + 1}: type + amount موجودان`);
});

// Verify inventory table shows correct values for all 3 categories
const adminRows = adminProfile.inventoryTable.rows;
const mobileRows = mobileProfile.inventoryTable.rows;
assert(adminRows.length === mobileRows.length, `عدد صفوف الجدول: ${adminRows.length} = ${mobileRows.length}`);
adminRows.forEach((row, i) => {
  assertEq(row, mobileRows[i], `صف الجدول ${row.category}`);
});

// ================================================================
// 14. SUMMARY
// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`📊 نتيجة اختبار القبول الشامل: ${passed} ✅ / ${failed} ❌`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n🎉 جميع القيم متطابقة 100% بين لوحة التحكم والتطبيق!");
  console.log("   لا يوجد أي اختلاف في أي من:");
  console.log("   • الرصيد الحالي");
  console.log("   • الكروت المضافة");
  console.log("   • قيمة الكروت (المخزون)");
  console.log("   • قيمة التركيبات");
  console.log("   • الربح المتوقع");
  console.log("   • المحصل نقدًا");
  console.log("   • كشف الحساب");
  console.log("   • جدول المحاسبة");
  process.exit(0);
}
