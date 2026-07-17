// ===== Settlements Module =====

async function loadMerchantInventory(merchantId) {
  try {
    const doc = await db.collection("merchant_inventory").doc(merchantId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.warn("[Settlement] Load inventory failed:", err.message);
    return null;
  }
}

function openSettlementModal(merchantId) {
  const merchant = merchantsCache.find((m) => m.id === merchantId);
  $("settleMerchantId").value = merchantId;
  $("settleModalTitle").textContent = `حساب كروت — ${merchant ? merchant.name : ""}`;

  const container = $("settlePriceEntries");
  if (!container) return;

  if (!inventoryCardPrices.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">يرجى إضافة أسعار الكروت أولاً</p>';
    return;
  }

  container.innerHTML = inventoryCardPrices.map((p) => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="flex:1;font-weight:600;">فئة ${p.category}</span>
      <span style="font-size:12px;color:var(--text-muted);">السعر: ${p.merchantPrice} ج.م</span>
      <input type="number" min="0" value="0" class="settle-count"
        data-category-id="${p.id}"
        data-category="${p.category}"
        data-price="${p.merchantPrice}"
        style="width:80px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
    </div>
  `).join("");

  $("settleTotal").textContent = "0 ج.م";
  $("settleDetails").innerHTML = "";
  $("settleModal").classList.add("open");

  container.querySelectorAll(".settle-count").forEach((input) => {
    input.addEventListener("input", updateSettlementSummary);
  });
}

function updateSettlementSummary() {
  let grandTotal = 0;
  let detailsHtml = "";

  document.querySelectorAll(".settle-count").forEach((input) => {
    const count = parseInt(input.value) || 0;
    const price = parseFloat(input.dataset.price) || 0;
    if (count > 0) {
      const total = count * price;
      grandTotal += total;
      detailsHtml += `
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>فئة ${input.dataset.category}: ${count} × ${price} ج.م</span>
          <span style="font-weight:600;">= ${total.toLocaleString("ar-SA")} ج.م</span>
        </div>
      `;
    }
  });

  $("settleTotal").textContent = grandTotal.toLocaleString("ar-SA") + " ج.م";
  $("settleDetails").innerHTML = detailsHtml;
}

async function saveSettlement(e) {
  e.preventDefault();
  const merchantId = $("settleMerchantId").value;
  if (!merchantId) return;

  const entries = [];
  let grandTotal = 0;

  document.querySelectorAll(".settle-count").forEach((input) => {
    const count = parseInt(input.value) || 0;
    const price = parseFloat(input.dataset.price) || 0;
    if (count < 0) { showToast("عدد الكروت لا يمكن أن يكون سالباً", "warning"); return; }
    if (count <= 0) return;
    // Resolve canonical key: prefer doc ID, fall back to category name
    const categoryKey = input.dataset.categoryId || input.dataset.category;
    if (!categoryKey) { showToast("فئة الكرت غير محددة", "warning"); return; }
    const total = count * price;
    grandTotal += total;
    entries.push({ category: categoryKey, displayCategory: input.dataset.category, count, price, total });
  });

  if (!entries.length) { showToast("يرجى إدخال عدد الكروت المطلوب حسابها", "warning"); return; }
  if (grandTotal <= 0) { showToast("القيمة الإجمالية يجب أن تكون أكبر من صفر", "warning"); return; }

  if (!confirm(`تأكيد حساب الكروت بقيمة ${grandTotal.toLocaleString("ar-SA")} ج.م؟`)) return;

  try {
    const now = Date.now();
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    await db.runTransaction(async (transaction) => {
      const invRef = db.collection("merchant_inventory").doc(merchantId);
      const merchantRef = db.collection("merchants").doc(merchantId);

      const invDoc = await transaction.get(invRef);
      if (!invDoc.exists) throw new Error("لا توجد كروت كافية لهذا التاجر");

      const invData = invDoc.data();
      const currentEntries = invData.entries || [];

      entries.forEach((e) => {
        // Match by doc ID, category name, or displayCategory
        const invEntry = currentEntries.find((i) =>
          i.category === e.category || i.category === e.displayCategory
        );
        const available = invEntry ? invEntry.count : 0;
        if (available < e.count) throw new Error(`المخزون غير كافٍ لفئة "${e.displayCategory || e.category}". المتوفر: ${available}، المطلوب: ${e.count}`);
      });

      const mergedMap = {};
      currentEntries.forEach((e) => {
        mergedMap[e.category] = (mergedMap[e.category] || 0) + (e.count || 0);
      });
      entries.forEach((e) => {
        // Deduct using the matched key (may be doc ID or category name)
        const matchedKey = Object.keys(mergedMap).find((k) =>
          k === e.category || k === e.displayCategory
        );
        if (matchedKey) {
          mergedMap[matchedKey] = Math.max(0, (mergedMap[matchedKey] || 0) - e.count);
        }
      });

      const newEntries = Object.entries(mergedMap).filter(([, count]) => count > 0).map(([category, count]) => ({ category, count }));
      const newTotalCards = newEntries.reduce((s, e) => s + e.count, 0);
      const newTotalValue = newEntries.reduce((s, e) => {
        const priceDoc = inventoryCardPrices.find((p) => p.id === e.category || p.category === e.category);
        return s + e.count * (priceDoc?.merchantPrice || 0);
      }, 0);

      transaction.update(invRef, { entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue, updatedAt: now });

      // Read current merchant balance for before/after tracking
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;
      const newBalance = oldBalance - grandTotal;
      const oldTotalSettlements = mData.totalSettlements || 0;

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
        totalCards: newTotalCards,
        totalCardValue: newTotalValue,
        totalSettlements: oldTotalSettlements + grandTotal,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: mData.installationCount ?? 0,
      };

      transaction.update(merchantRef, {
        totalCards: newTotalCards, totalCardValue: newTotalValue,
        totalSettlements: oldTotalSettlements + grandTotal,
        currentBalance: newBalance,
        updatedAt: now,
      });

      const txnRef = db.collection("merchant_transactions").doc(merchantId).collection("items").doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        type: "card_settlement", merchantId, amount: -grandTotal,
        balanceBefore: oldBalance, balanceAfter: newBalance,
        date, time, createdBy: "admin",
        notes: `حساب كروت: ${entries.map((e) => `${e.count} من فئة ${e.displayCategory || e.category}`).join("، ")}`,
        priceSnapshot: getPriceSnapshot(), metadata: { entries, grandTotal }, createdAt: now, updatedAt: now,
        operationId: txnRef.id,
        operationType: "card_settlement",
        before: beforeState,
        after: afterState,
        timestamp: now,
      });

      const auditRef = db.collection("merchant_audit_logs").doc();
      transaction.set(auditRef, {
        action: "create", collection: "merchant_settlement", docId: merchantId,
        oldValue: { entries: currentEntries, totalCards: invData.totalCards, totalValue: invData.totalValue },
        newValue: { entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue },
        performedBy: "admin", reason: "حساب كروت", timestamp: now, date, time,
      });

      createMerchantNotification({
        merchantId, userId: mData.username,
        type: "settlement", title: "حساب كروت",
        body: `تم حساب كروت بقيمة ${grandTotal.toLocaleString("ar-SA")} ج.م`,
        relatedDocumentId: merchantId,
        data: { entries, grandTotal },
        transaction,
      });
    });

    $("settleModal").classList.remove("open");
    await loadMerchants();
    if (typeof markAccountsDirty === "function") markAccountsDirty();
    if (typeof refreshAccountsUI === "function") await refreshAccountsUI();
    if (typeof currentMerchantProfileId !== "undefined" && currentMerchantProfileId === merchantId) {
      if (typeof refreshMerchantProfile === "function") await refreshMerchantProfile();
    }
    showToast("✅ تم حساب الكروت بنجاح", "success");
  } catch (err) {
    showToast("خطأ في حساب الكروت: " + err.message, "error");
  }
}

window.openSettlementModal = openSettlementModal;
window.saveSettlement = saveSettlement;
