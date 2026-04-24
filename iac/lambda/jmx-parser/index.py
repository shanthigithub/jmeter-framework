"""
JMX Parser Lambda Function

Automatically extracts test configuration from JMeter JMX files:
- Thread count (users)
- Duration or iterations
- Test properties
- Calculates optimal container count

This eliminates the need for manual configuration.
"""

import json
import boto3
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
import math
import os
import re

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """
    Parse JMX file and extract test configuration.
    
    Input event:
    {
        "testScript": "tests/DCP_API_May_v2.jmx",
        "configBucket": "jmeter-config-bucket",
        "jmeterProperties": {  // Optional overrides
            "hostname": "api.example.com"
        }
    }
    
    Returns:
    {
        "threads": 10,
        "duration": "5m",
        "iterations": null,  // or number if loop-based
        "numOfContainers": 1,
        "jvmArgs": "-Xms512m -Xmx2g",
        "jmeterProperties": {...},
        "testDetails": {
            "threadGroupName": "API Users",
            "rampTime": 30,
            "scheduler": true
        }
    }
    """
    
    try:
        test_script = event.get('testScript')
        config_bucket = event.get('configBucket')
        property_overrides = event.get('jmeterProperties', {})
        
        if not test_script or not config_bucket:
            raise ValueError("testScript and configBucket are required")
        
        # Download JMX file from S3
        print(f"📥 Downloading {test_script} from {config_bucket}")
        response = s3_client.get_object(Bucket=config_bucket, Key=test_script)
        jmx_content = response['Body'].read().decode('utf-8')
        
        # Parse JMX
        config = parse_jmx(jmx_content, property_overrides)
        
        print(f"✅ Parsed configuration: {json.dumps(config, indent=2)}")
        
        return {
            'statusCode': 200,
            'body': config
        }
        
    except Exception as e:
        print(f"❌ Error parsing JMX: {str(e)}")
        return {
            'statusCode': 500,
            'error': str(e),
            'message': 'Failed to parse JMX file'
        }


def parse_jmx(jmx_content: str, property_overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Parse JMX XML and extract test configuration."""
    
    root = ET.fromstring(jmx_content)
    
    # Find ALL ThreadGroup elements
    thread_groups = find_all_thread_groups(root)
    
    if not thread_groups:
        raise ValueError("No ThreadGroup found in JMX file")
    
    print(f"📊 Found {len(thread_groups)} thread group(s) in JMX")
    
    # Aggregate configuration from all thread groups
    total_threads = 0
    max_duration_seconds = 0
    max_iterations = 0
    max_ramp_time = 0
    use_scheduler = False
    thread_group_details = []
    
    for i, thread_group in enumerate(thread_groups, 1):
        tg_name = thread_group.get('testname', f'Thread Group {i}')
        
        # Extract thread count
        tg_threads = get_element_value(thread_group, 'stringProp', 'ThreadGroup.num_threads', default='1')
        tg_threads = int(tg_threads)
        total_threads += tg_threads
        
        # Extract ramp-up time
        tg_ramp = get_element_value(thread_group, 'stringProp', 'ThreadGroup.ramp_time', default='1')
        tg_ramp = int(tg_ramp)
        max_ramp_time = max(max_ramp_time, tg_ramp)
        
        # Check scheduler
        tg_scheduler = get_element_value(thread_group, 'boolProp', 'ThreadGroup.scheduler', default='false')
        tg_use_scheduler = tg_scheduler.lower() == 'true'
        
        if tg_use_scheduler:
            use_scheduler = True
            tg_duration = get_element_value(thread_group, 'stringProp', 'ThreadGroup.duration', default='300')
            max_duration_seconds = max(max_duration_seconds, int(tg_duration))
        else:
            # Iteration-based
            loop_count = get_element_value(thread_group, 'elementProp/stringProp', 'LoopController.loops', default='1')
            continue_forever = get_element_value(thread_group, 'elementProp/boolProp', 'LoopController.continue_forever', default='false')
            
            if continue_forever.lower() != 'true' and loop_count != '-1':
                tg_iterations = int(loop_count)
                max_iterations = max(max_iterations, tg_iterations)
        
        thread_group_details.append({
            'name': tg_name,
            'threads': tg_threads,
            'rampTime': tg_ramp,
            'scheduler': tg_use_scheduler
        })
        
        print(f"  └─ {tg_name}: {tg_threads} threads, ramp {tg_ramp}s")
    
    # Determine final duration/iterations
    duration = None
    iterations = None
    
    if use_scheduler and max_duration_seconds > 0:
        # At least one group uses scheduler - use max duration
        duration = format_duration(max_duration_seconds)
    elif max_iterations > 0:
        # Iteration-based - use max iterations
        iterations = max_iterations
        estimated_seconds = iterations * 10
        duration = format_duration(estimated_seconds)
    else:
        # Default to 5 minutes
        duration = "5m"
    
    num_threads = total_threads
    ramp_time = max_ramp_time
    thread_group_name = f"{len(thread_groups)} Thread Groups" if len(thread_groups) > 1 else thread_groups[0].get('testname', 'Thread Group')
    
    # Calculate optimal number of containers
    num_containers = calculate_containers(num_threads)
    
    # Calculate JVM args based on threads
    jvm_args = calculate_jvm_args(num_threads)
    
    # Extract user-defined properties from JMX
    jmeter_properties = extract_properties(root)
    
    # Apply overrides
    jmeter_properties.update(property_overrides)
    
    return {
        'threads': num_threads,
        'duration': duration,
        'iterations': iterations,
        'numOfContainers': num_containers,
        'jvmArgs': jvm_args,
        'jmeterProperties': jmeter_properties,
        'testDetails': {
            'threadGroupName': thread_group_name,
            'rampTime': ramp_time,
            'scheduler': use_scheduler,
            'estimatedDurationSeconds': parse_duration_to_seconds(duration) if duration else None
        }
    }


def find_all_thread_groups(root: ET.Element) -> list:
    """Find all ThreadGroup elements in JMX."""
    
    thread_groups = []
    
    # Try different ThreadGroup types
    thread_group_classes = [
        'ThreadGroup',
        'SetupThreadGroup',
        'PostThreadGroup',
        'com.blazemeter.jmeter.threads.concurrency.ConcurrencyThreadGroup'
    ]
    
    for tg_class in thread_group_classes:
        for elem in root.iter():
            if elem.get('testclass') == tg_class:
                thread_groups.append(elem)
    
    return thread_groups


def find_thread_group(root: ET.Element) -> Optional[ET.Element]:
    """Find the first ThreadGroup element in JMX (legacy - use find_all_thread_groups)."""
    
    thread_groups = find_all_thread_groups(root)
    return thread_groups[0] if thread_groups else None


def get_element_value(parent: ET.Element, element_type: str, name: str, default: str = '') -> str:
    """Get value from JMX element by name attribute."""
    
    # Handle nested paths (e.g., 'elementProp/stringProp')
    if '/' in element_type:
        parts = element_type.split('/')
        current = parent
        
        for part in parts[:-1]:
            found = current.find(f".//{part}")
            if found is None:
                return default
            current = found
        
        element_type = parts[-1]
        parent = current
    
    for elem in parent.findall(f".//{element_type}"):
        if elem.get('name') == name:
            return elem.text or default
    
    return default


def calculate_containers(num_threads: int) -> int:
    """
    Calculate optimal number of containers based on thread count.
    
    Rules:
    - 1-50 threads: 1 container
    - 51-200 threads: 2 containers
    - 201-500 threads: 3-5 containers
    - 501+: Scale at ~100 threads per container
    """
    
    if num_threads <= 50:
        return 1
    elif num_threads <= 200:
        return 2
    elif num_threads <= 500:
        return math.ceil(num_threads / 100)
    else:
        return math.ceil(num_threads / 100)


def calculate_jvm_args(num_threads: int) -> str:
    """
    Calculate JVM memory settings based on thread count.
    
    Rules:
    - 1-50 threads: 512m-2g
    - 51-200 threads: 1g-3g
    - 201-500 threads: 2g-4g
    - 501+: 4g-8g
    """
    
    if num_threads <= 50:
        return "-Xms512m -Xmx2g"
    elif num_threads <= 200:
        return "-Xms1g -Xmx3g"
    elif num_threads <= 500:
        return "-Xms2g -Xmx4g"
    else:
        return "-Xms4g -Xmx8g"


def format_duration(seconds: int) -> str:
    """Convert seconds to human-readable duration (e.g., '5m', '1h30m')."""
    
    if seconds < 60:
        return f"{seconds}s"
    
    minutes = seconds // 60
    remaining_seconds = seconds % 60
    
    if minutes < 60:
        if remaining_seconds > 0:
            return f"{minutes}m{remaining_seconds}s"
        return f"{minutes}m"
    
    hours = minutes // 60
    remaining_minutes = minutes % 60
    
    if remaining_minutes > 0:
        return f"{hours}h{remaining_minutes}m"
    return f"{hours}h"


def parse_duration_to_seconds(duration: str) -> int:
    """Convert duration string to seconds."""
    
    if not duration:
        return 300  # Default 5 minutes
    
    total_seconds = 0
    
    # Parse hours
    hours_match = re.search(r'(\d+)h', duration)
    if hours_match:
        total_seconds += int(hours_match.group(1)) * 3600
    
    # Parse minutes
    minutes_match = re.search(r'(\d+)m', duration)
    if minutes_match:
        total_seconds += int(minutes_match.group(1)) * 60
    
    # Parse seconds
    seconds_match = re.search(r'(\d+)s', duration)
    if seconds_match:
        total_seconds += int(seconds_match.group(1))
    
    return total_seconds if total_seconds > 0 else 300


def extract_properties(root: ET.Element) -> Dict[str, Any]:
    """Extract user-defined properties from JMX file."""
    
    properties = {}
    
    # Look for User Defined Variables
    for elem in root.iter():
        if elem.get('testclass') == 'Arguments' and elem.get('testname') == 'User Defined Variables':
            for arg in elem.findall('.//elementProp'):
                name = arg.get('name')
                value_elem = arg.find('.//stringProp[@name="Argument.value"]')
                
                if name and value_elem is not None:
                    value = value_elem.text or ''
                    
                    # Try to convert to appropriate type
                    if value.lower() in ['true', 'false']:
                        properties[name] = value.lower() == 'true'
                    elif value.isdigit():
                        properties[name] = int(value)
                    elif re.match(r'^\d+\.\d+$', value):
                        properties[name] = float(value)
                    else:
                        properties[name] = value
    
    return properties