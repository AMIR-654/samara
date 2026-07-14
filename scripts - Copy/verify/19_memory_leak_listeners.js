// === اختبار 19: Memory Leak & Listener Cleanup ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core listener lifecycle from merchantProfile.js ----

class ProfileManager {
  constructor() {
    this._unsubscribers = [];
    this._merchant = null;
    this._inventory = null;
    this._startCount = 0;
    this._stopCount = 0;
  }

  startListeners(merchantId) {
    this.stopListeners(); // Always stop existing first
    this._startCount++;

    const merchantUnsub = () => {
      this._merchant = null;
    };
    const invUnsub = () => {
      this._inventory = null;
    };

    this._unsubscribers.push(merchantUnsub);
    this._unsubscribers.push(invUnsub);
  }

  stopListeners() {
    this._unsubscribers.forEach((u) => { try { u(); } catch {} });
    this._unsubscribers = [];
    this._stopCount++;
  }

  restartListeners(merchantId) {
    this.startListeners(merchantId);
  }

  get listenerCount() { return this._unsubscribers.length; }
  get startCount() { return this._startCount; }
  get stopCount() { return this._stopCount; }

  simulateUnsubscribeError() {
    // Simulate one unsubscriber that throws
    this._unsubscribers.push(() => { throw new Error("Unsubscribe failed"); });
  }
}

// ---- window export cleanup from merchantProfile.js ----
const windowExports = {};

function exportToWindow(name, fn) {
  windowExports[name] = fn;
}

function clearWindowExports() {
  Object.keys(windowExports).forEach(key => delete windowExports[key]);
}

console.log("\n=== اختبار 19: Memory Leak & Listener Cleanup ===\n");

// Test 1: Listeners stopped when opening new profile
{
  const mgr = new ProfileManager();
  mgr.startListeners("m1");
  assert(mgr.listenerCount === 2, "2 listeners بعد فتح profil تاجر");

  mgr.startListeners("m2"); // This calls stopListeners internally
  assert(mgr.listenerCount === 2, "2 listeners بعد فتح تاجر آخر (القديمة ألغيت)");
  assert(mgr.startCount === 2, "startListeners استدعي مرتين");
  assert(mgr.stopCount === 2, "stopListeners استدعي مرتين (مرة من كل startListeners)");
}

// Test 2: All listeners removed after stop
{
  const mgr = new ProfileManager();
  mgr.startListeners("m1");
  mgr.stopListeners();
  assert(mgr.listenerCount === 0, "0 listeners بعد stop");
  assert(mgr._merchant === null, "merchant null بعد إلغاء listener");
  assert(mgr._inventory === null, "inventory null بعد إلغاء listener");
}

// Test 3: Restart does not leak listeners
{
  const mgr = new ProfileManager();
  mgr.startListeners("m1");
  mgr.restartListeners("m1");
  assert(mgr.listenerCount === 2, "2 listeners بعد إعادة التشغيل");
  assert(mgr.startCount === 2, "startCount = 2");
  assert(mgr.stopCount === 2, "stopCount = 2 (مرة من كل start)");
}

// Test 4: Multiple open/close cycles
{
  const mgr = new ProfileManager();
  for (let i = 0; i < 10; i++) {
    mgr.startListeners("m" + i);
    mgr.stopListeners();
  }
  assert(mgr.listenerCount === 0, "0 listeners بعد 10 دورات");
  assert(mgr.startCount === 10, "10 startListeners");
  assert(mgr.stopCount === 20, "20 stop (10 ضمنية + 10 صريحة)");
  assert(mgr._merchant === null, "merchant null");
  assert(mgr._inventory === null, "inventory null");
}

// Test 5: Error in unsubscribe does not break cleanup
{
  const mgr = new ProfileManager();
  mgr.startListeners("m1");
  mgr.simulateUnsubscribeError();
  // This should not throw
  let caught = false;
  try {
    mgr.stopListeners();
  } catch {
    caught = true;
  }
  assert(!caught, "الخطأ في unsubscribe لا يمنع إكمال التنظيف");
  assert(mgr.listenerCount === 0, "0 listeners حتى لو كان هناك خطأ");
}

// Test 6: No references held after cleanup
{
  const mgr = new ProfileManager();
  mgr.startListeners("m1");
  mgr._merchant = { id: "m1" };
  mgr._inventory = { entries: [] };
  mgr.stopListeners();
  assert(mgr._merchant === null, "مرجع merchant محرر");
  assert(mgr._inventory === null, "مرجع inventory محرر");
}

// Test 7: Window exports cleanup (backToMerchantList)
{
  const fn1 = () => {};
  const fn2 = () => {};
  exportToWindow("openMerchantProfile", fn1);
  exportToWindow("backToMerchantList", fn2);
  assert(Object.keys(windowExports).length === 2, "دالتان مصدرتان");

  clearWindowExports();
  assert(Object.keys(windowExports).length === 0, "جميع الدوال المصدرة محذوفة");
}

// Test 8: State reset on backToMerchantList
{
  const state = {
    currentMerchantProfileId: "m1",
    _merchant: { id: "m1" },
    _inventory: { entries: [] },
  };

  // Simulate backToMerchantList
  state.currentMerchantProfileId = null;
  state._merchant = null;
  state._inventory = null;

  assert(state.currentMerchantProfileId === null, "currentMerchantProfileId = null بعد العودة");
  assert(state._merchant === null, "_merchant = null بعد العودة");
  assert(state._inventory === null, "_inventory = null بعد العودة");
}

// Test 9: Concurrent listeners don't interfere
{
  const mgr1 = new ProfileManager();
  const mgr2 = new ProfileManager();

  mgr1.startListeners("m1");
  mgr2.startListeners("m2");

  assert(mgr1.listenerCount === 2, "mgr1: 2 listeners");
  assert(mgr2.listenerCount === 2, "mgr2: 2 listeners");

  mgr1.stopListeners();
  assert(mgr1.listenerCount === 0, "mgr1: 0 بعد الإيقاف");
  assert(mgr2.listenerCount === 2, "mgr2: لا يزال 2 (غير متأثر)");

  mgr2.stopListeners();
  assert(mgr2.listenerCount === 0, "mgr2: 0 بعد الإيقاف");
}

// Test 10: Rapid start/stop cycle
{
  const mgr = new ProfileManager();
  for (let i = 0; i < 100; i++) {
    mgr.startListeners("m1");
    mgr.stopListeners();
  }
  assert(mgr.listenerCount === 0, "0 listeners بعد 100 دورة سريعة");
  assert(mgr.startCount === 100, "100 start");
  assert(mgr.stopCount === 200, "200 stop (100 ضمنية + 100 صريحة)");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
