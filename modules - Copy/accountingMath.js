// ===== Shared Accounting Math (Admin Version) =====
// ===== Official Formulas (Part 4 Spec) =====
// currentBalance = remainingCardValue + totalInstallations - totalCollections
// remainingCards = inventoryCards - soldCards
// salesValue = soldCards * merchantPrice
// remainingValue = remainingCards * merchantPrice
// inventoryValue = inventoryCards * merchantPrice
var AccountingMath = {
  /**
   * Calculates the expected merchant balance:
   * currentBalance = remainingCardValue + totalInstallations - totalCollections
   */
  calculateBalance: function(remainingCardValue, totalInstallations, totalCollections) {
    return remainingCardValue + totalInstallations - totalCollections;
  },

  /**
   * remainingCards = inventoryCards - soldCards
   */
  calculateRemainingCards: function(inventoryCards, soldCards) {
    return Math.max(0, inventoryCards - soldCards);
  },

  /**
   * salesValue = soldCards * merchantPrice
   */
  calculateSalesValue: function(soldCards, merchantPrice) {
    return soldCards * merchantPrice;
  },

  /**
   * remainingValue = remainingCards * merchantPrice
   */
  calculateRemainingValue: function(remainingCards, merchantPrice) {
    return remainingCards * merchantPrice;
  },

  /**
   * inventoryValue = inventoryCards * merchantPrice
   */
  calculateInventoryTotal: function(inventoryCards, merchantPrice) {
    return inventoryCards * merchantPrice;
  },

  /**
   * Added count = remaining cards + sold cards
   */
  calculateAddedCards: function(remaining, sold) {
    return remaining + sold;
  },

  /**
   * Calculates row total (grand total of sales value per category)
   */
  calculateRowResult: function(soldCount, merchantPrice) {
    return soldCount * merchantPrice;
  },

  /**
   * Perform consistency check comparing storedBalance against calculated balance
   */
  performConsistencyCheck: function(storedBalance, inventoryValue, totalInstallations, totalCollections) {
    var calculatedBalance = this.calculateBalance(
      inventoryValue,
      totalInstallations,
      totalCollections
    );
    var discrepancy = calculatedBalance - storedBalance;
    var valid = Math.abs(discrepancy) < 0.01;

    var details = "";
    if (valid) {
      details = "الحسابات متطابقة: الرصيد المخزن (" + storedBalance.toLocaleString("ar-EG") + " ج.م) يطابق الرصيد المحسوب (" + calculatedBalance.toLocaleString("ar-EG") + " ج.م).";
    } else {
      details = "⚠️ اختلاف في الحسابات! الرصيد المخزن (" + storedBalance.toLocaleString("ar-EG") + " ج.م)، الرصيد المحسوب (" + calculatedBalance.toLocaleString("ar-EG") + " ج.م). الفارق: " + discrepancy.toLocaleString("ar-EG") + " ج.م. التفاصيل: قيمة المخزون الحالي (" + inventoryValue.toLocaleString("ar-EG") + " ج.م) + إجمالي التركيبات (" + totalInstallations.toLocaleString("ar-EG") + " ج.م) - إجمالي التحصيلات (" + totalCollections.toLocaleString("ar-EG") + " ج.م) = " + calculatedBalance.toLocaleString("ar-EG") + " ج.م.";
    }

    return {
      valid: valid,
      storedBalance: storedBalance,
      calculatedBalance: calculatedBalance,
      discrepancy: discrepancy,
      details: details
    };
  }
};

// Export for node or browser environments
if (typeof window !== "undefined") {
  window.AccountingMath = AccountingMath;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = AccountingMath;
}
