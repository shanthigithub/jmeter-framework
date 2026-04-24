# JMeter Test Scripts

Place your `.jmx` test files in this directory.

## 📝 Instructions

1. **Create JMX files** using Apache JMeter GUI
2. **Save them here** (e.g., `tests/api-load.jmx`)
3. **Upload to S3** before running tests:

```bash
# Get your S3 config bucket
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

# Upload all test scripts
aws s3 sync tests/ s3://$CONFIG_BUCKET/tests/
```

4. **Reference in config** (`config/test-suite.json`):

```json
{
  "testId": "my-test",
  "testScript": "tests/api-load.jmx"
}
```

## 📚 More Info

See [TEST_FILES_GUIDE.md](../TEST_FILES_GUIDE.md) for complete documentation.

## ⚠️ Note

JMX files are NOT committed to Git (see `.gitignore`). They must be uploaded to S3.

