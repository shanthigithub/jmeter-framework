# 🚀 Quick First Test Guide

**Goal:** Get your first JMeter test running in ~15-20 minutes

---

## Prerequisites Check

Before starting, ensure you have:
- ✅ AWS infrastructure deployed (you have this!)
- ⬜ Docker Desktop installed and running
- ⬜ A simple JMeter test script (.jmx file)

---

## Step 1: Build and Push Docker Image (~10 min)

This is **REQUIRED** - AWS Batch needs the JMeter Docker image.

```bash
# Navigate to docker directory
cd ~/OneDrive\ -\ Thomson\ Reuters\ Incorporated/Documents/jmeter-batch-framework/docker

# Check if Docker is running
docker --version

# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 623035187488.dkr.ecr.us-east-1.amazonaws.com

# Build Docker image (takes ~5-8 minutes)
docker build -t jmeter-batch .

# Tag image
docker tag jmeter-batch:latest 623035187488.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest

# Push to ECR (takes ~2-3 minutes)
docker push 623035187488.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest
```

**Expected output:**
```
The push refers to repository [623035187488.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch]
latest: digest: sha256:... size: ...
```

---

## Step 2: Create a Simple Test Configuration (~2 min)

### Option A: Use Existing JMeter Script

If you have a .jmx file ready:

**Create simple-test-suite.json:**
```json
{
  "testSuite": [
    {
      "testId": "my-first-test",
      "testScript": "tests/my-test.jmx",
      "numOfContainers": 1,
      "threads": 10,
      "duration": "2m",
      "execute": true
    }
  ]
}
```

**Upload files to S3:**
```bash
# Upload test suite
aws s3 cp simple-test-suite.json s3://jmeter-batch-config/simple-test-suite.json

# Upload your JMeter script
aws s3 cp your-test.jmx s3://jmeter-batch-config/tests/my-test.jmx
```

### Option B: Use Example Script (FASTEST)

The framework includes example files, but you need actual .jmx files. 

**Do you have a JMeter test script (.jmx file)?**
- **YES** → Use Option A above
- **NO** → You need to create one using JMeter GUI first

---

## Step 3: Run Your First Test (~5 min to complete)

### Option A: AWS Console (Recommended for First Test)

1. Open Step Functions: https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines

2. Click on **`jmeter-batch-workflow`**

3. Click **"Start execution"** button

4. Enter execution input:
```json
{
  "testSuiteKey": "simple-test-suite.json"
}
```

5. Click **"Start execution"**

6. **Monitor progress:**
   - Watch the visual workflow
   - Green = success, Red = failure
   - Typical execution: 5-10 minutes for simple test

### Option B: AWS CLI

```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:623035187488:stateMachine:jmeter-batch-workflow \
  --input '{"testSuiteKey": "simple-test-suite.json"}' \
  --region us-east-1
```

---

## Step 4: Check Results

### View Results in S3

```bash
# List result files
aws s3 ls s3://jmeter-batch-results/ --recursive

# Download results
aws s3 cp s3://jmeter-batch-results/[execution-id]/ ./results/ --recursive
```

### View Logs in CloudWatch

1. Open CloudWatch: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Fbatch$252Fjmeter

2. Find your test execution logs

3. View JMeter output and any errors

---

## Troubleshooting

### Error: "Image does not exist"
**Cause:** Docker image not pushed to ECR  
**Fix:** Complete Step 1 above

### Error: "Test script not found"
**Cause:** .jmx file not uploaded to S3  
**Fix:** Check S3 path matches test-suite.json

### Error: "Access Denied"
**Cause:** IAM permissions issue  
**Fix:** Verify AWS credentials are configured correctly

### Test runs but no results
**Check:**
1. CloudWatch Logs for JMeter errors
2. S3 results bucket for partial results
3. Step Functions execution history

---

## Quick Checklist

Before running your first test, verify:

- [ ] Docker installed and running
- [ ] Docker image built and pushed to ECR
- [ ] JMeter test script (.jmx) exists
- [ ] Test suite JSON created
- [ ] Files uploaded to S3 config bucket
- [ ] Step Functions execution started

---

## What Happens During Test Execution?

1. **ReadConfig** (5 sec) - Reads test-suite.json from S3
2. **FilterTests** (1 sec) - Identifies tests with execute=true
3. **PartitionData** (10 sec) - Splits data files if present
4. **SubmitJobs** (30 sec) - Submits jobs to AWS Batch
5. **Wait** (varies) - Batch provisions Spot instances (~2-5 min)
6. **CheckJobs** (repeat) - Monitors job status every 60 sec
7. **Jobs Run** (duration) - JMeter executes tests
8. **MergeResults** (30 sec) - Combines results from all containers
9. **Success** - Results available in S3

**Total time for 2-minute test:** ~10-12 minutes (including Spot provisioning)

---

## Next Steps After First Test

Once your first test succeeds:

1. **Scale up:** Increase numOfContainers for distributed load
2. **Add data:** Use CSV files for parameterized testing
3. **Multiple tests:** Add more tests to test suite
4. **Automate:** Set up GitHub Actions for CI/CD
5. **Monitor:** Set up CloudWatch dashboards

---

## Need Help?

**Common Questions:**

**Q: Do I need to rebuild Docker image every time?**  
A: No, only when you update JMeter version or plugins

**Q: Can I test against localhost?**  
A: No, AWS Batch can't reach your local machine. Use public endpoints or VPN.

**Q: How much will this cost?**  
A: A 2-minute test with 1 container: ~$0.01-0.02 (Spot pricing)

**Q: Can I use my existing JMeter scripts?**  
A: Yes! Just upload them to S3 and reference in test-suite.json

---

**Ready to start? Begin with Step 1: Build Docker Image!**
