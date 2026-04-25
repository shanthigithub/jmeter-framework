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
exports.JmxParserLambda = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
class JmxParserLambda extends constructs_1.Construct {
    constructor(scope, id, props) {
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
        this.function.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        }));
        // Output the function ARN
        new cdk.CfnOutput(this, 'JmxParserFunctionArn', {
            value: this.function.functionArn,
            description: 'ARN of the JMX Parser Lambda function',
            exportName: 'JmxParserFunctionArn',
        });
    }
}
exports.JmxParserLambda = JmxParserLambda;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam14LXBhcnNlci1sYW1iZGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJqbXgtcGFyc2VyLWxhbWJkYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUUzQywyQ0FBdUM7QUFNdkMsTUFBYSxlQUFnQixTQUFRLHNCQUFTO0lBRzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzdELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLHNCQUFzQjtZQUMvQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUM7WUFDaEQsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLFdBQVcsRUFBRSw4REFBOEQ7WUFDM0UsV0FBVyxFQUFFO2dCQUNYLGFBQWEsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLFVBQVU7YUFDN0M7WUFDRCxZQUFZLEVBQUUsQ0FBQyxFQUFFLHVCQUF1QjtTQUN6QyxDQUFDLENBQUM7UUFFSCw0QkFBNEI7UUFDNUIsS0FBSyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTVDLHlDQUF5QztRQUN6QyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FDM0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHFCQUFxQjtnQkFDckIsc0JBQXNCO2dCQUN0QixtQkFBbUI7YUFDcEI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUNILENBQUM7UUFFRiwwQkFBMEI7UUFDMUIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ2hDLFdBQVcsRUFBRSx1Q0FBdUM7WUFDcEQsVUFBVSxFQUFFLHNCQUFzQjtTQUNuQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEzQ0QsMENBMkNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBKbXhQYXJzZXJMYW1iZGFQcm9wcyB7XHJcbiAgY29uZmlnQnVja2V0OiBzMy5JQnVja2V0O1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgSm14UGFyc2VyTGFtYmRhIGV4dGVuZHMgQ29uc3RydWN0IHtcclxuICBwdWJsaWMgcmVhZG9ubHkgZnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEpteFBhcnNlckxhbWJkYVByb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQpO1xyXG5cclxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25cclxuICAgIHRoaXMuZnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdKbXhQYXJzZXJGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2pteC1wYXJzZXInKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyc2VzIEpNWCBmaWxlcyB0byBleHRyYWN0IHRlc3QgY29uZmlndXJhdGlvbiBhdXRvbWF0aWNhbGx5JyxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBDT05GSUdfQlVDS0VUOiBwcm9wcy5jb25maWdCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgfSxcclxuICAgICAgbG9nUmV0ZW50aW9uOiA3LCAvLyBLZWVwIGxvZ3MgZm9yIDcgZGF5c1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgUzMgcmVhZCBwZXJtaXNzaW9uc1xyXG4gICAgcHJvcHMuY29uZmlnQnVja2V0LmdyYW50UmVhZCh0aGlzLmZ1bmN0aW9uKTtcclxuXHJcbiAgICAvLyBBZGQgaW5saW5lIHBvbGljeSBmb3IgZW5oYW5jZWQgbG9nZ2luZ1xyXG4gICAgdGhpcy5mdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxyXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcclxuICAgICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cycsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBPdXRwdXQgdGhlIGZ1bmN0aW9uIEFSTlxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0pteFBhcnNlckZ1bmN0aW9uQXJuJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5mdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gb2YgdGhlIEpNWCBQYXJzZXIgTGFtYmRhIGZ1bmN0aW9uJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0pteFBhcnNlckZ1bmN0aW9uQXJuJyxcclxuICAgIH0pO1xyXG4gIH1cclxufSJdfQ==