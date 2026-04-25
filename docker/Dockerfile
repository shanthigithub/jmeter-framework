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
    # Download Command-line runner for plugin installation
    && curl -L https://repo1.maven.org/maven2/kg/apc/cmdrunner/2.3/cmdrunner-2.3.jar -o cmdrunner-2.3.jar \
    && java -cp cmdrunner-2.3.jar kg.apc.cmdrunner.PluginsManagerCMD install-all-except jpgc-hadoop,jpgc-oauth,ulp-jmeter-autocorrelator-plugin,ulp-jmeter-videostreaming-plugin,ulp-jmeter-gwt-plugin,tilln-iso8583 \
    # Clean up
    && rm -f cmdrunner-2.3.jar

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