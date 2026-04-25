"use strict";
/**
 * JMeter Batch Framework Configuration
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
    configBucket: 'jmeter-batch-config',
    resultsBucket: 'jmeter-batch-results',
    // ECR
    ecrRepoName: 'jmeter-batch',
    // AWS Batch Configuration
    batch: {
        // Compute Environment
        compute: {
            type: 'SPOT', // Use Spot instances for 70% savings
            minvCpus: 0, // Scale to zero when idle
            maxvCpus: 16, // Max 8 concurrent 2-vCPU jobs
            desiredvCpus: 0, // Start at zero
            spotBidPercentage: 100, // Max bid = on-demand price (rarely interrupted)
            instanceTypes: [
                'optimal', // Let AWS Batch automatically select best available instance types
            ],
        },
        // Job Definition
        job: {
            vcpus: 2, // 2 vCPU per job
            memoryMiB: 4096, // 4 GB RAM per job
            retryAttempts: 3, // Retry failed jobs 3 times
            timeoutMinutes: 120, // 2 hour timeout per job
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
            submitJobs: 300, // 5 minutes
            checkJobs: 30, // 30 seconds (fast check only)
            mergeResults: 600, // 10 minutes (result aggregation can be slow)
        },
    },
    // Step Functions Configuration
    stepFunctions: {
        timeoutMinutes: 240, // 4 hours max per test run
        waitBetweenChecks: 60, // Poll job status every 60 seconds
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
        datadogSite: 'us5.datadoghq.com',
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBRVUsUUFBQSxNQUFNLEdBQUc7SUFDcEIsZ0VBQWdFO0lBQ2hFLE1BQU0sRUFBRSxXQUFXO0lBRW5CLGFBQWE7SUFDYixZQUFZLEVBQUUscUJBQXFCO0lBQ25DLGFBQWEsRUFBRSxzQkFBc0I7SUFFckMsTUFBTTtJQUNOLFdBQVcsRUFBRSxjQUFjO0lBRTNCLDBCQUEwQjtJQUMxQixLQUFLLEVBQUU7UUFDTCxzQkFBc0I7UUFDdEIsT0FBTyxFQUFFO1lBQ1AsSUFBSSxFQUFFLE1BQWUsRUFBRyxxQ0FBcUM7WUFDN0QsUUFBUSxFQUFFLENBQUMsRUFBYSwwQkFBMEI7WUFDbEQsUUFBUSxFQUFFLEVBQUUsRUFBWSwrQkFBK0I7WUFDdkQsWUFBWSxFQUFFLENBQUMsRUFBUyxnQkFBZ0I7WUFDeEMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLGlEQUFpRDtZQUN6RSxhQUFhLEVBQUU7Z0JBQ2IsU0FBUyxFQUFHLG1FQUFtRTthQUNoRjtTQUNGO1FBRUQsaUJBQWlCO1FBQ2pCLEdBQUcsRUFBRTtZQUNILEtBQUssRUFBRSxDQUFDLEVBQWdCLGlCQUFpQjtZQUN6QyxTQUFTLEVBQUUsSUFBSSxFQUFTLG1CQUFtQjtZQUMzQyxhQUFhLEVBQUUsQ0FBQyxFQUFRLDRCQUE0QjtZQUNwRCxjQUFjLEVBQUUsR0FBRyxFQUFLLHlCQUF5QjtTQUNsRDtLQUNGO0lBRUQsdUJBQXVCO0lBQ3ZCLE1BQU0sRUFBRTtRQUNOLE9BQU8sRUFBRSxhQUFzQjtRQUMvQixZQUFZLEVBQUUsUUFBaUIsRUFBRyx1QkFBdUI7UUFDekQsUUFBUSxFQUFFLEdBQUc7UUFDYixjQUFjLEVBQUU7WUFDZCxVQUFVLEVBQUUsRUFBRSxFQUFTLFdBQVc7WUFDbEMsYUFBYSxFQUFFLEdBQUcsRUFBSyxZQUFZO1lBQ25DLFVBQVUsRUFBRSxHQUFHLEVBQVEsWUFBWTtZQUNuQyxTQUFTLEVBQUUsRUFBRSxFQUFVLCtCQUErQjtZQUN0RCxZQUFZLEVBQUUsR0FBRyxFQUFNLDhDQUE4QztTQUN0RTtLQUNGO0lBRUQsK0JBQStCO0lBQy9CLGFBQWEsRUFBRTtRQUNiLGNBQWMsRUFBRSxHQUFHLEVBQU0sMkJBQTJCO1FBQ3BELGlCQUFpQixFQUFFLEVBQUUsRUFBSSxtQ0FBbUM7S0FDN0Q7SUFFRCxrQkFBa0I7SUFDbEIsSUFBSSxFQUFFO1FBQ0osYUFBYSxFQUFFLENBQUMsRUFBUyxtQkFBbUI7S0FDN0M7SUFFRCxXQUFXO0lBQ1gsUUFBUSxFQUFFO1FBQ1IsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixrQkFBa0IsRUFBRSxLQUFLLEVBQUcsdUNBQXVDO0tBQ3BFO0lBRUQsYUFBYTtJQUNiLFVBQVUsRUFBRTtRQUNWLGFBQWEsRUFBRSxLQUFLLEVBQUssdUNBQXVDO1FBQ2hFLFdBQVcsRUFBRSxtQkFBbUI7S0FDakM7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEpNZXRlciBCYXRjaCBGcmFtZXdvcmsgQ29uZmlndXJhdGlvblxyXG4gKiBcclxuICogU2ltcGxlLCBlbnZpcm9ubWVudC1hZ25vc3RpYyBjb25maWd1cmF0aW9uLlxyXG4gKiBQZXJzb25hbCBBV1MgYWNjb3VudCBvcHRpbWl6ZWQgZm9yIGNvc3QgYW5kIHBlcmZvcm1hbmNlLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBjb25zdCBjb25maWcgPSB7XHJcbiAgLy8gQVdTIEFjY291bnQgKHdpbGwgYmUgYXV0b21hdGljYWxseSBkZXRlY3RlZCBmcm9tIENESyBjb250ZXh0KVxyXG4gIHJlZ2lvbjogJ3VzLWVhc3QtMScsXHJcbiAgXHJcbiAgLy8gUzMgQnVja2V0c1xyXG4gIGNvbmZpZ0J1Y2tldDogJ2ptZXRlci1iYXRjaC1jb25maWcnLFxyXG4gIHJlc3VsdHNCdWNrZXQ6ICdqbWV0ZXItYmF0Y2gtcmVzdWx0cycsXHJcbiAgXHJcbiAgLy8gRUNSXHJcbiAgZWNyUmVwb05hbWU6ICdqbWV0ZXItYmF0Y2gnLFxyXG4gIFxyXG4gIC8vIEFXUyBCYXRjaCBDb25maWd1cmF0aW9uXHJcbiAgYmF0Y2g6IHtcclxuICAgIC8vIENvbXB1dGUgRW52aXJvbm1lbnRcclxuICAgIGNvbXB1dGU6IHtcclxuICAgICAgdHlwZTogJ1NQT1QnIGFzIGNvbnN0LCAgLy8gVXNlIFNwb3QgaW5zdGFuY2VzIGZvciA3MCUgc2F2aW5nc1xyXG4gICAgICBtaW52Q3B1czogMCwgICAgICAgICAgICAvLyBTY2FsZSB0byB6ZXJvIHdoZW4gaWRsZVxyXG4gICAgICBtYXh2Q3B1czogMTYsICAgICAgICAgICAvLyBNYXggOCBjb25jdXJyZW50IDItdkNQVSBqb2JzXHJcbiAgICAgIGRlc2lyZWR2Q3B1czogMCwgICAgICAgIC8vIFN0YXJ0IGF0IHplcm9cclxuICAgICAgc3BvdEJpZFBlcmNlbnRhZ2U6IDEwMCwgLy8gTWF4IGJpZCA9IG9uLWRlbWFuZCBwcmljZSAocmFyZWx5IGludGVycnVwdGVkKVxyXG4gICAgICBpbnN0YW5jZVR5cGVzOiBbXHJcbiAgICAgICAgJ29wdGltYWwnLCAgLy8gTGV0IEFXUyBCYXRjaCBhdXRvbWF0aWNhbGx5IHNlbGVjdCBiZXN0IGF2YWlsYWJsZSBpbnN0YW5jZSB0eXBlc1xyXG4gICAgICBdLFxyXG4gICAgfSxcclxuICAgIFxyXG4gICAgLy8gSm9iIERlZmluaXRpb25cclxuICAgIGpvYjoge1xyXG4gICAgICB2Y3B1czogMiwgICAgICAgICAgICAgICAvLyAyIHZDUFUgcGVyIGpvYlxyXG4gICAgICBtZW1vcnlNaUI6IDQwOTYsICAgICAgICAvLyA0IEdCIFJBTSBwZXIgam9iXHJcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDMsICAgICAgIC8vIFJldHJ5IGZhaWxlZCBqb2JzIDMgdGltZXNcclxuICAgICAgdGltZW91dE1pbnV0ZXM6IDEyMCwgICAgLy8gMiBob3VyIHRpbWVvdXQgcGVyIGpvYlxyXG4gICAgfSxcclxuICB9LFxyXG4gIFxyXG4gIC8vIExhbWJkYSBDb25maWd1cmF0aW9uXHJcbiAgbGFtYmRhOiB7XHJcbiAgICBydW50aW1lOiAnUFlUSE9OXzNfMTInIGFzIGNvbnN0LFxyXG4gICAgYXJjaGl0ZWN0dXJlOiAnQVJNXzY0JyBhcyBjb25zdCwgIC8vIDIwJSBjaGVhcGVyIHRoYW4geDg2XHJcbiAgICBtZW1vcnlNQjogNTEyLFxyXG4gICAgdGltZW91dFNlY29uZHM6IHtcclxuICAgICAgcmVhZENvbmZpZzogNjAsICAgICAgICAvLyAxIG1pbnV0ZVxyXG4gICAgICBwYXJ0aXRpb25EYXRhOiAzMDAsICAgIC8vIDUgbWludXRlc1xyXG4gICAgICBzdWJtaXRKb2JzOiAzMDAsICAgICAgIC8vIDUgbWludXRlc1xyXG4gICAgICBjaGVja0pvYnM6IDMwLCAgICAgICAgIC8vIDMwIHNlY29uZHMgKGZhc3QgY2hlY2sgb25seSlcclxuICAgICAgbWVyZ2VSZXN1bHRzOiA2MDAsICAgICAvLyAxMCBtaW51dGVzIChyZXN1bHQgYWdncmVnYXRpb24gY2FuIGJlIHNsb3cpXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgXHJcbiAgLy8gU3RlcCBGdW5jdGlvbnMgQ29uZmlndXJhdGlvblxyXG4gIHN0ZXBGdW5jdGlvbnM6IHtcclxuICAgIHRpbWVvdXRNaW51dGVzOiAyNDAsICAgICAvLyA0IGhvdXJzIG1heCBwZXIgdGVzdCBydW5cclxuICAgIHdhaXRCZXR3ZWVuQ2hlY2tzOiA2MCwgICAvLyBQb2xsIGpvYiBzdGF0dXMgZXZlcnkgNjAgc2Vjb25kc1xyXG4gIH0sXHJcbiAgXHJcbiAgLy8gQ2xvdWRXYXRjaCBMb2dzXHJcbiAgbG9nczoge1xyXG4gICAgcmV0ZW50aW9uRGF5czogNywgICAgICAgIC8vIDEgd2VlayByZXRlbnRpb25cclxuICB9LFxyXG4gIFxyXG4gIC8vIFNlY3VyaXR5XHJcbiAgc2VjdXJpdHk6IHtcclxuICAgIGVuYWJsZUVuY3J5cHRpb246IHRydWUsXHJcbiAgICBlbmFibGVWcGNFbmRwb2ludHM6IGZhbHNlLCAgLy8gU2V0IHRydWUgZm9yIHByb2R1Y3Rpb24gKGV4dHJhIGNvc3QpXHJcbiAgfSxcclxuICBcclxuICAvLyBNb25pdG9yaW5nXHJcbiAgbW9uaXRvcmluZzoge1xyXG4gICAgZW5hYmxlRGF0YWRvZzogZmFsc2UsICAgIC8vIE9wdGlvbmFsOiBFbmFibGUgRGF0YWRvZyBpbnRlZ3JhdGlvblxyXG4gICAgZGF0YWRvZ1NpdGU6ICd1czUuZGF0YWRvZ2hxLmNvbScsXHJcbiAgfSxcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUZXN0IFN1aXRlIENvbmZpZ3VyYXRpb24gU2NoZW1hXHJcbiAqIFxyXG4gKiBFeGFtcGxlIHRlc3Qgc3VpdGUgSlNPTiBzdHJ1Y3R1cmUgZXhwZWN0ZWQgaW4gUzM6XHJcbiAqIHtcclxuICogICBcInRlc3RTdWl0ZVwiOiBbXHJcbiAqICAgICB7XHJcbiAqICAgICAgIFwidGVzdElkXCI6IFwiYXBpLWxvYWQtdGVzdFwiLFxyXG4gKiAgICAgICBcInRlc3RTY3JpcHRcIjogXCJ0ZXN0cy9hcGktbG9hZC5qbXhcIixcclxuICogICAgICAgXCJudW1PZkNvbnRhaW5lcnNcIjogMyxcclxuICogICAgICAgXCJ0aHJlYWRzXCI6IDEwMCxcclxuICogICAgICAgXCJkdXJhdGlvblwiOiBcIjE1bVwiLFxyXG4gKiAgICAgICBcImRhdGFGaWxlc1wiOiBbXCJkYXRhL3VzZXJzLmNzdlwiLCBcImRhdGEvcHJvZHVjdHMuY3N2XCJdLFxyXG4gKiAgICAgICBcImV4ZWN1dGVcIjogdHJ1ZVxyXG4gKiAgICAgfVxyXG4gKiAgIF1cclxuICogfVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBUZXN0Q29uZmlnIHtcclxuICB0ZXN0SWQ6IHN0cmluZztcclxuICB0ZXN0U2NyaXB0OiBzdHJpbmc7XHJcbiAgbnVtT2ZDb250YWluZXJzOiBudW1iZXI7XHJcbiAgdGhyZWFkczogbnVtYmVyO1xyXG4gIGR1cmF0aW9uOiBzdHJpbmc7XHJcbiAgZGF0YUZpbGVzPzogc3RyaW5nW107XHJcbiAgZXhlY3V0ZTogYm9vbGVhbjtcclxuICBqdm1BcmdzPzogc3RyaW5nOyAgLy8gT3B0aW9uYWwgSlZNIGFyZ3VtZW50c1xyXG4gIGptZXRlclByb3BlcnRpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+OyAgLy8gT3B0aW9uYWwgSk1ldGVyIHByb3BlcnRpZXNcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBUZXN0U3VpdGUge1xyXG4gIHRlc3RTdWl0ZTogVGVzdENvbmZpZ1tdO1xyXG59Il19