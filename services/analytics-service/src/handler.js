/**
 * Analytics Service Lambda Handler
 * Invoked directly by Amazon EventBridge (Direct Lambda Target)
 */

/**
 * Parses event detail object or string
 * @param {Object} event - EventBridge event
 * @returns {Object}
 */
function parseDetail(event) {
  if (!event || !event.detail) {
    return {};
  }
  if (typeof event.detail === "string") {
    try {
      return JSON.parse(event.detail);
    } catch (e) {
      return {};
    }
  }
  return event.detail;
}

/**
 * Handles incoming EventBridge events for real-time analytics aggregation
 * @param {Object} event - EventBridge event
 * @param {Object} [context] - Lambda execution context
 * @returns {Promise<Object>}
 */
async function handler(event, context) {
  console.log("[AnalyticsService] Received EventBridge event:", JSON.stringify({
    source: event?.source,
    detailType: event?.["detail-type"],
    eventId: event?.id,
    time: event?.time
  }));

  const detail = parseDetail(event);
  const orderId = detail.orderId || "unknown";
  const amount = detail.totalAmount ?? 0;
  const customerId = detail.customerId || "unknown";

  // Formatted analytics output as required by specification
  console.log("New order received");
  console.log(`Order ID: ${orderId}`);
  console.log(`Amount: ${amount}`);
  console.log(`Customer: ${customerId}`);

  const summary = {
    status: "RECORDED",
    orderId,
    amount,
    customerId,
    itemCount: Array.isArray(detail.items) ? detail.items.length : 0,
    recordedAt: new Date().toISOString()
  };

  console.log("[AnalyticsService] Successfully recorded metrics:", JSON.stringify(summary));
  return summary;
}

module.exports = {
  handler,
  parseDetail
};
