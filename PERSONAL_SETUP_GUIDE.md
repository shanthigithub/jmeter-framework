# Personal Setup Guide - JMeter Batch Framework

Complete guide to test this framework in your **personal GitHub and AWS accounts** before deploying to office infrastructure.

---

## 🎯 Overview

This guide will help you:
1. Set up the framework in your personal GitHub account
2. Deploy to your personal AWS account
3. Test thoroughly
4. Migrate to office AWS later (when ready)

---

## 📋 Prerequisites

### Personal Accounts Needed
- ✅ **Personal GitHub account** (not office account)
- ✅ **Personal AWS account** (not office account)
- ✅ **Local machine** with:
  - Git installed
  - AWS CLI v2+ installed
  - Node.js 20+ installed
  - Docker installed

---

## 🚀 Step 1: Create Personal GitHub Repository

### 1.1 Create New Repository on GitHub
```bash
# Go to: https://github.com/new
# Repository name: jmeter-batch-framework
# Description: Modern serverless JMeter framework on AWS
# Visibility: Private (recommended for testing)
# Don't initialize with README (we have our files)
```

### 1.2 Initialize and Push Code
```bash
# Navigate to the framework directory
cd jmeter-batch-framework

# Initialize git
git init

# Add remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/jmeter-batch-framework.git

# Create .gitignore
cat > .gitignore << 'EOF'
# CDK
iac/node_modules/
iac/cdk.out/
iac/.env
iac/*.js
iac/*.d.ts
iac/tsconfig.tsbuildinfo

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
*.tmp
.temp/

# AWS
.aws/
*.pem
*.key

# Docker
.dockerignore.local

# Python
__pycache__/
*.pyc
*.pyo
.pytest_cache/

# Personal configs (DON'T COMMIT)
personal-config.json
*.secret
EOF

# Add all files
git add .

# Commit
git commit -m "Initial commit: Modern serverless JMeter framework"

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🔐 Step 2: Configure Personal AWS Account

### 2.1 Install and Configure AWS CLI
```bash
# Check if AWS CLI is installed
aws --version

# Configure with your PERSONAL AWS credentials
aws configure --profile personal
# AWS Access Key ID: [Your personal key]
# AWS Secret Access Key: [Your personal secret]
# Default region: us-east-1 (or your preferred region)
# Default output format: json

# Verify configuration
aws sts get-caller-identity --profile personal
```

### 2.2 Set Environment Variable
```bash
# For current session (Linux/Mac)
export AWS_PROFILE=personal

# For current session (Windows PowerShell)
$env:AWS_PROFILE="personal"

# Or add to your shell profile for permanent use
# ~/.bashrc or ~/.zshrc (Linux/Mac):
echo 'export AWS_PROFILE=personal' >> ~/.bashrc
source ~/.bashrc
```

### 2.3 Bootstrap CDK (First Time Only)
```bash
cd iac

# Bootstrap CDK in your personal AWS account
npx cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1 --profile personal

# Replace YOUR-ACCOUNT-ID with your actual AWS account ID
# Get it with: aws sts get-caller-identity --profile personal --query Account --output text
```

---

## 🏗️ Step 3: Customize Configuration (Optional)

### 3.1 Update Bucket Names (Must be globally unique)
Edit `iac/environments/config.ts`:

```typescript
export const config = {
  dev: {
    // Add your initials or unique identifier
    configBucket: 'jmeter-batch-config-yourname-dev',
    resultsBucket: 'jmeter-batch-results-yourname-dev',
    
    // Rest stays the same
    region: 'us-east-1',
    // ...
  }
}
```

### 3.2 Update Stack Name (Optional)
Edit `iac/bin/app.ts`:

```typescript
new JMeterStack(app, 'JMeterBatchStack-Personal', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
});
```

---

## 🚢 Step 4: Deploy Infrastructure to Personal AWS

### 4.1 Install Dependencies
```bash
cd iac
npm install
```

### 4.2 Review What Will Be Created
```bash
# See CloudFormation template
npx cdk synth --profile personal

# See what changes will be made
npx cdk diff --profile personal
```

### 4.3 Deploy Stack
```bash
# Deploy to your personal AWS account
npx cdk deploy --profile personal

# Save outputs for later use
npx cdk deploy --profile personal --outputs-file outputs.json

# This will create:
# - 2 S3 buckets (config & results)
# - 1 ECR repository
# - 5 Lambda functions
# - 1 Step Functions state machine
# - 1 Batch compute environment
# - IAM roles and policies
```

**Expected Output:**
```
✅ JMeterBatchStack-Personal

Outputs:
JMeterBatchStack-Personal.ConfigBucketName = jmeter-batch-config-yourname-dev
JMeterBatchStack-Personal.ResultsBucketName = jmeter-batch-results-yourname-dev
JMeterBatchStack-Personal.RepositoryUri = 123456789012.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch
JMeterBatchStack-Personal.StateMachineArn = arn:aws:states:us-east-1:123456789012:stateMachine:jmeter-batch-workflow
```

### 4.4 Save Important Values
```bash
# Create a personal config file (NOT committed to git)
cat > personal-aws-config.sh << 'EOF'
#!/bin/bash
export CONFIG_BUCKET="jmeter-batch-config-yourname-dev"
export RESULTS_BUCKET="jmeter-batch-results-yourname-dev"
export REPOSITORY_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch"
export STATE_MACHINE_ARN="arn:aws:states:us-east-1:123456789012:stateMachine:jmeter-batch-workflow"
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="123456789012"
EOF

# Source it when needed
source personal-aws-config.sh
```

---

## 🐳 Step 5: Build and Push Docker Image

### 5.1 Login to ECR
```bash
cd ../docker

# Login to your personal ECR
aws ecr get-login-password --region us-east-1 --profile personal | \
  docker login --username AWS --password-stdin $REPOSITORY_URI
```

### 5.2 Build Docker Image
```bash
# Build the JMeter container
docker build -t jmeter-batch:latest .

# Tag for ECR
docker tag jmeter-batch:latest $REPOSITORY_URI:latest
docker tag jmeter-batch:latest $REPOSITORY_URI:v1.0.0
```

### 5.3 Push to ECR
```bash
# Push to your personal ECR
docker push $REPOSITORY_URI:latest
docker push $REPOSITORY_URI:v1.0.0

# Verify
aws ecr describe-images --repository-name jmeter-batch --profile personal
```

---

## 🧪 Step 6: Run Your First Test

### 6.1 Create a Simple Test Plan
```bash
# You can use JMeter GUI to create a simple test plan
# Or use a basic HTTP test plan
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
          <stringProp name="HTTPSampler.path">/delay/1</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
EOF

# Upload to S3
aws s3 cp simple-test.jmx s3://$CONFIG_BUCKET/tests/simple-test.jmx --profile personal
```

### 6.2 Create Test Configuration
```bash
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

# Upload configuration
aws s3 cp test-config.json s3://$CONFIG_BUCKET/test-config.json --profile personal
```

### 6.3 Start Test Execution
```bash
# Start the test via Step Functions
aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name "test-$(date +%Y%m%d-%H%M%S)" \
  --input '{"configKey": "test-config.json"}' \
  --profile personal \
  --query 'executionArn' \
  --output text

# Save the execution ARN that's returned
EXECUTION_ARN="arn:aws:states:..."
```

### 6.4 Monitor Execution
```bash
# Check status
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --profile personal \
  --query 'status' \
  --output text

# Watch it in AWS Console
# https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines/view/$STATE_MACHINE_ARN
```

### 6.5 Download Results
```bash
# Wait for completion (~5 minutes)
# Then download results
aws s3 ls s3://$RESULTS_BUCKET/ --profile personal --recursive

# Download merged results and summary
RUN_ID=$(aws s3 ls s3://$RESULTS_BUCKET/ --profile personal | tail -1 | awk '{print $2}' | tr -d '/')
aws s3 cp s3://$RESULTS_BUCKET/$RUN_ID/first-test/merged-results.jtl ./ --profile personal
aws s3 cp s3://$RESULTS_BUCKET/$RUN_ID/first-test/summary.json ./ --profile personal

# View summary
cat summary.json
```

---

## 🔧 Step 7: Setup GitHub Actions (Optional)

### 7.1 Configure AWS OIDC for GitHub Actions

1. **Create OIDC Provider** (if not exists):
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile personal
```

2. **Create IAM Role for GitHub Actions**:
```bash
# Create trust policy
cat > github-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR-ACCOUNT-ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR-GITHUB-USERNAME/jmeter-batch-framework:*"
        }
      }
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name GitHubActionsJMeterRole \
  --assume-role-policy-document file://github-trust-policy.json \
  --profile personal

# Attach necessary policies
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess \
  --profile personal

aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess \
  --profile personal

# Create custom policy for CDK
cat > cdk-deploy-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole",
        "iam:*",
        "s3:*",
        "lambda:*",
        "batch:*",
        "states:*",
        "logs:*",
        "ecr:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-name CDKDeployPolicy \
  --policy-document file://cdk-deploy-policy.json \
  --profile personal
```

### 7.2 Add GitHub Secret
```bash
# Get the role ARN
aws iam get-role \
  --role-name GitHubActionsJMeterRole \
  --query 'Role.Arn' \
  --output text \
  --profile personal

# Go to your GitHub repo:
# Settings → Secrets and variables → Actions → New repository secret
# Name: AWS_ROLE_ARN
# Value: arn:aws:iam::YOUR-ACCOUNT-ID:role/GitHubActionsJMeterRole
```

### 7.3 Test GitHub Actions
```bash
# Push changes to trigger workflow
git add .
git commit -m "Configure for personal AWS account"
git push origin main

# Watch the Actions tab in GitHub
```

---

## 📊 Step 8: Verify Everything Works

### Checklist
- [ ] Infrastructure deployed successfully
- [ ] Docker image pushed to ECR
- [ ] Simple test ran successfully
- [ ] Results downloaded from S3
- [ ] Summary JSON has correct metrics
- [ ] GitHub Actions working (if configured)
- [ ] CloudWatch Logs showing execution details

### View in AWS Console
1. **Step Functions**: https://console.aws.amazon.com/states/home
2. **AWS Batch**: https://console.aws.amazon.com/batch/home
3. **S3 Buckets**: https://console.aws.amazon.com/s3/
4. **Lambda Functions**: https://console.aws.amazon.com/lambda/
5. **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/

---

## 🔄 Step 9: Migration to Office AWS (Later)

When you're ready to deploy to office AWS:

### 9.1 Prepare Office Environment
```bash
# Configure office AWS credentials
aws configure --profile office
export AWS_PROFILE=office

# Bootstrap CDK for office account
cd iac
npx cdk bootstrap --profile office
```

### 9.2 Update Configuration
```typescript
// iac/environments/config.ts
export const config = {
  prod: {
    configBucket: 'jmeter-batch-config-office-prod',
    resultsBucket: 'jmeter-batch-results-office-prod',
    region: 'us-east-1', // or your office region
    // ... rest of config
  }
}
```

### 9.3 Deploy to Office
```bash
# Deploy to office AWS
npx cdk deploy --profile office

# Build and push Docker to office ECR
aws ecr get-login-password --profile office | docker login...
docker push OFFICE-ECR-URI:latest
```

### 9.4 Setup Office GitHub Actions
- Use office AWS account for GitHub OIDC
- Configure office secrets in GitHub
- Test deployment pipeline

---

## 💰 Cost Tracking (Personal Account)

### Monitor Your Costs
```bash
# Check AWS Batch costs
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-04-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE \
  --profile personal

# Set billing alerts in AWS Console
# Billing → Billing preferences → Receive Billing Alerts
```

### Expected Monthly Costs (Light Testing)
- **AWS Batch (Spot)**: $1-3
- **Lambda**: $0.10-0.50
- **S3**: $0.50-1
- **ECR**: $0.10
- **Step Functions**: $0.10
- **CloudWatch**: $0.50

**Total**: ~$2-5/month for testing

---

## 🧹 Cleanup (When Done Testing)

### Delete Everything
```bash
# Delete stack (removes all resources)
cd iac
npx cdk destroy --profile personal

# Empty and delete S3 buckets (if cdk destroy fails to