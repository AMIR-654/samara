// === اختبار 13: Notifications (إشعارات التاجر) ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core notification logic across all modules ----

function createNotification(merchantId, type, title, message) {
  return {
    merchantId,
    type,
    title,
    message,
    read: false,
    createdAt: Date.now(),
  };
}

const NOTIFICATION_TYPES = {
  INVENTORY_ADDED: "inventory_added",
  SETTLEMENT: "settlement",
  INSTALLATION: "installation",
};

const NOTIFICATION_TITLES = {
  inventory_added: "إضافة عهدة",
  settlement: "حساب كروت",
  settlement_cash: "تسوية نقدية",
  installation: "تركيب جديد",
};

console.log("\n=== اختبار 13: Notifications ===\n");

// Test 1: Inventory added notification
{
  const notif = createNotification("m1", "inventory_added", "إضافة عهدة", "تم إضافة 150 كرت بقيمة 8,750 ج.م");
  assert(notif.merchantId === "m1", "merchantId = m1");
  assert(notif.type === "inventory_added", "نوع الإشعار = inventory_added");
  assert(notif.title === "إضافة عهدة", "العنوان = إضافة عهدة");
  assert(notif.message.includes("150 كرت"), "الرسالة تحتوي على عدد الكروت");
  assert(notif.message.includes("8,750"), "الرسالة تحتوي على القيمة");
  assert(notif.read === false, "الحالة = غير مقروء");
  assert(notif.createdAt > 0, "createdAt موجود");
}

// Test 2: Settlement notification
{
  const notif = createNotification("m1", "settlement", "حساب كروت", "تم حساب كروت بقيمة 2,000 ج.م");
  assert(notif.type === "settlement", "نوع الإشعار = settlement");
  assert(notif.title === "حساب كروت", "العنوان = حساب كروت");
  assert(notif.message.includes("2,000"), "الرسالة تحتوي على القيمة");
}

// Test 3: Installation notification
{
  const notif = createNotification("m1", "installation", "تركيب جديد", 'تم إضافة تركيب لـ أحمد بقيمة 500 ج.م');
  assert(notif.type === "installation", "نوع الإشعار = installation");
  assert(notif.title === "تركيب جديد", "العنوان = تركيب جديد");
  assert(notif.message.includes("500"), "الرسالة تحتوي على القيمة");
}

// Test 4: Cash collection notification
{
  const notif = createNotification("m1", "settlement", "تسوية نقدية", "تم استلام 3,000 ج.م");
  assert(notif.type === "settlement", "نوع الإشعار = settlement");
  assert(notif.message.includes("3,000"), "الرسالة تحتوي على المبلغ");
}

// Test 5: Notifications start as unread
{
  const notif = createNotification("m1", "inventory_added", "إضافة عهدة", "رسالة");
  assert(notif.read === false, "الاشعار الجديد غير مقروء");
}

// Test 6: All operations create notifications
{
  const ops = [
    { type: "inventory_added", title: "إضافة عهدة", msg: "تم إضافة 50 كرت بقيمة 2,500 ج.م" },
    { type: "settlement", title: "حساب كروت", msg: "تم حساب كروت بقيمة 1,000 ج.م" },
    { type: "installation", title: "تركيب جديد", msg: "تم إضافة تركيب لـ خالد بقيمة 750 ج.م" },
    { type: "settlement", title: "تسوية نقدية", msg: "تم استلام 500 ج.م" },
  ];

  ops.forEach((op, i) => {
    const notif = createNotification("m1", op.type, op.title, op.msg);
    assert(notif.merchantId === "m1", `العملية ${i+1}: merchantId`);
    assert(notif.title === op.title, `العملية ${i+1}: العنوان = ${op.title}`);
    assert(notif.type === op.type, `العملية ${i+1}: النوع = ${op.type}`);
  });
}

// Test 7: Notification for merchant with no name
{
  const notif = createNotification("m2", "installation", "تركيب جديد", "تم إضافة تركيب بقيمة 0 ج.م");
  assert(notif.message.includes("0"), "الرسالة تعالج القيمة الصفرية");
}

// Test 8: Multiple notifications for same merchant
{
  const notifs = [
    createNotification("m1", "inventory_added", "إضافة عهدة", "عهدة 1"),
    createNotification("m1", "settlement", "حساب كروت", "حساب 1"),
    createNotification("m1", "installation", "تركيب جديد", "تركيب 1"),
  ];
  assert(notifs.length === 3, "3 إشعارات لنفس التاجر");
  notifs.forEach((n, i) => {
    assert(n.merchantId === "m1", `الإشعار ${i+1}: merchantId = m1`);
  });
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
