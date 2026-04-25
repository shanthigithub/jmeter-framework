import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
/**
 * JMeter Batch Framework Stack
 *
 * Modern, cost-optimized JMeter testing using AWS Batch + Spot instances.
 *
 * Key Features:
 * - AWS Batch with Spot instances (70% cost savings)
 * - No master-minion architecture (independent execution)
 * - S3-based dynamic loading (small images, fast deployments)
 * - Lambda orchestration (serverless, pay-per-use)
 * - Step Functions workflow (reliable, observable)
 * - Comprehensive error handling
 * - Security best practices
 */
export declare class JMeterBatchStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
