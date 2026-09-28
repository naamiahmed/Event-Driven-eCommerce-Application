# Serverless Event-Driven E-Commerce Application on AWS

[![CI Test & Validate](https://github.com/naamiahmed/Event-Driven-eCommerce-Application/actions/workflows/test.yml/badge.svg)](https://github.com/naamiahmed/Event-Driven-eCommerce-Application/actions/workflows/test.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Terraform](https://img.shields.io/badge/Terraform-1.5+-7b42bc?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-ff9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, portfolio-ready **event-driven e-commerce backend** built with AWS Serverless primitives and provisioned via Infrastructure as Code (Terraform).

This project demonstrates core cloud architecture concepts: **event choreography, asynchronous decoupling, resilient worker retries, Dead Letter Queue (DLQ) poison-pill isolation, and automated CI/CD**.

---

## Target Architecture

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

## Technologies Used

* **Application Runtime**: Node.js 20+, JavaScript, AWS SDK v3, Jest
* **Ingress**: Amazon API Gateway v2 (HTTP API)
* **Compute**: AWS Lambda (serverless, auto-scaling, pay-per-execution)
* **Event Broker**: Amazon EventBridge (custom event bus, pattern-matching rules)
* **Messaging & Buffering**: Amazon SQS (Standard Queues, Dead Letter Queues, Redrive Policies)
* **Persistence**: Amazon DynamoDB (on-demand capacity mode `PAY_PER_REQUEST`, point-in-time recovery)
* **Observability**: Amazon CloudWatch (structured log groups, DLQ message alarms, metric dashboard)
* **Security & IAM**: AWS IAM (least-privilege per-service execution roles)
* **Infrastructure as Code (IaC)**: Terraform (~> 5.0 AWS provider)
* **CI/CD Pipeline**: GitHub Actions

---

## Why Event-Driven Architecture?

Traditional monolithic applications process orders synchronously: `Client -> Order Service -> Payment API -> Email Service -> Analytics DB`.

### Problems with Synchronous Processing:
1. **Tight Coupling**: If the third-party email provider or payment processor is down, the entire checkout request crashes.
2. **High Latency**: The customer waits seconds while every downstream service executes sequentially.
3. **Fragile Scaling**: Traffic surges hit third-party APIs directly with no buffer.

### The Event-Driven Advantage:
* **Zero Direct Dependency**: The Order Service only saves the order in DynamoDB, publishes an `OrderCreated` event to EventBridge, and returns HTTP 201 immediately (< 120ms latency).
* **Fault Isolation**: If the notification service experiences an outage, payments and orders proceed without disruption. Messages safely wait in SQS.
* **Rate Leveling (Buffering)**: SQS absorbs flash-sale traffic spikes and delivers messages to consumer Lambdas at a sustainable concurrency rate.
* **Event Fan-Out**: Multiple microservices (Payment, Notification, Analytics) react to a single event independently without modifying the Order Service.
* **Cost Efficiency**: Serverless compute scales to zero when there is no traffic, costing pennies during development.

---

## Event Flow & Lifecycle

1. **Ingress**: Client issues `POST /orders` with items and customer details.
2. **Ingestion & Validation**: `order-service` validates payload schemas, calculates total amounts, and persists the record to **DynamoDB** with status `PENDING`.
3. **Event Emitted**: `order-service` emits a domain event `OrderCreated` (source: `ecommerce.orders`) to the custom **EventBridge** bus.
4. **Fan-Out Distribution**:
   * **Rule 1** routes the event to `payment-queue` (SQS).
   * **Rule 2** routes the event to `notification-queue` (SQS).
   * **Rule 3** invokes `analytics-service` (Lambda) directly.
5. **Asynchronous Fulfillment**:
   * `payment-service` polls `payment-queue`, simulates transaction capture, and records results.
   * `notification-service` polls `notification-queue` and delivers customer email confirmations.
   * `analytics-service` records real-time sales telemetry in CloudWatch.

---

## Failure Handling & Dead Letter Queues (DLQ)

Both the Payment and Notification queues are protected by an automated redrive policy:

```text
Message Ingested -> SQS Queue -> Lambda Execution
                                        |
                             (Error / Gateway Failure)
                                        |
                          Retry 1 (Visibility Timeout 30s)
                                        |
                          Retry 2 (Visibility Timeout 30s)
                                        |
                          Retry 3 (Visibility Timeout 30s)
                                        |
                                        v
                            Dead Letter Queue (DLQ)
                                        |
                         CloudWatch Metric Alarm Fires!
```

### Configurable Failure Modes (Testing & Demonstrations)
Both workers support simulated failure modes to demonstrate retry loops and DLQ capturing in interviews or articles:

```bash
PAYMENT_FAILURE_MODE=true
NOTIFICATION_FAILURE_MODE=true
```

When set to `true`, the worker intentionally rejects transactions, forcing SQS to retry 3 times before routing the message to the DLQ.

---

## Repository Structure

```text
aws-event-driven-ecommerce/
│
├── services/                                # Serverless Microservices
│   ├── order-service/                       # Synchronous Order Ingestion API
│   │   ├── src/
│   │   │   ├── handler.js                   # API Gateway HTTP Handler
│   │   │   ├── validation.js                # Schema validation & calculation
│   │   │   └── orderRepository.js           # DynamoDB persistence & EventBridge publishing
│   │   ├── tests/
│   │   │   └── handler.test.js              # Unit tests
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── payment-service/                     # Asynchronous Payment Worker
│   │   ├── src/
│   │   │   ├── handler.js                   # SQS Event Consumer
│   │   │   └── paymentProcessor.js          # Payment simulation & failure mode
│   │   ├── tests/
│   │   │   └── handler.test.js
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── notification-service/                # Asynchronous Customer Notifications
│   │   ├── src/
│   │   │   ├── handler.js                   # SQS Event Consumer
│   │   │   └── notificationService.js       # Email simulation & failure mode
│   │   ├── tests/
│   │   │   └── handler.test.js
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── analytics-service/                   # Direct Fan-Out Telemetry Ingestion
│       ├── src/
│       │   └── handler.js                   # Direct EventBridge Target Handler
│       ├── tests/
│       │   └── handler.test.js
│       ├── package.json
│       └── README.md
│
├── frontend/                                # Interactive Client & Event Visualizer
│   ├── css/
│   │   └── styles.css                       # Modern UI, visualizer & dark theme styles
│   ├── js/
│   │   ├── api.js                           # Dual-mode API client (Live AWS & Local Simulation)
│   │   └── app.js                           # Product catalog, cart, and visualizer engine
│   ├── index.html                           # Single Page Application entrypoint
│   └── README.md
│
├── infrastructure/                          # Infrastructure as Code
│   └── terraform/
│       ├── versions.tf                      # Terraform & Provider version constraints
│       ├── provider.tf                      # AWS provider configuration & default tags
│       ├── variables.tf                     # Configurable inputs & failure toggles
│       ├── main.tf                          # Common locals & data sources
│       ├── dynamodb.tf                      # Orders DynamoDB Table
│       ├── eventbridge.tf                   # Event Bus, Rules, and Target routing
│       ├── sqs.tf                           # SQS Queues, DLQs, & redrive policies
│       ├── iam.tf                           # Least-privilege IAM roles & policies
│       ├── lambda.tf                        # Lambda resources & SQS mappings
│       ├── api_gateway.tf                   # API Gateway v2 HTTP API & routes
│       ├── cloudwatch.tf                    # Log groups, DLQ alarms & dashboard
│       └── outputs.tf                       # Exported endpoints, ARNs, and names
│
├── .github/
│   └── workflows/
│       ├── test.yml                         # CI: Tests, Linting, & Terraform format check
│       └── deploy.yml                       # CD: Safe automated Terraform deployment
│
├── docs/                                    # Technical Reference & Article Guides
│   ├── architecture.md                      # Architecture deep dive & design choices
│   ├── event-flow.md                        # End-to-end event schemas & contracts
│   ├── failure-scenarios.md                 # SQS retry mechanics & DLQ runbook
│   └── cost-analysis.md                     # Infrastructure cost report & AWS pricing
│
├── scripts/
│   ├── local-simulate.js                    # Terminal-based workflow runner
│   ├── serve-frontend.js                    # Zero-dependency local web server
│   └── lint.js                              # Cross-platform syntax linter
├── .env.example                             # Local environment template
├── .gitignore
├── jest.config.js                           # Test runner configuration
├── package.json                             # Root monorepo configuration
└── README.md
```

---

## Local Development & Testing

No active AWS account or Docker daemon is required to run the test suite or the frontend application.

### 1. Install Dependencies

```bash
npm install
```

### 2. Launch the Interactive Frontend Visualizer

```bash
npm run frontend
```
Opens the web app at **`http://localhost:3000`** with live architecture visualization, cart checkout, and chaos failure toggles.

### 3. Run the Terminal Workflow Simulator

```bash
npm run simulate
```

### 4. Run All Unit Tests

```bash
npm test
```

### 3. Run Tests with Coverage Report

```bash
npm run test:coverage
```

### 4. Run Lint / Syntax Checks

```bash
npm run lint
```

---

## Infrastructure Provisioning (Terraform)

When ready to deploy into your AWS account:

### 1. Initialize Terraform
```bash
cd infrastructure/terraform
terraform init
```

### 2. Review the Provisioning Plan
```bash
terraform plan
```

### 3. Deploy Infrastructure
```bash
terraform apply
```

Outputs will display:
* `api_gateway_url`: Your public API base URL.
* `orders_endpoint`: `https://.../orders`
* `eventbridge_bus_name`
* `dynamodb_table_name`
* `payment_queue_url` & `payment_dlq_url`
* `notification_queue_url` & `notification_dlq_url`

---

## CI/CD Automation (GitHub Actions)

* **`test.yml`**: Runs on every pull request and push to `main`. Validates JavaScript syntax, executes the full Jest test suite with coverage, and performs `terraform fmt -check` and `terraform validate`.
* **`deploy.yml`**: A safe manual-trigger workflow (`workflow_dispatch`). It checks whether AWS credentials or IAM OIDC roles are configured in GitHub Secrets before initiating `terraform plan` or `terraform apply`.

---

## Author & License

* Created by **Naami Ahmed**
* Distributed under the **MIT License**.