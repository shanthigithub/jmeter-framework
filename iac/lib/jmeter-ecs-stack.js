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
exports.JMeterEcsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const s3n = __importStar(require("aws-cdk-lib/aws-s3-notifications"));
const config_1 = require("../environments/config");
const path = __importStar(require("path"));
const jmx_parser_lambda_1 = require("./constructs/jmx-parser-lambda");
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
class JMeterEcsStack extends cdk.Stack {
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
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
        const resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
            bucketName: config_1.config.resultsBucket,
            encryption: config_1.config.security.enableEncryption
                ? s3.BucketEncryption.S3_MANAGED
                : s3.BucketEncryption.UNENCRYPTED,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [{
                    expiration: cdk.Duration.days(90),
                    transitions: [{
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        }],
                }],
        });
        // ═══════════════════════════════════════════════════════════════════════
        // SNS TOPIC FOR TEST SCRIPT VALIDATION NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════════════
        const validationTopic = new sns.Topic(this, 'TestValidationTopic', {
            displayName: 'Test Script Validation Notifications',
            topicName: 'test-script-validation',
        });
        // Subscribe team email
        // Note: You'll need to confirm the subscription via email after deployment
        validationTopic.addSubscription(new subscriptions.EmailSubscription('shanthireddy.kundur@gmail.com'));
        // ═══════════════════════════════════════════════════════════════════════
        // LAMBDA FUNCTION FOR TEST SCRIPT VALIDATION
        // ═══════════════════════════════════════════════════════════════════════
        const validateTestScriptFn = new lambda.Function(this, 'ValidateTestScript', {
            functionName: 'jmeter-validate-test-script',
            runtime: lambda.Runtime.NODEJS_18_X,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'validate-test-script')),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                SNS_TOPIC_ARN: validationTopic.topicArn,
            },
            description: 'Validates test scripts uploaded to S3 for security and best practices',
        });
        // Grant permissions to Lambda validator
        configBucket.grantReadWrite(validateTestScriptFn);
        validationTopic.grantPublish(validateTestScriptFn);
        // S3 trigger - validates JavaScript test scripts on upload
        configBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(validateTestScriptFn), { prefix: 'tests/', suffix: '.js' });
        // ═══════════════════════════════════════════════════════════════════════
        // ECR REPOSITORY
        // ═══════════════════════════════════════════════════════════════════════
        const repository = new ecr.Repository(this, 'JMeterRepository', {
            repositoryName: config_1.config.ecrRepoName,
            imageScanOnPush: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
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
        // Security Group for ECS tasks
        const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
            vpc,
            description: 'Security group for JMeter ECS Fargate tasks',
            allowAllOutbound: true, // Required for ECR, S3, and test endpoints
        });
        // ═══════════════════════════════════════════════════════════════════════
        // ECS CLUSTER
        // ═══════════════════════════════════════════════════════════════════════
        const cluster = new ecs.Cluster(this, 'JMeterCluster', {
            clusterName: 'jmeter-framework-cluster',
            vpc: vpc,
            containerInsights: true, // Enable CloudWatch Container Insights
        });
        // ═══════════════════════════════════════════════════════════════════════
        // IAM ROLES
        // ═══════════════════════════════════════════════════════════════════════
        // Task Role - assumed by containers running JMeter (access to S3)
        const taskRole = new iam.Role(this, 'TaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Role for JMeter containers to access S3',
        });
        // Grant S3 permissions to task role
        taskRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3ReadConfig',
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: [
                configBucket.bucketArn,
                `${configBucket.bucketArn}/*`,
            ],
        }));
        taskRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3WriteResults',
            actions: ['s3:PutObject'],
            resources: [`${resultsBucket.bucketArn}/*`],
        }));
        // Task Execution Role - pulls ECR images, writes CloudWatch logs, reads secrets
        const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
        // Import Datadog secret (if configured)
        let datadogSecret;
        if (config_1.config.monitoring.datadogSecretArn) {
            datadogSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DatadogSecret', config_1.config.monitoring.datadogSecretArn);
            // Grant task execution role permission to read Datadog secret
            datadogSecret.grantRead(taskExecutionRole);
        }
        // Lambda Execution Role
        const lambdaRole = new iam.Role(this, 'LambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Grant Lambda permissions for S3
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
        // Grant Lambda permissions for ECS
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'EcsRunTask',
            actions: ['ecs:RunTask', 'ecs:TagResource'],
            resources: ['*'], // Will be scoped after task definition creation
        }));
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'EcsDescribeTasks',
            actions: ['ecs:DescribeTasks', 'ecs:ListTasks', 'ecs:StopTask'],
            resources: ['*'],
        }));
        // Allow Lambda to pass roles to ECS tasks
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            sid: 'PassRole',
            actions: ['iam:PassRole'],
            resources: [taskRole.roleArn, taskExecutionRole.roleArn],
        }));
        // ═══════════════════════════════════════════════════════════════════════
        // ECS TASK DEFINITION
        // ═══════════════════════════════════════════════════════════════════════
        // CloudWatch Log Group for JMeter tasks
        const jmeterLogGroup = new logs.LogGroup(this, 'JMeterLogGroup', {
            logGroupName: '/ecs/jmeter',
            retention: config_1.config.logs.retentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ═══════════════════════════════════════════════════════════════════════
        // TASK DEFINITIONS (API & BROWSER)
        // ═══════════════════════════════════════════════════════════════════════
        // Build container secrets configuration (shared by both task definitions)
        const containerSecrets = {};
        if (datadogSecret) {
            containerSecrets['DD_API_KEY'] = ecs.Secret.fromSecretsManager(datadogSecret);
        }
        // API Task Definition (2 vCPU / 4 GB) - For HTTP/REST API tests
        const apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
            family: 'jmeter-api',
            cpu: config_1.config.ecs.apiTask.vcpus * 1024, // 1 vCPU = 1024 units
            memoryLimitMiB: config_1.config.ecs.apiTask.memoryMiB,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });
        // Create separate log group for API tasks
        const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
            logGroupName: '/jmeter/api',
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        apiTaskDefinition.addContainer('jmeter', {
            image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'jmeter-api',
                logGroup: apiLogGroup,
            }),
            environment: {
                CONFIG_BUCKET: config_1.config.configBucket,
                RESULTS_BUCKET: config_1.config.resultsBucket,
                AWS_REGION: this.region,
                TEST_TYPE: 'api',
            },
            secrets: Object.keys(containerSecrets).length > 0 ? containerSecrets : undefined,
            command: ['echo', 'JMeter API container - command will be set by Lambda'],
            stopTimeout: cdk.Duration.seconds(120), // Force stop after 2 minutes if container doesn't exit
        });
        // Browser Task Definition (4 vCPU / 8 GB) - For Selenium/JSR223 browser tests
        const browserTaskDefinition = new ecs.FargateTaskDefinition(this, 'BrowserTaskDefinition', {
            family: 'jmeter-browser',
            cpu: config_1.config.ecs.browserTask.vcpus * 1024,
            memoryLimitMiB: config_1.config.ecs.browserTask.memoryMiB,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
        });
        // Create separate log group for browser tasks
        const browserLogGroup = new logs.LogGroup(this, 'BrowserLogGroup', {
            logGroupName: '/jmeter/browser',
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        browserTaskDefinition.addContainer('jmeter', {
            image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'jmeter-browser',
                logGroup: browserLogGroup,
            }),
            environment: {
                CONFIG_BUCKET: config_1.config.configBucket,
                RESULTS_BUCKET: config_1.config.resultsBucket,
                AWS_REGION: this.region,
                TEST_TYPE: 'browser',
            },
            secrets: Object.keys(containerSecrets).length > 0 ? containerSecrets : undefined,
            command: ['echo', 'JMeter Browser container - command will be set by Lambda'],
            stopTimeout: cdk.Duration.seconds(120), // Force stop after 2 minutes if container doesn't exit
        });
        // ═══════════════════════════════════════════════════════════════════════
        // LAMBDA FUNCTIONS
        // ═══════════════════════════════════════════════════════════════════════
        // 1. Read Config - reads test configuration from S3
        const readConfigFn = new lambda.Function(this, 'ReadConfigFn', {
            functionName: 'jmeter-ecs-read-config',
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
            functionName: 'jmeter-ecs-partition-data',
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
        // 3. Submit Tasks - launches ECS Fargate tasks
        const submitTasksFn = new lambda.Function(this, 'SubmitTasksFn', {
            functionName: 'jmeter-ecs-submit-tasks',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'submit-tasks')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.submitTasks),
            environment: {
                ECS_CLUSTER: cluster.clusterName,
                TASK_DEF_ARN_API: apiTaskDefinition.taskDefinitionArn,
                TASK_DEF_ARN_BROWSER: browserTaskDefinition.taskDefinitionArn,
                CONFIG_BUCKET: config_1.config.configBucket,
                RESULTS_BUCKET: config_1.config.resultsBucket,
                SUBNETS: vpc.publicSubnets.map(s => s.subnetId).join(','),
                SECURITY_GROUPS: ecsSecurityGroup.securityGroupId,
            },
        });
        // 4. Check Tasks - checks ECS task status
        const checkTasksFn = new lambda.Function(this, 'CheckTasksFn', {
            functionName: 'jmeter-ecs-check-tasks',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'check-tasks')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(config_1.config.lambda.timeoutSeconds.checkTasks),
            environment: {
                ECS_CLUSTER: cluster.clusterName,
            },
        });
        // 5. Wait For Ready - coordinates container synchronization
        const waitForReadyFn = new lambda.Function(this, 'WaitForReadyFn', {
            functionName: 'jmeter-ecs-wait-for-ready',
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'wait-for-ready')),
            role: lambdaRole,
            memorySize: config_1.config.lambda.memoryMB,
            timeout: cdk.Duration.seconds(360), // 6 minutes (needs to wait for all containers)
            environment: {
                ECS_CLUSTER: cluster.clusterName,
                CONFIG_BUCKET: config_1.config.configBucket,
                MAX_WAIT_SECONDS: '300', // 5 minutes max wait for all containers
                POLL_INTERVAL_SECONDS: '5', // Check every 5 seconds
            },
        });
        // 6. Merge Results - aggregates results from all tasks
        const mergeResultsFn = new lambda.Function(this, 'MergeResultsFn', {
            functionName: 'jmeter-ecs-merge-results',
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
        // 7. JMX Parser - automatically extracts test configuration from JMX files
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
                'testType.$': '$.testType',
                'execute.$': '$.execute',
                'enableDatadog.$': '$.enableDatadog',
                'datadogSite.$': '$.datadogSite',
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
        // Task: Submit Tasks (ECS)
        const submitTasksTask = new tasks.LambdaInvoke(this, 'SubmitTasks', {
            lambdaFunction: submitTasksFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.tasksResult',
        });
        // Task: Wait For Ready - synchronize container startup (k6-style coordination)
        const waitForReadyTask = new sfn.Map(this, 'WaitForReady', {
            itemsPath: '$.tasksResult.Payload.tasks',
            resultPath: '$.syncResult',
            maxConcurrency: 5,
            parameters: {
                'test.$': '$$.Map.Item.Value',
                'runId.$': '$.tasksResult.Payload.runId',
            },
        }).iterator(new tasks.LambdaInvoke(this, 'WaitForReadyPerTest', {
            lambdaFunction: waitForReadyFn,
            payload: sfn.TaskInput.fromObject({
                'runId.$': '$.runId',
                'testId.$': '$.test.testId',
                'taskArns.$': '$.test.taskArns',
                'expectedTaskCount.$': '$.test.numContainers',
                'clusterArn': cluster.clusterArn,
                'configBucket': config_1.config.configBucket,
            }),
            resultSelector: {
                'Payload.$': '$.Payload',
            },
        }));
        // Task: Check Tasks
        const checkTasksTask = new tasks.LambdaInvoke(this, 'CheckTasks', {
            lambdaFunction: checkTasksFn,
            payload: sfn.TaskInput.fromJsonPathAt('$'),
            resultPath: '$.checkResult',
        });
        // Wait between task status checks
        const waitTask = new sfn.Wait(this, 'Wait', {
            time: sfn.WaitTime.duration(cdk.Duration.seconds(config_1.config.stepFunctions.waitBetweenChecks)),
        });
        // Task: Merge Results
        const mergeResultsTask = new tasks.LambdaInvoke(this, 'MergeResults', {
            lambdaFunction: mergeResultsFn,
            payload: sfn.TaskInput.fromObject({
                'tasks.$': '$.tasksResult.Payload.tasks',
                'runId.$': '$.runId',
            }),
            resultPath: '$.mergeResult',
        });
        // Success state
        const successState = new sfn.Succeed(this, 'Success');
        // Choice: Check if tasks are done
        const tasksDoneChoice = new sfn.Choice(this, 'TasksDone?')
            .when(sfn.Condition.booleanEquals('$.checkResult.Payload.allTasksComplete', true), mergeResultsTask)
            .when(sfn.Condition.booleanEquals('$.checkResult.Payload.anyTasksFailed', true), new sfn.Fail(this, 'TasksFailed', {
            cause: 'One or more ECS tasks failed',
            error: 'EcsTasksFailure',
        }))
            .otherwise(waitTask);
        // Connect states
        waitTask.next(checkTasksTask);
        checkTasksTask.next(tasksDoneChoice);
        mergeResultsTask.next(successState);
        // Define workflow
        const definition = readConfigTask
            .next(filterTestsTask)
            .next(parseJmxTask)
            .next(transformParsedTests)
            .next(partitionDataTask)
            .next(submitTasksTask)
            .next(waitForReadyTask) // Synchronize containers before starting test
            .next(checkTasksTask);
        // Create State Machine
        const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
            stateMachineName: 'jmeter-ecs-workflow',
            definitionBody: sfn.DefinitionBody.fromChainable(definition),
            timeout: cdk.Duration.minutes(config_1.config.stepFunctions.timeoutMinutes),
            tracingEnabled: true,
        });
        // ═══════════════════════════════════════════════════════════════════════
        // OUTPUTS
        // ═══════════════════════════════════════════════════════════════════════
        new cdk.CfnOutput(this, 'ConfigBucketName', {
            value: configBucket.bucketName,
            description: 'S3 bucket for test scripts and data',
            exportName: 'JMeterEcs-ConfigBucket',
        });
        new cdk.CfnOutput(this, 'ResultsBucketName', {
            value: resultsBucket.bucketName,
            description: 'S3 bucket for test results',
            exportName: 'JMeterEcs-ResultsBucket',
        });
        new cdk.CfnOutput(this, 'RepositoryUri', {
            value: repository.repositoryUri,
            description: 'ECR repository URI for JMeter Docker image',
            exportName: 'JMeterEcs-RepositoryUri',
        });
        new cdk.CfnOutput(this, 'StateMachineArn', {
            value: stateMachine.stateMachineArn,
            description: 'Step Functions state machine ARN (use in GitHub Actions)',
            exportName: 'JMeterEcs-StateMachineArn',
        });
        new cdk.CfnOutput(this, 'EcsClusterName', {
            value: cluster.clusterName,
            description: 'ECS cluster name',
            exportName: 'JMeterEcs-ClusterName',
        });
        new cdk.CfnOutput(this, 'ApiTaskDefinitionArn', {
            value: apiTaskDefinition.taskDefinitionArn,
            description: 'ECS API task definition ARN (2 vCPU / 4 GB)',
            exportName: 'JMeterEcs-ApiTaskDefinitionArn',
        });
        new cdk.CfnOutput(this, 'BrowserTaskDefinitionArn', {
            value: browserTaskDefinition.taskDefinitionArn,
            description: 'ECS Browser task definition ARN (4 vCPU / 8 GB)',
            exportName: 'JMeterEcs-BrowserTaskDefinitionArn',
        });
        new cdk.CfnOutput(this, 'ValidationTopicArn', {
            value: validationTopic.topicArn,
            description: 'SNS topic for test script validation notifications',
            exportName: 'JMeterEcs-ValidationTopicArn',
        });
        new cdk.CfnOutput(this, 'ValidatorFunctionName', {
            value: validateTestScriptFn.functionName,
            description: 'Lambda function that validates test scripts',
            exportName: 'JMeterEcs-ValidatorFunctionName',
        });
    }
}
exports.JMeterEcsStack = JMeterEcsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam1ldGVyLWVjcy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImptZXRlci1lY3Mtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx1REFBeUM7QUFDekMsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQUNqRCxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBQzdELCtFQUFpRTtBQUNqRSx5REFBMkM7QUFDM0MsaUZBQW1FO0FBQ25FLHNFQUF3RDtBQUV4RCxtREFBZ0Q7QUFDaEQsMkNBQTZCO0FBQzdCLHNFQUFpRTtBQUVqRTs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwRUFBMEU7UUFDMUUsYUFBYTtRQUNiLDBFQUEwRTtRQUUxRSxNQUFNLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN2RCxVQUFVLEVBQUUsZUFBTSxDQUFDLFlBQVk7WUFDL0IsU0FBUyxFQUFFLElBQUk7WUFDZixVQUFVLEVBQUUsZUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0I7Z0JBQzFDLENBQUMsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtnQkFDaEMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXO1lBQ25DLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDdkMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7U0FDbEQsQ0FBQyxD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QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XHJcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcclxuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIHNmbiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XHJcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zLXRhc2tzJztcclxuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xyXG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XHJcbmltcG9ydCAqIGFzIHMzbiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgeyBjb25maWcgfSBmcm9tICcuLi9lbnZpcm9ubWVudHMvY29uZmlnJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgSm14UGFyc2VyTGFtYmRhIH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2pteC1wYXJzZXItbGFtYmRhJztcclxuXHJcbi8qKlxyXG4gKiBKTWV0ZXIgRUNTIEZhcmdhdGUgRnJhbWV3b3JrIFN0YWNrXHJcbiAqIFxyXG4gKiBEaXJlY3QgRUNTIEZhcmdhdGUgZXhlY3V0aW9uIC0gbm8gQVdTIEJhdGNoIGNvbXBsZXhpdHkhXHJcbiAqIFxyXG4gKiBLZXkgRmVhdHVyZXM6XHJcbiAqIC0gRGlyZWN0IEVDUyBGYXJnYXRlIHRhc2sgaW52b2NhdGlvbiAoc2ltcGxlciwgZmFzdGVyKVxyXG4gKiAtIE5vIG1hc3Rlci1taW5pb24gYXJjaGl0ZWN0dXJlIChrNi1zdHlsZSBzZWdtZW50cylcclxuICogLSBTMy1iYXNlZCBkeW5hbWljIGxvYWRpbmcgKHNtYWxsIGltYWdlcywgZmFzdCBkZXBsb3ltZW50cylcclxuICogLSBMYW1iZGEgb3JjaGVzdHJhdGlvbiAoc2VydmVybGVzcywgcGF5LXBlci11c2UpXHJcbiAqIC0gU3RlcCBGdW5jdGlvbnMgd29ya2Zsb3cgKHJlbGlhYmxlLCBvYnNlcnZhYmxlKVxyXG4gKiAtIEluc3RhbnQgY2FwYWNpdHkgKG5vIFNQT1Qgd2FpdCB0aW1lcylcclxuICogLSBFYXNpZXIgZGVidWdnaW5nIChkaXJlY3QgRUNTIGxvZ3MpXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgSk1ldGVyRWNzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG4gICAgLy8gUzMgQlVDS0VUU1xyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgY29uc3QgY29uZmlnQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQ29uZmlnQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBjb25maWcuY29uZmlnQnVja2V0LFxyXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXHJcbiAgICAgIGVuY3J5cHRpb246IGNvbmZpZy5zZWN1cml0eS5lbmFibGVFbmNyeXB0aW9uIFxyXG4gICAgICAgID8gczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VEIFxyXG4gICAgICAgIDogczMuQnVja2V0RW5jcnlwdGlvbi5VTkVOQ1JZUFRFRCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVzdWx0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Jlc3VsdHNCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGNvbmZpZy5yZXN1bHRzQnVja2V0LFxyXG4gICAgICBlbmNyeXB0aW9uOiBjb25maWcuc2VjdXJpdHkuZW5hYmxlRW5jcnlwdGlvbiBcclxuICAgICAgICA/IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCBcclxuICAgICAgICA6IHMzLkJ1Y2tldEVuY3J5cHRpb24uVU5FTkNSWVBURUQsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFt7XHJcbiAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxyXG4gICAgICAgIHRyYW5zaXRpb25zOiBbe1xyXG4gICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXHJcbiAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcclxuICAgICAgICB9XSxcclxuICAgICAgfV0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIFNOUyBUT1BJQyBGT1IgVEVTVCBTQ1JJUFQgVkFMSURBVElPTiBOT1RJRklDQVRJT05TXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICBjb25zdCB2YWxpZGF0aW9uVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdUZXN0VmFsaWRhdGlvblRvcGljJywge1xyXG4gICAgICBkaXNwbGF5TmFtZTogJ1Rlc3QgU2NyaXB0IFZhbGlkYXRpb24gTm90aWZpY2F0aW9ucycsXHJcbiAgICAgIHRvcGljTmFtZTogJ3Rlc3Qtc2NyaXB0LXZhbGlkYXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3Vic2NyaWJlIHRlYW0gZW1haWxcclxuICAgIC8vIE5vdGU6IFlvdSdsbCBuZWVkIHRvIGNvbmZpcm0gdGhlIHN1YnNjcmlwdGlvbiB2aWEgZW1haWwgYWZ0ZXIgZGVwbG95bWVudFxyXG4gICAgdmFsaWRhdGlvblRvcGljLmFkZFN1YnNjcmlwdGlvbihcclxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oJ3NoYW50aGlyZWRkeS5rdW5kdXJAZ21haWwuY29tJylcclxuICAgICk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBMQU1CREEgRlVOQ1RJT04gRk9SIFRFU1QgU0NSSVBUIFZBTElEQVRJT05cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIGNvbnN0IHZhbGlkYXRlVGVzdFNjcmlwdEZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVmFsaWRhdGVUZXN0U2NyaXB0Jywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItdmFsaWRhdGUtdGVzdC1zY3JpcHQnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJ2xhbWJkYScsICd2YWxpZGF0ZS10ZXN0LXNjcmlwdCcpKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgU05TX1RPUElDX0FSTjogdmFsaWRhdGlvblRvcGljLnRvcGljQXJuLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZhbGlkYXRlcyB0ZXN0IHNjcmlwdHMgdXBsb2FkZWQgdG8gUzMgZm9yIHNlY3VyaXR5IGFuZCBiZXN0IHByYWN0aWNlcycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGEgdmFsaWRhdG9yXHJcbiAgICBjb25maWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodmFsaWRhdGVUZXN0U2NyaXB0Rm4pO1xyXG4gICAgdmFsaWRhdGlvblRvcGljLmdyYW50UHVibGlzaCh2YWxpZGF0ZVRlc3RTY3JpcHRGbik7XHJcblxyXG4gICAgLy8gUzMgdHJpZ2dlciAtIHZhbGlkYXRlcyBKYXZhU2NyaXB0IHRlc3Qgc2NyaXB0cyBvbiB1cGxvYWRcclxuICAgIGNvbmZpZ0J1Y2tldC5hZGRFdmVudE5vdGlmaWNhdGlvbihcclxuICAgICAgczMuRXZlbnRUeXBlLk9CSkVDVF9DUkVBVEVELFxyXG4gICAgICBuZXcgczNuLkxhbWJkYURlc3RpbmF0aW9uKHZhbGlkYXRlVGVzdFNjcmlwdEZuKSxcclxuICAgICAgeyBwcmVmaXg6ICd0ZXN0cy8nLCBzdWZmaXg6ICcuanMnIH1cclxuICAgICk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBFQ1IgUkVQT1NJVE9SWVxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgY29uc3QgcmVwb3NpdG9yeSA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnSk1ldGVyUmVwb3NpdG9yeScsIHtcclxuICAgICAgcmVwb3NpdG9yeU5hbWU6IGNvbmZpZy5lY3JSZXBvTmFtZSxcclxuICAgICAgaW1hZ2VTY2FuT25QdXNoOiB0cnVlLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXHJcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbe1xyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBvbmx5IGxhc3QgMTAgaW1hZ2VzJyxcclxuICAgICAgICBtYXhJbWFnZUNvdW50OiAxMCxcclxuICAgICAgfV0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIFZQQyAoVXNlIERlZmF1bHQgVlBDKVxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgY29uc3QgdnBjID0gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdEZWZhdWx0VnBjJywgeyBcclxuICAgICAgaXNEZWZhdWx0OiB0cnVlIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIEVDUyB0YXNrc1xyXG4gICAgY29uc3QgZWNzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnRWNzU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBKTWV0ZXIgRUNTIEZhcmdhdGUgdGFza3MnLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLCAgLy8gUmVxdWlyZWQgZm9yIEVDUiwgUzMsIGFuZCB0ZXN0IGVuZHBvaW50c1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBFQ1MgQ0xVU1RFUlxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCAnSk1ldGVyQ2x1c3RlcicsIHtcclxuICAgICAgY2x1c3Rlck5hbWU6ICdqbWV0ZXItZnJhbWV3b3JrLWNsdXN0ZXInLFxyXG4gICAgICB2cGM6IHZwYyxcclxuICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWUsICAvLyBFbmFibGUgQ2xvdWRXYXRjaCBDb250YWluZXIgSW5zaWdodHNcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG4gICAgLy8gSUFNIFJPTEVTXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICAvLyBUYXNrIFJvbGUgLSBhc3N1bWVkIGJ5IGNvbnRhaW5lcnMgcnVubmluZyBKTWV0ZXIgKGFjY2VzcyB0byBTMylcclxuICAgIGNvbnN0IHRhc2tSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdUYXNrUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUm9sZSBmb3IgSk1ldGVyIGNvbnRhaW5lcnMgdG8gYWNjZXNzIFMzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IFMzIHBlcm1pc3Npb25zIHRvIHRhc2sgcm9sZVxyXG4gICAgdGFza1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBzaWQ6ICdTM1JlYWRDb25maWcnLFxyXG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCcsICdzMzpMaXN0QnVja2V0J10sXHJcbiAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgIGNvbmZpZ0J1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgYCR7Y29uZmlnQnVja2V0LmJ1Y2tldEFybn0vKmAsXHJcbiAgICAgIF0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgdGFza1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBzaWQ6ICdTM1dyaXRlUmVzdWx0cycsXHJcbiAgICAgIGFjdGlvbnM6IFsnczM6UHV0T2JqZWN0J10sXHJcbiAgICAgIHJlc291cmNlczogW2Ake3Jlc3VsdHNCdWNrZXQuYnVja2V0QXJufS8qYF0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gVGFzayBFeGVjdXRpb24gUm9sZSAtIHB1bGxzIEVDUiBpbWFnZXMsIHdyaXRlcyBDbG91ZFdhdGNoIGxvZ3MsIHJlYWRzIHNlY3JldHNcclxuICAgIGNvbnN0IHRhc2tFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdUYXNrRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FtYXpvbkVDU1Rhc2tFeGVjdXRpb25Sb2xlUG9saWN5JyksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJbXBvcnQgRGF0YWRvZyBzZWNyZXQgKGlmIGNvbmZpZ3VyZWQpXHJcbiAgICBsZXQgZGF0YWRvZ1NlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldCB8IHVuZGVmaW5lZDtcclxuICAgIGlmIChjb25maWcubW9uaXRvcmluZy5kYXRhZG9nU2VjcmV0QXJuKSB7XHJcbiAgICAgIGRhdGFkb2dTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldENvbXBsZXRlQXJuKFxyXG4gICAgICAgIHRoaXMsXHJcbiAgICAgICAgJ0RhdGFkb2dTZWNyZXQnLFxyXG4gICAgICAgIGNvbmZpZy5tb25pdG9yaW5nLmRhdGFkb2dTZWNyZXRBcm5cclxuICAgICAgKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEdyYW50IHRhc2sgZXhlY3V0aW9uIHJvbGUgcGVybWlzc2lvbiB0byByZWFkIERhdGFkb2cgc2VjcmV0XHJcbiAgICAgIGRhdGFkb2dTZWNyZXQuZ3JhbnRSZWFkKHRhc2tFeGVjdXRpb25Sb2xlKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBMYW1iZGEgRXhlY3V0aW9uIFJvbGVcclxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYVJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxyXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9ucyBmb3IgUzNcclxuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBzaWQ6ICdTM0FjY2VzcycsXHJcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0JywgJ3MzOlB1dE9iamVjdCcsICdzMzpMaXN0QnVja2V0J10sXHJcbiAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgIGNvbmZpZ0J1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgYCR7Y29uZmlnQnVja2V0LmJ1Y2tldEFybn0vKmAsXHJcbiAgICAgICAgcmVzdWx0c0J1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgYCR7cmVzdWx0c0J1Y2tldC5idWNrZXRBcm59LypgLFxyXG4gICAgICBdLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9ucyBmb3IgRUNTXHJcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnRWNzUnVuVGFzaycsXHJcbiAgICAgIGFjdGlvbnM6IFsnZWNzOlJ1blRhc2snLCAnZWNzOlRhZ1Jlc291cmNlJ10sXHJcbiAgICAgIHJlc291cmNlczogWycqJ10sICAvLyBXaWxsIGJlIHNjb3BlZCBhZnRlciB0YXNrIGRlZmluaXRpb24gY3JlYXRpb25cclxuICAgIH0pKTtcclxuXHJcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgc2lkOiAnRWNzRGVzY3JpYmVUYXNrcycsXHJcbiAgICAgIGFjdGlvbnM6IFsnZWNzOkRlc2NyaWJlVGFza3MnLCAnZWNzOkxpc3RUYXNrcycsICdlY3M6U3RvcFRhc2snXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBBbGxvdyBMYW1iZGEgdG8gcGFzcyByb2xlcyB0byBFQ1MgdGFza3NcclxuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBzaWQ6ICdQYXNzUm9sZScsXHJcbiAgICAgIGFjdGlvbnM6IFsnaWFtOlBhc3NSb2xlJ10sXHJcbiAgICAgIHJlc291cmNlczogW3Rhc2tSb2xlLnJvbGVBcm4sIHRhc2tFeGVjdXRpb25Sb2xlLnJvbGVBcm5dLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG4gICAgLy8gRUNTIFRBU0sgREVGSU5JVElPTlxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcblxyXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIEpNZXRlciB0YXNrc1xyXG4gICAgY29uc3Qgam1ldGVyTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnSk1ldGVyTG9nR3JvdXAnLCB7XHJcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9lY3Mvam1ldGVyJyxcclxuICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9ncy5yZXRlbnRpb25EYXlzLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBUQVNLIERFRklOSVRJT05TIChBUEkgJiBCUk9XU0VSKVxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICBcclxuICAgIC8vIEJ1aWxkIGNvbnRhaW5lciBzZWNyZXRzIGNvbmZpZ3VyYXRpb24gKHNoYXJlZCBieSBib3RoIHRhc2sgZGVmaW5pdGlvbnMpXHJcbiAgICBjb25zdCBjb250YWluZXJTZWNyZXRzOiB7IFtrZXk6IHN0cmluZ106IGVjcy5TZWNyZXQgfSA9IHt9O1xyXG4gICAgaWYgKGRhdGFkb2dTZWNyZXQpIHtcclxuICAgICAgY29udGFpbmVyU2VjcmV0c1snRERfQVBJX0tFWSddID0gZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoZGF0YWRvZ1NlY3JldCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQVBJIFRhc2sgRGVmaW5pdGlvbiAoMiB2Q1BVIC8gNCBHQikgLSBGb3IgSFRUUC9SRVNUIEFQSSB0ZXN0c1xyXG4gICAgY29uc3QgYXBpVGFza0RlZmluaXRpb24gPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCAnQXBpVGFza0RlZmluaXRpb24nLCB7XHJcbiAgICAgIGZhbWlseTogJ2ptZXRlci1hcGknLFxyXG4gICAgICBjcHU6IGNvbmZpZy5lY3MuYXBpVGFzay52Y3B1cyAqIDEwMjQsICAvLyAxIHZDUFUgPSAxMDI0IHVuaXRzXHJcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiBjb25maWcuZWNzLmFwaVRhc2subWVtb3J5TWlCLFxyXG4gICAgICB0YXNrUm9sZTogdGFza1JvbGUsXHJcbiAgICAgIGV4ZWN1dGlvblJvbGU6IHRhc2tFeGVjdXRpb25Sb2xlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIHNlcGFyYXRlIGxvZyBncm91cCBmb3IgQVBJIHRhc2tzXHJcbiAgICBjb25zdCBhcGlMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBcGlMb2dHcm91cCcsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiAnL2ptZXRlci9hcGknLFxyXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGFwaVRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcignam1ldGVyJywge1xyXG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KHJlcG9zaXRvcnksICdsYXRlc3QnKSxcclxuICAgICAgbG9nZ2luZzogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XHJcbiAgICAgICAgc3RyZWFtUHJlZml4OiAnam1ldGVyLWFwaScsXHJcbiAgICAgICAgbG9nR3JvdXA6IGFwaUxvZ0dyb3VwLFxyXG4gICAgICB9KSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBDT05GSUdfQlVDS0VUOiBjb25maWcuY29uZmlnQnVja2V0LFxyXG4gICAgICAgIFJFU1VMVFNfQlVDS0VUOiBjb25maWcucmVzdWx0c0J1Y2tldCxcclxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcclxuICAgICAgICBURVNUX1RZUEU6ICdhcGknLFxyXG4gICAgICB9LFxyXG4gICAgICBzZWNyZXRzOiBPYmplY3Qua2V5cyhjb250YWluZXJTZWNyZXRzKS5sZW5ndGggPiAwID8gY29udGFpbmVyU2VjcmV0cyA6IHVuZGVmaW5lZCxcclxuICAgICAgY29tbWFuZDogWydlY2hvJywgJ0pNZXRlciBBUEkgY29udGFpbmVyIC0gY29tbWFuZCB3aWxsIGJlIHNldCBieSBMYW1iZGEnXSxcclxuICAgICAgc3RvcFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEyMCksIC8vIEZvcmNlIHN0b3AgYWZ0ZXIgMiBtaW51dGVzIGlmIGNvbnRhaW5lciBkb2Vzbid0IGV4aXRcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEJyb3dzZXIgVGFzayBEZWZpbml0aW9uICg0IHZDUFUgLyA4IEdCKSAtIEZvciBTZWxlbml1bS9KU1IyMjMgYnJvd3NlciB0ZXN0c1xyXG4gICAgY29uc3QgYnJvd3NlclRhc2tEZWZpbml0aW9uID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24odGhpcywgJ0Jyb3dzZXJUYXNrRGVmaW5pdGlvbicsIHtcclxuICAgICAgZmFtaWx5OiAnam1ldGVyLWJyb3dzZXInLFxyXG4gICAgICBjcHU6IGNvbmZpZy5lY3MuYnJvd3NlclRhc2sudmNwdXMgKiAxMDI0LFxyXG4gICAgICBtZW1vcnlMaW1pdE1pQjogY29uZmlnLmVjcy5icm93c2VyVGFzay5tZW1vcnlNaUIsXHJcbiAgICAgIHRhc2tSb2xlOiB0YXNrUm9sZSxcclxuICAgICAgZXhlY3V0aW9uUm9sZTogdGFza0V4ZWN1dGlvblJvbGUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcmVhdGUgc2VwYXJhdGUgbG9nIGdyb3VwIGZvciBicm93c2VyIHRhc2tzXHJcbiAgICBjb25zdCBicm93c2VyTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQnJvd3NlckxvZ0dyb3VwJywge1xyXG4gICAgICBsb2dHcm91cE5hbWU6ICcvam1ldGVyL2Jyb3dzZXInLFxyXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGJyb3dzZXJUYXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIoJ2ptZXRlcicsIHtcclxuICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tRWNyUmVwb3NpdG9yeShyZXBvc2l0b3J5LCAnbGF0ZXN0JyksXHJcbiAgICAgIGxvZ2dpbmc6IGVjcy5Mb2dEcml2ZXJzLmF3c0xvZ3Moe1xyXG4gICAgICAgIHN0cmVhbVByZWZpeDogJ2ptZXRlci1icm93c2VyJyxcclxuICAgICAgICBsb2dHcm91cDogYnJvd3NlckxvZ0dyb3VwLFxyXG4gICAgICB9KSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBDT05GSUdfQlVDS0VUOiBjb25maWcuY29uZmlnQnVja2V0LFxyXG4gICAgICAgIFJFU1VMVFNfQlVDS0VUOiBjb25maWcucmVzdWx0c0J1Y2tldCxcclxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcclxuICAgICAgICBURVNUX1RZUEU6ICdicm93c2VyJyxcclxuICAgICAgfSxcclxuICAgICAgc2VjcmV0czogT2JqZWN0LmtleXMoY29udGFpbmVyU2VjcmV0cykubGVuZ3RoID4gMCA/IGNvbnRhaW5lclNlY3JldHMgOiB1bmRlZmluZWQsXHJcbiAgICAgIGNvbW1hbmQ6IFsnZWNobycsICdKTWV0ZXIgQnJvd3NlciBjb250YWluZXIgLSBjb21tYW5kIHdpbGwgYmUgc2V0IGJ5IExhbWJkYSddLFxyXG4gICAgICBzdG9wVGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSwgLy8gRm9yY2Ugc3RvcCBhZnRlciAyIG1pbnV0ZXMgaWYgY29udGFpbmVyIGRvZXNuJ3QgZXhpdFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQXHJcbiAgICAvLyBMQU1CREEgRlVOQ1RJT05TXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICAvLyAxLiBSZWFkIENvbmZpZyAtIHJlYWRzIHRlc3QgY29uZmlndXJhdGlvbiBmcm9tIFMzXHJcbiAgICBjb25zdCByZWFkQ29uZmlnRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWFkQ29uZmlnRm4nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2ptZXRlci1lY3MtcmVhZC1jb25maWcnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcclxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmxhbWJkYV9oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdsYW1iZGEnLCAncmVhZC1jb25maWcnKSksXHJcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXHJcbiAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5sYW1iZGEubWVtb3J5TUIsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dFNlY29uZHMucmVhZENvbmZpZyksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQ09ORklHX0JVQ0tFVDogY29uZmlnLmNvbmZpZ0J1Y2tldCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDIuIFBhcnRpdGlvbiBEYXRhIC0gc3BsaXRzIENTViBmaWxlcyBmb3IgcGFyYWxsZWwgcHJvY2Vzc2luZ1xyXG4gICAgY29uc3QgcGFydGl0aW9uRGF0YUZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGFydGl0aW9uRGF0YUZuJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItZWNzLXBhcnRpdGlvbi1kYXRhJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ3BhcnRpdGlvbi1kYXRhJykpLFxyXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxyXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeU1CLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXRTZWNvbmRzLnBhcnRpdGlvbkRhdGEpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTkZJR19CVUNLRVQ6IGNvbmZpZy5jb25maWdCdWNrZXQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAzLiBTdWJtaXQgVGFza3MgLSBsYXVuY2hlcyBFQ1MgRmFyZ2F0ZSB0YXNrc1xyXG4gICAgY29uc3Qgc3VibWl0VGFza3NGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N1Ym1pdFRhc2tzRm4nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2ptZXRlci1lY3Mtc3VibWl0LXRhc2tzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ3N1Ym1pdC10YXNrcycpKSxcclxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcclxuICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLmxhbWJkYS5tZW1vcnlNQixcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLmxhbWJkYS50aW1lb3V0U2Vjb25kcy5zdWJtaXRUYXNrcyksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgRUNTX0NMVVNURVI6IGNsdXN0ZXIuY2x1c3Rlck5hbWUsXHJcbiAgICAgICAgVEFTS19ERUZfQVJOX0FQSTogYXBpVGFza0RlZmluaXRpb24udGFza0RlZmluaXRpb25Bcm4sXHJcbiAgICAgICAgVEFTS19ERUZfQVJOX0JST1dTRVI6IGJyb3dzZXJUYXNrRGVmaW5pdGlvbi50YXNrRGVmaW5pdGlvbkFybixcclxuICAgICAgICBDT05GSUdfQlVDS0VUOiBjb25maWcuY29uZmlnQnVja2V0LFxyXG4gICAgICAgIFJFU1VMVFNfQlVDS0VUOiBjb25maWcucmVzdWx0c0J1Y2tldCxcclxuICAgICAgICBTVUJORVRTOiB2cGMucHVibGljU3VibmV0cy5tYXAocyA9PiBzLnN1Ym5ldElkKS5qb2luKCcsJyksXHJcbiAgICAgICAgU0VDVVJJVFlfR1JPVVBTOiBlY3NTZWN1cml0eUdyb3VwLnNlY3VyaXR5R3JvdXBJZCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDQuIENoZWNrIFRhc2tzIC0gY2hlY2tzIEVDUyB0YXNrIHN0YXR1c1xyXG4gICAgY29uc3QgY2hlY2tUYXNrc0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2hlY2tUYXNrc0ZuJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItZWNzLWNoZWNrLXRhc2tzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ2NoZWNrLXRhc2tzJykpLFxyXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxyXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeU1CLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXRTZWNvbmRzLmNoZWNrVGFza3MpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEVDU19DTFVTVEVSOiBjbHVzdGVyLmNsdXN0ZXJOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNS4gV2FpdCBGb3IgUmVhZHkgLSBjb29yZGluYXRlcyBjb250YWluZXIgc3luY2hyb25pemF0aW9uXHJcbiAgICBjb25zdCB3YWl0Rm9yUmVhZHlGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1dhaXRGb3JSZWFkeUZuJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdqbWV0ZXItZWNzLXdhaXQtZm9yLXJlYWR5JyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdsYW1iZGEnLCAnd2FpdC1mb3ItcmVhZHknKSksXHJcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXHJcbiAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5sYW1iZGEubWVtb3J5TUIsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDM2MCksIC8vIDYgbWludXRlcyAobmVlZHMgdG8gd2FpdCBmb3IgYWxsIGNvbnRhaW5lcnMpXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgRUNTX0NMVVNURVI6IGNsdXN0ZXIuY2x1c3Rlck5hbWUsXHJcbiAgICAgICAgQ09ORklHX0JVQ0tFVDogY29uZmlnLmNvbmZpZ0J1Y2tldCxcclxuICAgICAgICBNQVhfV0FJVF9TRUNPTkRTOiAnMzAwJywgIC8vIDUgbWludXRlcyBtYXggd2FpdCBmb3IgYWxsIGNvbnRhaW5lcnNcclxuICAgICAgICBQT0xMX0lOVEVSVkFMX1NFQ09ORFM6ICc1JywgIC8vIENoZWNrIGV2ZXJ5IDUgc2Vjb25kc1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNi4gTWVyZ2UgUmVzdWx0cyAtIGFnZ3JlZ2F0ZXMgcmVzdWx0cyBmcm9tIGFsbCB0YXNrc1xyXG4gICAgY29uc3QgbWVyZ2VSZXN1bHRzRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNZXJnZVJlc3VsdHNGbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnam1ldGVyLWVjcy1tZXJnZS1yZXN1bHRzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnbGFtYmRhJywgJ21lcmdlLXJlc3VsdHMnKSksXHJcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXHJcbiAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5sYW1iZGEubWVtb3J5TUIsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dFNlY29uZHMubWVyZ2VSZXN1bHRzKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBSRVNVTFRTX0JVQ0tFVDogY29uZmlnLnJlc3VsdHNCdWNrZXQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA3LiBKTVggUGFyc2VyIC0gYXV0b21hdGljYWxseSBleHRyYWN0cyB0ZXN0IGNvbmZpZ3VyYXRpb24gZnJvbSBKTVggZmlsZXNcclxuICAgIGNvbnN0IGpteFBhcnNlciA9IG5ldyBKbXhQYXJzZXJMYW1iZGEodGhpcywgJ0pteFBhcnNlcicsIHtcclxuICAgICAgY29uZmlnQnVja2V0OiBjb25maWdCdWNrZXQsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIFNURVAgRlVOQ1RJT05TIFdPUktGTE9XXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuXHJcbiAgICAvLyBUYXNrOiBSZWFkIENvbmZpZ1xyXG4gICAgY29uc3QgcmVhZENvbmZpZ1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdSZWFkQ29uZmlnJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogcmVhZENvbmZpZ0ZuLFxyXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21Kc29uUGF0aEF0KCckJyksXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLmNvbmZpZ1Jlc3VsdCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBGaWx0ZXIgZXhlY3V0YWJsZSB0ZXN0c1xyXG4gICAgY29uc3QgZmlsdGVyVGVzdHNUYXNrID0gbmV3IHNmbi5QYXNzKHRoaXMsICdGaWx0ZXJFeGVjdXRhYmxlVGVzdHMnLCB7XHJcbiAgICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgICAndGVzdHMuJCc6ICckLmNvbmZpZ1Jlc3VsdC5QYXlsb2FkLnRlc3RTdWl0ZVs/KEAuZXhlY3V0ZT09dHJ1ZSldJyxcclxuICAgICAgICAncnVuSWQuJCc6ICckJC5FeGVjdXRpb24uTmFtZScsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBQYXJzZSBKTVggZmlsZXMgdG8gZXh0cmFjdCBjb25maWd1cmF0aW9uXHJcbiAgICBjb25zdCBwYXJzZUpteFRhc2sgPSBuZXcgc2ZuLk1hcCh0aGlzLCAnUGFyc2VKTVgnLCB7XHJcbiAgICAgIGl0ZW1zUGF0aDogJyQudGVzdHMnLFxyXG4gICAgICByZXN1bHRQYXRoOiAnJC50ZXN0c1dpdGhDb25maWcnLFxyXG4gICAgICBtYXhDb25jdXJyZW5jeTogNSxcclxuICAgIH0pLml0ZXJhdG9yKFxyXG4gICAgICBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdQYXJzZUpNWEZpbGUnLCB7XHJcbiAgICAgICAgbGFtYmRhRnVuY3Rpb246IGpteFBhcnNlci5mdW5jdGlvbixcclxuICAgICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xyXG4gICAgICAgICAgJ3Rlc3RTY3JpcHQuJCc6ICckLnRlc3RTY3JpcHQnLFxyXG4gICAgICAgICAgJ3Rlc3RJZC4kJzogJyQudGVzdElkJyxcclxuICAgICAgICAgICd0ZXN0VHlwZS4kJzogJyQudGVzdFR5cGUnLFxyXG4gICAgICAgICAgJ2V4ZWN1dGUuJCc6ICckLmV4ZWN1dGUnLFxyXG4gICAgICAgICAgJ2VuYWJsZURhdGFkb2cuJCc6ICckLmVuYWJsZURhdGFkb2cnLFxyXG4gICAgICAgICAgJ2RhdGFkb2dTaXRlLiQnOiAnJC5kYXRhZG9nU2l0ZScsXHJcbiAgICAgICAgICAnY29uZmlnQnVja2V0JzogY29uZmlnLmNvbmZpZ0J1Y2tldCxcclxuICAgICAgICB9KSxcclxuICAgICAgICByZXN1bHRTZWxlY3Rvcjoge1xyXG4gICAgICAgICAgJ1BheWxvYWQuJCc6ICckLlBheWxvYWQnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pLmFkZENhdGNoKG5ldyBzZm4uRmFpbCh0aGlzLCAnUGFyc2VKTVhGYWlsZWQnLCB7XHJcbiAgICAgICAgY2F1c2U6ICdGYWlsZWQgdG8gcGFyc2UgSk1YIGZpbGUnLFxyXG4gICAgICAgIGVycm9yOiAnSk1YUGFyc2VFcnJvcicsXHJcbiAgICAgIH0pLCB7XHJcbiAgICAgICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBUcmFuc2Zvcm0gcGFyc2VkIHJlc3VsdHMgYmFjayB0byB0ZXN0cyBhcnJheVxyXG4gICAgY29uc3QgdHJhbnNmb3JtUGFyc2VkVGVzdHMgPSBuZXcgc2ZuLlBhc3ModGhpcywgJ1RyYW5zZm9ybVBhcnNlZFRlc3RzJywge1xyXG4gICAgICBwYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgJ3Rlc3RzLiQnOiAnJC50ZXN0c1dpdGhDb25maWdbKl0uUGF5bG9hZCcsXHJcbiAgICAgICAgJ3J1bklkLiQnOiAnJC5ydW5JZCcsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYXNrOiBQYXJ0aXRpb24gRGF0YSAob3B0aW9uYWwgLSBvbmx5IGlmIGRhdGFGaWxlcyBleGlzdClcclxuICAgIGNvbnN0IHBhcnRpdGlvbkRhdGFUYXNrID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnUGFydGl0aW9uRGF0YScsIHtcclxuICAgICAgbGFtYmRhRnVuY3Rpb246IHBhcnRpdGlvbkRhdGFGbixcclxuICAgICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tSnNvblBhdGhBdCgnJCcpLFxyXG4gICAgICByZXN1bHRQYXRoOiAnJC5wYXJ0aXRpb25SZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVGFzazogU3VibWl0IFRhc2tzIChFQ1MpXHJcbiAgICBjb25zdCBzdWJtaXRUYXNrc1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdTdWJtaXRUYXNrcycsIHtcclxuICAgICAgbGFtYmRhRnVuY3Rpb246IHN1Ym1pdFRhc2tzRm4sXHJcbiAgICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbUpzb25QYXRoQXQoJyQnKSxcclxuICAgICAgcmVzdWx0UGF0aDogJyQudGFza3NSZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVGFzazogV2FpdCBGb3IgUmVhZHkgLSBzeW5jaHJvbml6ZSBjb250YWluZXIgc3RhcnR1cCAoazYtc3R5bGUgY29vcmRpbmF0aW9uKVxyXG4gICAgY29uc3Qgd2FpdEZvclJlYWR5VGFzayA9IG5ldyBzZm4uTWFwKHRoaXMsICdXYWl0Rm9yUmVhZHknLCB7XHJcbiAgICAgIGl0ZW1zUGF0aDogJyQudGFza3NSZXN1bHQuUGF5bG9hZC50YXNrcycsXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLnN5bmNSZXN1bHQnLFxyXG4gICAgICBtYXhDb25jdXJyZW5jeTogNSxcclxuICAgICAgcGFyYW1ldGVyczoge1xyXG4gICAgICAgICd0ZXN0LiQnOiAnJCQuTWFwLkl0ZW0uVmFsdWUnLFxyXG4gICAgICAgICdydW5JZC4kJzogJyQudGFza3NSZXN1bHQuUGF5bG9hZC5ydW5JZCcsXHJcbiAgICAgIH0sXHJcbiAgICB9KS5pdGVyYXRvcihcclxuICAgICAgbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnV2FpdEZvclJlYWR5UGVyVGVzdCcsIHtcclxuICAgICAgICBsYW1iZGFGdW5jdGlvbjogd2FpdEZvclJlYWR5Rm4sXHJcbiAgICAgICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcclxuICAgICAgICAgICdydW5JZC4kJzogJyQucnVuSWQnLFxyXG4gICAgICAgICAgJ3Rlc3RJZC4kJzogJyQudGVzdC50ZXN0SWQnLFxyXG4gICAgICAgICAgJ3Rhc2tBcm5zLiQnOiAnJC50ZXN0LnRhc2tBcm5zJyxcclxuICAgICAgICAgICdleHBlY3RlZFRhc2tDb3VudC4kJzogJyQudGVzdC5udW1Db250YWluZXJzJyxcclxuICAgICAgICAgICdjbHVzdGVyQXJuJzogY2x1c3Rlci5jbHVzdGVyQXJuLFxyXG4gICAgICAgICAgJ2NvbmZpZ0J1Y2tldCc6IGNvbmZpZy5jb25maWdCdWNrZXQsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgcmVzdWx0U2VsZWN0b3I6IHtcclxuICAgICAgICAgICdQYXlsb2FkLiQnOiAnJC5QYXlsb2FkJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBUYXNrOiBDaGVjayBUYXNrc1xyXG4gICAgY29uc3QgY2hlY2tUYXNrc1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdDaGVja1Rhc2tzJywge1xyXG4gICAgICBsYW1iZGFGdW5jdGlvbjogY2hlY2tUYXNrc0ZuLFxyXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21Kc29uUGF0aEF0KCckJyksXHJcbiAgICAgIHJlc3VsdFBhdGg6ICckLmNoZWNrUmVzdWx0JyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFdhaXQgYmV0d2VlbiB0YXNrIHN0YXR1cyBjaGVja3NcclxuICAgIGNvbnN0IHdhaXRUYXNrID0gbmV3IHNmbi5XYWl0KHRoaXMsICdXYWl0Jywge1xyXG4gICAgICB0aW1lOiBzZm4uV2FpdFRpbWUuZHVyYXRpb24oY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLnN0ZXBGdW5jdGlvbnMud2FpdEJldHdlZW5DaGVja3MpKSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFRhc2s6IE1lcmdlIFJlc3VsdHNcclxuICAgIGNvbnN0IG1lcmdlUmVzdWx0c1Rhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdNZXJnZVJlc3VsdHMnLCB7XHJcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBtZXJnZVJlc3VsdHNGbixcclxuICAgICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcclxuICAgICAgICAndGFza3MuJCc6ICckLnRhc2tzUmVzdWx0LlBheWxvYWQudGFza3MnLFxyXG4gICAgICAgICdydW5JZC4kJzogJyQucnVuSWQnLFxyXG4gICAgICB9KSxcclxuICAgICAgcmVzdWx0UGF0aDogJyQubWVyZ2VSZXN1bHQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3VjY2VzcyBzdGF0ZVxyXG4gICAgY29uc3Qgc3VjY2Vzc1N0YXRlID0gbmV3IHNmbi5TdWNjZWVkKHRoaXMsICdTdWNjZXNzJyk7XHJcblxyXG4gICAgLy8gQ2hvaWNlOiBDaGVjayBpZiB0YXNrcyBhcmUgZG9uZVxyXG4gICAgY29uc3QgdGFza3NEb25lQ2hvaWNlID0gbmV3IHNmbi5DaG9pY2UodGhpcywgJ1Rhc2tzRG9uZT8nKVxyXG4gICAgICAud2hlbihcclxuICAgICAgICBzZm4uQ29uZGl0aW9uLmJvb2xlYW5FcXVhbHMoJyQuY2hlY2tSZXN1bHQuUGF5bG9hZC5hbGxUYXNrc0NvbXBsZXRlJywgdHJ1ZSksXHJcbiAgICAgICAgbWVyZ2VSZXN1bHRzVGFza1xyXG4gICAgICApXHJcbiAgICAgIC53aGVuKFxyXG4gICAgICAgIHNmbi5Db25kaXRpb24uYm9vbGVhbkVxdWFscygnJC5jaGVja1Jlc3VsdC5QYXlsb2FkLmFueVRhc2tzRmFpbGVkJywgdHJ1ZSksXHJcbiAgICAgICAgbmV3IHNmbi5GYWlsKHRoaXMsICdUYXNrc0ZhaWxlZCcsIHtcclxuICAgICAgICAgIGNhdXNlOiAnT25lIG9yIG1vcmUgRUNTIHRhc2tzIGZhaWxlZCcsXHJcbiAgICAgICAgICBlcnJvcjogJ0Vjc1Rhc2tzRmFpbHVyZScsXHJcbiAgICAgICAgfSlcclxuICAgICAgKVxyXG4gICAgICAub3RoZXJ3aXNlKHdhaXRUYXNrKTtcclxuXHJcbiAgICAvLyBDb25uZWN0IHN0YXRlc1xyXG4gICAgd2FpdFRhc2submV4dChjaGVja1Rhc2tzVGFzayk7XHJcbiAgICBjaGVja1Rhc2tzVGFzay5uZXh0KHRhc2tzRG9uZUNob2ljZSk7XHJcbiAgICBtZXJnZVJlc3VsdHNUYXNrLm5leHQoc3VjY2Vzc1N0YXRlKTtcclxuXHJcbiAgICAvLyBEZWZpbmUgd29ya2Zsb3dcclxuICAgIGNvbnN0IGRlZmluaXRpb24gPSByZWFkQ29uZmlnVGFza1xyXG4gICAgICAubmV4dChmaWx0ZXJUZXN0c1Rhc2spXHJcbiAgICAgIC5uZXh0KHBhcnNlSm14VGFzaylcclxuICAgICAgLm5leHQodHJhbnNmb3JtUGFyc2VkVGVzdHMpXHJcbiAgICAgIC5uZXh0KHBhcnRpdGlvbkRhdGFUYXNrKVxyXG4gICAgICAubmV4dChzdWJtaXRUYXNrc1Rhc2spXHJcbiAgICAgIC5uZXh0KHdhaXRGb3JSZWFkeVRhc2spICAvLyBTeW5jaHJvbml6ZSBjb250YWluZXJzIGJlZm9yZSBzdGFydGluZyB0ZXN0XHJcbiAgICAgIC5uZXh0KGNoZWNrVGFza3NUYXNrKTtcclxuXHJcbiAgICAvLyBDcmVhdGUgU3RhdGUgTWFjaGluZVxyXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ1N0YXRlTWFjaGluZScsIHtcclxuICAgICAgc3RhdGVNYWNoaW5lTmFtZTogJ2ptZXRlci1lY3Mtd29ya2Zsb3cnLFxyXG4gICAgICBkZWZpbml0aW9uQm9keTogc2ZuLkRlZmluaXRpb25Cb2R5LmZyb21DaGFpbmFibGUoZGVmaW5pdGlvbiksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKGNvbmZpZy5zdGVwRnVuY3Rpb25zLnRpbWVvdXRNaW51dGVzKSxcclxuICAgICAgdHJhY2luZ0VuYWJsZWQ6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcclxuICAgIC8vIE9VVFBVVFNcclxuICAgIC8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogY29uZmlnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciB0ZXN0IHNjcmlwdHMgYW5kIGRhdGEnLFxyXG4gICAgICBleHBvcnROYW1lOiAnSk1ldGVyRWNzLUNvbmZpZ0J1Y2tldCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmVzdWx0c0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiByZXN1bHRzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciB0ZXN0IHJlc3VsdHMnLFxyXG4gICAgICBleHBvcnROYW1lOiAnSk1ldGVyRWNzLVJlc3VsdHNCdWNrZXQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlcG9zaXRvcnlVcmknLCB7XHJcbiAgICAgIHZhbHVlOiByZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNSIHJlcG9zaXRvcnkgVVJJIGZvciBKTWV0ZXIgRG9ja2VyIGltYWdlJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckVjcy1SZXBvc2l0b3J5VXJpJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0ZU1hY2hpbmVBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgQVJOICh1c2UgaW4gR2l0SHViIEFjdGlvbnMpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckVjcy1TdGF0ZU1hY2hpbmVBcm4nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Vjc0NsdXN0ZXJOYW1lJywge1xyXG4gICAgICB2YWx1ZTogY2x1c3Rlci5jbHVzdGVyTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdFQ1MgY2x1c3RlciBuYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckVjcy1DbHVzdGVyTmFtZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVGFza0RlZmluaXRpb25Bcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBhcGlUYXNrRGVmaW5pdGlvbi50YXNrRGVmaW5pdGlvbkFybixcclxuICAgICAgZGVzY3JpcHRpb246ICdFQ1MgQVBJIHRhc2sgZGVmaW5pdGlvbiBBUk4gKDIgdkNQVSAvIDQgR0IpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckVjcy1BcGlUYXNrRGVmaW5pdGlvbkFybicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQnJvd3NlclRhc2tEZWZpbml0aW9uQXJuJywge1xyXG4gICAgICB2YWx1ZTogYnJvd3NlclRhc2tEZWZpbml0aW9uLnRhc2tEZWZpbml0aW9uQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUyBCcm93c2VyIHRhc2sgZGVmaW5pdGlvbiBBUk4gKDQgdkNQVSAvIDggR0IpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pNZXRlckVjcy1Ccm93c2VyVGFza0RlZmluaXRpb25Bcm4nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZhbGlkYXRpb25Ub3BpY0FybicsIHtcclxuICAgICAgdmFsdWU6IHZhbGlkYXRpb25Ub3BpYy50b3BpY0FybixcclxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgdG9waWMgZm9yIHRlc3Qgc2NyaXB0IHZhbGlkYXRpb24gbm90aWZpY2F0aW9ucycsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdKTWV0ZXJFY3MtVmFsaWRhdGlvblRvcGljQXJuJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWYWxpZGF0b3JGdW5jdGlvbk5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB2YWxpZGF0ZVRlc3RTY3JpcHRGbi5mdW5jdGlvbk5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIHRoYXQgdmFsaWRhdGVzIHRlc3Qgc2NyaXB0cycsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdKTWV0ZXJFY3MtVmFsaWRhdG9yRnVuY3Rpb25OYW1lJyxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=