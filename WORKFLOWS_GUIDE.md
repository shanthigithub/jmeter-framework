# 🚀 JMeter Test Workflows Guide

Complete guide for running automated and manual JMeter performance tests using GitHub Actions.

---

## 📋 Available Workflows

You now have **3 workflows** in your repository:

### 1. **Deploy Infrastructure** (`deploy.yml`)
- **Trigger**: Automatic on code push
- **Purpose**: Deploys/updates AWS infrastructure
- **Status**: ✅ Already working

### 2. **Run JMeter Test** (`run-test.yml`) - MANUAL
- **Trigger**: Manual button click
- **Purpose**: Run tests on-demand with custom parameters
- **Status**: 📤 Need to upload to GitHub

### 3. **Scheduled JMeter Test** (`scheduled-test.yml`) - AUTOMATED
- **Trigger**: Daily at 2 AM UTC, or when JMX files change
- **Purpose**: Automated regression testing
- **Status**: 📤 Need to upload to GitHub

---

## 🔧 Setup Instructions

### Step 1: Upload Workflow Files to GitHub

**Option A: Via GitHub Web Interface** (Easiest)

1. Go to: https://github.com/shanthigithub/jmeter-framework
2. Navigate to `.github/workflows/` folder
3. Click **"Add file"** → **"Create new file"**

**For `run-test.yml`:**
- File name: `run-test.yml`
- Copy content from: `C:\Users\6119141\Documents\jmeter-framework\.github\workflows\run-test.yml`
- Commit message: "Add manual test workflow"

**For `scheduled-test.yml`:**
- File name: `scheduled-test.yml`
- Copy content from: `C:\Users\6119141\Documents\jmeter-framework\.github\workflows\scheduled-test.yml`
- Commit message: "Add automated scheduled test workflow"

### Step 2: Verify Workflows Appear

1. Go to **Actions** tab in your repository
2. You should see all 3 workflows listed:
   - Deploy Infrastructure
   - Run JMeter Test
   - Scheduled JMeter Test

---

## 🎮 How to Use Each Workflow

### 🖱️ Manual Test Workflow (run-test.yml)

**When to use:** Run tests on-demand with specific configurations

**Steps:**
1. Go to GitHub → **Actions** tab
2. Click **"Run JMeter Test"** in the left sidebar
3. Click **"Run workflow"** dropdown
4. Fill in parameters:
   ```
   Test Suite Name: my-api-load-test
   JMX File Name: test-plan.jmx
   Number of Test Runners: 5
   Threads per Runner: 20
   Test Duration: 600
   Ramp Up Time: 120
   ```
5. Click **"Run workflow"** button
6. Watch the progress in real-time

**What it does:**
- ✅ Uploads your JMX file to S3
- ✅ Creates test configuration
- ✅ Starts AWS Step Functions execution
- ✅ Monitors test progress
- ✅ Downloads results
- ✅ Creates summary report

---

### 🤖 Automated Test Workflow (scheduled-test.yml)

**When it runs automatically:**
- ⏰ **Daily at 2 AM UTC** (7:30 AM IST)
- 📝 **When you push JMX files** to `examples/` or `project-config/`
- 🔄 **When test-suite.json is updated**

**Configuration (in the workflow file):**
```yaml
env:
  DEFAULT_TEST_SUITE: 'nightly-regression'
  DEFAULT_NUM_MINIONS: '2'
  DEFAULT_THREADS: '10'
  DEFAULT_DURATION: '300'
  DEFAULT_RAMP_UP: '60'
```

**To customize:**
1. Edit `.github/workflows/scheduled-test.yml` on GitHub
2. Change the `env:` values
3. Commit changes

**Change schedule:**
```yaml
schedule:
  - cron: '0 2 * * *'  # Daily at 2 AM UTC
  
# Common schedules:
# Every 6 hours:    - cron: '0 */6 * * *'
# Twice daily:      - cron: '0 2,14 * * *'
# Weekdays only:    - cron: '0 2 * * 1-5'
# Every Monday:     - cron: '0 2 * * 1'
```

---

## 📊 Understanding Test Results

### During Test Execution

Monitor progress at:
- **GitHub Actions**: Real-time logs
- **AWS Console**: Step Functions execution graph
- Links provided in workflow logs

### After Test Completion

**1. GitHub Artifacts**
- Go to workflow run → **Artifacts** section
- Download: `jmeter-results-<test-suite>-<run-id>.zip`
- Contains: JTL files, HTML reports, CSV summaries

**2. S3 Bucket**
- Location: `s3://<bucket-name>/results/<test-suite>/`
- Files:
  - `merged.jtl` - Combined results from all runners
  - `report/index.html` - HTML dashboard
  - `summary.json` - Key metrics

**3. Workflow Summary**
- Click on workflow run
- View **Summary** tab
- See key metrics:
  - Total requests
  - Error rate
  - Average response time

---

## 🔑 Required GitHub Secrets

Make sure these are configured in your repository:

**Settings → Secrets and variables → Actions**

| Secret Name | Value | Description |
|------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key | From IAM user |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | From IAM user |

**How to add:**
1. Go to: https://github.com/shanthigithub/jmeter-framework/settings/secrets/actions
2. Click **"New repository secret"**
3. Add each secret

---

## 📁 File Organization

### Required Structure

```
your-repository/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Infrastructure deployment
│       ├── run-test.yml        # Manual tests
│       └── scheduled-test.yml  # Automated tests
├── examples/
│   ├── test-plan.jmx          # Sample JMeter test plan
│   ├── test-suite.json        # Test configuration
│   └── data/                  # Test data files (CSV, etc.)
├── project-config/
│   └── *.jmx                  # Your actual test plans
└── iac/                       # Infrastructure code
```

### Adding New Test Plans

1. Add JMX file to `examples/` or `project-config/`
2. (Optional) Add test data to `examples/data/`
3. Commit and push
4. Automated workflow will run automatically!

---

## 🎯 Common Use Cases

### Use Case 1: Daily Regression Tests
✅ Use **Scheduled Test Workflow**
- Runs automatically every night
- Tests latest code changes
- Reports any performance degradation

### Use Case 2: Load Testing Before Release
✅ Use **Manual Test Workflow**
- Run on-demand with high load
- Customize threads and duration
- Validate performance under stress

### Use Case 3: CI/CD Integration
✅ Use **Scheduled Test Workflow** (push trigger)
- Runs when JMX files change
- Validates test plan modifications
- Ensures test quality

---

## ⚙️ Customization Options

### Modify Default Test Parameters

Edit `scheduled-test.yml`:
```yaml
env:
  DEFAULT_NUM_MINIONS: '5'      # More parallel runners
  DEFAULT_THREADS: '50'         # More threads per runner
  DEFAULT_DURATION: '1800'      # 30 minutes test
  DEFAULT_RAMP_UP: '300'        # 5 minutes ramp up
```

### Add Notifications

Add to workflow (after test completion):
```yaml
- name: Send Slack Notification
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "JMeter Test Completed: ${{ job.status }}"
      }
```

### Run Tests on Multiple Environments

Create separate workflows for each:
- `scheduled-test-dev.yml`
- `scheduled-test-staging.yml`
- `scheduled-test-prod.yml`

Each with different AWS credentials and test suites.

---

## 📈 Monitoring and Alerting

### View Test History

1. **GitHub Actions**:
   - Actions tab → Select workflow
   - See all historical runs
   - Compare metrics over time

2. **AWS CloudWatch**:
   - Step Functions execution history
   - Lambda function logs
   - Batch job metrics

3. **S3 Archive**:
   - All results stored permanently
   - Organized by test suite and date

### Set Up Alerts

**Option 1: GitHub Actions Notifications**
- Settings → Notifications
- Enable "Actions" notifications

**Option 2: AWS CloudWatch Alarms**
- Monitor error rates
- Alert on failures
- Track execution time

---

## 🐛 Troubleshooting

### Workflow Fails to Start

**Issue:** Workflow not appearing in Actions tab
- **Fix:** Check file syntax (YAML format)
- **Fix:** Ensure files are in `.github/workflows/`

### Test Execution Fails

**Issue:** "JMX file not found"
- **Fix:** Verify JMX file exists in `examples/` or `project-config/`
- **Fix:** Check file name matches exactly (case-sensitive)

**Issue:** "Stack outputs not found"
- **Fix:** Ensure infrastructure is deployed
- **Fix:** Check `JMeterBatchStack` exists in CloudFormation

### AWS Credential Issues

**Issue:** "AccessDenied" errors
- **Fix:** Verify secrets are set correctly
- **Fix:** Check IAM user has required permissions

---

## 🎉 Next Steps

1. ✅ **Upload workflow files to GitHub**
2. ✅ **Verify secrets are configured**
3. ✅ **Run your first manual test**
4. ✅ **Wait for first scheduled test**
5. ✅ **Review results and optimize**

---

## 📚 Additional Resources

- [JMeter Documentation](https://jmeter.apache.org/usermanual/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [AWS Step Functions](https://docs.aws.amazon.com/step-functions/)
- [Project README](./README.md)

---

**Questions or Issues?**
- Check workflow logs in Actions tab
- Review AWS CloudWatch logs
- Verify all prerequisites are met