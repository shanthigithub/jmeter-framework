# Automatic Test Configuration Guide

## Overview

The JMeter Batch Framework now features **automatic configuration extraction** from JMX files. You no longer need to manually specify thread counts, duration, container counts, or JVM settings - the system intelligently extracts these from your JMeter test scripts.

## How It Works

### Traditional Approach ❌
```json
{
  "testSuite": [
    {
      "testId": "my-test",
      "testScript": "tests/My_Test.jmx",
      "numOfContainers": 2,
      "threads": 100,
      "duration": "10m",
      "execute": true,
      "jvmArgs": "-Xms1g -Xmx3g",
      "jmeterProperties": {
        "hostname": "api.example.com"
      }
    }
  ]
}
```

### New Automatic Approach ✅
```json
{
  "testSuite": [
    {
      "testScript": "tests/My_Test.jmx"
    }
  ]
}
```

That's it! The system automatically:
- ✅ Extracts thread count from JMX
- ✅ Detects duration vs iteration-based tests
- ✅ Calculates optimal container count
- ✅ Determines appropriate JVM memory settings
- ✅ Extracts user-defined variables as properties

## What Gets Extracted

### 1. Thread Configuration

The JMX parser reads the Thread Group settings:

```xml
<ThreadGroup>
  <stringProp name="ThreadGroup.num_threads">100</stringProp>
  <stringProp name="ThreadGroup.ramp_time">60</stringProp>
  ...
</ThreadGroup>
```

**Extracted:**
- `threads`: 100
- `rampTime`: 60 seconds

### 2. Duration vs Iterations

#### Duration-Based Test

If scheduler is enabled in JMX:
```xml
<boolProp name="ThreadGroup.scheduler">true</boolProp>
<stringProp name="ThreadGroup.duration">600</stringProp>
```

**Extracted:**
- `duration`: "10m" (600 seconds → 10 minutes)
- `scheduler`: true

#### Iteration-Based Test

If loop count is specified:
```xml
<stringProp name="LoopController.loops">50</stringProp>
```

**Extracted:**
- `iterations`: 50
- `duration`: "8m20s" (estimated: 50 × 10 seconds)

#### Infinite Loop

If continuous loop is enabled:
```xml
<boolProp name="LoopController.continue_forever">true</boolProp>
```

**Extracted:**
- `duration`: "5m" (default)
- `iterations`: null

### 3. Container Calculation

Based on thread count, containers are auto-calculated:

| Threads | Containers | Reasoning |
|---------|------------|-----------|
| 1-50 | 1 | Single container sufficient |
| 51-200 | 2 | Balanced distribution |
| 201-500 | 3-5 | ~100 threads per container |
| 501+ | 6+ | Scale at 100 threads/container |

**Example:**
- 150 threads → 2 containers (75 threads each)
- 450 threads → 5 containers (90 threads each)

### 4. JVM Memory Settings

Memory allocation scales with thread count:

| Threads | JVM Args | Use Case |
|---------|----------|----------|
| 1-50 | `-Xms512m -Xmx2g` | Light load |
| 51-200 | `-Xms1g -Xmx3g` | Medium load |
| 201-500 | `-Xms2g -Xmx4g` | Heavy load |
| 501+ | `-Xms4g -Xmx8g` | Very heavy load |

### 5. User-Defined Variables

Variables defined in your JMX are automatically extracted:

```xml
<Arguments testname="User Defined Variables">
  <collectionProp name="Arguments.arguments">
    <elementProp name="hostname" elementType="Argument">
      <stringProp name="Argument.value">api.example.com</stringProp>
    </elementProp>
    <elementProp name="port" elementType="Argument">
      <stringProp name="Argument.value">443</stringProp>
    </elementProp>
  </collectionProp>
</Arguments>
```

**Extracted as:**
```json
{
  "jmeterProperties": {
    "hostname": "api.example.com",
    "port": 443
  }
}
```

## Configuration File Format

### Minimal Configuration (Recommended)

```json
{
  "testSuite": [
    {
      "testScript": "tests/DCP_API_May_v2.jmx"
    }
  ]
}
```

### With Property Overrides

Override specific JMeter properties while still auto-extracting everything else:

```json
{
  "testSuite": [
    {
      "testScript": "tests/DCP_API_May_v2.jmx",
      "jmeterProperties": {
        "hostname": "prod-api.example.com",
        "protocol": "https"
      }
    }
  ]
}
```

Properties in the config override those in the JMX file.

### Multiple Tests

```json
{
  "testSuite": [
    {
      "testScript": "tests/API_Test.jmx"
    },
    {
      "testScript": "tests/Load_Test.jmx",
      "jmeterProperties": {
        "hostname": "api2.example.com"
      }
    }
  ]
}
```

## Workflow Integration

### How It Works in the Pipeline

```
1. GitHub Actions uploads config to S3
   ↓
2. Step Functions starts execution
   ↓
3. Read Config Lambda reads your JSON
   ↓
4. FOR EACH test in testSuite:
   ├─ JMX Parser Lambda downloads JMX from S3
   ├─ Parses XML to extract configuration
   ├─ Calculates optimal containers and memory
   └─ Returns complete test config
   ↓
5. Submit Jobs Lambda uses auto-generated config
   ↓
6. AWS Batch runs containers with optimal settings
```

### Complete Auto-Generated Config

What you provide:
```json
{
  "testScript": "tests/My_Test.jmx"
}
```

What the system generates:
```json
{
  "testScript": "tests/My_Test.jmx",
  "threads": 100,
  "duration": "10m",
  "iterations": null,
  "numOfContainers": 2,
  "jvmArgs": "-Xms1g -Xmx3g",
  "jmeterProperties": {
    "hostname": "api.example.com",
    "port": 443,
    "protocol": "https"
  },
  "testDetails": {
    "threadGroupName": "API Users",
    "rampTime": 60,
    "scheduler": true,
    "estimatedDurationSeconds": 600
  }
}
```

## Supported JMeter Features

### Thread Groups

- ✅ Standard ThreadGroup
- ✅ SetupThreadGroup  
- ✅ PostThreadGroup
- ✅ Blazemeter ConcurrencyThreadGroup

### Test Duration

- ✅ Duration-based (scheduler enabled)
- ✅ Iteration-based (loop count)
- ✅ Infinite loops (defaults to 5m)

### Properties

- ✅ User Defined Variables
- ✅ String properties
- ✅ Numeric properties (int/float)
- ✅ Boolean properties

## Benefits

### 1. Simplified Configuration

**Before:** 10+ lines of JSON per test  
**After:** 1 line of JSON per test

### 2. Consistency

Configuration always matches your JMX file - no manual sync needed.

### 3. Optimal Performance

Containers and memory automatically scaled based on load.

### 4. Reduced Errors

No typos, no mismatched thread counts, no forgotten properties.

### 5. Easy Updates

Change threads in JMeter GUI → automatically reflected in execution.

## Advanced Usage

### Manual Overrides (Optional)

You can still override auto-detected values if needed:

```json
{
  "testSuite": [
    {
      "testScript": "tests/My_Test.jmx",
      "numOfContainers": 5,  // Override auto-calculated 2
      "jvmArgs": "-Xms2g -Xmx4g",  // Override auto-calculated
      "jmeterProperties": {
        "hostname": "custom.example.com"
      }
    }
  ]
}
```

### Test ID (Auto-Generated)

If not provided, test ID is auto-generated from filename:
- `tests/DCP_API_May_v2.jmx` → `dcp-api-may-v2`

You can still specify custom IDs:
```json
{
  "testScript": "tests/My_Test.jmx",
  "testId": "custom-test-id"
}
```

## Migration Guide

### From Old Format to New Format

#### Before (Manual Config)
```json
{
  "testSuite": [
    {
      "testId": "api-test",
      "testScript": "tests/API_Test.jmx",
      "numOfContainers": 2,
      "threads": 100,
      "duration": "10m",
      "execute": true,
      "jvmArgs": "-Xms1g -Xmx3g",
      "jmeterProperties": {
        "hostname": "api.example.com",
        "protocol": "https"
      }
    }
  ]
}
```

#### After (Auto Config)
```json
{
  "testSuite": [
    {
      "testScript": "tests/API_Test.jmx",
      "jmeterProperties": {
        "hostname": "api.example.com",
        "protocol": "https"
      }
    }
  ]
}
```

**What to remove:**
- ❌ `testId` (auto-generated from filename)
- ❌ `numOfContainers` (auto-calculated from threads)
- ❌ `threads` (extracted from JMX)
- ❌ `duration` (extracted from JMX)
- ❌ `execute` (all tests execute by default)
- ❌ `jvmArgs` (auto-calculated from threads)

**What to keep:**
- ✅ `testScript` (required)
- ✅ `jmeterProperties` (if you want to override JMX variables)

## Troubleshooting

### Parser Fails to Find Thread Group

**Error:** "No ThreadGroup found in JMX file"

**Solution:** Ensure your JMX has at least one Thread Group with proper XML structure.

### Unexpected Thread Count

**Check:** Open JMX in JMeter GUI → Thread Group → Number of Threads

The parser reads exactly what's in the JMX file.

### Custom Container Count Needed

**Solution:** Override in config:
```json
{
  "testScript": "tests/My_Test.jmx",
  "numOfContainers": 10
}
```

### Properties Not Detected

**Cause:** Properties must be in "User Defined Variables" config element.

**Fix:** In JMeter:
1. Right-click Test Plan
2. Add → Config Element → User Defined Variables
3. Add your variables there

## Examples

### Example 1: Simple Load Test

**Config:**
```json
{
  "testSuite": [
    {
      "testScript": "tests/simple_load_test.jmx"
    }
  ]
}
```

**JMX has:**
- 50 threads
- 5 minute duration
- hostname variable: api.test.com

**Auto-Generated:**
```json
{
  "threads": 50,
  "duration": "5m",
  "numOfContainers": 1,
  "jvmArgs": "-Xms512m -Xmx2g",
  "jmeterProperties": {
    "hostname": "api.test.com"
  }
}
```

### Example 2: Heavy Load Test

**Config:**
```json
{
  "testSuite": [
    {
      "testScript": "tests/stress_test.jmx"
    }
  ]
}
```

**JMX has:**
- 500 threads
- 30 minute duration

**Auto-Generated:**
```json
{
  "threads": 500,
  "duration": "30m",
  "numOfContainers": 5,
  "jvmArgs": "-Xms4g -Xmx8g"
}
```

### Example 3: With Overrides

**Config:**
```json
{
  "testSuite": [
    {
      "testScript": "tests/api_test.jmx",
      "jmeterProperties": {
        "hostname": "prod.api.com",
        "apiKey": "${SECRET_API_KEY}"
      }
    }
  ]
}
```

**Result:** All test params from JMX + your property overrides.

## Best Practices

### 1. Configure in JMeter GUI

Set your thread count, duration, and variables in JMeter - not in JSON.

### 2. Use User Defined Variables

Put runtime properties in "User Defined Variables" for auto-extraction.

### 3. Keep Configs Minimal

Only specify what you need to override - let the system handle the rest.

### 4. Test Locally First

Run test in JMeter GUI to verify thread counts and duration before deploying.

### 5. Version Control JMX Files

Your JMX is now your source of truth - commit it to git.

## FAQ

**Q: Can I still use the old manual format?**  
A: Yes! Manual configs still work. You can mix and match.

**Q: What if I want different thread counts in AWS vs local?**  
A: Override `threads` in your config JSON.

**Q: Does this work with distributed testing?**  
A: Yes! Container count is auto-calculated for optimal distribution.

**Q: Can I see what was extracted?**  
A: Yes, check CloudWatch logs for the JMX Parser Lambda.

**Q: What about test data files (CSV)?**  
A: CSV paths in JMX are preserved. Upload CSVs to S3 as before.

---

## Summary

The new auto-configuration feature makes running JMeter tests in AWS as simple as:

1. Create your test in JMeter GUI
2. Save JMX file
3. Create minimal JSON: `{"testScript": "tests/your-test.jmx"}`
4. Run via GitHub Actions

Everything else is automatic! 🎉