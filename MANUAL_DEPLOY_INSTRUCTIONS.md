# Manual Deployment Instructions

Since GitHub CLI is not installed, here are two ways to deploy the Lambda changes:

## Option 1: Trigger via GitHub Web UI (Easiest)

1. **Go to GitHub Actions:**
   ```
   https://github.com/shanthigithub/jmeter-framework/actions
   ```

2. **Click "Deploy JMeter ECS Framework"** (in left sidebar)

3. **Click "Run workflow"** (top right, green button)

4. **Set these options:**
   - `deploy_infra`: **true** ✅ (deploys Lambda functions)
   - `build_image`: **false** (skip Docker build)

5. **Click green "Run workflow" button**

6. **Wait ~3-5 minutes** for deployment to complete

---

## Option 2: Deploy Directly with CDK (Faster)

If you have AWS credentials configured locally:

```bash
cd iac
npm install
npx cdk deploy --require-approval never
```

This will:
- Deploy all Lambda functions with your code changes
- Skip the Docker image build
- Take ~3 minutes

---

## Verify Deployment

After either method completes, verify the Lambda was updated:

```bash
aws lambda get-function \
  --function-name jmeter-ecs-ParseJMX \
  --query 'Configuration.LastModified'
```

Should show recent timestamp (within last few minutes).

---

## Why Deployment Didn't Auto-Trigger

The workflow is configured to run on `push` to `main`, but sometimes GitHub Actions can have delays. The manual trigger ensures immediate deployment.

**Your code changes are committed and ready - just needs deployment!**