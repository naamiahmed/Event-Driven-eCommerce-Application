variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project identifier used for naming resources"
  type        = string
  default     = "event-driven-ecommerce"
}

variable "lambda_runtime" {
  description = "Node.js runtime for AWS Lambda functions"
  type        = string
  default     = "nodejs20.x"
}

variable "payment_failure_mode" {
  description = "When set to true, simulates payment gateway failures to trigger SQS retries and DLQ routing"
  type        = string
  default     = "false"
}

variable "notification_failure_mode" {
  description = "When set to true, simulates notification delivery failures to trigger SQS retries and DLQ routing"
  type        = string
  default     = "false"
}
