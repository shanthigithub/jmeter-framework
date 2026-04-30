/**
 * JMeter ECS Framework Configuration
 *
 * Simple, environment-agnostic configuration.
 * Personal AWS account optimized for cost and performance.
 */
export declare const config: {
    region: string;
    configBucket: string;
    resultsBucket: string;
    ecrRepoName: string;
    ecs: {
        apiTask: {
            vcpus: number;
            memoryMiB: number;
            retryAttempts: number;
            timeoutMinutes: number;
        };
        browserTask: {
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
            submitTasks: number;
            checkTasks: number;
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
        datadogSecretArn: string;
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
 *       "testType": "api",
 *       "testScript": "tests/api-load.jmx",
 *       "numOfContainers": 3,
 *       "threads": 100,
 *       "duration": "15m",
 *       "dataFiles": ["data/users.csv", "data/products.csv"],
 *       "execute": true
 *     },
 *     {
 *       "testId": "browser-selenium-test",
 *       "testType": "browser",
 *       "testScript": "tests/browser/ui-flow.jmx",
 *       "numOfContainers": 2,
 *       "threads": 10,
 *       "duration": "30m",
 *       "execute": true
 *     }
 *   ]
 * }
 */
export interface TestConfig {
    testId: string;
    testType?: 'api' | 'browser';
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
