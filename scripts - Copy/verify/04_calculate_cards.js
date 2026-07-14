// === اختبار 4: حساب الكروت (Card Settlement) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core settlement logic extracted from saveSettlement() ----

function validateSettlement(counts, prices) {
  const entries = [];
  let grandTotal = 0;
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];
    const price = prices[i];
    if (count < 0) return { entries: [], grandTotal: 0, error: "عدد الكروت لا يمكن أن يكون سالباً" };
    if (count <= 0) continue;
    if (!price && price !== 0) return { entries: [], grandTotal: 0, error: "فئة الكرت غير محددة" };
    const total = count * price;
    grandTotal += total;
    entries.push({ category: "cat" + (i + 1), count, price, total });
  }
  return { entries, grandTotal, error: null };
}

function validateInventoryAvailability(entries, currentInventory) {
  for (const e of entries) {
    const invEntry = currentInventory.find(i => i.category === e.category);
    const availCount = invEntry ? invEntry.count : 0;
    if (availCount < e.count) {
      return { available: false, category: e.category, required: e.count, availCount };
    }
  }
  return { available: true };
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

const prices = { cat1: 50, cat2: 75, cat3: 100 };

console.log("\n=== اختبار 4: حساب الكروت ===\n");

// Test 1: Valid settlement
{
  const { entries, grandTotal, error } = validateSettlement([2, 3, 0], [50, 75, 100]);
  assert(!error, "لا يوجد خطأ في الإدخال");
  assert(entries.length === 2, "فئتان فقط");
  assert(entries[0].category === "cat1" && entries[0].count === 2, "cat1 = 2");
  assert(entries[1].category === "cat2" && entries[1].count === 3, "cat2 = 3");
  assert(grandTotal === 325, "الإجمالي: 2×50 + 3×75 = 325");
}

// Test 2: Negative count rejected
{
  const { error } = validateSettlement([-1], [50]);
  assert(error && error.includes("سالباً"), "رفض العدد السالب");
}

// Test 3: Empty entries
{
  const { entries, grandTotal, error } = validateSettlement([0, 0], [50, 75]);
  assert(!error, "لا خطأ مع القيم الصفرية");
  assert(entries.length === 0, "لا توجد إدخالات");
  assert(grandTotal === 0, "الإجمالي = 0");
}

// Test 4: Check inventory availability — sufficient
{
  const inventory = [{ category: "cat1", count: 10 }, { category: "cat2", count: 5 }];
  const entries = [{ category: "cat1", count: 3 }, { category: "cat2", count: 2 }];
  const result = validateInventoryAvailability(entries, inventory);
  assert(result.available, "المخزون كافٍ");
}

// Test 5: Check inventory availability — insufficient
{
  const inventory = [{ category: "cat1", count: 2 }];
  const entries = [{ category: "cat1", count: 5 }];
  const result = validateInventoryAvailability(entries, inventory);
  assert(!result.available, "المخزون غير كافٍ");
  assert(result.category === "cat1", "الفئة الناقصة: cat1");
  assert(result.required === 5, "المطلوب: 5");
  assert(result.availCount === 2, "المتوفر: 2");
}

// Test 6: Deduct inventory correctly
{
  const before = [{ category: "cat1", count: 10 }, { category: "cat2", count: 5 }];
  const settled = [{ category: "cat1", count: 3 }, { category: "cat2", count: 2 }];
  const after = deductFromInventory(before, settled);
  assert(after.find(e => e.category === "cat1").count === 7, "cat1: 10-3 = 7");
  assert(after.find(e => e.category === "cat2").count === 3, "cat2: 5-2 = 3");
  assert(after.length === 2, "فئتان بعد الخصم");
}

// Test 7: Deduct removes zero-count categories
{
  const before = [{ category: "cat1", count: 5 }];
  const settled = [{ category: "cat1", count: 5 }];
  const after = deductFromInventory(before, settled);
  assert(after.length === 0, "cat1: يختفي عندما يصل إلى 0");
  assert(!after.find(e => e.category === "cat1"), "لا توجد فئة cat1 بعد الخصم الكامل");
}

// Test 8: Deduct only what's available (Math.max(0, ...))
{
  const before = [{ category: "cat1", count: 3 }];
  const settled = [{ category: "cat1", count: 5 }];
  const after = deductFromInventory(before, settled);
  assert(after.length === 0, "cat1: 0 بعد خصم أكثر من المتوفر (Math.max)");
}

// Test 9: Multiple categories, partial deduction
{
  const before = [{ category: "cat1", count: 10 }, { category: "cat2", count: 8 }, { category: "cat3", count: 5 }];
  const settled = [{ category: "cat1", count: 10 }, { category: "cat2", count: 5 }];
  const after = deductFromInventory(before, settled);
  assert(after.length === 2, "فئتان متبقيتان");
  assert(!after.find(e => e.category === "cat1"), "cat1: استهلكت بالكامل");
  assert(after.find(e => e.category === "cat2").count === 3, "cat2: 8-5 = 3");
  assert(after.find(e => e.category === "cat3").count === 5, "cat3: 5 (بدون خصم)");
}

// Test 10: grandTotal = 0 rejected
{
  const { grandTotal, error } = validateSettlement([0, 0], [50, 75]);
  assert(grandTotal === 0, "الإجمالي صفر");
  assert(!error, "لا يوجد خطأ — لكن المتوقع رفضه في saveSettlement");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
