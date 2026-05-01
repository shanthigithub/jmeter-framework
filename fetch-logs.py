import boto3
import json

client = boto3.client('logs', region_name='us-east-1')

response = client.get_log_events(
    logGroupName='/jmeter/browser',
    logStreamName='jmeter-browser/jmeter/fa77fee149474bd0ab48b4137f3d3f00',
    limit=200
)

print("=== RECENT LOG EVENTS ===\n")
for event in response['events']:
    message = event['message']
    # Filter for important lines
    if any(keyword in message for keyword in ['Tests run', 'BUILD', 'Step_', 'FAILURE', 'ERROR', 'testSureprepUIApproval']):
        print(message)