# ==============================================================================
# Payment SQS Queue and Dead Letter Queue (DLQ)
# ==============================================================================

# Dead Letter Queue for Payment Failures
resource "aws_sqs_queue" "payment_dlq" {
  name                      = "${local.name_prefix}-payment-dlq"
  message_retention_seconds = 1209600 # 14 days retention for troubleshooting

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-payment-dlq"
    Role = "DeadLetterQueue"
  })
}

# Main Queue for Payment Processing
resource "aws_sqs_queue" "payment_queue" {
  name                       = "${local.name_prefix}-payment-queue"
  visibility_timeout_seconds = 30     # Must exceed Payment Lambda timeout (10s)
  message_retention_seconds  = 345600 # 4 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-payment-queue"
  })
}

# Allow EventBridge to send messages to Payment Queue
resource "aws_sqs_queue_policy" "payment_queue_policy" {
  queue_url = aws_sqs_queue.payment_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeToSendToPaymentQueue"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.payment_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.payment_rule.arn
          }
        }
      }
    ]
  })
}

# ==============================================================================
# Notification SQS Queue and Dead Letter Queue (DLQ)
# ==============================================================================

# Dead Letter Queue for Notification Failures
resource "aws_sqs_queue" "notification_dlq" {
  name                      = "${local.name_prefix}-notification-dlq"
  message_retention_seconds = 1209600 # 14 days retention

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-notification-dlq"
    Role = "DeadLetterQueue"
  })
}

# Main Queue for Customer Notification Processing
resource "aws_sqs_queue" "notification_queue" {
  name                       = "${local.name_prefix}-notification-queue"
  visibility_timeout_seconds = 30     # Must exceed Notification Lambda timeout (10s)
  message_retention_seconds  = 345600 # 4 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-notification-queue"
  })
}

# Allow EventBridge to send messages to Notification Queue
resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeToSendToNotificationQueue"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.notification_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.notification_rule.arn
          }
        }
      }
    ]
  })
}
