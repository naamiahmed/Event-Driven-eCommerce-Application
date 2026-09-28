# Custom EventBridge Event Bus
resource "aws_cloudwatch_event_bus" "main" {
  name = "${local.name_prefix}-bus"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bus"
  })
}

# ==============================================================================
# Rule 1: Route OrderCreated -> Payment SQS Queue
# ==============================================================================
resource "aws_cloudwatch_event_rule" "payment_rule" {
  name           = "${local.name_prefix}-payment-rule"
  description    = "Routes OrderCreated events to Payment SQS queue"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    source        = ["ecommerce.orders"]
    "detail-type" = ["OrderCreated"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "payment_target" {
  rule           = aws_cloudwatch_event_rule.payment_rule.name
  event_bus_name = aws_cloudwatch_event_bus.main.name
  target_id      = "PaymentQueueTarget"
  arn            = aws_sqs_queue.payment_queue.arn
}

# ==============================================================================
# Rule 2: Route OrderCreated -> Notification SQS Queue
# ==============================================================================
resource "aws_cloudwatch_event_rule" "notification_rule" {
  name           = "${local.name_prefix}-notification-rule"
  description    = "Routes OrderCreated events to Notification SQS queue"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    source        = ["ecommerce.orders"]
    "detail-type" = ["OrderCreated"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "notification_target" {
  rule           = aws_cloudwatch_event_rule.notification_rule.name
  event_bus_name = aws_cloudwatch_event_bus.main.name
  target_id      = "NotificationQueueTarget"
  arn            = aws_sqs_queue.notification_queue.arn
}

# ==============================================================================
# Rule 3: Direct Fan-Out Route OrderCreated -> Analytics Lambda
# ==============================================================================
resource "aws_cloudwatch_event_rule" "analytics_rule" {
  name           = "${local.name_prefix}-analytics-rule"
  description    = "Direct fan-out route for OrderCreated events to Analytics Lambda"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    source        = ["ecommerce.orders"]
    "detail-type" = ["OrderCreated"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "analytics_target" {
  rule           = aws_cloudwatch_event_rule.analytics_rule.name
  event_bus_name = aws_cloudwatch_event_bus.main.name
  target_id      = "AnalyticsLambdaTarget"
  arn            = aws_lambda_function.analytics_service.arn
}

# Grant EventBridge permission to invoke the Analytics Lambda function
resource "aws_lambda_permission" "allow_eventbridge_analytics" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_service.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.analytics_rule.arn
}
