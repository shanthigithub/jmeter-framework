# Force ECS to Use New Docker Image

## Problem

Your logs show the test ran AFTER deployment but you're **NOT seeing the new debug output**:

**Missing from logs:**
```
[DEBUG] Final command to execute: ...
[DEBUG] Command breakdown: ...
[DEBUG] JMeter binary found: ...
```

**This means:** ECS is still using the OLD Docker image (before debug logging was added).

---

## Why This Happens

ECS may cache the `:latest` tag. Even though a new image was pushed to ECR, ECS tasks might still use the cached old version.

---

## Solution: Force Image Update

### Option 1: Manual Task Definition Update (Via AWS Console)

1. **Go to ECS Console:**
   - Navigate to: Amazon ECS → Task Definitions → `jmeter-framework`

2. **Create New Revision:**
   - Click latest revision
   - Click "Create new revision"
   - Click "Create" (no changes needed - this forces image re-pull)

3. **Verify Image:**
   - In the new revision, check the container image URI
   - Should show recent digest (not just `:latest`)

4. **Run Test Again:**
   - The next test will use the new task definition revision
   - Should pull fresh image from ECR

---

### Option 2: Redeploy with Image Digest (Recommended)

The issue is using `:latest` tag. Better to use image digest.

**Check the workflow logs** from the deployment:
1. Go to GitHub Actions → Deploy workflow #46
2. Look in "Build & Push Docker Image" job
3. Find the image digest output (looks like: `sha256:abc123...`)

**Then update task definition to use digest:**
```
ACCOUNT.dkr.ecr.REGION.amazonaws.com/jmeter-framework@sha256:abc123...
```

---

### Option 3: Force Re-Deploy (Quick Fix)

Re-run the GitHub Actions deployment:

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions

2. Click **"Deploy JMeter ECS Framework"**

3. Click **"Re-run jobs"** → **"Re-run all jobs"**
   - OR start new workflow run with `deploy_infra=false`, `build_image=true`

4. This will:
   - Build image with NEW commit hash as tag
   - Push to ECR with new tag
   - Update task definition with new image reference

---

## How to Verify New Image is Being Used

### Check 1: Look for Debug Output in Logs

After running a test with the updated task definition, check CloudWatch logs for:

```
========================================
[RUN] Running JMeter Test
========================================
[DEBUG] Final command to execute:     ← MUST SEE THIS
  jmeter -n -t /jmeter/scripts/...

[DEBUG] Command breakdown:            ← MUST SEE THIS
  [0] jmeter
  [1] -n
  [2] -t
  [3] /jmeter/scripts/test-plan.jmx  ← LOCAL PATH
  ...

[DEBUG] JMeter binary found: ...      ← MUST SEE THIS
```

**If you DON'T see these lines:** Still using old image!

### Check 2: Compare Timestamps

**Old entrypoint.sh:** Just shows `[COMMAND]` and `[RUN]`
**New entrypoint.sh:** Shows `[DEBUG]` lines with command breakdown

---

## Root Cause of Original Issue

From your logs, I can now see the actual problem:

```
[COMMAND] JMeter Command: jmeter -n -t s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx
```

The entrypoint.sh IS supposed to:
1. Download `s3://...test.jmx` → `/jmeter/scripts/test-plan.jmx`
2. Replace S3 path with local path in command
3. Run JMeter with local file

But we can't see if this is working because:
- ❌ No `[DEBUG]` output showing the final command
- ❌ No `[DOWNLOAD]` success confirmation visible
- ❌ No error messages from JMeter

**Once you get the NEW image running, the debug output will reveal exactly what's failing!**

---

## Next Steps

1. **Force ECS to use new image** (Option 1 or 3 above)
2. **Run test again**
3. **Check logs for `[DEBUG]` output**
4. **Share the new logs** - they'll show the actual error

The debug logging will make the problem obvious once the new image is used!