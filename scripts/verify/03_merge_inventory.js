// === اختبار 3: دمج عهدتين (Inventory Merge) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

function mergeInventory(existingEntries, newEntries) {
  const mergedMap = {};
  (existingEntries || []).forEach((e) => {
    mergedMap[e.category] = (mergedMap[e.category] || 0) + (e.count || 0);
  });
  newEntries.forEach((e) => {
    mergedMap[e.category] = (mergedMap[e.category] || 0) + e.count;
  });
  return Object.entries(mergedMap).map(([category, count]) => ({ category, count }));
}

const prices = { A: 30, B: 40, C: 50, D: 60 };

console.log("\n=== اختبار 3: دمج عهدتين ===\n");

// Test 1: Merge two identical categories
{
  const existing = [{ category: "A", count: 5 }, { category: "B", count: 3 }];
  const newItems = [{ category: "A", count: 10 }, { category: "B", count: 7 }];
  const merged = mergeInventory(existing, newItems);
  assert(merged.length === 2, "فئتان بعد الدمج");
  assert(merged.find(e => e.category === "A").count === 15, "A: 5 + 10 = 15");
  assert(merged.find(e => e.category === "B").count === 10, "B: 3 + 7 = 10");
}

// Test 2: Merge with new categories
{
  const existing = [{ category: "A", count: 5 }];
  const newItems = [{ category: "B", count: 10 }, { category: "C", count: 3 }];
  const merged = mergeInventory(existing, newItems);
  assert(merged.length === 3, "3 فئات بعد إضافة فئات جديدة");
  assert(merged.find(e => e.category === "A").count === 5, "A: 5 (بدون تغيير)");
  assert(merged.find(e => e.category === "B").count === 10, "B: 10 (جديد)");
  assert(merged.find(e => e.category === "C").count === 3, "C: 3 (جديد)");
}

// Test 3: Merge empty existing with new
{
  const existing = [];
  const newItems = [{ category: "A", count: 8 }];
  const merged = mergeInventory(existing, newItems);
  assert(merged.length === 1, "فئة واحدة");
  assert(merged[0].count === 8, "A: 8");
}

// Test 4: Merge with existing null/undefined
{
  const merged = mergeInventory(null, [{ category: "A", count: 5 }]);
  assert(merged.length === 1, "existing=null لا يسبب خطأ");
  assert(merged[0].count === 5, "A: 5 despite null existing");
}

// Test 5: Merge three batches
{
  const batch1 = [{ category: "A", count: 10 }];
  const batch2 = [{ category: "A", count: 20 }, { category: "B", count: 5 }];
  const batch3 = [{ category: "B", count: 5 }, { category: "C", count: 15 }];
  const after1 = mergeInventory([], batch1);
  const after2 = mergeInventory(after1, batch2);
  const after3 = mergeInventory(after2, batch3);
  assert(after3.find(e => e.category === "A").count === 30, "A: 0+10+20+0 = 30");
  assert(after3.find(e => e.category === "B").count === 10, "B: 0+0+5+5 = 10");
  assert(after3.find(e => e.category === "C").count === 15, "C: 0+0+0+15 = 15");
  assert(after3.length === 3, "3 فئات بعد 3 دفعات");
}

// Test 6: Merge does not produce duplicates
{
  const existing = [{ category: "A", count: 5 }, { category: "A", count: 3 }]; // edge case
  const newItems = [{ category: "A", count: 2 }];
  const merged = mergeInventory(existing, newItems);
  const aEntries = merged.filter(e => e.category === "A");
  assert(aEntries.length === 1, "A: لا يوجد تكرار في الفئات");
  assert(aEntries[0].count === 10, "A: 5+3+2 = 10");
}

// Test 7: Zero count entries are included
{
  const existing = [{ category: "A", count: 0 }];
  const newItems = [{ category: "A", count: 5 }];
  const merged = mergeInventory(existing, newItems);
  assert(merged.find(e => e.category === "A").count === 5, "A: 0+5 = 5");
}

// Test 8: Total value after merge
{
  const existing = [{ category: "A", count: 10 }, { category: "B", count: 5 }];
  const newItems = [{ category: "A", count: 5 }, { category: "C", count: 10 }];
  const merged = mergeInventory(existing, newItems);
  let totalValue = 0;
  merged.forEach(e => { totalValue += e.count * (prices[e.category] || 0); });
  assert(totalValue === 1150, "قيمة الدمج: 15×30 + 5×40 + 10×50 = 1150");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
