// ===== Unified Accounting Engine (Admin) =====
// SINGLE SOURCE OF TRUTH for all accounting calculations.
// Every screen (summary cards, table, statement) calls these functions.
// Never compute accounting values inline — always use this engine.

var AccountingEngine = {
  // ── Date Helpers ──────────────────────────────────────────
  getMonthStartEnd: function (yearMonth) {
    var parts = yearMonth.split("-").map(Number);
    var start = parts[1] + "/01/" + parts[0];
    var endDate = new Date(parts[0], parts[1], 0);
    var end = parts[1] + "/" + String(endDate.getDate()).padStart(2, "0") + "/" + parts[0];
    return { start: yearMonth + "-01", end: yearMonth + "-" + String(endDate.getDate()).padStart(2, "0") };
  },

  isInMonth: function (dateStr, yearMonth) {
    if (!dateStr) return false;
    return dateStr.substring(0, 7) === yearMonth;
  },

  // ── Monthly Summary from Transactions ────────────────────
  // transactions: array of merchant_transactions/items docs
  // monthStart, monthEnd: "YYYY-MM-DD" strings (null = no date filter)
  computeMonthlySummary: function (transactions, monthStart, monthEnd) {
    var cardsAdded = 0;
    var cashCollected = 0;
    var installationsValue = 0;
    var settlementsValue = 0;
    (transactions || []).forEach(function (tx) {
      if (monthStart != null && monthEnd != null && (!tx.date || tx.date < monthStart || tx.date > monthEnd)) return;

      if (tx.type === "card_inventory_added") {
        var meta = tx.metadata;
        if (meta && meta.entries) {
          meta.entries.forEach(function (e) { cardsAdded += e.count || 0; });
        } else if (meta && meta.totalCards) {
          cardsAdded += meta.totalCards;
        } else {
          cardsAdded += Math.abs(tx.amount || 0);
        }
      } else if (tx.type === "cash_collection") {
        cashCollected += Math.abs(tx.amount || 0);
      } else if (tx.type === "installation") {
        installationsValue += Math.abs(tx.amount || 0);
      } else if (tx.type === "card_settlement") {
        settlementsValue += Math.abs(tx.amount || 0);
      }
    });

    return { cardsAdded: cardsAdded, cashCollected: cashCollected, installationsValue: installationsValue, settlementsValue: settlementsValue };
  },

  // ── Settlement Total (convenience wrapper) ───────────────
  computeSettlementTotal: function (transactions) {
    var total = 0;
    (transactions || []).forEach(function (tx) {
      if (tx.type === "card_settlement") total += Math.abs(tx.amount || 0);
    });
    return total;
  },

  // ── Inventory Table from inventory + prices ──────────────
  // inventory: merchant_inventory doc data (or null)
  // prices: array of merchant_card_prices docs
  computeInventoryTable: function (inventory, prices) {
    var categories = [];
    (prices || []).forEach(function (p) {
      if (p.status !== "inactive") {
        if (categories.indexOf(p.category) === -1) categories.push(p.category);
      }
    });
    if (inventory && inventory.entries) {
      inventory.entries.forEach(function (e) {
        if (e.count > 0) {
          var match = (prices || []).find(function (p) { return p.id === e.category || p.category === e.category; });
          var name = match ? match.category : e.category;
          if (categories.indexOf(name) === -1) categories.push(name);
        }
      });
    }

    var grandCardsCount = 0;
    var grandCategoryTotal = 0;
    var grandExpectedProfit = 0;

    var rows = categories.map(function (cat) {
      var priceDoc = (prices || []).find(function (p) { return p.category === cat || p.id === cat; });
      var merchantPrice = priceDoc ? (priceDoc.merchantPrice || 0) : 0;
      var sellingPrice = priceDoc ? (priceDoc.sellingPrice || 0) : 0;
      var docId = priceDoc ? priceDoc.id : cat;

      var invEntry = inventory && inventory.entries
        ? inventory.entries.find(function (e) { return e.category === docId || e.category === cat; })
        : undefined;
      var cardsCount = invEntry ? invEntry.count : 0;
      var rowTotal = cardsCount * merchantPrice;
      var profitPerCard = sellingPrice - merchantPrice;
      var categoryProfit = cardsCount * profitPerCard;

      grandCardsCount += cardsCount;
      grandCategoryTotal += rowTotal;
      grandExpectedProfit += categoryProfit;

      return {
        category: cat, id: docId,
        merchantPrice: merchantPrice, sellingPrice: sellingPrice,
        cardsCount: cardsCount, rowTotal: rowTotal,
        profitPerCard: profitPerCard, categoryProfit: categoryProfit,
      };
    });

    return { rows: rows, grandCardsCount: grandCardsCount, grandCategoryTotal: grandCategoryTotal, grandExpectedProfit: grandExpectedProfit };
  },

  // ── Installations Monthly from installation records ──────
  // installations: array of merchant_installations docs
  // yearMonth: "YYYY-MM" string
  computeInstallationsMonthly: function (installations, yearMonth) {
    var filtered = (installations || []).filter(function (inst) {
      return inst.date && inst.date.substring(0, 7) === yearMonth;
    });
    var count = filtered.length;
    var total = filtered.reduce(function (s, inst) { return s + (inst.price || 0); }, 0);
    return { count: count, total: total, all: filtered };
  },

  // ── Installations All (no filter) ────────────────────────
  computeInstallationsAll: function (installations) {
    return {
      count: (installations || []).length,
      total: (installations || []).reduce(function (s, inst) { return s + (inst.price || 0); }, 0),
    };
  },

  // ── Balance Calculation ──────────────────────────────────
  // Formula: currentBalance = inventoryValue + installationsValue - collectionsTotal
  computeBalance: function (inventoryValue, installationsTotal, collectionsTotal) {
    return inventoryValue + installationsTotal - collectionsTotal;
  },

  // ── Unified Profile Data ─────────────────────────────────
  // Combines all above into a single object that every view consumes.
  // merchant: merchant doc data
  // inventory: merchant_inventory doc data (or null)
  // prices: array of merchant_card_prices docs
  // transactions: array of merchant_transactions/items docs
  // installations: array of merchant_installations docs
  // yearMonth: "YYYY-MM" (the selected month)
  computeProfileData: function (merchant, inventory, prices, transactions, installations, yearMonth) {
    var bounds = this.getMonthStartEnd(yearMonth);
    var monthlySummary = this.computeMonthlySummary(transactions, bounds.start, bounds.end);
    var inventoryTable = this.computeInventoryTable(inventory, prices);
    var installationsMonthly = this.computeInstallationsMonthly(installations, yearMonth);
    var installationsAll = this.computeInstallationsAll(installations);

    return {
      // Monthly summary values (from transactions)
      monthlyCardsAdded: monthlySummary.cardsAdded,
      monthlyCashCollected: monthlySummary.cashCollected,
      monthlyInstallationsValue: monthlySummary.installationsValue,

      // Installation stats filtered by month (for table row, summary card)
      installationsMonthly: installationsMonthly,

      // All installations (for modal/details)
      installationsAll: installationsAll,

      // Inventory table data
      inventoryTable: inventoryTable,

      // Balance
      currentBalance: merchant ? (merchant.currentBalance || 0) : 0,

      // Expected profit from current inventory
      totalExpectedProfit: inventoryTable.grandExpectedProfit,
    };
  },
};

if (typeof window !== "undefined") {
  window.AccountingEngine = AccountingEngine;
}
