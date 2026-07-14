// ===== Audit Log Module =====
// Records all modifications with before/after values

async function recordAudit(action, collectionName, docId, oldValue, newValue, reason) {
  try {
    await db.collection("merchant_audit_logs").add({
      action,           // "create" | "update" | "archive" | "delete" | "restore"
      collection: collectionName,
      docId,
      oldValue: oldValue || null,
      newValue: newValue || null,
      performedBy: "admin",
      reason: reason || "",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    });
  } catch (err) {
    console.warn("[Audit] Failed to record:", err.message);
  }
}

async function loadAuditLog(merchantId, limitCount = 50) {
  try {
    let query = db.collection("merchant_audit_logs")
      .orderBy("timestamp", "desc")
      .limit(limitCount);

    if (merchantId) {
      query = db.collection("merchant_audit_logs")
        .where("docId", "==", merchantId)
        .orderBy("timestamp", "desc")
        .limit(limitCount);
    }

    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Audit] Failed to load:", err.message);
    return [];
  }
}

function renderAuditLog(entries, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">لا توجد عمليات بعد</p>';
    return;
  }

  container.innerHTML = entries.map((e) => {
    const actionLabels = {
      create: "إنشاء",
      update: "تعديل",
      archive: "أرشفة",
      delete: "حذف",
      restore: "استعادة",
    };
    const label = actionLabels[e.action] || e.action;
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:16px;flex-shrink:0;width:28px;text-align:center;">
          ${e.action === "create" ? "➕" : e.action === "update" ? "✏️" : e.action === "archive" ? "📦" : e.action === "delete" ? "🗑️" : "🔄"}
        </span>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;">
            <strong style="font-size:13px;">${label}</strong>
            <span style="font-size:11px;color:var(--text-muted);">${e.date || ""} ${e.time || ""}</span>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:2px 0;">
            ${e.collection || ""} ${e.reason ? "— " + e.reason : ""}
          </p>
          ${e.oldValue ? `<details style="font-size:11px;margin-top:4px;"><summary style="cursor:pointer;color:var(--text-muted);">القيمة القديمة</summary><pre style="background:var(--bg);padding:6px;border-radius:4px;margin-top:4px;overflow-x:auto;font-size:11px;">${escapeHtml(JSON.stringify(e.oldValue, null, 2))}</pre></details>` : ""}
          ${e.newValue ? `<details style="font-size:11px;margin-top:4px;"><summary style="cursor:pointer;color:var(--text-muted);">القيمة الجديدة</summary><pre style="background:var(--bg);padding:6px;border-radius:4px;margin-top:4px;overflow-x:auto;font-size:11px;">${escapeHtml(JSON.stringify(e.newValue, null, 2))}</pre></details>` : ""}
        </div>
      </div>
    `;
  }).join("");
}
