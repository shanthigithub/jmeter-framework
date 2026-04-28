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
# Using -f to fail on HTTP errors, --retry for robustness
RUN cd /opt/jmeter/lib/ext \
    # Download Plugins Manager
    && curl -fSL --retry 3 --retry-delay 2 https://jmeter-plugins.org/get/ -o jmeter-plugins-manager.jar \
    # Download Command Runner JAR
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/cmdrunner/2.3/cmdrunner-2.3.jar -o /opt/jmeter/lib/cmdrunner-2.3.jar \
    # Install kg.apc (jpgc) plugins from Maven
    && cd /opt/jmeter/lib/ext \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-casutg/2.10/jmeter-plugins-casutg-2.10.jar -o jmeter-plugins-casutg-2.10.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-dummy/0.4/jmeter-plugins-dummy-0.4.jar -o jmeter-plugins-dummy-0.4.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-ffw/2.0/jmeter-plugins-ffw-2.0.jar -o jmeter-plugins-ffw-2.0.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-functions/2.2/jmeter-plugins-functions-2.2.jar -o jmeter-plugins-functions-2.2.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-json/2.7/jmeter-plugins-json-2.7.jar -o jmeter-plugins-json-2.7.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-perfmon/2.1/jmeter-plugins-perfmon-2.1.jar -o jmeter-plugins-perfmon-2.1.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-cmn-jmeter/0.7/jmeter-plugins-cmn-jmeter-0.7.jar -o jmeter-plugins-cmn-jmeter-0.7.jar \
    # Install BlazeMeter (bzm) plugins from Maven
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/com/blazemeter/jmeter-parallel/0.11/jmeter-parallel-0.11.jar -o jmeter-parallel-0.11.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/com/blazemeter/jmeter-plugins-random-csv-data-set/0.8/jmeter-plugins-random-csv-data-set-0.8.jar -o jmeter-plugins-random-csv-data-set-0.8.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/com/blazemeter/jmeter-plugins-weighted-switch-controller/0.6/jmeter-plugins-weighted-switch-controller-0.6.jar -o jmeter-plugins-weighted-switch-controller-0.6.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/com/blazemeter/jmeter-bzm-http2/1.4/jmeter-bzm-http2-1.4.jar -o jmeter-bzm-http2-1.4.jar \
    # Download dependencies for plugins
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/perfmon/2.2.2/perfmon-2.2.2.jar -o perfmon-2.2.2.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/org/apache/commons/commons-pool2/2.11.1/commons-pool2-2.11.1.jar -o commons-pool2-2.11.1.jar \
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/org/apache/commons/commons-lang3/3.12.0/commons-lang3-3.12.0.jar -o commons-lang3-3.12.0.jar \
    # Install additional useful plugins
    && curl -fSL --retry 3 --retry-delay 2 https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-graphs-basic/2.0/jmeter-plugins-graphs-basic-2.0.jar -o jmeter-plugins-graphs-basic-2.0.jar \
    && echo "All JARs downloaded successfully with retry logic!"

# Copy Datadog forwarder script
COPY datadog-forwarder.py /usr/local/bin/datadog-forwarder.py
RUN chmod +x /usr/local/bin/datadog-forwarder.py

# Copy Log4j2 configuration (fixes "package scanning deprecated" warning)
COPY log4j2.xml /opt/jmeter/bin/log4j2.xml

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