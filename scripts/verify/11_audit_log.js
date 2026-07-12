// === اختبار 11: Audit Log ===

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.error(`  ❌ ${msg}`); failed++; }
}

// ---- Core audit logic extracted from audit.js ----

const auditStore = [];

function recordAudit(action, collection, docId, oldValue, newValue, reason) {
  const entry = {
    action,
    collection,
    docId,
    oldValue: oldValue || null,
    newValue: newValue || null,
    performedBy: "admin",
    reason: reason || "",
    timestamp: Date.now(),
    date: new Date().toISOString().split("T")[0],
    time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
  };
  auditStore.push(entry);
  return entry;
}

function loadAuditLog(merchantId, limitCount = 50) {
  let entries = [...auditStore];
  if (merchantId) {
    entries = entries.filter((e) => e.docId === merchantId);
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, limitCount);
}

const ACTION_LABELS = {
  create: "إنشاء",
  update: "تعديل",
  archive: "أرشفة",
  delete: "حذف",
  restore: "استعادة",
};

function getActionLabel(action) {
  return ACTION_LABELS[action] || action;
}

console.log("\n=== اختبار 11: Audit Log ===\n");

// Test 1: Record a create audit
{
  const entry = recordAudit("create", "merchants", "m1", null, { name: "تاجر 1" }, "إضافة تاجر جديد");
  assert(entry.action === "create", "نوع العملية = create");
  assert(entry.collection === "merchants", "المجموعة = merchants");
  assert(entry.docId === "m1", "docId = m1");
  assert(entry.oldValue === null, "oldValue = null للإنشاء");
  assert(entry.newValue.name === "تاجر 1", "newValue يحتوي على البيانات");
  assert(entry.performedBy === "admin", "performedBy = admin");
  assert(entry.reason === "إضافة تاجر جديد", "السبب مسجل");
}

// Test 2: Record an update audit with before/after
{
  const entry = recordAudit("update", "merchants", "m1",
    { name: "تاجر 1", status: "active" },
    { name: "تاجر 1 محدث", status: "inactive" },
    "تحديث بيانات التاجر");
  assert(entry.action === "update", "نوع العملية = update");
  assert(entry.oldValue.name === "تاجر 1", "oldValue.name = تاجر 1");
  assert(entry.newValue.name === "تاجر 1 محدث", "newValue.name = تاجر 1 محدث");
  assert(entry.oldValue.status === "active", "oldValue.status = active");
  assert(entry.newValue.status === "inactive", "newValue.status = inactive");
}

// Test 3: Record archive audit
{
  const entry = recordAudit("archive", "merchants", "m1", { status: "active" }, { status: "archived" }, "أرشفة التاجر");
  assert(entry.action === "archive", "نوع العملية = archive");
  assert(entry.reason === "أرشفة التاجر", "سبب الأرشفة");
}

// Test 4: Record delete audit
{
  const entry = recordAudit("delete", "merchant_installations", "inst1", { price: 500 }, null, "حذف تركيب");
  assert(entry.action === "delete", "نوع العملية = delete");
  assert(entry.newValue === null, "newValue = null للحذف");
}

// Test 5: Load audit log by merchant
{
  const entries = loadAuditLog("m1");
  assert(entries.length === 3, "3 entries للتاجر m1");
  assert(entries[0].action === "archive" || entries[0].action === "delete" || entries[0].action === "update", "الأحدث أولاً");
}

// Test 6: Load audit log without filter
{
  // Record one more for a different merchant
  recordAudit("create", "merchant_inventory", "m2", null, { entries: [] }, "إضافة عهدة");
  const all = loadAuditLog();
  assert(all.length === 5, "جميع الـ entries = 5");
}

// Test 7: Load audit log with limit
{
  const limited = loadAuditLog(null, 2);
  assert(limited.length <= 2, "الحد الأقصى للنتائج = 2");
}

// Test 8: Action labels
{
  assert(getActionLabel("create") === "إنشاء", "create → إنشاء");
  assert(getActionLabel("update") === "تعديل", "update → تعديل");
  assert(getActionLabel("archive") === "أرشفة", "archive → أرشفة");
  assert(getActionLabel("delete") === "حذف", "delete → حذف");
  assert(getActionLabel("restore") === "استعادة", "restore → استعادة");
  assert(getActionLabel("unknown") === "unknown", "unknown → unknown");
}

// Test 9: Audit log contains timestamp
{
  const entry = recordAudit("create", "test", "t1", null, {}, "اختبار");
  assert(entry.timestamp > 0, "timestamp موجود");
  assert(entry.date.length > 0, "التاريخ موجود");
  assert(entry.time.length > 0, "الوقت موجود");
}

// Test 10: Audit entries order (newest first)
{
  const entries = loadAuditLog("m1");
  for (let i = 1; i < entries.length; i++) {
    assert(entries[i - 1].timestamp >= entries[i].timestamp, `الترتيب: entry ${i-1} أحدث من entry ${i}`);
  }
}

console.log(`\nالنتيجة: ${passed} ✅ / ${failed} ❌ (${Math.round(passed/(passed+failed)*100)}%)\n`);
