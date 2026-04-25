# Datadog Real-Time Metrics Integration

## Overview

Your JMeter framework now includes **Datadog Python client** for sending custom metrics to Datadog **without modifying JMX scripts**.

## What's Included in Docker Image

✅ Python `datadog` library  
✅ DogStatsD binary (lightweight agent)  
✅ Ready for real-time metrics collection

---

## Integration Options

### Option 1: Python Datadog API (Simplest - Recommended)

Send metrics programmatically using Python in your test workflow.

**Pros:**
- No container changes needed
- Works immediately
- No agent overhead
- Simple API key configuration

**Implementation:** Add to a Lambda function or custom script

```python
from datadog import initialize, statsd
import time

# Initialize (run once)
initialize(api_key='your-api-key', app_key='your-app-key')

# Send metrics
statsd.gauge('jmeter.active_threads', 100, tags=['test_id:dcp-api', 'env:prod'])
statsd.increment('jmeter.requests.count', tags=['test_id:dcp-api', 'status:success'])
statsd.histogram('jmeter.response_time', 250, tags=['test_id:dcp-api', 'endpoint:/api/users'])
```

### Option 2: JMeter Backend Listener (Most Features)

Add Backend Listener to your JMX file for automatic metric collection.

**Pros:**
- Most detailed metrics
- Per-sampler granularity  
- Real-time during test
- Standard JMeter approach

**Setup:**

1. Open your JMX in JMeter GUI
2. Right-click Test Plan → Add → Listener → Backend Listener
3. Configure:
   ```
   Backend Listener Implementation: org.apache.jmeter.visualizers.backend.graphite.GraphiteBackendListenerClient
   
   graphiteHost: api.datadoghq.com
   graphitePort: 443
   rootMetricsPrefix: jmeter.${TEST_ID}.
   useRegexpForSamplersList: false
   summaryOnly: false
   ```

4. Add Datadog Graphite integration in Datadog UI

### Option 3: DogStatsD Agent in Container (Framework-Level)

Use the included DogStatsD agent for automatic metrics.

**Setup Required:**

1. **Add startup script** to entrypoint.sh:

```bash
# Start DogStatsD if API key provided
if [ -n "$DD_API_KEY" ]; then
    cat > /etc/datadog/dogstatsd.yaml <<EOF
api_key: ${DD_API_KEY}
hostname: jmeter-${TEST_ID}-${CONTAINER_INDEX}
dogstatsd_port: 8125
tags:
  - test_id:${TEST_ID}
  - run_id:${RUN_ID}
  - container:${CONTAINER_INDEX}
EOF
    
    nohup /usr/local/bin/dogstatsd -c /etc/datadog/dogstatsd.yaml &
fi
```

2. **Add environment variables** to ECS task definition:
   - `DD_API_KEY`: Your Datadog API key
   - `DD_SITE`: Your Datadog site (e.g., `datadoghq.com`)

3. **Send metrics from JMeter** using StatsD format:
   ```xml
   <BackendListener guiclass="BackendListenerGui" testclass="BackendListener">
     <stringProp name="classname">org.apache.jmeter.visualizers.backend.graphite.GraphiteBackendListenerClient</stringProp>
     <elementProp name="arguments">
       <stringProp name="graphiteHost">localhost</stringProp>
       <stringProp name="graphitePort">8125</stringProp>
     </elementProp>
   </BackendListener>
   ```

---

## Recommended Approach for Your Framework

### 🎯 Best Practice: Hybrid Approach

**For Test Execution Metrics (Real-time):**
- Use **Option 2** (Backend Listener in JMX)
- Gives you detailed per-request metrics during test

**For Framework Metrics (Orchestration):**
- Use **Option 1** (Python API in Lambda)
- Track test starts, completions, container counts, etc.

---

## Quick Start: Add Backend Listener to JMX

### Step 1: Install Datadog JMeter Plugin

The Docker image already includes the base GraphiteBackendListenerClient. For enhanced Datadog features:

```bash
# Download Datadog JMeter plugin JAR
curl -L https://github.com/DataDog/jmeter-datadog-backend-listener/releases/download/v1.0.0/datadog-jmeter-plugin-1.0.0.jar \
  -o datadog-jmeter-plugin.jar

# Upload to S3 for use in tests
aws s3 cp datadog-jmeter-plugin.jar s3://your-config-bucket/plugins/
```

### Step 2: Add to JMX File

In JMeter GUI:

1. Right-click **Test Plan**
2. Add → Listener → **Backend Listener**
3. Set Implementation:
   - For Datadog plugin: `org.datadog.jmeter.plugins.DatadogBackendClient`
   - For standard Graphite: `org.apache.jmeter.visualizers.backend.graphite.GraphiteBackendListenerClient`

4. Configure Parameters:
   ```
   apiKey: <your-datadog-api-key>
   datadogUrl: https://api.datadoghq.com/api/v1/series
   prefix: jmeter
   tags: env:production,test_id:dcp-api
   ```

### Step 3: Run Test

Metrics will appear in Datadog automatically during test execution.

---

## Metrics You'll See in Datadog

### Standard JMeter Metrics
- `jmeter.test.minAT` - Min active threads
- `jmeter.test.maxAT` - Max active threads
- `jmeter.test.meanAT` - Mean active threads
- `jmeter.all.a.count` - Total requests
- `jmeter.all.ok.count` - Successful requests  
- `jmeter.all.ko.count` - Failed requests
- `jmeter.all.a.min` - Min response time
- `jmeter.all.a.max` - Max response time
- `jmeter.all.a.avg` - Average response time
- `jmeter.all.a.pct90.0` - 90th percentile
- `jmeter.all.a.pct95.0` - 95th percentile
- `jmeter.all.a.pct99.0` - 99th percentile

### Per-Sampler Metrics
- `jmeter.<sampler-name>.ok.count`
- `jmeter.<sampler-name>.ko.count`  
- `jmeter.<sampler-name>.ok.avg`
- `jmeter.<sampler-name>.ok.pct95.0`

---

## Environment Variables Reference

If using DogStatsD (Option 3):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DD_API_KEY` | Yes | Datadog API key | `a1b2c3d4...` |
| `DD_SITE` | No | Datadog site | `datadoghq.com` (default) |
| `DD_ENV` | No | Environment tag | `production`, `staging` |
| `DD_SERVICE` | No | Service name | `jmeter-load-test` |
| `DD_TAGS` | No | Additional tags | `team:performance,project:api` |

---

## Example Datadog Dashboard Queries

### Active Threads Over Time
```
avg:jmeter.test.meanAT{test_id:dcp-api}
```

### Request Rate
```
per_minute(sum:jmeter.all.a.count{test_id:dcp-api})
```

### Error Rate %
```
(sum:jmeter.all.ko.count{test_id:dcp-api} / sum:jmeter.all.a.count{test_id:dcp-api}) * 100
```

### Response Time Percentiles
```
avg:jmeter.all.a.pct95.0{test_id:dcp-api}
avg:jmeter.all.a.pct99.0{test_id:dcp-api}
```

---

## Troubleshooting

### No Metrics Appearing in Datadog

**Check 1:** Verify API key
```bash
# Test API key
curl -X POST "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: your-api-key"
```

**Check 2:** Check DogStatsD logs (if using Option 3)
```bash
# In container
cat /tmp/dogstatsd.log
```

**Check 3:** Verify Backend Listener in JMX
- Ensure Backend Listener is enabled
- Check jmeter.log for errors
- Verify network connectivity from container

### Metrics Delayed

- DogStatsD sends metrics every 10 seconds by default
- Backend Listener flushes every 5 seconds
- Datadog ingestion can take 30-60 seconds

### High Cardinality Warning

Avoid high-cardinality tags:
- ❌ DON'T use: `user_id`, `request_id`, `timestamp`
- ✅ DO use: `test_id`, `env`, `endpoint`, `status_code`

---

## Next Steps

1. **Choose your approach** (Recommendation: Option 2 - Backend Listener)
2. **Get your Datadog API key** from Datadog UI → Integrations → APIs
3. **Add Backend Listener** to your JMX file
4. **Run a test** and check Datadog for metrics
5. **Create dashboards** in Datadog to visualize results

---

## Summary

- ✅ Docker image ready with Datadog support
- ✅ Three integration options available
- ✅ No JMX modifications needed (Options 1 & 3)
- ✅ Real-time metrics during test execution
- ✅ Framework-level and test-level metrics supported

**Recommended:** Add Backend Listener to your JMX files for automatic, detailed, real-time metrics in Datadog.