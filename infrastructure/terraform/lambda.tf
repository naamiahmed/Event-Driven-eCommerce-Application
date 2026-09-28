# ==============================================================================
# Packaging Lambda Artifacts
# ==============================================================================

data "archive_file" "order_service_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../services/order-service"
  output_path = "${path.module}/.build/order-service.zip"
  excludes    = ["tests", "README.md", "node_modules", "package-lock.json"]
}

data "archive_file" "payment_service_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../services/payment-service"
  output_path = "${path.module}/.build/payment-service.zip"
  excludes    = ["tests", "README.md", "node_modules", "package-lock.json"]
}

data "archive_file" "notification_service_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../services/notification-service"
  output_path = "${path.module}/.build/notification-service.zip"
  excludes    = ["tests", "README.md", "node_modules", "package-lock.json"]
}

data "archive_file" "analytics_service_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../services/analytics-service"
  output_path = "${path.module}/.build/analytics-service.zip"
  excludes    = ["tests", "README.md", "node_modules", "package-lock.json"]
}

# ==============================================================================
# 1. Order Service Lambda (Synchronous Ingestion)
# ==============================================================================

resource "aws_lambda_function" "order_service" {
  function_name    = "${local.name_prefix}-order-service"
  description      = "Validates and persists orders, then publishes OrderCreated events"
  role             = aws_iam_role.order_service_role.arn
  handler          = "src/handler.handler"
  runtime          = var.lambda_runtime
  filename         = data.archive_file.order_service_zip.output_path
  source_code_hash = data.archive_file.order_service_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      ORDERS_TABLE_NAME = aws_dynamodb_table.orders.name
      EVENT_BUS_NAME    = aws_cloudwatch_event_bus.main.name
      NODE_ENV          = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.order_service_logs
  ]

  tags = merge(local.common_tags, {
    Service = "OrderService"
  })
}

# ==============================================================================
# 2. Payment Service Lambda (SQS Consumer)
# ==============================================================================

resource "aws_lambda_function" "payment_service" {
  function_name    = "${local.name_prefix}-payment-service"
  description      = "Asynchronously processes payments triggered from Payment SQS"
  role             = aws_iam_role.payment_service_role.arn
  handler          = "src/handler.handler"
  runtime          = var.lambda_runtime
  filename         = data.archive_file.payment_service_zip.output_path
  source_code_hash = data.archive_file.payment_service_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      PAYMENT_FAILURE_MODE = var.payment_failure_mode
      ORDERS_TABLE_NAME    = aws_dynamodb_table.orders.name
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.payment_service_logs
  ]

  tags = merge(local.common_tags, {
    Service = "PaymentService"
  })
}

# Event Source Mapping: Payment SQS -> Payment Lambda
resource "aws_lambda_event_source_mapping" "payment_sqs_mapping" {
  event_source_arn = aws_sqs_queue.payment_queue.arn
  function_name    = aws_lambda_function.payment_service.arn
  batch_size       = 10
  enabled          = true
}

# ==============================================================================
# 3. Notification Service Lambda (SQS Consumer)
# ==============================================================================

resource "aws_lambda_function" "notification_service" {
  function_name    = "${local.name_prefix}-notification-service"
  description      = "Asynchronously sends customer notifications triggered from Notification SQS"
  role             = aws_iam_role.notification_service_role.arn
  handler          = "src/handler.handler"
  runtime          = var.lambda_runtime
  filename         = data.archive_file.notification_service_zip.output_path
  source_code_hash = data.archive_file.notification_service_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      NOTIFICATION_FAILURE_MODE = var.notification_failure_mode
      NODE_ENV                  = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.notification_service_logs
  ]

  tags = merge(local.common_tags, {
    Service = "NotificationService"
  })
}

# Event Source Mapping: Notification SQS -> Notification Lambda
resource "aws_lambda_event_source_mapping" "notification_sqs_mapping" {
  event_source_arn = aws_sqs_queue.notification_queue.arn
  function_name    = aws_lambda_function.notification_service.arn
  batch_size       = 10
  enabled          = true
}

# ==============================================================================
# 4. Analytics Service Lambda (Direct EventBridge Invocation)
# ==============================================================================

resource "aws_lambda_function" "analytics_service" {
  function_name    = "${local.name_prefix}-analytics-service"
  description      = "Consumes OrderCreated events directly via EventBridge fan-out for telemetry"
  role             = aws_iam_role.analytics_service_role.arn
  handler          = "src/handler.handler"
  runtime          = var.lambda_runtime
  filename         = data.archive_file.analytics_service_zip.output_path
  source_code_hash = data.archive_file.analytics_service_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      NODE_ENV = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.analytics_service_logs
  ]

  tags = merge(local.common_tags, {
    Service = "AnalyticsService"
  })
}
