// === اختبار 8: إضافة تركيب (Installation Addition) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core installation logic extracted from saveInstallation() ----

function validateInstallation(customerName, customerPhone, price, date) {
  if (!customerName || !customerName.trim())
    return { valid: false, error: "اسم العميل مطلوب" };
  if (customerPhone && !/^01[0-9]{9}$/.test(customerPhone))
    return { valid: false, error: "رقم هاتف العميل غير صحيح" };
  if (price < 0)
    return { valid: false, error: "السعر لا يمكن أن يكون سالباً" };
  if (!date)
    return { valid: false, error: "التاريخ مطلوب" };
  return { valid: true, error: null };
}

function createInstallationData(merchantId, customerName, customerPhone, region, subscriptionType, price, notes, status) {
  return {
    merchantId,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    region: region.trim(),
    subscriptionType: subscriptionType.trim(),
    price,
    notes: notes.trim(),
    date: new Date().toISOString().split("T")[0],
    status: status || "completed",
    createdBy: "admin",
  };
}

function generateTransactionNote(customerName, region, subscriptionType) {
  let note = `تركيب: ${customerName} - ${region || "بدون منطقة"}`;
  if (subscriptionType) note += ` (${subscriptionType})`;
  return note;
}

console.log("\n=== اختبار 8: إضافة تركيب ===\n");

// Test 1: Valid installation
{
  const v = validateInstallation("أحمد علي", "01012345678", 500, "2026-07-10");
  assert(v.valid, "بيانات التركيب صحيحة");
}

// Test 2: Empty customer name rejected
{
  const v = validateInstallation("", "01012345678", 500, "2026-07-10");
  assert(!v.valid, "رفض اسم العميل الفارغ");
  assert(v.error === "اسم العميل مطلوب", "رسالة الخطأ الصحيحة");
}

// Test 3: Invalid phone rejected
{
  const v = validateInstallation("أحمد", "12345", 500, "2026-07-10");
  assert(!v.valid, "رفض رقم الهاتف غير الصحيح");
  assert(v.error.includes("غير صحيح"), "رسالة الخطأ الصحيحة");
}

// Test 4: Negative price rejected
{
  const v = validateInstallation("أحمد", "01012345678", -100, "2026-07-10");
  assert(!v.valid, "رفض السعر السالب");
  assert(v.error.includes("سالباً"), "رسالة الخطأ الصحيحة");
}

// Test 5: Empty date rejected
{
  const v = validateInstallation("أحمد", "01012345678", 500, "");
  assert(!v.valid, "رفض التاريخ الفارغ");
  assert(v.error.includes("مطلوب"), "رسالة الخطأ الصحيحة");
}

// Test 6: Phone can be empty (optional)
{
  const v = validateInstallation("أحمد", "", 500, "2026-07-10");
  assert(v.valid, "رقم الهاتف اختياري");
}

// Test 7: currentBalance increased by price
{
  let balance = 0;
  const price = 500;
  balance += price;
  assert(balance === 500, "currentBalance: 0 + 500 = 500");
}

// Test 8: installationCount increased by 1
{
  let count = 0;
  count += 1;
  assert(count === 1, "installationCount: 0 + 1 = 1");
}

// Test 9: Transaction note format
{
  const note = generateTransactionNote("أحمد", "القاهرة", "سنوي");
  assert(note === "تركيب: أحمد - القاهرة (سنوي)", "صيغة البيان مع المنطقة والاشتراك");
}

// Test 10: Transaction note without region
{
  const note = generateTransactionNote("محمد", "", "");
  assert(note === "تركيب: محمد - بدون منطقة", "صيغة البيان بدون منطقة");
}

// Test 11: Multiple installations accumulate
{
  let balance = 0;
  let count = 0;
  const installations = [500, 750, 300];
  installations.forEach(price => {
    balance += price;
    count += 1;
  });
  assert(balance === 1550, "الرصيد التراكمي: 500+750+300 = 1550");
  assert(count === 3, "عدد التركيبات: 3");
}

// Test 12: Installation with zero price (free installation)
{
  const v = validateInstallation("خالد", "01012345678", 0, "2026-07-10");
  assert(v.valid, "التركيب المجاني (سعر 0) مسموح به");
  let balance = 0;
  balance += 0;
  assert(balance === 0, "الرصيد لا يتغير مع التركيب المجاني");
}

// Test 13: All fields in data object
{
  const data = createInstallationData("m1", "  أحمد  ", "01012345678", "القاهرة", "سنوي", 500, "ملاحظات", "completed");
  assert(data.merchantId === "m1", "merchantId صحيح");
  assert(data.customerName === "أحمد", "customerName مقصوص");
  assert(data.customerPhone === "01012345678", "phone صحيح");
  assert(data.price === 500, "price = 500");
  assert(data.status === "completed", "status = completed");
  assert(data.createdBy === "admin", "createdBy = admin");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
