/**
 * Mock payment processor simulating an external payment gateway
 */
const crypto = require("crypto");

/**
 * Simulates processing a customer payment for an order
 * @param {Object} order - Order details containing orderId, customerId, totalAmount, currency
 * @returns {Promise<Object>} Payment transaction result
 * @throws {Error} When payment processing fails or failure mode is enabled
 */
async function processPayment(order) {
  const isFailureMode = process.env.PAYMENT_FAILURE_MODE === "true" || order?.failPayment === true;

  console.log(`[PaymentProcessor] Initiating payment for orderId: ${order?.orderId}, Amount: ${order?.currency || "LKR"} ${order?.totalAmount}`);

  // Simulate payment gateway failure for testing SQS Retries and Dead Letter Queue (DLQ)
  if (isFailureMode) {
    console.error(`[PaymentProcessor] SIMULATED FAILURE triggered for order: ${order?.orderId}`);
    throw new Error(`Payment processing failed for order ${order?.orderId}: Simulated gateway timeout / declined`);
  }

  // Simulate successful payment capture
  const transactionId = `txn-${crypto.randomUUID()}`;
  const result = {
    status: "SUCCESS",
    transactionId,
    orderId: order?.orderId,
    customerId: order?.customerId,
    amount: order?.totalAmount,
    currency: order?.currency || "LKR",
    processedAt: new Date().toISOString()
  };

  console.log(`[PaymentProcessor] Payment SUCCESS for order ${order?.orderId}. Transaction ID: ${transactionId}`);
  return result;
}

module.exports = {
  processPayment
};
