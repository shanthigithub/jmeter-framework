#!/bin/bash
# Quick diagnosis script for fast test completion

echo "🔍 Diagnosing Fast Test Completion"
echo "===================================="
echo ""

# Get stack outputs
echo "📊 Getting Stack Outputs..."
STACK_NAME="JMeterBatchStack"

CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

STATE_MACHINE=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`StateMachineArn`].OutputValue' \
  --output text)

echo "Config Bucket: $CONFIG_BUCKET"
echo "State Machine: $STATE_MACHINE"
echo ""

# Check if JMX file exists
echo "📁 Checking if JMX file exists in S3..."
if aws s3 ls s3://$CONFIG_BUCKET/tests/DCP_API_May_v2.jmx > /dev/null 2>&1; then
    echo "✅ JMX file EXISTS: s3://$CONFIG_BUCKET/tests/DCP_API_May_v2.jmx"
else
    echo "❌ JMX file NOT FOUND: s3://$CONFIG_BUCKET/tests/DCP_API_May_v2.jmx"
    echo ""
    echo "🔧 Fix: Upload your JMX file:"
    echo "   aws s3 cp tests/DCP_API_May_v2.jmx s3://$CONFIG_BUCKET/tests/DCP_API_May_v2.jmx"
    echo ""
fi

# Check latest execution
echo "📋 Getting latest Step Functions execution..."
EXEC_ARN=$(aws stepfunctions list-executions \
  --state-machine-arn $STATE_MACHINE \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text)

if [ "$EXEC_ARN" = "None" ] || [ -z "$EXEC_ARN" ]; then
    echo "⚠️  No executions found"
    exit 0
fi

echo "Latest execution: $EXEC_ARN"
echo ""

# Get execution status
echo "⏱️  Execution Details..."
aws stepfunctions describe-execution \
  --execution-arn $EXEC_ARN \
  --query '{Status: status, StartDate: startDate, StopDate: stopDate}' \
  --output table

echo ""

# Get Lambda outputs to see what happened
echo "🔬 Analyzing Lambda Function Outputs..."
echo ""

aws stepfunctions get-execution-history \
  --execution-arn $EXEC_ARN \
  --query 'events[?type==`LambdaFunctionSucceeded`].{Step:previousEventId,Output:lambdaFunctionSucceededEventDetails.output}' \
  --output json > /tmp/exec-history.json

# Parse each step
echo "ReadConfig Output:"
jq '.[] | select(.Output | contains("configResult")) | .Output' /tmp/exec-history.json | head -20
echo ""

echo "ParseJMX Output:"
jq '.[] | select(.Output | contains("numOfContainers")) | .Output' /tmp/exec-history.json | head -20
echo ""

echo "SubmitJobs Output:"
SUBMIT_OUTPUT=$(jq -r '.[] | select(.Output | contains("totalJobs")) | .Output' /tmp/exec-history.json)
if [ ! -z "$SUBMIT_OUTPUT" ]; then
    echo "$SUBMIT_OUTPUT" | jq '.'
    TOTAL_JOBS=$(echo "$SUBMIT_OUTPUT" | jq -r '.totalJobs // 0')
    echo ""
    if [ "$TOTAL_JOBS" = "0" ]; then
        echo "❌ PROBLEM FOUND: SubmitJobs submitted 0 jobs!"
        echo "   This means numOfContainers was 0 or missing"
        echo ""
    fi
else
    echo "⚠️  No SubmitJobs output found"
    echo ""
fi

# Check CloudWatch Logs for JMX Parser
echo "📜 Checking JMX Parser Lambda Logs..."
aws logs tail /aws/lambda/jmeter-batch-jmx-parser \
  --since 1h \
  --format short \
  --filter-pattern "ERROR" 2>/dev/null || echo "No error logs found"

echo ""
echo "===================================="
echo "✅ Diagnosis Complete"
echo ""
echo "Next steps:"
echo "1. If JMX file is missing → Upload it to S3"
echo "2. If numOfContainers = 0 → Check JMX Parser logs for parsing errors"
echo "3. Run this to see full execution history:"
echo "   aws stepfunctions get-execution-history --execution-arn $EXEC_ARN"