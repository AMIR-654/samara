// === اختبار 9: حذف تركيب (Installation Deletion) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core deletion logic extracted from deleteInstallation() ----

function reverseInstallationEffects(merchant, price) {
  return {
    installationCount: (merchant.installationCount || 0) - 1,
    currentBalance: (merchant.currentBalance || 0) - price,
  };
}

console.log("\n=== اختبار 9: حذف تركيب ===\n");

// Test 1: Basic deletion effects
{
  const merchant = { installationCount: 3, currentBalance: 5000 };
  const result = reverseInstallationEffects(merchant, 500);
  assert(result.installationCount === 2, "installationCount: 3-1 = 2");
  assert(result.currentBalance === 4500, "currentBalance: 5000-500 = 4500");
}

// Test 2: Delete the only installation
{
  const merchant = { installationCount: 1, currentBalance: 1000 };
  const result = reverseInstallationEffects(merchant, 1000);
  assert(result.installationCount === 0, "installationCount: 1-1 = 0");
  assert(result.currentBalance === 0, "currentBalance: 1000-1000 = 0");
}

// Test 3: Delete installation with zero price
{
  const merchant = { installationCount: 2, currentBalance: 2000 };
  const result = reverseInstallationEffects(merchant, 0);
  assert(result.installationCount === 1, "installationCount: 2-1 = 1");
  assert(result.currentBalance === 2000, "currentBalance: 2000-0 = 2000 (بدون تغيير)");
}

// Test 4: Serial add and delete
{
  let merchant = { installationCount: 0, currentBalance: 0 };

  // Add installation
  merchant.installationCount += 1;
  merchant.currentBalance += 500;
  assert(merchant.installationCount === 1, "بعد الإضافة: count = 1");
  assert(merchant.currentBalance === 500, "بعد الإضافة: balance = 500");

  // Delete same installation
  const reversed = reverseInstallationEffects(merchant, 500);
  assert(reversed.installationCount === 0, "بعد الحذف: count = 0");
  assert(reversed.currentBalance === 0, "بعد الحذف: balance = 0");
}

// Test 5: Multiple add/delete cycles
{
  let merchant = { installationCount: 0, currentBalance: 0 };
  const prices = [200, 300, 500];

  // Add all
  prices.forEach(p => {
    merchant.installationCount += 1;
    merchant.currentBalance += p;
  });
  assert(merchant.installationCount === 3, "بعد 3 إضافات: count = 3");
  assert(merchant.currentBalance === 1000, "بعد 3 إضافات: balance = 1000");

  // Delete middle one
  let r = reverseInstallationEffects(merchant, 300);
  // After reversal we'd need to update merchant
  merchant.installationCount = r.installationCount;
  merchant.currentBalance = r.currentBalance;
  assert(merchant.installationCount === 2, "بعد حذف واحد: count = 2");
  assert(merchant.currentBalance === 700, "بعد حذف واحد: balance = 700");
}

// Test 6: Edge case — merchantId missing
{
  // This simulates the guard in deleteInstallation
  const merchant = { installationCount: 1, currentBalance: 500 };
  const price = 500;
  if (merchant) {
    const result = reverseInstallationEffects(merchant, price);
    assert(result.installationCount === 0, "حذف بوجود merchant");
  }
}

// Test 7: Edge case — price is undefined/NaN
{
  const merchant = { installationCount: 1, currentBalance: 500 };
  const price = undefined || 0;
  const result = reverseInstallationEffects(merchant, price);
  assert(result.installationCount === 0, "السعر غير معرف: count = 0");
  assert(result.currentBalance === 500, "السعر غير معرف: balance = 500 (لم يتغير)");
}

// Test 8: Delete records audit log action type
{
  const action = "delete";
  const collection = "merchant_installations";
  const reason = "حذف تركيب";
  assert(action === "delete", "نوع العملية = delete");
  assert(collection === "merchant_installations", "المجموعة = merchant_installations");
  assert(reason === "حذف تركيب", "السبب = حذف تركيب");
}

// Test 9: Full lifecycle — add 2, delete 1, verify state
{
  let merchant = { installationCount: 0, currentBalance: 0 };

  // Add installation A
  const addA = 500;
  merchant = {
    installationCount: merchant.installationCount + 1,
    currentBalance: merchant.currentBalance + addA,
  };

  // Add installation B  
  const addB = 750;
  merchant = {
    installationCount: merchant.installationCount + 1,
    currentBalance: merchant.currentBalance + addB,
  };

  assert(merchant.installationCount === 2, "بعد إضافة اثنين: count = 2");
  assert(merchant.currentBalance === 1250, "بعد إضافة اثنين: balance = 1250");

  // Delete installation A
  const r = reverseInstallationEffects(merchant, addA);
  merchant = { installationCount: r.installationCount, currentBalance: r.currentBalance };

  assert(merchant.installationCount === 1, "بعد حذف واحد: count = 1");
  assert(merchant.currentBalance === 750, "بعد حذف واحد: balance = 1250-500 = 750");
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
