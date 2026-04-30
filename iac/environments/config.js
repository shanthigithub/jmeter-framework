"use strict";
/**
 * JMeter ECS Framework Configuration
 *
 * Simple, environment-agnostic configuration.
 * Personal AWS account optimized for cost and performance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    // AWS Account (will be automatically detected from CDK context)
    region: 'us-east-1',
    // S3 Buckets
    configBucket: 'jmeter-framework-config',
    resultsBucket: 'jmeter-framework-results',
    // ECR
    ecrRepoName: 'jmeter-framework',
    // ECS Fargate Configuration
    ecs: {
        // API Task Configuration (Lightweight - HTTP/REST)
        apiTask: {
            vcpus: 2, // 2 vCPU per task
            memoryMiB: 4096, // 4 GB RAM per task
            retryAttempts: 3, // Retry failed tasks 3 times
            timeoutMinutes: 120, // 2 hour timeout per task
        },
        // Browser Task Configuration (Heavy - Selenium/JSR223)
        browserTask: {
            vcpus: 4, // 4 vCPU per task (2x API)
            memoryMiB: 8192, // 8 GB RAM per task (2x API)
            retryAttempts: 3, // Retry failed tasks 3 times
            timeoutMinutes: 240, // 4 hour timeout (browser tests slower)
        },
    },
    // Lambda Configuration
    lambda: {
        runtime: 'PYTHON_3_12',
        architecture: 'ARM_64', // 20% cheaper than x86
        memoryMB: 512,
        timeoutSeconds: {
            readConfig: 60, // 1 minute
            partitionData: 300, // 5 minutes
            submitTasks: 300, // 5 minutes
            checkTasks: 30, // 30 seconds (fast check only)
            mergeResults: 600, // 10 minutes (result aggregation can be slow)
        },
    },
    // Step Functions Configuration
    stepFunctions: {
        timeoutMinutes: 240, // 4 hours max per test run
        waitBetweenChecks: 60, // Poll task status every 60 seconds
    },
    // CloudWatch Logs
    logs: {
        retentionDays: 7, // 1 week retention
    },
    // Security
    security: {
        enableEncryption: true,
        enableVpcEndpoints: false, // Set true for production (extra cost)
    },
    // Monitoring
    monitoring: {
        enableDatadog: false, // Optional: Enable Datadog integration
        datadogSite: 'datadoghq.com',
        // Datadog API key from AWS Secrets Manager
        datadogSecretArn: 'arn:aws:secretsmanager:us-east-1:623035187488:secret:datadog/personal-api-key-rt1vuN',
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBRVUsUUFBQSxNQUFNLEdBQUc7SUFDcEIsZ0VBQWdFO0lBQ2hFLE1BQU0sRUFBRSxXQUFXO0lBRW5CLGFBQWE7SUFDYixZQUFZLEVBQUUseUJBQXlCO0lBQ3ZDLGFBQWEsRUFBRSwwQkFBMEI7SUFFekMsTUFBTTtJQUNOLFdBQVcsRUFBRSxrQkFBa0I7SUFFL0IsNEJBQTRCO0lBQzVCLEdBQUcsRUFBRTtRQUNILG1EQUFtRDtRQUNuRCxPQUFPLEVBQUU7WUFDUCxLQUFLLEVBQUUsQ0FBQyxFQUFnQixrQkFBa0I7WUFDMUMsU0FBUyxFQUFFLElBQUksRUFBUyxvQkFBb0I7WUFDNUMsYUFBYSxFQUFFLENBQUMsRUFBUSw2QkFBNkI7WUFDckQsY0FBYyxFQUFFLEdBQUcsRUFBSywwQkFBMEI7U0FDbkQ7UUFDRCx1REFBdUQ7UUFDdkQsV0FBVyxFQUFFO1lBQ1gsS0FBSyxFQUFFLENBQUMsRUFBZ0IsMkJBQTJCO1lBQ25ELFNBQVMsRUFBRSxJQUFJLEVBQVMsNkJBQTZCO1lBQ3JELGFBQWEsRUFBRSxDQUFDLEVBQVEsNkJBQTZCO1lBQ3JELGNBQWMsRUFBRSxHQUFHLEVBQUssd0NBQXdDO1NBQ2pFO0tBQ0Y7SUFFRCx1QkFBdUI7SUFDdkIsTUFBTSxFQUFFO1FBQ04sT0FBTyxFQUFFLGFBQXNCO1FBQy9CLFlBQVksRUFBRSxRQUFpQixFQUFHLHVCQUF1QjtRQUN6RCxRQUFRLEVBQUUsR0FBRztRQUNiLGNBQWMsRUFBRTtZQUNkLFVBQVUsRUFBRSxFQUFFLEVBQVMsV0FBVztZQUNsQyxhQUFhLEVBQUUsR0FBRyxFQUFLLFlBQVk7WUFDbkMsV0FBVyxFQUFFLEdBQUcsRUFBTyxZQUFZO1lBQ25DLFVBQVUsRUFBRSxFQUFFLEVBQVMsK0JBQStCO1lBQ3RELFlBQVksRUFBRSxHQUFHLEVBQU0sOENBQThDO1NBQ3RFO0tBQ0Y7SUFFRCwrQkFBK0I7SUFDL0IsYUFBYSxFQUFFO1FBQ2IsY0FBYyxFQUFFLEdBQUcsRUFBTSwyQkFBMkI7UUFDcEQsaUJBQWlCLEVBQUUsRUFBRSxFQUFJLG9DQUFvQztLQUM5RDtJQUVELGtCQUFrQjtJQUNsQixJQUFJLEVBQUU7UUFDSixhQUFhLEVBQUUsQ0FBQyxFQUFTLG1CQUFtQjtLQUM3QztJQUVELFdBQVc7SUFDWCxRQUFRLEVBQUU7UUFDUixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLGtCQUFrQixFQUFFLEtBQUssRUFBRyx1Q0FBdUM7S0FDcEU7SUFFRCxhQUFhO0lBQ2IsVUFBVSxFQUFFO1FBQ1YsYUFBYSxFQUFFLEtBQUssRUFBSyx1Q0FBdUM7UUFDaEUsV0FBVyxFQUFFLGVBQWU7UUFDNUIsMkNBQTJDO1FBQzNDLGdCQUFnQixFQUFFLHNGQUFzRjtLQUN6RztDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogSk1ldGVyIEVDUyBGcmFtZXdvcmsgQ29uZmlndXJhdGlvblxyXG4gKiBcclxuICogU2ltcGxlLCBlbnZpcm9ubWVudC1hZ25vc3RpYyBjb25maWd1cmF0aW9uLlxyXG4gKiBQZXJzb25hbCBBV1MgYWNjb3VudCBvcHRpbWl6ZWQgZm9yIGNvc3QgYW5kIHBlcmZvcm1hbmNlLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBjb25zdCBjb25maWcgPSB7XHJcbiAgLy8gQVdTIEFjY291bnQgKHdpbGwgYmUgYXV0b21hdGljYWxseSBkZXRlY3RlZCBmcm9tIENESyBjb250ZXh0KVxyXG4gIHJlZ2lvbjogJ3VzLWVhc3QtMScsXHJcbiAgXHJcbiAgLy8gUzMgQnVja2V0c1xyXG4gIGNvbmZpZ0J1Y2tldDogJ2ptZXRlci1mcmFtZXdvcmstY29uZmlnJyxcclxuICByZXN1bHRzQnVja2V0OiAnam1ldGVyLWZyYW1ld29yay1yZXN1bHRzJyxcclxuICBcclxuICAvLyBFQ1JcclxuICBlY3JSZXBvTmFtZTogJ2ptZXRlci1mcmFtZXdvcmsnLFxyXG4gIFxyXG4gIC8vIEVDUyBGYXJnYXRlIENvbmZpZ3VyYXRpb25cclxuICBlY3M6IHtcclxuICAgIC8vIEFQSSBUYXNrIENvbmZpZ3VyYXRpb24gKExpZ2h0d2VpZ2h0IC0gSFRUUC9SRVNUKVxyXG4gICAgYXBpVGFzazoge1xyXG4gICAgICB2Y3B1czogMiwgICAgICAgICAgICAgICAvLyAyIHZDUFUgcGVyIHRhc2tcclxuICAgICAgbWVtb3J5TWlCOiA0MDk2LCAgICAgICAgLy8gNCBHQiBSQU0gcGVyIHRhc2tcclxuICAgICAgcmV0cnlBdHRlbXB0czogMywgICAgICAgLy8gUmV0cnkgZmFpbGVkIHRhc2tzIDMgdGltZXNcclxuICAgICAgdGltZW91dE1pbnV0ZXM6IDEyMCwgICAgLy8gMiBob3VyIHRpbWVvdXQgcGVyIHRhc2tcclxuICAgIH0sXHJcbiAgICAvLyBCcm93c2VyIFRhc2sgQ29uZmlndXJhdGlvbiAoSGVhdnkgLSBTZWxlbml1bS9KU1IyMjMpXHJcbiAgICBicm93c2VyVGFzazoge1xyXG4gICAgICB2Y3B1czogNCwgICAgICAgICAgICAgICAvLyA0IHZDUFUgcGVyIHRhc2sgKDJ4IEFQSSlcclxuICAgICAgbWVtb3J5TWlCOiA4MTkyLCAgICAgICAgLy8gOCBHQiBSQU0gcGVyIHRhc2sgKDJ4IEFQSSlcclxuICAgICAgcmV0cnlBdHRlbXB0czogMywgICAgICAgLy8gUmV0cnkgZmFpbGVkIHRhc2tzIDMgdGltZXNcclxuICAgICAgdGltZW91dE1pbnV0ZXM6IDI0MCwgICAgLy8gNCBob3VyIHRpbWVvdXQgKGJyb3dzZXIgdGVzdHMgc2xvd2VyKVxyXG4gICAgfSxcclxuICB9LFxyXG4gIFxyXG4gIC8vIExhbWJkYSBDb25maWd1cmF0aW9uXHJcbiAgbGFtYmRhOiB7XHJcbiAgICBydW50aW1lOiAnUFlUSE9OXzNfMTInIGFzIGNvbnN0LFxyXG4gICAgYXJjaGl0ZWN0dXJlOiAnQVJNXzY0JyBhcyBjb25zdCwgIC8vIDIwJSBjaGVhcGVyIHRoYW4geDg2XHJcbiAgICBtZW1vcnlNQjogNTEyLFxyXG4gICAgdGltZW91dFNlY29uZHM6IHtcclxuICAgICAgcmVhZENvbmZpZzogNjAsICAgICAgICAvLyAxIG1pbnV0ZVxyXG4gICAgICBwYXJ0aXRpb25EYXRhOiAzMDAsICAgIC8vIDUgbWludXRlc1xyXG4gICAgICBzdWJtaXRUYXNrczogMzAwLCAgICAgIC8vIDUgbWludXRlc1xyXG4gICAgICBjaGVja1Rhc2tzOiAzMCwgICAgICAgIC8vIDMwIHNlY29uZHMgKGZhc3QgY2hlY2sgb25seSlcclxuICAgICAgbWVyZ2VSZXN1bHRzOiA2MDAsICAgICAvLyAxMCBtaW51dGVzIChyZXN1bHQgYWdncmVnYXRpb24gY2FuIGJlIHNsb3cpXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgXHJcbiAgLy8gU3RlcCBGdW5jdGlvbnMgQ29uZmlndXJhdGlvblxyXG4gIHN0ZXBGdW5jdGlvbnM6IHtcclxuICAgIHRpbWVvdXRNaW51dGVzOiAyNDAsICAgICAvLyA0IGhvdXJzIG1heCBwZXIgdGVzdCBydW5cclxuICAgIHdhaXRCZXR3ZWVuQ2hlY2tzOiA2MCwgICAvLyBQb2xsIHRhc2sgc3RhdHVzIGV2ZXJ5IDYwIHNlY29uZHNcclxuICB9LFxyXG4gIFxyXG4gIC8vIENsb3VkV2F0Y2ggTG9nc1xyXG4gIGxvZ3M6IHtcclxuICAgIHJldGVudGlvbkRheXM6IDcsICAgICAgICAvLyAxIHdlZWsgcmV0ZW50aW9uXHJcbiAgfSxcclxuICBcclxuICAvLyBTZWN1cml0eVxyXG4gIHNlY3VyaXR5OiB7XHJcbiAgICBlbmFibGVFbmNyeXB0aW9uOiB0cnVlLFxyXG4gICAgZW5hYmxlVnBjRW5kcG9pbnRzOiBmYWxzZSwgIC8vIFNldCB0cnVlIGZvciBwcm9kdWN0aW9uIChleHRyYSBjb3N0KVxyXG4gIH0sXHJcbiAgXHJcbiAgLy8gTW9uaXRvcmluZ1xyXG4gIG1vbml0b3Jpbmc6IHtcclxuICAgIGVuYWJsZURhdGFkb2c6IGZhbHNlLCAgICAvLyBPcHRpb25hbDogRW5hYmxlIERhdGFkb2cgaW50ZWdyYXRpb25cclxuICAgIGRhdGFkb2dTaXRlOiAnZGF0YWRvZ2hxLmNvbScsXHJcbiAgICAvLyBEYXRhZG9nIEFQSSBrZXkgZnJvbSBBV1MgU2VjcmV0cyBNYW5hZ2VyXHJcbiAgICBkYXRhZG9nU2VjcmV0QXJuOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTE6NjIzMDM1MTg3NDg4OnNlY3JldDpkYXRhZG9nL3BlcnNvbmFsLWFwaS1rZXktcnQxdnVOJyxcclxuICB9LFxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRlc3QgU3VpdGUgQ29uZmlndXJhdGlvbiBTY2hlbWFcclxuICogXHJcbiAqIEV4YW1wbGUgdGVzdCBzdWl0ZSBKU09OIHN0cnVjdHVyZSBleHBlY3RlZCBpbiBTMzpcclxuICoge1xyXG4gKiAgIFwidGVzdFN1aXRlXCI6IFtcclxuICogICAgIHtcclxuICogICAgICAgXCJ0ZXN0SWRcIjogXCJhcGktbG9hZC10ZXN0XCIsXHJcbiAqICAgICAgIFwidGVzdFR5cGVcIjogXCJhcGlcIixcclxuICogICAgICAgXCJ0ZXN0U2NyaXB0XCI6IFwidGVzdHMvYXBpLWxvYWQuam14XCIsXHJcbiAqICAgICAgIFwibnVtT2ZDb250YWluZXJzXCI6IDMsXHJcbiAqICAgICAgIFwidGhyZWFkc1wiOiAxMDAsXHJcbiAqICAgICAgIFwiZHVyYXRpb25cIjogXCIxNW1cIixcclxuICogICAgICAgXCJkYXRhRmlsZXNcIjogW1wiZGF0YS91c2Vycy5jc3ZcIiwgXCJkYXRhL3Byb2R1Y3RzLmNzdlwiXSxcclxuICogICAgICAgXCJleGVjdXRlXCI6IHRydWVcclxuICogICAgIH0sXHJcbiAqICAgICB7XHJcbiAqICAgICAgIFwidGVzdElkXCI6IFwiYnJvd3Nlci1zZWxlbml1bS10ZXN0XCIsXHJcbiAqICAgICAgIFwidGVzdFR5cGVcIjogXCJicm93c2VyXCIsXHJcbiAqICAgICAgIFwidGVzdFNjcmlwdFwiOiBcInRlc3RzL2Jyb3dzZXIvdWktZmxvdy5qbXhcIixcclxuICogICAgICAgXCJudW1PZkNvbnRhaW5lcnNcIjogMixcclxuICogICAgICAgXCJ0aHJlYWRzXCI6IDEwLFxyXG4gKiAgICAgICBcImR1cmF0aW9uXCI6IFwiMzBtXCIsXHJcbiAqICAgICAgIFwiZXhlY3V0ZVwiOiB0cnVlXHJcbiAqICAgICB9XHJcbiAqICAgXVxyXG4gKiB9XHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFRlc3RDb25maWcge1xyXG4gIHRlc3RJZDogc3RyaW5nO1xyXG4gIHRlc3RUeXBlPzogJ2FwaScgfCAnYnJvd3Nlcic7ICAvLyBUZXN0IHR5cGUgKGRlZmF1bHRzIHRvICdhcGknKVxyXG4gIHRlc3RTY3JpcHQ6IHN0cmluZztcclxuICBudW1PZkNvbnRhaW5lcnM6IG51bWJlcjtcclxuICB0aHJlYWRzOiBudW1iZXI7XHJcbiAgZHVyYXRpb246IHN0cmluZztcclxuICBkYXRhRmlsZXM/OiBzdHJpbmdbXTtcclxuICBleGVjdXRlOiBib29sZWFuO1xyXG4gIGp2bUFyZ3M/OiBzdHJpbmc7ICAvLyBPcHRpb25hbCBKVk0gYXJndW1lbnRzXHJcbiAgam1ldGVyUHJvcGVydGllcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47ICAvLyBPcHRpb25hbCBKTWV0ZXIgcHJvcGVydGllc1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRlc3RTdWl0ZSB7XHJcbiAgdGVzdFN1aXRlOiBUZXN0Q29uZmlnW107XHJcbn0iXX0=