import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export interface JmxParserLambdaProps {
    configBucket: s3.IBucket;
}
export declare class JmxParserLambda extends Construct {
    readonly function: lambda.Function;
    constructor(scope: Construct, id: string, props: JmxParserLambdaProps);
}
