import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
/**
 * JMeter ECS Fargate Framework Stack
 *
 * Direct ECS Fargate execution - no AWS Batch complexity!
 *
 * Key Features:
 * - Direct ECS Fargate task invocation (simpler, faster)
 * - No master-minion architecture (k6-style segments)
 * - S3-based dynamic loading (small images, fast deployments)
 * - Lambda orchestration (serverless, pay-per-use)
 * - Step Functions workflow (reliable, observable)
 * - Instant capacity (no SPOT wait times)
 * - Easier debugging (direct ECS logs)
 */
export declare class JMeterEcsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
