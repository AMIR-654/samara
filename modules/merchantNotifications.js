// ===== Merchant Notification Helper =====
// Creates notification documents in the `notifications` collection (shared with the mobile app).
// When merchantId is provided: also writes to `merchant_notifications` for backward compat.
// Works both inside a Firestore transaction and as a standalone write.
// When merchantId is omitted: creates a broadcast notification to all merchants.
//
// Document schema matches the manual broadcast form in app.js 100%:
//   { userId, title, body, link?, readStatus, opened, deliveryStatus: "pending", createdAt }
// Plus extra metadata fields (type, merchantId, scheduledAt, relatedDocumentId, data)
// that the mobile app uses for display and filtering.

async function createMerchantNotification({
  merchantId,
  userId,
  type,
  title,
  body,
  link = null,
  createdBy = "admin",
  relatedDocumentId = null,
  data = null,
  transaction = null,
}) {
  if (!type || !title || !body) {
    console.warn("[Notifications] Missing required fields:", { type, title, body });
    return null;
  }

  const now = Date.now();
  const notifRef = db.collection("notifications").doc();

  console.log(
    "[Notifications] Starting: type=" + type +
    ", userId=" + (userId || "all") +
    ", merchantId=" + (merchantId || "N/A") +
    ", title=" + title
  );

  const notifData = {
    id: notifRef.id,
    userId: merchantId ? (userId || "all") : "all",
    title,
    body,
    link: link || null,
    type,
    readStatus: false,
    deliveryStatus: "pending",
    opened: false,
    createdAt: now,
    scheduledAt: now,
  };
  if (merchantId) notifData.merchantId = merchantId;
  if (relatedDocumentId) notifData.relatedDocumentId = relatedDocumentId;
  if (data) notifData.data = data;

  if (transaction) {
    transaction.set(notifRef, notifData);
  } else {
    await notifRef.set(notifData);
  }

  console.log(
    "[Notifications] Created: collection=notifications, docId=" + notifRef.id +
    ", deliveryStatus=pending, userId=" + notifData.userId +
    ", merchantId=" + (merchantId || "N/A")
  );

  // Also write to merchant_notifications for backward compatibility (only if merchantId provided)
  if (merchantId) {
    const oldNotifRef = db.collection("merchant_notifications").doc();
    const oldNotifData = {
      notificationId: oldNotifRef.id,
      merchantId,
      type,
      title,
      body,
      createdAt: now,
      createdBy,
      read: false,
    };
    if (relatedDocumentId) oldNotifData.relatedDocumentId = relatedDocumentId;
    if (data) oldNotifData.data = data;

    if (transaction) {
      transaction.set(oldNotifRef, oldNotifData);
    } else {
      await oldNotifRef.set(oldNotifData);
    }

    console.log(
      "[Notifications] Also written to merchant_notifications: docId=" + oldNotifRef.id +
      ", merchantId=" + merchantId
    );
  }

  return notifRef;
}

window.createMerchantNotification = createMerchantNotification;
