"""
Submit Tasks Lambda Function (Direct ECS Fargate)

Launches ECS Fargate tasks for each test container.
Replaces AWS Batch with direct ECS task invocation.
"""
import json
import os
import boto3
from datetime import datetime

ecs = boto3.client('ecs')

def lambda_handler(event, context):
    """
    Launch ECS Fargate tasks for JMeter tests.
    
    Input event:
    {
        "tests": [...],
        "runId": "execution-id"
    }
    
    Output:
    {
        "tasks": [
            {
                "testId": "api-load-test",
                "taskArns": ["arn:aws:ecs:...:task/123", ...],
                "numContainers": 3
            }
        ],
        "totalTasks": 3
    }
    """
    try:
        cluster = os.environ['ECS_CLUSTER']
        task_definition = os.environ['TASK_DEFINITION']
        config_bucket = os.environ['CONFIG_BUCKET']
        results_bucket = os.environ['RESULTS_BUCKET']
        subnets = os.environ['SUBNETS'].split(',')
        security_groups = os.environ['SECURITY_GROUPS'].split(',')
        
        tests = event.get('tests', [])
        run_id = event.get('runId', 'unknown')
        
        print(f"🚀 Launching ECS Fargate tasks for {len(tests)} tests, runId: {run_id}")
        
        all_tasks = []
        total_task_count = 0
        
        for test in tests:
            test_id = test['testId']
            test_script = test['testScript']
            
            # Validate required fields from JMX parser
            if 'numOfContainers' not in test or test['numOfContainers'] == 0:
                error_msg = f"Test '{test_id}': numOfContainers is missing or 0. JMX parsing may have failed."
                print(f"❌ {error_msg}")
                print(f"   Test data: {json.dumps(test, indent=2)}")
                raise ValueError(error_msg)
            
            if 'threads' not in test:
                raise ValueError(f"Test '{test_id}': threads field is missing. JMX parsing may have failed.")
            
            if 'duration' not in test:
                raise ValueError(f"Test '{test_id}': duration field is missing. JMX parsing may have failed.")
            
            num_containers = test['numOfContainers']
            threads = test['threads']
            duration = test['duration']
            data_partitions = test.get('dataPartitions', [])
            jvm_args = test.get('jvmArgs', '-Xms512m -Xmx2g')
            jmeter_props = test.get('jmeterProperties', {})
            
            print(f"  📊 Test {test_id}: Launching {num_containers} tasks")
            
            task_arns = []
            
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
                
                # Task name prefix
                timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
                task_family = f"jmeter-{test_id}-{container_idx}-{timestamp}"
                task_family = task_family.replace('_', '-')[:128]
                
                # Environment variables
                environment = [
                    {'name': 'TEST_ID', 'value': test_id},
                    {'name': 'CONTAINER_ID', 'value': str(container_idx)},
                    {'name': 'RUN_ID', 'value': run_id},
                    {'name': 'CONFIG_BUCKET', 'value': config_bucket},
                    {'name': 'RESULTS_BUCKET', 'value': results_bucket},
                    {'name': 'RESULTS_PREFIX', 'value': f'{run_id}/{test_id}'},
                    {'name': 'JVM_ARGS', 'value': jvm_args},
                ]
                
                # Launch ECS Fargate task
                try:
                    response = ecs.run_task(
                        cluster=cluster,
                        taskDefinition=task_definition,
                        launchType='FARGATE',
                        count=1,
                        networkConfiguration={
                            'awsvpcConfiguration': {
                                'subnets': subnets,
                                'securityGroups': security_groups,
                                'assignPublicIp': 'ENABLED'  # Required for ECR and S3 access
                            }
                        },
                        overrides={
                            'containerOverrides': [{
                                'name': 'jmeter',  # Must match container name in task definition
                                'command': command,
                                'environment': environment
                            }]
                        },
                        tags=[
                            {'key': 'testId', 'value': test_id},
                            {'key': 'runId', 'value': run_id},
                            {'key': 'containerId', 'value': str(container_idx)},
                            {'key': 'framework', 'value': 'jmeter-batch'},
                        ],
                        enableECSManagedTags=True,
                        propagateTags='TASK_DEFINITION'
                    )
                    
                    if response.get('tasks'):
                        task_arn = response['tasks'][0]['taskArn']
                        task_arns.append(task_arn)
                        total_task_count += 1
                        print(f"    ✓ Container {container_idx}: Task {task_arn.split('/')[-1]} launched")
                    else:
                        failure_reason = response.get('failures', [{}])[0].get('reason', 'Unknown')
                        print(f"    ❌ Container {container_idx}: Failed to launch - {failure_reason}")
                
                except Exception as e:
                    print(f"    ❌ Container {container_idx}: Failed to launch task - {str(e)}")
                    # Continue with other containers
                    continue
            
            all_tasks.append({
                'testId': test_id,
                'taskArns': task_arns,
                'numContainers': len(task_arns),
                'expectedContainers': num_containers,
            })
        
        print(f"✅ Launched {total_task_count} ECS tasks across {len(all_tasks)} tests")
        
        return {
            'statusCode': 200,
            'tasks': all_tasks,
            'totalTasks': total_task_count,
            'runId': run_id,
            'timestamp': datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}"
        }