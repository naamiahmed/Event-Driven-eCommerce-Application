# ==============================================================================
# API Gateway Outputs
# ==============================================================================
output "api_gateway_url" {
  description = "The public invoke URL of the API Gateway HTTP API"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "orders_endpoint" {
  description = "Direct POST endpoint for creating new orders"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}orders"
}

# ==============================================================================
# EventBridge Outputs
# ==============================================================================
output "eventbridge_bus_name" {
  description = "Name of the custom EventBridge event bus"
  value       = aws_cloudwatch_event_bus.main.name
}

output "eventbridge_bus_arn" {
  description = "ARN of the custom EventBridge event bus"
  value       = aws_cloudwatch_event_bus.main.arn
}

# ==============================================================================
# DynamoDB Outputs
# ==============================================================================
output "dynamodb_table_name" {
  description = "Name of the DynamoDB Orders table"
  value       = aws_dynamodb_table.orders.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB Orders table"
  value       = aws_dynamodb_table.orders.arn
}

# ==============================================================================
# SQS & Dead Letter Queue Outputs
# ==============================================================================
output "payment_queue_url" {
  description = "URL of the Payment SQS queue"
  value       = aws_sqs_queue.payment_queue.url
}

output "payment_queue_arn" {
  description = "ARN of the Payment SQS queue"
  value       = aws_sqs_queue.payment_queue.arn
}

output "payment_dlq_url" {
  description = "URL of the Payment Dead Letter Queue (DLQ)"
  value       = aws_sqs_queue.payment_dlq.url
}

output "notification_queue_url" {
  description = "URL of the Notification SQS queue"
  value       = aws_sqs_queue.notification_queue.url
}

output "notification_queue_arn" {
  description = "ARN of the Notification SQS queue"
  value       = aws_sqs_queue.notification_queue.arn
}

output "notification_dlq_url" {
  description = "URL of the Notification Dead Letter Queue (DLQ)"
  value       = aws_sqs_queue.notification_dlq.url
}

# ==============================================================================
# AWS Lambda Outputs
# ==============================================================================
output "order_lambda_arn" {
  description = "ARN of the Order Service Lambda"
  value       = aws_lambda_function.order_service.arn
}

output "payment_lambda_arn" {
  description = "ARN of the Payment Service Lambda"
  value       = aws_lambda_function.payment_service.arn
}

output "notification_lambda_arn" {
  description = "ARN of the Notification Service Lambda"
  value       = aws_lambda_function.notification_service.arn
}

output "analytics_lambda_arn" {
  description = "ARN of the Analytics Service Lambda"
  value       = aws_lambda_function.analytics_service.arn
}

# ==============================================================================
# CloudWatch Observability Outputs
# ==============================================================================
output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch Observability Dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}
