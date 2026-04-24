# JMeter Batch Framework
## High-Performance, Low-Cost, Serverless JMeter Testing

**Built for:** Fast startup (<2 min), minimal cost (~$2/month), zero maintenance

---

## 🎯 Design Philosophy

This framework is built from scratch using **modern cloud-native best practices**:

- ✅ **AWS Batch + Spot Instances** (70% cheaper than Fargate)
- ✅ **No Master-Minion** (independent execution, no coordination overhead)
- ✅ **GitHub Actions** (NOT CodeBuild - free, faster, better DX)
- ✅ **S3 Dynamic Loading** (small images, fast deploys)
- ✅ **Lambda Orchestration** (serverless, pay-per-use)
- ✅ **Comprehensive Error Handling** (fail-fast with clear messages)
- ✅ **Security First** (least privilege, encrypted, secrets managed)

---

## 🚀 Key Features

### **Performance**
- **Startup Time:** <2 minutes (vs 12-15 min traditional)
- **Parallel Execution:** Unlimited scale (Batch auto-scales)
- **Resource Efficiency:** 4GB RAM per container (vs 60GB traditional)

### **Cost**
- **Monthly Cost:** ~$2-5 for 100 tests (vs $50-100 traditional)
- **Spot Instances:** Automatic 70% discount
- **No Idle Costs:** Scales to zero automatically

### **Reliability**
- **Error Detection:** Real-time monitoring with immediate failure
- **Auto-Retry:** 3 retries on transient failures
- **Timeout Protection:** Safety limits prevent runaway costs
- **Result Validation:** Automatic result verification

### **Developer Experience**
- **GitHub Actions:** Deploy with git push
- **CloudWatch Logs:** Real-time log streaming
- **S3 Storage:** Versioned test scripts and results
- **Datadog Integration:** Real-time metrics and dashboards

---

## 📊 Architecture

```
GitHub Push
    ↓
GitHub Actions (Deploy)
    ↓
ECR + S3 (Store images & scripts)
    ↓
Step Functions (Orchestrate)
    ↓
    ├── Lambda: Read Config from S3
    ├── Lambda: Partition Data (split CSV files)
    ├── Lambda: Submit Batch Jobs (parallel)
    │       ↓
    │   AWS Batch (EC2 Spot)
    │       ↓
    │   JMeter Containers (4GB RAM, 2 vCPU)
    │       ├── Download test script from S3
    │       ├── Download data segment from S3
    │       ├── Run JMeter independently
    │       └── Upload results to S3
    │       ↓
    ├── Lambda: Check Job Status (poll)
    └── Lambda: Merge Results (aggregate)
        ↓
    S3 Results + CloudWatch Metrics
```

---

## 🛠️ Technology Stack

| Component | Technology | Reason |
|-----------|-----------|--------|
| **Compute** | AWS Batch + EC2 Spot | 70% cheaper, auto-scales, perfect for batch |
| **Container** | JMeter 5.6 + Alpine | Small image, fast startup |
| **Orchestration** | Step Functions + Lambda | Serverless, reliable, observable |
| **Storage** | S3 | Cheap, durable, versioned |
| **CI/CD** | GitHub Actions | Free, fast, integrated, NO CodeBuild! |
| **Monitoring** | CloudWatch + Datadog | Real-time metrics, alerting |
| **IaC** | AWS CDK (TypeScript) | Type-safe, maintainable |
| **Secrets** | AWS Secrets Manager | Secure, rotatable, auditable |

---

## 📁 Project Structure

```
jmeter-batch-framework/
├── iac/                           # Infrastructure as Code
│   ├── lib/
│   │   └── jmeter-stack.ts       # Single stack - no cross-stack deps!
│   ├── lambda/
│   │   ├── read-config/          # Read test config from S3
│   │   ├── partition-data/       # Split CSV files into segments
│   │   ├── submit-jobs/          # Submit Batch jobs
│   │   ├── check-jobs/           # Check Batch job status
│   │   └── merge-results/        # Merge and aggregate results
│   ├── bin/
│   │   └── app.ts                # CDK entry point
│   └── environments/
│       └── config.ts             # Environment configuration
├── docker/
│   ├── Dockerfile                # Lightweight JMeter image
│   ├── entrypoint.sh             # Container entry point
│   └── .dockerignore             # Optimize build context
├── tests/                         # JMeter test scripts (.jmx)
├── data/                          # Test data files (.csv)
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions deployment
├── scripts/
│   └── aggregate-results.py      # Result aggregation logic
├── docs/
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── USAGE.md                  # Usage instructions
│   └── TROUBLESHOOTING.md        # Common issues and solutions
└── README.md                      # This file
```

---

## 🔒 Security Features

- ✅ **Least Privilege IAM:** Minimal permissions per component
- ✅ **Secrets Manager:** No hardcoded credentials
- ✅ **Private Subnets:** Containers run in private network
- ✅ **VPC Endpoints:** No internet gateway for S3/ECR
- ✅ **Encryption:** S3 server-side encryption enabled
- ✅ **CloudTrail:** All API calls logged and auditable

---

## 🎯 Performance Optimizations

1. **No Master-Minion:** Eliminates coordination overhead
2. **Data Partitioning:** Pre-split CSV files for parallel processing
3. **Spot Instances:** 70% cost savings with minimal interruptions
4. **ARM64 Lambda:** 20% cheaper than x86
5. **S3 Dynamic Loading:** Fast deployments, small images
6. **Container Caching:** Reuse pulled images
7. **Batch Job Arrays:** Efficient parallel execution

---

## 📈 Monitoring & Observability

### **CloudWatch Metrics**
- Job success/failure rates
- Execution duration
- Cost per test
- Container utilization

### **CloudWatch Logs**
- Real-time streaming
- 7-day retention
- Structured JSON logging

### **Datadog Integration** (Optional)
- Real-time metrics
- Custom dashboards
- Alerting on failures

---

## 🚀 Quick Start

### **1. Prerequisites**
```bash
- AWS Account with permissions
- GitHub Account
- Node.js 18+ (for CDK)
- Docker (for local testing)
```

### **2. Deploy Infrastructure**
```bash
cd iac
npm install
npx cdk bootstrap  # First time only
npx cdk deploy
```

### **3. Upload Test Scripts**
```bash
aws s3 cp tests/ s3://jmeter-batch-config/tests/ --recursive
aws s3 cp data/ s3://jmeter-batch-config/data/ --recursive
```

### **4. Run Tests**
```bash
# Via GitHub Actions (recommended)
git push origin main

# Or manually trigger Step Functions
aws stepfunctions start-execution \
  --state-machine-arn <ARN> \
  --input file://config.json
```

---

## 💰 Cost Breakdown

### **Monthly Cost Estimate** (100 tests, 3 containers each, 15 min duration)

| Service | Usage | Cost |
|---------|-------|------|
| **AWS Batch (Spot)** | 75 hours × $0.029/hr | $2.18 |
| **Lambda** | 300 invocations | $0.00 (free tier) |
| **S3** | 10GB storage + transfers | $0.25 |
| **CloudWatch Logs** | 1GB ingestion | $0.50 |
| **Step Functions** | 300 transitions | $0.08 |
| **Total** | | **~$3.00/month** |

**Comparison:**
- Traditional ECS Fargate: ~$50/month
- **Savings: 94%** 💰

---

## 🔄 Migration from Old Framework

This is a **complete rewrite** - no code from old framework carried over.

**Why?**
- Old framework: Master-minion architecture (complex, slow)
- Old framework: ECS Services (expensive, over-provisioned)
- Old framework: CodeBuild (slow, expensive)
- Old framework: 60GB RAM containers (overkill)

**New framework:**
- Independent execution (simple, fast)
- AWS Batch (cheap, efficient)
- GitHub Actions (free, fast)
- 4GB RAM containers (right-sized)

---

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Usage Instructions](docs/USAGE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Personal AWS Config](../PERSONAL_AWS_CONFIG.md)

---

## 🤝 Contributing

This is a personal framework. For improvements:
1. Test locally first
2. Document changes
3. Update this README

---

## 📄 License

Personal use only.

---

**Built with ❤️ for performance, cost-efficiency, and developer happiness.**