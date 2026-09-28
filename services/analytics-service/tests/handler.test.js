const { handler, parseDetail } = require("../src/handler");

describe("Analytics Service - Detail Parser", () => {
  test("should return object when detail is already an object", () => {
    const event = { detail: { orderId: "ord-1", totalAmount: 100 } };
    expect(parseDetail(event)).toEqual({ orderId: "ord-1", totalAmount: 100 });
  });

  test("should parse JSON string detail", () => {
    const event = { detail: JSON.stringify({ orderId: "ord-2", totalAmount: 250 }) };
    expect(parseDetail(event)).toEqual({ orderId: "ord-2", totalAmount: 250 });
  });

  test("should return empty object on missing or malformed detail", () => {
    expect(parseDetail({})).toEqual({});
    expect(parseDetail({ detail: "not a json" })).toEqual({});
  });
});

describe("Analytics Service - Lambda Handler", () => {
  test("should process EventBridge event and output required log format", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const event = {
      source: "ecommerce.orders",
      "detail-type": "OrderCreated",
      id: "eb-event-12345",
      time: "2026-09-27T10:00:00Z",
      detail: {
        orderId: "order-123",
        totalAmount: 3000,
        customerId: "customer-123",
        items: [{ productId: "product-001", quantity: 2 }]
      }
    };

    const result = await handler(event, {});

    expect(result.status).toBe("RECORDED");
    expect(result.orderId).toBe("order-123");
    expect(result.amount).toBe(3000);
    expect(result.customerId).toBe("customer-123");
    expect(result.itemCount).toBe(1);

    // Verify exact log output required by specification
    expect(consoleSpy).toHaveBeenCalledWith("New order received");
    expect(consoleSpy).toHaveBeenCalledWith("Order ID: order-123");
    expect(consoleSpy).toHaveBeenCalledWith("Amount: 3000");
    expect(consoleSpy).toHaveBeenCalledWith("Customer: customer-123");

    consoleSpy.mockRestore();
  });

  test("should handle event with missing details gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await handler({}, {});
    expect(result.status).toBe("RECORDED");
    expect(result.orderId).toBe("unknown");
    expect(result.amount).toBe(0);
    expect(result.customerId).toBe("unknown");

    consoleSpy.mockRestore();
  });
});
