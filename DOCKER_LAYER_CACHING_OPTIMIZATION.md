# 🚀 Docker Build Optimization - Layer Caching Strategy

## Current Problem

**Every deployment rebuilds from scratch:**
- ❌ Downloads JMeter (5.6.3) - ~2-3 minutes
- ❌ Downloads 15+ JMeter plugins - ~1-2 minutes  
- ❌ Installs Python dependencies - ~30 seconds
- ❌ **Total wasted time: 4-6 minutes per deployment**

Even when you only change:
- Lambda function code (doesn't affect Docker at all!)
- Workflow files
- Documentation
- Small script changes in entrypoint.sh

## Root Cause

GitHub Actions doesn't cache Docker layers between runs by default. Each build starts fresh.

## Solution: Multi-Level Caching Strategy

### 1. Docker Buildx with Layer Caching (Primary Solution)

Use GitHub Actions cache to store Docker layers between builds.

**Benefits:**
- ✅ JMeter downloaded once, reused forever (until version changes)
- ✅ Plugins downloaded once, reused forever
- ✅ Only changed layers rebuild
- ✅ 4-6 minute builds → 30-60 second builds for script changes

### 2. Optimized Dockerfile Layer Structure

Reorganize layers from least-changing to most-changing:

```dockerfile
# Layer 1: Base OS + System packages (rarely changes)
FROM alpine:3.19
RUN apk add --no-cache openjdk17-jre curl bash python3 py3-pip

# Layer 2: Python dependencies (rarely changes)
RUN pip3 install --break-system-packages awscli datadog

# Layer 3: JMeter binary (only when version changes)
ARG JMETER_VERSION=5.6.3
RUN mkdir /opt/jmeter && cd /opt && \
    curl -L https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${JMETER_VERSION}.tgz \
    -o apache-jmeter-${JMETER_VERSION}.tgz && \
    tar -xzf apache-jmeter-${JMETER_VERSION}.tgz && \
    mv apache-jmeter-${JMETER_VERSION}/* /opt/jmeter/

# Layer 4: JMeter plugins (only when plugins change)
RUN cd /opt/jmeter/lib/ext && \
    curl -L https://jmeter-plugins.org/get/ -o jmeter-plugins-manager.jar && \
    ...all plugin downloads...

# Layer 5: Scripts (changes frequently - keep last)
COPY datadog-forwarder.py /usr/local/bin/
COPY entrypoint.sh /entrypoint.sh
```

### 3. Conditional Docker Build

Only rebuild Docker image when Docker-related files change.

## Implementation

### Step 1: Update GitHub Actions Workflow

Replace the docker build step with caching-enabled version:

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Cache Docker layers
  uses: actions/cache@v4
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ hashFiles('docker/Dockerfile', 'docker/**') }}
    restore-keys: |
      ${{ runner.os }}-buildx-

- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: ./docker
    push: true
    tags: |
      ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}
      ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest
    cache-from: type=local,src=/tmp/.buildx-cache
    cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

- name: Move cache
  run: |
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

### Step 2: Add Conditional Build Logic

Only build when Docker files change:

```yaml
jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      docker_changed: ${{ steps.filter.outputs.docker }}
      lambda_changed: ${{ steps.filter.outputs.lambda }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            docker:
              - 'docker/**'
            lambda:
              - 'iac/lambda/**'
            infra:
              - 'iac/lib/**'
              - 'iac/bin/**'

  build-image:
    needs: check-changes
    if: needs.check-changes.outputs.docker_changed == 'true'
    # ... build steps ...
```

## Expected Performance Improvements

### Before (Current)
```
Build Type          | Time      | Frequency
--------------------|-----------|----------
Full rebuild        | 5-7 min   | Every push
Small script change | 5-7 min   | 80% of changes
Lambda-only change  | 5-7 min   | 60% of changes
```

### After (Optimized)
```
Build Type          | Time      | Frequency
--------------------|-----------|----------
Full rebuild        | 5-7 min   | JMeter version bump only
Cached layers       | 30-60 sec | Script changes
Skip build          | 0 sec     | Lambda/workflow changes
```

**Estimated time savings: 80-90% for most deployments**

## Cost Savings

**Current**: 
- 10 deployments/day × 6 minutes = 60 minutes GitHub Actions time
- At $0.008/minute = $0.48/day = $14.40/month

**Optimized**:
- 10 deployments/day × 45 seconds average = 7.5 minutes
- At $0.008/minute = $0.06/day = $1.80/month

**Savings: $12.60/month (87% reduction)**

## Smart Build Triggers

Skip Docker build entirely when changes don't affect it:

```yaml
# Only build Docker when:
# - docker/ directory changes
# - Dockerfile changes  
# - entrypoint.sh changes
# - datadog-forwarder.py changes

# Skip Docker build when:
# - Lambda functions change (iac/lambda/**)
# - CDK code changes (iac/lib/**, iac/bin/**)
# - Workflows change (.github/workflows/**)
# - Documentation changes (**.md)
# - Config files change (config/**)
```

## Implementation Priority

### Phase 1: Quick Win (30 minutes)
1. ✅ Add Docker Buildx setup
2. ✅ Add GitHub Actions cache
3. ✅ Update build command to use cache

**Impact**: 50-70% faster builds immediately

### Phase 2: Smart Triggers (1 hour)
1. Add path filtering
2. Conditional Docker build
3. Conditional infrastructure deployment

**Impact**: Skip unnecessary builds entirely

### Phase 3: Dockerfile Optimization (2 hours)
1. Reorganize Dockerfile layers
2. Separate base image
3. Multi-stage build

**Impact**: Even faster incremental builds

## Monitoring Build Performance

Add build metrics to workflow:

```yaml
- name: Build metrics
  run: |
    echo "Build completed in: ${{ steps.build.outputs.build_time }}"
    echo "Cache hit: ${{ steps.cache.outputs.cache-hit }}"
    echo "Layers cached: ${{ steps.build.outputs.cached_layers }}"
```

## Next Steps

1. **Immediate**: Implement Docker Buildx caching (15 min)
2. **This week**: Add conditional build logic (1 hour)
3. **Next week**: Optimize Dockerfile layer structure (2 hours)

Would you like me to implement the Docker Buildx caching now? It's a quick win that will immediately speed up your deployments by 50-70%.