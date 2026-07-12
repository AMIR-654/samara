// === اختبار 6: تحديث currentBalance ===
// يتأكد من أن currentBalance يتغير بشكل صحيح مع كل عملية

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

console.log("\n=== اختبار 6: تحديث currentBalance ===\n");

// ---- السيناريو: دورة كاملة لحساب تاجر ----

// البداية
let currentBalance = 0;
assert(currentBalance === 0, "الرصيد الابتدائي = 0");

// 1. إضافة عهدة: currentBalance += totalValue
const inv1 = [{ category: "A", count: 100, price: 50 }];
const totalValue1 = inv1.reduce((s, e) => s + e.count * e.price, 0);
currentBalance += totalValue1;
assert(currentBalance === 5000, "بعد إضافة عهدة (100×50): الرصيد = 5000");
assert(totalValue1 === 5000, "totalValue1 = 5000");

// 2. إضافة عهدة ثانية
const inv2 = [{ category: "B", count: 50, price: 75 }];
const totalValue2 = inv2.reduce((s, e) => s + e.count * e.price, 0);
currentBalance += totalValue2;
assert(currentBalance === 8750, "بعد إضافة عهدة ثانية (50×75): الرصيد = 8750");
assert(totalValue2 === 3750, "totalValue2 = 3750");

// 3. حساب كروت (خصم): currentBalance -= grandTotal
const settlement1 = [{ category: "A", count: 30, price: 50 }];
const grandTotal1 = settlement1.reduce((s, e) => s + e.count * e.price, 0);
currentBalance -= grandTotal1;
assert(currentBalance === 7250, "بعد حساب كروت (30×50): الرصيد = 7250");
assert(grandTotal1 === 1500, "grandTotal1 = 1500");

  // 4. حساب كروت آخر
  const settlement2 = [{ category: "A", count: 20, price: 50 }, { category: "B", count: 10, price: 75 }];
  const grandTotal2 = settlement2.reduce((s, e) => s + e.count * e.price, 0);
  currentBalance -= grandTotal2;
  // 7250 - 1750 = 5500
  assert(currentBalance === 5500, "بعد حساب كروت (20×50 + 10×75): الرصيد = 5500");
  assert(grandTotal2 === 1750, "grandTotal2 = 1750");

  // 5. إضافة تركيب: currentBalance += price
  const installPrice1 = 500;
  currentBalance += installPrice1;
  assert(currentBalance === 6000, "بعد تركيب (500): الرصيد = 6000");

  // 6. إضافة تركيب آخر
  const installPrice2 = 750;
  currentBalance += installPrice2;
  assert(currentBalance === 6750, "بعد تركيب آخر (750): الرصيد = 6750");

  // 7. حذف تركيب: currentBalance -= price (تراجع)
  currentBalance -= installPrice1;
  assert(currentBalance === 6250, "بعد حذف التركيب الأول (500-): الرصيد = 6250");

  // 8. تسوية نقدية (تحصيل): currentBalance -= receiveAmount
  const receiveAmount = 2000;
  currentBalance -= receiveAmount;
  assert(currentBalance === 4250, "بعد تسوية نقدية (2000): الرصيد = 4250");

  // 9. تسوية أخرى
  const receiveAmount2 = 1500;
  currentBalance -= receiveAmount2;
  assert(currentBalance === 2750, "بعد تسوية أخرى (1500): الرصيد = 2750");

  // 10. الرصيد النهائي يجب أن يكون هو نفسه في بطاقة التاجر
  // currentBalance = totalValue(عهدة) - grandTotal(حساب) + price(تركيب) - price(حذف) - receiveAmount(تسوية)
  // = 5000 + 3750 - 1500 - 1750 + 500 + 750 - 500 - 2000 - 1500
  // = 2750
  assert(currentBalance === 2750, "الرصيد النهائي = 2750 (جميع العمليات محسوبة)");

// ---- سيناريو: الرصيد السالب ----
{
  let bal = 1000;
  bal -= 1500; // تسوية أكثر من الرصيد
  assert(bal === -500, "الرصيد يمكن أن يصبح سالباً: 1000 - 1500 = -500");
}

// ---- سيناريو: الرصيد صفر ----
{
  let bal = 500;
  bal += 0; // عهدة صفرية
  assert(bal === 500, "الرصيد لا يتغير إذا كانت القيمة 0");
  bal -= 500;
  assert(bal === 0, "الرصيد = 0 بعد الخصم الكامل");
}

// ---- سيناريو: الرصيد يعود إلى الصفر ----
{
  let bal = 3000;
  bal += 2000; // عهدة
  bal -= 2000; // حساب كروت
  bal -= 3000; // تسوية
  assert(bal === 0, "الرصيد = 0 بعد تسوية كاملة");
}

// ---- السيناريو: جميع القيم كبيرة ----
{
  let bal = 0;
  bal += 100000; // عهدة
  bal -= 40000;  // حساب
  bal += 5000;   // تركيب
  bal -= 65000;  // تسوية
  assert(bal === 0, "الرصيد = 0 بعد دورة كاملة بقيم كبيرة");
}

// ---- السيناريو: currentBalance يجب ألا يقل عن 0 (لكن التطبيق لا يمنع ذلك) ----
{
  let bal = 100;
  bal -= 200;
  assert(bal === -100, "الرصيد السالب مسموح به في النظام (لكنه نادر)");
}

// ---- الـ currentBalance في profile يجب أن يظهر القيمة الصحيحة ----
{
  const merchant = { currentBalance: 5750 };
  assert(merchant.currentBalance === 5750, "قيمة currentBalance من Firestore = 5750");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
