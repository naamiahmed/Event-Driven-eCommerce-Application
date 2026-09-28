# Common Lambda Assume Role Policy Document
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ==============================================================================
# Order Service IAM Role & Least Privilege Policies
# ==============================================================================
resource "aws_iam_role" "order_service_role" {
  name               = "${local.name_prefix}-order-service-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "order_service_policy" {
  name        = "${local.name_prefix}-order-service-policy"
  description = "Least privilege permissions for Order Service (DynamoDB write, EventBridge emit, CloudWatch logging)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.order_service_logs.arn}:*"
      },
      {
        Sid    = "DynamoDBOrderAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.orders.arn
      },
      {
        Sid      = "EventBridgeEmit"
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = aws_cloudwatch_event_bus.main.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "order_service_attach" {
  role       = aws_iam_role.order_service_role.name
  policy_arn = aws_iam_policy.order_service_policy.arn
}

# ==============================================================================
# Payment Service IAM Role & Least Privilege Policies
# ==============================================================================
resource "aws_iam_role" "payment_service_role" {
  name               = "${local.name_prefix}-payment-service-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "payment_service_policy" {
  name        = "${local.name_prefix}-payment-service-policy"
  description = "Least privilege permissions for Payment Service (SQS consumption, CloudWatch logging, DynamoDB update)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.payment_service_logs.arn}:*"
      },
      {
        Sid    = "SQSConsumption"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.payment_queue.arn
      },
      {
        Sid    = "DynamoDBStatusUpdate"
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.orders.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "payment_service_attach" {
  role       = aws_iam_role.payment_service_role.name
  policy_arn = aws_iam_policy.payment_service_policy.arn
}

# ==============================================================================
# Notification Service IAM Role & Least Privilege Policies
# ==============================================================================
resource "aws_iam_role" "notification_service_role" {
  name               = "${local.name_prefix}-notification-service-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "notification_service_policy" {
  name        = "${local.name_prefix}-notification-service-policy"
  description = "Least privilege permissions for Notification Service (SQS consumption, CloudWatch logging)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.notification_service_logs.arn}:*"
      },
      {
        Sid    = "SQSConsumption"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.notification_queue.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "notification_service_attach" {
  role       = aws_iam_role.notification_service_role.name
  policy_arn = aws_iam_policy.notification_service_policy.arn
}

# ==============================================================================
# Analytics Service IAM Role & Least Privilege Policies
# ==============================================================================
resource "aws_iam_role" "analytics_service_role" {
  name               = "${local.name_prefix}-analytics-service-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "analytics_service_policy" {
  name        = "${local.name_prefix}-analytics-service-policy"
  description = "Least privilege permissions for Analytics Service (CloudWatch logging)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogging"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.analytics_service_logs.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "analytics_service_attach" {
  role       = aws_iam_role.analytics_service_role.name
  policy_arn = aws_iam_policy.analytics_service_policy.arn
}
