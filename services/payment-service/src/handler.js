/**
 * Payment Service Lambda Handler
 * Consumes events asynchronously from Amazon SQS
 */
const { processPayment } = require("./paymentProcessor");

/**
 * Extracts order payload from an SQS record, handling EventBridge envelopes
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

  // Handle EventBridge envelope: { detail: { orderId, ... } }
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
 * SQS Event Handler for Payment Processing
 * @param {Object} event - SQS Event containing Records
 * @param {Object} [context] - Lambda execution context
 * @param {Function} [injectedProcessor] - Optional injected processor for testing
 * @returns {Promise<Object>} Batch processing summary
 */
async function handler(event, context, injectedProcessor = processPayment) {
  console.log(`[PaymentService] Processing batch of ${event?.Records?.length || 0} SQS messages`);

  if (!event || !Array.isArray(event.Records) || event.Records.length === 0) {
    console.warn("[PaymentService] Received empty event or records");
    return { processedCount: 0, results: [] };
  }

  const results = [];

  for (const record of event.Records) {
    console.log(`[PaymentService] Processing message ID: ${record.messageId}`);
    
    // Extract domain event payload
    const orderData = extractOrderData(record);

    if (!orderData || !orderData.orderId) {
      console.error("[PaymentService] Missing orderId in message body:", JSON.stringify(record.body));
      throw new Error("Invalid message payload: missing 'orderId'");
    }

    // Process payment (will throw on failure to trigger SQS retry / DLQ redrive)
    const paymentResult = await injectedProcessor(orderData);
    results.push(paymentResult);
  }

  console.log(`[PaymentService] Successfully processed ${results.length} payments in batch`);
  return {
    processedCount: results.length,
    results
  };
}

module.exports = {
  handler,
  extractOrderData
};
