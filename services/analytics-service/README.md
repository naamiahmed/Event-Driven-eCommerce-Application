# Analytics Service

The **Analytics Service** illustrates direct serverless event fan-out from Amazon EventBridge. When an `OrderCreated` event is published to the custom event bus, EventBridge routes a copy directly to the Analytics Lambda function without requiring an intermediate queue.

## Architecture Role

```text
EventBridge (OrderCreated) -> Analytics Lambda -> CloudWatch Logs
```

## Direct Fan-Out Pattern

* **Zero Queue Overhead**: For analytical ingestion where immediate backpressure buffering isn't critical or where near-real-time event streaming is desired, EventBridge invokes the Lambda target directly.
* **Independent Evolution**: The analytics consumer can be modified, paused, or replaced without altering the Order, Payment, or Notification microservices.

## Logged Output

```text
New order received
Order ID: order-123
Amount: 3000
Customer: customer-123
```

## Local Testing

```bash
npm test
```
