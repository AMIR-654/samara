/**
 * Unit Tests for Authentication Logic (Phase 2.5)
 *
 * Tests core auth logic WITHOUT needing Firebase.
 * Run: node admin/scripts/unit_test_auth.js
 *
 * Tests:
 *   - Password hashing (matches merchant app)
 *   - Fallback decision logic
 *   - Session creation
 *   - Error messages
 *   - Provisioning idempotency
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ===== Password hashing (from authFirebase.ts) =====
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

console.log("═══════════════════════════════════════");
console.log("  Phase 2.5 — Unit Tests");
console.log("═══════════════════════════════════════\n");

// ===== 1. Password Hashing =====
console.log("📁 Password Hashing:");
assert(hashPassword("merchLeg1") === "h_p20o5e", "hashPassword('merchLeg1') === h_p20o5e");
assert(hashPassword("merchFire1") === "h_4ovr9g", "hashPassword('merchFire1') === h_4ovr9g");
assert(hashPassword("syncMe123") === "h_7w90ov", "hashPassword('syncMe123') === h_7w90ov");
assert(hashPassword("archived1") === "h_rjuvsh", "hashPassword('archived1') === h_rjuvsh");
assert(hashPassword("") === "h_0", "hashPassword('') === h_0");
assert(hashPassword("test123") !== hashPassword("test124"), "Different passwords -> different hashes");

// ===== 2. Fallback Decision Logic =====
console.log("\n📁 Fallback Decision Logic (Admin Panel):");
const FALLBACK_ERRORS = ["auth/user-not-found", "auth/invalid-credential", "auth/invalid-email", "auth/internal-error"];
const FATAL_ERROR_CODES = {
  "auth/network-request-failed": "خطأ في الاتصال بالإنترنت",
  "auth/too-many-requests": "تم حظر تسجيل الدخول مؤقتاً",
  "auth/user-disabled": "حسابك موقوف",
  "auth/operation-not-allowed": "تسجيل الدخول غير متاح حالياً",
};

function shouldFallback(code) {
  return FALLBACK_ERRORS.includes(code);
}

function isFatal(code) {
  return code in FATAL_ERROR_CODES;
}

assert(shouldFallback("auth/user-not-found") === true, "user-not-found -> Fallback");
assert(shouldFallback("auth/invalid-credential") === true, "invalid-credential -> Fallback");
assert(shouldFallback("auth/invalid-email") === true, "invalid-email -> Fallback");
assert(shouldFallback("auth/internal-error") === true, "internal-error -> Fallback (NEW)");
assert(shouldFallback("auth/network-request-failed") === false, "network-request-failed -> NO Fallback");
assert(shouldFallback("auth/too-many-requests") === false, "too-many-requests -> NO Fallback");
assert(shouldFallback("auth/user-disabled") === false, "user-disabled -> NO Fallback");
assert(shouldFallback("auth/operation-not-allowed") === false, "operation-not-allowed -> NO Fallback");
assert(shouldFallback("auth/wrong-password") === false, "wrong-password -> NO Fallback");
assert(shouldFallback("auth/unknown-error") === false, "unknown -> NO Fallback");

assert(isFatal("auth/network-request-failed") === true, "network-request-failed -> Fatal");
assert(isFatal("auth/too-many-requests") === true, "too-many-requests -> Fatal");
assert(isFatal("auth/user-disabled") === true, "user-disabled -> Fatal");
assert(isFatal("auth/operation-not-allowed") === true, "operation-not-allowed -> Fatal");
assert(isFatal("auth/user-not-found") === false, "user-not-found -> NOT Fatal");
assert(isFatal("auth/internal-error") === false, "internal-error -> NOT Fatal");

// ===== 3. Fatal Error Messages =====
console.log("\n📁 Fatal Error Messages:");
assert(FATAL_ERROR_CODES["auth/network-request-failed"].includes("الاتصال"), "Network error: contains اتصال");
assert(FATAL_ERROR_CODES["auth/too-many-requests"].includes("حظر"), "Too many: contains حظر");
assert(FATAL_ERROR_CODES["auth/user-disabled"].includes("موقوف"), "Disabled: contains موقوف");
assert(FATAL_ERROR_CODES["auth/operation-not-allowed"].includes("غير متاح"), "Not allowed: contains غير متاح");

// ===== 4. Merchant Credential Validation Logic =====
console.log("\n📁 Merchant Credential Logic:");
const mockMerchant = {
  id: "_test_merchant_legacy",
  username: "test_merchant_legacy",
  password: hashPassword("merchLeg1"),
  status: "active",
};

// Simulate verifyMerchantCredentials logic (without Firebase)
function mockVerifyMerchantCredentials(username, password) {
  if (username !== mockMerchant.username) return null;
  if (mockMerchant.status !== "active") return null;
  const hashed = hashPassword(password);
  if (mockMerchant.password !== hashed && mockMerchant.password !== password) return null;
  return { ...mockMerchant };
}

const result1 = mockVerifyMerchantCredentials("test_merchant_legacy", "merchLeg1");
assert(result1 !== null && result1.id === "_test_merchant_legacy", "Correct credentials -> merchant found");

const result2 = mockVerifyMerchantCredentials("test_merchant_legacy", "wrongPass");
assert(result2 === null, "Wrong password -> null");

const result3 = mockVerifyMerchantCredentials("nonexistent", "merchLeg1");
assert(result3 === null, "Unknown username -> null");

const archivedMerchant = { ...mockMerchant, status: "archived" };
function mockVerifyWithArchived(username, password) {
  if (username !== archivedMerchant.username) return null;
  if (archivedMerchant.status !== "active") return null; // Archive check
  return archivedMerchant;
}
const result4 = mockVerifyWithArchived("test_merchant_legacy", "merchLeg1");
assert(result4 === null, "Archived merchant -> null (cannot login)");

// ===== 5. Session Creation =====
console.log("\n📁 Session Creation:");
function createAuthSession(merchant) {
  return {
    merchantId: merchant.id,
    username: merchant.username,
    name: merchant.name,
    isAdmin: false,
    loginAt: Date.now(),
  };
}
const session = createAuthSession(mockMerchant);
assert(session.merchantId === "_test_merchant_legacy", "Session.merchantId matches");
assert(session.isAdmin === false, "Session.isAdmin is false for merchant");
assert(session.loginAt > 0, "Session.loginAt is set");
assert(session.name === mockMerchant.name, "Session.name matches");

// ===== 6. Provisioning Idempotency Logic =====
console.log("\n📁 Provisioning Idempotency:");
// Simulate: findMerchantAuthUser returns existing user or null
const mockAuthUsers = new Map();
mockAuthUsers.set("_test_merchant_firebase", { uid: "test_uid_123", merchantId: "_test_merchant_firebase" });

function mockFindMerchantAuthUser(merchantId) {
  return mockAuthUsers.get(merchantId) || null;
}

function mockProvisionMerchantAuth(merchantId) {
  const existing = mockFindMerchantAuthUser(merchantId);
  if (existing) {
    return { success: true, uid: existing.uid, alreadyExisted: true };
  }
  // Create new
  const uid = "new_uid_" + merchantId;
  mockAuthUsers.set(merchantId, { uid, merchantId });
  return { success: true, uid, alreadyExisted: false };
}

assert(mockFindMerchantAuthUser("_test_merchant_firebase") !== null, "Existing merchant found");
assert(mockFindMerchantAuthUser("_test_merchant_legacy") === null, "Non-provisioned merchant not found");

const firstProvision = mockProvisionMerchantAuth("_test_merchant_legacy");
assert(firstProvision.alreadyExisted === false, "First provision -> new user");
assert(firstProvision.uid === "new_uid__test_merchant_legacy", "First provision -> uid created");

const secondProvision = mockProvisionMerchantAuth("_test_merchant_legacy");
assert(secondProvision.alreadyExisted === true, "Second provision -> alreadyExisted");
assert(secondProvision.uid === "new_uid__test_merchant_legacy", "Second provision -> same uid");

// ===== 7. Token Claim Validation =====
console.log("\n📁 Token Claim Validation:");
function mockVerifyToken(claims, requiredRole) {
  if (!claims) return false;
  return claims.role === requiredRole;
}

assert(mockVerifyToken({ role: "admin" }, "admin") === true, "Admin claims -> valid");
assert(mockVerifyToken({ role: "merchant" }, "admin") === false, "Merchant claims -> not admin");
assert(mockVerifyToken(null, "admin") === false, "Null claims -> invalid");
assert(mockVerifyToken({}, "admin") === false, "Empty claims -> invalid");

function mockGetMerchantIdFromClaims(claims) {
  return claims?.merchantId || null;
}

assert(mockGetMerchantIdFromClaims({ role: "merchant", merchantId: "abc123" }) === "abc123", "Claims have merchantId");
assert(mockGetMerchantIdFromClaims({ role: "admin" }) === null, "Admin claims -> no merchantId");
assert(mockGetMerchantIdFromClaims({}) === null, "Empty claims -> no merchantId");

// ===== Summary =====
console.log("\n═══════════════════════════════════════");
console.log(`  Results: ${passed} ✅ passed, ${failed} ❌ failed`);
console.log("═══════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
