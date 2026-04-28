"""
Merge Results Lambda Function

Aggregates JMeter results from all containers into a single report.
Downloads .jtl files from S3, merges them, and uploads combined results.
"""
import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

s3 = boto3.client('s3')

def lambda_handler(event, context):
    """
    Merge JMeter results from all containers.
    
    Input event:
    {
        "jobs": [...],
        "runId": "execution-id"
    }
    
    Output:
    {
        "mergedResults": [
            {
                "testId": "api-load-test",
                "resultsKey": "results/run-123/api-load-test/merged-results.jtl",
                "summaryKey": "results/run-123/api-load-test/summary.json"
            }
        ]
    }
    """
    try:
        results_bucket = os.environ['RESULTS_BUCKET']
        
        # Accept both 'jobs' (old) and 'tasks' (new from submit-tasks Lambda)
        tasks_config = event.get('tasks', event.get('jobs', []))
        run_id = event.get('runId', 'unknown')
        
        print(f"📊 Merging results for {len(tasks_config)} tests, runId: {run_id}")
        
        merged_results = []
        
        for task_group in tasks_config:
            test_id = task_group['testId']
            
            # Accept both 'jobIds' (old) and 'taskArns' (new)
            num_containers = task_group.get('numContainers', task_group.get('expectedContainers', 0))
            
            if num_containers == 0:
                print(f"  ⚠️  Test {test_id}: No containers to merge")
                continue
            
            print(f"  🔄 Test {test_id}: Merging results from {num_containers} containers")
            
            # List all result files for this test from container-specific folders
            # Structure: {runId}/{testId}/container-{X}/results.jtl
            results_prefix = f"{run_id}/{test_id}/"
            
            try:
                # List all .jtl files from all container folders
                response = s3.list_objects_v2(
                    Bucket=results_bucket,
                    Prefix=results_prefix
                )
                
                if 'Contents' not in response:
                    print(f"    ⚠️  No result files found at s3://{results_bucket}/{results_prefix}")
                    continue
                
                # Find .jtl files only from container-X folders (not from combined/)
                jtl_files = [
                    obj['Key'] for obj in response['Contents'] 
                    if obj['Key'].endswith('.jtl') and '/container-' in obj['Key']
                ]
                
                if not jtl_files:
                    print(f"    ⚠️  No .jtl files found")
                    continue
                
                print(f"    📄 Found {len(jtl_files)} result files")
                
                # Download and merge .jtl files
                merged_lines = []
                header_line = None
                total_samples = 0
                
                for jtl_key in jtl_files:
                    try:
                        response = s3.get_object(Bucket=results_bucket, Key=jtl_key)
                        content = response['Body'].read().decode('utf-8')
                        lines = content.strip().split('\n')
                        
                        if not lines:
                            continue
                        
                        # First line is usually the header (CSV format)
                        if header_line is None:
                            header_line = lines[0]
                            merged_lines.append(header_line)
                        
                        # Add data lines (skip header)
                        data_lines = lines[1:] if len(lines) > 1 else []
                        merged_lines.extend(data_lines)
                        total_samples += len(data_lines)
                        
                        print(f"      ✓ {jtl_key}: {len(data_lines)} samples")
                    
                    except Exception as e:
                        print(f"      ❌ Error reading {jtl_key}: {str(e)}")
                        continue
                
                if total_samples == 0:
                    print(f"    ⚠️  No samples found in result files")
                    continue
                
                # Upload merged results to combined/ folder
                # Structure: {runId}/{testId}/combined/merged-results.jtl
                merged_content = '\n'.join(merged_lines)
                merged_key = f"{results_prefix}combined/merged-results.jtl"
                
                s3.put_object(
                    Bucket=results_bucket,
                    Key=merged_key,
                    Body=merged_content.encode('utf-8'),
                    ContentType='text/csv'
                )
                
                print(f"    ✅ Merged {total_samples} samples → s3://{results_bucket}/{merged_key}")
                
                # Calculate summary statistics
                summary = calculate_summary(merged_lines[1:])  # Skip header
                summary['testId'] = test_id
                summary['runId'] = run_id
                summary['totalSamples'] = total_samples
                summary['containers'] = num_containers
                summary['timestamp'] = datetime.utcnow().isoformat()
                
                # Upload summary to combined/ folder
                summary_key = f"{results_prefix}combined/summary.json"
                s3.put_object(
                    Bucket=results_bucket,
                    Key=summary_key,
                    Body=json.dumps(summary, indent=2).encode('utf-8'),
                    ContentType='application/json'
                )
                
                print(f"    ✅ Summary → s3://{results_bucket}/{summary_key}")
                
                merged_results.append({
                    'testId': test_id,
                    'resultsKey': merged_key,
                    'summaryKey': summary_key,
                    'totalSamples': total_samples,
                    'containers': num_containers,
                })
            
            except ClientError as e:
                print(f"    ❌ S3 error: {str(e)}")
                continue
            
            except Exception as e:
                print(f"    ❌ Error merging results: {str(e)}")
                continue
        
        print(f"✅ Results merged for {len(merged_results)} tests")
        
        return {
            'statusCode': 200,
            'mergedResults': merged_results,
            'runId': run_id,
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}"
        }


def calculate_summary(data_lines):
    """
    Calculate summary statistics from JMeter .jtl data.
    
    JMeter CSV format (typical):
    timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
    """
    if not data_lines:
        return {
            'totalRequests': 0,
            'successRate': 0.0,
            'avgResponseTime': 0.0,
            'minResponseTime': 0,
            'maxResponseTime': 0,
        }
    
    try:
        total = 0
        success = 0
        response_times = []
        
        for line in data_lines:
            if not line.strip():
                continue
            
            parts = line.split(',')
            if len(parts) < 3:
                continue
            
            total += 1
            
            # Parse response time (elapsed - typically column 1)
            try:
                elapsed = int(parts[1])
                response_times.append(elapsed)
            except (ValueError, IndexError):
                pass
            
            # Parse success flag (typically column 7)
            try:
                if len(parts) > 7 and parts[7].lower() == 'true':
                    success += 1
            except IndexError:
                pass
        
        if total == 0:
            return {
                'totalRequests': 0,
                'successRate': 0.0,
                'avgResponseTime': 0.0,
            }
        
        success_rate = (success / total) * 100 if total > 0 else 0
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        min_response_time = min(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Calculate percentiles
        sorted_times = sorted(response_times) if response_times else []
        p50 = sorted_times[int(len(sorted_times) * 0.50)] if sorted_times else 0
        p90 = sorted_times[int(len(sorted_times) * 0.90)] if sorted_times else 0
        p95 = sorted_times[int(len(sorted_times) * 0.95)] if sorted_times else 0
        p99 = sorted_times[int(len(sorted_times) * 0.99)] if sorted_times else 0
        
        return {
            'totalRequests': total,
            'successfulRequests': success,
            'failedRequests': total - success,
            'successRate': round(success_rate, 2),
            'avgResponseTime': round(avg_response_time, 2),
            'minResponseTime': min_response_time,
            'maxResponseTime': max_response_time,
            'p50ResponseTime': p50,
            'p90ResponseTime': p90,
            'p95ResponseTime': p95,
            'p99ResponseTime': p99,
        }
    
    except Exception as e:
        print(f"Warning: Error calculating summary: {str(e)}")
        return {
            'totalRequests': len(data_lines),
            'error': str(e),
        }