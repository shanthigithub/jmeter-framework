# Quick Start - Personal Testing Guide

## 🎯 Your Next Steps

Follow these steps to test the JMeter Batch Framework in your **personal AWS and GitHub accounts**.

---

## ✅ Prerequisites Check

Before starting, ensure you have:
- [ ] Personal GitHub account (separate from office)
- [ ] Personal AWS account (separate from office)
- [ ] AWS CLI v2+ installed
- [ ] Node.js 20+ installed
- [ ] Docker installed
- [ ] Git installed

---

## 📝 Step-by-Step Guide

### Step 1: Create GitHub Repository (5 minutes)
```bash
# 1. Go to https://github.com/new
# 2. Repository name: jmeter-batch-framework
# 3. Make it Private
# 4. Don't initialize with README

# Then on your local machine:
cd jmeter-batch-framework
git init
git remote add origin https://github.com/YOUR-USERNAME/jmeter-batch-framework.git
git add .
git commit -m "Initial commit: JMeter Batch Framework"
git branch -M main
git push -u origin main
```

### Step 2: Configure AWS CLI (2 minutes)
```bash
# Configure your personal AWS account
aws configure --profile personal

# Verify
aws sts get-caller-identity --profile personal
```

### Step 3: Deploy Infrastructure (10 minutes)
```bash
# Set AWS profile
export AWS_PROFILE=personal  # Linux/Mac
# OR
$env:AWS_PROFILE="personal"  # Windows PowerShell

# Navigate to iac folder
cd iac

# Install dependencies
npm install

# Bootstrap CDK (first time only)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$ACCOUNT_ID/us-east-1

# Deploy!
npx cdk deploy --outputs-file outputs.json

# ✅ Save the outputs - you'll need them!
```

**Expected Output:**
```
✅ JMeterBatchStack

Outputs:
- ConfigBucketName: jmeter-batch-config-xxxxx
- ResultsBucketName: jmeter-batch-results-xxxxx
- RepositoryUri: 123456.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch
- StateMachineArn: arn:aws:states:us-east-1:123456:stateMachine:...
```

### Step 4: Build & Push Docker Image (5 minutes)
```bash
cd ../docker

# Get values from outputs.json
REPO_URI=$(cat ../iac/outputs.json | grep RepositoryUri | cut -d'"' -f4)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $REPO_URI

# Build
docker build -t jmeter-batch:latest .

# Tag and push
docker tag jmeter-batch:latest $REPO_URI:latest
docker push $REPO_URI:latest

# ✅ Docker image is now in your ECR!
```

### Step 5: Run Your First Test (10 minutes)

#### 5.1 Create a Simple Test Plan
```bash
cd ..

# Create simple HTTP test
cat > simple-test.jmx << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Simple Test">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Users">
        <intProp name="ThreadGroup.num_threads">${__P(threads,10)}</intProp>
        <intProp name="ThreadGroup.ramp_time">10</intProp>
        <stringProp name="ThreadGroup.duration">${__P(duration,60)}</stringProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <intProp name="LoopController.loops">-1</intProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="HTTP Request">
          <stringProp name="HTTPSampler.domain">httpbin.org</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <stringProp name="HTTPSampler.path">/get</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
EOF
```

#### 5.2 Upload Test Files
```bash
# Get bucket name from outputs
CONFIG_BUCKET=$(cat iac/outputs.json | grep ConfigBucketName | cut -d'"' -f4)

# Upload test plan
aws s3 cp simple-test.jmx s3://$CONFIG_BUCKET/tests/simple-test.jmx

# Create test configuration
cat > test-config.json << EOF
{
  "testSuite": [
    {
      "testId": "first-test",
      "testScript": "tests/simple-test.jmx",
      "numOfContainers": 2,
      "threads": 10,
      "duration": "2m",
      "execute": true
    }
  ]
}
EOF

# Upload config
aws s3 cp test-config.json s3://$CONFIG_BUCKET/test-config.json
```

#### 5.3 Start Test Execution
```bash
# Get state machine ARN
STATE_MACHINE=$(cat iac/outputs.json | grep StateMachineArn | cut -d'"' -f4)

# Start execution
aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE \
  --name "test-$(date +%Y%m%d-%H%M%S)" \
  --input '{"configKey": "test-config.json"}' \
  --query 'executionArn' \
  --output text

# ✅ Save the execution ARN that's returned!
EXECUTION_ARN="arn:aws:states:us-east-1:123456:execution:..."
```

#### 5.4 Monitor Progress
```bash
# Check status (run this multiple times)
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query 'status' \
  --output text

# Or watch in AWS Console:
# https://console.aws.amazon.com/states/home?region=us-east-1
```

#### 5.5 Download Results
```bash
# After ~5 minutes, download results
RESULTS_BUCKET=$(cat iac/outputs.json | grep ResultsBucketName | cut -d'"' -f4)

# List results
aws s3 ls s3://$RESULTS_BUCKET/ --recursive

# Find your run ID and download
RUN_ID="<your-run-id>"
aws s3 cp s3://$RESULTS_BUCKET/$RUN_ID/first-test/summary.json ./

# View summary
cat summary.json
```

---

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ CDK deploy completes successfully
2. ✅ Docker image appears in ECR
3. ✅ Step Functions execution shows "SUCCEEDED"
4. ✅ S3 results bucket has your test results
5. ✅ summary.json shows metrics (success rate, response times)

---

## 📊 Expected Results

After your first test, you should see:
```json
{
  "testId": "first-test",
  "totalRequests": 120,
  "successRate": 100,
  "avgResponseTime": 250.5,
  "p95ResponseTime": 450,
  ...
}
```

---

## 🔍 Troubleshooting

### Issue: CDK Deploy Fails
```bash
# Check if CDK is bootstrapped
aws cloudformation describe-stacks --stack-name CDKToolkit

# If not found, bootstrap again
npx cdk bootstrap
```

### Issue: Docker Push Fails
```bash
# Re-authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $REPO_URI
```

### Issue: Step Functions Fails
```bash
# Check Lambda logs
aws logs tail /aws/lambda/jmeter-batch-read-config --follow

# Check execution details
aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN
```

### Issue: Jobs Stuck in PENDING
- Wait 2-3 minutes for EC2 Spot instances to provision
- Check AWS Batch console for compute environment status
- Verify region has Spot capacity

---

## 💰 Cost Tracking

### Monitor Your Spending
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

### Set Billing Alert
1. Go to AWS Console → Billing
2. Set alert for $10/month
3. You'll be notified if costs exceed threshold

**Expected costs for testing:** ~$2-5/month

---

## 🧹 Cleanup (When Done)

### Delete Everything
```bash
cd iac

# This removes ALL resources
npx cdk destroy

# If CDK destroy fails, manually:
# 1. Empty S3 buckets
aws s3 rm s3://$CONFIG_BUCKET --recursive
aws s3 rm s3://$RESULTS_BUCKET --recursive

# 2. Delete ECR images
aws ecr batch-delete-image \
  --repository-name jmeter-batch \
  --image-ids imageTag=latest

# 3. Try destroy again
npx cdk destroy
```

---

## 📚 Full Documentation

For detailed information, see:
- **[PERSONAL_SETUP_GUIDE.md](PERSONAL_SETUP_GUIDE.md)** - Complete personal setup
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Detailed deployment guide
- **[USAGE.md](docs/USAGE.md)** - How to use the framework
- **[FRAMEWORK_SUMMARY.md](FRAMEWORK_SUMMARY.md)** - Technical overview

---

## 🔄 Next: Migrate to Office AWS

Once you've validated everything works:
1. Follow Step 9 in [PERSONAL_SETUP_GUIDE.md](PERSONAL_SETUP_GUIDE.md)
2. Configure office AWS credentials
3. Deploy to office account
4. Setup office GitHub Actions
5. Train team on new framework

---

## 💡 Tips

1. **Keep personal and office separate**
   - Use `--profile personal` for all AWS commands
   - Use different bucket names
   - Keep GitHub repos separate

2. **Test incrementally**
   - Start with 1-2 containers
   - Short duration tests (2-5 minutes)
   - Increase gradually

3. **Monitor costs**
   - Check AWS Cost Explorer daily
   - Set up billing alerts
   - Use Spot instances (default)

4. **Save your outputs**
   - Keep outputs.json safe
   - Document your ARNs
   - Create a personal config file

---

## ✅ Checklist

- [ ] GitHub repo created (personal account)
- [ ] AWS CLI configured with personal profile
- [ ] CDK deployed successfully
- [ ] Docker image pushed to ECR
- [ ] First test completed
- [ ] Results downloaded and verified
- [ ] Costs monitored ($2-5/month expected)
- [ ] Ready to show to office team!

---

## 🆘 Need Help?

1. Check [PERSONAL_SETUP_GUIDE.md](PERSONAL_SETUP_GUIDE.md) for detailed steps
2. Review CloudWatch Logs in AWS Console
3. Check Step Functions execution history
4. Verify IAM permissions

**Estimated time to complete:** 30-45 minutes for first-time setup

🎉 **Good luck! You're about to have a modern, serverless JMeter framework!**