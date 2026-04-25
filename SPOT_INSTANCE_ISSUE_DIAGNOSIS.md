# SPOT Instance Availability Issue - Diagnostic Report

## 🚨 Root Cause Identified

**Issue:** Test stuck in RUNNABLE status for >10 minutes  
**Cause:** AWS Batch SPOT instances not available in your region  
**Status:** Job waiting for compute resources that cannot be provisioned

---

## 📊 Diagnostic Summary

### Job Status
```
Job ID: f3861a28-73be-41a2-9417-4269a86e0080
Status: RUNNABLE (stuck for 12+ minutes)
Started: 11:31:14 UTC
Current: 11:43:19 UTC (still RUNNABLE)
```

### Compute Environment Analysis
```json
{
  "type": "SPOT",
  "minvCpus": 0,
  "maxvCpus": 16,
  "desiredvCpus": 2,
  "bidPercentage": 100
}
```

### EC2 Instance Check
```
No instances running or pending for jmeter-batch-framework
```

**Conclusion:** SPOT instances cannot be provisioned

---

## 🔍 Why This Happens

### SPOT Instance Challenges

1. **Availability Depends on AWS Capacity**
   - SPOT instances use spare EC2 capacity
   - Capacity varies by region, AZ, and instance type
   - Your bid (100%) may not be enough if no capacity exists

2. **No Guaranteed Availability**
   - Unlike ON_DEMAND instances, SPOT has no SLA
   - Jobs can wait indefinitely for capacity
   - Especially common during high-demand periods

3. **"optimal" Instance Type Selection**
   - Your config uses `instanceTypes: ["optimal"]`
   - AWS Batch tries to find best SPOT instance
   - But if no optimal instance available, job stays RUNNABLE

---

## ✅ Solutions (In Order of Recommendation)

### Option 1: Switch to ON_DEMAND Instances (RECOMMENDED)

**Why:** Guaranteed availability, predictable startup times

**How:** Update your CDK stack to use ON_DEMAND compute environment

**File:** `iac/lib/jmeter-stack.ts`

Find the compute environment configuration and change:
```typescript
// BEFORE
type: batch.ComputeResourceType.SPOT,

// AFTER
type: batch.ComputeResourceType.ON_DEMAND,
```

**Trade-off:** ~2-3x more expensive, but tests always run

---

### Option 2: Add Fallback Compute Environment

**Why:** Try SPOT first, fallback to ON_DEMAND if needed

**How:** Create two compute environments with priority ordering

```typescript
// Higher priority (try SPOT first)
const spotComputeEnv = new batch.ComputeEnvironment(this, 'SpotCompute', {
  type: batch.ComputeResourceType.SPOT,
  // ... config
});

// Lower priority (fallback to ON_DEMAND)
const onDemandComputeEnv = new batch.ComputeEnvironment(this, 'OnDemandCompute', {
  type: batch.ComputeResourceType.ON_DEMAND,
  // ... config
});

// Job queue with both
const jobQueue = new batch.JobQueue(this, 'JMeterQueue', {
  computeEnvironments: [
    { computeEnvironment: spotComputeEnv, order: 1 },
    { computeEnvironment: onDemandComputeEnv, order: 2 }
  ]
});
```

**Trade-off:** More complex, but saves costs when SPOT is available

---

### Option 3: Increase SPOT Bid or Widen Instance Types

**Why:** Increase chances of getting SPOT capacity

**How:**
```typescript
computeResources: {
  type: batch.ComputeResourceType.SPOT,
  bidPercentage: 100, // Already at max
  instanceTypes: [
    'c5.large',
    'c5.xlarge',
    'c5.2xlarge',
    'm5.large',
    'm5.xlarge',
    'm5.2xlarge',
    'r5.large',
    'r5.xlarge'
  ], // More specific types instead of "optimal"
}
```

**Trade-off:** Still no guarantee, but improves odds

---

### Option 4: Set Retry Strategy with Timeout

**Why:** Prevent jobs from waiting indefinitely

**How:** Add timeout to job definition

```typescript
timeout: {
  attemptDurationSeconds: 300 // 5 minutes max wait
}
```

**Trade-off:** Job will fail if no capacity within timeout

---

## 🎯 Recommended Action Plan

### Immediate Fix (For Current Test)

1. **Cancel the stuck execution:**
   ```bash
   aws stepfunctions stop-execution \
     --execution-arn arn:aws:states:us-east-1:623035187488:execution:jmeter-batch-workflow:test-20260425-113110-15
   ```

2. **Temporarily switch to ON_DEMAND:**
   - Update `iac/lib/jmeter-stack.ts`
   - Change `SPOT` to `ON_DEMAND`
   - Deploy: `cd iac && npx cdk deploy`

3. **Run test again**

### Long-term Solution

**Use SPOT with ON_DEMAND Fallback (Option 2)**

Benefits:
- ✅ Cost savings when SPOT available (60-80% cheaper)
- ✅ Guaranteed execution via ON_DEMAND fallback
- ✅ Best of both worlds

---

## 📝 Cost Comparison

### SPOT vs ON_DEMAND (Example: c5.large, us-east-1)

| Type | Price/Hour | 1-hour Test | 10-hour Test |
|------|-----------|-------------|--------------|
| ON_DEMAND | $0.085 | $0.085 | $0.85 |
| SPOT | ~$0.025 | $0.025 | $0.25 |
| **Savings** | **70%** | **$0.06** | **$0.60** |

**But:** SPOT has no availability guarantee!

---

## 🔧 Quick Fix Commands

### Stop Current Execution
```bash
aws stepfunctions stop-execution \
  --execution-arn arn:aws:states:us-east-1:623035187488:execution:jmeter-batch-workflow:test-20260425-113110-15 \
  --error "SpotCapacityNotAvailable" \
  --cause "SPOT instances not available, switching to ON_DEMAND"
```

### Check SPOT Availability (Informational)
```bash
# See recent SPOT interruptions in your region
aws ec2 describe-spot-price-history \
  --instance-types c5.large m5.large \
  --product-descriptions "Linux/UNIX" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --query 'SpotPriceHistory[*].[InstanceType,SpotPrice,Timestamp]' \
  --output table
```

---

## 📚 Related Documentation

- AWS Batch SPOT vs ON_DEMAND: https://docs.aws.amazon.com/batch/latest/userguide/compute_resource_AMIs.html
- SPOT Instance Advisor: https://aws.amazon.com/ec2/spot/instance-advisor/
- CDK Batch Compute Environments: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_batch-readme.html

---

## 🎯 Summary

**Problem:** SPOT instances not provisioning → Job stuck RUNNABLE  
**Root Cause:** No SPOT capacity available in us-east-1  
**Impact:** Tests cannot run, workflow stuck for 10+ minutes  
**Solution:** Switch to ON_DEMAND or add ON_DEMAND fallback  
**Cost Impact:** ~$0.06 more per hour per instance  
**Benefit:** Guaranteed test execution

**Recommendation:** Implement SPOT + ON_DEMAND fallback (Option 2) for best cost/reliability balance