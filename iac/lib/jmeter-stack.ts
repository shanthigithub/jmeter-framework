import * as cdk from 'aws-cdk-lib';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { config } from '../environments/config';
import * as path from 'path';
import { JmxParserLambda } from './constructs/jmx-parser-lambda';

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
export class JMeterBatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ═══════════════════════════════════════════════════════════════════════
    // S3 BUCKETS
    // ═══════════════════════════════════════════════════════════════════════

    const configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: config.configBucket,
      versioned: true,
      encryption: config.security.enableEncryption 
        ? s3.BucketEncryption.S3_MANAGED 
        : s3.BucketEncryption.UNENCRYPTED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Don't delete test scripts on stack deletion
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
      bucketName: config.resultsBucket,
      encryption: config.security.enableEncryption 
        ? s3.BucketEncryption.S3_MANAGED 
        : s3.BucketEncryption.UNENCRYPTED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Don't delete results on stack deletion
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        expiration: cdk.Duration.days(90),  // Auto-delete after 90 days
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30),  // Move to IA after 30 days
        }],
      }],
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ECR REPOSITORY
    // ═══════════════════════════════════════════════════════════════════════

    const repository = new ecr.Repository(this, 'JMeterRepository', {
      repositoryName: config.ecrRepoName,
      imageScanOnPush: true,  // Security: Scan images for vulnerabilities
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Keep images on stack deletion
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
      allowAllOutbound: true,  // Allow internet access for downloading from S3
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
      actions: ['batch:SubmitJob'],
      resources: ['*'],  // Will be scoped to job definition after creation
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
        instanceType: config.batch.compute.instanceTypes[0],
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
          userData.addCommands(
            '#!/bin/bash',
            'echo ECS_CLUSTER=${ECS_CLUSTER} >> /etc/ecs/ecs.config',
            'echo ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config',
          );
          return userData.render();
        })()),
      },
    });

    // Compute environment using Spot instances
    const computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
      type: 'MANAGED',
      computeEnvironmentName: 'jmeter-batch-spot',
      serviceRole: batchServiceRole.roleArn,
      computeResources: {
        type: config.batch.compute.type,
        minvCpus: config.batch.compute.minvCpus,
        maxvCpus: config.batch.compute.maxvCpus,
        desiredvCpus: config.batch.compute.desiredvCpus,
        instanceTypes: config.batch.compute.instanceTypes,
        subnets: vpc.publicSubnets.map(subnet => subnet.subnetId),
        securityGroupIds: [batchSecurityGroup.securityGroupId],
        instanceRole: instanceProfile.attrArn,
        spotIamFleetRole: config.batch.compute.type === 'SPOT' 
          ? new iam.Role(this, 'SpotFleetRole', {
              assumedBy: new iam.ServicePrincipal('spotfleet.amazonaws.com'),
              managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2SpotFleetTaggingRole'),
              ],
            }).roleArn
          : undefined,
        bidPercentage: config.batch.compute.spotBidPercentage,
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
      retention: config.logs.retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: 'jmeter-batch-job',
      type: 'container',
      platformCapabilities: ['EC2'],  // Not Fargate (too expensive)
      retryStrategy: {
        attempts: config.batch.job.retryAttempts,
        evaluateOnExit: [
          {
            action: 'RETRY',
            onStatusReason: 'Host EC2*',  // Retry on spot interruption
          },
          {
            action: 'EXIT',
            onReason: '*',  // Don't retry other failures (likely test errors)
          },
        ],
      },
      timeout: {
        attemptDurationSeconds: config.batch.job.timeoutMinutes * 60,
      },
      containerProperties: {
        image: `${repository.repositoryUri}:latest`,
        vcpus: config.batch.job.vcpus,
        memory: config.batch.job.memoryMiB,
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
          { name: 'CONFIG_BUCKET', value: config.configBucket },
          { name: 'RESULTS_BUCKET', value: config.resultsBucket },
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
      memorySize: config.lambda.memoryMB,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds.readConfig),
      environment: {
        CONFIG_BUCKET: config.configBucket,
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
      memorySize: config.lambda.memoryMB,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds.partitionData),
      environment: {
        CONFIG_BUCKET: config.configBucket,
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
      memorySize: config.lambda.memoryMB,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds.submitJobs),
      environment: {
        JOB_QUEUE: jobQueue.ref,
        JOB_DEFINITION: jobDefinition.ref,
        CONFIG_BUCKET: config.configBucket,
        RESULTS_BUCKET: config.resultsBucket,
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
      memorySize: config.lambda.memoryMB,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds.checkJobs),
    });

    // 5. Merge Results - aggregates results from all jobs
    const mergeResultsFn = new lambda.Function(this, 'MergeResultsFn', {
      functionName: 'jmeter-batch-merge-results',
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'merge-results')),
      role: lambdaRole,
      memorySize: config.lambda.memoryMB,
      timeout: cdk.Duration.seconds(config.lambda.timeoutSeconds.mergeResults),
      environment: {
        RESULTS_BUCKET: config.resultsBucket,
      },
    });

    // 6. JMX Parser - automatically extracts test configuration from JMX files
    const jmxParser = new JmxParserLambda(this, 'JmxParser', {
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

    // Task: Check Jobs
    const checkJobsTask = new tasks.LambdaInvoke(this, 'CheckJobs', {
      lambdaFunction: checkJobsFn,
      payload: sfn.TaskInput.fromJsonPathAt('$'),
      resultPath: '$.checkResult',
    });

    // Wait between job status checks
    const waitTask = new sfn.Wait(this, 'Wait', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(config.stepFunctions.waitBetweenChecks)),
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
      .when(
        sfn.Condition.booleanEquals('$.checkResult.Payload.allJobsComplete', true),
        mergeResultsTask
      )
      .when(
        sfn.Condition.booleanEquals('$.checkResult.Payload.anyJobsFailed', true),
        new sfn.Fail(this, 'JobsFailed', {
          cause: 'One or more Batch jobs failed',
          error: 'BatchJobsFailure',
        })
      )
      .otherwise(waitTask);

    // Connect states
    waitTask.next(checkJobsTask);
    checkJobsTask.next(jobsDoneChoice);
    mergeResultsTask.next(successState);

    // Define workflow - start from readConfig and go to checkJobs
    // (checkJobsTask already connected to jobsDoneChoice above)
    const definition = readConfigTask
      .next(filterTestsTask)
      .next(partitionDataTask)
      .next(submitJobsTask)
      .next(checkJobsTask);

    // Create State Machine
    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: 'jmeter-batch-workflow',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(config.stepFunctions.timeoutMinutes),
      tracingEnabled: true,  // Enable X-Ray tracing
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
