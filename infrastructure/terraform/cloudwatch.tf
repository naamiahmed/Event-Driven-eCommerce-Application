# ==============================================================================
# CloudWatch Log Groups with Automatic Retention (Prevents infinite log costs)
# ==============================================================================

resource "aws_cloudwatch_log_group" "order_service_logs" {
  name              = "/aws/lambda/${local.name_prefix}-order-service"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "payment_service_logs" {
  name              = "/aws/lambda/${local.name_prefix}-payment-service"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "notification_service_logs" {
  name              = "/aws/lambda/${local.name_prefix}-notification-service"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "analytics_service_logs" {
  name              = "/aws/lambda/${local.name_prefix}-analytics-service"
  retention_in_days = 14
  tags              = local.common_tags
}

# ==============================================================================
# CloudWatch Metric Alarms for Dead Letter Queues (DLQs)
# ==============================================================================

resource "aws_cloudwatch_metric_alarm" "payment_dlq_alarm" {
  alarm_name          = "${local.name_prefix}-payment-dlq-messages-visible"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Triggered when any failed payment message enters the Payment Dead Letter Queue"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.payment_dlq.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "notification_dlq_alarm" {
  alarm_name          = "${local.name_prefix}-notification-dlq-messages-visible"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Triggered when any failed notification message enters the Notification Dead Letter Queue"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.notification_dlq.name
  }

  tags = local.common_tags
}

# ==============================================================================
# CloudWatch Observability Dashboard
# ==============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-observability"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.order_service.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.payment_service.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.notification_service.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.analytics_service.function_name]
          ]
          period = 300
          stat   = "Sum"
          region = local.region
          title  = "Lambda Invocations by Service"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.order_service.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.payment_service.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.notification_service.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.analytics_service.function_name]
          ]
          period = 300
          stat   = "Sum"
          region = local.region
          title  = "Lambda Errors by Service"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.payment_queue.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.notification_queue.name]
          ]
          period = 60
          stat   = "Average"
          region = local.region
          title  = "Active Queue Message Backlog"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.payment_dlq.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.notification_dlq.name]
          ]
          period = 60
          stat   = "Maximum"
          region = local.region
          title  = "Dead Letter Queue (DLQ) Poison Messages"
        }
      }
    ]
  })
}
