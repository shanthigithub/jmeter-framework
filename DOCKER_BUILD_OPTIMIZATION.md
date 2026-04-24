# Docker Build Optimization Guide

## Understanding the 219.7s Build Time

### When Does JMeter Download Happen?

**IMPORTANT:** The 219.7 seconds JMeter download (83.3MB) happens **ONLY during Docker image build**, NOT during test execution.

```
┌─────────────────────────────────────────────────────┐
│ Timeline                                            │
├─────────────────────────────────────────────────────┤
│ 1. Initial Build (one-time): ~4 minutes             │
│    - Download JMeter: 219.7s                        │
│    - Install dependencies: ~30s                     │
│    - Total: ~250s                                   │
│                                                     │
│ 2. Push to ECR (one-time): ~30s                     │
│                                                     │
│ 3. Test Execution (every test): ~seconds            │
│    - Pulls CACHED image from ECR: 10-30s           │
│    - Downloads test files from S3: 1-5s            │
│    - Runs test: varies by test                     │
│    - Uploads results to S3: 1-5s                   │
│                                                     │
│ 4. Subsequent Tests: NO REBUILD NEEDED             │
│    - Reuses existing ECR image                     │
└─────────────────────────────────────────────────────┘
```

### Current Build Process

**Step 3/7** downloads JMeter from Apache archives:
```dockerfile
RUN mkdir /opt/jmeter \
    && cd /opt \
    && curl -L https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.tgz \
        -o apache-jmeter-5.6.3.tgz \
    && tar -xzf apache-jmeter-5.6.3.tgz
```

**This happens:**
- ✅ Once per image build
- ✅ Only when Dockerfile changes
- ✅ Only when dependencies change
- ❌ NOT during test execution
- ❌ NOT when test files change
- ❌ NOT when config files change

## Optimization Strategies

### 1. Use Docker Layer Caching (Recommended)

**Current Setup:** Already optimized with multi-layer approach
```dockerfile
# Layer 1: Base OS (rarely changes)
FROM alpine:3.19

# Layer 2: System dependencies (rarely changes)
RUN apk add --no-cache openjdk17-jre curl bash python3 py3-pip

# Layer 3: JMeter download (only rebuilds if version changes)
RUN mkdir /opt/jmeter && curl -L ...

# Layer 4: Application code (changes frequently)
COPY entrypoint.sh /entrypoint.sh
```

**Benefits:**
- Layers 1-3 are cached after first build
- Only Layer 4 rebuilds when you change entrypoint.sh
- **Subsequent builds: <10 seconds**

### 2. GitHub Actions Cache (Already Configured)

Your workflow already uses Docker layer caching:
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Result:**
- First build in CI/CD: ~4 minutes
- Subsequent builds: ~30 seconds

### 3. Use Pre-built Base Image (Advanced)

Create a base image with JMeter pre-installed:

```dockerfile
# base-image/Dockerfile
FROM alpine:3.19
ARG JMETER_VERSION=5.6.3

RUN apk add --no-cache openjdk17-jre curl bash python3 py3-pip \
    && pip3 install --break-system-packages --no-cache-dir awscli \
    && mkdir /opt/jmeter \
    && cd /opt \
    && curl -L https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz \
        -o apache-jmeter-${JMETER_VERSION}.tgz \
    && tar -xzf apache-jmeter-${JMETER_VERSION}.tgz \
    && rm apache-jmeter-${JMETER_VERSION}.tgz \
    && mv apache-jmeter-${JMETER_VERSION}/* /opt/jmeter/ \
    && rm -rf apache-jmeter-${JMETER_VERSION}

ENV PATH="/opt/jmeter/bin:${PATH}"
ENV JMETER_HOME="/opt/jmeter"
```

Then main Dockerfile becomes:
```dockerfile
FROM your-account.dkr.ecr.region.amazonaws.com/jmeter-base:5.6.3

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /jmeter
ENTRYPOINT ["/entrypoint.sh"]
```

**Build times:**
- Base image build (monthly): ~4 minutes
- Main image build (per change): ~10 seconds

### 4. Use CDN or Mirror (Network Optimization)

Replace Apache archive with faster mirror:
```dockerfile
# Option 1: Use closer mirror
ARG JMETER_MIRROR=https://dlcdn.apache.org/jmeter

# Option 2: Host in your own S3
ARG JMETER_URL=s3://your-bucket/jmeter/apache-jmeter-5.6.3.tgz
```

### 5. Parallel Downloads (If Multiple Dependencies)

Use `--parallel` with apk:
```dockerfile
RUN apk add --no-cache --parallel \
    openjdk17-jre \
    curl \
    bash \
    python3 \
    py3-pip
```

## Build Time Breakdown

```
Total Build Time: ~250 seconds (first build)
├─ Base OS pull: 10s
├─ Dependencies install: 30s
├─ JMeter download: 219.7s (83.3MB @ 390KB/s)
├─ Extract & cleanup: 15s
└─ Copy scripts: 5s

Cached Build Time: ~30 seconds (subsequent)
├─ Layer cache check: 5s
├─ Changed layers only: 20s
└─ Push to ECR: 5s
```

## Test Execution Time

**Per Test Execution:**
```
Total Test Time: 2-30 minutes (depends on test)
├─ ECS Task startup: 30-60s
├─ Image pull from ECR: 10-30s (cached in region)
├─ Download test files from S3: 1-5s
├─ JMeter execution: 1-30 minutes (YOUR TEST)
├─ Upload results to S3: 1-10s
└─ Cleanup: 5s
```

**Key Point:** JMeter is already in the image - no download needed!

## Recommendations

### For Development
```bash
# Build locally once
docker build -t jmeter-batch:local -f docker/Dockerfile .

# Subsequent changes to entrypoint.sh only
docker build -t jmeter-batch:local -f docker/Dockerfile . # <10s
```

### For Production
1. **Keep current setup** - it's already optimized
2. Build image when:
   - JMeter version changes (rare)
   - Dockerfile changes (rare)
   - Dependencies change (rare)
3. Reuse ECR image for all tests

### When to Rebuild

**Rebuild Required:**
- ✅ JMeter version upgrade (quarterly/yearly)
- ✅ Dockerfile changes
- ✅ Base image security updates

**Rebuild NOT Required:**
- ❌ Test file changes (stored in S3)
- ❌ Test config changes (in GitHub)
- ❌ Test data changes (stored in S3)
- ❌ Running different tests

## Monitoring Build Performance

Add to GitHub Actions workflow:
```yaml
- name: Build metrics
  run: |
    echo "Build started: $(date)"
    docker build --progress=plain --no-cache \
      -t jmeter-batch:latest -f docker/Dockerfile . 2>&1 | tee build.log
    echo "Build completed: $(date)"
    
    # Extract timing
    grep "DONE" build.log
```

## Cost Analysis

### Build Costs (One-time)
- GitHub Actions minutes: ~5 minutes = $0.008
- ECR storage: ~200MB = $0.02/month
- Network egress: 83MB download = negligible

### Test Costs (Per execution)
- ECS Fargate: $0.04048/hour × duration
- ECR data transfer: ~$0.00 (same region)
- S3 operations: ~$0.001

**Annual cost for weekly builds:** ~$0.24 (negligible)
**Annual cost for 1000 tests:** ~$40-200 (depends on test duration)

## Quick Reference

| Scenario | Build Time | Download JMeter? |
|----------|------------|------------------|
| First build ever | 4 minutes | ✅ Yes |
| Cached build | 30 seconds | ❌ No (cached) |
| Change entrypoint.sh | 30 seconds | ❌ No (cached) |
| Change JMeter version | 4 minutes | ✅ Yes |
| Run test | 0 seconds | ❌ No (uses ECR) |
| Different test | 0 seconds | ❌ No (uses ECR) |

## Conclusion

**The 219.7s download is a ONE-TIME cost that happens during image build.**

Your tests will run fast because:
1. ✅ Image is pre-built and cached in ECR
2. ✅ Test files loaded from S3 (fast)
3. ✅ No compilation or installation during test
4. ✅ Docker layers cached in GitHub Actions

**You only rebuild when you need to update JMeter or Dockerfile - not for every test!**