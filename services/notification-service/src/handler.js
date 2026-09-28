/**
 * Notification Service Lambda Handler
 * Consumes events asynchronously from Amazon SQS
 */
const { sendOrderNotification } = require("./notificationService");

/**
 * Extracts order payload from an SQS record, unwrapping EventBridge envelopes if present
 * @param {Object} record - SQS Record
 * @returns {Object} Order data
 */
function extractOrderData(record) {
  let parsedBody;
  try {
    parsedBody = typeof record.body === "string" ? JSON.parse(record.body) : record.body;
  } catch (err) {
    throw new Error(`Invalid JSON in SQS record body: ${err.message}`);
  }

  // Handle EventBridge envelope
  if (parsedBody && parsedBody.detail) {
    if (typeof parsedBody.detail === "string") {
      try {
        return JSON.parse(parsedBody.detail);
      } catch (e) {
        return parsedBody.detail;
      }
    }
    return parsedBody.detail;
  }

  return parsedBody;
}

/**
 * SQS Event Handler for Customer Notifications
 * @param {Object} event - SQS Event containing Records
 * @param {Object} [context] - Lambda execution context
 * @param {Function} [injectedNotifier] - Optional injected function for testing
 * @returns {Promise<Object>} Batch processing summary
 */
async function handler(event, context, injectedNotifier = sendOrderNotification) {
  console.log(`[NotificationService] Received batch of ${event?.Records?.length || 0} messages`);

  if (!event || !Array.isArray(event.Records) || event.Records.length === 0) {
    console.warn("[NotificationService] No records to process");
    return { processedCount: 0, results: [] };
  }

  const results = [];

  for (const record of event.Records) {
    console.log(`[NotificationService] Processing SQS message ID: ${record.messageId}`);

    const orderData = extractOrderData(record);

    if (!orderData || !orderData.orderId) {
      console.error("[NotificationService] Missing orderId in message body:", JSON.stringify(record.body));
      throw new Error("Invalid message payload: missing 'orderId'");
    }

    // Attempt sending notification (will throw on failure for SQS retry / DLQ movement)
    const result = await injectedNotifier(orderData);
    results.push(result);
  }

  console.log(`[NotificationService] Completed processing ${results.length} notifications`);
  return {
    processedCount: results.length,
    results
  };
}

module.exports = {
  handler,
  extractOrderData
};
