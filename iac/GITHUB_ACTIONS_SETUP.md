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

## Step 2: Add GitHub Secrets

Your workflow needs AWS credentials to work.

### 2.1 Go to GitHub Repository Settings

1. Open your repository: `https://github.com/YOUR-USERNAME/jmeter-batch-framework`
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### 2.2 Add These 3 Secrets:

#### Secret 1: AWS_ACCESS_KEY_ID
- **Name:** `AWS_ACCESS_KEY_ID`
- **Value:** Your AWS Access Key ID
  ```
  Get from: cat ~/.aws/credentials
  Look for: aws_access_key_id = AKIA...
  ```

#### Secret 2: AWS_SECRET_ACCESS_KEY
- **Name:** `AWS_SECRET_ACCESS_KEY`
- **Value:** Your AWS Secret Access Key
  ```
  Get from: cat ~/.aws/credentials
  Look for: aws_secret_access_key = ...
  ```

#### Secret 3: AWS_REGION
- **Name:** `AWS_REGION`
- **Value:** `us-east-1`

### 2.3 Verify Secrets

After adding all 3, you should see:
- ✅ AWS_ACCESS_KEY_ID
- ✅ AWS_SECRET_ACCESS_KEY
- ✅ AWS_REGION

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
