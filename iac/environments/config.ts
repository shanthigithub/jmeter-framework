/**
 * JMeter ECS Framework Configuration
 * 
 * Simple, environment-agnostic configuration.
 * Personal AWS account optimized for cost and performance.
 */

export const config = {
  // AWS Account (will be automatically detected from CDK context)
  region: 'us-east-1',
  
  // S3 Buckets
  configBucket: 'jmeter-framework-config',
  resultsBucket: 'jmeter-framework-results',
  
  // ECR
  ecrRepoName: 'jmeter-framework',
  
  // ECS Fargate Configuration
  ecs: {
    // Task Configuration
    task: {
      vcpus: 2,               // 2 vCPU per task
      memoryMiB: 4096,        // 4 GB RAM per task
      retryAttempts: 3,       // Retry failed tasks 3 times
      timeoutMinutes: 120,    // 2 hour timeout per task
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
      submitTasks: 300,      // 5 minutes
      checkTasks: 30,        // 30 seconds (fast check only)
      mergeResults: 600,     // 10 minutes (result aggregation can be slow)
    },
  },
  
  // Step Functions Configuration
  stepFunctions: {
    timeoutMinutes: 240,     // 4 hours max per test run
    waitBetweenChecks: 60,   // Poll task status every 60 seconds
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
  
  // Datadog Integration (Optional)
  // Credentials stored in AWS Secrets Manager for security
  datadog: {
    secretName: 'datadog/api-credentials',  // AWS Secrets Manager secret name
    // Secret should contain: { "apiKey": "your-key", "site": "datadoghq.com" }
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