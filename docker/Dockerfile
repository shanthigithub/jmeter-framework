# JMeter Batch Docker Image
# Lightweight, optimized for AWS Batch with S3 dynamic loading

FROM alpine:3.19

# JMeter version
ARG JMETER_VERSION=5.6.3

# Install dependencies
RUN apk add --no-cache \
    openjdk17-jre \
    curl \
    bash \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages --no-cache-dir awscli

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
    # Install commonly used plugins directly from Maven
    && cd /opt/jmeter/lib/ext \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-casutg/2.10/jmeter-plugins-casutg-2.10.jar -o jmeter-plugins-casutg-2.10.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-dummy/0.4/jmeter-plugins-dummy-0.4.jar -o jmeter-plugins-dummy-0.4.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-ffw/2.0/jmeter-plugins-ffw-2.0.jar -o jmeter-plugins-ffw-2.0.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-functions/2.2/jmeter-plugins-functions-2.2.jar -o jmeter-plugins-functions-2.2.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-json/2.7/jmeter-plugins-json-2.7.jar -o jmeter-plugins-json-2.7.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-perfmon/2.1/jmeter-plugins-perfmon-2.1.jar -o jmeter-plugins-perfmon-2.1.jar \
    && curl -L https://repo1.maven.org/maven2/kg/apc/jmeter-plugins-cmn-jmeter/0.7/jmeter-plugins-cmn-jmeter-0.7.jar -o jmeter-plugins-cmn-jmeter-0.7.jar \
    # Download dependencies for plugins
    && curl -L https://repo1.maven.org/maven2/kg/apc/perfmon/2.2.2/perfmon-2.2.2.jar -o perfmon-2.2.2.jar \
    && curl -L https://repo1.maven.org/maven2/org/apache/commons/commons-pool2/2.11.1/commons-pool2-2.11.1.jar -o commons-pool2-2.11.1.jar

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