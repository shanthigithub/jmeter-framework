# 🚨 URGENT: Deploy Lambda Fix for Datadog

## Problem Identified

1. **Lambda NOT deployed** - Last modified 6 hours ago (before our fix)
2. **Tests running TWICE** - Investigating...

## Quick Fix: Trigger Deployment via GitHub

### Option 1: Via GitHub UI (Easiest)

1. Go to: https://github.com/shanthigithub/jmeter-framework/actions/workflows/deploy.yml
2. Click "Run workflow" button
3. Leave defaults:
   - Deploy infrastructure: **true**  
   - Build and push Docker image: **true**
4. Click "Run workflow"
5. Wait 3-4 minutes for deployment

### Option 2: Make a Dummy Commit

```bash
# Add a comment to trigger deployment
echo "# trigger deployment" >> README.md
git add README.md
git commit -m "trigger: deploy Lambda fix"
git push origin main
```

### Option 3: Direct Lambda Update (Advanced)

If you have Python and zip installed:

```bash
# Create deployment package
cd iac/lambda/read-config
python -m zipfile -c /tmp/lambda.zip index.py
cd ../../..

# Update Lambda
aws lambda update-function-code \
  --function-name jmeter-ecs-read-config \
  --zip-file fileb:///tmp/lambda.zip

# Wait 10 seconds
timeout 10

# Verify
aws lambda get-function \
  --function-name jmeter-ecs-read-config \
  --query 'Configuration.LastModified'
```

## What the Fix Does

Changes `read-config` Lambda to look for `enable_datadog_metrics` instead of `enableDatadogMetrics`.

**Before** (WRONG):
```python
enable_datadog_from_workflow = event.get('enableDatadogMetrics', '').lower() == 'yes'
```

**After** (CORRECT):
```python
enable_datadog_from_workflow = event.get('enable_datadog_metrics', '').lower() == 'yes'
```

## Verify Deployment

After deployment completes:

```bash
# Check Lambda was updated
aws lambda get-function \
  --function-name jmeter-ecs-read-config \
  --query 'Configuration.LastModified'

# Should show timestamp within last few minutes
```

## Test After Deployment

1. Run workflow: https://github.com/shanthigithub/jmeter-framework/actions/workflows/run-test.yml
2. Select:
   - Config: `dcp-api-test.json`
   - Datadog: **yes**
3. Check logs:

```bash
# Should now show:
aws logs tail /ecs/jmeter --follow --filter-pattern "DATADOG"
# Expected: ENABLE_DATADOG_METRICS=true
```

---

## Meanwhile: Investigating Duplicate Runs

I noticed tests are running TWICE in your logs. Let me check the configuration...