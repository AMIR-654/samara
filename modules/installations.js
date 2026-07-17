// ===== Installations Module =====

async function loadMerchantInstallations(merchantId) {
  try {
    const snap = await db.collection("merchant_installations")
      .where("merchantId", "==", merchantId)
      .get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const aVal = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : (a.createdAt || 0);
      const bVal = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : (b.createdAt || 0);
      return bVal - aVal;
    });
    return list.slice(0, 50);
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
      const merchantRef = db.collection("merchants").doc(merchantId);
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;
      const newBalance = oldBalance + price;
      // Use installation date for monthly stats period, not current date
      const instDate = new Date(date + "T00:00:00");
      const currentMonth = instDate.getFullYear() + "-" + String(instDate.getMonth() + 1).padStart(2, "0");
      const isSameMonth = (mData.monthlyStatsPeriod || "") === currentMonth;

      const beforeState = {
        currentBalance: mData.currentBalance || 0,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: mData.installationCount ?? 0,
      };
      const afterState = {
        currentBalance: newBalance,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: (mData.installationCount || 0) + 1,
      };

      transaction.set(instRef, { ...data, createdAt: now, updatedAt: now });

      const txnRef = db.collection("merchant_transactions").doc(merchantId).collection("items").doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        type: "installation", merchantId, amount: price,
        balanceBefore: oldBalance, balanceAfter: newBalance,
        date, time, createdBy: "admin",
        notes: `تركيب: ${customerName} - ${data.region || "بدون منطقة"}${data.subscriptionType ? " (" + data.subscriptionType + ")" : ""}`,
        priceSnapshot: [], metadata: { installationId: instId, customerName, region: data.region, subscriptionType: data.subscriptionType },
        createdAt: now, updatedAt: now,
        operationId: txnRef.id,
        operationType: "installation",
        before: beforeState,
        after: afterState,
        timestamp: Date.now(),
      });

      transaction.update(merchantRef, {
        installationCount: (mData.installationCount || 0) + 1,
        currentBalance: newBalance,
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

      createMerchantNotification({
        merchantId, userId: mData.username,
        type: "installation", title: "تركيب جديد",
        body: `تم إضافة تركيب ${customerName ? "لـ " + customerName : ""} بقيمة ${price.toLocaleString("ar-SA")} ج.م`,
        relatedDocumentId: instId,
        data: { customerName, region: data.region, subscriptionType: data.subscriptionType, price },
        transaction,
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
    const now = Date.now();
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    await db.runTransaction(async (transaction) => {
      const merchantRef = db.collection("merchants").doc(merchantId);
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;
      const newBalance = oldBalance - price;
      const newInstallationCount = Math.max(0, (mData.installationCount || 0) - 1);
      const instDate = new Date(instData.date + "T00:00:00");
      const currentMonth = instDate.getFullYear() + "-" + String(instDate.getMonth() + 1).padStart(2, "0");
      const isSameMonth = (mData.monthlyStatsPeriod || "") === currentMonth;

      const beforeState = {
        currentBalance: mData.currentBalance || 0,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: mData.installationCount ?? 0,
      };
      const afterState = {
        currentBalance: newBalance,
        totalCards: mData.totalCards ?? 0,
        totalCardValue: mData.totalCardValue ?? 0,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: newInstallationCount,
      };

      transaction.delete(instDoc.ref);

      transaction.update(merchantRef, {
        installationCount: newInstallationCount,
        currentBalance: newBalance,
        updatedAt: now,
        monthlyStatsPeriod: currentMonth,
        monthlyInstallationsValue: isSameMonth
          ? Math.max(0, (mData.monthlyInstallationsValue || 0) - price)
          : (mData.monthlyInstallationsValue || 0),
      });

      const txnRef = db.collection("merchant_transactions").doc(merchantId).collection("items").doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        type: "adjustment", merchantId, amount: -price,
        balanceBefore: oldBalance, balanceAfter: newBalance,
        date, time, createdBy: "admin",
        notes: `حذف تركيب: ${instData.customerName || "بدون اسم"}${instData.region ? " - " + instData.region : ""}`,
        metadata: { deletedInstallationId: id, customerName: instData.customerName, region: instData.region },
        createdAt: now, updatedAt: now,
        operationId: txnRef.id,
        operationType: "installation_deleted",
        before: beforeState,
        after: afterState,
        timestamp: Date.now(),
      });

      createMerchantNotification({
        merchantId, userId: mData.username,
        type: "installation_deleted",
        title: "حذف تركيب",
        body: `تم حذف تركيب ${instData.customerName || ""} بقيمة ${price.toLocaleString("ar-SA")} ج.م`,
        relatedDocumentId: id,
        data: { customerName: instData.customerName, price },
        transaction,
      });
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
