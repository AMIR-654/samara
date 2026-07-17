// ===== Merchant Notification Helper =====
// Creates notification documents in the `notifications` collection (shared with the mobile app).
// Also writes to `merchant_notifications` for backward compat.
// Works both inside a Firestore transaction and as a standalone write.

async function createMerchantNotification({
  merchantId,
  userId,
  type,
  title,
  body,
  createdBy = "admin",
  relatedDocumentId = null,
  data = null,
  transaction = null,
}) {
  if (!merchantId || !type || !title || !body) {
    console.warn("[Notifications] Missing required fields:", { merchantId, type, title, body });
    return null;
  }

  const notifRef = db.collection("notifications").doc();
  const notifData = {
    id: notifRef.id,
    userId: userId || "all",
    title,
    body,
    type,
    readStatus: false,
    deliveryStatus: "delivered",
    opened: false,
    createdAt: Date.now(),
    merchantId,
  };
  if (relatedDocumentId) notifData.relatedDocumentId = relatedDocumentId;
  if (data) notifData.data = data;

  // Also write to merchant_notifications for backward compatibility
  const oldNotifRef = db.collection("merchant_notifications").doc();
  const oldNotifData = {
    notificationId: oldNotifRef.id,
    merchantId,
    type,
    title,
    body,
    createdAt: Date.now(),
    createdBy,
    read: false,
  };
  if (relatedDocumentId) oldNotifData.relatedDocumentId = relatedDocumentId;
  if (data) oldNotifData.data = data;

  if (transaction) {
    transaction.set(notifRef, notifData);
    transaction.set(oldNotifRef, oldNotifData);
  } else {
    await Promise.all([
      notifRef.set(notifData),
      oldNotifRef.set(oldNotifData),
    ]);
  }
  return notifRef;
}

window.createMerchantNotification = createMerchantNotification;
