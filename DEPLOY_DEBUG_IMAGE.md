# Deploy Docker Image with Debug Logging

## What Changed

Modified `docker/entrypoint.sh` to add comprehensive debug logging that will show:
1. The actual JMeter command after S3 path replacement
2. Each command argument individually
3. JMeter binary verification
4. Full error output if JMeter fails

## Deploy Steps

### Option 1: GitHub Actions (Recommended)

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions

2. Click **"Deploy JMeter ECS Framework"**

3. Click **"Run workflow"** button

4. Set parameters:
   - `deploy_infra`: **false** (Lambda changes deployed separately)
   - `build_image`: **true** ✅ (Build new Docker image with debug logging)

5. Click green **"Run workflow"** button

6. Wait ~8-10 minutes for:
   - Docker build
   - ECR push
   - ECS task definition update

### Option 2: Local Build & Push

If you have Docker and AWS CLI configured locally:

```bash
# Navigate to project root
cd c:/Users/6119141/OneDrive - Thomson Reuters Incorporated/Documents/jmeter-batch-framework

# Build image
docker build -t jmeter-framework:debug -f docker/Dockerfile .

# Tag for ECR (replace ACCOUNT_ID and REGION)
docker tag jmeter-framework:debug ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/jmeter-framework:latest

# Login to ECR
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com

# Push image
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/jmeter-framework:latest
```

## After Deployment

### 1. Verify New Image
```bash
# Check ECS task definition for image digest
aws ecs describe-task-definition \
  --task-definition jmeter-framework \
  --query 'taskDefinition.containerDefinitions[0].image'
```

### 2. Run Test
Trigger a test run via GitHub Actions or API

### 3. Check Logs with New Debug Output

Go to CloudWatch Logs and look for:

```
[DEBUG] Final command to execute:
  jmeter -n -t /jmeter/scripts/test-plan.jmx -l /tmp/results-0.jtl ...

[DEBUG] Command breakdown:
  [0] jmeter
  [1] -n
  [2] -t
  [3] /jmeter/scripts/test-plan.jmx
  ...

[DEBUG] JMeter binary found: /opt/apache-jmeter/bin/jmeter
[DEBUG] JMeter version:
  <version info>

[EXECUTE] Running: jmeter -n -t /jmeter/scripts/test-plan.jmx ...
```

**This will reveal:**
- ✅ Exact command being run
- ✅ Whether JMeter binary exists
- ✅ Any error messages from JMeter
- ✅ Why the container exits

## Expected Issues to Discover

Based on the logs, likely causes:

### 1. JMeter Binary Not Found
```
❌ [ERROR] JMeter binary not found in PATH!
[DEBUG] PATH=/usr/local/bin:/usr/bin
```
**Fix:** Update Dockerfile to ensure JMeter is in PATH

### 2. Invalid JMeter Arguments
```
[ERROR] Unknown option: -JThinkTime
```
**Fix:** Adjust command construction in submit-tasks Lambda

### 3. Missing Dependencies
```
Error: java.lang.NoClassDefFoundError: ...
```
**Fix:** Add missing JMeter plugins to Docker image

### 4. File Permission Issues
```
Error: Cannot read /jmeter/scripts/test-plan.jmx (Permission denied)
```
**Fix:** Adjust file permissions in entrypoint script

## Next Steps After Deployment

1. **Deploy the image** (see above)
2. **Run a test** to generate new logs
3. **Check CloudWatch** for debug output
4. **Share the new logs** - they will show exactly what's failing
5. **Fix the root cause** based on the error message
6. **Repeat** until working

The debug logging will make the problem obvious!