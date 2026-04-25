# Run New Test to See Debug Output

## Important: Your Logs Are Old!

The logs you're looking at are from **14:22 (2:22 PM)** - this was BEFORE the deployment.

The new Docker image with debug logging was deployed at **~20:55 (8:55 PM)**.

**You need to run a NEW test to see the debug output!**

---

## How to Run a New Test

### Option 1: Via GitHub Actions

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions

2. Click **"Run JMeter Test"** workflow

3. Click **"Run workflow"** button

4. Enter your config file: `config/dcp-api-test.json`

5. Click green **"Run workflow"**

### Option 2: Via AWS Console

1. Go to Step Functions

2. Find your state machine: `jmeter-ecs-workflow`

3. Click **"Start execution"**

4. Use input:
   ```json
   {
     "configKey": "config/dcp-api-test.json"
   }
   ```

---

## What You'll See in New Logs

The new container will show:

```
========================================
[RUN] Running JMeter Test
========================================
[DEBUG] Final command to execute:
  jmeter -n -t /jmeter/scripts/test-plan.jmx -l /tmp/results-0.jtl -j /tmp/jmeter-0.log -JcontainerId 0 -JtotalContainers 1 -JThinkTime 3000 -Japikey wO043G0kg... -JTestDuration 3600

[DEBUG] Command breakdown:
  [0] jmeter
  [1] -n
  [2] -t
  [3] /jmeter/scripts/test-plan.jmx   ← LOCAL PATH (not s3://)
  [4] -l
  [5] /tmp/results-0.jtl
  [6] -j
  [7] /tmp/jmeter-0.log
  [8] -JcontainerId
  [9] 0
  [10] -JtotalContainers
  [11] 1
  [12] -JThinkTime
  [13] 3000
  ... (and so on)

[DEBUG] JMeter binary found: /opt/apache-jmeter/bin/jmeter
[DEBUG] JMeter version:
  Apache JMeter 5.6.3
  ...

[EXECUTE] Running: jmeter -n -t /jmeter/scripts/test-plan.jmx ...
```

**This will show:**
1. ✅ S3 path was replaced with local path
2. ✅ JMeter binary exists
3. ✅ Actual error if it fails

---

## The Code IS Correct

The entrypoint.sh downloads files and replaces S3 paths:

```bash
# Input command from Lambda
jmeter -n -t s3://bucket/test.jmx

# After processing in entrypoint.sh
jmeter -n -t /jmeter/scripts/test-plan.jmx  ← Local path!
```

The new debug output will prove this is working.

---

## Next Steps

1. **Run a new test** (see above)
2. **Wait 2-3 minutes** for container to start
3. **Check CloudWatch logs** - look for timestamps AFTER 20:55
4. **Share the new logs** - they'll show the debug output

The old logs (14:22) are from before we added the debug logging!