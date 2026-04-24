# JMeter Batch Framework - Deployment Guide

Complete step-by-step guide to deploy the modern JMeter framework to your AWS account.

## 📋 Prerequisites

### Required Tools
- **AWS CLI** v2+ installed and configured
- **Node.js** 20+ and npm
- **Docker** (for building the JMeter image)
- **Git**
- **AWS CDK** v2.120+

### AWS Requirements
- AWS Account with administrative access
- AWS CLI configured with credentials
- Sufficient quotas for:
  - EC2 Spot instances (16 vCPUs recommended)
  - S3 buckets (2)
  - Lambda functions (5)
  - ECR repository (1)

### GitHub Requirements (for CI/CD)
- GitHub repository
- AWS OIDC provider configured
- GitHub secrets configured

---

## 🚀 Quick Start (5 Minutes)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd jmeter-batch-framework
```

### 2. Install Dependencies
```bash
cd iac
npm install
```

### 3. Configure AWS CDK
```bash
# Bootstrap CDK (first time only)
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Review what will be created
npx cdk synth
```

### 4. Deploy Infrastructure
```bash
npx cdk deploy

# Note the outputs - you'll need these:
# - ConfigBucketName
# - ResultsBucketName
# - RepositoryUri
# - StateMachineArn
```

### 5. Build and Push Docker Image
```bash
cd ../docker

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t REPOSITORY-URI:latest .
docker push REPOSITORY-URI:latest
```

### 6. Upload Test Configuration
```bash
# Upload example configuration
aws s3 cp ../examples/test-suite.json s3://CONFIG-BUCKET-NAME/test-suite.json

# Upload your JMeter test plans
aws s3 cp your-test.jmx s3://CONFIG-BUCKET-NAME/tests/your-test.jmx
```

### 7. Run Your First Test
```bash
# Start execution via AWS CLI
aws stepfunctions start-execution \
  --state-machine-arn STATE-MACHINE-ARN \
  --input '{"configKey": "test-suite.json"}'
```

---

## 📝 Detailed Deployment Steps

### Step 1: Prepare Your AWS Account

#### Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region: us-east-1
# Enter output format: json
```

#### Verify Credentials
```bash
aws sts get-caller-identity
```

#### Check Service Quotas
```bash
# Check EC2 Spot instance limits
aws service-quotas get-service-quota \
  --service-code ec2 \
  --quota-code L-34B43A08

# Should show at least 16 vCPUs available
```

---

### Step 2: Deploy Infrastructure with CDK

#### Review Configuration
Edit `iac/environments/config.ts` if needed:
- Bucket names (must be globally unique)
- Instance types
- Memory/CPU allocations
- Timeout values

#### Deploy Stack
```bash
cd iac

# Install dependencies
npm install

# Synthesize CloudFormation template
npx cdk synth

# Deploy (with approval prompts)
npx cdk deploy

# Or deploy without prompts
npx cdk deploy --require-approval never
```

#### Expected Output
```
✅ JMeterBatchStack

Outputs:
JMeterBatchStack.ConfigBucketName = jmeter-batch-config
JMeterBatchStack.ResultsBucketName = jmeter-batch-results
JMeterBatchStack.RepositoryUri = 123456789012.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch
JMeterBatchStack.StateMachineArn = arn:aws:states:us-east-1:123456789012:stateMachine:jmeter-batch-workflow
JMeterBatchStack.JobQueueName = jmeter-batch-queue
JMeterBatchStack.JobDefinitionArn = arn:aws:batch:...
```

#### Save Outputs
```bash
# Save outputs to file
npx cdk deploy --outputs-file outputs.json
```

---

### Step 3: Build and Deploy Docker Image

#### Build Image Locally
```bash
cd docker

# Build image
docker build -t jmeter-batch:latest .

# Test image locally (optional)
docker run --rm jmeter-batch:latest --version
```

#### Push to ECR
```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag jmeter-batch:latest \
  ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest

# Push image
docker push ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest
```

---

### Step 4: Setup GitHub Actions (Optional but Recommended)

The workflow is now configured to use **OIDC authentication** for enhanced security (no long-lived access keys).

#### Configure AWS OIDC Provider

1. Create OIDC provider in AWS:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Note:** If you get "EntityAlreadyExists" error, the provider already exists - skip to step 2.

2. Create IAM role trust policy file:
```bash
cat > github-actions-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT-ID:oidc-provider/token.actions.githubusercontent.com"
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

# Replace placeholders
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i "s/ACCOUNT-ID/$AWS_ACCOUNT_ID/g" github-actions-trust-policy.json
# Manually replace YOUR-GITHUB-USERNAME with your GitHub username

# Create the role
aws iam create-role \
  --role-name GitHubActionsJMeterRole \
  --assume-role-policy-document file://github-actions-trust-policy.json
```

3. Attach required policies to role:
```bash
# ECR access
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

# CloudFormation access
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

# Step Functions access
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess

# Additional permissions (S3, Lambda, Batch, etc.)
cat > github-actions-permissions.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "lambda:*",
        "batch:*",
        "ec2:*",
        "iam:*",
        "logs:*",
        "ssm:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-name GitHubActionsAdditionalPermissions \
  --policy-document file://github-actions-permissions.json
```

#### Add GitHub Secret

1. Get the role ARN:
```bash
aws iam get-role --role-name GitHubActionsJMeterRole --query Role.Arn --output text
```

2. Add to GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AWS_ROLE_ARN`
   - Value: The ARN from step 1

**Security Benefits:**
- ✅ No long-lived AWS access keys
- ✅ Temporary credentials (1-hour expiration)
- ✅ Cannot be leaked from GitHub
- ✅ Fine-grained repository access control

For detailed GitHub Actions setup, see [GITHUB_ACTIONS_SETUP.md](../GITHUB_ACTIONS_SETUP.md)

---

### Step 5: Verify Deployment

#### Check AWS Batch
```bash
# List compute environments
aws batch describe-compute-environments

# Check job queue
aws batch describe-job-queues --job-queues jmeter-batch-queue
```

#### Check Lambda Functions
```bash
# List functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `jmeter-batch`)].FunctionName'
```

#### Check Step Functions
```bash
# Get state machine details
aws stepfunctions describe-state-machine \
  --state-machine-arn STATE-MACHINE-ARN
```

---

## 🔧 Configuration

### Modify Instance Types
Edit `iac/environments/config.ts`:
```typescript
instanceTypes: [
  't3.medium',   // Default
  't3a.medium',  // AMD variant
  't3.large',    // Larger instances
]
```

### Adjust Scaling Limits
```typescript
compute: {
  minvCpus: 0,      // Minimum (scale to zero)
  maxvCpus: 32,     // Maximum (increase for more parallelism)
  desiredvCpus: 0,  // Starting point
}
```

### Change Regions
Update in multiple files:
- `iac/environments/config.ts` → `region`
- `.github/workflows/deploy.yml` → `AWS_REGION`
- CDK app → `env.region`

---

## 🧹 Cleanup

### Delete Stack
```bash
cd iac
npx cdk destroy
```

### Manual Cleanup (if needed)
```bash
# Empty S3 buckets
aws s3 rm s3://jmeter-batch-config --recursive
aws s3 rm s3://jmeter-batch-results --recursive

# Delete ECR images
aws ecr batch-delete-image \
  --repository-name jmeter-batch \
  --image-ids imageTag=latest
```

---

## 🐛 Troubleshooting

### CDK Bootstrap Issues
```bash
# Re-bootstrap CDK
npx cdk bootstrap aws://ACCOUNT-ID/REGION --force
```

### ECR Push Fails
```bash
# Verify ECR repository exists
aws ecr describe-repositories --repository-names jmeter-batch

# Re-authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com
```

### Insufficient Capacity
- Check EC2 Spot instance availability in your region
- Try different instance types (t3a, t3, t2)
- Increase `spotBidPercentage` to 100

### Lambda Timeout
- Increase timeout in `config.ts`
- Check CloudWatch Logs for specific errors

---

## 📊 Cost Estimation

### Monthly Costs (Typical Usage)
- **AWS Batch (Spot)**: ~$2-5/month (16 vCPUs, 10 hours)
- **Lambda**: ~$0.50/month (ARM64, 512MB, low usage)
- **S3**: ~$1/month (100GB storage, 1000 requests)
- **ECR**: ~$0.10/month (1 image)
- **Step Functions**: ~$0.50/month (100 executions)
- **CloudWatch Logs**: ~$0.50/month (7-day retention)

**Total: ~$5-10/month** for moderate usage

### Cost Optimization Tips
1. Use Spot instances (70% savings vs On-Demand)
2. Scale to zero when idle
3. Use ARM64 Lambda (20% cheaper)
4. Set S3 lifecycle policies
5. Limit CloudWatch log retention

---

## ✅ Next Steps

After deployment:
1. Read [USAGE.md](USAGE.md) for running tests
2. Upload your JMeter test plans to S3
3. Create test configurations
4. Run your first test
5. Monitor results in S3 and CloudWatch

---

## 🆘 Support

- Check CloudWatch Logs for detailed errors
- Review Step Functions execution history
- Verify IAM permissions
- Ensure buckets and resources exist

For issues, check the main [README.md](../README.md) for architecture details.