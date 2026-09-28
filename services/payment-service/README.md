# Payment Service

The **Payment Service** handles payment processing asynchronously. It is completely decoupled from the Order Service and is invoked via an Amazon SQS queue (`payment-queue`) triggered by Amazon EventBridge routing rules.

## Architecture Role

```text
EventBridge (OrderCreated) -> Payment SQS -> Payment Lambda -> Payment Result
                                   |
                             (On Failures)
                                   v
                              Payment DLQ
```

## Loose Coupling & Asynchronous Resilience

* **Zero Direct Dependency**: The Order Service has no knowledge of how or when payment is processed.
* **Buffering & Rate Limiting**: The SQS queue buffers sudden traffic spikes, protecting payment processors from overload.
* **Automatic Retries**: If payment processing fails (e.g. gateway timeouts), AWS Lambda throws an error, leaving the message in SQS. SQS retries processing up to `maxReceiveCount` times (configured to 3).
* **Dead Letter Queue (DLQ)**: Once max retries are exceeded, the poison message is automatically redirected to `payment-dlq` for inspection, alerting, and manual redrive.

## Failure Simulation Mode

To demonstrate and test retries and DLQ behavior, set the environment variable:

```bash
PAYMENT_FAILURE_MODE=true
```

## Local Testing

```bash
# Run unit tests
npm test
```
