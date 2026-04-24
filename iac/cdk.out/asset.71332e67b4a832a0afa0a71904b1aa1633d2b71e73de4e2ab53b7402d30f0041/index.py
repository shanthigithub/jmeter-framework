"""
Submit Jobs Lambda Function

Submits AWS Batch jobs for each test container.
Each job runs JMeter with specific parameters.
"""
import json
import os
import boto3
from datetime import datetime

batch = boto3.client('batch')

def lambda_handler(event, context):
    """
    Submit AWS Batch jobs for JMeter tests.
    
    Input event:
    {
        "tests": [...],
        "runId": "execution-id"
    }
    
    Output:
    {
        "jobs": [
            {
                "testId": "api-load-test",
                "jobIds": ["job-123", "job-456", "job-789"],
                "numContainers": 3
            }
        ],
        "totalJobs": 3
    }
    """
    try:
        job_queue = os.environ['JOB_QUEUE']
        job_definition = os.environ['JOB_DEFINITION']
        config_bucket = os.environ['CONFIG_BUCKET']
        results_bucket = os.environ['RESULTS_BUCKET']
        
        tests = event.get('tests', [])
        run_id = event.get('runId', 'unknown')
        
        print(f"🚀 Submitting Batch jobs for {len(tests)} tests, runId: {run_id}")
        
        all_jobs = []
        total_job_count = 0
        
        for test in tests:
            test_id = test['testId']
            test_script = test['testScript']
            num_containers = test['numOfContainers']
            threads = test['threads']
            duration = test['duration']
            data_partitions = test.get('dataPartitions', [])
            jvm_args = test.get('jvmArgs', '-Xms512m -Xmx2g')
            jmeter_props = test.get('jmeterProperties', {})
            
            print(f"  📊 Test {test_id}: Submitting {num_containers} jobs")
            
            job_ids = []
            
            for container_idx in range(num_containers):
                # Build JMeter command
                command = [
                    'jmeter',
                    '-n',  # Non-GUI mode
                    '-t', f's3://{config_bucket}/{test_script}',  # Test plan from S3
                    '-l', f'/tmp/results-{container_idx}.jtl',  # Results file
                    '-j', f'/tmp/jmeter-{container_idx}.log',  # JMeter log
                    '-Jthreads', str(threads),
                    '-Jduration', duration,
                    '-JcontainerId', str(container_idx),
                    '-JtotalContainers', str(num_containers),
                ]
                
                # Add data file if partitioned
                if data_partitions and container_idx < len(data_partitions):
                    data_partition = data_partitions[container_idx]
                    command.extend(['-JdataFile', f's3://{config_bucket}/{data_partition}'])
                
                # Add custom JMeter properties
                for prop_key, prop_value in jmeter_props.items():
                    command.extend([f'-J{prop_key}', str(prop_value)])
                
                # Job name (must be unique and alphanumeric with hyphens)
                timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
                job_name = f"jmeter-{test_id}-{container_idx}-{timestamp}"
                job_name = job_name.replace('_', '-')[:128]  # AWS Batch name limit
                
                # Submit job
                try:
                    response = batch.submit_job(
                        jobName=job_name,
                        jobQueue=job_queue,
                        jobDefinition=job_definition,
                        containerOverrides={
                            'command': command,
                            'environment': [
                                {'name': 'TEST_ID', 'value': test_id},
                                {'name': 'CONTAINER_ID', 'value': str(container_idx)},
                                {'name': 'RUN_ID', 'value': run_id},
                                {'name': 'CONFIG_BUCKET', 'value': config_bucket},
                                {'name': 'RESULTS_BUCKET', 'value': results_bucket},
                                {'name': 'RESULTS_PREFIX', 'value': f'{run_id}/{test_id}'},
                                {'name': 'JVM_ARGS', 'value': jvm_args},
                            ],
                        },
                        tags={
                            'testId': test_id,
                            'runId': run_id,
                            'containerId': str(container_idx),
                            'framework': 'jmeter-batch',
                        },
                    )
                    
                    job_id = response['jobId']
                    job_ids.append(job_id)
                    total_job_count += 1
                    
                    print(f"    ✓ Container {container_idx}: Job {job_id} submitted")
                
                except Exception as e:
                    print(f"    ❌ Container {container_idx}: Failed to submit job - {str(e)}")
                    # Continue with other containers
                    continue
            
            all_jobs.append({
                'testId': test_id,
                'jobIds': job_ids,
                'numContainers': len(job_ids),
                'expectedContainers': num_containers,
            })
        
        print(f"✅ Submitted {total_job_count} Batch jobs across {len(all_jobs)} tests")
        
        return {
            'statusCode': 200,
            'jobs': all_jobs,
            'totalJobs': total_job_count,
            'runId': run_id,
            'timestamp': datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}"
        }