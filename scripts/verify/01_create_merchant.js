// === اختبار 1: إنشاء تاجر جديد ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

const merchants = [];
const auditLogs = [];

function saveMerchant(name, phone, username, password, address, supportsInstallations) {
  if (!name || !name.trim()) throw new Error("اسم التاجر مطلوب");
  if (!phone || !/^01[0-9]{9}$/.test(phone)) throw new Error("رقم الهاتف غير صحيح");
  if (!username || username.length < 3) throw new Error("اسم المستخدم يجب أن يكون 3 أحرف على الأقل");
  if (!password) throw new Error("كلمة المرور مطلوبة");
  if (merchants.find((m) => m.username === username)) throw new Error("اسم المستخدم موجود مسبقاً");

  const now = Date.now();
  const merchant = {
    id: "merchant_" + now,
    name: name.trim(), phone, username, password, address: address || "",
    supportsInstallations: !!supportsInstallations, status: "active",
    totalCards: 0, totalCardValue: 0, totalSettlements: 0, totalCollections: 0,
    currentBalance: 0, installationCount: 0, createdBy: "admin", createdAt: now, updatedAt: now,
  };
  merchants.push(merchant);
  auditLogs.push({ action: "create", collection: "merchants", docId: merchant.id, timestamp: now });
  return merchant;
}

console.log("\n=== اختبار 1: إنشاء تاجر جديد ===\n");

try {
  const m = saveMerchant("أحمد محمد", "01012345678", "ahmed_test", "pass123", "شارع النيل", true);
  assert(true, "إنشاء تاجر ببيانات صحيحة");
  assert(m.status === "active", "الحالة active");
  assert(m.totalCards === 0, "totalCards = 0");
  assert(m.currentBalance === 0, "currentBalance = 0");
  assert(m.installationCount === 0, "installationCount = 0");
  assert(m.supportsInstallations === true, "يدعم التركيبات");
} catch (e) { assert(false, "إنشاء تاجر: " + e.message); }

try { saveMerchant("مكرر", "01098765432", "ahmed_test", "pass", "", false); assert(false, ""); }
catch (e) { assert(e.message.includes("موجود"), "اكتشاف اسم المستخدم المكرر"); }

try { saveMerchant("خطأ", "12345", "bad_phone", "pass", "", false); assert(false, ""); }
catch (e) { assert(e.message.includes("هاتف"), "رفض رقم الهاتف غير الصحيح"); }

try { saveMerchant("", "01011111111", "empty", "pass", "", false); assert(false, ""); }
catch (e) { assert(e.message.includes("مطلوب"), "رفض الاسم الفارغ"); }

try { saveMerchant("تاجر", "01022222222", "ab", "pass", "", false); assert(false, ""); }
catch (e) { assert(e.message.includes("3 أحرف"), "رفض اسم المستخدم القصير"); }

try { saveMerchant("تاجر", "01033333333", "no_pass", "", "", false); assert(false, ""); }
catch (e) { assert(e.message.includes("مطلوبة"), "رفض كلمة المرور الفارغة"); }

assert(auditLogs.length === 1, "تم تسجيل Audit Log واحد");
assert(auditLogs[0].action === "create", "نوع audit log = create");
assert(auditLogs[0].collection === "merchants", "collection = merchants");

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
