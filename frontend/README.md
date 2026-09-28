# Event-Driven E-Commerce Frontend

An interactive Single Page Application (SPA) designed to visualize and test the **Serverless Event-Driven Architecture** in real time.

---

## Features

1. **Developer Storefront**:
   * Browse cloud developer gear & developer swag.
   * Dynamic shopping cart with quantity adjustment and total calculation.
2. **Real-Time Architecture Visualizer**:
   * Interactive animated flow diagram showing the entire serverless choreography:
     `API Gateway -> Order Lambda -> DynamoDB -> EventBridge -> SQS Queues -> Consumer Lambdas -> DLQs`.
   * Nodes pulse, change color, and display status badges as messages flow through the system.
3. **Live Event Stream Terminal**:
   * Timestamped event telemetry log showing JSON contracts and message transformations at every step.
4. **Chaos Testing & Failure Simulation**:
   * Toggle simulated payment gateway failures or notification outages right from the UI.
   * Watch the Payment Lambda retry 3 times in accordance with the SQS visibility timeout before SQS automatically quarantines the poison message to the Dead Letter Queue (`payment-dlq`).
5. **Dual Mode Operation**:
   * **Local Simulation Mode**: Fully operational inside the browser with zero cloud credentials or setup.
   * **Live AWS Cloud Mode**: Enter your deployed AWS API Gateway URL to run against real AWS cloud infrastructure!
6. **Order Status Tracker**:
   * Query order status via `GET /orders/{orderId}` to demonstrate eventual consistency.

---

## How to Run Locally

You can launch the frontend with a single command (no build step or bundler needed):

```bash
npm run frontend
```

Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

*(Alternatively, you can simply double-click and open `frontend/index.html` directly in any web browser!)*

---

## Connecting to Deployed AWS API Gateway

1. Deploy your Terraform infrastructure (`terraform apply`).
2. Copy the outputted `api_gateway_url` (e.g. `https://xyz123.execute-api.us-east-1.amazonaws.com`).
3. Paste the URL into the **AWS API Gateway URL** field in the top banner of the Storefront and click **Connect**.
4. The status badge will change from `🟢 Local Simulation` to `☁️ Live AWS Gateway`.
5. Now, all orders placed in the UI will trigger real AWS API Gateway calls, write to real DynamoDB, and publish events to real EventBridge and SQS!

---

## Free Hosting Options ($0.00 / month)

Since the frontend is a pure static web app (HTML5, modern CSS, ES6 JavaScript):

* **Cloudflare Pages**: Connect your GitHub repository and set build command to empty and root directory to `frontend`. Deploy worldwide on Cloudflare's edge network for **$0.00**.
* **GitHub Pages**: Set source to branch `main` with folder `/frontend` (or root) in repository settings for **$0.00**.
* **AWS S3 + CloudFront**: Upload the `frontend/` files to an S3 bucket configured for static website hosting with a CloudFront distribution under the AWS Free Tier for **$0.00**.
