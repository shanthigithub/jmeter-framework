"""
Read Config Lambda Function

Reads test configuration from S3 and validates it.
Returns the test suite configuration for execution.
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

s3 = boto3.client('s3')

def lambda_handler(event, context):
    """
    Read test configuration from S3.
    
    Input event:
    {
        "configKey": "test-configs/load-test.json"
    }
    
    Output:
    {
        "testSuite": [
            {
                "testId": "api-load-test",
                "testScript": "tests/api-load.jmx",
                "numOfContainers": 3,
                "threads": 100,
                "duration": "15m",
                "execute": true
            }
        ]
    }
    """
    try:
        config_bucket = os.environ['CONFIG_BUCKET']
        # Support both 'configFile' (from Step Functions) and 'configKey' (legacy)
        config_key = event.get('configFile') or event.get('configKey', 'test-suite.json')
        
        print(f"Reading config from s3://{config_bucket}/{config_key}")
        
        # Download config from S3
        response = s3.get_object(Bucket=config_bucket, Key=config_key)
        config_content = response['Body'].read().decode('utf-8')
        config = json.loads(config_content)
        
        # Validate configuration
        if 'testSuite' not in config:
            raise ValueError("Configuration must contain 'testSuite' key")
        
        test_suite = config['testSuite']
        if not isinstance(test_suite, list):
            raise ValueError("'testSuite' must be a list")
        
        # Validate and enrich each test
        for idx, test in enumerate(test_suite):
            # Only testScript is required
            if 'testScript' not in test:
                raise ValueError(f"Test {idx} missing required field: testScript")
            
            # Auto-generate testId from script name if not provided
            if 'testId' not in test:
                script_name = test['testScript']
                # Extract filename without path and extension
                # e.g., "tests/DCP_API_May_v2.jmx" -> "dcp-api-may-v2"
                test_id = script_name.split('/')[-1].replace('.jmx', '').replace('_', '-').lower()
                test['testId'] = test_id
                print(f"  Auto-generated testId: {test_id} from {script_name}")
            
            # Default execute to true if not provided
            if 'execute' not in test:
                test['execute'] = True
            
            # Note: numOfContainers, threads, duration will be auto-extracted by JMX Parser
            # They are optional in the config and will be added later in the pipeline
        
        executable_tests = [t for t in test_suite if t.get('execute', True)]
        
        print(f"✅ Config loaded: {len(test_suite)} tests, {len(executable_tests)} executable")
        
        return {
            'statusCode': 200,
            'testSuite': test_suite,
            'summary': {
                'totalTests': len(test_suite),
                'executableTests': len(executable_tests),
                'configKey': config_key
            }
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            print(f"❌ Config file not found: s3://{config_bucket}/{config_key}")
            return {
                'statusCode': 404,
                'error': 'ConfigNotFound',
                'message': f"Configuration file not found: {config_key}"
            }
        else:
            print(f"❌ S3 error: {str(e)}")
            return {
                'statusCode': 500,
                'error': 'S3Error',
                'message': str(e)
            }
    
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in config file: {str(e)}")
        return {
            'statusCode': 400,
            'error': 'InvalidJSON',
            'message': f"Configuration file contains invalid JSON: {str(e)}"
        }
    
    except ValueError as e:
        print(f"❌ Configuration validation error: {str(e)}")
        return {
            'statusCode': 400,
            'error': 'ValidationError',
            'message': str(e)
        }
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'error': 'InternalError',
            'message': f"Unexpected error: {str(e)}"
        }