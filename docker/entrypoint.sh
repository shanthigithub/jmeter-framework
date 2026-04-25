#!/bin/bash
set -e

echo "=========================================="
echo "JMeter Batch Framework Container"
echo "=========================================="
echo "Test ID: ${TEST_ID:-unknown}"
echo "Container ID: ${CONTAINER_ID:-unknown}"
echo "Run ID: ${RUN_ID:-unknown}"
echo "=========================================="

# Environment variables
CONFIG_BUCKET="${CONFIG_BUCKET:-}"
RESULTS_BUCKET="${RESULTS_BUCKET:-}"
RESULTS_PREFIX="${RESULTS_PREFIX:-results}"
JVM_ARGS="${JVM_ARGS:--Xms512m -Xmx2g}"

# Validate environment
if [ -z "$CONFIG_BUCKET" ] || [ -z "$RESULTS_BUCKET" ]; then
    echo "❌ [ERROR] CONFIG_BUCKET and RESULTS_BUCKET must be set"
    exit 1
fi

echo "[CONFIG] Config Bucket: s3://${CONFIG_BUCKET}"
echo "[CONFIG] Results Bucket: s3://${RESULTS_BUCKET}"
echo "[CONFIG] JVM Args: ${JVM_ARGS}"
echo ""

# Parse JMeter command from arguments
# Expected format: jmeter -n -t s3://bucket/test.jmx -l /tmp/results.jtl ...
JMETER_CMD=("$@")

echo "[COMMAND] JMeter Command: ${JMETER_CMD[*]}"
echo ""

# Function to download S3 file with validation
download_s3_file() {
    local s3_path=$1
    local local_path=$2
    
    # Parse s3://bucket/key format
    if [[ $s3_path =~ ^s3://([^/]+)/(.+)$ ]]; then
        local bucket="${BASH_REMATCH[1]}"
        local key="${BASH_REMATCH[2]}"
        
        echo "  [VALIDATE] Checking if file exists: s3://${bucket}/${key}"
        
        # Check if file exists in S3 before attempting download
        if aws s3 ls "s3://${bucket}/${key}" >/dev/null 2>&1; then
            echo "  ✅ [VALIDATED] File exists in S3"
        else
            echo "  ❌ [ERROR] File NOT found in S3: s3://${bucket}/${key}"
            echo ""
            echo "  [DIAGNOSTIC HINTS]"
            echo "  1. Verify file exists:"
            echo "     aws s3 ls s3://${bucket}/${key}"
            echo ""
            echo "  2. List all files in directory:"
            echo "     aws s3 ls s3://${bucket}/$(dirname ${key})/"
            echo ""
            echo "  3. Check bucket name: ${bucket}"
            echo "  4. Check key path: ${key}"
            echo ""
            return 1
        fi
        
        # Check if we have permission to read from this bucket
        echo "  [VALIDATE] Checking S3 read permissions..."
        if aws s3api head-object --bucket "${bucket}" --key "${key}" >/dev/null 2>&1; then
            echo "  ✅ [VALIDATED] S3 read permissions OK"
        else
            echo "  ❌ [ERROR] Permission denied for s3://${bucket}/${key}"
            echo ""
            echo "  [REQUIRED IAM PERMISSIONS]"
            echo "  The ECS Task Role needs these permissions:"
            echo "  {"
            echo "    \"Effect\": \"Allow\","
            echo "    \"Action\": ["
            echo "      \"s3:GetObject\","
            echo "      \"s3:ListBucket\""
            echo "    ],"
            echo "    \"Resource\": ["
            echo "      \"arn:aws:s3:::${bucket}\","
            echo "      \"arn:aws:s3:::${bucket}/*\""
            echo "    ]"
            echo "  }"
            echo ""
            echo "  [DEBUGGING STEPS]"
            echo "  1. Check task role ARN in ECS task definition"
            echo "  2. Verify IAM policies attached to that role"
            echo "  3. Test manually: aws s3 cp s3://${bucket}/${key} /tmp/test"
            echo ""
            return 1
        fi
        
        # Now download the file
        echo "  [DOWNLOAD] s3://${bucket}/${key} → ${local_path}"
        
        if aws s3 cp "s3://${bucket}/${key}" "${local_path}" 2>&1; then
            # Verify download succeeded
            if [ -f "${local_path}" ]; then
                local file_size=$(stat -c%s "${local_path}" 2>/dev/null || stat -f%z "${local_path}" 2>/dev/null || echo "0")
                echo "  ✅ [SUCCESS] Downloaded ${file_size} bytes to: ${local_path}"
                return 0
            else
                echo "  ❌ [ERROR] Download completed but file not found: ${local_path}"
                return 1
            fi
        else
            echo "  ❌ [ERROR] AWS CLI failed to download: s3://${bucket}/${key}"
            echo "  [HINT] Check CloudWatch Logs (/ecs/jmeter) for detailed AWS CLI error"
            return 1
        fi
    else
        echo "  ❌ [ERROR] Invalid S3 path format: ${s3_path}"
        echo "  [HINT] Expected format: s3://bucket-name/path/to/file"
        return 1
    fi
}

# Function to upload results to S3
upload_results() {
    local local_file=$1
    local s3_key=$2
    
    if [ -f "${local_file}" ]; then
        echo "  [UPLOAD] ${local_file}"
        if aws s3 cp "${local_file}" "s3://${RESULTS_BUCKET}/${s3_key}"; then
            echo "  ✅ [SUCCESS] Uploaded to: s3://${RESULTS_BUCKET}/${s3_key}"
            return 0
        else
            echo "  ⚠️  [WARNING] Failed to upload: ${local_file}"
            return 1
        fi
    else
        echo "  ⚠️  [WARNING] File not found: ${local_file}"
        return 1
    fi
}

# Process JMeter arguments and download S3 files
echo "=========================================="
echo "[DOWNLOAD] Downloading test files from S3"
echo "=========================================="
echo ""

NEW_CMD=()
DOWNLOAD_FAILED=0
i=0

while [ $i -lt ${#JMETER_CMD[@]} ]; do
    arg="${JMETER_CMD[$i]}"
    
    # Check if argument is an S3 path
    if [[ $arg =~ ^s3:// ]]; then
        # Determine file type from previous argument
        prev_arg="${JMETER_CMD[$((i-1))]}"
        
        if [ "$prev_arg" = "-t" ]; then
            # Test plan file
            local_file="/jmeter/scripts/test-plan.jmx"
            if ! download_s3_file "$arg" "$local_file"; then
                DOWNLOAD_FAILED=1
                echo ""
                echo "❌ [FATAL] Failed to download critical test plan file"
                echo "Cannot proceed without test plan. Exiting..."
                exit 1
            fi
            NEW_CMD+=("$local_file")
        elif [[ $prev_arg =~ ^-J ]]; then
            # JMeter property (e.g., -JdataFile s3://...)
            filename=$(basename "$arg")
            local_file="/jmeter/data/${filename}"
            if ! download_s3_file "$arg" "$local_file"; then
                DOWNLOAD_FAILED=1
                echo ""
                echo "⚠️  [WARNING] Failed to download data file, but continuing..."
            fi
            NEW_CMD+=("$local_file")
        else
            # Unknown S3 reference, download to generic location
            filename=$(basename "$arg")
            local_file="/jmeter/data/${filename}"
            if ! download_s3_file "$arg" "$local_file"; then
                DOWNLOAD_FAILED=1
                echo ""
                echo "⚠️  [WARNING] Failed to download file, but continuing..."
            fi
            NEW_CMD+=("$local_file")
        fi
    else
        NEW_CMD+=("$arg")
    fi
    
    ((i++))
done

echo ""
if [ $DOWNLOAD_FAILED -eq 0 ]; then
    echo "✅ [SUCCESS] All downloads complete"
else
    echo "⚠️  [WARNING] Some downloads failed, but proceeding with test"
fi
echo ""

# Set JVM options
export JVM_ARGS

# Run JMeter
echo "=========================================="
echo "[RUN] Running JMeter Test"
echo "=========================================="
echo ""

# Execute JMeter with modified command
if ${NEW_CMD[@]}; then
    JMETER_EXIT_CODE=0
    echo ""
    echo "✅ [SUCCESS] JMeter test completed successfully"
else
    JMETER_EXIT_CODE=$?
    echo ""
    echo "❌ [ERROR] JMeter test failed with exit code: ${JMETER_EXIT_CODE}"
fi

echo ""
echo "=========================================="
echo "[UPLOAD] Uploading Results to S3"
echo "=========================================="
echo ""

# Upload all result files from /tmp
uploaded_count=0
failed_count=0

for file in /tmp/*.jtl /tmp/*.log /tmp/*.csv; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        s3_key="${RESULTS_PREFIX}/${filename}"
        
        if upload_results "$file" "$s3_key"; then
            ((uploaded_count++))
        else
            ((failed_count++))
        fi
    fi
done

echo ""
echo "[SUMMARY] Upload Summary:"
echo "  ✅ Uploaded: ${uploaded_count} files"
if [ $failed_count -gt 0 ]; then
    echo "  ⚠️  Failed: ${failed_count} files"
fi

echo ""
echo "=========================================="
echo "[COMPLETE] Container Execution Complete"
echo "=========================================="
echo "Test ID: ${TEST_ID}"
echo "Container ID: ${CONTAINER_ID}"
echo "JMeter Exit Code: ${JMETER_EXIT_CODE}"
echo "Files Uploaded: ${uploaded_count}"
echo "=========================================="

# Exit with JMeter's exit code
exit $JMETER_EXIT_CODE