"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JMeterBatchStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const config_1 = require("../environments/config");
const path = __importStar(require("path"));
const jmx_parser_lambda_1 = require("./constructs/jmx-parser-lambda");
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
class JMeterBatchStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ═══════════════════════════════════════════════════════════════════════
        // S3 BUCKETS
        // ═══════════════════════════════════════════════════════════════════════
        const configBucket = new s3.Bucket(this, 'ConfigBucket', {
            bucketName: config_1.config.configBucket,
            versioned: true,
            encryption: config_1.config.security.enableEncryption
                ? s3.BucketEncryption.S3_MANAGED
                : s3.BucketEncryption.UNENCRYPTED,
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete test scripts on stack deletion
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
        const resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
            bucketName: config_1.config.resultsBucket,
            encryption: config_1.config.security.enableEncryption
                ? s3.BucketEncryption.S3_MANAGED
                : s3.BucketEncryption.UNENCRYPTED,
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete results on stack deletion
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [{
                    expiration: cdk.Duration.days(90), // Auto-delete after 90 days
                    transitions: [{
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30), // Move to IA after 30 days
                        }],
                }],
        });
        // ═══════════════════════════════════════════════════════════════════════
        // ECR REPOSITORY
        // ═══════════════════════════════════════════════════════════════════════
        const repository = new ecr.Repository(this, 'JMeterRepository', {
            repositoryName: config_1.config.ecrRepoName,
            imageScanOnPush: true, // Security: Scan images for vulnerabilities
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep images on stack deletion
            lifecycleRules: [{
                    description: 'Keep only last 10 images',
                    maxImageCount: 10,
                }],
        });
        // ═══════════════════════════════════════════════════════════════════════
        // VPC (Use Default VPC)
        // ═══════════════════════════════════════════════════════════════════════
        const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', {
            isDefault: true
        });
        // Security Group for Batch compute environment
        const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
            vpc,
            description: 'Security group for JMeter Batch compute environment',
            allowAllOutbound: true, // Allow internet access for downloading from S3
        });
        // ═══════════════════════════════════════════════════════════════════════
        // IAM ROLES
        // ═══════════════════════════════════════════════════════════════════════
        // Batch Service Role - allows Batch to manage EC2 instances
        const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
            ],
        });
        // EC2 Instance Role - assumed by EC2 instances in compute environment
        const ec2InstanceRole = new iam.Role(this, 'Ec2InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
            ],
        });
        // Batch Job Role - assumed by containers running JMeter
        const batchJobRole = new iam.Role(this, 'BatchJobRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Role for JMeter containers to access S3',
        });
        // Grant S3 permissions to job role
        batchJobRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3ReadConfig',
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: [
                configBucket.bucketArn,
                `${configBucket.bucketArn}/*`,
            ],
        }));
        batchJobRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3WriteResults',
            actions: ['s3:PutObject'],
            resources: [`${resultsBucket.bucketArn}/*`],
        }));
        // Batch Execution Role - pulls ECR images, writes CloudWatch logs
        const batchExecutionRole = new iam.Role(this, 'BatchExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
        // Lambda Execution Role
        const lambdaRole = new iam.Role(this, 'LambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Grant Lambda permissions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3Access',
            actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
            resources: [
                configBucket.bucketArn,
                `${configBucket.bucketArn}/*`,
                resultsBucket.bucketArn,
                `${resultsBucket.bucketArn}/*`,
            ],
        }));
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'BatchSubmitJob',
            actions: ['batch:SubmitJob', 'batch:TagResource'],
            resources: ['*'], // Will be scoped to job definition after creation
        }));
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'BatchDescribeJobs',
            actions: ['batch:DescribeJobs', 'batch:ListJobs', 'batch:TerminateJob'],
            resources: ['*'],
        }));
        // ═══════════════════════════════════════════════════════════════════════
        // AWS BATCH - COMPUTE ENVIRONMENT
        // ═══════════════════════════════════════════════════════════════════════
        // Instance profile required for EC2 instances
        const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            roles: [ec2InstanceRole.roleName],
        });
        // Launch template for EC2 instances
        const launchTemplate = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
            launchTemplateData: {
                instanceType: config_1.config.batch.compute.instanceTypes[0],
                // Use Amazon ECS-optimized AMI (automatically resolved by Batch)
                imageId: ec2.MachineImage.latestAmazonLinux2({
                    cpuType: ec2.AmazonLinuxCpuType.X86_64,
                }).getImage(this).imageId,
                iamInstanceProfile: {
                    arn: instanceProfile.attrArn,
                },
                securityGroupIds: [batchSecurityGroup.securityGroupId],
                userData: cdk.Fn.base64((() => {
                    const userData = ec2.UserData.forLinux();
                    userData.addCommands('#!/bin/bash', 'echo ECS_CLUSTER=${ECS_CLUSTER} >> /etc/ecs/ecs.config', 'echo ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config');
                    return userData.render();
                })()),
            },
        });
        // Compute environment using On-Demand instances (changed from Spot for reliability)
        const computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
            type: 'MANAGED',
            computeEnvironmentName: 'jmeter-batch-ondemand', // Renamed from 'jmeter-batch-spot' to allow replacement
            serviceRole: batchServiceRole.roleArn,
            computeResources: {
                type: 'EC2', // Changed from SPOT to ON_DEMAND for reliability
                minvCpus: 2, // Keep 1 instance warm to avoid cold start delays
                maxvCpus: config_1.config.batch.compute.maxvCpus,
                desiredvCpus: 2, // Start with 1 instance ready
                instanceTypes: config_1.config.batch.compute.instanceTypes,
                subnets: vpc.publicSubnets.map(subnet => subnet.subnetId),
                securityGroupIds: [batchSecurityGroup.securityGroupId],
                instanceRole: instanceProfile.attrArn,
                spotIamFleetRole: config_1.config.batch.compute.type === 'SPOT'
                    ? new iam.Role(this, 'SpotFleetRole', {
                        assumedBy: new iam.ServicePrincipal('spotfleet.amazonaws.com'),
                        managedPolicies: [
                            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2SpotFleetTaggingRole'),
                        ],
                    }).roleArn
                    : undefined,
                bidPercentage: config_1.config.batch.compute.spotBidPercentage,
                tags: {
                    Name: 'jmeter-batch-worker',
                    Project: 'jmeter-batch-framework',
                },
            },
        });
        // ═══════════════════════════════════════════════════════════════════════
        // AWS BATCH - JOB QUEUE
        // ═══════════════════════════════════════════════════════════════════════
        const jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
            jobQueueName: 'jmeter-batch-queue',
            priority: 1,
            computeEnvironmentOrder: [{
                    order: 1,
                    computeEnvironment: computeEnvironment.ref,
                }],
        });
        // Ensure queue depends on compute environment
        jobQueue.addDependency(computeEnvironment);
        // ═══════════════════════════════════════════════════════════════════════
        // AWS BATCH - JOB DEFINITION
        // ═══════════════════════════════════════════════════════════════════════
        // CloudWatch Log Group for JMeter jobs
        const jmeterLogGroup = new logs.LogGroup(this, 'JMeterLogGroup', {
            logGroupName: '/aws/batch/jmeter',
            retention: config_1.config.logs.retentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
            jobDefinitionName: 'jmeter-batch-job',
            type: 'container',
            platformCapabilities: ['EC2'], // Not Fargate (too expensive)
            retryStrategy: {
                attempts: config_1.config.batch.job.retryAttempts,
                evaluateOnExit: [
                    {
                        action: 'RETRY',
                        onStatusReason: 'Host EC2*', // Retry on spot interruption
                    },
                    {
                        action: 'EXIT',
                        onReason: '*', // Don't retry other failures (likely test errors)
                    },
                ],
            },
            timeout: {
                attemptDurationSeconds: config_1.config.batch.job.timeoutMinutes * 60,
            },
            containerProperties: {
                image: `${repository.repositoryUri}:latest`,
                vcpus: config_1.config.batch.job.vcpus,
                memory: config_1.config.batch.job.memoryMiB,
                jobRoleArn: batchJobRole.roleArn,
                executionRoleArn: batchExecutionRole.roleArn,
                logConfiguration: {
                    logDriver: 'awslogs',
                    options: {
                        'awslogs-group': jmeterLogGroup.logGroupName,
                        'awslogs-region': this.region,
                        'awslogs-stream-prefix': 'jmeter',
                    },
                },
                environment: [
                    { name: 'CONFIG_BUCKET', value: config_1.config.configBucket },
                    { name: 'RESULTS_BUCKET', value: config_1.config.resultsBucket },
                    { name: 'AWS_REGION', value: this.region },
                ],
                // Command will be overridden by Lambda when submitting jobs
                command: ['echo', 'JMeter container - command will be set by Lambda'],
            },
        });
        // ═══════════════════════════════════════════════════════════════════════
        // LAMBDA FUNCTIONS
        // ═══════════════════════════════════════════════════════════════════════
        // 1. Read Config - reads test configuration from S3
        const readConfigFn = new lambda.Function(this, 'ReadConfigFn', {
            functionName: 'jmeter-batch-read-config',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'read-config')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.readConfig),
            environment: {
                CONFIG_BUCKET: config_1.config.configBucket,
            },
        });
        // 2. Partition Data - splits CSV files for parallel processing
        const partitionDataFn = new lambda.Function(this, 'PartitionDataFn', {
            functionName: 'jmeter-batch-partition-data',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'partition-data')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.partitionData),
            environment: {
                CONFIG_BUCKET: config_1.config.configBucket,
            },
        });
        // 3. Submit Jobs - submits Batch jobs
        const submitJobsFn = new lambda.Function(this, 'SubmitJobsFn', {
            functionName: 'jmeter-batch-submit-jobs',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'submit-jobs')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.submitJobs),
            environment: {
                JOB_QUEUE: jobQueue.ref,
                JOB_DEFINITION: jobDefinition.ref,
                CONFIG_BUCKET: config_1.config.configBucket,
                RESULTS_BUCKET: config_1.config.resultsBucket,
            },
        });
        // 4. Check Jobs - checks Batch job status
        const checkJobsFn = new lambda.Function(this, 'CheckJobsFn', {
            functionName: 'jmeter-batch-check-jobs',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'check-jobs')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.checkJobs),
        });
        // 5. Merge Results - aggregates results from all jobs
        const mergeResultsFn = new lambda.Function(this, 'MergeResultsFn', {
            functionName: 'jmeter-batch-merge-results',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'merge-results')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.mergeResults),
            environment: {
                RESULTS_BUCKET: config_1.config.resultsBucket,
            },
        });
        // 6. JMX Parser - automatically extracts test configuration from JMX files
        const jmxParser = new jmx_parser_lambda_1.JmxParserLambda(this, 'JmxParser', {
            configBucket: configBucket,
        });
        // ═══════════════════════════════════════════════════════════════════════
        // STEP FUNCTIONS WORKFLOW
        // ═══════════════════════════════════════════════════════════════════════
        // Task: Read Config
        const readConfigTask = new tasks.LambdaInvoke(this, 'ReadConfig', {
            lambdaFunction: readConfigFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.configResult',
        });
        // Task: Filter executable tests
        const filterTestsTask = new sfn.Pass(this, 'FilterExecutableTests', {
            parameters: {
                'tests.$': '$.configResult.Payload.testSuite[?(@.execute==true)]',
                'runId.$': '$$.Execution.Name',
            },
        });
        // Task: Parse JMX files to extract configuration
        const parseJmxTask = new sfn.Map(this, 'ParseJMX', {
            itemsPath: '$.tests',
            resultPath: '$.testsWithConfig',
            maxConcurrency: 5,
        }).iterator(new tasks.LambdaInvoke(this, 'ParseJMXFile', {
            lambdaFunction: jmxParser.function,
            payload: sfn.TaskInput.fromObject({
                'testScript.$': '$.testScript',
                'testId.$': '$.testId',
                'execute.$': '$.execute',
                'configBucket': config_1.config.configBucket,
            }),
            resultSelector: {
                'Payload.$': '$.Payload',
            },
        }).addCatch(new sfn.Fail(this, 'ParseJMXFailed', {
            cause: 'Failed to parse JMX file',
            error: 'JMXParseError',
        }), {
            resultPath: '$.error',
        }));
        // Transform parsed results back to tests array
        const transformParsedTests = new sfn.Pass(this, 'TransformParsedTests', {
            parameters: {
                'tests.$': '$.testsWithConfig[*].Payload',
                'runId.$': '$.runId',
            },
        });
        // Task: Partition Data (optional - only if dataFiles exist)
        const partitionDataTask = new tasks.LambdaInvoke(this, 'PartitionData', {
            lambdaFunction: partitionDataFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.partitionResult',
        });
        // Task: Submit Jobs
        const submitJobsTask = new tasks.LambdaInvoke(this, 'SubmitJobs', {
            lambdaFunction: submitJobsFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.jobsResult',
        });
        // Wait for jobs to be registered AND for EC2 instances to start
        // EC2 cold start can take 3-5 minutes (instance launch + ECS agent + Docker pull)
        const waitForJobsToRegister = new sfn.Wait(this, 'WaitForJobsToRegister', {
            time: sfn.WaitTime.duration(cdk.Duration.minutes(3)),
        });
        // Task: Check Jobs
        const checkJobsTask = new tasks.LambdaInvoke(this, 'CheckJobs', {
            lambdaFunction: checkJobsFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.checkResult',
        });
        // Wait between job status checks
        const waitTask = new sfn.Wait(this, 'Wait', {
            time: sfn.WaitTime.duration(cdk.Duration.seconds(config_1.config.stepFunctions.waitBetweenChecks)),
        });
        // Task: Merge Results
        const mergeResultsTask = new tasks.LambdaInvoke(this, 'MergeResults', {
            lambdaFunction: mergeResultsFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.mergeResult',
        });
        // Success state
        const successState = new sfn.Succeed(this, 'Success');
        // Choice: Check if jobs are done
        const jobsDoneChoice = new sfn.Choice(this, 'JobsDone?')
            .when(sfn.Condition.booleanEquals('$.checkResult.Payload.allJobsComplete', true), mergeResultsTask)
            .when(sfn.Condition.booleanEquals('$.checkResult.Payload.anyJobsFailed', true), new sfn.Fail(this, 'JobsFailed', {
            cause: 'One or more Batch jobs failed',
            error: 'BatchJobsFailure',
        }))
            .otherwise(waitTask);
        // Connect states
        waitTask.next(checkJobsTask);
        checkJobsTask.next(jobsDoneChoice);
        mergeResultsTask.next(successState);
        // Define workflow - now includes JMX parsing step and wait after submit
        // (checkJobsTask already connected to jobsDoneChoice above)
        const definition = readConfigTask
            .next(filterTestsTask)
            .next(parseJmxTask)
            .next(transformParsedTests)
            .next(partitionDataTask)
            .next(submitJobsTask)
            .next(waitForJobsToRegister) // Wait 5 seconds for jobs to register
            .next(checkJobsTask);
        // Create State Machine
        const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
            stateMachineName: 'jmeter-batch-workflow',
            definitionBody: sfn.DefinitionBody.fromChainable(definition),
            timeout: cdk.Duration.minutes(config_1.config.stepFunctions.timeoutMinutes),
            tracingEnabled: true, // Enable X-Ray tracing
        });
        // ═══════════════════════════════════════════════════════════════════════
        // OUTPUTS
        // ═══════════════════════════════════════════════════════════════════════
        new cdk.CfnOutput(this, 'ConfigBucketName', {
            value: configBucket.bucketName,
            description: 'S3 bucket for test scripts and data',
            exportName: 'JMeterBatch-ConfigBucket',
        });
        new cdk.CfnOutput(this, 'ResultsBucketName', {
            value: resultsBucket.bucketName,
            description: 'S3 bucket for test results',
            exportName: 'JMeterBatch-ResultsBucket',
        });
        new cdk.CfnOutput(this, 'RepositoryUri', {
            value: repository.repositoryUri,
            description: 'ECR repository URI for JMeter Docker image',
            exportName: 'JMeterBatch-RepositoryUri',
        });
        new cdk.CfnOutput(this, 'StateMachineArn', {
            value: stateMachine.stateMachineArn,
            description: 'Step Functions state machine ARN (use in GitHub Actions)',
            exportName: 'JMeterBatch-StateMachineArn',
        });
        new cdk.CfnOutput(this, 'JobQueueName', {
            value: jobQueue.ref,
            description: 'AWS Batch job queue name',
            exportName: 'JMeterBatch-JobQueue',
        });
        new cdk.CfnOutput(this, 'JobDefinitionArn', {
            value: jobDefinition.ref,
            description: 'AWS Batch job definition',
            exportName: 'JMeterBatch-JobDefinition',
        });
    }
}
exports.JMeterBatchStack = JMeterBatchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam1ldGVyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiam1ldGVyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyw2REFBK0M7QUFDL0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsdURBQXlDO0FBQ3pDLDJEQUE2QztBQUM3QywrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELDJFQUE2RDtBQUU3RCxtREFBZ0Q7QUFDaEQsMkNBQTZCO0FBQzdCLHNFQUFpRTtBQUVqRTs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBYSxnQkFBaUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM3QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDBFQUEwRTtRQUMxRSxhQUFhO1FBQ2IsMEVBQTBFO1FBRTFFLE1BQU0sWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3ZELFVBQVUsRUFBRSxlQUFNLENBQUMsWUFBWTtZQUMvQixTQUFTLEVBQUUsSUFBSTtZQUNmLFVBQVUsRUFBRSxlQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQjtnQkFDMUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO2dCQUNoQyxDQUFDLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFdBQVc7WUFDbkMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFHLDhDQUE4QztZQUN4RixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztTQUNsRCxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENB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QWEsQ0FBQyxVQUFVO1lBQy9CLFdBQVcsRUFBRSw0QkFBNEI7WUFDekMsVUFBVSxFQUFFLDJCQUEyQjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsVUFBVSxDQUFDLGFBQWE7WUFDL0IsV0FBVyxFQUFFLDRDQUE0QztZQUN6RCxVQUFVLEVBQUUsMkJBQTJCO1NBQ3hDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLFlBQVksQ0FBQyxlQUFlO1lBQ25DLFdBQVcsRUFBRSwwREFBMEQ7WUFDdkUsVUFBVSxFQUFFLDZCQUE2QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsUUFBUSxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsc0JBQXNCO1NBQ25DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxHQUFHO1lBQ3hCLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLDJCQUEyQjtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4aEJELDRDQXdoQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBiYXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYmF0Y2gnO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xyXG5pbXBvcnQgKiBhcyB0YXNrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgeyBjb25maWcgfSBmcm9tICcuLi9lbnZpcm9ubWVudHMvY29uZmlnJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgSm14UGFyc2VyTGFtYmRhIH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2pteC1wYXJzZXItbGFtYmRhJztcclxuXHJcbi8qKlxyXG4gKiBKTWV0ZXIgQmF0Y2ggRnJhbWV3b3JrIFN0YWNrXHJcbiAqIFxyXG4gKiBNb2Rlcm4sIGNvc3Qtb3B0aW1pemVkIEpNZXRlciB0ZXN0aW5nIHVzaW5nIEFXUyBCYXRjaCArIFNwb3QgaW5zdGFuY2VzLlxyXG4gKiBcclxuICogS2V5IEZlYXR1cmVzOlxyXG4gKiAtIEFXUyBCYXRjaCB3aXRoIFNwb3QgaW5zdGFuY2VzICg3MCUgY29zdCBzYXZpbmdzKVxyXG4gKiAtIE5vIG1hc3Rlci1taW5pb24gYXJjaGl0ZWN0dXJlIChpbmRlcGVuZGVudCBleGVjdXRpb24pXHJcbiAqIC0gUzMtYmFzZWQgZHluYW1pYyBsb2FkaW5nIChzbWFsbCBpbWFnZXMsIGZhc3QgZGVwbG95bWVudHMpXHJcbiAqIC0gTGFtYmRhIG9yY2hlc3RyYXRpb24gKHNlcnZlcmxlc3MsIHBheS1wZXItdXNlKVxyXG4gKiAtIFN0ZXAgRnVuY3Rpb25zIHdvcmtmbG93IChyZWxpYWJsZSwgb2JzZXJ2YWJsZSlcclxuICogLSBDb21wcmVoZW5zaXZlIGVycm9yIGhhbmRsaW5nXHJcbiAqIC0gU2VjdXJpdHkgYmVzdCBwcmFjdGljZXNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBKTWV0ZXJCYXRjaFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIFMzIEJVQ0tFVFNcclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIGNvbnN0IGNvbmZpZ0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0NvbmZpZ0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogY29uZmlnLmNvbmZpZ0J1Y2tldCxcclxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxyXG4gICAgICBlbmNyeXB0aW9uOiBjb25maWcuc2VjdXJpdHkuZW5hYmxlRW5jcnlwdGlvbiBcclxuICAgICAgICA/IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCBcclxuICAgICAgICA6IHMzLkJ1Y2tldEVuY3J5cHRpb24uVU5FTkNSWVBURUQsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiwgIC8vIERvbid0IGRlbGV0ZSB0ZXN0IHNjcmlwdHMgb24gc3RhY2sgZGVsZXRpb25cclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlc3VsdHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdSZXN1bHRzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBjb25maWcucmVzdWx0c0J1Y2tldCxcclxuICAgICAgZW5jcnlwdGlvbjogY29uZmlnLnNlY3VyaXR5LmVuYWJsZUVuY3J5cHRpb24gXHJcbiAgICAgICAgPyBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQgXHJcbiAgICAgICAgOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlVORU5DUllQVEVELFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sICAvLyBEb24ndCBkZWxldGUgcmVzdWx0cyBvbiBzdGFjayBkZWxldGlvblxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBsaWZlY3ljbGVSdWxlczogW3tcclxuICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksICAvLyBBdXRvLWRlbGV0ZSBhZnRlciA5MCBkYXlzXHJcbiAgICAgICAgdHJhbnNpdGlvbnM6IFt7XHJcbiAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcclxuICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLCAgLy8gTW92ZSB0byBJQSBhZnRlciAzMCBkYXlzXHJcbiAgICAgICAgfV0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBFQ1IgUkVQT1NJVE9SWVxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgY29uc3QgcmVwb3NpdG9yeSA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnSk1ldGVyUmVwb3NpdG9yeScsIHtcclxuICAgICAgcmVwb3NpdG9yeU5hbWU6IGNvbmZpZy5lY3JSZXBvTmFtZSxcclxuICAgICAgaW1hZ2VTY2FuT25QdXNoOiB0cnVlLCAgLy8gU2VjdXJpdHk6IFNjYW4gaW1hZ2VzIGZvciB2dWxuZXJhYmlsaXRpZXNcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLCAgLy8gS2VlcCBpbWFnZXMgb24gc3RhY2sgZGVsZXRpb25cclxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFt7XHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdLZWVwIG9ubHkgbGFzdCAxMCBpbWFnZXMnLFxyXG4gICAgICAgIG1heEltYWdlQ291bnQ6IDEwLFxyXG4gICAgICB9XSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG4gICAgLy8gVlBDIChVc2UgRGVmYXVsdCBWUEMpXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICBjb25zdCB2cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0RlZmF1bHRWcGMnLCB7IFxyXG4gICAgICBpc0RlZmF1bHQ6IHRydWUgXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgQmF0Y2ggY29tcHV0ZSBlbnZpcm9ubWVudFxyXG4gICAgY29uc3QgYmF0Y2hTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdCYXRjaFNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgSk1ldGVyIEJhdGNoIGNvbXB1dGUgZW52aXJvbm1lbnQnLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLCAgLy8gQWxsb3cgaW50ZXJuZXQgYWNjZXNzIGZvciBkb3dubG9hZGluZyBmcm9tIFMzXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIElBTSBST0xFU1xyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgLy8gQmF0Y2ggU2VydmljZSBSb2xlIC0gYWxsb3dzIEJhdGNoIHRvIG1hbmFnZSBFQzIgaW5zdGFuY2VzXHJcbiAgICBjb25zdCBiYXRjaFNlcnZpY2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCYXRjaFNlcnZpY2VSb2xlJywge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmF0Y2guYW1hem9uYXdzLmNvbScpLFxyXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NCYXRjaFNlcnZpY2VSb2xlJyksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBFQzIgSW5zdGFuY2UgUm9sZSAtIGFzc3VtZWQgYnkgRUMyIGluc3RhbmNlcyBpbiBjb21wdXRlIGVudmlyb25tZW50XHJcbiAgICBjb25zdCBlYzJJbnN0YW5jZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0VjMkluc3RhbmNlUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FtYXpvbkVDMkNvbnRhaW5lclNlcnZpY2Vmb3JFQzJSb2xlJyksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCYXRjaCBKb2IgUm9sZSAtIGFzc3VtZWQgYnkgY29udGFpbmVycyBydW5uaW5nIEpNZXRlclxyXG4gICAgY29uc3QgYmF0Y2hKb2JSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCYXRjaEpvYlJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlY3MtdGFza3MuYW1hem9uYXdzLmNvbScpLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvbGUgZm9yIEpNZXRlciBjb250YWluZXJzIHRvIGFjY2VzcyBTMycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBTMyBwZXJtaXNzaW9ucyB0byBqb2Igcm9sZVxyXG4gICAgYmF0Y2hKb2JSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnUzNSZWFkQ29uZmlnJyxcclxuICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnLCAnczM6TGlzdEJ1Y2tldCddLFxyXG4gICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICBjb25maWdCdWNrZXQuYnVja2V0QXJuLFxyXG4gICAgICAgIGAke2NvbmZpZ0J1Y2tldC5idWNrZXRBcm59LypgLFxyXG4gICAgICBdLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIGJhdGNoSm9iUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIHNpZDogJ1MzV3JpdGVSZXN1bHRzJyxcclxuICAgICAgYWN0aW9uczogWydzMzpQdXRPYmplY3QnXSxcclxuICAgICAgcmVzb3VyY2VzOiBbYCR7cmVzdWx0c0J1Y2tldC5idWNrZXRBcm59LypgXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBCYXRjaCBFeGVjdXRpb24gUm9sZSAtIHB1bGxzIEVDUiBpbWFnZXMsIHdyaXRlcyBDbG91ZFdhdGNoIGxvZ3NcclxuICAgIGNvbnN0IGJhdGNoRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmF0Y2hFeGVjdXRpb25Sb2xlJywge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKSxcclxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXHJcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knKSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBFeGVjdXRpb24gUm9sZVxyXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgTGFtYmRhIHBlcm1pc3Npb25zXHJcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnUzNBY2Nlc3MnLFxyXG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCcsICdzMzpQdXRPYmplY3QnLCAnczM6TGlzdEJ1Y2tldCddLFxyXG4gICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICBjb25maWdCdWNrZXQuYnVja2V0QXJuLFxyXG4gICAgICAgIGAke2NvbmZpZ0J1Y2tldC5idWNrZXRBcm59LypgLFxyXG4gICAgICAgIHJlc3VsdHNCdWNrZXQuYnVja2V0QXJuLFxyXG4gICAgICAgIGAke3Jlc3VsdHNCdWNrZXQuYnVja2V0QXJufS8qYCxcclxuICAgICAgXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnQmF0Y2hTdWJtaXRKb2InLFxyXG4gICAgICBhY3Rpb25zOiBbJ2JhdGNoOlN1Ym1pdEpvYicsICdiYXRjaDpUYWdSZXNvdXJjZSddLFxyXG4gICAgICByZXNvdXJjZXM6IFsnKiddLCAgLy8gV2lsbCBiZSBzY29wZWQgdG8gam9iIGRlZmluaXRpb24gYWZ0ZXIgY3JlYXRpb25cclxuICAgIH0pKTtcclxuXHJcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnQmF0Y2hEZXNjcmliZUpvYnMnLFxyXG4gICAgICBhY3Rpb25zOiBbJ2JhdGNoOkRlc2NyaWJlSm9icycsICdiYXRjaDpMaXN0Sm9icycsICdiYXRjaDpUZXJtaW5hdGVKb2InXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIEFXUyBCQVRDSCAtIENPTVBVVEUgRU5WSVJPTk1FTlRcclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIC8vIEluc3RhbmNlIHByb2ZpbGUgcmVxdWlyZWQgZm9yIEVDMiBpbnN0YW5jZXNcclxuICAgIGNvbnN0IGluc3RhbmNlUHJvZmlsZSA9IG5ldyBpYW0uQ2ZuSW5zdGFuY2VQcm9maWxlKHRoaXMsICdJbnN0YW5jZVByb2ZpbGUnLCB7XHJcbiAgICAgIHJvbGVzOiBbZWMySW5zdGFuY2VSb2xlLnJvbGVOYW1lXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhdW5jaCB0ZW1wbGF0ZSBmb3IgRUMyIGluc3RhbmNlc1xyXG4gICAgY29uc3QgbGF1bmNoVGVtcGxhdGUgPSBuZXcgZWMyLkNmbkxhdW5jaFRlbXBsYXRlKHRoaXMsICdMYXVuY2hUZW1wbGF0ZScsIHtcclxuICAgICAgbGF1bmNoVGVtcGxhdGVEYXRhOiB7XHJcbiAgICAgICAgaW5zdGFuY2VUeXBlOiBjb25maWcuYmF0Y2guY29tcHV0ZS5pbnN0YW5jZVR5cGVzWzBdLFxyXG4gICAgICAgIC8vIFVzZSBBbWF6b24gRUNTLW9wdGltaXplZCBBTUkgKGF1dG9tYXRpY2FsbHkgcmVzb2x2ZWQgYnkgQmF0Y2gpXHJcbiAgICAgICAgaW1hZ2VJZDogZWMyLk1hY2hpbmVJbWFnZS5sYXRlc3RBbWF6b25MaW51eDIoe1xyXG4gICAgICAgICAgY3B1VHlwZTogZWMyLkFtYXpvbkxpbnV4Q3B1VHlwZS5YODZfNjQsXHJcbiAgICAgICAgfSkuZ2V0SW1hZ2UodGhpcykuaW1hZ2VJZCxcclxuICAgICAgICBpYW1JbnN0YW5jZVByb2ZpbGU6IHtcclxuICAgICAgICAgIGFybjogaW5zdGFuY2VQcm9maWxlLmF0dHJBcm4sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZWN1cml0eUdyb3VwSWRzOiBbYmF0Y2hTZWN1cml0eUdyb3VwLnNlY3VyaXR5R3JvdXBJZF0sXHJcbiAgICAgICAgdXNlckRhdGE6IGNkay5Gbi5iYXNlNjQoKCgpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHVzZXJEYXRhID0gZWMyLlVzZXJEYXRhLmZvckxpbnV4KCk7XHJcbiAgICAgICAgICB1c2VyRGF0YS5hZGRDb21tYW5kcyhcclxuICAgICAgICAgICAgJyMhL2Jpbi9iYXNoJyxcclxuICAgICAgICAgICAgJ2VjaG8gRUNTX0NMVVNURVI9JHtFQ1NfQ0xVU1RFUn0gPj4gL2V0Yy9lY3MvZWNzLmNvbmZpZycsXHJcbiAgICAgICAgICAgICdlY2hvIEVDU19FTkFCTEVfU1BPVF9JTlNUQU5DRV9EUkFJTklORz10cnVlID4+IC9ldGMvZWNzL2Vjcy5jb25maWcnLFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHJldHVybiB1c2VyRGF0YS5yZW5kZXIoKTtcclxuICAgICAgICB9KSgpKSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbXB1dGUgZW52aXJvbm1lbnQgdXNpbmcgT24tRGVtYW5kIGluc3RhbmNlcyAoY2hhbmdlZCBmcm9tIFNwb3QgZm9yIHJlbGlhYmlsaXR5KVxyXG4gICAgY29uc3QgY29tcHV0ZUVudmlyb25tZW50ID0gbmV3IGJhdGNoLkNmbkNvbXB1dGVFbnZpcm9ubWVudCh0aGlzLCAnQ29tcHV0ZUVudmlyb25tZW50Jywge1xyXG4gICAgICB0eXBlOiAnTUFOQUdFRCcsXHJcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudE5hbWU6ICdqbWV0ZXItYmF0Y2gtb25kZW1hbmQnLCAgLy8gUmVuYW1lZCBmcm9tICdqbWV0ZXItYmF0Y2gtc3BvdCcgdG8gYWxsb3cgcmVwbGFjZW1lbnRcclxuICAgICAgc2VydmljZVJvbGU6IGJhdGNoU2VydmljZVJvbGUucm9sZUFybixcclxuICAgICAgY29tcHV0ZVJlc291cmNlczoge1xyXG4gICAgICAgIHR5cGU6ICdFQzInLCAgLy8gQ2hhbmdlZCBmcm9tIFNQT1QgdG8gT05fREVNQU5EIGZvciByZWxpYWJpbGl0eVxyXG4gICAgICAgIG1pbnZDcHVzOiAyLCAgLy8gS2VlcCAxIGluc3RhbmNlIHdhcm0gdG8gYXZvaWQgY29sZCBzdGFydCBkZWxheXNcclxuICAgICAgICBtYXh2Q3B1czogY29uZmlnLmJhdGNoLmNvbXB1dGUubWF4dkNwdXMsXHJcbiAgICAgICAgZGVzaXJlZHZDcHVzOiAyLCAgLy8gU3RhcnQgd2l0aCAxIGluc3RhbmNlIHJlYWR5XHJcbiAgICAgICAgaW5zdGFuY2VUeXBlczogY29uZmlnLmJhdGNoLmNvbXB1dGUuaW5zdGFuY2VUeXBlcyxcclxuICAgICAgICBzdWJuZXRzOiB2cGMucHVibGljU3VibmV0cy5tYXAoc3VibmV0ID0+IHN1Ym5ldC5zdWJuZXRJZCksXHJcbiAgICAgICAgc2VjdXJpdHlHcm91cElkczogW2JhdGNoU2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWRdLFxyXG4gICAgICAgIGluc3RhbmNlUm9sZTogaW5zdGFuY2VQcm9maWxlLmF0dHJBcm4sXHJcbiAgICAgICAgc3BvdElhbUZsZWV0Um9sZTogY29uZmlnLmJhdGNoLmNvbXB1dGUudHlwZSA9PT0gJ1NQT1QnIFxyXG4gICAgICAgICAgPyBuZXcgaWFtLlJvbGUodGhpcywgJ1Nwb3RGbGVldFJvbGUnLCB7XHJcbiAgICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3Nwb3RmbGVldC5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgICAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXHJcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BbWF6b25FQzJTcG90RmxlZXRUYWdnaW5nUm9sZScpLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIH0pLnJvbGVBcm5cclxuICAgICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgICAgIGJpZFBlcmNlbnRhZ2U6IGNvbmZpZy5iYXRjaC5jb21wdXRlLnNwb3RCaWRQZXJjZW50YWdlLFxyXG4gICAgICAgIHRhZ3M6IHtcclxuICAgICAgICAgIE5hbWU6ICdqbWV0ZXItYmF0Y2gtd29ya2VyJyxcclxuICAgICAgICAgIFByb2plY3Q6ICdqbWV0ZXItYmF0Y2gtZnJhbWV3b3JrJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBBV1MgQkFUQ0ggLSBKT0IgUVVFVUVcclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIGNvbnN0IGpvYlF1ZXVlID0gbmV3IGJhdGNoLkNmbkpvYlF1ZXVlKHRoaXMsICdKb2JRdWV1ZScsIHtcclxuICAgICAgam9iUXVldWVOYW1lOiAnam1ldGVyLWJhdGNoLXF1ZXVlJyxcclxuICAgICAgcHJpb3JpdHk6IDEsXHJcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudE9yZGVyOiBbe1xyXG4gICAgICAgIG9yZGVyOiAxLFxyXG4gICAgICAgIGNvbXB1dGVFbnZpcm9ubWVudDogY29tcHV0ZUVudmlyb25tZW50LnJlZixcclxuICAgICAgfV0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBFbnN1cmUgcXVldWUgZGVwZW5kcyBvbiBjb21wdXRlIGVudmlyb25tZW50XHJcbiAgICBqb2JRdWV1ZS5hZGREZXBlbmRlbmN5KGNvbXB1dGVFbnZpcm9ubWVudCk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBBV1MgQkFUQ0ggLSBKT0IgREVGSU5JVElPTlxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIEpNZXRlciBqb2JzXHJcbiAgICBjb25zdCBqbWV0ZXJMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdKTWV0ZXJMb2dHcm91cCcsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiAnL2F3cy9iYXRjaC9qbWV0ZXInLFxyXG4gICAgICByZXRlbnRpb246IGNvbmZpZy5sb2dzLnJldGVudGlvbkRheXMsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBqb2JEZWZpbml0aW9uID0gbmV3IGJhdGNoLkNmbkpvYkRlZmluaXRpb24odGhpcywgJ0pvYkRlZmluaXRpb24nLCB7XHJcbiAgICAgIGpvYkRlZmluaXRpb25OYW1lOiAnam1ldGVyLWJhdGNoLWpvYicsXHJcbiAgICAgIHR5cGU6ICdjb250YWluZXInLFxyXG4gICAgICBwbGF0Zm9ybUNhcGFiaWxpdGllczogWydFQzInXSwgIC8vIE5vdCBGYXJnYXRlICh0b28gZXhwZW5zaXZlKVxyXG4gICAgICByZXRyeVN0cmF0ZWd5OiB7XHJcbiAgICAgICAgYXR0ZW1wdHM6IGNvbmZpZy5iYXRjaC5qb2IucmV0cnlBdHRlbXB0cyxcclxuICAgICAgICBldmFsdWF0ZU9uRXhpdDogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBhY3Rpb246ICdSRVRSWScsXHJcbiAgICAgICAgICAgIG9uU3RhdHVzUmVhc29uOiAnSG9zdCBFQzIqJywgIC8vIFJldHJ5IG9uIHNwb3QgaW50ZXJydXB0aW9uXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBhY3Rpb246ICdFWElUJyxcclxuICAgICAgICAgICAgb25SZWFzb246ICcqJywgIC8vIERvbid0IHJldHJ5IG90aGVyIGZhaWx1cmVzIChsaWtlbHkgdGVzdCBlcnJvcnMpXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHRpbWVvdXQ6IHtcclxuICAgICAgICBhdHRlbXB0RHVyYXRpb25TZWNvbmRzOiBjb25maWcuYmF0Y2guam9iLnRpbWVvdXRNaW51dGVzICogNjAsXHJcbiAgICAgIH0sXHJcbiAgICAgIGNvbnRhaW5lclByb3BlcnRpZXM6IHtcclxuICAgICAgICBpbWFnZTogYCR7cmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpfTpsYXRlc3RgLFxyXG4gICAgICAgIHZjcHVzOiBjb25maWcuYmF0Y2guam9iLnZjcHVzLFxyXG4gICAgICAgIG1lbW9yeTogY29uZmlnLmJhdGNoLmpvYi5tZW1vcnlNaUIsXHJcbiAgICAgICAgam9iUm9sZUFybjogYmF0Y2hKb2JSb2xlLnJvbGVBcm4sXHJcbiAgICAgICAgZXhlY3V0aW9uUm9sZUFybjogYmF0Y2hFeGVjdXRpb25Sb2xlLnJvbGVBcm4sXHJcbiAgICAgICAgbG9nQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgbG9nRHJpdmVyOiAnYXdzbG9ncycsXHJcbiAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICdhd3Nsb2dzLWdyb3VwJzogam1ldGVyTG9nR3JvdXAubG9nR3JvdXBOYW1lLFxyXG4gICAgICAgICAgICAnYXdzbG9ncy1yZWdpb24nOiB0aGlzLnJlZ2lvbixcclxuICAgICAgICAgICAgJ2F3c2xvZ3Mtc3RyZWFtLXByZWZpeCc6ICdqbWV0ZXInLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudmlyb25tZW50OiBbXHJcbiAgICAgICAgICB7IG5hbWU6ICdDT05GSUdfQlVDS0VUJywgdmFsdWU6IGNvbmZpZy5jb25maWdCdWNrZXQgfSxcclxuICAgICAgICAgIHsgbmFtZTogJ1JFU1VMVFNfQlVDS0VUJywgdmFsdWU6IGNvbmZpZy5yZXN1bHRzQnVja2V0IH0sXHJcbiAgICAgICAgICB7IG5hbWU6ICdBV1NfUkVHSU9OJywgdmFsdWU6IHRoaXMucmVnaW9uIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBDb21tYW5kIHdpbGwgYmUgb3ZlcnJpZGRlbiBieSBMYW1iZGEgd2hlbiBzdWJtaXR0aW5nIGpvYnNcclxuICAgICAgICBjb21tYW5kOiBbJ2VjaG8nLCAnSk1ldGVyIGNvbnRhaW5lciAtIGNvbW1hbmQgd2lsbCBiZSBzZXQgYnkgTGFtYmRhJ10sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIExBTUJEQSBGVU5DVElPTlNcclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIC8vIDEuIFJlYWQgQ29uZmlnIC0gcmVhZHMgdGVzdCBjb25maWd1cmF0aW9uIGZyb20gUzNcclxuICAgIGNvbnN0IHJlYWRDb25maWdGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JlYWRDb25maWdGbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnam1ldGVyLWJhdGNoLXJlYWQtY29uZmlnJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ3JlYWQtY29uZmlnJykpLFxyXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxyXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeU1CLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXRTZWNvbmRzLnJlYWRDb25maWcpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTkZJR19CVUNLRVQ6IGNvbmZpZy5jb25maWdCdWNrZXQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyLiBQYXJ0aXRpb24gRGF0YSAtIHNwbGl0cyBDU1YgZmlsZXMgZm9yIHBhcmFsbGVsIHByb2Nlc3NpbmdcclxuICAgIGNvbnN0IHBhcnRpdGlvbkRhdGFGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1BhcnRpdGlvbkRhdGFGbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnam1ldGVyLWJhdGNoLXBhcnRpdGlvbi1kYXRhJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ3BhcnRpdGlvbi1kYXRhJykpLFxyXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxyXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeU1CLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXRTZWNvbmRzLnBhcnRpdGlvbkRhdGEpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTkZJR19CVUNLRVQ6IGNvbmZpZy5jb25maWdCdWNrZXQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAzLiBTdWJtaXQgSm9icyAtIHN1Ym1pdHMgQmF0Y2ggam9ic1xyXG4gICAgY29uc3Qgc3VibWl0Sm9ic0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3VibWl0Sm9ic0ZuJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItYmF0Y2gtc3VibWl0LWpvYnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcclxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmxhbWJkYV9oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdsYW1iZGEnLCAnc3VibWl0LWpvYnMnKSksXHJcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXHJcbiAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5sYW1iZGEubWVtb3J5TUIsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dFNlY29uZHMuc3VibWl0Sm9icyksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgSk9CX1FVRVVFOiBqb2JRdWV1ZS5yZWYsXHJcbiAgICAgICAgSk9CX0RFRklOSVRJT046IGpvYkRlZmluaXRpb24ucmVmLFxyXG4gICAgICAgIENPTkZJR19CVUNLRVQ6IGNvbmZpZy5jb25maWdCdWNrZXQsXHJcbiAgICAgICAgUkVTVUxUU19CVUNLRVQ6IGNvbmZpZy5yZXN1bHRzQnVja2V0LFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNC4gQ2hlY2sgSm9icyAtIGNoZWNrcyBCYXRjaCBqb2Igc3RhdHVzXHJcbiAgICBjb25zdCBjaGVja0pvYnNGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrSm9ic0ZuJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItYmF0Y2gtY2hlY2stam9icycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxyXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXgubGFtYmRhX2hhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJ2xhbWJkYScsICdjaGVjay1qb2JzJykpLFxyXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxyXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeU1CLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXRTZWNvbmRzLmNoZWNrSm9icyksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA1LiBNZXJnZSBSZXN1bHRzIC0gYWdncmVnYXRlcyByZXN1bHRzIGZyb20gYWxsIGpvYnNcclxuICAgIGNvbnN0IG1lcmdlUmVzdWx0c0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWVyZ2VSZXN1bHRzRm4nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2ptZXRlci1iYXRjaC1tZXJnZS1yZXN1bHRzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ21lcmdlLXJlc3VsdHMnKSksXHJcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXHJcbiAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5sYW1iZGEubWVtb3J5TUIsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dFNlY29uZHMubWVyZ2VSZXN1bHRzKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBSRVNVTFRTX0JVQ0tFVDogY29uZmlnLnJlc3VsdHNCdWNrZXQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA2LiBKTVggUGFyc2VyIC0gYXV0b21hdGljYWxseSBleHRyYWN0cyB0ZXN0IGNvbmZpZ3VyYXRpb24gZnJvbSBKTVggZmlsZXNcclxuICAgIGNvbnN0IGpteFBhcnNlciA9IG5ldyBKbXhQYXJzZXJMYW1iZGEodGhpcywgJ0pteFBhcnNlcicsIHtcclxuICAgICAgY29uZmlnQnVja2V0OiBjb25maWdCdWNrZXQsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIFNURVAgRlVOQ1RJT05TIFdPUktGTE9XXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICAvLyBUYXNrOiBSZWFkIENvbmZpZ1xyXG4gICAgY29uc3QgcmVhZENvbmZpZ1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdSZWFkQ29uZmlnJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogcmVhZENvbmZpZ0ZuLFxyXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21Kc29uUGF0aEF0KCckJyksXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLmNvbmZpZ1Jlc3VsdCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBGaWx0ZXIgZXhlY3V0YWJsZSB0ZXN0c1xyXG4gICAgY29uc3QgZmlsdGVyVGVzdHNUYXNrID0gbmV3IHNmbi5QYXNzKHRoaXMsICdGaWx0ZXJFeGVjdXRhYmxlVGVzdHMnLCB7XHJcbiAgICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgICAndGVzdHMuJCc6ICckLmNvbmZpZ1Jlc3VsdC5QYXlsb2FkLnRlc3RTdWl0ZVs/KEAuZXhlY3V0ZT09dHJ1ZSldJyxcclxuICAgICAgICAncnVuSWQuJCc6ICckJC5FeGVjdXRpb24uTmFtZScsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBQYXJzZSBKTVggZmlsZXMgdG8gZXh0cmFjdCBjb25maWd1cmF0aW9uXHJcbiAgICBjb25zdCBwYXJzZUpteFRhc2sgPSBuZXcgc2ZuLk1hcCh0aGlzLCAnUGFyc2VKTVgnLCB7XHJcbiAgICAgIGl0ZW1zUGF0aDogJyQudGVzdHMnLFxyXG4gICAgICByZXN1bHRQYXRoOiAnJC50ZXN0c1dpdGhDb25maWcnLFxyXG4gICAgICBtYXhDb25jdXJyZW5jeTogNSxcclxuICAgIH0pLml0ZXJhdG9yKFxyXG4gICAgICBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdQYXJzZUpNWEZpbGUnLCB7XHJcbiAgICAgICAgbGFtYmRhRnVuY3Rpb246IGpteFBhcnNlci5mdW5jdGlvbixcclxuICAgICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xyXG4gICAgICAgICAgJ3Rlc3RTY3JpcHQuJCc6ICckLnRlc3RTY3JpcHQnLFxyXG4gICAgICAgICAgJ3Rlc3RJZC4kJzogJyQudGVzdElkJyxcclxuICAgICAgICAgICdleGVjdXRlLiQnOiAnJC5leGVjdXRlJyxcclxuICAgICAgICAgICdjb25maWdCdWNrZXQnOiBjb25maWcuY29uZmlnQnVja2V0LFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHJlc3VsdFNlbGVjdG9yOiB7XHJcbiAgICAgICAgICAnUGF5bG9hZC4kJzogJyQuUGF5bG9hZCcsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSkuYWRkQ2F0Y2gobmV3IHNmbi5GYWlsKHRoaXMsICdQYXJzZUpNWEZhaWxlZCcsIHtcclxuICAgICAgICBjYXVzZTogJ0ZhaWxlZCB0byBwYXJzZSBKTVggZmlsZScsXHJcbiAgICAgICAgZXJyb3I6ICdKTVhQYXJzZUVycm9yJyxcclxuICAgICAgfSksIHtcclxuICAgICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIFRyYW5zZm9ybSBwYXJzZWQgcmVzdWx0cyBiYWNrIHRvIHRlc3RzIGFycmF5XHJcbiAgICBjb25zdCB0cmFuc2Zvcm1QYXJzZWRUZXN0cyA9IG5ldyBzZm4uUGFzcyh0aGlzLCAnVHJhbnNmb3JtUGFyc2VkVGVzdHMnLCB7XHJcbiAgICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgICAndGVzdHMuJCc6ICckLnRlc3RzV2l0aENvbmZpZ1sqXS5QYXlsb2FkJyxcclxuICAgICAgICAncnVuSWQuJCc6ICckLnJ1bklkJyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFRhc2s6IFBhcnRpdGlvbiBEYXRhIChvcHRpb25hbCAtIG9ubHkgaWYgZGF0YUZpbGVzIGV4aXN0KVxyXG4gICAgY29uc3QgcGFydGl0aW9uRGF0YVRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdQYXJ0aXRpb25EYXRhJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogcGFydGl0aW9uRGF0YUZuLFxyXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21Kc29uUGF0aEF0KCckJyksXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLnBhcnRpdGlvblJlc3VsdCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBTdWJtaXQgSm9ic1xyXG4gICAgY29uc3Qgc3VibWl0Sm9ic1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdTdWJtaXRKb2JzJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogc3VibWl0Sm9ic0ZuLFxyXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21Kc29uUGF0aEF0KCckJyksXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLmpvYnNSZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gV2FpdCBmb3Igam9icyB0byBiZSByZWdpc3RlcmVkIEFORCBmb3IgRUMyIGluc3RhbmNlcyB0byBzdGFydFxyXG4gICAgLy8gRUMyIGNvbGQgc3RhcnQgY2FuIHRha2UgMy01IG1pbnV0ZXMgKGluc3RhbmNlIGxhdW5jaCArIEVDUyBhZ2VudCArIERvY2tlciBwdWxsKVxyXG4gICAgY29uc3Qgd2FpdEZvckpvYnNUb1JlZ2lzdGVyID0gbmV3IHNmbi5XYWl0KHRoaXMsICdXYWl0Rm9ySm9ic1RvUmVnaXN0ZXInLCB7XHJcbiAgICAgIHRpbWU6IHNmbi5XYWl0VGltZS5kdXJhdGlvbihjZGsuRHVyYXRpb24ubWludXRlcygzKSksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBDaGVjayBKb2JzXHJcbiAgICBjb25zdCBjaGVja0pvYnNUYXNrID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnQ2hlY2tKb2JzJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogY2hlY2tKb2JzRm4sXHJcbiAgICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbUpzb25QYXRoQXQoJyQnKSxcclxuICAgICAgcmVzdWx0UGF0aDogJyQuY2hlY2tSZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gV2FpdCBiZXR3ZWVuIGpvYiBzdGF0dXMgY2hlY2tzXHJcbiAgICBjb25zdCB3YWl0VGFzayA9IG5ldyBzZm4uV2FpdCh0aGlzLCAnV2FpdCcsIHtcclxuICAgICAgdGltZTogc2ZuLldhaXRUaW1lLmR1cmF0aW9uKGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5zdGVwRnVuY3Rpb25zLndhaXRCZXR3ZWVuQ2hlY2tzKSksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBNZXJnZSBSZXN1bHRzXHJcbiAgICBjb25zdCBtZXJnZVJlc3VsdHNUYXNrID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnTWVyZ2VSZXN1bHRzJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogbWVyZ2VSZXN1bHRzRm4sXHJcbiAgICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbUpzb25QYXRoQXQoJyQnKSxcclxuICAgICAgcmVzdWx0UGF0aDogJyQubWVyZ2VSZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3VjY2VzcyBzdGF0ZVxyXG4gICAgY29uc3Qgc3VjY2Vzc1N0YXRlID0gbmV3IHNmbi5TdWNjZWVkKHRoaXMsICdTdWNjZXNzJyk7XHJcblxyXG4gICAgLy8gQ2hvaWNlOiBDaGVjayBpZiBqb2JzIGFyZSBkb25lXHJcbiAgICBjb25zdCBqb2JzRG9uZUNob2ljZSA9IG5ldyBzZm4uQ2hvaWNlKHRoaXMsICdKb2JzRG9uZT8nKVxyXG4gICAgICAud2hlbihcclxuICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuY2hlY2tSZXN1bHQuUGF5bG9hZC5hbGxKb2JzQ29tcGxldGUnLCB0cnVlKSxcclxuICAgICAgICBtZXJnZVJlc3VsdHNUYXNrXHJcbiAgICAgIClcclxuICAgICAgLndoZW4oXHJcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5ib29sZWFuRXF1YWxzKCckLmNoZWNrUmVzdWx0LlBheWxvYWQuYW55Sm9ic0ZhaWxlZCcsIHRydWUpLFxyXG4gICAgICAgIG5ldyBzZm4uRmFpbCh0aGlzLCAnSm9ic0ZhaWxlZCcsIHtcclxuICAgICAgICAgIGNhdXNlOiAnT25lIG9yIG1vcmUgQmF0Y2ggam9icyBmYWlsZWQnLFxyXG4gICAgICAgICAgZXJyb3I6ICdCYXRjaEpvYnNGYWlsdXJlJyxcclxuICAgICAgICB9KVxyXG4gICAgICApXHJcbiAgICAgIC5vdGhlcndpc2Uod2FpdFRhc2spO1xyXG5cclxuICAgIC8vIENvbm5lY3Qgc3RhdGVzXHJcbiAgICB3YWl0VGFzay5uZXh0KGNoZWNrSm9ic1Rhc2spO1xyXG4gICAgY2hlY2tKb2JzVGFzay5uZXh0KGpvYnNEb25lQ2hvaWNlKTtcclxuICAgIG1lcmdlUmVzdWx0c1Rhc2submV4dChzdWNjZXNzU3RhdGUpO1xyXG5cclxuICAgIC8vIERlZmluZSB3b3JrZmxvdyAtIG5vdyBpbmNsdWRlcyBKTVggcGFyc2luZyBzdGVwIGFuZCB3YWl0IGFmdGVyIHN1Ym1pdFxyXG4gICAgLy8gKGNoZWNrSm9ic1Rhc2sgYWxyZWFkeSBjb25uZWN0ZWQgdG8gam9ic0RvbmVDaG9pY2UgYWJvdmUpXHJcbiAgICBjb25zdCBkZWZpbml0aW9uID0gcmVhZENvbmZpZ1Rhc2tcclxuICAgICAgLm5leHQoZmlsdGVyVGVzdHNUYXNrKVxyXG4gICAgICAubmV4dChwYXJzZUpteFRhc2spXHJcbiAgICAgIC5uZXh0KHRyYW5zZm9ybVBhcnNlZFRlc3RzKVxyXG4gICAgICAubmV4dChwYXJ0aXRpb25EYXRhVGFzaylcclxuICAgICAgLm5leHQoc3VibWl0Sm9ic1Rhc2spXHJcbiAgICAgIC5uZXh0KHdhaXRGb3JKb2JzVG9SZWdpc3RlcikgIC8vIFdhaXQgNSBzZWNvbmRzIGZvciBqb2JzIHRvIHJlZ2lzdGVyXHJcbiAgICAgIC5uZXh0KGNoZWNrSm9ic1Rhc2spO1xyXG5cclxuICAgIC8vIENyZWF0ZSBTdGF0ZSBNYWNoaW5lXHJcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBuZXcgc2ZuLlN0YXRlTWFjaGluZSh0aGlzLCAnU3RhdGVNYWNoaW5lJywge1xyXG4gICAgICBzdGF0ZU1hY2hpbmVOYW1lOiAnam1ldGVyLWJhdGNoLXdvcmtmbG93JyxcclxuICAgICAgZGVmaW5pdGlvbkJvZHk6IHNmbi5EZWZpbml0aW9uQm9keS5mcm9tQ2hhaW5hYmxlKGRlZmluaXRpb24pLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyhjb25maWcuc3RlcEZ1bmN0aW9ucy50aW1lb3V0TWludXRlcyksXHJcbiAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLCAgLy8gRW5hYmxlIFgtUmF5IHRyYWNpbmdcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG4gICAgLy8gT1VUUFVUU1xyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbmZpZ0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBjb25maWdCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIHRlc3Qgc2NyaXB0cyBhbmQgZGF0YScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdKTWV0ZXJCYXRjaC1Db25maWdCdWNrZXQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3VsdHNCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogcmVzdWx0c0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgdGVzdCByZXN1bHRzJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckJhdGNoLVJlc3VsdHNCdWNrZXQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlcG9zaXRvcnlVcmknLCB7XHJcbiAgICAgIHZhbHVlOiByZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNSIHJlcG9zaXRvcnkgVVJJIGZvciBKTWV0ZXIgRG9ja2VyIGltYWdlJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckJhdGNoLVJlcG9zaXRvcnlVcmknLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcclxuICAgICAgdmFsdWU6IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBBUk4gKHVzZSBpbiBHaXRIdWIgQWN0aW9ucyknLFxyXG4gICAgICBleHBvcnROYW1lOiAnSk1ldGVyQmF0Y2gtU3RhdGVNYWNoaW5lQXJuJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdKb2JRdWV1ZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBqb2JRdWV1ZS5yZWYsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIEJhdGNoIGpvYiBxdWV1ZSBuYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckJhdGNoLUpvYlF1ZXVlJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdKb2JEZWZpbml0aW9uQXJuJywge1xyXG4gICAgICB2YWx1ZTogam9iRGVmaW5pdGlvbi5yZWYsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIEJhdGNoIGpvYiBkZWZpbml0aW9uJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckJhdGNoLUpvYkRlZmluaXRpb24nLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==