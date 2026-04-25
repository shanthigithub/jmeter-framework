# 🔄 Rollback Test Plan

## Current Status

✅ **Rollback Complete** - Code rolled back to commit `7366d14a`  
✅ **Branch Created** - `rollback-working-version`  
✅ **Pushed to GitHub** - Ready for deployment

---

## What This Rollback Does

This rollback takes you back to **Run #36** which was the **last successful test** before:
- `83fffcd8` - Clean ParseJMX output (removed nulls)
- `727aa43e` - Simplified workflow inputs
- `6b16716f` - Datadog integration
- Latest fixes for enableDatadogMetrics parameter

**Current commit:** `7366d14a` - Fix container exit code: Check results file instead of JMeter exit code

---

## 🚀 Step-by-Step Deployment & Test Plan

### Step 1: Deploy Infrastructure from Rollback Branch

**Option A: GitHub Actions UI**
1. Go to: [Deploy Infrastructure Workflow](https://github.com/shanthigithub/jmeter-framework/actions/workflows/deploy.yml)
2. Click: **"Run workflow"**
3. Select branch: **`rollback-working-version`** (NOT main!)
4. Click: **"Run workflow"**
5. Wait for deployment (~2-3 minutes)

**Option B: CLI (if you prefer)**
```bash
# Trigger deployment via GitHub CLI (if installed)
gh workflow run deploy.yml --ref rollback-working-version
```

---

### Step 2: Run Test (Use Old Workflow Format)

This version uses the **3-input** workflow format:

1. Go to: [Run JMeter Test Workflow](https://github.com/shanthigithub/jmeter-framework/actions/workflows/run-test.yml)
2. Click: **"Run workflow"**
3. Select branch: **`rollback-working-version`**
4. Fill inputs:
   - **Test configuration file:** `dcp-api-test.json`
   - **Specific test ID:** (leave empty)
   - **Wait for completion:** `true`
5. Click: **"Run workflow"**
6. Watch it succeed! ✅

---

### Step 3: Verify Success

If the test succeeds (like Run #36 did):
- ✅ Confirms the rollback worked
- ✅ Proves the issue started AFTER commit `7366d14a`
- ✅ Ready to apply changes incrementally

---

## 📊 After Successful Test

Once you confirm this works, we can apply changes properly:

### Path Forward:

1. **Keep the working version** (current rollback branch)
2. **Apply "Clean ParseJMX output" CORRECTLY:**
   - The change itself was good (removed nulls)
   - But we need to ensure Step Functions handles it properly
   
3. **Add Datadog integration PROPERLY:**
   - Ensure all Pass steps preserve the parameter
   - Test after each change

4. **Incremental approach:**
   ```
   rollback-working-version (base)
   ├─> Apply ParseJMX clean output
   │   └─> Test ✅
   │       └─> Apply Datadog integration
   │           └─> Test ✅
   │               └─> Merge to main
   ```

---

## 🔍 What We'll Learn

### If Test SUCCEEDS:
- ✅ Confirms rollback worked
- ✅ Proves issue was in later commits
- ✅ Can apply fixes incrementally

### If Test FAILS:
- ❌ Issue is deeper than we thought
- ❌ Need to investigate infrastructure state
- ❌ May need to check AWS resources directly

---

## 📋 Commit Timeline

```
7366d14a ← YOU ARE HERE (rollback-working-version)
   ↓
83fffcd8 - Clean ParseJMX output (ISSUE STARTED HERE)
   ↓
727aa43e - Simplified workflow inputs
   ↓
6b16716f - Datadog integration
   ↓
9b3245f3 - Fix: FilterExecutableTests
   ↓
1dbb16f9 - Fix: TransformParsedTests (main branch)
```

---

## ⚠️ Important Notes

1. **Deploy from `rollback-working-version` branch** - NOT from main!
2. **The workflow has 3 inputs** at this version (not 2 like the new version)
3. **Docker image will be rebuilt** from this commit
4. **This is just for testing** - don't merge this branch to main yet

---

## Next Steps

1. ✅ Deploy infrastructure from `rollback-working-version` branch
2. ✅ Run test using old workflow format (3 inputs)
3. ✅ Confirm it works (like Run #36)
4. 📧 Report back the results
5. 🔧 Then we'll apply fixes incrementally

**Ready to test! Deploy the rollback branch and run a test.** 🚀