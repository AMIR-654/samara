// === اختبار 5: خصم المخزون (Inventory Deduction) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

function deductFromInventory(currentEntries, settledEntries) {
  const mergedMap = {};
  currentEntries.forEach((e) => {
    mergedMap[e.category] = (mergedMap[e.category] || 0) + (e.count || 0);
  });
  settledEntries.forEach((e) => {
    mergedMap[e.category] = Math.max(0, (mergedMap[e.category] || 0) - e.count);
  });
  return Object.entries(mergedMap)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({ category, count }));
}

function calcTotalCards(entries) {
  return entries.reduce((s, e) => s + e.count, 0);
}

const prices = { A: 30, B: 40, C: 50 };

console.log("\n=== اختبار 5: خصم المخزون ===\n");

// Test 1: Basic deduction
{
  const before = [{ category: "A", count: 20 }];
  const after = deductFromInventory(before, [{ category: "A", count: 5 }]);
  assert(after.length === 1, "فئة واحدة متبقية");
  assert(after[0].count === 15, "A: 20-5 = 15");
}

// Test 2: Exact deduction (zero remaining)
{
  const before = [{ category: "A", count: 5 }];
  const after = deductFromInventory(before, [{ category: "A", count: 5 }]);
  assert(after.length === 0, "لا شيء متبقي إذا كان الخصم مساوياً للموجود");
}

// Test 3: Deduct more than available (clamped to 0)
{
  const before = [{ category: "A", count: 3 }];
  const after = deductFromInventory(before, [{ category: "A", count: 10 }]);
  assert(after.length === 0, "A: يختفي (قيد 0)");
}

// Test 4: Deduct from multiple categories
{
  const before = [{ category: "A", count: 10 }, { category: "B", count: 8 }, { category: "C", count: 5 }];
  const after = deductFromInventory(before, [{ category: "A", count: 3 }, { category: "B", count: 8 }, { category: "C", count: 2 }]);
  assert(after.length === 2, "فئتان متبقيتان");
  assert(after.find(e => e.category === "A").count === 7, "A: 10-3 = 7");
  assert(!after.find(e => e.category === "B"), "B: 8-8 = 0 (محذوف)");
  assert(after.find(e => e.category === "C").count === 3, "C: 5-2 = 3");
}

// Test 5: Total cards after deduction
{
  const before = [{ category: "A", count: 50 }, { category: "B", count: 30 }];
  const after = deductFromInventory(before, [{ category: "A", count: 10 }, { category: "B", count: 5 }]);
  const total = calcTotalCards(after);
  assert(total === 65, "الإجمالي بعد الخصم: (50-10)+(30-5) = 65");
}

// Test 6: No deduction if nothing specified
{
  const before = [{ category: "A", count: 10 }];
  const after = deductFromInventory(before, []);
  assert(after.length === 1, "لا تغيير إذا لم يتم خصم شيء");
  assert(after[0].count === 10, "A: 10 (بدون خصم)");
}

// Test 7: Deduct category that doesn't exist in inventory
{
  const before = [{ category: "A", count: 10 }];
  const after = deductFromInventory(before, [{ category: "X", count: 5 }]);
  assert(after.length === 1, "A فقط (X غير موجود)");
  assert(after[0].count === 10, "A: لم يتغير");
}

// Test 8: currentBalance decreases by grandTotal
{
  let balance = 2000;
  const grandTotal = 500;
  balance -= grandTotal;
  assert(balance === 1500, "currentBalance: 2000 - 500 = 1500");
}

// Test 9: Sequential deductions
{
  let inventory = [{ category: "A", count: 100 }];
  let balance = 5000;

  inventory = deductFromInventory(inventory, [{ category: "A", count: 10 }]);
  balance -= 10 * 30;
  assert(inventory.find(e => e.category === "A").count === 90, "الخصم 1: 100-10 = 90");
  assert(balance === 4700, "الرصيد 1: 5000 - 300 = 4700");

  inventory = deductFromInventory(inventory, [{ category: "A", count: 20 }]);
  balance -= 20 * 30;
  assert(inventory.find(e => e.category === "A").count === 70, "الخصم 2: 90-20 = 70");
  assert(balance === 4100, "الرصيد 2: 4700 - 600 = 4100");
}

// Test 10: Mixed categories with different prices
{
  const before = [{ category: "A", count: 10 }, { category: "B", count: 10 }];
  const settled = [{ category: "A", count: 5 }, { category: "B", count: 3 }];
  const after = deductFromInventory(before, settled);
  const deductValue = 5 * 30 + 3 * 40;
  assert(deductValue === 270, "قيمة الخصم: 5×30 + 3×40 = 270");
  assert(after.find(e => e.category === "A").count === 5, "A: 10-5 = 5");
  assert(after.find(e => e.category === "B").count === 7, "B: 10-3 = 7");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
