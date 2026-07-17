// ===== Inventory (الكروت) Module =====

let inventoryCardPrices = [];

async function loadInventoryPrices() {
  try {
    const snap = await db.collection("merchant_card_prices")
      .orderBy("sortOrder", "asc")
      .get();
    inventoryCardPrices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Inventory] Failed to load prices:", err.message);
  }
}

function getPriceSnapshot() {
  return inventoryCardPrices.map((p) => ({
    category: p.category,
    merchantPrice: p.merchantPrice,
  }));
}

function openAddInventoryModal(merchantId) {
  const merchant = merchantsCache.find((m) => m.id === merchantId);
  $("invMerchantId").value = merchantId;
  $("invModalTitle").textContent = `إضافة كروت — ${merchant ? merchant.name : ""}`;

  const container = $("invPriceEntries");
  if (!container) return;

  if (!inventoryCardPrices.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">يرجى إضافة أسعار الكروت أولاً في إعدادات أسعار الكروت</p>';
  } else {
    // Filter only active prices
    const activePrices = inventoryCardPrices.filter(p => p.status !== "inactive");
    if (!activePrices.length) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">لا توجد فئات أسعار نشطة. يرجى تفعيل فئة واحدة على الأقل.</p>';
    } else {
      container.innerHTML = activePrices.map((p) => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="flex:1;font-weight:600;">فئة ${p.category}</span>
          <span style="font-size:12px;color:var(--text-muted);">السعر: ${p.merchantPrice} ج.م</span>
          <input type="number" min="0" value="0" class="inv-count"
            data-category-id="${p.id}"
            data-category="${p.category}"
            data-price="${p.merchantPrice}"
            style="width:80px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
        </div>
      `).join("");
    }
  }

  $("invTotalCards").textContent = "0";
  $("invTotalValue").textContent = "0 ج.م";
  $("invModal").classList.add("open");

  container.querySelectorAll(".inv-count").forEach((input) => {
    input.addEventListener("input", updateInventorySummary);
  });
}

function updateInventorySummary() {
  let totalCards = 0;
  let totalValue = 0;
  document.querySelectorAll(".inv-count").forEach((input) => {
    const count = parseInt(input.value) || 0;
    const price = parseFloat(input.dataset.price) || 0;
    totalCards += count;
    totalValue += count * price;
  });
  $("invTotalCards").textContent = totalCards.toLocaleString("ar-SA");
  $("invTotalValue").textContent = totalValue.toLocaleString("ar-SA") + " ج.م";
}

async function saveInventory(e) {
  e.preventDefault();
  const merchantId = $("invMerchantId").value;
  if (!merchantId) return;

  const entries = [];
  let formValid = true;
  document.querySelectorAll(".inv-count").forEach((input) => {
    const count = parseInt(input.value) || 0;
    if (count > 0) {
      const price = parseFloat(input.dataset.price) || 0;
      // Use doc ID as category key for backward-compatible linking
      const categoryId = input.dataset.categoryId || input.dataset.category;
      if (count < 0) { showToast("عدد الكروت لا يمكن أن يكون سالباً", "warning"); formValid = false; return; }
      if (!categoryId) { showToast("فئة الكرت غير محددة", "warning"); formValid = false; return; }
      entries.push({ category: categoryId, displayCategory: input.dataset.category, count, price });
    }
  });
  if (!formValid) return;

  if (!entries.length) { showToast("يرجى إدخال عدد الكروت المطلوب إضافتها", "warning"); return; }

  const totalCards = entries.reduce((s, e) => s + e.count, 0);
  const totalValue = entries.reduce((s, e) => s + e.count * e.price, 0);
  if (totalCards <= 0) { showToast("يجب إضافة كرت واحد على الأقل", "warning"); return; }

  try {
    const now = Date.now();
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    await db.runTransaction(async (transaction) => {
      const invRef = db.collection("merchant_inventory").doc(merchantId);
      const merchantRef = db.collection("merchants").doc(merchantId);

      const invDoc = await transaction.get(invRef);
      const invData = invDoc.exists ? invDoc.data() : { entries: [] };

      // Build name→ID lookup to normalize category keys
      var catLookup = {};
      inventoryCardPrices.forEach(function (p) {
        catLookup[p.category] = p.id;
      });
      // Normalize a category value to its doc ID (if known)
      function normalizeCat(cat) {
        return catLookup[String(cat)] || cat;
      }

      var mergedMap = {};
      (invData.entries || []).forEach(function (e) {
        var key = normalizeCat(e.category || "");
        mergedMap[key] = (mergedMap[key] || 0) + (e.count || 0);
      });
      entries.forEach(function (e) {
        var key = normalizeCat(e.category);
        mergedMap[key] = (mergedMap[key] || 0) + e.count;
      });

      const newEntries = Object.entries(mergedMap)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => ({ category, count }));
      const newTotalCards = newEntries.reduce((s, e) => s + e.count, 0);
      const newTotalValue = newEntries.reduce((s, e) => {
        const p = inventoryCardPrices.find((cp) => cp.id === e.category || cp.category === e.category)?.merchantPrice || 0;
        return s + e.count * p;
      }, 0);

      const txnNotes = entries.map((e) => `${e.count} كارت فئة ${e.displayCategory || e.category}`).join("، ");

      // Read current merchant balance for before/after tracking
      const merchantSnap = await transaction.get(merchantRef);
      const mData = merchantSnap.exists ? merchantSnap.data() : {};
      const oldBalance = mData.currentBalance || 0;
      const newBalance = oldBalance + totalValue;
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
        totalCards: newTotalCards,
        totalCardValue: newTotalValue,
        totalSettlements: mData.totalSettlements ?? 0,
        totalCollections: mData.totalCollections ?? 0,
        installationCount: mData.installationCount ?? 0,
      };

      if (invDoc.exists) {
        transaction.update(invRef, { entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue, updatedAt: now });
      } else {
        transaction.set(invRef, { merchantId, entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue, createdAt: now, updatedAt: now });
      }

      transaction.update(merchantRef, {
        totalCards: newTotalCards, totalCardValue: newTotalValue,
        currentBalance: newBalance,
        updatedAt: now,
        monthlyStatsPeriod: currentMonth,
        monthlyCardsAdded: isSameMonth ? firebase.firestore.FieldValue.increment(totalCards) : totalCards,
      });

      const txnRef = db.collection("merchant_transactions").doc(merchantId).collection("items").doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        type: "card_inventory_added", merchantId, amount: totalValue,
        balanceBefore: oldBalance, balanceAfter: newBalance,
        date, time, createdBy: "admin",
        notes: `إضافة كروت: ${txnNotes}`,
        priceSnapshot: getPriceSnapshot(), metadata: { entries, totalCards, totalValue }, createdAt: now, updatedAt: now,
        operationId: txnRef.id,
        operationType: "card_inventory_added",
        before: beforeState,
        after: afterState,
        timestamp: now,
      });

      const auditRef = db.collection("merchant_audit_logs").doc();
      transaction.set(auditRef, {
        action: "create", collection: "merchant_inventory", docId: merchantId,
        oldValue: invDoc.exists ? { entries: invData.entries, totalCards: invData.totalCards, totalValue: invData.totalValue } : null,
        newValue: { entries: newEntries, totalCards: newTotalCards, totalValue: newTotalValue },
        performedBy: "admin", reason: "إضافة كروت", timestamp: now, date, time,
      });

      createMerchantNotification({
        merchantId, userId: mData.username,
        type: "inventory_added", title: "إضافة كروت",
        body: `تم إضافة ${totalCards} كرت بقيمة ${totalValue.toLocaleString("ar-SA")} ج.م`,
        relatedDocumentId: merchantId,
        data: { entries, totalCards, totalValue },
        transaction,
      });
    });

    $("invModal").classList.remove("open");
    await loadMerchants();
    if (typeof markAccountsDirty === "function") markAccountsDirty();
    if (typeof refreshAccountsUI === "function") await refreshAccountsUI();
    if (typeof currentMerchantProfileId !== "undefined" && currentMerchantProfileId === merchantId) {
      if (typeof refreshMerchantProfile === "function") await refreshMerchantProfile();
    }
    showToast("✅ تم إضافة الكروت بنجاح", "success");
  } catch (err) {
    showToast("خطأ في حفظ الكروت: " + err.message, "error");
  }
}

// ===== Card Price Management =====

async function openCardPriceModal() {
  await loadInventoryPrices();
  renderCardPriceList();
  $("cardPriceModal").classList.add("open");
}

function renderCardPriceList() {
  const container = $("cardPriceList");
  if (!container) return;

  if (!inventoryCardPrices.length) {
    container.innerHTML = `
      <p style="text-align:center;color:var(--text-muted);padding:16px;">لا توجد فئات أسعار. أضف الفئة الأولى للبدء.</p>
      <div id="cpRowsContainer"></div>
    `;
    return;
  }

  const rowsHtml = inventoryCardPrices.map((p, i) => `
    <div class="cp-row" data-id="${p.id || ""}" style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;background:var(--surface);display:grid;grid-template-columns:1fr 1fr;gap:10px;" data-index="${i}">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الفئة (Category)</label>
        <input type="text" class="cp-category" value="${escapeHtml(p.category || "")}"
          style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;background:var(--surface);color:var(--text);" />
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);">سعر التاجر (Merchant Price)</label>
        <input type="number" class="cp-price" value="${p.merchantPrice || 0}" min="0" step="0.01"
          style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);">سعر البيع (Selling Price)</label>
        <input type="number" class="cp-selling-price" value="${p.sellingPrice || 0}" min="0" step="0.01"
          style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الحالة (Status)</label>
        <select class="cp-status" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;background:var(--surface);color:var(--text);height:37px;">
          <option value="active" ${p.status !== "inactive" ? "selected" : ""}>نشط (Active)</option>
          <option value="inactive" ${p.status === "inactive" ? "selected" : ""}>غير نشط (Inactive)</option>
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الترتيب (Sort Order)</label>
        <input type="number" class="cp-sort" value="${p.sortOrder || i}" min="0"
          style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:flex-end;">
        <button class="btn btn-sm" onclick="removeCardPriceRow(this)" style="width:100%;height:37px;background:var(--danger);color:white;border:none;border-radius:var(--radius-xs);cursor:pointer;font-weight:bold;">حذف الفئة</button>
      </div>
    </div>
  `).join("");

  container.innerHTML = `<div id="cpRowsContainer">${rowsHtml}</div>`;
}

function addCardPriceRow() {
  let rowsContainer = document.getElementById("cpRowsContainer");
  if (!rowsContainer) {
    const container = $("cardPriceList");
    if (!container) return;
    container.innerHTML = `<div id="cpRowsContainer"></div>`;
    rowsContainer = document.getElementById("cpRowsContainer");
  }

  const div = document.createElement("div");
  div.className = "cp-row";
  div.style.cssText = "border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;background:var(--surface);display:grid;grid-template-columns:1fr 1fr;gap:10px;";
  div.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الفئة (Category)</label>
      <input type="text" class="cp-category" value=""
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;background:var(--surface);color:var(--text);" />
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);">سعر التاجر (Merchant Price)</label>
      <input type="number" class="cp-price" value="0" min="0" step="0.01"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);">سعر البيع (Selling Price)</label>
      <input type="number" class="cp-selling-price" value="0" min="0" step="0.01"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الحالة (Status)</label>
      <select class="cp-status" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;background:var(--surface);color:var(--text);height:37px;">
        <option value="active" selected>نشط (Active)</option>
        <option value="inactive">غير نشط (Inactive)</option>
      </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);">الترتيب (Sort Order)</label>
      <input type="number" class="cp-sort" value="0" min="0"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:14px;text-align:center;background:var(--surface);color:var(--text);" />
    </div>
    <div style="display:flex;align-items:flex-end;justify-content:flex-end;">
      <button class="btn btn-sm" onclick="removeCardPriceRow(this)" style="width:100%;height:37px;background:var(--danger);color:white;border:none;border-radius:var(--radius-xs);cursor:pointer;font-weight:bold;">حذف الفئة</button>
    </div>
  `;
  rowsContainer.appendChild(div);
}

function removeCardPriceRow(btn) {
  const row = btn.closest(".cp-row");
  if (row) row.remove();
}

async function saveCardPrices() {
  const rows = document.querySelectorAll("#cardPriceList .cp-row");
  const prices = [];
  let hasErrors = false;

  rows.forEach((row) => {
    const id = row.dataset.id || "";
    const category = row.querySelector(".cp-category")?.value?.trim();
    const merchantPrice = parseFloat(row.querySelector(".cp-price")?.value) || 0;
    const sellingPrice = parseFloat(row.querySelector(".cp-selling-price")?.value) || 0;
    const status = row.querySelector(".cp-status")?.value || "active";
    const sortOrder = parseInt(row.querySelector(".cp-sort")?.value) || 0;

    if (!category) { showToast("جميع فئات الأسعار يجب أن تحتوي على اسم", "warning"); hasErrors = true; return; }
    if (merchantPrice < 0 || sellingPrice < 0) { showToast("السعر لا يمكن أن يكون سالباً", "warning"); hasErrors = true; return; }
    prices.push({ id, category, merchantPrice, sellingPrice, status, sortOrder });
  });
  if (hasErrors) return;

  if (!prices.length) { showToast("يرجى إضافة فئة سعر واحدة على الأقل", "warning"); return; }

  try {
    const batch = db.batch();
    
    // Get existing price docs to see if any need to be deleted
    const snap = await db.collection("merchant_card_prices").get();
    const newIds = prices.map(p => p.id).filter(id => id);

    // Delete any doc that was in Firestore but is no longer in the list
    snap.docs.forEach((d) => {
      if (!newIds.includes(d.id)) {
        batch.delete(d.ref);
      }
    });

    // Add or update
    prices.forEach((p) => {
      let ref;
      if (p.id) {
        ref = db.collection("merchant_card_prices").doc(p.id);
      } else {
        ref = db.collection("merchant_card_prices").doc(); // Create new doc
      }
      const dataToSave = {
        category: p.category,
        merchantPrice: p.merchantPrice,
        sellingPrice: p.sellingPrice,
        status: p.status,
        sortOrder: p.sortOrder,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, dataToSave, { merge: true });
    });

    await batch.commit();

    try {
      await createMerchantNotification({
        type: "prices_updated",
        title: "تحديث أسعار الكروت",
        body: "تم تعديل أسعار الكروت (إضافة / تعديل / حذف فئات أسعار)",
      });
    } catch (notifErr) { console.warn("[Inventory] Notification failed:", notifErr); }

    await loadInventoryPrices();
    if (typeof markAccountsDirty === "function") markAccountsDirty();
    $("cardPriceModal").classList.remove("open");
    showToast("✅ تم حفظ أسعار الكروت بنجاح", "success");
  } catch (err) {
    showToast("خطأ في حفظ الأسعار: " + err.message, "error");
  }
}

window.openAddInventoryModal = openAddInventoryModal;
window.saveInventory = saveInventory;
window.openCardPriceModal = openCardPriceModal;
window.addCardPriceRow = addCardPriceRow;
window.removeCardPriceRow = removeCardPriceRow;
window.saveCardPrices = saveCardPrices;
