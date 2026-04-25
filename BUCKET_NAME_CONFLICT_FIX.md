# S3 Bucket Name Conflict - Quick Fix Guide

## Problem
CDK deployment is failing because S3 buckets `jmeter-config` and `jmeter-results` already exist in your AWS account but aren't managed by the new CloudFormation stack.

```
Error: Resource of type 'AWS::S3::Bucket' with identifier 'jmeter-config' already exists
Error: Resource of type 'AWS::S3::Bucket' with identifier 'jmeter-results' already exists
```

## Root Cause
When you renamed the buckets from `jmeter-batch-config` → `jmeter-config`, CloudFormation tried to create new buckets but found they already exist (probably created manually or by a previous stack).

---

## Solution Options

### Option 1: Delete Existing Buckets (RECOMMENDED if buckets are empty)

```bash
# Check if buckets have data
aws s3 ls s3://jmeter-config --recursive
aws s3 ls s3://jmeter-results --recursive

# If empty or you've backed up the data:
aws s3 rb s3://jmeter-config --force
aws s3 rb s3://jmeter-results --force

# Then retry deployment
cd iac
npx cdk deploy JMeterEcsStack
```

### Option 2: Use Different Bucket Names (QUICK FIX)

Update `iac/environments/config.ts`:

```typescript
export const config = {
  // Add your initials or account ID to make unique
  configBucket: 'jmeter-config-623035187488',
  resultsBucket: 'jmeter-results-623035187488',
  // ... rest of config
}
```

Then redeploy:
```bash
cd iac
npx cdk deploy JMeterEcsStack
```

### Option 3: Keep Old Batch Bucket Names Temporarily

If you have important data in the old buckets:

```typescript
export const config = {
  configBucket: 'jmeter-batch-config',  // Revert to old name
  resultsBucket: 'jmeter-batch-results', // Revert to old name
  ecrRepoName: 'jmeter',  // Keep this new
  // ... rest
}
```

---

## Recommended Approach

**If starting fresh:**
```bash
# 1. Delete conflicting buckets
aws s3 rb s3://jmeter-config --force
aws s3 rb s3://jmeter-results --force

# 2. Deploy stack
cd iac
npx cdk deploy JMeterEcsStack
```

**If you have data to preserve:**
```bash
# 1. Use account-specific bucket names
# Edit iac/environments/config.ts:
configBucket: 'jmeter-config-623035187488'
resultsBucket: 'jmeter-results-623035187488'

# 2. Deploy
cd iac
npx cdk deploy JMeterEcsStack

# 3. Copy data from old buckets (if any)
aws s3 sync s3://jmeter-config s3://jmeter-config-623035187488
aws s3 sync s3://jmeter-results s3://jmeter-results-623035187488
```

---

## Why This Happened

S3 bucket names are **globally unique** across all AWS accounts. When CDK tries to create a bucket:
1. If the name exists in ANY account → Error
2. If the name exists in YOUR account but not in the CloudFormation stack → Error (this case)

The safest approach is to use account-specific or unique bucket names to avoid conflicts.

---

## After Fixing

Once deployment succeeds, update GitHub Actions secrets if needed:
```bash
# If you changed bucket names, update these secrets in GitHub:
# - CONFIG_BUCKET (new value)
# - RESULTS_BUCKET (new value)