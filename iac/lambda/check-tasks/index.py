"""
Check Tasks Lambda Function (Direct ECS Fargate)

Checks the status of ECS Fargate tasks.
Returns whether all tasks are complete or if any have failed.
"""
import json
import os
import boto3
import time

ecs = boto3.client('ecs')

def lambda_handler(event, context):
    """
    Check ECS Fargate task statuses.
    
    Input event:
    {
        "tasks": [
            {
                "testId": "api-load-test",
                "taskArns": ["arn:aws:ecs:...", ...]
            }
        ]
    }
    
    Output:
    {
        "allTasksComplete": true/false,
        "anyTasksFailed": true/false,
        "summary": {
            "total": 10,
            "running": 3,
            "succeeded": 7,
            "failed": 0
        },
        "details": [...]
    }
    """
    try:
        cluster = os.environ.get('ECS_CLUSTER', 'jmeter-cluster')
        
        # Extract tasks from the nested structure
        # Step Functions passes tasksResult.Payload.tasks
        tasks_config = event.get('tasks', [])
        
        # If not found directly, try extracting from tasksResult
        if not tasks_config and 'tasksResult' in event:
            task_result = event['tasksResult']
            if isinstance(task_result, dict) and 'Payload' in task_result:
                payload = task_result['Payload']
                if isinstance(payload, dict):
                    tasks_config = payload.get('tasks', [])
        
        # Also try jobsResult for backward compatibility during migration
        if not tasks_config and 'jobsResult' in event:
            job_result = event['jobsResult']
            if isinstance(job_result, dict) and 'Payload' in job_result:
                payload = job_result['Payload']
                if isinstance(payload, dict):
                    tasks_config = payload.get('tasks', [])
        
        print(f"📊 Tasks config extracted: {len(tasks_config)} test(s)")
        
        if not tasks_config:
            print("⚠️  No tasks to check")
            return {
                'statusCode': 200,
                'allTasksComplete': True,
                'anyTasksFailed': False,
                'summary': {'total': 0, 'running': 0, 'succeeded': 0, 'failed': 0}
            }
        
        # Collect all task ARNs
        all_task_arns = []
        for task_group in tasks_config:
            all_task_arns.extend(task_group.get('taskArns', []))
        
        if not all_task_arns:
            print("❌ ERROR: No task ARNs found but tasks were expected")
            return {
                'statusCode': 500,
                'error': 'NoTasksFound',
                'message': 'Expected tasks to check but none were provided',
                'allTasksComplete': False,
                'anyTasksFailed': True,
                'summary': {'total': 0, 'running': 0, 'succeeded': 0, 'failed': 0}
            }
        
        print(f"🔍 Checking status of {len(all_task_arns)} tasks on cluster {cluster}")
        
        # Describe tasks (max 100 per call)
        # Add retry logic to handle race condition where tasks aren't queryable yet
        task_details = []
        for i in range(0, len(all_task_arns), 100):
            batch_task_arns = all_task_arns[i:i+100]
            
            # Retry up to 3 times if tasks not found (race condition)
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = ecs.describe_tasks(
                        cluster=cluster,
                        tasks=batch_task_arns,
                        include=['TAGS']
                    )
                    
                    if response['tasks']:
                        task_details.extend(response['tasks'])
                        break
                    elif attempt < max_retries - 1:
                        print(f"⚠️  No tasks returned for batch, retrying in 2 seconds... (attempt {attempt+1}/{max_retries})")
                        time.sleep(2)
                    else:
                        print(f"⚠️  No tasks found after {max_retries} attempts for ARNs: {batch_task_arns}")
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"⚠️  Error describing tasks, retrying... {str(e)}")
                        time.sleep(2)
                    else:
                        raise
        
        # Check if we actually got task details after retries
        if not task_details and all_task_arns:
            print(f"❌ ERROR: Expected {len(all_task_arns)} tasks but got 0 after retries")
            return {
                'statusCode': 500,
                'error': 'TasksNotFound',
                'message': f'Expected {len(all_task_arns)} tasks but describe_tasks returned none',
                'allTasksComplete': False,
                'anyTasksFailed': True,
                'summary': {'total': 0, 'running': 0, 'succeeded': 0, 'failed': 0}
            }
        
        # Analyze task statuses
        # ECS task statuses: PROVISIONING, PENDING, ACTIVATING, RUNNING, DEACTIVATING, STOPPING, DEPROVISIONING, STOPPED
        status_counts = {
            'PROVISIONING': 0,
            'PENDING': 0,
            'ACTIVATING': 0,
            'RUNNING': 0,
            'DEACTIVATING': 0,
            'STOPPING': 0,
            'DEPROVISIONING': 0,
            'STOPPED': 0,
        }
        
        succeeded_count = 0
        failed_count = 0
        
        details_by_test = {}
        
        for task in task_details:
            task_arn = task['taskArn']
            last_status = task['lastStatus']
            
            status_counts[last_status] = status_counts.get(last_status, 0) + 1
            
            # Extract test info from task tags
            test_id = 'unknown'
            container_id = 'unknown'
            
            if 'tags' in task:
                for tag in task['tags']:
                    if tag['key'] == 'testId':
                        test_id = tag['value']
                    elif tag['key'] == 'containerId':
                        container_id = tag['value']
            
            if test_id not in details_by_test:
                details_by_test[test_id] = []
            
            # Determine if task succeeded or failed
            task_status = 'RUNNING'
            if last_status == 'STOPPED':
                # Check container exit code
                containers = task.get('containers', [])
                if containers:
                    exit_code = containers[0].get('exitCode')
                    if exit_code == 0:
                        task_status = 'SUCCEEDED'
                        succeeded_count += 1
                    else:
                        task_status = 'FAILED'
                        failed_count += 1
                else:
                    # No containers info, assume failed
                    task_status = 'FAILED'
                    failed_count += 1
            
            task_info = {
                'taskArn': task_arn,
                'taskId': task_arn.split('/')[-1],
                'status': task_status,
                'lastStatus': last_status,
                'containerId': container_id,
            }
            
            # Add failure reason if stopped with non-zero exit
            if task_status == 'FAILED':
                containers = task.get('containers', [])
                if containers:
                    exit_code = containers[0].get('exitCode')
                    reason = containers[0].get('reason', '')
                    task_info['exitCode'] = exit_code
                    task_info['failureReason'] = reason or task.get('stoppedReason', 'Unknown')
                else:
                    task_info['failureReason'] = task.get('stoppedReason', 'Unknown')
            
            details_by_test[test_id].append(task_info)
        
        # Calculate summary
        total_tasks = len(task_details)
        running_tasks = (
            status_counts['PROVISIONING'] + 
            status_counts['PENDING'] + 
            status_counts['ACTIVATING'] + 
            status_counts['RUNNING'] +
            status_counts['DEACTIVATING'] +
            status_counts['STOPPING'] +
            status_counts['DEPROVISIONING']
        )
        
        all_complete = (running_tasks == 0)
        any_failed = (failed_count > 0)
        
        # Log status
        print(f"  📊 Status: {succeeded_count} succeeded, {running_tasks} running, {failed_count} failed")
        
        if all_complete:
            if any_failed:
                print(f"  ❌ All tasks complete, but {failed_count} failed")
            else:
                print(f"  ✅ All {total_tasks} tasks completed successfully")
        else:
            print(f"  ⏳ {running_tasks} tasks still running...")
        
        # Format details for output
        formatted_details = []
        for test_id, tasks in details_by_test.items():
            formatted_details.append({
                'testId': test_id,
                'tasks': tasks,
                'total': len(tasks),
                'succeeded': sum(1 for t in tasks if t['status'] == 'SUCCEEDED'),
                'running': sum(1 for t in tasks if t['status'] == 'RUNNING'),
                'failed': sum(1 for t in tasks if t['status'] == 'FAILED'),
            })
        
        return {
            'statusCode': 200,
            'allTasksComplete': all_complete,
            'anyTasksFailed': any_failed,
            'summary': {
                'total': total_tasks,
                'running': running_tasks,
                'succeeded': succeeded_count,
                'failed': failed_count,
            },
            'details': formatted_details,
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}",
            'allTasksComplete': False,
            'anyTasksFailed': True,
        }