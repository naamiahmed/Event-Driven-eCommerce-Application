# Failure Scenarios, SQS Retries, and Dead Letter Queues (DLQ)

In production cloud environments, failures are inevitable: third-party payment gateways experience transient network drops, downstream email APIs exceed rate limits, or malformed data slips past initial filters.

This guide demonstrates how our serverless event-driven architecture guarantees **zero lost orders** and **automatic fault recovery** using Amazon SQS and Dead Letter Queues.

---

## 1. Failure Isolation Comparison

### Synchronous Monolith / Chained Microservices
```text
Client -> [ Order API ] ---> [ Payment Gateway (Down) ]
               |
               v
     *Entire Request Crashes*
     Customer gets 500 Error
     Order is LOST from database
```

### Event-Driven Architecture with SQS & DLQ
```text
Client -> [ Order API ] -> [ DynamoDB ] (Order is saved!)
               |
               v
        [ EventBridge ]
          /         \
         v           v
    [Pay SQS]    [Notif SQS] (Notification succeeds!)
        |
        v
    [Pay Lambda] -> ERROR (Gateway Down)
        |
      Retry 1 (Visibility Timeout 30s)
        |
      Retry 2 (Visibility Timeout 30s)
        |
      Retry 3 (Visibility Timeout 30s)
        |
        v
    [Payment DLQ] -> CloudWatch Alarm fires -> DevOps team alerted
```

**Key Takeaways:**
1. **The customer order is never lost**: The order is safely persisted in DynamoDB with status `PENDING`.
2. **Unaffected services proceed normally**: The customer receives their order confirmation email, and the analytics system records the order.
3. **No server thread is blocked**: System throughput is unaffected.

---

## 2. Deep Dive: SQS Lifecycle & Retry Mechanics

```text
Message Ingested into SQS
          │
          ▼
┌────────────────────────┐
│ State: VISIBLE (Queue) │ ◄────────────────────────────────────────┐
└──────────┬─────────────┘                                          │
           │                                                        │
           │ Lambda Polls Message                                   │
           ▼                                                        │
┌───────────────────────────┐                                       │
│ State: IN-FLIGHT          │                                       │
│ (Hidden for 30s Timeout)  │                                       │
└──────────┬────────────────┘                                       │
           │                                                        │
     Does Lambda Succeed?                                           │
    /                    \                                          │
 [YES]                   [NO] (Error Thrown)                        │
   │                      │                                         │
   ▼                      ▼                                         │
Delete Message     ReceiveCount Incremented                         │
From SQS           Is ReceiveCount < 3?                             │
                   ├──────────────────────────── YES ───────────────┘
                   │
                   ▼ (ReceiveCount >= 3)
         ┌───────────────────┐
         │ Redrive to DLQ    │
         └─────────┬─────────┘
                   ▼
         CloudWatch Alarm Fires!
```

### Visibility Timeout Configuration
* **Lambda Timeout**: `10 seconds`
* **SQS Visibility Timeout**: `30 seconds`
* **Rule**: SQS Visibility Timeout **must always be at least 3x the Lambda function timeout**. If the Lambda times out at 10s, SQS waits until the 30s visibility window expires before making the message visible again for another consumer retry.

### Redrive Policy (`maxReceiveCount = 3`)
When the Lambda throws an unhandled exception:
1. SQS increments `ApproximateReceiveCount`.
2. The message remains hidden during the 30-second visibility timeout.
3. Once the visibility timeout expires, the message becomes visible in the queue again.
4. Lambda automatically picks up the message and retries.
5. If the message fails **3 consecutive times**, SQS automatically routes it to the designated **Dead Letter Queue (DLQ)**.

---

## 3. Simulating Failures in This Project

Both the Payment Service and Notification Service include intentional failure modes designed for live demonstrations and testing.

### Step 1: Enable Payment Failure Mode

Set the environment variable in `infrastructure/terraform/variables.tf` or via `.env`:

```bash
# In Terraform variables:
payment_failure_mode = "true"
```

Or pass via command line during terraform apply:
```bash
terraform apply -var="payment_failure_mode=true"
```

### Step 2: Submit a Test Order

```bash
curl -X POST https://<api-gateway-url>/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-debug-101",
    "currency": "LKR",
    "items": [
      { "productId": "prod-1", "quantity": 1, "price": 5000 }
    ]
  }'
```

### Step 3: Observe the Logs & DLQ in Real Time

1. **Order API**: Returns `201 Created` immediately.
2. **Notification Service**: Logs success in CloudWatch:
   ```text
   Notification sent for order order-12345
   ```
3. **Payment Service**: Logs 3 consecutive failures spaced by the visibility timeout:
   ```text
   [PaymentProcessor] SIMULATED FAILURE triggered for order: order-12345
   [PaymentProcessor] Error: Payment processing failed for order order-12345: Simulated gateway timeout
   ```
4. **CloudWatch Alarm**: The `event-driven-ecommerce-payment-dlq-messages-visible` alarm transitions to `ALARM` state because `ApproximateNumberOfMessagesVisible >= 1`.

---

## 4. Remediation & DLQ Redrive Process

Once the root cause (e.g. gateway downtime or bug) is resolved:

1. **Inspect Poison Message**:
   Read the message in the AWS SQS Console or CLI:
   ```bash
   aws sqs receive-message \
     --queue-url <PAYMENT_DLQ_URL> \
     --attribute-names All \
     --message-attribute-names All
   ```

2. **Fix the Underlying Issue**:
   Deploy the fix or toggle `PAYMENT_FAILURE_MODE="false"`.

3. **Redrive Messages Back to Main Queue**:
   Using the AWS SQS StartMessageMoveTask API:
   ```bash
   aws sqs start-message-move-task \
     --source-arn <PAYMENT_DLQ_ARN> \
     --destination-arn <PAYMENT_QUEUE_ARN>
   ```

4. The Payment Lambda immediately re-processes the message from the main queue and captures payment successfully!
