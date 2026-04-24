/**
 * JMeter Batch Framework Configuration
 * 
 * Simple, environment-agnostic configuration.
 * Personal AWS account optimized for cost and performance.
 */

export const config = {
  // AWS Account (will be automatically detected from CDK context)
  region: 'us-east-1',
  
  // S3 Buckets
  configBucket: 'jmeter-batch-config',
  resultsBucket: 'jmeter-batch-results',
  
  // ECR
  ecrRepoName: 'jmeter-batch',
  
  // AWS Batch Configuration
  batch: {
    // Compute Environment
    compute: {
      type: 'SPOT' as const,  // Use Spot instances for 70% savings
      minvCpus: 0,            // Scale to zero when idle
      maxvCpus: 16,           // Max 8 concurrent 2-vCPU jobs
      desiredvCpus: 0,        // Start at zero
      spotBidPercentage: 100, // Max bid = on-demand price (rarely interrupted)
      instanceTypes: [
        'optimal',  // Let AWS Batch automatically select best available instance types
      ],
    },
    
    // Job Definition
    job: {
      vcpus: 2,               // 2 vCPU per job
      memoryMiB: 4096,        // 4 GB RAM per job
      retryAttempts: 3,       // Retry failed jobs 3 times
      timeoutMinutes: 120,    // 2 hour timeout per job
    },
  },
  
  // Lambda Configuration
  lambda: {
    runtime: 'PYTHON_3_12' as const,
    architecture: 'ARM_64' as const,  // 20% cheaper than x86
    memoryMB: 512,
    timeoutSeconds: {
      readConfig: 60,        // 1 minute
      partitionData: 300,    // 5 minutes
      submitJobs: 300,       // 5 minutes
      checkJobs: 30,         // 30 seconds (fast check only)
      mergeResults: 600,     // 10 minutes (result aggregation can be slow)
    },
  },
  
  // Step Functions Configuration
  stepFunctions: {
    timeoutMinutes: 240,     // 4 hours max per test run
    waitBetweenChecks: 60,   // Poll job status every 60 seconds
  },
  
  // CloudWatch Logs
  logs: {
    retentionDays: 7,        // 1 week retention
  },
  
  // Security
  security: {
    enableEncryption: true,
    enableVpcEndpoints: false,  // Set true for production (extra cost)
  },
  
  // Monitoring
  monitoring: {
    enableDatadog: false,    // Optional: Enable Datadog integration
    datadogSite: 'us5.datadoghq.com',
  },
};

/**
 * Test Suite Configuration Schema
 * 
 * Example test suite JSON structure expected in S3:
 * {
 *   "testSuite": [
 *     {
 *       "testId": "api-load-test",
 *       "testScript": "tests/api-load.jmx",
 *       "numOfContainers": 3,
 *       "threads": 100,
 *       "duration": "15m",
 *       "dataFiles": ["data/users.csv", "data/products.csv"],
 *       "execute": true
 *     }
 *   ]
 * }
 */
export interface TestConfig {
  testId: string;
  testScript: string;
  numOfContainers: number;
  threads: number;
  duration: string;
  dataFiles?: string[];
  execute: boolean;
  jvmArgs?: string;  // Optional JVM arguments
  jmeterProperties?: Record<string, string>;  // Optional JMeter properties
}

export interface TestSuite {
  testSuite: TestConfig[];
}