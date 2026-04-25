# Datadog Integration - Quick Setup

## Your Existing Secret

You already have the Datadog API key in AWS Secrets Manager:
- **Secret Name**: `datadog/personal-api-key`
- **Key Field**: `personal-dd-api-key` ✅ (already exists)

## What You Need to Add

You just need to add ONE more field to your existing secret:

### Using AWS CLI

```bash
# Get current secret value
aws secretsmanager get-secret-value \
    --secret-id datadog/personal-api-key \
    --region us-east-1 \
    --query SecretString \
    --output text

# Update secret to include the "site" field
# Replace YOUR_EXISTING_API_KEY with the value from above
aws secretsmanager update-secret \
    --secret-id datadog/personal-api-key \
    --secret-string '{
        "personal-dd-api-key": "YOUR_EXISTING_API_KEY",
        "site": "datadoghq.com"
    }' \
    --region us-east-1
```

### Using AWS Console (Easier!)

1. Go to **AWS Secrets Manager** → `datadog/personal-api-key`
2. Click **"Retrieve secret value"**
3. Click **"Edit"**
4. Add a **new row**:
   - **Key**: `site`
   - **Value**: `datadoghq.com` (or your Datadog site)
5. Click **"Save"**

**Your Datadog Site Options:**
- US1: `datadoghq.com` (most common)
- US3: `us3.datadoghq.com`
- US5: `us5.datadoghq.com`
- EU: `datadoghq.eu`
- AP1: `ap1.datadoghq.com`

## Deploy

```bash
cd iac
npx cdk deploy
```

## Test

Run a test with Datadog metrics enabled:

```bash
aws stepfunctions start-execution \
  --state-machine-arn YOUR_STATE_MACHINE_ARN \
  --input '{
    "configFile": "config/test-suite.json",
    "enableDatadogMetrics": true
  }'
```

## Verify

After the test runs, check CloudWatch logs:

```bash
aws logs tail /ecs/jmeter --follow
```

Look for:
```
🐶 Datadog metrics enabled - starting DogStatsD agent...
```

Then check Datadog Metrics Explorer for `jmeter.*` metrics!

---

**That's it!** Just add the `site` field to your existing secret and deploy.