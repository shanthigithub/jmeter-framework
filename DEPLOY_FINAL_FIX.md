# Deploy Final Fix - Correct File Path

## What Was Fixed

**Your excellent observation was correct!**

1. ✅ Lambda IS working - No more `-JThinkTime`, `-Japikey`, `-JTestDuration` parameters
2. ✅ Fixed entrypoint.sh to use original filename: `/tmp/DCP_API_May_v2.jmx` (not `/jmeter/scripts/test-plan.jmx`)
3. ✅ Removed premature command display - now shows AFTER download completes

## Deploy New Docker Image

### Via GitHub Actions (Recommended)

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions
2. Click **"Deploy JMeter ECS Framework"**
3. Click **"Run workflow"**
4. Set:
   - `deploy_infra`: **false** (Lambda already deployed)
   - `build_image`: **true** (need new Docker image)
5. Click **"Run workflow"**
6. Wait ~3-4 minutes for image build

This will:
- Build new Docker image with corrected entrypoint.sh (commit `e016bab5`)
- Push to ECR with tags: `e016bab5` and `latest`
- ECS will use new image on next test run

## Run Test to Verify

After deployment completes:

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions
2. Click **"Run JMeter Test"**
3. Click **"Run workflow"**
4. Config: `config/dcp-api-test.json`
5. Click **"Run workflow"**

## Expected Logs (NEW Behavior)

```
==========================================
JMeter Batch Framework Container
==========================================
Test ID: dcp-api-test
Container ID: 0
Run ID: test-20260425-160214-28
==========================================

[DOWNLOAD] Downloading test files from S3
==========================================

  [VALIDATE] Checking if file exists: s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx
  ✅ [VALIDATED] File exists in S3
  [VALIDATE] Checking S3 read permissions...
  ✅ [VALIDATED] S3 read permissions OK
  [DOWNLOAD] s3://...DCP_API_May_v2.jmx → /tmp/DCP_API_May_v2.jmx
  ✅ [SUCCESS] Downloaded 12345 bytes to: /tmp/DCP_API_May_v2.jmx

✅ [SUCCESS] All downloads complete

==========================================
[RUN] Running JMeter Test
==========================================
[DEBUG] Final command to execute:
  jmeter -n -t /tmp/DCP_API_May_v2.jmx -l /tmp/results-0.jtl -j /tmp/jmeter-0.log -JcontainerId 0 -JtotalContainers 1

[DEBUG] Command breakdown:
  [0] jmeter
  [1] -n
  [2] -t
  [3] /tmp/DCP_API_May_v2.jmx          ← CORRECT LOCAL PATH WITH ORIGINAL FILENAME!
  [4] -l
  [5] /tmp/results-0.jtl
  [6] -j
  [7] /tmp/jmeter-0.log
  [8] -JcontainerId                     ← ONLY FRAMEWORK PARAMETERS
  [9] 0
  [10] -JtotalContainers
  [11] 1
  ← NO -JThinkTime, -Japikey, -JTestDuration!

[DEBUG] JMeter binary found: /opt/apache-jmeter/bin/jmeter
[DEBUG] JMeter version: Apache JMeter 5.6.3

[EXECUTE] Running: jmeter -n -t /tmp/DCP_API_May_v2.jmx ...

<JMeter test output starts here>
```

## Success Indicators

1. ✅ **Download happens FIRST** (before showing command)
2. ✅ **Local path with original filename**: `/tmp/DCP_API_May_v2.jmx`
3. ✅ **Clean parameters**: Only `-JcontainerId` and `-JtotalContainers`
4. ✅ **No extracted variables**: No `-JThinkTime`, `-Japikey`, `-JTestDuration`
5. ✅ **Debug output**: Shows `[DEBUG]` command breakdown

## Summary of All Fixes

### 1. Lambda Fix (Deployed ✅)
- Stopped auto-extracting JMX User Defined Variables
- Prevents `-JThinkTime`, `-Japikey`, etc. from being added to command

### 2. Docker Fix (Needs Deployment)
- Uses original filename: `/tmp/DCP_API_May_v2.jmx`
- Shows command AFTER download completes
- Provides detailed debug output

**Once you deploy the Docker image and run a test, share the CloudWatch logs to confirm everything works!**