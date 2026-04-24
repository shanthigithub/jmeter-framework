# JMeter Batch Framework - Usage Guide

Learn how to run performance tests using the modern JMeter framework.

## 🎯 Quick Start

### 1. Upload Test Files to S3
```bash
# Upload JMeter test plan
aws s3 cp my-test.jmx s3://jmeter-batch-config/tests/my-test.jmx

# Upload test data (CSV files)
aws s3 cp users.csv s3://jmeter-batch-config/data/users.csv
```

### 2. Create Test Configuration
```bash
cat > test-suite.json <<EOF
{
  "testSuite": [
    {
      "testId": "my-load-test",
      "testScript": "tests/my-test.jmx",
      "numOfContainers": 3,
      "threads": 100,
      "duration": "15m",
      "dataFiles": ["data/users.csv"],
      "execute": true
    }
  ]
}
EOF

# Upload configuration
aws s3 cp test-suite.json s3://jmeter-batch-config/test-suite.json
```

### 3. Start Test Execution
```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:ACCOUNT:stateMachine:jmeter-batch-workflow \
  --input '{"configKey": "test-suite.json"}' \
  --name "test-run-$(date +%Y%m%d-%H%M%S)"
```

### 4. Monitor Execution
```bash
# Get execution ARN from previous command
EXECUTION_ARN="arn:aws:states:..."

# Check status
aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN
```

### 5. Download Results
```bash
# List results
aws s3 ls s3://jmeter-batch-results/

# Download merged results
aws s3 cp s3://jmeter-batch-results/RUN-ID/TEST-ID/merged-results.jtl ./

# Download summary
aws s3 cp s3://jmeter-batch-results/RUN-ID/TEST-ID/summary.json ./
```

---

## 📋 Test Configuration Schema

### Complete Example
```json
{
  "testSuite": [
    {
      "testId": "api-load-test",
      "testScript": "tests/api-load.jmx",
      "numOfContainers": 5,
      "threads": 200,
      "duration": "30m",
      "dataFiles": [
        "data/users.csv",
        "data/products.csv"
      ],
      "execute": true,
      "jvmArgs": "-Xms1g -Xmx3g",
      "jmeterProperties": {
        "hostname": "api.example.com",
        "protocol": "https",
        "port": "443",
        "rampup": "120"
      }
    }
  ]
}
```

### Field Descriptions

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `testId` | ✅ | Unique test identifier | `"api-load-test"` |
| `testScript` | ✅ | S3 path to JMX file | `"tests/my-test.jmx"` |
| `numOfContainers` | ✅ | Number of parallel containers | `3` |
| `threads` | ✅ | Threads per container | `100` |
| `duration` | ✅ | Test duration | `"15m"`, `"1h"` |
| `dataFiles` | ❌ | CSV files for data | `["data/users.csv"]` |
| `execute` | ✅ | Whether to run this test | `true` or `false` |
| `jvmArgs` | ❌ | JVM arguments | `"-Xms512m -Xmx2g"` |
| `jmeterProperties` | ❌ | Custom JMeter properties | `{"key": "value"}` |

---

## 🔧 Common Test Scenarios

### Load Test (Steady State)
```json
{
  "testId": "load-test",
  "testScript": "tests/load.jmx",
  "numOfContainers": 3,
  "threads": 100,
  "duration": "30m",
  "execute": true
}
```
**Use case**: Test system under normal load
**Total load**: 300 concurrent users (3 containers × 100 threads)

### Stress Test (High Load)
```json
{
  "testId": "stress-test",
  "testScript": "tests/stress.jmx",
  "numOfContainers": 10,
  "threads": 200,
  "duration": "1h",
  "jvmArgs": "-Xms2g -Xmx4g",
  "execute": true
}
```
**Use case**: Find system breaking point
**Total load**: 2,000 concurrent users

### Spike Test (Sudden Load)
```json
{
  "testId": "spike-test",
  "testScript": "tests/spike.jmx",
  "numOfContainers": 5,
  "threads": 500,
  "duration": "5m",
  "execute": true
}
```
**Use case**: Test system resilience to sudden traffic spikes
**Total load**: 2,500 concurrent users for short duration

### Endurance Test (Long Duration)
```json
{
  "testId": "endurance-test",
  "testScript": "tests/endurance.jmx",
  "numOfContainers": 3,
  "threads": 50,
  "duration": "4h",
  "execute": true
}
```
**Use case**: Identify memory leaks and stability issues
**Total load**: 150 users for extended period

---

## 📊 Monitoring Test Execution

### Using AWS Console

#### Step Functions
1. Navigate to AWS Step Functions console
2. Find `jmeter-batch-workflow`
3. Click on running execution
4. View visual workflow progress
5. Check each step's input/output

#### CloudWatch Logs
1. Navigate to CloudWatch Logs
2. Log groups to monitor:
   - `/aws/batch/jmeter` - JMeter execution logs
   - `/aws/lambda/jmeter-batch-*` - Lambda function logs
3. Use CloudWatch Insights for queries

#### AWS Batch
1. Navigate to AWS Batch console
2. View job queue status
3. Check running jobs
4. View job logs

### Using AWS CLI

#### Check Execution Status
```bash
aws stepfunctions describe-execution \
  --execution-arn EXECUTION-ARN \
  --query 'status' \
  --output text
```

#### List Running Jobs
```bash
aws batch list-jobs \
  --job-queue jmeter-batch-queue \
  --job-status RUNNING
```

#### Get Job Logs
```bash
# Get log stream name
aws batch describe-jobs --jobs JOB-ID \
  --query 'jobs[0].container.logStreamName' \
  --output text

# View logs
aws logs tail /aws/batch/jmeter --follow
```

#### Monitor Lambda Executions
```bash
aws logs tail /aws/lambda/jmeter-batch-submit-jobs --follow
```

---

## 📈 Analyzing Results

### Summary JSON Format
```json
{
  "testId": "api-load-test",
  "runId": "execution-id",
  "totalSamples": 150000,
  "containers": 3,
  "totalRequests": 150000,
  "successfulRequests": 149500,
  "failedRequests": 500,
  "successRate": 99.67,
  "avgResponseTime": 245.32,
  "minResponseTime": 12,
  "maxResponseTime": 2450,
  "p50ResponseTime": 210,
  "p90ResponseTime": 450,
  "p95ResponseTime": 620,
  "p99ResponseTime": 1100,
  "timestamp": "2026-04-24T20:00:00Z"
}
```

### Key Metrics

**Success Rate**
- Target: >99%
- Warning: 95-99%
- Critical: <95%

**Response Time (P95)**
- Excellent: <500ms
- Good: 500-1000ms
- Poor: >1000ms

**Error Rate**
- Acceptable: <1%
- Warning: 1-5%
- Critical: >5%

### Visualize Results

#### Generate HTML Report
```bash
# Download merged results
aws s3 cp s3://jmeter-batch-results/RUN-ID/TEST-ID/merged-results.jtl results.jtl

# Generate HTML dashboard (requires JMeter locally)
jmeter -g results.jtl -o html-report/
```

#### Import to Datadog/Grafana
- Parse summary.json
- Send metrics to monitoring platform
- Create dashboards

---

## 🔄 Advanced Usage

### Running Multiple Tests Sequentially
```json
{
  "testSuite": [
    {
      "testId": "warmup",
      "testScript": "tests/warmup.jmx",
      "numOfContainers": 1,
      "threads": 10,
      "duration": "5m",
      "execute": true
    },
    {
      "testId": "main-load-test",
      "testScript": "tests/load.jmx",
      "numOfContainers": 5,
      "threads": 200,
      "duration": "30m",
      "execute": true
    }
  ]
}
```

### Using Custom JMeter Properties
```json
{
  "testId": "api-test",
  "testScript": "tests/api.jmx",
  "numOfContainers": 3,
  "threads": 100,
  "duration": "15m",
  "execute": true,
  "jmeterProperties": {
    "api.hostname": "api.example.com",
    "api.port": "443",
    "api.protocol": "https",
    "api.timeout": "30000",
    "rampup.time": "60"
  }
}
```

Access in JMX:
```
${__P(api.hostname)}
${__P(api.port)}
```

### Data-Driven Testing
```json
{
  "testId": "data-driven-test",
  "testScript": "tests/data-test.jmx",
  "numOfContainers": 5,
  "threads": 100,
  "duration": "30m",
  "dataFiles": [
    "data/users.csv",
    "data/products.csv",
    "data/scenarios.csv"
  ],
  "execute": true
}
```

Files are automatically partitioned across containers!

---

## 🛠️ Troubleshooting

### Test Doesn't Start
```bash
# Check Step Functions execution
aws stepfunctions describe-execution --execution-arn ARN

# Check Lambda logs
aws logs tail /aws/lambda/jmeter-batch-read-config --follow
```

### Jobs Stuck in PENDING
- Check EC2 Spot capacity in your region
- Verify compute environment is ENABLED
- Check if max vCPUs limit reached

### High Failure Rate
- Check JMeter logs in CloudWatch
- Verify target system is accessible
- Check for network/firewall issues
- Review JMeter script configuration

### Results Not Uploading
- Check S3 bucket permissions
- Verify IAM role for Batch jobs
- Check CloudWatch logs for upload errors

---

## 📚 Best Practices

### 1. Test Design
- Start with small tests, scale up gradually
- Use realistic test data
- Include proper think times
- Monitor both load generators and target system

### 2. Resource Allocation
- Use 2-4 vCPUs per container
- Allocate 2-4 GB RAM per container
- Don't exceed 50-100 threads per vCPU

### 3. Duration
- Warmup: 5-10 minutes
- Load test: 30-60 minutes
- Stress test: 1-2 hours
- Endurance: 4-8 hours

### 4. Cost Optimization
- Use Spot instances (default)
- Run tests during off-peak hours
- Clean up old results regularly
- Scale down when not testing

---

## 🔐 Security Best Practices

- Store sensitive data in AWS Secrets Manager
- Use IAM roles, not access keys
- Enable S3 encryption
- Restrict S3 bucket access
- Review CloudWatch Logs regularly

---

## 📞 Support

### Common Issues
1. Check [Troubleshooting](#troubleshooting) section
2. Review CloudWatch Logs
3. Verify IAM permissions
4. Check AWS service quotas

### Resources
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [README.md](../README.md) - Architecture overview
- AWS Batch documentation
- JMeter documentation

---

## ✅ Checklist

Before running tests:
- [ ] JMeter test plans uploaded to S3
- [ ] Test data files uploaded (if needed)
- [ ] Test configuration created and validated
- [ ] Target system is ready and accessible
- [ ] Monitoring is configured
- [ ] Baseline metrics captured

After test completion:
- [ ] Results downloaded from S3
- [ ] Summary metrics reviewed
- [ ] Logs checked for errors
- [ ] Results compared with baseline
- [ ] Report generated and shared
