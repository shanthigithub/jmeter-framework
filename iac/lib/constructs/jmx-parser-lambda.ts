import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface JmxParserLambdaProps {
  configBucket: s3.IBucket;
}

export class JmxParserLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: JmxParserLambdaProps) {
    super(scope, id);

    // Create Lambda function
    this.function = new lambda.Function(this, 'JmxParserFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('lambda/jmx-parser'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      description: 'Parses JMX files to extract test configuration automatically',
      environment: {
        CONFIG_BUCKET: props.configBucket.bucketName,
      },
      logRetention: 7, // Keep logs for 7 days
    });

    // Grant S3 read permissions
    props.configBucket.grantRead(this.function);

    // Add inline policy for enhanced logging
    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Output the function ARN
    new cdk.CfnOutput(this, 'JmxParserFunctionArn', {
      value: this.function.functionArn,
      description: 'ARN of the JMX Parser Lambda function',
      exportName: 'JmxParserFunctionArn',
    });
  }
}