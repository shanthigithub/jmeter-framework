#!/usr/bin/env python3
"""
Fix Chrome Options in JMeter JMX file for containerized execution
Adds all necessary headless options for AWS ECS environment
"""
import re
import sys

def fix_chrome_options(jmx_content):
    """
    Fix ChromeOptions initialization in JSR223 samplers
    Adds headless and container-safe options
    """
    
    # Pattern to find ChromeOptions initialization
    # Looking for the pattern where Chrome is initialized
    old_pattern = r'(ChromeOptions options = new ChromeOptions\(\);)\s*' \
                  r'(options\.setBinary\([^)]+\);)\s*' \
                  r'(driver = new ChromeDriver\(options\);)'
    
    # New code with proper headless options
    new_code = r'''\1
    \2
    options.addArguments("--headless");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");
    options.addArguments("--start-maximized");
    options.addArguments("--disable-infobars");
    options.addArguments("--disable-extensions");
    options.addArguments("--disable-blink-features=AutomationControlled");
    options.addArguments("--remote-debugging-port=9222");
    
    \3'''
    
    # Apply the fix
    fixed_content = re.sub(old_pattern, new_code, jmx_content, flags=re.MULTILINE)
    
    # Also fix the chromeBinaryPath to use the correct path
    fixed_content = fixed_content.replace(
        'String chromeBinaryPath = &quot;${chromePath}&quot;;',
        'String chromeBinaryPath = &quot;/usr/bin/chromium&quot;;'
    )
    
    # Count how many replacements were made
    matches = len(re.findall(old_pattern, jmx_content, flags=re.MULTILINE))
    
    return fixed_content, matches

def main():
    input_file = 'tests/Sureprep_UI_Approval_AprRelease_27Mar_Headless_Chrome_V1.jmx'
    output_file = 'tests/Sureprep_UI_Approval_AprRelease_27Mar_Headless_Chrome_V1_FIXED.jmx'
    
    print(f"Reading {input_file}...")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: {input_file} not found!")
        sys.exit(1)
    
    print("Applying Chrome options fixes...")
    fixed_content, num_fixes = fix_chrome_options(content)
    
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"✅ Done! Applied {num_fixes} Chrome options fixes")
    print(f"\nChanges made:")
    print("  - Fixed Chrome binary path to /usr/bin/chromium")
    print("  - Added --headless mode")
    print("  - Added --no-sandbox (required for containers)")
    print("  - Added --disable-dev-shm-usage (prevents memory issues)")
    print("  - Added --disable-gpu")
    print("  - Added window size 1920x1080")
    print("  - Added other stability options")
    print(f"\nNew file: {output_file}")

if __name__ == '__main__':
    main()