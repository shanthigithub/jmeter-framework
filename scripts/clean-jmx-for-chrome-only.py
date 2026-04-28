#!/usr/bin/env python3
"""
Clean JMX file to remove Firefox and Edge, keep only Chrome with proper headless options
"""
import re
import sys

def clean_jmx_for_chrome_only(jmx_content):
    """
    Remove all Firefox and Edge references, keep only Chrome with proper options
    """
    
    # Remove Firefox imports
    jmx_content = re.sub(r'import org\.openqa\.selenium\.firefox\.Firefox[^;]+;?\s*', '', jmx_content, flags=re.IGNORECASE)
    
    # Remove Edge imports  
    jmx_content = re.sub(r'import org\.openqa\.selenium\.edge\.Edge[^;]+;?\s*', '', jmx_content, flags=re.IGNORECASE)
    
    # Remove Firefox driver instantiation and options
    jmx_content = re.sub(r'FirefoxOptions[^;]+;?\s*', '', jmx_content)
    jmx_content = re.sub(r'new FirefoxDriver[^;]+;?\s*', '', jmx_content)
    jmx_content = re.sub(r'FirefoxDriver[^;]+;?\s*', '', jmx_content)
    
    # Remove Edge driver instantiation and options
    jmx_content = re.sub(r'EdgeOptions[^;]+;?\s*', '', jmx_content)
    jmx_content = re.sub(r'new EdgeDriver[^;]+;?\s*', '', jmx_content)
    jmx_content = re.sub(r'EdgeDriver[^;]+;?\s*', '', jmx_content)
    
    # Fix Chrome binary path
    jmx_content = jmx_content.replace(
        'String chromeBinaryPath = &quot;${chromePath}&quot;;',
        'String chromeBinaryPath = &quot;/usr/bin/chromium&quot;;'
    )
    
    # Pattern to find basic ChromeOptions initialization WITHOUT proper headless options
    # Look for cases where Chrome is initialized but missing our options
    pattern = r'(ChromeOptions options = new ChromeOptions\(\);)\s*' \
              r'(options\.setBinary\([^)]+\);)\s*' \
              r'(?!.*--headless)' \
              r'(driver = new ChromeDriver\(options\);)'
    
    # Add comprehensive headless options
    replacement = r'''\1
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
    
    jmx_content = re.sub(pattern, replacement, jmx_content, flags=re.MULTILINE | re.DOTALL)
    
    return jmx_content

def main():
    input_file = 'tests/Sureprep_UI_Approval_AprRelease_27Mar_Headless_Chrome_V1.jmx'
    output_file = 'tests/Sureprep_UI_Approval_AprRelease_27Mar_Headless_Chrome_V1_CLEAN.jmx'
    
    print(f"Reading {input_file}...")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: {input_file} not found!")
        sys.exit(1)
    
    print("Cleaning file...")
    print("  - Removing Firefox imports and code")
    print("  - Removing Edge imports and code")
    print("  - Fixing Chrome binary path")
    print("  - Adding headless Chrome options")
    
    cleaned_content = clean_jmx_for_chrome_only(content)
    
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)
    
    print("Done! File cleaned successfully")
    print(f"\nNew file: {output_file}")

if __name__ == '__main__':
    main()