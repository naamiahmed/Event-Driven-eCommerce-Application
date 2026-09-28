# ==============================================================================
# HTTP API Gateway (API Gateway v2)
# Low-latency, cost-effective, serverless REST API
# ==============================================================================

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Serverless Event-Driven E-Commerce Entrypoint"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type", "authorization"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 300
  }

  tags = local.common_tags
}

# Default Auto-Deploy Stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = local.common_tags
}

# Dedicated CloudWatch Log Group for API Gateway Access Logs
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = 14
  tags              = local.common_tags
}

# Integration with Order Service Lambda
resource "aws_apigatewayv2_integration" "order_service_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.order_service.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Route POST /orders
resource "aws_apigatewayv2_route" "create_order_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /orders"
  target    = "integrations/${aws_apigatewayv2_integration.order_service_integration.id}"
}

# Route GET /orders/{orderId}
resource "aws_apigatewayv2_route" "get_order_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /orders/{orderId}"
  target    = "integrations/${aws_apigatewayv2_integration.order_service_integration.id}"
}

# Grant API Gateway permission to invoke Order Service Lambda
resource "aws_lambda_permission" "allow_api_gateway_order_service" {
  statement_id  = "AllowAPIGatewayInvokeOrderService"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.order_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
