const { handler, createResponse } = require("../src/handler");
const { validateOrder, calculateTotal } = require("../src/validation");
const OrderRepository = require("../src/orderRepository");

describe("Order Service - Validation & Calculation", () => {
  test("calculateTotal should sum items accurately and handle decimals", () => {
    const items = [
      { productId: "prod-1", quantity: 2, price: 1500 },
      { productId: "prod-2", quantity: 3, price: 49.99 }
    ];
    // 2 * 1500 = 3000, 3 * 49.99 = 149.97, sum = 3149.97
    expect(calculateTotal(items)).toBe(3149.97);
  });

  test("calculateTotal should return 0 for empty or invalid input", () => {
    expect(calculateTotal([])).toBe(0);
    expect(calculateTotal(null)).toBe(0);
  });

  test("validateOrder should pass for valid payload", () => {
    const payload = {
      customerId: "cust-123",
      items: [{ productId: "prod-1", quantity: 2, price: 500 }]
    };
    const result = validateOrder(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("validateOrder should fail when customerId is missing or empty", () => {
    const payload = {
      customerId: "  ",
      items: [{ productId: "prod-1", quantity: 1, price: 100 }]
    };
    const result = validateOrder(payload);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/customerId/);
  });

  test("validateOrder should fail when items array is empty", () => {
    const payload = { customerId: "cust-123", items: [] };
    const result = validateOrder(payload);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/items/);
  });

  test("validateOrder should fail when item has non-positive or non-integer quantity", () => {
    const payload = {
      customerId: "cust-123",
      items: [{ productId: "prod-1", quantity: 0, price: 100 }]
    };
    const result = validateOrder(payload);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/quantity/);
  });

  test("validateOrder should fail when non-object payload is provided", () => {
    expect(validateOrder(null).valid).toBe(false);
    expect(validateOrder("string").valid).toBe(false);
    expect(validateOrder([1, 2]).valid).toBe(false);
  });

  test("validateOrder should fail when item in items is not an object", () => {
    const payload = { customerId: "c-1", items: [null, "string"] };
    const result = validateOrder(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("validateOrder should fail when item productId is empty string", () => {
    const payload = { customerId: "c-1", items: [{ productId: "  ", quantity: 1, price: 10 }] };
    const result = validateOrder(payload);
    expect(result.valid).toBe(false);
  });
});

describe("Order Service - Lambda Handler", () => {
  let mockRepo;

  beforeEach(() => {
    mockRepo = {
      saveOrder: jest.fn().mockResolvedValue({}),
      publishOrderCreatedEvent: jest.fn().mockResolvedValue({ FailedEntryCount: 0 }),
      getOrder: jest.fn().mockResolvedValue({ orderId: "order-123", status: "PENDING" })
    };
  });

  test("should handle GET /orders/{orderId} and return 200 with order", async () => {
    const event = {
      httpMethod: "GET",
      rawPath: "/orders/order-123",
      pathParameters: { orderId: "order-123" }
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.order.orderId).toBe("order-123");
    expect(mockRepo.getOrder).toHaveBeenCalledWith("order-123");
  });

  test("should return 404 when GET order is not found", async () => {
    mockRepo.getOrder.mockResolvedValue(null);
    const event = {
      httpMethod: "GET",
      rawPath: "/orders/non-existent-order",
      pathParameters: { orderId: "non-existent-order" }
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(404);
  });

  test("should return 400 when GET orderId is missing", async () => {
    const event = {
      httpMethod: "GET",
      rawPath: "/orders",
      pathParameters: {}
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(400);
  });

  test("should successfully create order and return 201", async () => {
    const event = {
      body: JSON.stringify({
        customerId: "customer-123",
        items: [
          { productId: "product-001", quantity: 2, price: 1500 }
        ]
      })
    };

    const response = await handler(event, {}, mockRepo);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Order created successfully");
    expect(body.orderId).toMatch(/^order-/);
    expect(body.status).toBe("PENDING");

    expect(mockRepo.saveOrder).toHaveBeenCalledTimes(1);
    expect(mockRepo.publishOrderCreatedEvent).toHaveBeenCalledTimes(1);

    const savedOrder = mockRepo.saveOrder.mock.calls[0][0];
    expect(savedOrder.totalAmount).toBe(3000);
    expect(savedOrder.currency).toBe("LKR");
  });

  test("should handle pre-parsed body object", async () => {
    const event = {
      body: {
        customerId: "customer-999",
        currency: "USD",
        items: [{ productId: "prod-abc", quantity: 1, price: 25 }]
      }
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(201);
    const savedOrder = mockRepo.saveOrder.mock.calls[0][0];
    expect(savedOrder.currency).toBe("USD");
    expect(savedOrder.totalAmount).toBe(25);
  });

  test("should return 400 for malformed JSON string", async () => {
    const event = { body: "{ malformed json " };
    const response = await handler(event, {}, mockRepo);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toMatch(/Malformed JSON/);
    expect(mockRepo.saveOrder).not.toHaveBeenCalled();
  });

  test("should return 400 when validation fails", async () => {
    const event = {
      body: JSON.stringify({
        customerId: "",
        items: []
      })
    };
    const response = await handler(event, {}, mockRepo);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Order validation failed");
    expect(body.errors.length).toBeGreaterThan(0);
    expect(mockRepo.saveOrder).not.toHaveBeenCalled();
  });

  test("should return 500 when database persistence fails", async () => {
    mockRepo.saveOrder.mockRejectedValue(new Error("DynamoDB service unavailable"));

    const event = {
      body: JSON.stringify({
        customerId: "customer-123",
        items: [{ productId: "p-1", quantity: 1, price: 10 }]
      })
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to process order");
    expect(body.error).toBe("DynamoDB service unavailable");
  });

  test("should return 500 when EventBridge publishing fails", async () => {
    mockRepo.publishOrderCreatedEvent.mockRejectedValue(new Error("EventBridge rate exceeded"));

    const event = {
      body: JSON.stringify({
        customerId: "customer-123",
        items: [{ productId: "p-1", quantity: 1, price: 10 }]
      })
    };

    const response = await handler(event, {}, mockRepo);
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to process order");
    expect(body.error).toBe("EventBridge rate exceeded");
  });
});

describe("Order Service - OrderRepository", () => {
  test("should save order to DynamoDB with correct params", async () => {
    const mockDocClient = { send: jest.fn().mockResolvedValue({}) };
    const mockEventBridge = { send: jest.fn().mockResolvedValue({ FailedEntryCount: 0 }) };

    const repo = new OrderRepository({
      tableName: "TestTable",
      eventBusName: "TestBus",
      docClient: mockDocClient,
      eventBridgeClient: mockEventBridge
    });

    const order = {
      orderId: "ord-test",
      customerId: "cust-test",
      status: "PENDING",
      totalAmount: 100,
      currency: "LKR",
      items: [{ productId: "p-1", quantity: 1, price: 100 }],
      createdAt: new Date().toISOString()
    };

    const saved = await repo.saveOrder(order);
    expect(saved).toEqual(order);
    expect(mockDocClient.send).toHaveBeenCalledTimes(1);
  });

  test("should retrieve order from DynamoDB by orderId", async () => {
    const mockDocClient = {
      send: jest.fn().mockResolvedValue({
        Item: { orderId: "ord-test", status: "PENDING" }
      })
    };

    const repo = new OrderRepository({
      tableName: "TestTable",
      docClient: mockDocClient
    });

    const order = await repo.getOrder("ord-test");
    expect(order.orderId).toBe("ord-test");
    expect(mockDocClient.send).toHaveBeenCalledTimes(1);
  });

  test("should initialize with default clients when no options are provided", () => {
    const repo = new OrderRepository();
    expect(repo.tableName).toBeDefined();
    expect(repo.eventBusName).toBeDefined();
  });

  test("should throw error if EventBridge returns FailedEntryCount > 0", async () => {
    const mockDocClient = { send: jest.fn().mockResolvedValue({}) };
    const mockEventBridge = {
      send: jest.fn().mockResolvedValue({
        FailedEntryCount: 1,
        Entries: [{ ErrorMessage: "Invalid detail" }]
      })
    };

    const repo = new OrderRepository({
      tableName: "TestTable",
      eventBusName: "TestBus",
      docClient: mockDocClient,
      eventBridgeClient: mockEventBridge
    });

    await expect(
      repo.publishOrderCreatedEvent({
        orderId: "order-1",
        customerId: "c-1",
        totalAmount: 100,
        currency: "USD",
        items: [{ productId: "p-1", quantity: 1 }],
        createdAt: new Date().toISOString()
      })
    ).rejects.toThrow(/Failed to publish event to EventBridge/);
  });
});
