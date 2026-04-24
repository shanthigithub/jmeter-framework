# 🚀 GitHub Actions Setup Guide

**Goal:** Build Docker image using GitHub Actions (no local Docker needed!)

Your workflow is already configured - we just need to set up GitHub and trigger it.

---

## Step 1: Check GitHub Repository

**Do you have a GitHub repository for this project?**

### If YES - Skip to Step 2

### If NO - Create one:

```bash
# Initialize git (if not already done)
cd ~/OneDrive\ -\ Thomson\ Reuters\ Incorporated/Documents/jmeter-batch-framework
git init

# Create .gitignore
cat > .gitignore <<EOF
# Node
node_modules/
*.log
.npm

# CDK
cdk.out/
*.js
*.d.ts
!.eslintrc.cjs

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# AWS
.aws/
*.pem

# Build artifacts
dist/
build/
EOF

# Initial commit
git add .
git commit -m "Initial commit: JMeter Batch Framework"

# Create GitHub repo and push
# Option A: Using GitHub CLI (if installed)
gh repo create jmeter-batch-framework --private --source=. --remote=origin --push

# Option B: Manually via GitHub.com
# 1. Go to https://github.com/new
# 2. Name: jmeter-batch-framework
# 3. Visibility: Private
# 4. Create repository
# 5. Follow instructions to push existing repository
```

---

## Step 2: Configure AWS OIDC Authentication (Secure, No Access Keys!)

Your workflow uses OpenID Connect (OIDC) for secure authentication - **no long-lived AWS access keys needed!**

### 2.1 Create AWS OIDC Provider (One-Time Setup)

Run this command to create the GitHub OIDC provider in AWS:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Note:** If you get "EntityAlreadyExists" error, the provider already exists - skip to 2.2.

### 2.2 Create IAM Role for GitHub Actions

Create a file named `github-actions-trust-policy.json`:

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
```

**Replace in the file above:**
- `ACCOUNT-ID` with your AWS account ID (run `aws sts get-caller-identity --query Account --output text`)
- `YOUR-GITHUB-USERNAME` with your GitHub username

Then create the IAM role:

```bash
# Get your AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Replace ACCOUNT-ID in the trust policy file
sed -i "s/ACCOUNT-ID/$AWS_ACCOUNT_ID/g" github-actions-trust-policy.json

# Create the IAM role
aws iam create-role \
  --role-name GitHubActionsJMeterRole \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to deploy JMeter framework"
```

### 2.3 Attach Required Policies to the Role

```bash
# Allow ECR access (for Docker image push)
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

# Allow CloudFormation access (for CDK deployment)
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

# Allow Step Functions execution
aws iam attach-role-policy \
  --role-name GitHubActionsJMeterRole \
  --policy-arn arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess

# Create custom policy for additional permissions
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

### 2.4 Add GitHub Secret

Get the role ARN and add it to GitHub:

```bash
# Get the role ARN
aws iam get-role --role-name GitHubActionsJMeterRole --query Role.Arn --output text
```

**Now add to GitHub:**

1. Go to your repository: `https://github.com/YOUR-USERNAME/jmeter-batch-framework`
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add the secret:
   - **Name:** `AWS_ROLE_ARN`
   - **Value:** The ARN from the command above (e.g., `arn:aws:iam::123456789012:role/GitHubActionsJMeterRole`)

### 2.5 Verify Setup

After adding the secret, you should see:
- ✅ AWS_ROLE_ARN

**Security Benefits:**
- ✅ No long-lived AWS access keys
- ✅ Temporary credentials (expire after 1 hour)
- ✅ Can't be leaked or stolen from GitHub
- ✅ Fine-grained access control per repository
- ✅ Automatic credential rotation

---

## Step 3: Trigger Docker Build

### Option A: Push to Main Branch (Automatic)

```bash
cd ~/OneDrive\ -\ Thomson\ Reuters\ Incorporated/Documents/jmeter-batch-framework

# Make sure all changes are committed
git add .
git commit -m "Configure for Docker build via GitHub Actions"

# Push to GitHub (triggers workflow automatically)
git push origin main
```

### Option B: Manual Trigger (Recommended First Time)

1. Go to your GitHub repository
2. Click **Actions** tab
3. Click **Deploy JMeter Batch Framework** workflow
4. Click **Run workflow** button
5. Options:
   - Deploy infrastructure: **false** (already deployed locally)
   - Build and push Docker image: **true** ✅
6. Click **Run workflow**

---

## Step 4: Monitor Workflow

1. **Watch Progress:**
   - Go to **Actions** tab
   - Click on your running workflow
   - See real-time logs

2. **Expected Duration:**
   - Docker build: ~5-8 minutes
   - Docker push: ~2-3 minutes
   - **Total: ~10-12 minutes**

3. **Success Indicators:**
   - ✅ Green checkmark on workflow
   - Message: "Image pushed: 623035187488.dkr.ecr.us-east-1.amazonaws.com/jmeter-batch:latest"

---

## Step 5: Verify Image in ECR

After workflow succeeds, verify the image:

```bash
# List images in ECR
aws ecr list-images --repository-name jmeter-batch --region us-east-1

# Expected output:
# {
#   "imageIds": [
#     { "imageTag": "latest" },
#     { "imageTag": "abc123..." }
#   ]
# }
```

Or check AWS Console:
https://console.aws.amazon.com/ecr/repositories/private/623035187488/jmeter-batch?region=us-east-1

---

## Step 6: Run Your First Test!

Once the Docker image is in ECR, you're ready to test:

### Quick Test via AWS Console:

1. **Upload Test Files to S3:**
```bash
# Example: Upload a simple test configuration
cat > simple-test.json <<EOF
{
  "testSuite": [
    {
      "testId": "hello-world",
      "testScript": "tests/simple.jmx",
      "numOfContainers": 1,
      "threads": 5,
      "duration": "1m",
      "execute": true
    }
  ]
}
EOF

aws s3 cp simple-test.json s3://jmeter-batch-config/simple-test.json
```

2. **Upload JMeter Script:**
```bash
# You need a .jmx file - use one from your cp_jmeter-dev project
aws s3 cp your-test.jmx s3://jmeter-batch-config/tests/simple.jmx
```

3. **Execute via Step Functions:**
```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:623035187488:stateMachine:jmeter-batch-workflow \
  --input '{"testSuiteKey": "simple-test.json"}' \
  --region us-east-1
```

Or use AWS Console:
https://console.aws.amazon.com/states/home?region=us-east-1#/statemachines/view/arn:aws:states:us-east-1:623035187488:stateMachine:jmeter-batch-workflow

---

## Troubleshooting

### Workflow Fails with "Access Denied"
**Fix:** Check GitHub secrets are correctly configured

### Workflow Fails at Docker Build
**Check:** 
- Docker directory exists in repository
- Dockerfile is valid
- GitHub Actions has ECR permissions

### Image Pushed but Not Visible in ECR
**Fix:** 
- Check region (must be us-east-1)
- Verify ECR repository name matches: `jmeter-batch`

---

## What the Workflow Does

1. **Checkout code** from GitHub
2. **Configure AWS credentials** from secrets
3. **Login to ECR** (Amazon's Docker registry)
4. **Build Docker image** with JMeter
5. **Tag image** as both:
   - `latest` (for easy reference)
   - `<commit-sha>` (for version tracking)
6. **Push to ECR** (your AWS account)
7. **Report success** with image details

---

## Next Time You Need to Update

If you modify the Docker image (add plugins, update JMeter version, etc.):

```bash
# Commit changes
git add docker/
git commit -m "Update JMeter Docker image"

# Push to trigger rebuild
git push origin main
```

GitHub Actions will automatically rebuild and push the new image!

---

## Cost Note

✅ **GitHub Actions is FREE** for:
- Public repositories: Unlimited
- Private repositories: 2,000 minutes/month

This Docker build uses ~15 minutes, so you can rebuild 100+ times per month for free!

---

**Ready to start? Begin with Step 1: Check if you have a GitHub repository!**