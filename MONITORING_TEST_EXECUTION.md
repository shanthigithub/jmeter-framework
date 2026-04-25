# Monitoring Test Execution - Complete Guide

## 🎉 Your Test is Running!

Based on your screenshots, the test is executing properly. Here's where to monitor it:

---

## 📊 Monitoring Locations (In Order of Usefulness)

### 1. 🔵 AWS Batch Job Logs (REAL-TIME TEST LOGS)

**This is the MAIN place to see JMeter test execution in real-time**

#### How to Access:
1. Go to AWS Console → CloudWatch → Log Management → Log groups
2. Find: `/aws/batch/jmeter` 
3. Click on the latest log stream (matches your job ID)

#### What You'll See:
```
JMeter Batch Framework Container
========================================
Test ID: dcp-api-test
Container ID: 0
Run ID: 38363e2-1342-4265-a915-84a2ef69a573
========================================

📦 JVM Args: -Xms512m -Xmx2g

🚀 JMeter Command: jmeter -n -t s3://jmeter-batch-config/tests/DCP_API_May_v2.jmx 
   -l /tmp/results-0.jtl -j /tmp/jmeter-0.log -Jthreads 1 -Jduration 10s 
   -JcontainerId 0 -JtotalContainers 1 -JminTime 3000

📥 Downloading test files from S3...
```

**This log updates in REAL-TIME as JMeter executes your test**

#### To See Live Updates:
- Click the **"Start tailing"** button (top right in CloudWatch)
- Or click the refresh icon periodically
- Logs appear as JMeter runs

---

### 2. 🟢 GitHub Actions Workflow (HIGH-LEVEL STATUS)

**URL:** https://github.com/shanthigithub/jmeter-framework/actions

#### What You'll See:
```
Stage 6/7 - Monitor execution
├─ [0m 1s] Status: RUNNING
├─ [4m 0s] Status: RUNNING  
├─ [8m 0s] Status: RUNNING
└─ Notice: ⏱️ Monitoring test execution - this may take several minutes
```

**This polls every ~4 minutes** showing high-level execution status

#### Status Meanings:
- `RUNNING` - Test is executing (containers running)
- `SUCCEEDED` - All tests completed successfully
- `FAILED` - One or more tests failed

---

### 3. 🟡 Step Functions Execution (WORKFLOW ORCHESTRATION)

**How to Access:**
```bash
# Get execution ARN from GitHub Actions logs or run:
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:623035187488:stateMachine:jmeter-batch-workflow \
  --max-results 1
```

#### Or via AWS Console:
1. AWS Console → Step Functions
2. Click `jmeter-batch-workflow`
3. Click on your execution (e.g., `test-20260425-113110-15`)

#### What You'll See:
Visual workflow showing which Lambda is currently executing:
```
ReadConfig → ParseJMX → SubmitJobs → [CheckJobs] → MergeResults → Notify
                                         ↑
                                    (Currently here)
```

**This shows the orchestration but NOT the actual test logs**

---

### 4. 🔴 Lambda Function Logs (FRAMEWORK OPERATIONS)

These show the framework working, NOT the JMeter test execution.

#### Submit Jobs Lambda:
```
CloudWatch → /aws/lambda/jmeter-batch-submit-jobs
```
Shows: Job submission confirmation
```
📊 Test dcp-api-may-v2: Submitting 1 jobs
✓ Container 0: Job f3d61a2b-73be-41a1-9417-42b9ab6c000b submitted
✅ Submitted 1 Batch jobs across 1 tests
```

#### Check Jobs Lambda:
```
CloudWatch → /aws/lambda/jmeter-batch-check-jobs  
```
Shows: Job status polling
```
📊 Jobs config extracted: 1 test(s)
🔍 Checking 1 test(s) with 1 total jobs
```

---

## 🎯 Quick Reference: What to Check When

| Situation | Where to Look | What to Check |
|-----------|---------------|---------------|
| Is my test running? | **AWS Batch logs** `/aws/batch/jmeter` | See JMeter command execution |
| Test progress? | **AWS Batch logs** (with tailing) | Real-time test output |
| Workflow stuck? | **Step Functions** execution graph | Which Lambda is running |
| Job submitted? | **Submit Jobs Lambda** logs | Job IDs and submission status |
| Why not completing? | **Check Jobs Lambda** logs | Job status polling |
| Overall status? | **GitHub Actions** workflow | High-level RUNNING/SUCCEEDED |

---

## 🔍 Your Current Test Status (From Screenshots)

### ✅ What's Working:

1. **Batch Job Logs** (`/aws/batch/jmeter`)
   ```
   ✓ JMeter Batch Framework Container started
   ✓ Test ID: dcp-api-test
   ✓ Run ID: 38363e2-1342-4265-a915-84a2ef69a573
   ✓ JMeter Command: jmeter -n -t ... -Jthreads 1 -Jduration 10s
   ✓ Downloading test files from S3...
   ```
   **Status: RUNNING** ✅

2. **Submit Jobs Lambda**
   ```
   ✓ Test dcp-api-may-v2: Submitting 1 jobs
   ✓ Container 0: Job f3d61a2b-73be-41a1-9417-42b9ab6c000b submitted
   ```
   **Status: SUCCEEDED** ✅

3. **GitHub Actions**
   ```
   Stage 6/7 - Monitor execution
   [0m 1s] Status: RUNNING
   [4m 0s] Status: RUNNING
   ```
   **Status: IN PROGRESS** ✅

---

## 📝 Understanding Log Timing

### Why Logs Might Seem "Not Updated":

1. **JMeter runs for duration specified** (your test: 10 seconds)
   - But container startup, download, and shutdown add time
   - Total runtime: ~30-60 seconds for simple tests

2. **CloudWatch has slight delay** (~5-10 seconds)
   - Logs batch before sending to CloudWatch
   - Use "Start tailing" for near-real-time

3. **CheckJobs polls every ~30 seconds**
   - This is normal - prevents API throttling
   - You'll see periodic status updates

4. **Step Functions shows state transitions**
   - Not every Lambda invocation
   - CheckJobs may run 10+ times (polls until complete)

---

## 🚀 How to Get Real-Time Updates

### Option 1: CloudWatch Logs Insights (Advanced)

```sql
fields @timestamp, @message
| filter @logStream like /jmeter/
| sort @timestamp desc
| limit 100
```

Run this query in CloudWatch Logs Insights for live filtering.

### Option 2: AWS CLI (Terminal Monitoring)

```bash
# Get latest Batch job ID from submit-jobs logs
JOB_ID="f3d61a2b-73be-41a1-9417-42b9ab6c000b"

# Watch job status
watch -n 5 'aws batch describe-jobs --jobs $JOB_ID | jq ".jobs[0].status"'

# Tail logs (if log stream known)
aws logs tail /aws/batch/jmeter --follow
```

### Option 3: GitHub Actions (Easiest)

Just keep the GitHub Actions page open - it auto-refreshes and shows:
- Current status
- Elapsed time  
- Which stage is executing

---

## ✅ Expected Timeline for Your Test

Based on your config (1 thread, 10s duration):

```
Time    | Event
--------|--------------------------------------------------
0:00    | GitHub Actions: Start execution
0:05    | Lambda: ReadConfig (instant)
0:10    | Lambda: ParseJMX (instant)  
0:15    | Lambda: SubmitJobs (submits to Batch)
0:20    | Batch: Container starting
0:30    | Batch: JMeter downloading files
0:35    | Batch: JMeter test RUNNING (10 seconds)
0:45    | Batch: Test complete, uploading results
0:50    | Lambda: CheckJobs detects completion
0:55    | Lambda: MergeResults aggregates
1:00    | Lambda: Notify sends completion
1:05    | GitHub Actions: Workflow SUCCEEDS ✅
```

**Total: ~1-2 minutes for a 10-second test**

---

## 🎯 What You Should See Next

### In AWS Batch Logs:
```
📥 Downloading test files from S3...
✓ Test file downloaded successfully

🚀 Starting JMeter test...
Creating summariser <summary>
Created the tree successfully using tests/DCP_API_May_v2.jmx
Starting the test @ Fri Apr 25 11:31:20 UTC 2026

summary = 10 in 10.5s = 0.95/s
Tidying up...

📤 Uploading results to S3...
✓ Results uploaded successfully
```

### In GitHub Actions:
```
[0m 1s] Status: RUNNING
[0m 5s] Status: RUNNING  
[1m 0s] Status: SUCCEEDED
✓ Test execution completed successfully
```

---

## 🔧 If Logs Still Not Updating

### Check These:

1. **Verify test is actually running**
   ```bash
   aws batch list-jobs --job-queue jmeter-batch-job-queue --job-status RUNNING
   ```

2. **Check container is healthy**
   ```bash
   aws batch describe-jobs --jobs <YOUR_JOB_ID>
   ```
   Look for: `"status": "RUNNING"`

3. **Verify CloudWatch log group exists**
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/batch/jmeter"
   ```

4. **Force log refresh in console**
   - Click away from the log stream
   - Click back
   - Or use "Actions → Reload" button

---

## 📚 Summary

**PRIMARY LOCATION: AWS CloudWatch → /aws/batch/jmeter**
- This is where JMeter test execution logs appear in real-time
- Click "Start tailing" to see live updates
- This shows actual HTTP requests, response times, errors, etc.

**SECONDARY: GitHub Actions workflow**
- High-level status every ~4 minutes
- Good for overall progress tracking

**Your test IS running correctly** - the logs in your screenshot confirm it! 🎉