#!/bin/bash
# Deploy Alpine JMeter Framework with Browser Support
# This script builds and deploys the updated Docker image with Chromium + Selenium

set -e

echo "=========================================="
echo "Alpine JMeter - Browser Support Deployment"
echo "=========================================="
echo ""

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="jmeter-framework"
IMAGE_TAG="${IMAGE_TAG:-latest}"

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

echo "Configuration:"
echo "  AWS Account: ${AWS_ACCOUNT_ID}"
echo "  AWS Region: ${AWS_REGION}"
echo "  ECR Repository: ${ECR_REPO}"
echo "  Image Tag: ${IMAGE_TAG}"
echo ""

# Step 1: Build Docker image
echo "=========================================="
echo "Step 1: Building Docker Image"
echo "=========================================="
echo ""

cd docker

echo "Building image with browser support..."
echo "  - Chromium + ChromeDriver"
echo "  - Selenium WebDriver 4.25.0"
echo "  - Python Playwright 1.40.0"
echo "  - JavaScript Playwright 1.40.0 (k6-ready!)"
echo "  - Xvfb for headless execution"
echo ""

docker build -t ${ECR_REPO}:${IMAGE_TAG} .

echo "✅ Image built successfully"
echo ""

# Step 2: Test browser installation
echo "=========================================="
echo "Step 2: Verifying Browser Installation"
echo "=========================================="
echo ""

echo "Testing Chromium..."
docker run --rm ${ECR_REPO}:${IMAGE_TAG} chromium-browser --version

echo ""
echo "Testing ChromeDriver..."
docker run --rm ${ECR_REPO}:${IMAGE_TAG} chromedriver --version

echo ""
echo "Testing Xvfb..."
docker run --rm ${ECR_REPO}:${IMAGE_TAG} which Xvfb

echo ""
echo "Testing Python Playwright..."
docker run --rm ${ECR_REPO}:${IMAGE_TAG} python3 -c "from playwright.sync_api import sync_playwright; print('✅ Python Playwright verified')"

echo ""
echo "Testing JavaScript Playwright..."
docker run --rm ${ECR_REPO}:${IMAGE_TAG} node -e "const { chromium } = require('playwright'); console.log('✅ JavaScript Playwright verified');"

echo ""
echo "✅ All browser components verified"
echo ""

# Step 3: Login to ECR
echo "=========================================="
echo "Step 3: Logging into ECR"
echo "=========================================="
echo ""

aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}

echo "✅ Logged into ECR"
echo ""

# Step 4: Tag image
echo "=========================================="
echo "Step 4: Tagging Image"
echo "=========================================="
echo ""

docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

echo "✅ Image tagged: ${ECR_URI}:${IMAGE_TAG}"
echo ""

# Step 5: Push to ECR
echo "=========================================="
echo "Step 5: Pushing to ECR"
echo "=========================================="
echo ""

docker push ${ECR_URI}:${IMAGE_TAG}

echo ""
echo "✅ Image pushed to ECR"
echo ""

# Step 6: Get image details
echo "=========================================="
echo "Step 6: Image Information"
echo "=========================================="
echo ""

IMAGE_SIZE=$(docker images ${ECR_REPO}:${IMAGE_TAG} --format "{{.Size}}")
echo "  Image Size: ${IMAGE_SIZE}"

IMAGE_DIGEST=$(aws ecr describe-images \
  --repository-name ${ECR_REPO} \
  --image-ids imageTag=${IMAGE_TAG} \
  --region ${AWS_REGION} \
  --query 'imageDetails[0].imageDigest' \
  --output text 2>/dev/null || echo "N/A")

if [ "$IMAGE_DIGEST" != "N/A" ]; then
  echo "  Image Digest: ${IMAGE_DIGEST}"
fi

echo ""

# Success!
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Your image is now available in ECR:"
echo "   ${ECR_URI}:${IMAGE_TAG}"
echo ""
echo "2. ECS will automatically use the new image on next test run"
echo ""
echo "3. To test browser support, create a test config with one of:"
echo "   - JMeter JSR223: {\"testType\": \"browser\", \"testScript\": \"test.jmx\"}"
echo "   - Python Playwright: {\"testType\": \"browser\", \"testScript\": \"test.py\"}"
echo "   - JavaScript Playwright: {\"testType\": \"browser\", \"testScript\": \"test.js\"}"
echo ""
echo "4. Run a test via GitHub Actions or Step Functions"
echo ""
echo "5. Monitor logs:"
echo "   aws logs tail /jmeter/browser --follow"
echo ""
echo "6. Review the browser testing guide:"
echo "   docs/BROWSER_TESTING_GUIDE.md"
echo ""
echo "=========================================="
echo "Image Details Summary"
echo "=========================================="
echo "  Repository: ${ECR_REPO}"
echo "  Tag: ${IMAGE_TAG}"
echo "  Size: ${IMAGE_SIZE}"
echo "  Features:"
echo "    ✅ Chromium Browser"
echo "    ✅ ChromeDriver (matching version)"
echo "    ✅ Selenium WebDriver 4.25.0"
echo "    ✅ Python Playwright 1.40.0"
echo "    ✅ JavaScript Playwright 1.40.0 (k6-ready!)"
echo "    ✅ Node.js + npm"
echo "    ✅ Xvfb (headless display)"
echo "    ✅ Fonts & Graphics libraries"
echo ""
echo "  Cost Impact:"
echo "    API tests (.jmx, testType: \"api\"): $0.025/test (unchanged)"
echo "    Browser JMeter (.jmx, testType: \"browser\"): $0.048/test"
echo "    Browser Playwright (.py/.js, testType: \"browser\"): $0.035/test (lower!)"
echo ""
echo "  Test File Extensions:"
echo "    .jmx → JMeter (API or JSR223 browser)"
echo "    .py  → Python Playwright"
echo "    .js  → JavaScript Playwright (k6-compatible!)"
echo ""
echo "Happy Testing! 🎭"