/**
 * API Service Client for Event-Driven E-Commerce
 * Supports both Live AWS API Gateway execution and Local Browser Simulation
 */

class ApiService {
  constructor() {
    this.baseUrl = localStorage.getItem("API_GATEWAY_URL") || "";
    this.isLocalSimulation = !this.baseUrl || this.baseUrl.trim() === "";
    this.eventListeners = [];

    // Local in-browser state store for simulation
    this.localOrders = new Map();
  }

  setBaseUrl(url) {
    this.baseUrl = url.trim().replace(/\/$/, "");
    this.isLocalSimulation = !this.baseUrl || this.baseUrl === "";
    if (this.baseUrl) {
      localStorage.setItem("API_GATEWAY_URL", this.baseUrl);
    } else {
      localStorage.removeItem("API_GATEWAY_URL");
    }
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
  }

  emit(eventType, data) {
    this.eventListeners.forEach(listener => listener(eventType, data));
  }

  /**
   * Submit new order
   * @param {Object} orderData { customerId, items, currency }
   * @param {Object} flags { simulatePaymentFailure, simulateNotifFailure }
   */
  async createOrder(orderData, flags = {}) {
    this.emit("step:start", { step: "api_gateway", title: "API Gateway", payload: orderData });

    if (this.isLocalSimulation) {
      return this._simulateLocalWorkflow(orderData, flags);
    } else {
      return this._callLiveApiGateway(orderData, flags);
    }
  }

  /**
   * Retrieve order by ID
   */
  async getOrder(orderId) {
    if (this.isLocalSimulation) {
      const order = this.localOrders.get(orderId);
      if (!order) throw new Error(`Order ${orderId} not found`);
      return { order };
    }

    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Failed to fetch order" }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Live AWS API Gateway Call
   */
  async _callLiveApiGateway(orderData, flags) {
    const payload = {
      ...orderData,
      failPayment: flags.simulatePaymentFailure,
      failNotification: flags.simulateNotifFailure
    };

    try {
      this.emit("log", { source: "API Gateway", message: `POST ${this.baseUrl}/orders`, type: "info" });
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      this.emit("step:success", { step: "api_gateway", data });
      this.emit("step:success", { step: "order_lambda", data });
      this.emit("step:success", { step: "dynamodb", data });
      this.emit("step:success", { step: "eventbridge", data });

      // Note: With live AWS, SQS and downstream Lambdas run asynchronously in cloud.
      this.emit("log", {
        source: "AWS Cloud",
        message: `Order ${data.orderId} placed. EventBridge is routing events in your AWS account. Check CloudWatch!`,
        type: "success"
      });

      return data;
    } catch (err) {
      this.emit("step:error", { step: "api_gateway", error: err.message });
      throw err;
    }
  }

  /**
   * In-Browser Local Simulation of Event-Driven Flow
   */
  async _simulateLocalWorkflow(orderData, flags) {
    const orderId = `order-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const totalAmount = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderRecord = {
      orderId,
      customerId: orderData.customerId,
      status: "PENDING",
      totalAmount,
      currency: orderData.currency || "LKR",
      items: orderData.items,
      createdAt: new Date().toISOString()
    };

    // 1. API Gateway & Order Lambda (Synchronous Ingress)
    await this._sleep(300);
    this.emit("step:success", { step: "api_gateway", title: "API Gateway", latency: "42ms" });
    this.emit("log", { source: "API Gateway", message: `Ingested POST /orders (Request ID: req-${Date.now()})`, type: "info" });

    await this._sleep(300);
    this.emit("step:start", { step: "order_lambda", title: "Order Service" });
    this.emit("log", { source: "Order Lambda", message: `Validated items and computed total: ${orderRecord.currency} ${orderRecord.totalAmount}`, type: "info" });

    // 2. DynamoDB Persistence
    await this._sleep(300);
    this.localOrders.set(orderId, orderRecord);
    this.emit("step:success", { step: "dynamodb", title: "DynamoDB (Orders Table)" });
    this.emit("log", { source: "DynamoDB", message: `PutItem: Stored order ${orderId} with status PENDING`, type: "success" });

    // 3. EventBridge Publishing
    await this._sleep(350);
    const domainEvent = {
      source: "ecommerce.orders",
      "detail-type": "OrderCreated",
      id: `eb-${Date.now()}`,
      detail: orderRecord
    };
    this.emit("step:success", { step: "order_lambda", title: "Order Service" });
    this.emit("step:success", { step: "eventbridge", title: "EventBridge Bus", payload: domainEvent });
    this.emit("log", { source: "EventBridge", message: `Published 'OrderCreated' event to bus 'event-driven-ecommerce-bus'`, type: "success" });

    // Asynchronous Fan-Out Simulation (Parallel branches)
    this._runDownstreamFanOut(orderRecord, flags);

    return {
      message: "Order created successfully",
      orderId,
      status: "PENDING"
    };
  }

  async _runDownstreamFanOut(order, flags) {
    // Branch A: Analytics Lambda (Direct Target)
    setTimeout(async () => {
      this.emit("step:start", { step: "analytics_lambda", title: "Analytics Lambda" });
      await this._sleep(400);
      this.emit("step:success", { step: "analytics_lambda", title: "Analytics Lambda" });
      this.emit("log", {
        source: "Analytics Lambda",
        message: `Metrics recorded: Order ${order.orderId}, Customer: ${order.customerId}, Amount: ${order.currency} ${order.totalAmount}`,
        type: "success"
      });
    }, 400);

    // Branch B: Notification SQS & Lambda
    setTimeout(async () => {
      this.emit("step:start", { step: "notif_sqs", title: "Notification SQS" });
      this.emit("log", { source: "Notification SQS", message: `Enqueued OrderCreated event (Message ID: sqs-notif-${Date.now()})`, type: "info" });
      await this._sleep(500);

      this.emit("step:start", { step: "notif_lambda", title: "Notification Lambda" });
      if (flags.simulateNotifFailure) {
        this.emit("step:error", { step: "notif_lambda", error: "SMTP Gateway Timeout" });
        this.emit("log", { source: "Notification Lambda", message: "ERROR: Downstream SMTP timeout. Message retrying in SQS...", type: "error" });
      } else {
        this.emit("step:success", { step: "notif_sqs", title: "Notification SQS" });
        this.emit("step:success", { step: "notif_lambda", title: "Notification Lambda" });
        this.emit("log", { source: "Notification Lambda", message: `Notification sent for order ${order.orderId}`, type: "success" });
      }
    }, 600);

    // Branch C: Payment SQS, Lambda & DLQ
    setTimeout(async () => {
      this.emit("step:start", { step: "payment_sqs", title: "Payment SQS" });
      this.emit("log", { source: "Payment SQS", message: `Enqueued OrderCreated event (Message ID: sqs-pay-${Date.now()})`, type: "info" });
      await this._sleep(600);

      if (flags.simulatePaymentFailure) {
        // Demonstrate 3x Retries then DLQ routing
        for (let attempt = 1; attempt <= 3; attempt++) {
          this.emit("step:error", { step: "payment_lambda", title: `Payment Attempt #${attempt}` });
          this.emit("log", {
            source: "Payment Lambda",
            message: `[Retry ${attempt}/3] Payment gateway simulated failure. SQS keeps message in visibility timeout (30s).`,
            type: "warn"
          });
          await this._sleep(700);
        }

        // Exhausted retries -> DLQ
        this.emit("step:error", { step: "payment_dlq", title: "Payment DLQ (Poison Pill)" });
        this.emit("log", {
          source: "SQS Redrive",
          message: `🚨 Max retries (3) exhausted! Message moved to 'payment-dlq'. CloudWatch alarm 'payment-dlq-messages-visible' TRIGGERED.`,
          type: "error"
        });

        // Update local order status
        order.status = "PAYMENT_FAILED";
        this.localOrders.set(order.orderId, order);
      } else {
        this.emit("step:success", { step: "payment_sqs", title: "Payment SQS" });
        this.emit("step:success", { step: "payment_lambda", title: "Payment Lambda" });
        const txnId = `txn-${Date.now().toString(36)}`;
        this.emit("log", {
          source: "Payment Lambda",
          message: `Payment SUCCESS for order ${order.orderId}. Captured transaction: ${txnId}`,
          type: "success"
        });

        // Update local order status to COMPLETED
        order.status = "COMPLETED";
        order.transactionId = txnId;
        this.localOrders.set(order.orderId, order);
      }
    }, 800);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const apiService = new ApiService();
