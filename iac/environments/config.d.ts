/**
 * JMeter Batch Framework Configuration
 *
 * Simple, environment-agnostic configuration.
 * Personal AWS account optimized for cost and performance.
 */
export declare const config: {
    region: string;
    configBucket: string;
    resultsBucket: string;
    ecrRepoName: string;
    batch: {
        compute: {
            type: "SPOT";
            minvCpus: number;
            maxvCpus: number;
            desiredvCpus: number;
            spotBidPercentage: number;
            instanceTypes: string[];
        };
        job: {
            vcpus: number;
            memoryMiB: number;
            retryAttempts: number;
            timeoutMinutes: number;
        };
    };
    lambda: {
        runtime: "PYTHON_3_12";
        architecture: "ARM_64";
        memoryMB: number;
        timeoutSeconds: {
            readConfig: number;
            partitionData: number;
            submitJobs: number;
            checkJobs: number;
            mergeResults: number;
        };
    };
    stepFunctions: {
        timeoutMinutes: number;
        waitBetweenChecks: number;
    };
    logs: {
        retentionDays: number;
    };
    security: {
        enableEncryption: boolean;
        enableVpcEndpoints: boolean;
    };
    monitoring: {
        enableDatadog: boolean;
        datadogSite: string;
    };
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
    jvmArgs?: string;
    jmeterProperties?: Record<string, string>;
}
export interface TestSuite {
    testSuite: TestConfig[];
}
