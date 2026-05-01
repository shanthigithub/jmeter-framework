#!/usr/bin/env python3
"""
Update JMX file to use threadsPerContainer property for parallel execution.
Replaces hardcoded thread counts with JMeter property references.
"""
import sys
import re

def update_jmx_threads(jmx_file):
    """Replace hardcoded thread counts with property references."""
    with open(jmx_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Count occurrences before replacement
    original_count = content.count('<intProp name="ThreadGroup.num_threads">')
    
    # Replace intProp with stringProp and use JMeter property
    # Pattern: <intProp name="ThreadGroup.num_threads">NUMBER</intProp>
    # Replace with: <stringProp name="ThreadGroup.num_threads">${__P(threadsPerContainer,NUMBER)}</stringProp>
    
    def replace_thread_count(match):
        default_value = match.group(1)
        return f'<stringProp name="ThreadGroup.num_threads">${{__P(threadsPerContainer,{default_value})}}</stringProp>'
    
    pattern = r'<intProp name="ThreadGroup\.num_threads">(\d+)</intProp>'
    updated_content = re.sub(pattern, replace_thread_count, content)
    
    # Count replacements
    updated_count = updated_content.count('${__P(threadsPerContainer,')
    
    # Write back
    with open(jmx_file, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"[SUCCESS] Updated {updated_count} ThreadGroup(s) to use threadsPerContainer property")
    print(f"   File: {jmx_file}")
    
    return updated_count

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python update-jmx-threads.py <jmx-file>")
        sys.exit(1)
    
    jmx_file = sys.argv[1]
    count = update_jmx_threads(jmx_file)
    
    if count > 0:
        print(f"\n[NEXT STEPS]")
        print(f"   1. Review the changes in {jmx_file}")
        print(f"   2. Upload to S3: aws s3 cp {jmx_file} s3://jmeter-framework-config/tests/")
        print(f"   3. Run test to verify thread distribution")
    else:
        print("[WARNING] No ThreadGroups found to update")
        sys.exit(1)
