#!/usr/bin/env python3
"""
Playwright Test Template for JMeter Batch Framework
Writes results in JTL format compatible with merge-results Lambda

Usage:
  This script is automatically invoked by the framework when a .py test is detected.
  Environment variables are set by entrypoint.sh:
    - RESULTS_BUCKET: S3 bucket for results
    - CONTAINER_ID: Container identifier
    - RUN_ID: Test run identifier
    - TEST_ID: Test identifier
    - RESULTS_PREFIX: S3 prefix for results
"""

import os
import sys
import time
import csv
import boto3
from playwright.sync_api import sync_playwright

# Get environment variables (set by entrypoint.sh)
RESULTS_BUCKET = os.environ.get('RESULTS_BUCKET', '')
CONTAINER_ID = os.environ.get('CONTAINER_ID', '0')
RUN_ID = os.environ.get('RUN_ID', 'unknown')
TEST_ID = os.environ.get('TEST_ID', 'unknown')
RESULTS_PREFIX = os.environ.get('RESULTS_PREFIX', 'results')

# Results file path (must match what merge-results expects)
RESULTS_FILE = f'/tmp/results-{CONTAINER_ID}.jtl'

print(f"========================================")
print(f"Playwright Test Execution")
print(f"========================================")
print(f"Test ID: {TEST_ID}")
print(f"Run ID: {RUN_ID}")
print(f"Container ID: {CONTAINER_ID}")
print(f"Results File: {RESULTS_FILE}")
print(f"========================================\n")


def write_jtl_record(writer, label, elapsed_ms, success, response_code=200, url='', error_msg=''):
    """
    Write a single result record in JMeter JTL CSV format.
    
    This format is compatible with merge-results Lambda and JMeter's standard output.
    """
    writer.writerow({
        'timeStamp': int(time.time() * 1000),  # Milliseconds since epoch
        'elapsed': int(elapsed_ms),             # Duration in milliseconds
        'label': label,                         # Step/transaction name
        'responseCode': response_code,          # HTTP status or custom code
        'responseMessage': 'OK' if success else (error_msg or 'FAILED'),
        'threadName': f'Playwright-{CONTAINER_ID}',  # Virtual user identifier
        'dataType': 'text',                     # Data type
        'success': 'true' if success else 'false',  # Pass/fail status
        'bytes': 0,                             # Response size (optional)
        'URL': url                              # URL accessed
    })


def run_example_test():
    """
    Example Playwright test - Replace this with your actual test logic.
    
    This example demonstrates:
    - Navigation
    - Form filling
    - Button clicking
    - Element waiting
    - Error handling
    - JTL result writing
    """
    with open(RESULTS_FILE, 'w', newline='') as f:
        # JTL CSV format (same as JMeter)
        fieldnames = ['timeStamp', 'elapsed', 'label', 'responseCode',
                     'responseMessage', 'threadName', 'dataType', 'success',
                     'bytes', 'URL']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        with sync_playwright() as p:
            # Launch browser (headless mode for container execution)
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ]
            )
            
            page = browser.new_page()
            
            try:
                # ===== Step 1: Navigate to Application =====
                step_name = '01_Navigate_Homepage'
                print(f"[STEP] {step_name}")
                start = time.time()
                
                try:
                    response = page.goto('https://example.com', wait_until='domcontentloaded')
                    elapsed = (time.time() - start) * 1000
                    
                    write_jtl_record(
                        writer, step_name, elapsed,
                        success=response.ok,
                        response_code=response.status,
                        url=response.url
                    )
                    print(f"  ✅ Navigated to homepage ({int(elapsed)}ms)")
                    
                except Exception as e:
                    elapsed = (time.time() - start) * 1000
                    write_jtl_record(
                        writer, step_name, elapsed,
                        success=False,
                        response_code=500,
                        url='https://example.com',
                        error_msg=str(e)
                    )
                    print(f"  ❌ Navigation failed: {e}")
                    raise
                
                # ===== Step 2: Click "More information" Link =====
                step_name = '02_Click_More_Info'
                print(f"[STEP] {step_name}")
                start = time.time()
                
                try:
                    page.click('a:has-text("More information")', timeout=5000)
                    page.wait_for_load_state('networkidle')
                    elapsed = (time.time() - start) * 1000
                    
                    write_jtl_record(
                        writer, step_name, elapsed,
                        success=True,
                        response_code=200,
                        url=page.url
                    )
                    print(f"  ✅ Clicked link ({int(elapsed)}ms)")
                    
                except Exception as e:
                    elapsed = (time.time() - start) * 1000
                    write_jtl_record(
                        writer, step_name, elapsed,
                        success=False,
                        response_code=500,
                        error_msg=str(e)
                    )
                    print(f"  ❌ Click failed: {e}")
                    raise
                
                # ===== Step 3: Verify Page Content =====
                step_name = '03_Verify_Content'
                print(f"[STEP] {step_name}")
                start = time.time()
                
                try:
                    # Check if expected content is present
                    content = page.content()
                    expected_text = 'Example Domain'
                    
                    if expected_text in content:
                        elapsed = (time.time() - start) * 1000
                        write_jtl_record(
                            writer, step_name, elapsed,
                            success=True,
                            response_code=200,
                            url=page.url
                        )
                        print(f"  ✅ Content verified ({int(elapsed)}ms)")
                    else:
                        elapsed = (time.time() - start) * 1000
                        write_jtl_record(
                            writer, step_name, elapsed,
                            success=False,
                            response_code=500,
                            error_msg=f'Expected text "{expected_text}" not found'
                        )
                        print(f"  ❌ Content verification failed")
                        raise AssertionError(f'Expected text "{expected_text}" not found')
                        
                except Exception as e:
                    elapsed = (time.time() - start) * 1000
                    write_jtl_record(
                        writer, step_name, elapsed,
                        success=False,
                        response_code=500,
                        error_msg=str(e)
                    )
                    print(f"  ❌ Verification failed: {e}")
                    raise
                
                print("\n✅ Test completed successfully")
                return 0
                
            except Exception as e:
                print(f"\n❌ Test failed: {e}")
                return 1
                
            finally:
                browser.close()


def upload_results_to_s3():
    """Upload results file to S3 (same location as JMeter results)"""
    if not RESULTS_BUCKET:
        print("⚠️  RESULTS_BUCKET not set, skipping S3 upload")
        return
    
    if not os.path.exists(RESULTS_FILE):
        print(f"⚠️  Results file not found: {RESULTS_FILE}")
        return
    
    try:
        s3 = boto3.client('s3')
        s3_key = f"{RESULTS_PREFIX}/container-{CONTAINER_ID}/results-{CONTAINER_ID}.jtl"
        
        print(f"\n[UPLOAD] Uploading results to S3...")
        print(f"  Bucket: {RESULTS_BUCKET}")
        print(f"  Key: {s3_key}")
        
        s3.upload_file(RESULTS_FILE, RESULTS_BUCKET, s3_key)
        
        print(f"✅ Results uploaded: s3://{RESULTS_BUCKET}/{s3_key}")
        
    except Exception as e:
        print(f"❌ Failed to upload results: {e}")


if __name__ == '__main__':
    print("🚀 Starting Playwright test execution\n")
    
    # Run the test
    exit_code = run_example_test()
    
    # Results are written to file during test execution
    print(f"\n📊 Results written to: {RESULTS_FILE}")
    
    # Show result summary
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, 'r') as f:
            lines = f.readlines()
            total = len(lines) - 1  # Subtract header
            print(f"📊 Total steps executed: {total}")
            
            # Count successes and failures
            if total > 0:
                successes = sum(1 for line in lines[1:] if ',true,' in line)
                failures = total - successes
                print(f"   ✅ Passed: {successes}")
                print(f"   ❌ Failed: {failures}")
    
    # Upload is handled by entrypoint.sh, but we can also do it here if needed
    # upload_results_to_s3()
    
    print(f"\n[EXIT] Test exiting with code: {exit_code}")
    sys.exit(exit_code)