#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const jmeter_stack_1 = require("../lib/jmeter-stack");
const app = new cdk.App();
new jmeter_stack_1.JMeterBatchStack(app, 'JMeterBatchStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsc0RBQXVEO0FBRXZELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLElBQUksK0JBQWdCLENBQUMsR0FBRyxFQUFFLGtCQUFrQixFQUFFO0lBQzVDLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBQ0QsV0FBVyxFQUFFLGlGQUFpRjtJQUM5RixJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsd0JBQXdCO1FBQ2pDLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLFVBQVUsRUFBRSxxQkFBcUI7S0FDbEM7Q0FDRixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXHJcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcclxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgSk1ldGVyQmF0Y2hTdGFjayB9IGZyb20gJy4uL2xpYi9qbWV0ZXItc3RhY2snO1xyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxuXHJcbm5ldyBKTWV0ZXJCYXRjaFN0YWNrKGFwcCwgJ0pNZXRlckJhdGNoU3RhY2snLCB7XHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXHJcbiAgfSxcclxuICBkZXNjcmlwdGlvbjogJ01vZGVybiBKTWV0ZXIgcGVyZm9ybWFuY2UgdGVzdGluZyB3aXRoIEFXUyBCYXRjaCAtIG9wdGltaXplZCBmb3IgY29zdCBhbmQgc3BlZWQnLFxyXG4gIHRhZ3M6IHtcclxuICAgIFByb2plY3Q6ICdqbWV0ZXItYmF0Y2gtZnJhbWV3b3JrJyxcclxuICAgIE1hbmFnZWRCeTogJ0NESycsXHJcbiAgICBDb3N0Q2VudGVyOiAncGVyZm9ybWFuY2UtdGVzdGluZycsXHJcbiAgfSxcclxufSk7XHJcblxyXG5hcHAuc3ludGgoKTsiXX0=