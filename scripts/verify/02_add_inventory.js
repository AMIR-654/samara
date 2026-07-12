// === اختبار 2: إضافة عهدة (Inventory Addition) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core merge logic extracted from saveInventory() ----
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

function calcTotalCards(entries) {
  return entries.reduce((s, e) => s + e.count, 0);
}

function calcTotalValue(entries, priceMap) {
  return entries.reduce((s, e) => {
    const price = priceMap[e.category] || 0;
    return s + e.count * price;
  }, 0);
}

function validateInventoryEntries(counts, prices) {
  const entries = [];
  let formValid = true;
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];
    const price = prices[i];
    const category = "cat" + (i + 1);
    if (count > 0) {
      if (count < 0) { formValid = false; break; }
      entries.push({ category, count, price });
    }
  }
  return { entries, formValid };
}

// ---- Card Prices ----
const prices = { cat1: 50, cat2: 75, cat3: 100 };

console.log("\n=== اختبار 2: إضافة عهدة ===\n");

// Test 1: Add inventory to empty store
{
  const { entries, formValid } = validateInventoryEntries([10, 5, 0], [50, 75, 100]);
  assert(formValid, "التحقق من صحة بيانات الإدخال — كل القيم صحيحة");
  assert(entries.length === 2, "تم إدخال فئتين فقط (الثالثة صفر)");
  assert(entries[0].category === "cat1" && entries[0].count === 10, "الفئة الأولى: 10 كروت");
  assert(entries[1].category === "cat2" && entries[1].count === 5, "الفئة الثانية: 5 كروت");

  const merged = mergeInventory([], entries);
  assert(merged.length === 2, "الدمج: فئتان في المخزون");
  const c1 = merged.find(e => e.category === "cat1");
  const c2 = merged.find(e => e.category === "cat2");
  assert(c1 && c1.count === 10, "الدمج: cat1 = 10");
  assert(c2 && c2.count === 5, "الدمج: cat2 = 5");

  const totalCards = calcTotalCards(merged);
  const totalValue = calcTotalValue(merged, prices);
  assert(totalCards === 15, "إجمالي الكروت = 15");
  assert(totalValue === 875, "إجمالي القيمة = 875 (10×50 + 5×75)");
}

// Test 2: Add inventory to existing store (merge)
{
  const existing = [{ category: "cat1", count: 10 }, { category: "cat2", count: 5 }];
  const { entries: newEntries, formValid } = validateInventoryEntries([5, 10, 20], [50, 75, 100]);
  assert(formValid, "صحة الدفعة الثانية");
  assert(newEntries.length === 3, "الدفعة الثانية: 3 فئات");

  const merged = mergeInventory(existing, newEntries);
  assert(merged.length === 3, "الدمج: 3 فئات بعد الإضافة");
  const c1 = merged.find(e => e.category === "cat1");
  const c2 = merged.find(e => e.category === "cat2");
  const c3 = merged.find(e => e.category === "cat3");
  assert(c1 && c1.count === 15, "الدمج: cat1 = 10 + 5 = 15");
  assert(c2 && c2.count === 15, "الدمج: cat2 = 5 + 10 = 15");
  assert(c3 && c3.count === 20, "الدمج: cat3 = 0 + 20 = 20");

  const totalCards = calcTotalCards(merged);
  const totalValue = calcTotalValue(merged, prices);
  assert(totalCards === 50, "إجمالي الكروت بعد الدمج = 50");
  assert(totalValue === 3875, "إجمالي القيمة = 3875 (15×50 + 15×75 + 20×100)");
}

// Test 3: Validation — negative count
{
  const counts = [-1, 5];
  const prices2 = [50, 75];
  let formValid = true;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < 0) { formValid = false; break; }
  }
  assert(!formValid, "رفض العدد السالب");
}

// Test 4: Validation — no entries
{
  const { entries, formValid } = validateInventoryEntries([0, 0, 0], [50, 75, 100]);
  assert(formValid, "صحة مع القيم الصفرية");
  assert(entries.length === 0, "لا توجد إدخالات عندما الكل صفر");
}

// Test 5: currentBalance should increase by totalValue
{
  const initialBalance = 1000;
  const newEntries = [{ category: "cat1", count: 10, price: 50 }];
  const totalValue = calcTotalValue(newEntries, prices);
  const newBalance = initialBalance + totalValue;
  assert(newBalance === 1500, "currentBalance يزيد بقيمة العهدة: 1000 + 500 = 1500");
}

// Test 6: Multiple additions accumulate
{
  let balance = 0;
  const add1 = [{ category: "cat1", count: 10, price: 50 }];
  const add2 = [{ category: "cat2", count: 5, price: 75 }];
  balance += calcTotalValue(add1, prices);
  balance += calcTotalValue(add2, prices);
  assert(balance === 875, "الرصيد التراكمي بعد عهدتين = 875");
}

// Test 7: Large numbers
{
  const entries = [{ category: "cat1", count: 1000, price: 50 }];
  const totalValue = calcTotalValue(entries, prices);
  assert(totalValue === 50000, "قيمة 1000 كرت × 50 = 50000");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
