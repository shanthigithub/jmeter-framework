# Troubleshooting Guide

## Common Issues and Solutions

### 1. "Invalid bucket name" Error in GitHub Actions

**Error Message:**
```
upload failed: ./test-suite.json to s3:///test-suites/...
Parameter validation failed:
Invalid bucket name "": Bucket name must match the regex...
```

**Root Cause:** The AWS infrastructure (CloudFormation stack) hasn't been deployed yet.

**Solution:**

#### Step 1: Deploy Infrastructure First

You must deploy the AWS infrastructure before running tests:

```bash
cd iac
npm install
cdk bootstrap  # One-time setup
cdk deploy --all
```

This creates:
- S3 buckets (config and results)
- ECR repository
- AWS Batch compute environment
- Step Functions state machine
- IAM roles and policies

**Deployment takes:** ~10-15 minutes

#### Step 2: Verify Stack Deployment

```bash
aws cloudformation describe-stacks --stack-name JMeterBatchStack
```

Expected outputs:
- `ConfigBucketName`
- `ResultsBucketName`
- `StateMachineArn`
- `BatchJobQueueArn`

#### Step 3: Then Run Tests

After infrastructure is deployed, you can run tests via GitHub Actions.

---

### 2. Docker Build Takes 4 Minutes

**Not an Error!** This is expected behavior.

- **Happens:** Only during initial image build
- **Frequency:** Once, or when Dockerfile/JMeter version changes
- **Does NOT happen:** For every test execution

See [DOCKER_BUILD_OPTIMIZATION.md](./DOCKER_BUILD_OPTIMIZATION.md) for details.

---

### 3. GitHub Actions "AWS_ROLE_ARN Secret Not Found"

**Error:** Repository secret `AWS_ROLE_ARN` not found

**Solution:**

1. **Deploy infrastructure first** (creates the IAM role)

2. **Get the role ARN:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name JMeterBatchStack \
     --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
     --output text
   ```

3. **Add to GitHub Secrets:**
   - Go to repository → Settings → Secrets and variables → Actions
   - Create new secret: `AWS_ROLE_ARN`
   - Paste the role ARN from step 2

---

### 4. Test Files Not Found in S3

**Error:** JMeter test file not found

**Solution:**

Tests and data files must be uploaded to S3 **before** running:

```bash
# Get bucket name from stack
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

# Upload test files
aws s3 cp tests/your-test.jmx s3://$CONFIG_BUCKET/tests/
aws s3 cp data/your-data.csv s3://$CONFIG_BUCKET/data/

# Upload test configuration
aws s3 cp config/your-config.json s3://$CONFIG_BUCKET/
```

Or use the GitHub Actions workflow which automatically uploads config files.

---

### 5. Permission Denied / Access Denied Errors

**Possible Causes:**

1. **IAM Role Trust Policy Not Updated**
   - Solution: See [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)
   - Update trust policy with your GitHub repo details

2. **Missing IAM Permissions**
   - The GitHub Actions role needs permissions for:
     - CloudFormation (read stacks)
     - S3 (upload/download)
     - Step Functions (start execution)
     - Logs (view execution logs)

3. **ECR Repository Permissions**
   - Docker push requires ECR permissions
   - Verify role has `ecr:PutImage`, `ecr:InitiateLayerUpload`, etc.

**Solution:**
```bash
# Check current role permissions
aws iam get-role-policy \
  --role-name JMeterBatchStack-GitHubActionsRole \
  --policy-name GitHubActionsPolicy
```

---

### 6. Step Functions Execution Fails

**Check execution logs:**

```bash
# Get execution ARN from GitHub Actions output
EXECUTION_ARN="arn:aws:states:us-east-1:123456789012:execution:..."

# Describe execution
aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN

# Get execution history
aws stepfunctions get-execution-history --execution-arn $EXECUTION_ARN
```

**Common issues:**

1. **Batch job fails to start**
   - Check compute environment is ENABLED
   - Verify job queue is active
   - Check ECR image exists

2. **Container fails**
   - View CloudWatch logs
   - Check test file paths
   - Verify S3 permissions

3. **Timeout**
   - Increase timeout in state machine definition
   - Check test duration settings

---

### 7. Cannot Find Test Results

**Results location:**

```bash
# Get results bucket
RESULTS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ResultsBucketName`].OutputValue' \
  --output text)

# List results
aws s3 ls s3://$RESULTS_BUCKET/

# Download specific test results
aws s3 sync s3://$RESULTS_BUCKET/test-20260425-120000-1/ ./results/
```

**Results structure:**
```
s3://results-bucket/
  └── test-YYYYMMDD-HHMMSS-{run-number}/
      ├── test-name-results.jtl
      ├── test-name-results.log
      └── test-name-summary.json
```

---

### 8. CDK Deploy Fails

**"Stack already exists" error:**
```bash
# Update existing stack
cdk deploy --all

# Force new deployment
cdk destroy
cdk deploy --all
```

**Bootstrap required:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**Dependency errors:**
```bash
cd iac
rm -rf node_modules package-lock.json
npm install
```

---

### 9. Docker Image Not Found

**Error:** Repository does not exist or no image found

**Cause:** Image hasn't been built and pushed to ECR

**Solution:**

Option 1: Run deploy workflow (builds and pushes automatically)
```yaml
# .github/workflows/deploy.yml
```

Option 2: Manual build and push
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t jmeter-batch:latest -f docker/Dockerfile docker/

# Tag
docker tag jmeter-batch:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest

# Push
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest
```

---

## Deployment Checklist

Use this checklist to ensure proper setup:

- [ ] AWS CLI configured with credentials
- [ ] CDK CLI installed (`npm install -g aws-cdk`)
- [ ] CDK bootstrapped (`cdk bootstrap`)
- [ ] Infrastructure deployed (`cdk deploy --all`)
- [ ] Stack outputs verified
- [ ] GitHub Actions role ARN added to secrets
- [ ] GitHub Actions trust policy updated
- [ ] Docker image built and pushed to ECR
- [ ] Test files uploaded to S3
- [ ] Test configuration uploaded to S3

---

## Getting Help

### View CloudFormation Stack

```bash
aws cloudformation describe-stacks --stack-name JMeterBatchStack
```

### View Stack Resources

```bash
aws cloudformation list-stack-resources --stack-name JMeterBatchStack
```

### View CloudWatch Logs

```bash
# Step Functions logs
aws logs tail /aws/stepfunctions/JMeterBatchStateMachine --follow

# Batch job logs
aws logs tail /aws/batch/job --follow
```

### Useful AWS Console Links

After deployment, access these:

1. **CloudFormation Stack:**
   `https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks`

2. **S3 Buckets:**
   `https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1`

3. **ECR Repository:**
   `https://console.aws.amazon.com/ecr/repositories?region=us-east-1`

4. **Step Functions:**
   `https://console.aws.amazon.com/states/home?region=us-east-1`

5. **AWS Batch:**
   `https://console.aws.amazon.com/batch/home?region=us-east-1`

6. **CloudWatch Logs:**
   `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:`

---

## Quick Start (Correct Order)

```bash
# 1. Clone repository
git clone https://github.com/your-org/jmeter-framework
cd jmeter-framework

# 2. Deploy infrastructure
cd iac
npm install
cdk bootstrap
cdk deploy --all
# ⏰ Wait ~10-15 minutes

# 3. Get stack outputs
aws cloudformation describe-stacks --stack-name JMeterBatchStack

# 4. Add GitHub secret
# Copy GitHubActionsRoleArn output
# Add to GitHub: Settings → Secrets → AWS_ROLE_ARN

# 5. Update trust policy (one-time)
# See GITHUB_ACTIONS_SETUP.md

# 6. Push code to trigger deploy workflow
git push origin main
# This builds Docker image automatically

# 7. Upload test files
aws s3 cp tests/your-test.jmx s3://CONFIG_BUCKET/tests/
aws s3 cp config/your-config.json s3://CONFIG_BUCKET/

# 8. Run test via GitHub Actions
# Use "Run JMeter Test" workflow
```

---

## Clean Up Resources

To avoid charges, delete resources when done:

```bash
# Delete CDK stack
cd iac
cdk destroy --all

# Empty S3 buckets first (if destroy fails)
aws s3 rm s3://CONFIG_BUCKET --recursive
aws s3 rm s3://RESULTS_BUCKET --recursive

# Delete ECR images
aws ecr batch-delete-image \
  --repository-name jmeter-batch \
  --image-ids imageTag=latest