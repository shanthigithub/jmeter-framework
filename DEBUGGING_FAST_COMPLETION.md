# Debugging Fast Test Completion

## Issue: Test completes in ~34 seconds (suspiciously fast)

This guide will help you identify why your JMeter test is completing too quickly.

---

## 🔍 Quick Diagnosis Checklist

### 1. **Check Step Functions Execution** (MOST IMPORTANT)

```bash
# Get the latest Step Functions execution
aws stepfunctions list-executions \
  --state-machine-arn <YOUR_STATE_MACHINE_ARN> \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text

# Get execution details
aws stepfunctions describe-execution \
  --execution-arn <EXECUTION_ARN>

# Get execution history to see what happened
aws stepfunctions get-execution-history \
  --execution-arn <EXECUTION_ARN> \
  --max-results 100
```

**What to look for:**
- Did the execution actually start?
- Did it fail at any Lambda step?
- Did it skip the CheckJobs loop?
- What was the final status?

---

### 2. **Check if Batch Jobs Were Actually Submitted**

```bash
# List recent Batch jobs
aws batch list-jobs \
  --job-queue <YOUR_JOB_QUEUE_NAME> \
  --job-status SUCCEEDED \
  --max-results 10

aws batch list-jobs \
  --job-queue <YOUR_JOB_QUEUE_NAME> \
  --job-status FAILED \
  --max-results 10

# Describe a specific job to see logs
aws batch describe-jobs --jobs <JOB_ID>
```

**What to look for:**
- Are there ANY Batch jobs in the queue?
- If yes, what's their status?
- If no jobs exist, the submit-jobs Lambda likely failed

---

### 3. **Check Lambda Logs** (Step by Step)

#### Step 1: Check ReadConfig Lambda
```bash
aws logs tail /aws/lambda/<STACK_NAME>-ReadConfigFunction --follow
```

**What to check:**
- Did it successfully download the config from S3?
- Was the JMX parser invoked?
- What configuration was parsed?
- Any errors?

#### Step 2: Check JMX Parser Lambda
```bash
aws logs tail /aws/lambda/<STACK_NAME>-JMXParserFunction --follow
```

**Critical checks:**
- Was the JMX file found in S3?
- What thread count was extracted?
- What duration was detected?
- Was numOfContainers calculated correctly?
- Any parsing errors?

#### Step 3: Check SubmitJobs Lambda
```bash
aws logs tail /aws/lambda/<STACK_NAME>-SubmitJobsFunction --follow
```

**Critical checks:**
- How many jobs were submitted?
- Were job IDs returned?
- Any Batch API errors?
- Check for permission errors

#### Step 4: Check CheckJobs Lambda
```bash
aws logs tail /aws/lambda/<STACK_NAME>-CheckJobsFunction --follow
```

**What to check:**
- How many times was it called? (Should loop until jobs complete)
- Was allJobsComplete immediately true?
- Were any jobs found?

---

### 4. **Verify Test Configuration**

```bash
# Download your test config
aws s3 cp s3://<CONFIG_BUCKET>/config/dcp-api-test.json ./test-config-check.json

# Check the contents
cat test-config-check.json
```

**Verify:**
- `"execute": true` is set
- The JMX file path is correct
- The JMX file actually exists in S3

---

### 5. **Check if JMX File Exists in S3**

```bash
# List test files
aws s3 ls s3://<CONFIG_BUCKET>/tests/

# Check if your specific file exists
aws s3 ls s3://<CONFIG_BUCKET>/tests/DCP_API_May_v2.jmx

# Download it to verify it's valid
aws s3 cp s3://<CONFIG_BUCKET>/tests/DCP_API_May_v2.jmx ./test-verify.jmx
```

---

### 6. **Check Batch Compute Environment**

```bash
# Check if compute environment is enabled
aws batch describe-compute-environments \
  --compute-environments <COMPUTE_ENV_NAME>
```

**What to check:**
- Status should be "VALID" and "ENABLED"
- State should be "ENABLED"
- If disabled, enable it:
  ```bash
  aws batch update-compute-environment \
    --compute-environment <COMPUTE_ENV_NAME> \
    --state ENABLED
  ```

---

### 7. **Check Job Queue**

```bash
aws batch describe-job-queues \
  --job-queues <JOB_QUEUE_NAME>
```

**What to check:**
- Status should be "VALID"
- State should be "ENABLED"

---

## 🐛 Common Root Causes

### **Issue 1: JMX Parser Returns 0 Containers**
**Symptom:** No Batch jobs submitted
**Cause:** JMX parsing failed or returned numOfContainers = 0
**Fix:** 
- Check JMX parser Lambda logs
- Verify JMX file has ThreadGroup elements
- Check if threads/duration were detected

### **Issue 2: Submit Jobs Lambda Doesn't Submit Anything**
**Symptom:** Step Functions completes immediately
**Cause:** Logic error in submit-jobs Lambda
**Fix:**
- Check if jobs array is empty
- Verify Batch API permissions
- Check for errors in Lambda logs

### **Issue 3: CheckJobs Lambda Returns Immediate Success**
**Symptom:** No polling happens
**Cause:** allJobsComplete = true on first check (no jobs to check)
**Fix:**
- Verify jobs were actually submitted
- Check if job IDs were passed correctly

### **Issue 4: Wrong Test Config Used**
**Symptom:** Different test runs than expected
**Cause:** Config file path mismatch
**Fix:**
- Verify configKey in Step Functions input
- Check S3 bucket/key exists

### **Issue 5: Batch Jobs Fail Immediately**
**Symptom:** Jobs complete in seconds
**Cause:** Container startup error or JMeter crash
**Fix:**
- Check CloudWatch Logs for Batch job logs
- Verify Docker image exists in ECR
- Check container logs for errors

---

## 🔧 Step-by-Step Debug Process

### Step 1: Get Stack Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name <YOUR_STACK_NAME> \
  --query 'Stacks[0].Outputs'
```

Save these values:
- StateMachineArn
- ConfigBucket
- ResultsBucket
- JobQueue
- ComputeEnvironment

### Step 2: Check Latest Execution
```bash
# Get execution ARN
EXECUTION_ARN=$(aws stepfunctions list-executions \
  --state-machine-arn <STATE_MACHINE_ARN> \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text)

echo "Execution ARN: $EXECUTION_ARN"

# Get status
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query '{status: status, startDate: startDate, stopDate: stopDate}'
```

### Step 3: Get Execution Events
```bash
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --max-results 100 \
  --query 'events[*].[timestamp,type,id]' \
  --output table
```

Look for:
- `LambdaFunctionSucceeded` events
- `TaskStateExited` events
- `ExecutionFailed` or `ExecutionSucceeded`

### Step 4: Check Each Lambda's Output
```bash
# This will show you what each Lambda returned
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --query 'events[?type==`LambdaFunctionSucceeded`].{id:id,output:lambdaFunctionSucceededEventDetails.output}' \
  --output json
```

**Focus on:**
- ReadConfig output: Did it parse the JMX?
- SubmitJobs output: How many jobs were submitted?
- CheckJobs output: What was allJobsComplete value?

---

## 🎯 Most Likely Issues

Based on "completing in 34 seconds", here are the top 3 causes:

### **1. NO BATCH JOBS SUBMITTED (90% likely)**
- SubmitJobs Lambda returns empty jobs array
- CheckJobs immediately returns allJobsComplete=true
- No actual testing occurs

**How to verify:**
```bash
aws batch list-jobs --job-queue <QUEUE> --job-status SUCCEEDED
aws batch list-jobs --job-queue <QUEUE> --job-status RUNNING
aws batch list-jobs --job-queue <QUEUE> --job-status FAILED
```

### **2. JMX Parser Returns 0 Containers**
- JMX parsing fails
- numOfContainers = 0
- SubmitJobs skips job submission

**How to verify:**
Check ReadConfig/JMXParser Lambda logs for the parsed config

### **3. Wrong Config File**
- Using an old/wrong config
- Test has execute: false
- JMX file doesn't exist

**How to verify:**
```bash
aws s3 cp s3://<CONFIG_BUCKET>/config/dcp-api-test.json -
```

---

## 📋 Information to Collect

Run these commands and share the output:

```bash
# 1. Get latest execution details
aws stepfunctions list-executions \
  --state-machine-arn <ARN> \
  --max-results 1

# 2. Check if any jobs exist
aws batch list-jobs \
  --job-queue <QUEUE> \
  --max-results 20

# 3. Get ReadConfig Lambda logs
aws logs tail /aws/lambda/<STACK>-ReadConfigFunction \
  --since 1h \
  --format short

# 4. Get SubmitJobs Lambda logs
aws logs tail /aws/lambda/<STACK>-SubmitJobsFunction \
  --since 1h \
  --format short

# 5. Verify config file
aws s3 cp s3://<BUCKET>/config/dcp-api-test.json -
```

---

## 🚨 Emergency Quick Check

If you just want to know what went wrong RIGHT NOW:

```bash
# Get the Step Functions execution that just ran
EXEC_ARN=$(aws stepfunctions list-executions \
  --state-machine-arn <ARN> \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text)

# See what each step returned
aws stepfunctions get-execution-history \
  --execution-arn $EXEC_ARN \
  --query 'events[?type==`LambdaFunctionSucceeded`]' \
  --output json > execution-debug.json

cat execution-debug.json
```

Look in the output for:
- How many jobs were submitted
- Whether allJobsComplete was immediately true
- Any error messages

---

## Next Steps

1. **Get Stack Name** from CloudFormation console or CLI
2. **Run Quick Check** commands above
3. **Check CloudWatch Logs** for each Lambda
4. **Verify Batch Jobs** were actually submitted
5. Share the findings so we can fix the root cause