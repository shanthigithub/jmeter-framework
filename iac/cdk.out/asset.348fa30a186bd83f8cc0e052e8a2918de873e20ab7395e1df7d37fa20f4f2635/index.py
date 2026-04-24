"""
Partition Data Lambda Function

Splits CSV data files across multiple containers for parallel testing.
Downloads CSV from S3, splits into chunks, uploads back to S3.
"""
import json
import os
import csv
import io
import boto3
from botocore.exceptions import ClientError

s3 = boto3.client('s3')

def lambda_handler(event, context):
    """
    Partition CSV data files for parallel execution.
    
    Input event:
    {
        "tests": [...],  # Test configurations
        "runId": "execution-id"
    }
    
    Output:
    {
        "tests": [
            {
                ...original test config,
                "dataPartitions": [
                    "partitions/run-123/test-1/data-0.csv",
                    "partitions/run-123/test-1/data-1.csv",
                    "partitions/run-123/test-1/data-2.csv"
                ]
            }
        ]
    }
    """
    try:
        config_bucket = os.environ['CONFIG_BUCKET']
        tests = event.get('tests', [])
        run_id = event.get('runId', 'unknown')
        
        print(f"🔄 Partitioning data for {len(tests)} tests, runId: {run_id}")
        
        processed_tests = []
        
        for test in tests:
            test_id = test['testId']
            num_containers = test['numOfContainers']
            data_files = test.get('dataFiles', [])
            
            if not data_files:
                # No data files to partition
                print(f"  ℹ️  Test {test_id}: No data files")
                processed_tests.append(test)
                continue
            
            print(f"  📊 Test {test_id}: Partitioning {len(data_files)} files into {num_containers} chunks")
            
            partitions = []
            
            for data_file in data_files:
                try:
                    # Download CSV from S3
                    response = s3.get_object(Bucket=config_bucket, Key=data_file)
                    csv_content = response['Body'].read().decode('utf-8')
                    
                    # Parse CSV
                    csv_reader = csv.reader(io.StringIO(csv_content))
                    rows = list(csv_reader)
                    
                    if len(rows) <= 1:
                        print(f"    ⚠️  {data_file}: Empty or header-only, skipping")
                        continue
                    
                    header = rows[0]
                    data_rows = rows[1:]
                    
                    # Calculate chunk size
                    total_rows = len(data_rows)
                    chunk_size = max(1, total_rows // num_containers)
                    
                    print(f"    📄 {data_file}: {total_rows} rows → {chunk_size} rows/container")
                    
                    # Split and upload chunks
                    for i in range(num_containers):
                        start_idx = i * chunk_size
                        end_idx = start_idx + chunk_size if i < num_containers - 1 else total_rows
                        chunk_rows = data_rows[start_idx:end_idx]
                        
                        if not chunk_rows:
                            continue
                        
                        # Create CSV content for chunk
                        output = io.StringIO()
                        csv_writer = csv.writer(output)
                        csv_writer.writerow(header)
                        csv_writer.writerows(chunk_rows)
                        chunk_content = output.getvalue()
                        
                        # Upload to S3
                        file_name = os.path.basename(data_file)
                        file_base = os.path.splitext(file_name)[0]
                        partition_key = f"partitions/{run_id}/{test_id}/{file_base}-{i}.csv"
                        
                        s3.put_object(
                            Bucket=config_bucket,
                            Key=partition_key,
                            Body=chunk_content.encode('utf-8'),
                            ContentType='text/csv'
                        )
                        
                        partitions.append(partition_key)
                        print(f"      ✓ Partition {i}: {len(chunk_rows)} rows → s3://{config_bucket}/{partition_key}")
                
                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    if error_code == 'NoSuchKey':
                        print(f"    ❌ Data file not found: {data_file}")
                    else:
                        print(f"    ❌ S3 error for {data_file}: {str(e)}")
                    # Continue with other files
                    continue
                
                except Exception as e:
                    print(f"    ❌ Error processing {data_file}: {str(e)}")
                    continue
            
            # Add partitions to test config
            test_copy = test.copy()
            test_copy['dataPartitions'] = partitions
            processed_tests.append(test_copy)
        
        print(f"✅ Partitioning complete for {len(processed_tests)} tests")
        
        return {
            'statusCode': 200,
            'tests': processed_tests,
            'runId': run_id
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}"
        }