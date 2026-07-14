// === اختبار 16: حفظ الجلسة بعد إعادة التشغيل (Session Persistence) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core session persistence logic from useMerchantAuth.ts ----
// Simulated AsyncStorage in memory

const storage = {};

const mockAsyncStorage = {
  setItem: async (key, value) => { storage[key] = value; },
  getItem: async (key) => storage[key] || null,
  removeItem: async (key) => { delete storage[key]; },
};

const SESSION_KEY = "merchant_auth_session";

async function persistSession(session) {
  const raw = JSON.stringify(session);
  const encoded = btoa(unescape(encodeURIComponent(raw)));
  await mockAsyncStorage.setItem(SESSION_KEY, encoded);
}

async function loadSession() {
  try {
    const encoded = await mockAsyncStorage.getItem(SESSION_KEY);
    if (!encoded) return null;
    const raw = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function clearSession() {
  await mockAsyncStorage.removeItem(SESSION_KEY);
}

function isSessionExpired(session, maxAgeMs) {
  if (!session || !session.loginAt) return true;
  return Date.now() - session.loginAt > maxAgeMs;
}

console.log("\n=== اختبار 16: حفظ الجلسة ===\n");

// Test 1: Persist and load merchant session
{
  const session = { merchantId: "m1", username: "ahmed", name: "أحمد", isAdmin: false, loginAt: Date.now() };
  await persistSession(session);
  const loaded = await loadSession();
  assert(loaded !== null, "تم حفظ الجلسة بنجاح");
  assert(loaded.merchantId === "m1", "merchantId محفوظ");
  assert(loaded.username === "ahmed", "username محفوظ");
  assert(loaded.name === "أحمد", "name محفوظ");
  assert(loaded.isAdmin === false, "isAdmin محفوظ");
}

// Test 2: Persist and load admin session
{
  const session = { merchantId: "admin", username: "admin", name: "مدير النظام", isAdmin: true, loginAt: Date.now() };
  await persistSession(session);
  const loaded = await loadSession();
  assert(loaded.isAdmin === true, "جلسة الأدمن: isAdmin = true");
  assert(loaded.merchantId === "admin", "جلسة الأدمن: merchantId = admin");
}

// Test 3: Clear session
{
  await clearSession();
  const loaded = await loadSession();
  assert(loaded === null, "الجلسة محذوفة بعد clearSession");
}

// Test 4: No session returns null
{
  await clearSession();
  const loaded = await loadSession();
  assert(loaded === null, "لا جلسة → null");
}

// Test 5: Session survives multiple persist/clear cycles
{
  await persistSession({ merchantId: "m1", username: "test", name: "اختبار", isAdmin: false, loginAt: Date.now() });
  let loaded = await loadSession();
  assert(loaded.merchantId === "m1", "الحفظ الأول");

  await clearSession();
  loaded = await loadSession();
  assert(loaded === null, "المسح يعمل");

  await persistSession({ merchantId: "m2", username: "test2", name: "اختبار 2", isAdmin: false, loginAt: Date.now() });
  loaded = await loadSession();
  assert(loaded.merchantId === "m2", "الحفظ بعد المسح يعمل");
}

// Test 6: Base64 encoding preserves Arabic text
{
  const session = { merchantId: "m1", username: "ahmed", name: "أحمد محمد", isAdmin: false, loginAt: Date.now() };
  await persistSession(session);
  const loaded = await loadSession();
  assert(loaded.name === "أحمد محمد", "النص العربي محفوظ بشكل صحيح");
}

// Test 7: Session expiry check
{
  const oldSession = { loginAt: Date.now() - 86400000 }; // 24 hours ago
  const freshSession = { loginAt: Date.now() };

  assert(!isSessionExpired(freshSession, 86400000), "الجلسة الجديدة غير منتهية");
  assert(isSessionExpired(oldSession, 10000), "الجلسة القديمة منتهية (10 ثوانٍ max)");
}

// Test 8: Invalid stored data
{
  storage[SESSION_KEY] = "not-valid-base64!!!";
  const loaded = await loadSession();
  assert(loaded === null, "البيانات التالفة لا تسبب عطل — تعيد null");
}

// Test 9: Session structure verification
{
  const session = { merchantId: "m1", username: "ahmed", name: "أحمد", isAdmin: false, loginAt: Date.now() };
  await persistSession(session);
  const loaded = await loadSession();
  const requiredFields = ["merchantId", "username", "name", "isAdmin", "loginAt"];
  requiredFields.forEach(field => {
    assert(loaded[field] !== undefined, `الحقل ${field} موجود في الجلسة المحفوظة`);
  });
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
