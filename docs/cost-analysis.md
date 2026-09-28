# AWS Serverless Cost Analysis & Infrastructure Economics

This document provides a realistic, transparent breakdown of the operational costs for running this **Event-Driven E-Commerce Application** on AWS and associated platforms (GitHub Actions, Cloudflare).

---

## 1. Executive Cost Summary

| Usage Level | Monthly Orders | AWS Free Tier Active | AWS Free Tier Expired |
| :--- | :--- | :--- | :--- |
| **Local Development / Testing** | 0 (Runs on local machine) | **$0.00** | **$0.00** |
| **Portfolio / Demo Traffic** | 1,000 – 10,000 orders/month | **$0.00 / month** | **<$0.05 / month** (5 cents) |
| **Moderate Production** | 100,000 orders/month | **$0.00 / month** | **~$0.45 / month** (45 cents) |
| **High Production** | 1,000,000 orders/month | **~$3.10 / month** | **~$4.20 / month** |

> [!NOTE]
> Because this architecture is **100% serverless**, resources scale down to absolute zero when not in use. **There are zero idle hourly charges.**

---

## 2. Service-by-Service AWS Breakdown

### A. AWS Lambda (Compute)
* **AWS Free Tier (Always Free)**:
  * **1,000,000 free requests** per month.
  * **3.2 million seconds of compute time** (400,000 GB-seconds) per month.
* **Pricing After Free Tier**:
  * $0.20 per 1,000,000 requests.
  * $0.0000166667 per GB-second (at 256MB memory, 100ms execution costs ~$0.0000004).
* **Cost for 10,000 orders/month**: **$0.00**

### B. Amazon API Gateway v2 (HTTP API)
* **AWS Free Tier (First 12 months)**:
  * **1,000,000 free API calls** per month.
* **Pricing After Free Tier**:
  * $1.00 per 1,000,000 requests (3x cheaper than traditional REST APIs, with zero monthly minimums).
* **Cost for 10,000 orders/month**: **$0.00** (or $0.01 outside free tier).

### C. Amazon EventBridge (Custom Event Bus)
* **AWS Free Tier (Always Free)**:
  * **1,000,000 free custom events published** per month.
* **Pricing After Free Tier**:
  * $1.00 per 1,000,000 events published.
  * Event deliveries to AWS services (SQS, Lambda) are **free**.
* **Cost for 10,000 orders/month**: **$0.00** (or $0.01 outside free tier).

### D. Amazon SQS & Dead Letter Queues (Messaging)
* **AWS Free Tier (Always Free)**:
  * **1,000,000 free requests** per month across standard queues and DLQs.
* **Pricing After Free Tier**:
  * $0.40 per 1,000,000 standard requests.
* **Cost for 10,000 orders/month**: **$0.00**

### E. Amazon DynamoDB (NoSQL Storage)
* **Billing Mode**: `PAY_PER_REQUEST` (On-Demand Capacity).
* **AWS Free Tier (Always Free)**:
  * **25 GB of storage** permanently free.
  * **2.5 million read/write request units** per month.
* **Pricing After Free Tier**:
  * $1.25 per million write request units.
  * $0.25 per million read request units.
* **Cost for 10,000 orders/month**: **$0.00**

### F. Amazon CloudWatch (Logging, Metrics & Dashboard)
* **AWS Free Tier (Always Free)**:
  * **5 GB of log data ingestion** per month.
  * **3 custom dashboards** (up to 50 metrics each).
  * **10 metric alarms** (our project provisions 2 DLQ alarms).
* **Cost Control Safeguard Built-In**:
  * Our Terraform configuration enforces a **14-day automatic log retention policy** (`retention_in_days = 14`), preventing logs from accumulating forever and incurring storage fees.
* **Cost for portfolio testing**: **$0.00**

---

## 3. Comparison: Serverless vs. Traditional Architecture

Why was this serverless architecture chosen over Kubernetes, ECS, or RDS?

| Component | Traditional Stack (Monthly Idle Cost) | Serverless Stack (Our Project) |
| :--- | :--- | :--- |
| **Compute** | EKS Cluster ($73.00) + 2x EC2 ($30.00) | AWS Lambda (**$0.00**) |
| **Database** | Amazon RDS PostgreSQL (`db.t4g.micro`: $15.00) | Amazon DynamoDB (**$0.00**) |
| **Networking** | AWS NAT Gateway ($32.40) | None required (**$0.00**) |
| **Load Balancing** | Application Load Balancer ($16.20) | API Gateway v2 (**$0.00**) |
| **Message Broker** | Managed Kafka / MSK ($150.00+) | EventBridge + SQS (**$0.00**) |
| **TOTAL IDLE COST** | **~$280 - $315 / month** | **$0.00 / month** |

---

## 4. Other Platforms & Tools

### GitHub Actions (CI/CD)
* **Public GitHub Repositories**: **100% Free** (unlimited workflow minutes).
* **Private GitHub Repositories**: **2,000 free minutes per month** on the standard free account. Our CI pipeline takes ~45 seconds to run, allowing over 2,500 test runs per month without paying a penny.

### Cloudflare (Optional)
* Cloudflare is **not required** for the core backend.
* If you attach a custom domain or deploy a frontend (e.g. Cloudflare Pages or DNS proxy), Cloudflare's **Free Plan ($0.00/mo)** provides free SSL, DNS, and DDoS mitigation.

### Terraform CLI
* Open-source software with **no license fee ($0.00)**.
