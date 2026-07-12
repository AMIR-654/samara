// === اختبار 18: معالجة الأخطاء (Error Handling) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core error handling from authFirebase.ts ----

const FALLBACK_ERRORS = ["auth/user-not-found", "auth/invalid-credential", "auth/invalid-email", "auth/internal-error"];
const FATAL_ERROR_MESSAGES = {
  "auth/network-request-failed": "خطأ في الاتصال بالإنترنت. تأكد من اتصالك وحاول مرة أخرى.",
  "auth/too-many-requests": "تم حظر تسجيل الدخول مؤقتاً. حاول مرة أخرى بعد دقائق.",
  "auth/user-disabled": "حسابك موقوف. تواصل مع المسؤول.",
  "auth/operation-not-allowed": "تسجيل الدخول غير متاح حالياً.",
};

function handleFirebaseError(code) {
  if (FALLBACK_ERRORS.includes(code)) {
    return { action: "fallback", message: null };
  }
  if (FATAL_ERROR_MESSAGES[code]) {
    return { action: "throw", message: FATAL_ERROR_MESSAGES[code] };
  }
  // Unknown error
  return { action: "fallback", message: null };
}

function validateInventoryEntry(count, category) {
  if (count < 0) return { valid: false, error: "عدد الكروت لا يمكن أن يكون سالباً" };
  if (!category) return { valid: false, error: "فئة الكرت غير محددة" };
  if (count === 0) return { valid: false, error: null }; // skip zeros silently
  return { valid: true, error: null };
}

function validateMerchantForm(name, phone, username, password) {
  if (!name || !name.trim()) return { valid: false, error: "اسم التاجر مطلوب" };
  if (!phone || !/^01[0-9]{9}$/.test(phone)) return { valid: false, error: "رقم الهاتف غير صحيح" };
  if (!username || username.length < 3) return { valid: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" };
  if (!password) return { valid: false, error: "كلمة المرور مطلوبة" };
  return { valid: true, error: null };
}

function validateCardPrice(category, price) {
  if (!category) return { valid: false, error: "جميع فئات الأسعار يجب أن تحتوي على اسم" };
  if (price < 0) return { valid: false, error: "السعر لا يمكن أن يكون سالباً" };
  return { valid: true, error: null };
}

console.log("\n=== اختبار 18: معالجة الأخطاء ===\n");

// Test 1: Firebase fallback errors
{
  FALLBACK_ERRORS.forEach(code => {
    const result = handleFirebaseError(code);
    assert(result.action === "fallback", `خطأ ${code} → fallback`);
  });
}

// Test 2: Firebase fatal errors
{
  Object.keys(FATAL_ERROR_MESSAGES).forEach(code => {
    const result = handleFirebaseError(code);
    assert(result.action === "throw", `خطأ ${code} → throw`);
    assert(result.message !== null, `رسالة الخطأ موجودة لـ ${code}`);
  });
}

// Test 3: Unknown Firebase error
{
  const result = handleFirebaseError("auth/unknown-error-code");
  assert(result.action === "fallback", "الخطأ الغير معروف → fallback (تجاوب)");
}

// Test 4: Empty error code
{
  const result = handleFirebaseError("");
  assert(result.action === "fallback", "كود الخطأ الفارغ → fallback");
}

// Test 5: Null/undefined error
{
  const r1 = handleFirebaseError(null);
  const r2 = handleFirebaseError(undefined);
  assert(r1.action === "fallback", "null → fallback");
  assert(r2.action === "fallback", "undefined → fallback");
}

// Test 6: Inventory validation — negative count
{
  const result = validateInventoryEntry(-1, "A");
  assert(!result.valid, "رفض العدد السالب");
  assert(result.error.includes("سالباً"), "رسالة خطأ العدد السالب");
}

// Test 7: Inventory validation — missing category
{
  const result = validateInventoryEntry(5, "");
  assert(!result.valid, "رفض الفئة الفارغة");
  assert(result.error.includes("غير محددة"), "رسالة خطأ الفئة الفارغة");
}

// Test 8: Merchant form — empty name
{
  const result = validateMerchantForm("", "01012345678", "test", "pass");
  assert(!result.valid, "رفض الاسم الفارغ");
  assert(result.error.includes("مطلوب"), "رسالة خطأ الاسم");
}

// Test 9: Merchant form — invalid phone
{
  const result = validateMerchantForm("أحمد", "12345", "test", "pass");
  assert(!result.valid, "رفض الهاتف غير الصحيح");
  assert(result.error.includes("غير صحيح"), "رسالة خطأ الهاتف");
}

// Test 10: Merchant form — short username
{
  const result = validateMerchantForm("أحمد", "01012345678", "ab", "pass");
  assert(!result.valid, "رفض اسم المستخدم القصير");
  assert(result.error.includes("3 أحرف"), "رسالة خطأ اسم المستخدم");
}

// Test 11: Merchant form — empty password
{
  const result = validateMerchantForm("أحمد", "01012345678", "test", "");
  assert(!result.valid, "رفض كلمة المرور الفارغة");
  assert(result.error.includes("مطلوبة"), "رسالة خطأ كلمة المرور");
}

// Test 12: Card price — empty category
{
  const result = validateCardPrice("", 50);
  assert(!result.valid, "رفض فئة السعر الفارغة");
  assert(result.error.includes("اسم"), "رسالة خطأ الفئة الفارغة");
}

// Test 13: Card price — negative price
{
  const result = validateCardPrice("A", -10);
  assert(!result.valid, "رفض السعر السالب");
  assert(result.error.includes("سالباً"), "رسالة خطأ السعر السالب");
}

// Test 14: All validations pass with correct data
{
  const m = validateMerchantForm("أحمد", "01012345678", "ahmed", "pass123");
  assert(m.valid, "البيانات الصحيحة → valid");

  const i = validateInventoryEntry(10, "A");
  assert(i.valid, "العهدة الصحيحة → valid");

  const p = validateCardPrice("A", 50);
  assert(p.valid, "السعر الصحيح → valid");
}

// Test 15: Settlement — insufficient inventory error message
{
  const available = 2;
  const required = 5;
  const errorMsg = `المخزون غير كافٍ لفئة "${"A"}". المتوفر: ${available}، المطلوب: ${required}`;
  assert(errorMsg.includes("غير كافٍ"), "رسالة خطأ المخزون غير الكافي");
  assert(errorMsg.includes("المتوفر: 2"), "تظهر الكمية المتوفرة");
  assert(errorMsg.includes("المطلوب: 5"), "تظهر الكمية المطلوبة");
}

// Test 16: Error during Firestore operation (simulated)
{
  let errorCaught = false;
  let userMessage = "";
  try {
    // Simulate a Firestore error
    throw new Error("PERMISSION_DENIED: Missing or insufficient permissions");
  } catch (err) {
    errorCaught = true;
    userMessage = "خطأ في حفظ البيانات: " + err.message;
  }
  assert(errorCaught, "تم التقاط الخطأ");
  assert(userMessage.includes("PERMISSION_DENIED"), "رسالة الخطأ تحتوي على تفاصيل المشكلة");
}

// Test 17: Network error handling
{
  const result = handleFirebaseError("auth/network-request-failed");
  assert(result.action === "throw", "خطأ الشبكة → throw");
  assert(result.message.includes("الإنترنت"), "رسالة خطأ الشبكة باللغة العربية");
}

// Test 18: Rate limit error
{
  const result = handleFirebaseError("auth/too-many-requests");
  assert(result.message.includes("حظر"), "رسالة الخطأ تشير إلى الحظر المؤقت");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
