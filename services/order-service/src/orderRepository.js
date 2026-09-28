/**
 * Data access and event publishing repository for Order Service
 */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

class OrderRepository {
  /**
   * @param {Object} options
   * @param {string} [options.tableName] - DynamoDB table name
   * @param {string} [options.eventBusName] - EventBridge custom bus name
   * @param {Object} [options.docClient] - Injected DynamoDB Document Client (for testing)
   * @param {Object} [options.eventBridgeClient] - Injected EventBridge Client (for testing)
   */
  constructor(options = {}) {
    this.tableName = options.tableName || process.env.ORDERS_TABLE_NAME || "Orders";
    this.eventBusName = options.eventBusName || process.env.EVENT_BUS_NAME || "default";

    if (options.docClient) {
      this.docClient = options.docClient;
    } else {
      const ddbClient = new DynamoDBClient({
        region: process.env.AWS_REGION || "us-east-1"
      });
      this.docClient = DynamoDBDocumentClient.from(ddbClient);
    }

    if (options.eventBridgeClient) {
      this.eventBridgeClient = options.eventBridgeClient;
    } else {
      this.eventBridgeClient = new EventBridgeClient({
        region: process.env.AWS_REGION || "us-east-1"
      });
    }
  }

  /**
   * Persists an order to DynamoDB
   * @param {Object} order
   * @returns {Promise<Object>}
   */
  async saveOrder(order) {
    const params = {
      TableName: this.tableName,
      Item: {
        orderId: order.orderId,
        customerId: order.customerId,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        items: order.items,
        createdAt: order.createdAt
      }
    };

    console.log(`[OrderRepository] Saving order ${order.orderId} to DynamoDB table ${this.tableName}`);
    await this.docClient.send(new PutCommand(params));
    return order;
  }

  /**
   * Retrieves an order by ID from DynamoDB
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async getOrder(orderId) {
    const { GetCommand } = require("@aws-sdk/lib-dynamodb");
    const params = {
      TableName: this.tableName,
      Key: { orderId }
    };

    console.log(`[OrderRepository] Fetching order ${orderId} from DynamoDB table ${this.tableName}`);
    const result = await this.docClient.send(new GetCommand(params));
    return result.Item || null;
  }

  /**
   * Publishes OrderCreated event to EventBridge
   * @param {Object} order
   * @returns {Promise<Object>}
   */
  async publishOrderCreatedEvent(order) {
    const detailPayload = {
      orderId: order.orderId,
      customerId: order.customerId,
      totalAmount: order.totalAmount,
      currency: order.currency,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      createdAt: order.createdAt
    };

    const entry = {
      Source: "ecommerce.orders",
      DetailType: "OrderCreated",
      Detail: JSON.stringify(detailPayload),
      EventBusName: this.eventBusName,
      Time: new Date()
    };

    console.log(`[OrderRepository] Publishing OrderCreated event for ${order.orderId} to bus ${this.eventBusName}`);
    const command = new PutEventsCommand({
      Entries: [entry]
    });

    const response = await this.eventBridgeClient.send(command);

    if (response.FailedEntryCount && response.FailedEntryCount > 0) {
      const failed = response.Entries ? response.Entries[0] : {};
      throw new Error(`Failed to publish event to EventBridge: ${failed.ErrorMessage || "Unknown error"}`);
    }

    return response;
  }
}

module.exports = OrderRepository;
