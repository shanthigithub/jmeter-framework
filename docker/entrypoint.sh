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
    echo "[ERROR] CONFIG_BUCKET and RESULTS_BUCKET must be set"
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

# Function to download S3 file
download_s3_file() {
    local s3_path=$1
    local local_path=$2
    
    # Parse s3://bucket/key format
    if [[ $s3_path =~ ^s3://([^/]+)/(.+)$ ]]; then
        local bucket="${BASH_REMATCH[1]}"
        local key="${BASH_REMATCH[2]}"
        
        echo "  [DOWNLOAD] s3://${bucket}/${key}"
        
        if aws s3 cp "s3://${bucket}/${key}" "${local_path}"; then
            echo "  [SUCCESS] Downloaded to: ${local_path}"
            return 0
        else
            echo "  [ERROR] Failed to download: s3://${bucket}/${key}"
            return 1
        fi
    else
        echo "  [ERROR] Invalid S3 path: ${s3_path}"
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
            echo "  [SUCCESS] Uploaded to: s3://${RESULTS_BUCKET}/${s3_key}"
            return 0
        else
            echo "  [WARNING] Failed to upload: ${local_file}"
            return 1
        fi
    else
        echo "  [WARNING] File not found: ${local_file}"
        return 1
    fi
}

# Process JMeter arguments and download S3 files
echo "[DOWNLOAD] Downloading test files from S3..."

NEW_CMD=()
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
            download_s3_file "$arg" "$local_file"
            NEW_CMD+=("$local_file")
        elif [[ $prev_arg =~ ^-J ]]; then
            # JMeter property (e.g., -JdataFile s3://...)
            filename=$(basename "$arg")
            local_file="/jmeter/data/${filename}"
            download_s3_file "$arg" "$local_file"
            NEW_CMD+=("$local_file")
        else
            # Unknown S3 reference, download to generic location
            filename=$(basename "$arg")
            local_file="/jmeter/data/${filename}"
            download_s3_file "$arg" "$local_file"
            NEW_CMD+=("$local_file")
        fi
    else
        NEW_CMD+=("$arg")
    fi
    
    ((i++))
done

echo ""
echo "[SUCCESS] Downloads complete"
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
    echo "[SUCCESS] JMeter test completed successfully"
else
    JMETER_EXIT_CODE=$?
    echo ""
    echo "[ERROR] JMeter test failed with exit code: ${JMETER_EXIT_CODE}"
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
echo "  [SUCCESS] Uploaded: ${uploaded_count} files"
if [ $failed_count -gt 0 ]; then
    echo "  [WARNING] Failed: ${failed_count} files"
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