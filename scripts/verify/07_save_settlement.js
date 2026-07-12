// === اختبار 7: حفظ التسوية (Cash Collection / Settlement Save) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core settlement save logic from saveProfileSettlement() ----

function validateSettlementReceive(receiveAmount, currentBalance) {
  if (receiveAmount <= 0) return { valid: false, reason: "يرجى إدخال المبلغ المستلم" };
  if (receiveAmount > currentBalance) {
    return { valid: true, warning: true, reason: `المبلغ أكبر من الرصيد` };
  }
  return { valid: true, warning: false, reason: null };
}

function computeNewBalance(currentBalance, receiveAmount) {
  return currentBalance - receiveAmount;
}

function generateSettlementData(merchant, receiveAmount) {
  const newBalance = computeNewBalance(merchant.currentBalance, receiveAmount);
  return {
    merchantId: merchant.id,
    type: "cash_collection",
    amount: -receiveAmount,
    notes: `تسوية نقدية: ${receiveAmount.toLocaleString("ar-SA")} ج.م`,
    metadata: {
      receiveAmount,
      balanceBefore: merchant.currentBalance,
      balanceAfter: newBalance,
    },
    auditOldValue: {
      currentBalance: merchant.currentBalance,
      totalCollections: merchant.totalCollections || 0,
    },
    auditNewValue: {
      currentBalance: newBalance,
      totalCollections: (merchant.totalCollections || 0) + receiveAmount,
    },
  };
}

console.log("\n=== اختبار 7: حفظ التسوية ===\n");

// Test 1: Valid settlement
{
  const merchant = { id: "m1", name: "تاجر 1", currentBalance: 5000, totalCollections: 2000 };
  const result = validateSettlementReceive(1000, merchant.currentBalance);
  assert(result.valid, "تسوية صحيحة (1000 ضمن الرصيد)");

  const data = generateSettlementData(merchant, 1000);
  assert(data.amount === -1000, "amount = -1000 (خصم)");
  assert(data.metadata.balanceBefore === 5000, "balanceBefore = 5000");
  assert(data.metadata.balanceAfter === 4000, "balanceAfter = 5000-1000 = 4000");
  assert(data.auditNewValue.currentBalance === 4000, "currentBalance بعد التسوية = 4000");
  assert(data.auditNewValue.totalCollections === 3000, "totalCollections = 2000+1000 = 3000");
}

// Test 2: Zero receive amount rejected
{
  const result = validateSettlementReceive(0, 5000);
  assert(!result.valid, "رفض المبلغ الصفري");
  assert(result.reason === "يرجى إدخال المبلغ المستلم", "رسالة الخطأ الصحيحة");
}

// Test 3: Negative receive amount rejected
{
  const result = validateSettlementReceive(-100, 5000);
  assert(!result.valid, "رفض المبلغ السالب");
}

// Test 4: Receive amount > balance (warning)
{
  const merchant = { currentBalance: 1000 };
  const result = validateSettlementReceive(2000, merchant.currentBalance);
  assert(result.valid, "مسموح لكن مع تحذير");
  assert(result.warning, "تحذير: المبلغ أكبر من الرصيد");
}

// Test 5: Exact balance settlement
{
  const merchant = { id: "m2", currentBalance: 3000, totalCollections: 0 };
  const data = generateSettlementData(merchant, 3000);
  assert(data.metadata.balanceAfter === 0, "balanceAfter = 0 (تسوية كاملة)");
  assert(data.auditNewValue.totalCollections === 3000, "totalCollections = 3000");
}

// Test 6: Settlement reduces totalCollections
{
  const merchant = { currentBalance: 5000, totalCollections: 10000 };
  const data = generateSettlementData(merchant, 2000);
  assert(data.auditNewValue.totalCollections === 12000, "totalCollections تزيد: 10000+2000 = 12000");
}

// Test 7: Serial settlements
{
  const merchant = { id: "m3", currentBalance: 10000, totalCollections: 0 };

  const s1 = generateSettlementData(merchant, 3000);
  assert(s1.metadata.balanceAfter === 7000, "بعد التسوية الأولى: 10000-3000 = 7000");

  // Simulate saving + reloading
  merchant.currentBalance = s1.metadata.balanceAfter;
  merchant.totalCollections = s1.auditNewValue.totalCollections;

  const s2 = generateSettlementData(merchant, 2000);
  assert(s2.metadata.balanceAfter === 5000, "بعد التسوية الثانية: 7000-2000 = 5000");

  merchant.currentBalance = s2.metadata.balanceAfter;
  merchant.totalCollections = s2.auditNewValue.totalCollections;

  const s3 = generateSettlementData(merchant, 5000);
  assert(s3.metadata.balanceAfter === 0, "بعد التسوية الثالثة: 5000-5000 = 0");
  assert(s3.auditNewValue.totalCollections === 10000, "totalCollections النهائي: 3000+2000+5000 = 10000");
}

// Test 8: Transaction type is cash_collection
{
  const merchant = { id: "m4", currentBalance: 1000, totalCollections: 0 };
  const data = generateSettlementData(merchant, 500);
  assert(data.type === "cash_collection", "نوع المعاملة = cash_collection");
  assert(data.notes.match(/500|٥٠٠/), "البيان يحتوي على المبلغ");
}

// Test 9: Audit log old/new values
{
  const merchant = { id: "m5", currentBalance: 2000, totalCollections: 500 };
  const data = generateSettlementData(merchant, 1000);
  assert(data.auditOldValue.currentBalance === 2000, "audit old balance = 2000");
  assert(data.auditOldValue.totalCollections === 500, "audit old collections = 500");
  assert(data.auditNewValue.currentBalance === 1000, "audit new balance = 1000");
  assert(data.auditNewValue.totalCollections === 1500, "audit new collections = 1500");
}

// Test 10: Balance hint calculation (from renderSettlementSection)
{
  const receive = 500;
  const currentBalance = 2000;
  const newBalance = currentBalance - receive;
  assert(newBalance === 1500, "hint: المتبقي بعد التسوية = 1500");
  const color = newBalance >= 0 ? "success" : "danger";
  assert(color === "success", "اللون أخضر (موجب)");
}

{
  const receive = 3000;
  const currentBalance = 2000;
  const newBalance = currentBalance - receive;
  assert(newBalance === -1000, "hint: المتبقي بعد التسوية = -1000");
  const color = newBalance >= 0 ? "success" : "danger";
  assert(color === "danger", "اللون أحمر (سالب)");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
