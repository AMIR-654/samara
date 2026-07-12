// === اختبار 14: تسجيل دخول التاجر (Merchant Login) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core auth logic extracted from authFirebase.ts ----

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

function createAuthSession(merchant) {
  return {
    merchantId: merchant.id,
    username: merchant.username,
    name: merchant.name,
    isAdmin: false,
    loginAt: Date.now(),
  };
}

function verifyMerchantCredentialsLocal(merchant, password) {
  if (!merchant) return { merchant: null, source: null };
  if (merchant.status !== "active") return { merchant: null, source: null };

  const hashed = hashPassword(password);
  if (merchant.password !== hashed && merchant.password !== password) {
    return { merchant: null, source: null };
  }
  return { merchant, source: "legacy" };
}

const merchantsStore = [
  { id: "m1", username: "ahmed_test", name: "أحمد محمد", password: hashPassword("pass123"), status: "active" },
  { id: "m2", username: "inactive_user", name: "خامل", password: hashPassword("pass456"), status: "inactive" },
];

function findMerchantByUsername(username) {
  return merchantsStore.find((m) => m.username === username) || null;
}

console.log("\n=== اختبار 14: تسجيل دخول التاجر ===\n");

// Test 1: Successful login
{
  const merchant = findMerchantByUsername("ahmed_test");
  const result = verifyMerchantCredentialsLocal(merchant, "pass123");
  assert(result.merchant !== null, "تسجيل دخول تاجر ناجح");
  assert(result.source === "legacy", "المصدر = legacy");
  assert(result.merchant.id === "m1", "المعرف = m1");
}

// Test 2: Wrong password
{
  const merchant = findMerchantByUsername("ahmed_test");
  const result = verifyMerchantCredentialsLocal(merchant, "wrong_password");
  assert(result.merchant === null, "رفض كلمة المرور الخاطئة");
}

// Test 3: Non-existent username
{
  const merchant = findMerchantByUsername("nonexistent");
  const result = verifyMerchantCredentialsLocal(merchant, "pass");
  assert(result.merchant === null, "رفض اسم المستخدم غير الموجود");
}

// Test 4: Inactive merchant
{
  const merchant = findMerchantByUsername("inactive_user");
  const result = verifyMerchantCredentialsLocal(merchant, "pass456");
  assert(result.merchant === null, "رفض التاجر الخامل");
}

// Test 5: Empty password
{
  const merchant = findMerchantByUsername("ahmed_test");
  const result = verifyMerchantCredentialsLocal(merchant, "");
  assert(result.merchant === null, "رفض كلمة المرور الفارغة");
}

// Test 6: Empty username
{
  const merchant = findMerchantByUsername("");
  assert(merchant === null, "رفض اسم المستخدم الفارغ");
}

// Test 7: Password hash consistency
{
  const hash1 = hashPassword("test123");
  const hash2 = hashPassword("test123");
  assert(hash1 === hash2, "نفس كلمة المرور → نفس الهاش");
}

// Test 8: Different passwords have different hashes
{
  const hash1 = hashPassword("pass123");
  const hash2 = hashPassword("pass456");
  assert(hash1 !== hash2, "كلمات مرور مختلفة → هاش مختلف");
}

// Test 9: AuthSession creation
{
  const merchant = { id: "m1", username: "ahmed", name: "أحمد" };
  const session = createAuthSession(merchant);
  assert(session.merchantId === "m1", "merchantId = m1");
  assert(session.username === "ahmed", "username = ahmed");
  assert(session.name === "أحمد", "name = أحمد");
  assert(session.isAdmin === false, "isAdmin = false");
  assert(session.loginAt > 0, "loginAt موجود");
}

// Test 10: Pure password match (unhashed legacy support)
{
  const merchant = { id: "m3", username: "plain", password: "plainpass", status: "active" };
  const result = verifyMerchantCredentialsLocal(merchant, "plainpass");
  assert(result.merchant !== null, "مطابقة كلمة المرور النصية (legacy)");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
