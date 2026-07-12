// === اختبار 17: Real-time Sync عبر onSnapshot ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core onSnapshot pattern from merchantProfile.js ----

class ProfileListenerManager {
  constructor() {
    this._unsubscribers = [];
    this._listenerCount = 0;
    this._merchantData = null;
    this._inventoryData = null;
    this._callbackCalls = { merchant: 0, inventory: 0 };
  }

  startMerchantListener(merchantId) {
    const unsub = () => {
      this._listenerCount = Math.max(0, this._listenerCount - 1);
    };
    this._unsubscribers.push(unsub);
    this._listenerCount++;
    return unsub;
  }

  startInventoryListener(merchantId) {
    const unsub = () => {
      this._listenerCount = Math.max(0, this._listenerCount - 1);
    };
    this._unsubscribers.push(unsub);
    this._listenerCount++;
    return unsub;
  }

  stopAll() {
    this._unsubscribers.forEach((u) => { try { u(); } catch {} });
    this._unsubscribers = [];
    this._listenerCount = 0;
  }

  simulateMerchantUpdate(data) {
    this._merchantData = data;
    this._callbackCalls.merchant++;
  }

  simulateInventoryUpdate(data) {
    this._inventoryData = data;
    this._callbackCalls.inventory++;
  }

  getState() {
    return {
      listenerCount: this._listenerCount,
      merchantData: this._merchantData,
      inventoryData: this._inventoryData,
      callbackCalls: { ...this._callbackCalls },
    };
  }

  get activeListeners() { return this._listenerCount; }
}

// ---- Cache update pattern ----
const merchantsCache = [];

function updateCache(merchantId, data) {
  const idx = merchantsCache.findIndex((m) => m.id === merchantId);
  if (idx !== -1) {
    merchantsCache[idx] = data;
  } else {
    merchantsCache.push(data);
  }
}

console.log("\n=== اختبار 17: Real-time Sync عبر onSnapshot ===\n");

// Test 1: Start listeners
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.startInventoryListener("m1");
  assert(mgr.activeListeners === 2, "2 listeners نشطة بعد بدء المراقبة");
}

// Test 2: Stop all listeners
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.startInventoryListener("m1");
  mgr.stopAll();
  assert(mgr.activeListeners === 0, "0 listeners بعد stopAll");
  assert(mgr._unsubscribers.length === 0, "قائمة الـ unsubscribers فارغة");
}

// Test 3: Merchant update triggers callback
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.simulateMerchantUpdate({ id: "m1", name: "تاجر 1", currentBalance: 5000 });
  const state = mgr.getState();
  assert(state.callbackCalls.merchant === 1, "تم استدعاء callback merchant مرة واحدة");
  assert(state.merchantData.name === "تاجر 1", "data merchant محدثة");
}

// Test 4: Inventory update triggers callback
{
  const mgr = new ProfileListenerManager();
  mgr.startInventoryListener("m1");
  mgr.simulateInventoryUpdate({ entries: [{ category: "A", count: 10 }] });
  const state = mgr.getState();
  assert(state.callbackCalls.inventory === 1, "تم استدعاء callback inventory مرة واحدة");
  assert(state.inventoryData.entries.length === 1, "data inventory محدثة");
}

// Test 5: Listeners survive multiple calls
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.simulateMerchantUpdate({ currentBalance: 1000 });
  mgr.simulateMerchantUpdate({ currentBalance: 2000 });
  mgr.simulateMerchantUpdate({ currentBalance: 3000 });
  assert(mgr.getState().callbackCalls.merchant === 3, "3 تحديثات للـ merchant");
  assert(mgr.getState().merchantData.currentBalance === 3000, "آخر قيمة = 3000");
}

// Test 6: Cache update pattern
{
  // Reset cache
  merchantsCache.length = 0;
  merchantsCache.push({ id: "m1", name: "قديم", currentBalance: 1000 });

  // Simulate onSnapshot update
  const snapData = { id: "m1", name: "جديد", currentBalance: 2000 };
  updateCache("m1", { id: snapData.id, ...snapData });

  const cached = merchantsCache.find((m) => m.id === "m1");
  assert(cached.name === "جديد", "cache محدث: name = جديد");
  assert(cached.currentBalance === 2000, "cache محدث: balance = 2000");
}

// Test 7: New merchant added to cache
{
  merchantsCache.length = 0;
  updateCache("m2", { id: "m2", name: "تاجر جديد", currentBalance: 500 });
  assert(merchantsCache.length === 1, "تاجر جديد مضاف إلى cache");
  assert(merchantsCache[0].id === "m2", "cache: id = m2");
}

// Test 8: No memory leak — stopping twice is safe
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.startInventoryListener("m1");
  mgr.stopAll();
  mgr.stopAll(); // Second stop should not throw
  assert(mgr.activeListeners === 0, "stopAll مرتين لا يسبب خطأ");
}

// Test 9: Listener count equals active unsubscribers
{
  const mgr = new ProfileListenerManager();
  assert(mgr.activeListeners === 0, "بدون listeners = 0");
  mgr.startMerchantListener("m1");
  assert(mgr.activeListeners === 1, "بعد merchant listener = 1");
  mgr.startInventoryListener("m1");
  assert(mgr.activeListeners === 2, "بعد inventory listener = 2");
  // Unsubscribe one
  const unsub = mgr.startMerchantListener("m1");
  assert(mgr.activeListeners === 3, "بعد listener ثالث = 3");
  unsub();
  assert(mgr.activeListeners === 2, "بعد إلغاء واحد = 2");
}

// Test 10: Real-time settlement update through listeners
{
  const mgr = new ProfileListenerManager();
  mgr.startMerchantListener("m1");
  mgr.startInventoryListener("m1");

  // Initial state
  mgr.simulateMerchantUpdate({ id: "m1", currentBalance: 5000, totalSettlements: 2000 });
  mgr.simulateInventoryUpdate({ entries: [{ category: "A", count: 50 }] });

  // After settlement — onSnapshot updates merchant
  mgr.simulateMerchantUpdate({ id: "m1", currentBalance: 3500, totalSettlements: 3500 });
  // After settlement — onSnapshot updates inventory
  mgr.simulateInventoryUpdate({ entries: [{ category: "A", count: 20 }] });

  const state = mgr.getState();
  assert(state.merchantData.currentBalance === 3500, "real-time: currentBalance = 3500");
  assert(state.inventoryData.entries[0].count === 20, "real-time: inventory count = 20");
  assert(state.callbackCalls.merchant === 2, "real-time: 2 merchant callbacks");
  assert(state.callbackCalls.inventory === 2, "real-time: 2 inventory callbacks");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
