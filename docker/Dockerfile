# JMeter Batch Docker Image
# Lightweight, optimized for AWS Batch with S3 dynamic loading

FROM alpine:3.19

# JMeter version
ARG JMETER_VERSION=5.6.3

# Install dependencies including Datadog agent
RUN apk add --no-cache \
    openjdk17-jre \
    curl \
    bash \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages --no-cache-dir awscli \
    && pip3 install --break-system-packages --no-cache-dir datadog

# Download and install JMeter
RUN mkdir /opt/jmeter \
    && cd /opt \
    && curl -L https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz \
        -o apache-jmeter-${JMETER_VERSION}.tgz \
    && tar -xzf apache-jmeter-${JMETER_VERSION}.tgz \
    && rm apache-jmeter-${JMETER_VERSION}.tgz \
    && mv apache-jmeter-${JMETER_VERSION}/* /opt/jmeter/ \
    && rm -rf apache-jmeter-${JMETER_VERSION}

# Add JMeter to PATH
ENV PATH="/opt/jmeter/bin:${PATH}"
ENV JMETER_HOME="/opt/jmeter"

# Install JMeter Plugins Manager and common plugins
RUN cd /opt/jmeter/lib/ext \
    # Download Plugins Manager
    && curl -L https://jmeter-plugins.org/get/ -o jmeter-plugins-manager.jar \
    # Download Command Runner JAR
    && curl -L https://repo1.maven.org/maven2/kg/apc/cmdrunner/2.3/cmdrunner-2.3.jar -o /opt/jmeter/lib/cmdrunner-2.3.jar \
    # Install kg.apc (jpgc) plugins from Maven
    && cd /opt/jmeter/lib/ext \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-casutg/2.10/jmeter-plugins-casutg-2.10.jar -o jmeter-plugins-casutg-2.10.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-dummy/0.4/jmeter-plugins-dummy-0.4.jar -o jmeter-plugins-dummy-0.4.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-ffw/2.0/jmeter-plugins-ffw-2.0.jar -o jmeter-plugins-ffw-2.0.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-functions/2.2/jmeter-plugins-functions-2.2.jar -o jmeter-plugins-functions-2.2.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-json/2.7/jmeter-plugins-json-2.7.jar -o jmeter-plugins-json-2.7.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-perfmon/2.1/jmeter-plugins-perfmon-2.1.jar -o jmeter-plugins-perfmon-2.1.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-cmn-jmeter/0.7/jmeter-plugins-cmn-jmeter-0.7.jar -o jmeter-plugins-cmn-jmeter-0.7.jar \
    # Install BlazeMeter (bzm) plugins from Maven
    && curl -L https://repo1.maven.org/maven2/com/blazemeter/jmeter-parallel/0.11/jmeter-parallel-0.11.jar -o jmeter-parallel-0.11.jar \
    && curl -L https://repo1.maven.org/maven2/com/blazemeter/jmeter-plugins-random-csv-data-set/0.8/jmeter-plugins-random-csv-data-set-0.8.jar -o jmeter-plugins-random-csv-data-set-0.8.jar \
    && curl -L https://repo1.maven.org/maven2/com/blazemeter/jmeter-plugins-weighted-switch-controller/0.6/jmeter-plugins-weighted-switch-controller-0.6.jar -o jmeter-plugins-weighted-switch-controller-0.6.jar \
    && curl -L https://repo1.maven.org/maven2/com/blazemeter/jmeter-bzm-http2/1.5/jmeter-bzm-http2-1.5.jar -o jmeter-bzm-http2-1.5.jar \
    # Download dependencies for plugins
    && curl -L https://repo1.maven.org/maven2/kg/apc/perfmon/2.2.2/perfmon-2.2.2.jar -o perfmon-2.2.2.jar \
    && curl -L https://repo1.maven.org/maven2/org/apache/commons/commons-pool2/2.11.1/commons-pool2-2.11.1.jar -o commons-pool2-2.11.1.jar \
    && curl -L https://repo1.maven.org/maven2/org/apache/commons/commons-lang3/3.12.0/commons-lang3-3.12.0.jar -o commons-lang3-3.12.0.jar \
    # Install Datadog Backend Listener for JMeter
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-graphs-basic/2.0/jmeter-plugins-graphs-basic-2.0.jar -o jmeter-plugins-graphs-basic-2.0.jar

# Create Datadog metrics forwarder script (Python-based, compatible with Alpine ARM64)
RUN mkdir -p /usr/local/bin /etc/datadog

# Create Python real-time metrics processor (parses JTL for percentiles)
RUN cat > /usr/local/bin/datadog-realtime-metrics.py <<'METRICS_SCRIPT'
#!/usr/bin/env python3
import os
import sys
import csv
import time
import threading
from collections import deque
from datadog import initialize, api

# Initialize Datadog
dd_api_key = os.environ.get('DD_API_KEY')
dd_site = os.environ.get('DD_SITE', 'datadoghq.com')

initialize(
    api_key=dd_api_key,
    api_host=f'https://api.{dd_site}'
)

# Get tags
test_id = os.environ.get('TEST_ID', 'unknown')
run_id = os.environ.get('RUN_ID', 'unknown')
container_id = os.environ.get('CONTAINER_ID', 'unknown')

base_tags = [
    f'test_id:{test_id}',
    f'run_id:{run_id}',
    f'container_id:{container_id}',
    'source:jmeter'
]

print(f"📊 Real-time metrics processor started - sending to {dd_site}", flush=True)
print(f"🏷️  Tags: {base_tags}", flush=True)

# Sliding window for metrics (last 60 seconds)
WINDOW_SIZE = 60  # seconds
response_times = deque()
errors_count = deque()
active_threads = set()
last_send = time.time()
SEND_INTERVAL = 10  # Send metrics every 10 seconds

def calculate_percentile(values, percentile):
    if not values:
        return 0
    sorted_values = sorted(values)
    index = int(len(sorted_values) * percentile / 100)
    return sorted_values[min(index, len(sorted_values) - 1)]

def send_metrics():
    global response_times, errors_count, last_send
    
    now = int(time.time())
    current_time = time.time()
    
    # Clean old data (older than WINDOW_SIZE seconds)
    cutoff = current_time - WINDOW_SIZE
    response_times = deque([r for r in response_times if r['time'] > cutoff])
    errors_count = deque([e for e in errors_count if e['time'] > cutoff])
    
    if not response_times:
        return
    
    # Extract response time values
    rt_values = [r['elapsed'] for r in response_times]
    error_values = [e['success'] for e in errors_count]
    
    # Calculate metrics
    avg = sum(rt_values) / len(rt_values)
    p90 = calculate_percentile(rt_values, 90)
    p95 = calculate_percentile(rt_values, 95)
    p99 = calculate_percentile(rt_values, 99)
    
    error_count = sum(1 for e in error_values if not e)
    error_rate = (error_count / len(error_values) * 100) if error_values else 0
    
    throughput = len(rt_values) / WINDOW_SIZE
    active_users = len(active_threads)
    
    # Send to Datadog
    metrics = [
        {'metric': 'jmeter.response_time.avg', 'points': [(now, avg)], 'tags': base_tags},
        {'metric': 'jmeter.response_time.p90', 'points': [(now, p90)], 'tags': base_tags},
        {'metric': 'jmeter.response_time.p95', 'points': [(now, p95)], 'tags': base_tags},
        {'metric': 'jmeter.response_time.p99', 'points': [(now, p99)], 'tags': base_tags},
        {'metric': 'jmeter.throughput', 'points': [(now, throughput)], 'tags': base_tags},
        {'metric': 'jmeter.error_rate', 'points': [(now, error_rate)], 'tags': base_tags},
        {'metric': 'jmeter.active_users', 'points': [(now, active_users)], 'tags': base_tags},
    ]
    
    try:
        api.Metric.send(metrics)
        print(f"📈 Metrics: avg={avg:.0f}ms, p90={p90:.0f}ms, p95={p95:.0f}ms, p99={p99:.0f}ms, "
              f"throughput={throughput:.2f}/s, errors={error_rate:.2f}%, active_users={active_users}", flush=True)
    except Exception as e:
        print(f"❌ Error sending metrics: {e}", flush=True)
    
    last_send = current_time

# Get JTL file path from command line
if len(sys.argv) < 2:
    print("Usage: datadog-realtime-metrics.py <jtl_file>", flush=True)
    sys.exit(1)

jtl_file = sys.argv[1]

# Wait for JTL file to be created
while not os.path.exists(jtl_file):
    time.sleep(1)

print(f"📄 Monitoring JTL file: {jtl_file}", flush=True)

# Tail the JTL file
with open(jtl_file, 'r') as f:
    # Skip header
    header = f.readline()
    
    while True:
        line = f.readline()
        
        if line:
            try:
                # Parse JTL CSV line
                # Format: timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
                parts = line.strip().split(',')
                
                if len(parts) >= 13:
                    timestamp = int(parts[0])
                    elapsed = int(parts[1])
                    thread_name = parts[5]
                    success = parts[7].lower() == 'true'
                    all_threads = int(parts[12])
                    
                    current_time = time.time()
                    
                    # Add to sliding window
                    response_times.append({
                        'time': current_time,
                        'elapsed': elapsed
                    })
                    
                    errors_count.append({
                        'time': current_time,
                        'success': success
                    })
                    
                    # Track active threads
                    active_threads.add(thread_name)
                    
                    # Send metrics every SEND_INTERVAL seconds
                    if current_time - last_send >= SEND_INTERVAL:
                        send_metrics()
                        
            except Exception as e:
                print(f"⚠️  Error parsing line: {e}", flush=True)
        else:
            # No new line, wait a bit
            time.sleep(0.1)
            
            # Still send metrics if interval elapsed
            if time.time() - last_send >= SEND_INTERVAL:
                send_metrics()

print("📊 Metrics processor stopped", flush=True)
METRICS_SCRIPT

RUN chmod +x /usr/local/bin/datadog-realtime-metrics.py

# Create directories
RUN mkdir -p /jmeter /jmeter/scripts /jmeter/data /jmeter/results

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set working directory
WORKDIR /jmeter

# Health check (for ECS, though not strictly needed for Batch)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pgrep -f jmeter || exit 1

ENTRYPOINT ["/entrypoint.sh"]