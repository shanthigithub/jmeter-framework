# JMeter Test Files Organization Guide

This guide explains where to place JMX test scripts, data files, and how to upload them to S3.

---

## 📁 Project Structure

```
jmeter-batch-framework/
├── tests/                    # ← JMX test scripts (local)
│   ├── api-load.jmx
│   ├── stress.jmx
│   ├── spike.jmx
│   └── ...
├── data/                     # ← CSV/data files (local)
│   ├── users.csv
│   ├── products.csv
│   └── ...
├── examples/
│   └── test-suite.json      # ← Test configuration
└── ...
```

---

## 🎯 Where to Place Files

### 1. **JMX Test Scripts** → `tests/` directory

Create a `tests/` folder in your project root and place all `.jmx` files there:

```bash
# Create directory
mkdir tests

# Place your JMX files
tests/
├── api-load.jmx
├── stress.jmx
├── spike.jmx
└── baseline.jmx
```

### 2. **Data Files (CSV)** → `data/` directory

Create a `data/` folder for CSV files used in your tests:

```bash
# Create directory
mkdir data

# Place your CSV files
data/
├── users.csv
├── products.csv
├── credentials.csv
└── test-data.csv
```

### 3. **Test Configuration** → `examples/test-suite.json`

Already exists - reference your files here:

```json
{
  "testSuite": [
    {
      "testId": "api-load-test",
      "testScript": "tests/api-load.jmx",  // ← References tests/ folder
      "dataFiles": [
        "data/users.csv",                  // ← References data/ folder
        "data/products.csv"
      ]
    }
  ]
}
```

---

## 📤 Uploading Files to S3

### Important: Files Must Be in S3, Not GitHub

**JMX and data files are NOT stored in GitHub.** They must be uploaded to your S3 config bucket.

### Step 1: Get Your S3 Bucket Name

```bash
aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text
```

Example output: `jmeterbatchstack-configbucket-abc123`

### Step 2: Upload Test Scripts

```bash
# Upload all JMX files
aws s3 sync tests/ s3://YOUR-CONFIG-BUCKET/tests/

# Or upload individual files
aws s3 cp tests/api-load.jmx s3://YOUR-CONFIG-BUCKET/tests/api-load.jmx
aws s3 cp tests/stress.jmx s3://YOUR-CONFIG-BUCKET/tests/stress.jmx
```

### Step 3: Upload Data Files

```bash
# Upload all CSV files
aws s3 sync data/ s3://YOUR-CONFIG-BUCKET/data/

# Or upload individual files
aws s3 cp data/users.csv s3://YOUR-CONFIG-BUCKET/data/users.csv
aws s3 cp data/products.csv s3://YOUR-CONFIG-BUCKET/data/products.csv
```

### Step 4: Upload Test Configuration

```bash
# Upload test suite configuration
aws s3 cp examples/test-suite.json s3://YOUR-CONFIG-BUCKET/test-suite.json
```

---

## ✅ Complete Example Workflow

### 1. Create Local Directory Structure

```bash
# In your project root
mkdir -p tests data

# Create example files
cd tests
# Place your .jmx files here
cd ..

cd data
# Place your .csv files here
cd ..
```

### 2. Create a Sample JMX File

You can create JMX files using Apache JMeter GUI:

```bash
# Download JMeter (if not installed)
# https://jmeter.apache.org/download_jmeter.cgi

# Run JMeter GUI
jmeter
```

**Steps in JMeter GUI:**
1. Create your test plan
2. Add Thread Groups, HTTP Requests, etc.
3. Save as `tests/api-load.jmx`

### 3. Create Sample Data File

```bash
# Create a sample CSV file
cat > data/users.csv <<EOF
username,password,email
user1,pass123,user1@example.com
user2,pass456,user2@example.com
user3,pass789,user3@example.com
EOF
```

### 4. Update Test Configuration

Edit `examples/test-suite.json`:

```json
{
  "testSuite": [
    {
      "testId": "my-api-test",
      "testScript": "tests/api-load.jmx",
      "numOfContainers": 2,
      "threads": 50,
      "duration": "5m",
      "dataFiles": [
        "data/users.csv"
      ],
      "execute": true
    }
  ]
}
```

### 5. Upload Everything to S3

```bash
# Get bucket name
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

# Upload test scripts
aws s3 sync tests/ s3://$CONFIG_BUCKET/tests/

# Upload data files
aws s3 sync data/ s3://$CONFIG_BUCKET/data/

# Upload configuration
aws s3 cp examples/test-suite.json s3://$CONFIG_BUCKET/test-suite.json

echo "✅ All files uploaded to s3://$CONFIG_BUCKET/"
```

### 6. Verify Upload

```bash
# List uploaded files
aws s3 ls s3://$CONFIG_BUCKET/tests/
aws s3 ls s3://$CONFIG_BUCKET/data/
aws s3 ls s3://$CONFIG_BUCKET/test-suite.json
```

### 7. Run Test via GitHub Actions

```
1. Go to: Actions → Run JMeter Test
2. Click: Run workflow
3. Configure:
   - test_config: test-suite.json
   - wait_for_completion: true
4. Click: Run workflow
```

---

## 📋 File Reference in test-suite.json

### Path Format

All paths in `test-suite.json` are relative to the S3 bucket root:

```json
{
  "testId": "example",
  "testScript": "tests/my-test.jmx",  // → s3://bucket/tests/my-test.jmx
  "dataFiles": [
    "data/users.csv",                 // → s3://bucket/data/users.csv
    "data/products.csv"               // → s3://bucket/data/products.csv
  ]
}
```

### Multiple Test Scripts

You can organize multiple tests:

```
S3 Bucket Structure:
└── tests/
    ├── api/
    │   ├── load-test.jmx
    │   └── stress-test.jmx
    ├── database/
    │   ├── query-test.jmx
    │   └── insert-test.jmx
    └── ui/
        └── selenium-test.jmx
```

Reference in config:

```json
{
  "testSuite": [
    {
      "testId": "api-load",
      "testScript": "tests/api/load-test.jmx"
    },
    {
      "testId": "db-query",
      "testScript": "tests/database/query-test.jmx"
    }
  ]
}
```

---

## 🔄 Updating Files

### When You Modify a Test Script

```bash
# 1. Edit locally
nano tests/api-load.jmx

# 2. Upload to S3
aws s3 cp tests/api-load.jmx s3://$CONFIG_BUCKET/tests/api-load.jmx

# 3. Run test (will use new version)
```

### When You Add New Files

```bash
# 1. Create new test
nano tests/new-test.jmx

# 2. Upload to S3
aws s3 cp tests/new-test.jmx s3://$CONFIG_BUCKET/tests/new-test.jmx

# 3. Update test-suite.json
nano examples/test-suite.json

# 4. Upload config
aws s3 cp examples/test-suite.json s3://$CONFIG_BUCKET/test-suite.json
```

---

## 🚨 Common Mistakes

### ❌ Wrong: Storing JMX in GitHub

```
# Don't do this:
git add tests/api-load.jmx
git commit -m "Add test"
git push
```

**Why?** JMX files can be large and change frequently. They belong in S3.

### ✅ Correct: Upload to S3

```bash
aws s3 cp tests/api-load.jmx s3://$CONFIG_BUCKET/tests/api-load.jmx
```

### ❌ Wrong: Incorrect Path in Config

```json
{
  "testScript": "api-load.jmx"  // Missing tests/ prefix
}
```

### ✅ Correct: Full Path from Bucket Root

```json
{
  "testScript": "tests/api-load.jmx"  // Correct
}
```

### ❌ Wrong: Absolute Paths

```json
{
  "testScript": "/tests/api-load.jmx"  // Don't use leading slash
}
```

### ✅ Correct: Relative Paths

```json
{
  "testScript": "tests/api-load.jmx"  // No leading slash
}
```

---

## 💡 Best Practices

### 1. **Version Control for Configs Only**

**Store in GitHub:**
- ✅ `examples/test-suite.json` (test configuration)
- ✅ `README.md`, documentation
- ✅ Infrastructure code (CDK)

**Store in S3:**
- ✅ `.jmx` files (test scripts)
- ✅ `.csv` files (test data)
- ✅ Large binary files

### 2. **Organize by Test Type**

```
tests/
├── load/
│   ├── basic-load.jmx
│   └── heavy-load.jmx
├── stress/
│   └── stress-test.jmx
├── spike/
│   └── spike-test.jmx
└── soak/
    └── endurance.jmx
```

### 3. **Use Descriptive Names**

```
✅ Good:
- tests/api-authentication-load-test.jmx
- tests/database-connection-stress-test.jmx
- data/production-user-sample.csv

❌ Bad:
- tests/test1.jmx
- tests/new.jmx
- data/data.csv
```

### 4. **Keep Data Files Small**

- Large CSV files are automatically split across containers
- If file is > 100MB, consider pre-splitting manually
- Store only necessary test data

### 5. **Automated Upload Script**

Create `upload-to-s3.sh`:

```bash
#!/bin/bash

# Get bucket name
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

echo "Uploading to: $CONFIG_BUCKET"

# Upload all test files
aws s3 sync tests/ s3://$CONFIG_BUCKET/tests/ --delete
aws s3 sync data/ s3://$CONFIG_BUCKET/data/ --delete
aws s3 cp examples/test-suite.json s3://$CONFIG_BUCKET/test-suite.json

echo "✅ Upload complete!"
```

Make it executable:
```bash
chmod +x upload-to-s3.sh
./upload-to-s3.sh
```

---

## 🔍 Verifying Your Setup

### Check Local Files

```bash
# List test scripts
ls -lh tests/

# List data files
ls -lh data/

# View configuration
cat examples/test-suite.json
```

### Check S3 Files

```bash
# Get bucket name
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

# List all files in S3
aws s3 ls s3://$CONFIG_BUCKET/ --recursive

# Should see:
# tests/api-load.jmx
# tests/stress.jmx
# data/users.csv
# data/products.csv
# test-suite.json
```

### Test Configuration is Valid

```bash
# Validate JSON
cat examples/test-suite.json | jq .

# Check test script references
cat examples/test-suite.json | jq -r '.testSuite[].testScript'
```

---

## 📚 Quick Reference

### Directory Structure
```
Local:                        S3:
tests/                   →    s3://bucket/tests/
data/                    →    s3://bucket/data/
examples/test-suite.json →    s3://bucket/test-suite.json
```

### Upload Commands
```bash
# Upload everything
aws s3 sync tests/ s3://$CONFIG_BUCKET/tests/
aws s3 sync data/ s3://$CONFIG_BUCKET/data/
aws s3 cp examples/test-suite.json s3://$CONFIG_BUCKET/

# Upload single file
aws s3 cp tests/my-test.jmx s3://$CONFIG_BUCKET/tests/
```

### List Files
```bash
# List all tests
aws s3 ls s3://$CONFIG_BUCKET/tests/

# List all data
aws s3 ls s3://$CONFIG_BUCKET/data/
```

### Download Files
```bash
# Download test script
aws s3 cp s3://$CONFIG_BUCKET/tests/api-load.jmx tests/

# Download all
aws s3 sync s3://$CONFIG_BUCKET/tests/ tests/
```

---

## 🎯 Summary

**Where to place files:**
1. **Create locally:** `tests/` and `data/` folders in project root
2. **Upload to S3:** All JMX and CSV files go to S3 config bucket
3. **Reference in config:** Use paths like `tests/api-load.jmx`
4. **Run tests:** Files are automatically downloaded by containers

**Remember:** JMX files live in S3, not GitHub! 🚀