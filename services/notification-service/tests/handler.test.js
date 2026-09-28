const { handler, extractOrderData } = require("../src/handler");
const { sendOrderNotification } = require("../src/notificationService");

describe("Notification Service - Notification Dispatcher", () => {
  const originalEnv = process.env.NOTIFICATION_FAILURE_MODE;

  afterEach(() => {
    process.env.NOTIFICATION_FAILURE_MODE = originalEnv;
  });

  test("should successfully dispatch notification when failure mode is disabled", async () => {
    delete process.env.NOTIFICATION_FAILURE_MODE;
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const order = {
      orderId: "order-123",
      customerId: "customer-456",
      totalAmount: 3000,
      currency: "LKR"
    };

    const result = await sendOrderNotification(order);
    expect(result.status).toBe("SENT");
    expect(result.orderId).toBe("order-123");
    expect(result.recipient).toBe("customer-456");
    expect(result.notificationId).toMatch(/^notif-/);

    // Verify expected exact string logged
    expect(consoleSpy).toHaveBeenCalledWith("Notification sent for order order-123");
    consoleSpy.mockRestore();
  });

  test("should throw error when NOTIFICATION_FAILURE_MODE is set to 'true'", async () => {
    process.env.NOTIFICATION_FAILURE_MODE = "true";
    const order = {
      orderId: "order-fail",
      customerId: "customer-789"
    };

    await expect(sendOrderNotification(order)).rejects.toThrow(
      /Notification delivery failed for order order-fail/
    );
  });

  test("should throw error when order has failNotification flag", async () => {
    process.env.NOTIFICATION_FAILURE_MODE = "false";
    const order = {
      orderId: "order-fail-flag",
      failNotification: true
    };

    await expect(sendOrderNotification(order)).rejects.toThrow(
      /Notification delivery failed for order order-fail-flag/
    );
  });
});

describe("Notification Service - Payload Extraction", () => {
  test("should extract order data from direct JSON body", () => {
    const record = {
      body: JSON.stringify({ orderId: "order-99", customerId: "cust-99" })
    };
    const extracted = extractOrderData(record);
    expect(extracted.orderId).toBe("order-99");
    expect(extracted.customerId).toBe("cust-99");
  });

  test("should extract order data from EventBridge envelope", () => {
    const record = {
      body: JSON.stringify({
        source: "ecommerce.orders",
        "detail-type": "OrderCreated",
        detail: {
          orderId: "order-eb-1",
          customerId: "cust-eb-1"
        }
      })
    };
    const extracted = extractOrderData(record);
    expect(extracted.orderId).toBe("order-eb-1");
  });

  test("should throw error on invalid JSON", () => {
    const record = { body: "invalid json string" };
    expect(() => extractOrderData(record)).toThrow(/Invalid JSON/);
  });
});

describe("Notification Service - Lambda Handler", () => {
  test("should process batch of notifications successfully", async () => {
    const mockNotifier = jest.fn().mockResolvedValue({
      status: "SENT",
      notificationId: "notif-999",
      orderId: "order-123"
    });

    const event = {
      Records: [
        {
          messageId: "msg-notif-1",
          body: JSON.stringify({
            detail: { orderId: "order-123", customerId: "customer-1" }
          })
        }
      ]
    };

    const response = await handler(event, {}, mockNotifier);
    expect(response.processedCount).toBe(1);
    expect(response.results[0].status).toBe("SENT");
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });

  test("should rethrow error when notification dispatch fails", async () => {
    const mockNotifier = jest.fn().mockRejectedValue(new Error("SMTP service offline"));

    const event = {
      Records: [
        {
          messageId: "msg-smtp-fail",
          body: JSON.stringify({
            detail: { orderId: "order-fail-smtp" }
          })
        }
      ]
    };

    await expect(handler(event, {}, mockNotifier)).rejects.toThrow("SMTP service offline");
  });

  test("should handle empty Records array", async () => {
    const response = await handler({ Records: [] });
    expect(response.processedCount).toBe(0);
    expect(response.results).toEqual([]);
  });

  test("should throw error when orderId is missing", async () => {
    const event = {
      Records: [
        {
          messageId: "msg-no-order",
          body: JSON.stringify({ detail: { otherField: "test" } })
        }
      ]
    };

    await expect(handler(event)).rejects.toThrow(/missing 'orderId'/);
  });
});
