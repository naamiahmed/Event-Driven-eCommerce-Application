/**
 * Mock Notification Service simulating email/SMS dispatch to customers
 */
const crypto = require("crypto");

/**
 * Sends order confirmation notification to customer
 * @param {Object} order - Order details
 * @returns {Promise<Object>} Notification delivery result
 * @throws {Error} When delivery fails or failure mode is enabled
 */
async function sendOrderNotification(order) {
  const isFailureMode = process.env.NOTIFICATION_FAILURE_MODE === "true" || order?.failNotification === true;

  console.log(`[NotificationService] Preparing notification for customer: ${order?.customerId}, order: ${order?.orderId}`);

  // Simulate notification delivery failure for testing SQS Retries and DLQ
  if (isFailureMode) {
    console.error(`[NotificationService] SIMULATED FAILURE: Unable to send email for order ${order?.orderId}`);
    throw new Error(`Notification delivery failed for order ${order?.orderId}: Downstream SMTP/SMS service failure`);
  }

  const notificationId = `notif-${crypto.randomUUID()}`;

  // Log expected portfolio requirement string
  console.log(`Notification sent for order ${order?.orderId}`);
  console.log(`[NotificationService] Order confirmation email dispatched to customer ${order?.customerId} for order ${order?.orderId} (Total: ${order?.currency || "LKR"} ${order?.totalAmount})`);

  return {
    status: "SENT",
    notificationId,
    orderId: order?.orderId,
    recipient: order?.customerId,
    sentAt: new Date().toISOString()
  };
}

module.exports = {
  sendOrderNotification
};
