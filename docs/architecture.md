# Architecture Guide: AWS Event-Driven E-Commerce

## 1. Executive Summary

This architecture implements a modern, cloud-native, serverless **Event-Driven Architecture (EDA)** for an e-commerce order processing backend on AWS.

Rather than relying on synchronous, tightly-coupled point-to-point HTTP communication, this system uses an **event choreography** approach. Microservices react to domain state changes published through **Amazon EventBridge**, buffered through **Amazon SQS**, and isolated with **Dead Letter Queues (DLQs)**.

---

## 2. High-Level System Architecture

```text
                         +-----------------------+
                         |      HTTP Client      |
                         |   (Web / Mobile App)  |
                         +-----------+-----------+
                                     |
                                     | POST /orders
                                     v
                        +-------------------------+
                        |  Amazon API Gateway v2  |
                        |       (HTTP API)        |
                        +------------+------------+
                                     |
                                     | AWS_PROXY
                                     v
                        +-------------------------+
                        |   Order Service Lambda  |
                        +------------+------------+
                                     |
                    +----------------+----------------+
                    |                                 |
                    | PutItem                         | PutEvents (OrderCreated)
                    v                                 v
         +--------------------+             +--------------------+
         |  Amazon DynamoDB   |             | Amazon EventBridge |
         |   (Orders Table)   |             | (Custom Event Bus) |
         +--------------------+             +---------+----------+
                                                      |
                  +-----------------------------------+-----------------------------------+
                  |                                   |                                   |
                  v                                   v                                   v
         +-----------------+                 +-----------------+                 +-----------------+
         |  Payment Rule   |                 |Notification Rule|                 | Analytics Rule  |
         +--------+--------+                 +--------+--------+                 +--------+--------+
                  |                                   |                                   |
                  v                                   v                                   |
         +-----------------+                 +-----------------+                          |
         |   Payment SQS   |                 |Notification SQS |                          |
         |      Queue      |                 |      Queue      |                          |
         +--------+--------+                 +--------+--------+                          |
                  |                                   |                                   |
                  v (Event Source)                    v (Event Source)                    v (Direct Target)
         +-----------------+                 +-----------------+                 +-----------------+
         | Payment Lambda  |                 |Notification Lmb |                 |Analytics Lambda |
         +--------+--------+                 +--------+--------+                 +--------+--------+
                  | (3 Failures)                      | (3 Failures)                      |
                  v                                   v                                   v
         +-----------------+                 +-----------------+                 +-----------------+
         |   Payment DLQ   |                 |Notification DLQ |                 | CloudWatch Logs |
         +-----------------+                 +-----------------+                 +-----------------+
                  |                                   |
                  +-----------------+-----------------+
                                    |
                                    v
                       +-------------------------+
                       | CloudWatch Alarm & Dash |
                       +-------------------------+
```

---

## 3. The Problem with Monolithic / Synchronous Architecture

In traditional monolithic architectures or synchronous microservices, when a customer places an order, the application server attempts to perform all tasks in a single synchronous chain:

```text
Client -> [ Order API ]
               |
               +---> [ Call Payment Gateway ] (takes 1.5s - 4.0s)
               |
               +---> [ Call Email Provider ]  (takes 800ms - 2.0s)
               |
               +---> [ Record Analytics ]    (takes 200ms)
```

### Critical Flaws of Synchronous Chains:

1. **Cascading Failures**: If the third-party email provider or notification gateway times out, the entire checkout request fails or times out, resulting in a lost sale.
2. **High Latency**: The customer's mobile app or browser blocks while awaiting every downstream dependency to finish (aggregate response time 3 to 7 seconds).
3. **Tight Coupling**: Any schema change or outage in the analytics or notification service directly affects the Order Service.
4. **Traffic Spikes Crash Dependencies**: If traffic surges by 10x (e.g., Black Friday), downstream dependencies (payment gateway, inventory, email) are hit with an immediate tsunami of requests and crash.

---

## 4. The Event-Driven Solution

By adopting asynchronous event choreography with EventBridge and SQS:

* **Instant Customer Response (< 150ms)**: The Order Service only validates the request, writes to DynamoDB, publishes one `OrderCreated` event to EventBridge, and returns HTTP 201 immediately to the client.
* **Fault Isolation**: If the notification service is down, orders and payments continue without interruption. Messages safely queue up in SQS until the notification service recovers.
* **Elastic Rate Leveling (Queue Buffering)**: SQS acts as a shock absorber. Thousands of orders placed simultaneously are buffered in SQS and consumed at a controlled, sustainable rate by downstream Lambdas.
* **Independent Extensibility**: New downstream consumers (such as Fraud Detection, Warehouse Fulfillment, or Marketing Automation) can be added tomorrow simply by creating a new EventBridge rule without touching a single line of Order Service code.

---

## 5. Microservices Breakdown

| Service | Ingestion Type | Primary Duty | Failure Handling |
| :--- | :--- | :--- | :--- |
| **Order Service** | Synchronous REST (`POST /orders`) | Ingestion, validation, DynamoDB persistence, event emission | Returns 400 on invalid input, 500 on infrastructure error |
| **Payment Service** | Asynchronous SQS (`payment-queue`) | Parses event, executes payment simulation | Throws error on failure, triggering 3x SQS retries -> Payment DLQ |
| **Notification Service** | Asynchronous SQS (`notification-queue`) | Dispatches order confirmation email/SMS | Throws error on failure, triggering 3x SQS retries -> Notification DLQ |
| **Analytics Service** | Direct EventBridge Target | Real-time metric ingestion & event log | CloudWatch logging with event detail parsing |

---

## 6. AWS Service Selection Rationale

* **Amazon API Gateway v2 (HTTP API)**: High-performance, low-cost HTTP ingress with native CORS and AWS Lambda integration.
* **AWS Lambda (Node.js 20)**: Ephemeral, serverless compute that automatically scales to zero when idle, eliminating idle server expenses.
* **Amazon EventBridge**: Central serverless event router supporting declarative JSON pattern filtering and multi-target fan-out.
* **Amazon SQS & DLQ**: Managed message queues providing asynchronous decoupling, concurrency throttling, and automatic dead-letter redrive.
* **Amazon DynamoDB**: Serverless, ultra-low latency NoSQL database configured with on-demand capacity (`PAY_PER_REQUEST`).
* **Amazon CloudWatch**: Centralized logging, metrics, alarms on DLQ visibility, and operational dashboards.
