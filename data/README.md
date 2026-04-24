# Test Data Files

Place your CSV and other data files in this directory.

## 📝 Instructions

1. **Create CSV files** with test data (e.g., `users.csv`, `products.csv`)
2. **Save them here** (e.g., `data/users.csv`)
3. **Upload to S3** before running tests:

```bash
# Get your S3 config bucket
CONFIG_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name JMeterBatchStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ConfigBucketName`].OutputValue' \
  --output text)

# Upload all data files
aws s3 sync data/ s3://$CONFIG_BUCKET/data/
```

4. **Reference in config** (`examples/test-suite.json`):

```json
{
  "testId": "my-test",
  "testScript": "tests/api-load.jmx",
  "dataFiles": [
    "data/users.csv",
    "data/products.csv"
  ]
}
```

## 📋 CSV Format Example

```csv
username,password,email
user1,pass123,user1@example.com
user2,pass456,user2@example.com
user3,pass789,user3@example.com
```

## 📚 More Info

See [TEST_FILES_GUIDE.md](../TEST_FILES_GUIDE.md) for complete documentation.

## ⚠️ Note

CSV files are NOT committed to Git (see `.gitignore`). They must be uploaded to S3.

## 💡 Data Partitioning

Large CSV files are automatically split across containers. Each container gets a portion of the data.