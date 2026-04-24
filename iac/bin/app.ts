#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JMeterBatchStack } from '../lib/jmeter-stack';

const app = new cdk.App();

new JMeterBatchStack(app, 'JMeterBatchStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Modern JMeter performance testing with AWS Batch - optimized for cost and speed',
  tags: {
    Project: 'jmeter-batch-framework',
    ManagedBy: 'CDK',
    CostCenter: 'performance-testing',
  },
});

app.synth();