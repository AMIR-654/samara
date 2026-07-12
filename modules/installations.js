// ===== Installations Module =====

async function loadMerchantInstallations(merchantId) {
  try {
    const snap = await db.collection("merchant_installations")
      .where("merchantId", "==", merchantId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Installations] Load failed:", err.message);
    return [];
  }
}

function openInstallationModal(merchantId) {
  const merchant = merchantsCache.find((m) => m.id === merchantId);
  $("instMerchantId").value = merchantId;
  $("instModalTitle").textContent = `إضافة تركيب — ${merchant ? merchant.name : ""}`;
  $("instCustomerName").value = "";
  $("instCustomerPhone").value = "";
  $("instRegion").value = "";
  $("instSubscriptionType").value = "";
  $("instPrice").value = "";
  $("instNotes").value = "";
  $("instDate").value = new Date().toISOString().split("T")[0];
  $("instStatus").value = "completed";
  $("instModal").classList.add("open");
}

async function saveInstallation(e) {
  e.preventDefault();
  const merchantId = $("instMerchantId").value;
  if (!merchantId) return;

  const customerName = $("instCustomerName").value.trim();
  if (!customerName) { showToast("اسم العميل مطلوب", "warning"); return; }

  const customerPhone = $("instCustomerPhone").value.trim();
  if (customerPhone && !/^01[0-9]{9}$/.test(customerPhone)) { showToast("رقم هاتف العميل غير صحيح", "warning"); return; }

  const price = parseFloat($("instPrice").value) || 0;
  if (price < 0) { showToast("السعر لا يمكن أن يكون سالباً", "warning"); return; }

  const date = $("instDate").value;
  if (!date) { showToast("التاريخ مطلوب", "warning"); return; }

  const data = {
    merchantId, customerName, customerPhone,
    region: $("instRegion").value.trim(),
    subscriptionType: $("instSubscriptionType").value.trim(),
    price, notes: $("instNotes").value.trim(), date,
    status: $("instStatus").value, createdBy: "admin",
  };

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const instRef = db.collection("merchant_installations").doc();
    const instId = instRef.id;

    await db.runTransaction(async (transaction) => {
      transaction.set(instRef, { ...data, createdAt: now, updatedAt: now });

      const txnRef = db.collection("merchant_transactions").doc(merchantId).collection("items").doc();
      transaction.set(txnRef, {
        type: "installation", merchantId, amount: price, date, time, createdBy: "admin",
        notes: `تركيب: ${customerName} - ${data.region || "بدون منطقة"}${data.subscriptionType ? " (" + data.subscriptionType + ")" : ""}`,
        priceSnapshot: [], metadata: { installationId: instId, customerName, region: data.region, subscriptionType: data.subscriptionType },
        createdAt: now, updatedAt: now,
      });

      const merchantRef = db.collection("merchants").doc(merchantId);
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const today = new Date();
      const currentMonth = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
      const isSameMonth = (mData.monthlyStatsPeriod || "") === currentMonth;

      transaction.update(merchantRef, {
        installationCount: firebase.firestore.FieldValue.increment(1),
        currentBalance: firebase.firestore.FieldValue.increment(price),
        // Monthly denormalized stats (reset automatically when month changes)
        monthlyStatsPeriod: currentMonth,
        monthlyInstallationsValue: isSameMonth
          ? firebase.firestore.FieldValue.increment(price)
          : price,
        updatedAt: now,
      });

      const auditRef = db.collection("merchant_audit_logs").doc();
      transaction.set(auditRef, {
        action: "create", collection: "merchant_installations", docId: instId,
        oldValue: null, newValue: data,
        performedBy: "admin", reason: "إضافة تركيب", timestamp: now, date, time,
      });

      const notifRef = db.collection("merchant_notifications").doc();
      transaction.set(notifRef, {
        merchantId, type: "installation", title: "تركيب جديد",
        message: `تم إضافة تركيب ${customerName ? "لـ " + customerName : ""} بقيمة ${price.toLocaleString("ar-SA")} ج.م`,
        read: false, createdAt: now,
      });
    });

    $("instModal").classList.remove("open");
    await loadMerchants();
    if (typeof markAccountsDirty === "function") markAccountsDirty();
    if (typeof refreshAccountsUI === "function") await refreshAccountsUI();
    if (typeof currentMerchantProfileId !== "undefined" && currentMerchantProfileId === merchantId) {
      if (typeof refreshMerchantProfile === "function") await refreshMerchantProfile();
    }
    showToast("✅ تم إضافة التركيب بنجاح", "success");
  } catch (err) {
    showToast("خطأ في إضافة التركيب: " + err.message, "error");
  }
}

async function deleteInstallation(id) {
  if (!confirm("هل تريد حذف هذا التركيب؟")) return;
  try {
    const instDoc = await db.collection("merchant_installations").doc(id).get();
    if (!instDoc.exists) { showToast("التركيب غير موجود", "warning"); return; }
    const instData = instDoc.data();
    const merchantId = instData.merchantId;
    const price = instData.price || 0;

    await db.runTransaction(async (transaction) => {
      transaction.delete(instDoc.ref);
      if (merchantId) {
        transaction.update(db.collection("merchants").doc(merchantId), {
          installationCount: firebase.firestore.FieldValue.increment(-1),
          currentBalance: firebase.firestore.FieldValue.increment(-price),
        });
      }
    });

    await recordAudit("delete", "merchant_installations", id, null, null, "حذف تركيب");
    if (typeof currentMerchantProfileId !== "undefined" && currentMerchantProfileId) {
      if (typeof refreshMerchantProfile === "function") await refreshMerchantProfile();
    }
    showToast("✅ تم حذف التركيب", "success");
  } catch (err) {
    showToast("خطأ في الحذف: " + err.message, "error");
  }
}

window.openInstallationModal = openInstallationModal;
window.saveInstallation = saveInstallation;
window.deleteInstallation = deleteInstallation;
