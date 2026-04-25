# Debug Download Crash - Deployment Guide

## What Was Added

Comprehensive debug output to track exactly where the container crashes:

1. **Show all arguments** received by the script
2. **Debug each loop iteration** - see which argument is being processed
3. **Validate function calls** - confirm if `download_s3_file()` is actually called
4. **Track exact crash point** - identify the last line before container exits

## Deploy Debug Version

### Step 1: Build & Push Docker Image

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions
2. Click **"Deploy JMeter ECS Framework"**
3. Click **"Run workflow"**
4. Set:
   - `deploy_infra`: **false**
   - `build_image`: **true**
5. Click **"Run workflow"**
6. Wait ~3-4 minutes for completion

### Step 2: Run Test

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions
2. Click **"Run JMeter Test"**
3. Click **"Run workflow"**
4. Config: `config/dcp-api-test.json`
5. Click **"Run workflow"**

### Step 3: Check Logs

Go to CloudWatch → Log Groups → `/ecs/jmeter` → Click on latest log stream

## Expected Debug Output

You should now see extensive debugging:

```
==========================================
[DOWNLOAD] Downloading test files from S3
==========================================

[DEBUG] Arguments received by script: 13
[DEBUG] JMETER_CMD array length: 13
[DEBUG] JMETER_CMD contents:
[DEBUG]   [0] = jmeter
[DEBUG]   [1] = -n
[DEBUG]   [2] = -t
[DEBUG]   [3] = s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx
[DEBUG]   [4] = -l
[DEBUG]   [5] = /tmp/results-0.jtl
[DEBUG]   [6] = -j
[DEBUG]   [7] = /tmp/jmeter-0.log
[DEBUG]   [8] = -JcontainerId
[DEBUG]   [9] = 0
[DEBUG]   [10] = -JtotalContainers
[DEBUG]   [11] = 1

[DEBUG] Starting while loop to process arguments...
[DEBUG] Loop iteration 0
[DEBUG]   Processing: jmeter
[DEBUG] Loop iteration 1
[DEBUG]   Processing: -n
[DEBUG] Loop iteration 2
[DEBUG]   Processing: -t
[DEBUG] Loop iteration 3
[DEBUG]   Processing: s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx
[DEBUG]   This is an S3 path!
[DEBUG]   Previous argument: -t
[DEBUG]   Matched -t flag, this is test plan
[DEBUG]   Extracted filename: DCP_API_May_v2.jmx
[DEBUG]   Local file path: /tmp/DCP_API_May_v2.jmx
[DEBUG]   >>> CALLING download_s3_file function <<<
  [VALIDATE] Checking if file exists: s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx
  ✅ [VALIDATED] File exists in S3
  [VALIDATE] Checking S3 read permissions...
  ✅ [VALIDATED] S3 read permissions OK
  [DOWNLOAD] s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx → /tmp/DCP_API_May_v2.jmx
  [AWS CLI] Running: aws s3 cp s3://jmeter-framework-config/tests/DCP_API_May_v2.jmx /tmp/DCP_API_May_v2.jmx
  ✅ [SUCCESS] Downloaded 12345 bytes to: /tmp/DCP_API_May_v2.jmx
[DEBUG] Loop iteration 4
[DEBUG]   Processing: -l
... continues ...
```

## What to Look For

### If Container Still Crashes

Look for the **LAST debug line** printed:

1. **If last line is `[DEBUG] Starting while loop...`**
   - Loop never started → Issue with JMETER_CMD array

2. **If last line is `[DEBUG] Loop iteration 3`**
   - Crash happens when processing S3 path → Issue in S3 detection logic

3. **If last line is `[DEBUG] >>> CALLING download_s3_file function <<<`**
   - Function is called but never executes → Issue in function itself

4. **If last line is `[VALIDATE] Checking if file exists...`**
   - Crash during S3 validation → AWS CLI or permissions issue

5. **If you see NO debug output at all**
   - Container using old image → Need to force task definition update

## Share the Logs

Once you run the test, share:
1. The complete CloudWatch logs from the container
2. The last `[DEBUG]` line you see before crash
3. Any error messages

This will pinpoint exactly where and why the container is crashing!