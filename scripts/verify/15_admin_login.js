// === اختبار 15: تسجيل دخول الأدمن (Admin Login) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core admin auth logic extracted from authFirebase.ts ----

function createAdminSession() {
  return {
    merchantId: "admin",
    username: "admin",
    name: "مدير النظام",
    isAdmin: true,
    loginAt: Date.now(),
  };
}

function verifyAdminCredentialsLocal(creds, username, password) {
  if (!creds) return { valid: false, source: null };
  const valid = creds.username === username && creds.password === password;
  return { valid, source: valid ? "legacy" : null };
}

function getDefaultAdminCredentials() {
  return { username: "admin", password: "admin" };
}

console.log("\n=== اختبار 15: تسجيل دخول الأدمن ===\n");

// Test 1: Successful login with default credentials
{
  const creds = getDefaultAdminCredentials();
  const result = verifyAdminCredentialsLocal(creds, "admin", "admin");
  assert(result.valid, "تسجيل دخول الأدمن ناجح بالبيانات الافتراضية");
  assert(result.source === "legacy", "المصدر = legacy");
}

// Test 2: Wrong password
{
  const creds = getDefaultAdminCredentials();
  const result = verifyAdminCredentialsLocal(creds, "admin", "wrong");
  assert(!result.valid, "رفض كلمة المرور الخاطئة");
}

// Test 3: Wrong username
{
  const creds = getDefaultAdminCredentials();
  const result = verifyAdminCredentialsLocal(creds, "hacker", "admin");
  assert(!result.valid, "رفض اسم المستخدم الخاطئ");
}

// Test 4: Empty fields
{
  const creds = getDefaultAdminCredentials();
  const r1 = verifyAdminCredentialsLocal(creds, "", "admin");
  const r2 = verifyAdminCredentialsLocal(creds, "admin", "");
  assert(!r1.valid, "رفض اسم المستخدم الفارغ");
  assert(!r2.valid, "رفض كلمة المرور الفارغة");
}

// Test 5: Admin session creation
{
  const session = createAdminSession();
  assert(session.merchantId === "admin", "merchantId = admin");
  assert(session.username === "admin", "username = admin");
  assert(session.name === "مدير النظام", "name = مدير النظام");
  assert(session.isAdmin === true, "isAdmin = true");
  assert(session.loginAt > 0, "loginAt موجود");
}

// Test 6: Admin session vs Merchant session
{
  const adminSession = createAdminSession();
  const merchantSession = { merchantId: "m1", username: "test", name: "تاجر", isAdmin: false, loginAt: Date.now() };
  assert(adminSession.isAdmin === true, "جلسة الأدمن: isAdmin = true");
  assert(merchantSession.isAdmin === false, "جلسة التاجر: isAdmin = false");
  assert(adminSession.merchantId !== merchantSession.merchantId, "معرفات مختلفة");
}

// Test 7: Custom credentials
{
  const creds = { username: "superadmin", password: "superpass" };
  const result = verifyAdminCredentialsLocal(creds, "superadmin", "superpass");
  assert(result.valid, "بيانات مخصصة صحيحة");
}

// Test 8: Case sensitive
{
  const creds = getDefaultAdminCredentials();
  const result = verifyAdminCredentialsLocal(creds, "Admin", "admin");
  assert(!result.valid, "حساسية حالة الأحرف في اسم المستخدم");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
