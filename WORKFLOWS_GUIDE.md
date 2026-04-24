# GitHub Actions Workflows Guide

This guide explains how to use the GitHub Actions workflows to run and manage JMeter tests.

---

## 📋 Available Workflows

### 1. **Deploy JMeter Batch Framework** (`deploy.yml`)
Builds Docker image and deploys infrastructure to AWS.

### 2. **Run JMeter Test** (`run-test.yml`) ⭐ NEW
Starts a JMeter test execution.

### 3. **Stop JMeter Test** (`stop-test.yml`) ⭐ NEW
Stops running JMeter test executions.

---

## 🚀 How to Run a Test

### Step 1: Navigate to Actions Tab

1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. Select **"Run JMeter Test"** from the left sidebar

### Step 2: Click "Run workflow"

1. Click the **"Run workflow"** button (top right)
2. Configure the parameters:

#### **Parameters:**

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| **test_config** | S3 configuration file name | `test-suite.json` | `prod-load-test.json` |
| **test_id** | Specific test ID to run | _(empty = run all)_ | `api-load-test` |
| **wait_for_completion** | Wait for test to finish | `true` | `true` or `false` |

### Step 3: Monitor Execution

#### If `wait_for_completion = true`:
- GitHub Actions will monitor the test progress
- Shows status updates every 15 seconds
- Displays results when complete
- Workflow fails if test fails

#### If `wait_for_completion = false`:
- Workflow returns immediately after starting test
- Test runs in background on AWS
- Check AWS Console for status

### Step 4: View Results

After completion, the workflow provides:
- ✅ Execution name
- 📊 S3 results location
- 🔗 AWS Console links
- 📈 CloudWatch Logs links

---

## 🛑 How to Stop a Test

### Method 1: Stop Specific Test by Name

1. Go to **Actions** → **"Stop JMeter Test"**
2. Click **"Run workflow"**
3. Enter parameters:
   - **execution_name**: `test-20260425-012345-123` (get from Run workflow output)
   - **cleanup_batch_jobs**: `true` (recommended)

### Method 2: Stop Specific Test by ARN

1. Get execution ARN from AWS Console or Run workflow output
2. Go to **Actions** → **"Stop JMeter Test"**
3. Click **"Run workflow"**
4. Enter parameters:
   - **execution_arn**: Full ARN
   - **cleanup_batch_jobs**: `true`

### Method 3: Stop All Running Tests

1. Go to **Actions** → **"Stop JMeter Test"**
2. Click **"Run workflow"**
3. Set parameters:
   - **stop_all**: `true`
   - **cleanup_batch_jobs**: `true`

### Stop Parameters

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| **execution_name** | Name of execution to stop | _(empty)_ | `test-20260425-012345-123` |
| **execution_arn** | Full execution ARN | _(empty)_ | Full ARN string |
| **stop_all** | Stop all running executions | `false` | `true` or `false` |
| **cleanup_batch_jobs** | Terminate AWS Batch jobs | `true` | `true` or `false` |

**Note:** You must provide either `execution_name`, `execution_arn`, or set `stop_all=true`.

---

## 📖 Complete Examples

### Example 1: Run a Simple Load Test

**Scenario:** Run a load test with 3 containers for 15 minutes.

**Steps:**

1. Create test configuration in `config/test-suite.json`:
```json
{
  "testSuite": [
    {
      "testId": "api-load-test",
      "testScript": "tests/api-load.jmx",
      "numOfContainers": 3,
      "threads": 100,
      "duration": "15m",
      "execute": true
    }
  ]
}
```

2. Commit and push to GitHub

3. Go to **Actions** → **Run JMeter Test**

4. Click **Run workflow** with:
   - test_config: `test-suite.json`
   - test_id: _(leave empty to run all)_
   - wait_for_completion: `true`

5. Wait for completion (approximately 15-20 minutes)

6. Download results:
```bash
aws s3 sync s3://YOUR-RESULTS-BUCKET/test-20260425-012345-123/ ./results/
```

### Example 2: Run Multiple Tests Sequentially

**Scenario:** Run different tests one after another.

**Configuration:**
```json
{
  "testSuite": [
    {
      "testId": "warmup-test",
      "testScript": "tests/warmup.jmx",
      "numOfContainers": 1,
      "threads": 10,
      "duration": "2m",
      "execute": true
    },
    {
      "testId": "load-test",
      "testScript": "tests/load.jmx",
      "numOfContainers": 5,
      "threads": 200,
      "duration": "30m",
      "execute": true
    },
    {
      "testId": "stress-test",
      "testScript": "tests/stress.jmx",
      "numOfContainers": 10,
      "threads": 300,
      "duration": "1h",
      "execute": true
    }
  ]
}
```

**Run:**
- Set `wait_for_completion: true`
- All tests run sequentially
- Total duration: ~1.5 hours

### Example 3: Run Specific Test Only

**Scenario:** Only run the stress test from a suite of multiple tests.

**Steps:**

1. Use existing `test-suite.json` with multiple tests

2. Run workflow with:
   - test_config: `test-suite.json`
   - test_id: `stress-test` ← Only this test runs
   - wait_for_completion: `true`

### Example 4: Fire and Forget (Background Execution)

**Scenario:** Start a long-running test without waiting.

**Steps:**

1. Run workflow with:
   - test_config: `test-suite.json`
   - test_id: _(empty)_
   - wait_for_completion: `false` ← Returns immediately

2. Workflow completes in ~30 seconds

3. Test continues running on AWS

4. Check status in AWS Console:
   - [Step Functions Console](https://console.aws.amazon.com/states)

### Example 5: Emergency Stop

**Scenario:** Test is running but consuming too many resources.

**Option A: Stop by Name**
```
Actions → Stop JMeter Test
execution_name: test-20260425-012345-123
cleanup_batch_jobs: true
```

**Option B: Stop All Tests**
```
Actions → Stop JMeter Test
stop_all: true
cleanup_batch_jobs: true
```

**Result:**
- Step Functions execution stopped
- All AWS Batch containers terminated
- No more costs incurred

---

## 🔍 Monitoring and Debugging

### View Execution Status

#### In GitHub Actions:
- Go to **Actions** tab
- Click on the running workflow
- View real-time logs

#### In AWS Console:

1. **Step Functions Console:**
   ```
   https://console.aws.amazon.com/states/home?region=us-east-1
   ```
   - View execution graph
   - See current step
   - View input/output of each Lambda

2. **CloudWatch Logs:**
   ```
   aws logs tail /aws/stepfunctions/JMeterBatchStateMachine --follow
   ```

3. **AWS Batch Console:**
   ```
   https://console.aws.amazon.com/batch/home?region=us-east-1#jobs
   ```
   - View container status
   - See resource usage
   - Check logs for each container

### Download Results

```bash
# Get results bucket name
RESULTS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ResultsBucketName`].OutputValue' \
  --output text)

# List all test executions
aws s3 ls s3://$RESULTS_BUCKET/

# Download specific test results
aws s3 sync s3://$RESULTS_BUCKET/test-20260425-012345-123/ ./results/

# View JTL results
cat results/merged-results.jtl
```

### Check Test Metrics

```bash
# View Step Functions metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionTime \
  --dimensions Name=StateMachineArn,Value=YOUR_STATE_MACHINE_ARN \
  --start-time 2026-04-24T00:00:00Z \
  --end-time 2026-04-25T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum

# View Batch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Batch \
  --metric-name RunningJobs \
  --dimensions Name=JobQueue,Value=JMeterBatchQueue \
  --start-time 2026-04-24T00:00:00Z \
  --end-time 2026-04-25T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum
```

---

## 💰 Cost Management

### Monitor Costs

```bash
# Check Batch compute usage
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-04-30 \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://filter.json

# filter.json
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Batch"]
  }
}
```

### Cost-Saving Tips

1. **Use `wait_for_completion: false` for long tests**
   - No GitHub Actions runner costs (6 hours max)
   - Test runs entirely on AWS

2. **Stop tests when done**
   - Use Stop workflow to terminate early
   - Avoid leaving tests running overnight

3. **Optimize container count**
   - Start with fewer containers
   - Scale up based on actual needs

4. **Use Spot instances (default)**
   - Framework uses Spot by default (70% cheaper)
   - Occasional interruptions acceptable for testing

---

## 🚨 Troubleshooting

### Problem: Workflow fails with "Stack not found"

**Solution:** Deploy infrastructure first:
```
Actions → Deploy JMeter Batch Framework → Run workflow
```

### Problem: "No running executions found" when trying to stop

**Solution:** Test already completed or was never started.
- Check Step Functions Console for execution history

### Problem: Test starts but containers fail

**Possible causes:**
1. JMX file not in S3
2. Data files missing
3. Invalid JMeter configuration

**Solution:**
```bash
# Check S3 config bucket
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

aws s3 ls s3://$CONFIG_BUCKET/tests/
aws s3 ls s3://$CONFIG_BUCKET/data/

# Upload missing files
aws s3 cp tests/api-load.jmx s3://$CONFIG_BUCKET/tests/
aws s3 cp data/users.csv s3://$CONFIG_BUCKET/data/
```

### Problem: Execution times out

**Default timeout:** 2 hours

**Solution:** Edit `iac/lib/jmeter-batch-stack.ts`:
```typescript
timeout: cdk.Duration.hours(4),  // Increase timeout
```

Then redeploy:
```
Actions → Deploy JMeter Batch Framework → Run workflow
```

### Problem: GitHub Actions authentication fails

**Error:** "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Solution:** Add AWS_ROLE_ARN secret:
```
1. Go to: Settings → Secrets and variables → Actions
2. Add secret:
   Name: AWS_ROLE_ARN
   Value: arn:aws:iam::623035187488:role/GitHubActionsJMeterRole
```

---

## 📚 Additional Resources

- [AWS Step Functions Console](https://console.aws.amazon.com/states)
- [AWS Batch Console](https://console.aws.amazon.com/batch)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch)
- [JMeter Documentation](https://jmeter.apache.org/usermanual/index.html)
- [Main README](./README.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Usage Guide](./docs/USAGE.md)

---

## 🎯 Quick Reference

### Run Test (Basic)
```
Actions → Run JMeter Test
- test_config: test-suite.json
- wait_for_completion: true
```

### Run Specific Test
```
Actions → Run JMeter Test
- test_config: test-suite.json
- test_id: api-load-test
- wait_for_completion: true
```

### Stop Specific Test
```
Actions → Stop JMeter Test
- execution_name: test-20260425-012345-123
- cleanup_batch_jobs: true
```

### Stop All Tests (Emergency)
```
Actions → Stop JMeter Test
- stop_all: true
- cleanup_batch_jobs: true
```

### View Results
```bash
aws s3 sync s3://RESULTS-BUCKET/EXECUTION-NAME/ ./results/
```

---

**Need help?** Check the troubleshooting section or AWS Console logs for detailed error messages.

