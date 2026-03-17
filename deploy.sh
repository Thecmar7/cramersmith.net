#!/bin/bash
set -euo pipefail

ECR_IMAGE="YOUR-ECR-URI:latest"
SERVICE_ARN="YOUR-APP-RUNNER-ARN"
REGION="us-west-2"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com

echo "==> Building image..."
docker build --platform linux/amd64 -t cramersmith-net .

echo "==> Pushing to ECR..."
docker tag cramersmith-net:latest $ECR_IMAGE
docker push $ECR_IMAGE

echo "==> Waiting for App Runner to pick up new image..."
for i in {1..20}; do
  STATUS=$(aws apprunner describe-service --region $REGION --service-arn $SERVICE_ARN --query 'Service.Status' --output text)
  [ "$STATUS" = "OPERATION_IN_PROGRESS" ] && break
  sleep 10
done

echo "==> Deploying..."
while true; do
  STATUS=$(aws apprunner describe-service --region $REGION --service-arn $SERVICE_ARN --query 'Service.Status' --output text)
  echo "    $(date +%H:%M:%S) $STATUS"
  [ "$STATUS" = "RUNNING" ] && break
  sleep 15
done

echo "==> Done! Site is live."
