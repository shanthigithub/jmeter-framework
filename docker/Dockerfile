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

# Create Python DogStatsD forwarder
RUN cat > /usr/local/bin/dogstatsd-forwarder.py << 'EOF'
#!/usr/bin/env python3
"""
Lightweight DogStatsD-compatible metrics forwarder
Reads JMeter metrics from stdin and forwards to Datadog
"""
import os
import sys
import time
import re
from datadog import initialize, statsd

# Initialize Datadog
options = {
    'api_key': os.environ.get('DD_API_KEY'),
    'app_key': None,
    'statsd_host': '127.0.0.1',
    'statsd_port': 8125,
}

# Get Datadog site from environment
dd_site = os.environ.get('DD_SITE', 'datadoghq.com')
if dd_site:
    options['api_host'] = f'https://api.{dd_site}'

initialize(**options)

# Get tags from environment
test_id = os.environ.get('TEST_ID', 'unknown')
run_id = os.environ.get('RUN_ID', 'unknown')
container_id = os.environ.get('CONTAINER_ID', 'unknown')

base_tags = [
    f'test_id:{test_id}',
    f'run_id:{run_id}',
    f'container_id:{container_id}',
    'source:jmeter'
]

print(f"🐶 DogStatsD forwarder started - sending metrics to {dd_site}", flush=True)
print(f"📊 Tags: {base_tags}", flush=True)

# Parse JMeter summary line and send metrics
# Example: summary =     16 in 00:00:11 =    1.5/s Avg:   168 Min:    84 Max:   324 Err:     0 (0.00%)
pattern = re.compile(
    r'summary.*?=\s+([\d.]+)/s.*?Avg:\s+([\d.]+).*?Min:\s+([\d.]+).*?Max:\s+([\d.]+).*?Err:\s+([\d.]+)\s+\(([\d.]+)%\)'
)

for line in sys.stdin:
    line = line.strip()
    if 'summary' in line and '=' in line:
        match = pattern.search(line)
        if match:
            throughput = float(match.group(1))
            avg_time = int(match.group(2))
            min_time = int(match.group(3))
            max_time = int(match.group(4))
            errors = int(match.group(5))
            error_pct = float(match.group(6))
            
            # Send metrics to Datadog
            statsd.gauge('jmeter.throughput', throughput, tags=base_tags)
            statsd.gauge('jmeter.response_time.avg', avg_time, tags=base_tags)
            statsd.gauge('jmeter.response_time.min', min_time, tags=base_tags)
            statsd.gauge('jmeter.response_time.max', max_time, tags=base_tags)
            statsd.gauge('jmeter.errors', errors, tags=base_tags)
            statsd.gauge('jmeter.error_rate', error_pct, tags=base_tags)
            
            print(f"📈 Metrics sent: throughput={throughput}/s, avg={avg_time}ms, errors={error_pct}%", flush=True)

print("🐶 DogStatsD forwarder stopped", flush=True)
EOF

RUN chmod +x /usr/local/bin/dogstatsd-forwarder.py

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