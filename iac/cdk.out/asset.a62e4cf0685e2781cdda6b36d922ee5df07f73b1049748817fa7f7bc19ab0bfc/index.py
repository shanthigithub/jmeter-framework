"""
Check Jobs Lambda Function

Checks the status of AWS Batch jobs.
Returns whether all jobs are complete or if any have failed.
"""
import json
import boto3

batch = boto3.client('batch')

def lambda_handler(event, context):
    """
    Check AWS Batch job statuses.
    
    Input event:
    {
        "jobs": [
            {
                "testId": "api-load-test",
                "jobIds": ["job-123", "job-456", "job-789"]
            }
        ]
    }
    
    Output:
    {
        "allJobsComplete": true/false,
        "anyJobsFailed": true/false,
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
        jobs_config = event.get('jobs', [])
        
        if not jobs_config:
            print("⚠️  No jobs to check")
            return {
                'statusCode': 200,
                'allJobsComplete': True,
                'anyJobsFailed': False,
                'summary': {'total': 0, 'running': 0, 'succeeded': 0, 'failed': 0}
            }
        
        # Collect all job IDs
        all_job_ids = []
        for job_group in jobs_config:
            all_job_ids.extend(job_group.get('jobIds', []))
        
        if not all_job_ids:
            print("⚠️  No job IDs found")
            return {
                'statusCode': 200,
                'allJobsComplete': True,
                'anyJobsFailed': False,
                'summary': {'total': 0, 'running': 0, 'succeeded': 0, 'failed': 0}
            }
        
        print(f"🔍 Checking status of {len(all_job_ids)} jobs")
        
        # Batch describe jobs (max 100 per call)
        job_details = []
        for i in range(0, len(all_job_ids), 100):
            batch_job_ids = all_job_ids[i:i+100]
            response = batch.describe_jobs(jobs=batch_job_ids)
            job_details.extend(response['jobs'])
        
        # Analyze job statuses
        status_counts = {
            'SUBMITTED': 0,
            'PENDING': 0,
            'RUNNABLE': 0,
            'STARTING': 0,
            'RUNNING': 0,
            'SUCCEEDED': 0,
            'FAILED': 0,
        }
        
        details_by_test = {}
        
        for job in job_details:
            job_id = job['jobId']
            job_name = job['jobName']
            status = job['status']
            
            status_counts[status] = status_counts.get(status, 0) + 1
            
            # Extract test info from job tags
            test_id = 'unknown'
            container_id = 'unknown'
            
            if 'tags' in job:
                test_id = job['tags'].get('testId', 'unknown')
                container_id = job['tags'].get('containerId', 'unknown')
            
            if test_id not in details_by_test:
                details_by_test[test_id] = []
            
            job_info = {
                'jobId': job_id,
                'jobName': job_name,
                'status': status,
                'containerId': container_id,
            }
            
            # Add failure reason if failed
            if status == 'FAILED' and 'statusReason' in job:
                job_info['failureReason'] = job['statusReason']
            
            details_by_test[test_id].append(job_info)
        
        # Calculate summary
        total_jobs = len(job_details)
        running_jobs = (
            status_counts['SUBMITTED'] + 
            status_counts['PENDING'] + 
            status_counts['RUNNABLE'] + 
            status_counts['STARTING'] + 
            status_counts['RUNNING']
        )
        succeeded_jobs = status_counts['SUCCEEDED']
        failed_jobs = status_counts['FAILED']
        
        all_complete = (running_jobs == 0)
        any_failed = (failed_jobs > 0)
        
        # Log status
        print(f"  📊 Status: {succeeded_jobs} succeeded, {running_jobs} running, {failed_jobs} failed")
        
        if all_complete:
            if any_failed:
                print(f"  ❌ All jobs complete, but {failed_jobs} failed")
            else:
                print(f"  ✅ All {total_jobs} jobs completed successfully")
        else:
            print(f"  ⏳ {running_jobs} jobs still running...")
        
        # Format details for output
        formatted_details = []
        for test_id, jobs in details_by_test.items():
            formatted_details.append({
                'testId': test_id,
                'jobs': jobs,
                'total': len(jobs),
                'succeeded': sum(1 for j in jobs if j['status'] == 'SUCCEEDED'),
                'running': sum(1 for j in jobs if j['status'] in ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING']),
                'failed': sum(1 for j in jobs if j['status'] == 'FAILED'),
            })
        
        return {
            'statusCode': 200,
            'allJobsComplete': all_complete,
            'anyJobsFailed': any_failed,
            'summary': {
                'total': total_jobs,
                'running': running_jobs,
                'succeeded': succeeded_jobs,
                'failed': failed_jobs,
            },
            'details': formatted_details,
        }
        
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}",
            'allJobsComplete': False,
            'anyJobsFailed': True,
        }