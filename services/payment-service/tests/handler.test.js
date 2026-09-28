const { handler, extractOrderData } = require("../src/handler");
const { processPayment } = require("../src/paymentProcessor");

describe("Payment Service - Payment Processor", () => {
  const originalEnv = process.env.PAYMENT_FAILURE_MODE;

  afterEach(() => {
    process.env.PAYMENT_FAILURE_MODE = originalEnv;
  });

  test("should successfully process payment when failure mode is disabled", async () => {
    delete process.env.PAYMENT_FAILURE_MODE;
    const order = {
      orderId: "order-101",
      customerId: "cust-202",
      totalAmount: 4500,
      currency: "LKR"
    };

    const result = await processPayment(order);
    expect(result.status).toBe("SUCCESS");
    expect(result.orderId).toBe("order-101");
    expect(result.amount).toBe(4500);
    expect(result.transactionId).toMatch(/^txn-/);
  });

  test("should throw error when PAYMENT_FAILURE_MODE is set to 'true'", async () => {
    process.env.PAYMENT_FAILURE_MODE = "true";
    const order = {
      orderId: "order-fail-1",
      customerId: "cust-202",
      totalAmount: 1000
    };

    await expect(processPayment(order)).rejects.toThrow(
      /Payment processing failed for order order-fail-1/
    );
  });

  test("should throw error when order has failPayment flag", async () => {
    process.env.PAYMENT_FAILURE_MODE = "false";
    const order = {
      orderId: "order-fail-2",
      totalAmount: 200,
      failPayment: true
    };

    await expect(processPayment(order)).rejects.toThrow(
      /Payment processing failed for order order-fail-2/
    );
  });
});

describe("Payment Service - Payload Extraction", () => {
  test("should extract order data from direct JSON body", () => {
    const record = {
      body: JSON.stringify({ orderId: "order-001", totalAmount: 500 })
    };
    const extracted = extractOrderData(record);
    expect(extracted.orderId).toBe("order-001");
  });

  test("should extract order data from EventBridge envelope", () => {
    const record = {
      body: JSON.stringify({
        source: "ecommerce.orders",
        "detail-type": "OrderCreated",
        detail: {
          orderId: "order-002",
          totalAmount: 1500
        }
      })
    };
    const extracted = extractOrderData(record);
    expect(extracted.orderId).toBe("order-002");
    expect(extracted.totalAmount).toBe(1500);
  });

  test("should extract order data from EventBridge envelope with stringified detail", () => {
    const record = {
      body: JSON.stringify({
        source: "ecommerce.orders",
        "detail-type": "OrderCreated",
        detail: JSON.stringify({
          orderId: "order-003",
          totalAmount: 2500
        })
      })
    };
    const extracted = extractOrderData(record);
    expect(extracted.orderId).toBe("order-003");
  });

  test("should throw error on invalid JSON", () => {
    const record = { body: "not-json" };
    expect(() => extractOrderData(record)).toThrow(/Invalid JSON/);
  });
});

describe("Payment Service - Lambda Handler", () => {
  test("should successfully handle SQS batch", async () => {
    const mockProcessor = jest.fn().mockResolvedValue({
      status: "SUCCESS",
      transactionId: "txn-123",
      orderId: "order-abc"
    });

    const event = {
      Records: [
        {
          messageId: "msg-1",
          body: JSON.stringify({
            detail: { orderId: "order-abc", customerId: "cust-1", totalAmount: 1500 }
          })
        }
      ]
    };

    const response = await handler(event, {}, mockProcessor);
    expect(response.processedCount).toBe(1);
    expect(response.results[0].status).toBe("SUCCESS");
    expect(mockProcessor).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-abc" })
    );
  });

  test("should rethrow error when processor fails so SQS can trigger retry", async () => {
    const mockProcessor = jest.fn().mockRejectedValue(new Error("Downstream payment failure"));

    const event = {
      Records: [
        {
          messageId: "msg-fail",
          body: JSON.stringify({
            detail: { orderId: "order-fail" }
          })
        }
      ]
    };

    await expect(handler(event, {}, mockProcessor)).rejects.toThrow(
      "Downstream payment failure"
    );
  });

  test("should handle empty Records array gracefully", async () => {
    const response = await handler({ Records: [] });
    expect(response.processedCount).toBe(0);
    expect(response.results).toEqual([]);
  });

  test("should throw error if record is missing orderId", async () => {
    const event = {
      Records: [
        {
          messageId: "msg-empty",
          body: JSON.stringify({ detail: {} })
        }
      ]
    };

    await expect(handler(event)).rejects.toThrow(/missing 'orderId'/);
  });
});
