# 🚨 CRITICAL ISSUES IDENTIFIED

## Issue 1: Lambda NOT Deployed ❌

**Status**: Lambda last modified **6 hours ago** (before our fix)

**Impact**: Datadog parameter still broken

**What Happened**:
- We committed fixes at 20:30 UTC (commits `0869ac37` and `0c9791e0`)
- Lambda last updated: 20:26 UTC (BEFORE our commits!)
- Auto-deployment FAILED or didn't run

**Fix**: Trigger deployment NOW
```bash
# Option 1: Via GitHub UI (EASIEST)
Go to: https://github.com/shanthigithub/jmeter-framework/actions/workflows/deploy.yml
Click "Run workflow" → Run workflow

# Option 2: Dummy commit
echo "# redeploy" >> README.md
git add README.md
git commit -m "trigger: deploy Lambda fix"
git push
```

---

## Issue 2: Tests Running TWICE 🔍

**Evidence from your CloudWatch logs**:
```
2026-04-27T20:56:48  [DATADOG] Metrics disabled (ENABLE_DATADOG_METRICS=false)
2026-04-27T20:56:48  [SYNC] Synchronization disabled - starting immediately
2026-04-27T20:56:48  [RUN] Running JMeter Test

2026-04-27T20:56:50  [DATADOG] Metrics disabled (ENABLE_DATADOG_METRICS=false)  ← DUPLICATE!
2026-04-27T20:56:51  [RUN] Running JMeter Test                                   ← DUPLICATE!
```

**Root Cause Analysis**:

### Theory 1: JMX Has 2 Thread Groups (MOST LIKELY)
Your JMX file `DCP_API_May_v3.jmx` likely contains **2 Thread Groups**.

**How it works**:
1. JMX Parser finds 2 thread groups
2. Parser aggregates: Total threads = TG1 + TG2
3. Parser calculates: `numOfContainers = calculate_containers(total_threads)`
4. If total threads = 100 (50 + 50), numOfContainers might = 2
5. Submit-tasks Lambda launches 2 containers
6. Each container runs the FULL JMX (both thread groups!)
7. Result: Both thread groups run in BOTH containers = 4x execution!

**Verify**:
```bash
# Check thread groups in your JMX
aws s3 cp s3://jmeter-framework-config/tests/DCP_API_May_v3.jmx - | grep -c "<ThreadGroup"

# Check last JMX parser output
aws logs tail /aws/lambda/jmeter-ecs-jmx-parser --since 2h | grep "thread group"
```

**Expected Output**:
```
📊 Found 2 thread group(s) in JMX
  └─ Thread Group 1: 50 threads, ramp 10s
  └─ Thread Group 2: 50 threads, ramp 10s
💡 Total threads across 2 thread group(s): 100
📦 Calculated containers: 2 (based on 100 total threads)
```

### Theory 2: Config Has 2 Tests
Less likely, but check:
```bash
aws s3 cp s3://jmeter-framework-config/config/dcp-api-test.json -
```

Should show only 1 test in `testSuite` array.

### Theory 3: Step Functions Runs Twice
Very unlikely, but check:
```bash
# Check Step Functions executions
aws stepfunctions list-executions \
  --state-machine-arn $(aws stepfunctions list-state-machines --query "stateMachines[?name=='JMeterStateMachine'].stateMachineArn" --output text) \
  --max-results 5
```

---

## Understanding Segment Distribution

### Current Behavior (If 2 Thread Groups):

**JMX File**:
```xml
<ThreadGroup testname="API Users - Set 1">
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
</ThreadGroup>
<ThreadGroup testname="API Users - Set 2">
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
</ThreadGroup>
```

**What Happens**:
1. Parser: Total = 100 threads → 2 containers
2. Container 0: Runs BOTH thread groups (50 + 50 threads)
3. Container 1: Runs BOTH thread groups (50 + 50 threads)
4. **TOTAL: 200 threads running!** (2x what you wanted)

### Correct Behavior (Single Thread Group):

**Should Be**:
```xml
<ThreadGroup testname="API Users">
  <stringProp name="ThreadGroup.num_threads">100</stringProp>
</ThreadGroup>
```

**What Happens**:
1. Parser: Total = 100 threads → 2 containers
2. Container 0: Runs 50 threads (segment 0)
3. Container 1: Runs 50 threads (segment 1)
4. **TOTAL: 100 threads** (correct!)

---

## Why This Happens with JMeter

**JMeter's behavior**:
- When you run a JMX with multiple thread groups, ALL thread groups execute
- There's no way to tell JMeter "only run thread group 1 in this container"
- That's why k6-style segmentation works: **1 thread group, divided across containers**

**The Fix**:
Merge your thread groups into ONE thread group if you want segmentation to work correctly.

---

## Diagnosis Steps

### Step 1: Check Your JMX Thread Groups
```bash
# Download and inspect
aws s3 cp s3://jmeter-framework-config/tests/DCP_API_May_v3.jmx /tmp/test.jmx

# Count thread groups
grep -c "<ThreadGroup" /tmp/test.jmx

# See thread group details
grep -A 5 "<ThreadGroup" /tmp/test.jmx
```

### Step 2: Check Last Parser Output
```bash
aws logs tail /aws/lambda/jmeter-ecs-jmx-parser --since 2h --format short
```

Look for:
- `📊 Found X thread group(s)`
- `💡 Total threads across X thread group(s): Y`
- `📦 Calculated containers: Z`

### Step 3: Check Container Logs
```bash
aws logs tail /ecs/jmeter --since 30m --format short | head -50
```

Count how many times you see:
- `[RUN] Running JMeter Test`
- `[DATADOG] Metrics disabled`

---

## Solutions

### Solution 1: Merge Thread Groups (RECOMMENDED)
If you have 2 thread groups with same settings, merge them:

**Before** (2 thread groups):
```xml
<ThreadGroup testname="Set 1">
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
  <stringProp name="ThreadGroup.ramp_time">10</stringProp>
</ThreadGroup>
<ThreadGroup testname="Set 2">
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
  <stringProp name="ThreadGroup.ramp_time">10</stringProp>
</ThreadGroup>
```

**After** (1 thread group):
```xml
<ThreadGroup testname="API Users">
  <stringProp name="ThreadGroup.num_threads">100</stringProp>
  <stringProp name="ThreadGroup.ramp_time">20</stringProp>
</ThreadGroup>
```

### Solution 2: Force Single Container
If you NEED multiple thread groups with different configs:

Edit `config/dcp-api-test.json`:
```json
{
  "testSuite": [
    {
      "testId": "dcp-api-test",
      "testScript": "tests/DCP_API_May_v3.jmx",
      "execute": true,
      "numOfContainers": 1  ← Add this to force 1 container
    }
  ]
}
```

This runs ALL thread groups in 1 container (no segmentation).

### Solution 3: Separate Tests
If thread groups have different purposes:

```json
{
  "testSuite": [
    {
      "testId": "dcp-api-test-1",
      "testScript": "tests/DCP_API_May_TG1.jmx",
      "execute": true
    },
    {
      "testId": "dcp-api-test-2",
      "testScript": "tests/DCP_API_May_TG2.jmx",
      "execute": true
    }
  ]
}
```

---

## Immediate Actions

1. **Deploy Lambda Fix** (for Datadog issue)
   ```
   Go to GitHub Actions → Run deploy workflow
   ```

2. **Diagnose Thread Groups**
   ```bash
   aws s3 cp s3://jmeter-framework-config/tests/DCP_API_May_v3.jmx - | grep -c "<ThreadGroup"
   ```

3. **Check Parser Logs**
   ```bash
   aws logs tail /aws/lambda/jmeter-ecs-jmx-parser --since 2h
   ```

4. **Apply Appropriate Solution** (see above)

---

## Summary

**Two separate issues**:

1. ✅ **Datadog parameter** - Fixed in code, needs deployment
2. ❓ **Tests running twice** - Likely 2 thread groups in JMX

**Next Steps**:
1. Deploy Lambda fix via GitHub
2. Check JMX thread group count
3. Apply appropriate solution based on findings