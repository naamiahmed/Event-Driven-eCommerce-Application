# Order Service

The **Order Service** is the synchronous entry point of the e-commerce application. It receives incoming customer orders via API Gateway, validates the payload, generates unique order IDs, calculates totals, persists the order record in DynamoDB, and publishes an `OrderCreated` domain event to Amazon EventBridge.

## Architecture Role

```text
Client -> API Gateway (POST /orders) -> Order Lambda -> DynamoDB (Orders Table)
                                                    -> EventBridge (ecommerce.orders)
```

## Responsibilities

1. **Input Ingestion & Validation**: Ensures required customer details, item counts, product IDs, and unit prices conform to schema.
2. **Deterministic Calculations**: Calculates total price across line items with decimal precision.
3. **State Persistence**: Saves the initial order record with status `PENDING` into DynamoDB.
4. **Event Publishing**: Emits the `OrderCreated` event to Amazon EventBridge for asynchronous downstream processing (Payment, Notification, Analytics).

## Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `AWS_REGION` | AWS Region where resources reside | `us-east-1` |
| `ORDERS_TABLE_NAME` | Target DynamoDB table for orders | `event-driven-ecommerce-orders-dev` |
| `EVENT_BUS_NAME` | Custom EventBridge bus name | `event-driven-ecommerce-bus-dev` |

## Local Testing

```bash
# Run unit tests for order service
npm test
```
