# Notification Service

The **Notification Service** consumes `OrderCreated` events asynchronously via an Amazon SQS queue (`notification-queue`) and delivers customer confirmations.

## Architecture Role

```text
EventBridge (OrderCreated) -> Notification SQS -> Notification Lambda -> Dispatch Confirmation
                                      |
                                (On Failures)
                                      v
                               Notification DLQ
```

## Benefits of Asynchronous Decoupling

* **User Experience Isolation**: Customers receive instant HTTP responses from the Order API without waiting for email/SMS gateways to connect or time out.
* **Fault Tolerance**: If the email service is down, orders continue to be placed without interruption. Messages wait in the SQS queue and are retried automatically.
* **DLQ Protection**: Repeated delivery failures route to `notification-dlq` without losing customer notifications.

## Testing Failure Modes

Set the environment variable in AWS Lambda or your local environment:

```bash
NOTIFICATION_FAILURE_MODE=true
```

## Local Testing

```bash
npm test
```
