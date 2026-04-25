# JMeter Datadog Backend Listener Configuration

## Configuration Parameters

Use these exact values in your JMeter Backend Listener:

### Required Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| **apiKey** | `${__P(DD_API_KEY)}` | Will read from environment variable |
| **datadogUrl** | `https://api.us5.datadoghq.com/api/` | **US5 site** |
| **logIntakeUrl** | `https://http-intake.logs.us5.datadoghq.com/v1/input/` | For logs (optional) |
| **metricsMaxBatchSize** | `200` | Default is fine |
| **logsBatchSize** | `500` | Default is fine |
| **sendResultsAsLogs** | `true` | Send detailed results as logs |
| **includeSubresults** | `false` | Don't include sub-samplers |
| **excludeLogsResponseCodeRegex** | `*` | Don't filter by response code |
| **samplersRegex** | `*` | Include all samplers |
| **customTags** | `${__P(DD_CUSTOM_TAGS)}` | Will read from environment |
| **statisticsCalculationMode** | `ddsketch` | Best for percentiles |

## How Backend Listener Works

```
JMeter Test → Backend Listener (built-in) → HTTPS → Datadog API
```

✅ **Advantages:**
- No Python forwarder needed
- Built-in to JMeter
- Automatic percentiles (p50, p75, p90, p95, p99)
- Real-time metrics every 10 seconds
- More reliable than custom solutions

## Metrics You'll Get

The Backend Listener automatically sends:

### Performance Metrics
- `jmeter.responses.count` - Total requests
- `jmeter.responses.ok.count` - Successful requests  
- `jmeter.responses.ko.count` - Failed requests
- `jmeter.responses.time.avg` - Average response time
- `jmeter.responses.time.min` - Min response time
- `jmeter.responses.time.max` - Max response time
- `jmeter.responses.time.p50` - Median (50th percentile)
- `jmeter.responses.time.p75` - 75th percentile
- `jmeter.responses.time.p90` - 90th percentile ✅
- `jmeter.responses.time.p95` - 95th percentile ✅
- `jmeter.responses.time.p99` - 99th percentile ✅

### Thread/User Metrics
- `jmeter.threads.count` - Active virtual users ✅

### Error Metrics
- `jmeter.responses.error_rate` - Error percentage

All metrics are tagged with:
- `test_id`
- `run_id`
- `container_id`
- Any custom tags you add

## How to Add to Your JMX File

You can add this via JMeter GUI or programmatically. Here's the XML structure:

```xml
<BackendListener guiclass="BackendListenerGui" testclass="BackendListener" testname="Datadog Backend Listener">
  <elementProp name="arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="apiKey" elementType="Argument">
        <stringProp name="Argument.name">apiKey</stringProp>
        <stringProp name="Argument.value">${__P(DD_API_KEY)}</stringProp>
      </elementProp>
      <elementProp name="datadogUrl" elementType="Argument">
        <stringProp name="Argument.name">datadogUrl</stringProp>
        <stringProp name="Argument.value">https://api.us5.datadoghq.com/api/</stringProp>
      </elementProp>
      <elementProp name="logIntakeUrl" elementType="Argument">
        <stringProp name="Argument.name">logIntakeUrl</stringProp>
        <stringProp name="Argument.value">https://http-intake.logs.us5.datadoghq.com/v1/input/</stringProp>
      </elementProp>
      <elementProp name="metricsMaxBatchSize" elementType="Argument">
        <stringProp name="Argument.name">metricsMaxBatchSize</stringProp>
        <stringProp name="Argument.value">200</stringProp>
      </elementProp>
      <elementProp name="logsBatchSize" elementType="Argument">
        <stringProp name="Argument.name">logsBatchSize</stringProp>
        <stringProp name="Argument.value">500</stringProp>
      </elementProp>
      <elementProp name="sendResultsAsLogs" elementType="Argument">
        <stringProp name="Argument.name">sendResultsAsLogs</stringProp>
        <stringProp name="Argument.value">true</stringProp>
      </elementProp>
      <elementProp name="includeSubresults" elementType="Argument">
        <stringProp name="Argument.name">includeSubresults</stringProp>
        <stringProp name="Argument.value">false</stringProp>
      </elementProp>
      <elementProp name="samplersRegex" elementType="Argument">
        <stringProp name="Argument.name">samplersRegex</stringProp>
        <stringProp name="Argument.value">*</stringProp>
      </elementProp>
      <elementProp name="customTags" elementType="Argument">
        <stringProp name="Argument.name">customTags</stringProp>
        <stringProp name="Argument.value">${__P(DD_CUSTOM_TAGS)}</stringProp>
      </elementProp>
      <elementProp name="statisticsCalculationMode" elementType="Argument">
        <stringProp name="Argument.name">statisticsCalculationMode</stringProp>
        <stringProp name="Argument.value">ddsketch</stringProp>
      </elementProp>
    </collectionProp>
  </elementProp>
  <stringProp name="classname">org.apache.jmeter.visualizers.backend.datadog.DatadogBackendClient</stringProp>
</BackendListener>
```

## Environment Variables Needed

The Backend Listener expects these JMeter properties (passed via `-J` flags):

```bash
-JDD_API_KEY=cb071ead8b2f15d1ecd5f9798ec6ebae
-JDD_CUSTOM_TAGS="test_id:dcp-api-test,run_id:20260426-123456,container_id:0,environment:personal"
```

These are already set in your entrypoint.sh if DD_API_KEY environment variable exists.

## Update entrypoint.sh

Add this to the JMeter command when Datadog is enabled:

```bash
if [ -n "$DD_API_KEY" ]; then
  JMETER_ARGS="$JMETER_ARGS -JDD_API_KEY=$DD_API_KEY"
  JMETER_ARGS="$JMETER_ARGS -JDD_CUSTOM_TAGS=test_id:${TEST_ID},run_id:${RUN_ID},container_id:${CONTAINER_ID},environment:personal"
fi
```

## Verify in Datadog

After test runs, check:

**Metrics Explorer:** https://us5.datadoghq.com/metric/explorer
- Search: `jmeter.responses.time.p90`
- Search: `jmeter.responses.time.p95`
- Search: `jmeter.responses.time.p99`
- Search: `jmeter.threads.count`

**Logs (if sendResultsAsLogs=true):** https://us5.datadoghq.com/logs
- Search: `source:jmeter`

## Comparison: Backend Listener vs Python Forwarder

| Feature | Backend Listener | Python Forwarder |
|---------|------------------|------------------|
| Setup | Add to JMX | Custom script |
| Percentiles | ✅ Built-in (p50, p75, p90, p95, p99) | ❌ Need to calculate |
| Active Users | ✅ Automatic | ❌ Need to track |
| Reliability | ✅ Battle-tested | ⚠️ Custom code |
| Dependencies | ✅ None (built-in) | ❌ Python, datadog lib |
| Real-time | ✅ Every 10s | ⚠️ Depends on implementation |
| Logs | ✅ Optional | ❌ No |

**Recommendation:** Use Backend Listener - it's simpler and more powerful!

## Next Steps

1. Add Backend Listener to your JMX file with values above
2. Update entrypoint.sh to pass `-JDD_API_KEY` and `-JDD_CUSTOM_TAGS`
3. Deploy
4. Run test
5. Check Datadog for metrics

The Backend Listener is the official, supported way to integrate JMeter with Datadog. Much better than custom solutions!