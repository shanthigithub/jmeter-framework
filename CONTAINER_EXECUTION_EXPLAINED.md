# How Container Execution Works

## Critical Understanding: JMX File is the Source of Truth

### The Container Execution Flow

```
1. Container starts
2. Downloads JMX file from S3 → /tmp/test.jmx
3. Runs: jmeter -n -t /tmp/test.jmx
4. JMeter reads configuration FROM THE JMX FILE
5. Test runs according to JMX configuration
6. Container exits when test completes
```

**Key Point:** The container does NOT define duration or iterations. It uses whatever is in the JMX file!

---

## Framework Does NOT Override JMX Configuration

### What We Fixed (Important!)

**Before (WRONG):**
```bash
jmeter -n -t test.jmx \
  -Jthreads 100 \      # ❌ Overriding thread count
  -Jduration 300       # ❌ Overriding duration
```

**After (CORRECT):**
```bash
jmeter -n -t test.jmx \
  -JcontainerId 0 \       # Just for distributed tracking
  -JtotalContainers 5     # Just for distributed tracking
```

**Result:** JMeter uses the thread count, duration, and iterations **directly from the JMX file**.

---

## Understanding "Specify Thread lifetime" (Scheduler)

From your screenshot, I see you have:
- ✅ **Specify Thread lifetime** checked
- ✅ **Infinite** loop count checked  
- **Duration:** `${TestDuration}` (variable)
- **Startup delay:** 10 seconds

### This Enables SCHEDULER Mode!

When "Specify Thread lifetime" is checked, JMeter uses **duration-based execution**.

**JMX Structure:**
```xml
<ThreadGroup>
  <stringProp name="ThreadGroup.num_threads">1</stringProp>
  <stringProp name="ThreadGroup.ramp_time">1</stringProp>
  
  <!-- Scheduler enabled! -->
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
  <stringProp name="ThreadGroup.duration">${TestDuration}</stringProp>
  <stringProp name="ThreadGroup.delay">10</stringProp>
  
  <!-- Loop controller set to infinite when scheduler is used -->
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
    <boolProp name="LoopController.continue_forever">true</boolProp>
    <stringProp name="LoopController.loops">-1</stringProp>
  </elementProp>
</ThreadGroup>
```

---

## How Framework Detects Configuration

### JMX Parser Logic:

```python
# Check if scheduler is enabled
scheduler = get_element_value(thread_group, 'boolProp', 'ThreadGroup.scheduler')

if scheduler == 'true':
    # DURATION-BASED TEST
    duration = get_element_value(thread_group, 'stringProp', 'ThreadGroup.duration')
    # Framework detects: "This test runs for X seconds"
    
else:
    # ITERATION-BASED TEST  
    loop_count = get_element_value(thread_group, 'stringProp', 'LoopController.loops')
    # Framework detects: "This test runs for X iterations"
```

---

## Your Current Configuration

From your screenshot:

**Thread Group Settings:**
- Threads: 1
- Ramp-up: 1 second
- ✅ Specify Thread lifetime (scheduler enabled)
- Duration: `${TestDuration}` (needs actual value!)
- Startup delay: 10 seconds

**What Happens:**
1. Framework parses JMX and detects `scheduler=true`
2. Extracts duration value (needs to resolve `${TestDuration}` variable)
3. Container runs JMeter with the JMX file
4. JMeter runs for the duration specified in the variable

---

## Important: User Defined Variables

If your JMX uses `${TestDuration}`, you need to define it!

**Option 1: In JMX File**
```xml
<Arguments testname="User Defined Variables">
  <collectionProp name="Arguments.arguments">
    <elementProp name="TestDuration" elementType="Argument">
      <stringProp name="Argument.name">TestDuration</stringProp>
      <stringProp name="Argument.value">300</stringProp>  <!-- 5 minutes -->
    </elementProp>
  </collectionProp>
</Arguments>
```

**Option 2: In config.json**
```json
{
  "testSuite": [{
    "testId": "dcp-api-test",
    "testScript": "tests/DCP_API_May_v2.jmx",
    "jmeterProperties": {
      "TestDuration": "300"  ← Define variable here
    }
  }]
}
```

---

## Container Execution Examples

### Example 1: Duration-Based (Your Case with Scheduler)

**JMX Config:**
- Scheduler: enabled
- Duration: 300 seconds (5 minutes)
- Infinite loops

**Container Execution:**
```bash
# Container runs
jmeter -n -t test.jmx -JTestDuration=300

# JMeter behavior:
# - Starts 1 thread
# - Runs for 300 seconds
# - Executes requests repeatedly during those 300s
# - Stops after 300 seconds regardless of iteration count
```

### Example 2: Iteration-Based (No Scheduler)

**JMX Config:**
- Scheduler: disabled
- Loop Count: 10 iterations

**Container Execution:**
```bash
# Container runs
jmeter -n -t test.jmx

# JMeter behavior:
# - Starts threads
# - Runs exactly 10 iterations
# - Stops after 10 iterations complete
# - Time varies based on how long each iteration takes
```

### Example 3: Iteration-Based with 1 Iteration

**JMX Config:**
- Scheduler: disabled  
- Loop Count: 1

**Container Execution:**
```bash
# Container runs
jmeter -n -t test.jmx

# JMeter behavior:
# - Starts thread
# - Runs 1 iteration (all requests once)
# - Completes in seconds if requests are fast
# - Container exits with code 0
```

---

## Summary

### ✅ What Framework Does:
1. **Reads** JMX configuration (doesn't change it)
2. **Parses** to understand test type (duration vs iterations)
3. **Passes JMX file** to container unchanged
4. **Monitors** test execution
5. **Collects** results after completion

### ❌ What Framework Does NOT Do:
1. Override thread count
2. Override duration
3. Override iterations
4. Modify JMX file
5. Inject its own test parameters

### 🎯 Result:
**The test runs EXACTLY as if you ran `jmeter -n -t yourfile.jmx` locally!**

The container is just an execution environment. The JMX file controls everything.