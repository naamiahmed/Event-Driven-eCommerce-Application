/**
 * Order Service Lambda Handler
 * Endpoint: POST /orders
 */
const crypto = require("crypto");
const { validateOrder, calculateTotal } = require("./validation");
const OrderRepository = require("./orderRepository");

// Instantiate default repository singleton
let defaultRepository = null;
function getRepository() {
  if (!defaultRepository) {
    defaultRepository = new OrderRepository();
  }
  return defaultRepository;
}

/**
 * Formats standard API Gateway HTTP response
 * @param {number} statusCode
 * @param {Object} body
 * @returns {Object}
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify(body)
  };
}

/**
 * Lambda handler for creating and retrieving orders
 * @param {Object} event - API Gateway event
 * @param {Object} [context] - Lambda execution context
 * @param {OrderRepository} [injectedRepo] - Optional repository for testing
 * @returns {Promise<Object>}
 */
async function handler(event, context, injectedRepo = null) {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || "POST";
  const rawPath = event.rawPath || event.path || "";

  console.log("[OrderService] Incoming request:", JSON.stringify({
    path: rawPath,
    httpMethod,
    requestId: event.requestContext?.requestId
  }));

  const repository = injectedRepo || getRepository();

  // Handle GET /orders/{orderId}
  if (httpMethod === "GET") {
    const pathParts = rawPath.split("/").filter(Boolean);
    const orderId = event.pathParameters?.orderId || (pathParts.length > 1 ? pathParts[pathParts.length - 1] : null);

    if (!orderId || orderId === "orders") {
      return createResponse(400, { message: "Order ID is required in path" });
    }

    try {
      const order = await repository.getOrder(orderId);
      if (!order) {
        return createResponse(404, { message: "Order not found", orderId });
      }
      return createResponse(200, { order });
    } catch (err) {
      console.error("[OrderService] Error fetching order:", err);
      return createResponse(500, { message: "Failed to fetch order", error: err.message });
    }
  }

  // Parse request body for POST
  let parsedBody;
  try {
    if (typeof event.body === "string") {
      parsedBody = JSON.parse(event.body);
    } else if (event.body && typeof event.body === "object") {
      parsedBody = event.body;
    } else {
      parsedBody = {};
    }
  } catch (err) {
    console.error("[OrderService] JSON parsing error:", err.message);
    return createResponse(400, {
      message: "Malformed JSON payload in request body",
      error: err.message
    });
  }

  // Validate payload
  const validationResult = validateOrder(parsedBody);
  if (!validationResult.valid) {
    console.warn("[OrderService] Validation failed:", validationResult.errors);
    return createResponse(400, {
      message: "Order validation failed",
      errors: validationResult.errors
    });
  }

  try {
    // Generate order identifier and calculate financial total
    const orderId = `order-${crypto.randomUUID()}`;
    const totalAmount = calculateTotal(parsedBody.items);
    const currency = parsedBody.currency || "LKR";

    const order = {
      orderId,
      customerId: parsedBody.customerId,
      status: "PENDING",
      totalAmount,
      currency,
      items: parsedBody.items,
      createdAt: new Date().toISOString()
    };

    const repository = injectedRepo || getRepository();

    // Step 1: Persist order state in DynamoDB
    await repository.saveOrder(order);

    // Step 2: Publish OrderCreated event to EventBridge
    await repository.publishOrderCreatedEvent(order);

    console.log(`[OrderService] Order ${orderId} successfully persisted and event published`);

    return createResponse(201, {
      message: "Order created successfully",
      orderId: order.orderId,
      status: order.status
    });
  } catch (err) {
    console.error("[OrderService] Internal error processing order:", err);
    return createResponse(500, {
      message: "Failed to process order",
      error: err.message
    });
  }
}

module.exports = {
  handler,
  createResponse
};
