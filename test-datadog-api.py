#!/usr/bin/env python3
"""
Test script to verify Datadog API connectivity and permissions
Run this locally to debug why metrics aren't appearing
"""
import os
import time
from datadog import initialize, api

# Use your actual values
DD_API_KEY = "cb071ead8b2f15d1ecd5f9798ec6ebae"
DD_SITE = "us5.datadoghq.com"

print(f"Testing Datadog API connectivity...")
print(f"API Key: {DD_API_KEY[:10]}...")
print(f"Site: {DD_SITE}")
print()

# Initialize
initialize(
    api_key=DD_API_KEY,
    api_host=f'https://api.{DD_SITE}'
)

# Test metric send
now = int(time.time())
test_tags = ['test:manual', 'source:python']

metrics = [
    {'metric': 'test.jmeter.throughput', 'points': [(now, 1.5)], 'tags': test_tags},
    {'metric': 'test.jmeter.response_time', 'points': [(now, 100)], 'tags': test_tags},
]

print("Sending test metrics...")
try:
    result = api.Metric.send(metrics)
    print(f"✅ SUCCESS!")
    print(f"Response: {result}")
    print()
    print("Check Datadog in 1-2 minutes:")
    print(f"https://{DD_SITE}/metric/explorer")
    print("Search for: test.jmeter.throughput")
except Exception as e:
    print(f"❌ FAILED!")
    print(f"Error: {e}")
    print()
    print("Possible issues:")
    print("1. API key invalid or doesn't have Metrics Write permission")
    print("2. Site region incorrect")
    print("3. Network connectivity issue")