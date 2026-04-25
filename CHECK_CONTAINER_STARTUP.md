# Container Startup Diagnosis

## Issue: Tasks Completing Too Quickly (4-5 seconds)

This suggests the container might be failing to start or exiting immediately.

## Step 1: Check ECS Task Details

Go to AWS Console:
1. ECS Console → Clusters → `jmeter-framework-cluster`
2. Click **Tasks** tab
3. Find the task that just ran (sort by Created timestamp)
4. Click the task ID

**Look for:**
- **Last status:** STOPPED
- **Desired status:** STOPPED  
- **Stopped reason:** Will show why it stopped
- **Container exit code:** Should be 0 for success, non-zero for failure

## Step 2: Check CloudWatch Logs

From the task details page:
1. Click **Logs** tab
2. Or manually navigate to CloudWatch → Log Groups → `/ecs/jmeter`
3. Find the log stream for your task

**What to look for in logs:**

### If Container Started Successfully:
```
JMeter Batch Framework Container
=====================================
Test ID: dcp-api-test
Container ID: 0
Run ID: test-20260425-144115-24
[CONFIG] Config Bucket: s3://jmeter-framework-config
[DOWNLOAD] Downloading test files from S3
```

### If Container Failed to Start:
```
Error: Cannot pull Docker image
or
Error: Task failed to start
or
No logs at all (container never started)
```

### If JMeter Command Failed:
```
[JVM] Running JMeter with args: ...
Error: Could not find or load main class
or
Invalid JMeter command
```

## Step 3: Common Failure Scenarios

### Scenario A: No Logs = Container Never Started
**Cause:** Docker image pull failed, networking issue, task definition error
**Fix:** Check task stopped reason, verify ECR image exists

### Scenario B: Fast Exit with Error
**Cause:** JMeter command error, missing test file, S3 download failure
**Fix:** Check logs for actual error message

### Scenario C: Exit Code 0 but Too Fast
**Cause:** Test completed very quickly (e.g., 1 iteration, no duration)
**Fix:** Check JMX file configuration - might be running as intended

## Step 4: Debug Commands

### Check if tasks actually ran:
```bash
# List recent tasks
aws ecs list-tasks \
  --cluster jmeter-framework-cluster \
  --desired-status STOPPED \
  --max-results 10

# Get task details (replace TASK_ID)
aws ecs describe-tasks \
  --cluster jmeter-framework-cluster \
  --tasks <TASK_ID> \
  --include TAGS

# Get container exit code
aws ecs describe-tasks \
  --cluster jmeter-framework-cluster \
  --tasks <TASK_ID> \
  --query 'tasks[0].containers[0].{exitCode:exitCode,reason:reason,lastStatus:lastStatus}'
```

### Check CloudWatch logs programmatically:
```bash
# List log streams for jmeter
aws logs describe-log-streams \
  --log-group-name /ecs/jmeter \
  --order-by LastEventTime \
  --descending \
  --max-items 5

# View specific log stream
aws logs get-log-events \
  --log-group-name /ecs/jmeter \
  --log-stream-name "jmeter/jmeter/<TASK_ID>"
```

## Step 5: Verify Docker Image

Check if the latest Docker image was actually built:

```bash
# List ECR images
aws ecr describe-images \
  --repository-name jmeter-framework \
  --query 'imageDetails[*].[imagePushedAt,imageTags]' \
  --output table

# Should show recent timestamp with 'latest' tag
```

## What to Report Back

Please provide:
1. **Task stopped reason** from ECS Console
2. **Container exit code** 
3. **First 50 lines of CloudWatch logs** for the task
4. **Whether logs exist at all** (indicates if container started)

This will help identify if:
- Container is failing to start (infrastructure issue)
- JMeter is erroring (configuration issue)  
- Test is actually completing quickly (expected behavior)