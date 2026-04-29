const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const sns = new AWS.SNS();

class TestScriptValidator {
  constructor(content, filename) {
    this.content = content;
    this.filename = filename;
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    this.checkSecurity();
    this.checkThinkTimes();
    this.checkNaming();
    this.checkStructure();
    return this.errors.length === 0;
  }

  checkSecurity() {
    // Check for hardcoded credentials
    if (/password\s*[:=]\s*['"][^'"]+['"]/.test(this.content)) {
      this.errors.push('❌ SECURITY: Hardcoded credentials detected');
      this.errors.push('   Use environment variables or AWS Secrets Manager instead');
    }

    // Check for sensitive data in logs
    if (/console\.log.*(?:password|token|key|secret|credential)/i.test(this.content)) {
      this.errors.push('❌ SECURITY: Logging sensitive data detected');
      this.errors.push('   Remove console.log statements containing passwords, tokens, keys, or secrets');
    }

    // Check for API keys in plain text
    if (/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(this.content)) {
      this.errors.push('❌ SECURITY: API key in plain text detected');
      this.errors.push('   Use environment variables or AWS Secrets Manager');
    }
  }

  checkThinkTimes() {
    const actions = (this.content.match(/await timedAction\(/g) || []).length;
    const waits = (this.content.match(/waitForTimeout\(/g) || []).length;
    
    if (actions > 3 && waits < actions - 1) {
      this.errors.push('❌ PERFORMANCE: Missing think times between actions');
      this.errors.push(`   Found ${actions} actions but only ${waits} think times`);
      this.errors.push('   Add waitForTimeout() between user actions to simulate realistic behavior');
    }

    // Check think time values
    const timeMatches = this.content.matchAll(/waitForTimeout\((\d+)\)/g);
    for (const match of timeMatches) {
      const ms = parseInt(match[1]);
      if (ms < 500) {
        this.errors.push(`❌ PERFORMANCE: Think time too short: ${ms}ms (minimum 500ms recommended)`);
        this.errors.push('   Realistic user interactions need at least 500ms between actions');
      }
      if (ms > 30000) {
        this.warnings.push(`⚠️  PERFORMANCE: Think time very long: ${ms}ms (${ms/1000}s)`);
        this.warnings.push('   Consider if this wait time is necessary');
      }
    }
  }

  checkNaming() {
    // Check transaction naming convention: Step_XXX_Module_Action
    const txnPattern = /timedAction\([^,]+,\s*['"]([^'"]+)['"]/g;
    const transactions = [...this.content.matchAll(txnPattern)];
    
    if (transactions.length === 0) {
      this.warnings.push('⚠️  No timedAction transactions found');
      this.warnings.push('   Consider using timedAction() to track performance metrics');
    }

    transactions.forEach(match => {
      const name = match[1];
      // Expected format: Step_001_Module_Action
      if (!name.match(/^Step_\d{3}_[A-Z][a-zA-Z]+_[A-Z][a-zA-Z_]+$/)) {
        this.errors.push(`❌ NAMING: Invalid transaction name: "${name}"`);
        this.errors.push('   Expected format: Step_001_Module_Action');
        this.errors.push('   Example: Step_001_Login_EnterCredentials');
      }
    });

    // Check for duplicate transaction names
    const txnNames = transactions.map(m => m[1]);
    const duplicates = txnNames.filter((name, index) => txnNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      this.errors.push(`❌ NAMING: Duplicate transaction names found: ${[...new Set(duplicates)].join(', ')}`);
      this.errors.push('   Each transaction must have a unique name');
    }
  }

  checkStructure() {
    // Must use framework imports
    if (!this.content.includes("require('../lib/test-runner')") && 
        !this.content.includes('require("../lib/test-runner")')) {
      this.errors.push('❌ STRUCTURE: Missing test-runner import');
      this.errors.push("   Add: const { runParallelTest, timedAction } = require('../lib/test-runner');");
    }

    // Must have runUser function
    if (!this.content.includes('async function runUser')) {
      this.errors.push('❌ STRUCTURE: Missing runUser function');
      this.errors.push('   Required: async function runUser(userId, iteration) { ... }');
    }

    // Must use runParallelTest
    if (!this.content.includes('runParallelTest')) {
      this.errors.push('❌ STRUCTURE: Must use runParallelTest() to execute tests');
      this.errors.push('   Add: await runParallelTest(config, runUser);');
    }

    // Check for basic error handling
    if (!this.content.includes('try') && !this.content.includes('catch')) {
      this.warnings.push('⚠️  BEST PRACTICE: No error handling detected');
      this.warnings.push('   Consider adding try/catch blocks for better error reporting');
    }

    // Check for page.click without timedAction
    if (this.content.includes('page.click') && !this.content.includes('timedAction')) {
      this.errors.push('❌ STRUCTURE: Direct page.click() detected');
      this.errors.push('   Use timedAction() wrapper for all page interactions to track performance');
    }

    // Check for page.goto without timedAction
    const gotoMatches = this.content.match(/page\.goto\(/g);
    if (gotoMatches && gotoMatches.length > 0) {
      const timedGotoMatches = this.content.match(/timedAction\([^,]+,\s*['"].*goto.*['"]/gi);
      if (!timedGotoMatches || timedGotoMatches.length < gotoMatches.length) {
        this.warnings.push('⚠️  Consider wrapping page.goto() in timedAction() to track page load times');
      }
    }
  }

  getReport() {
    let report = `\n${'='.repeat(70)}\n`;
    report += `Validation Report: ${this.filename}\n`;
    report += '='.repeat(70) + '\n\n';
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      report += '✅ ALL CHECKS PASSED!\n\n';
      report += 'Your test script meets all quality standards.\n';
      report += 'Script is approved and ready for use.\n';
    } else {
      if (this.errors.length > 0) {
        report += '❌ ERRORS (Must Fix Before Upload):\n';
        report += '-'.repeat(70) + '\n';
        this.errors.forEach((e, i) => {
          if (i > 0 && !e.startsWith('   ')) report += '\n';
          report += `${e}\n`;
        });
        report += '\n';
      }
      
      if (this.warnings.length > 0) {
        report += '⚠️  WARNINGS (Recommended to Fix):\n';
        report += '-'.repeat(70) + '\n';
        this.warnings.forEach((w, i) => {
          if (i > 0 && !w.startsWith('   ')) report += '\n';
          report += `${w}\n`;
        });
        report += '\n';
      }
    }
    
    report += '='.repeat(70) + '\n';
    
    if (this.errors.length > 0) {
      report += '\n📖 GUIDELINES:\n';
      report += '  - Use timedAction() for all page interactions\n';
      report += '  - Include waitForTimeout() between actions (min 500ms)\n';
      report += '  - Follow naming: Step_001_Module_Action\n';
      report += '  - No hardcoded credentials (use environment variables)\n';
      report += '  - Import test-runner framework\n';
      report += '  - Implement runUser(userId, iteration) function\n';
      report += '\n📧 Contact: test-framework-team@company.com\n';
    }
    
    return report;
  }

  getSummary() {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      return '✅ All validation checks passed';
    }
    return `${this.errors.length} error(s), ${this.warnings.length} warning(s)`;
  }
}

exports.handler = async (event) => {
  console.log('='.repeat(70));
  console.log('Test Script Validator - S3 Event Triggered');
  console.log('='.repeat(70));
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const eventName = record.eventName;
  
  console.log(`\nEvent Type: ${eventName}`);
  console.log(`File: s3://${bucket}/${key}`);
  
  // Skip validation for certain files
  if (key.includes('/lib/') || key.endsWith('.json') || key.endsWith('.jmx')) {
    console.log('Skipping validation - not a JavaScript test script');
    return { statusCode: 200, body: 'Skipped - not a test script' };
  }
  
  try {
    console.log('\n📥 Downloading script from S3...');
    const obj = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const content = obj.Body.toString('utf-8');
    
    console.log(`Script size: ${content.length} bytes`);
    
    // Validate
    console.log('\n🔍 Running validation checks...');
    const validator = new TestScriptValidator(content, key.split('/').pop());
    const isValid = validator.validate();
    
    const report = validator.getReport();
    console.log(report);
    
    if (!isValid) {
      console.log('\n❌ VALIDATION FAILED - Deleting invalid script...');
      
      // Delete invalid script
      await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
      console.log('✅ Invalid script deleted from S3');
      
      // Send notification
      const message = `
🚫 TEST SCRIPT REJECTED - VALIDATION FAILED

File: ${key}
Bucket: ${bucket}
Action: File has been deleted from S3
Uploader: Check CloudWatch logs for details

${report}

NEXT STEPS:
1. Fix the validation errors listed above
2. Re-upload the corrected script to S3
3. Wait for validation confirmation email

Need help? Contact: test-framework-team@company.com
`;
      
      try {
        await sns.publish({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Subject: `🚫 Test Script REJECTED: ${key.split('/').pop()}`,
          Message: message
        }).promise();
        console.log('📧 Rejection notification sent');
      } catch (snsError) {
        console.error('Failed to send SNS notification:', snsError);
        // Don't fail the Lambda if SNS fails
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: 'rejected',
          file: key,
          errors: validator.errors,
          warnings: validator.warnings
        })
      };
    }
    
    // Validation passed
    console.log('\n✅ VALIDATION PASSED - Tagging script...');
    
    // Tag as validated
    await s3.putObjectTagging({
      Bucket: bucket,
      Key: key,
      Tagging: {
        TagSet: [
          { Key: 'validated', Value: 'true' },
          { Key: 'validated-at', Value: new Date().toISOString() },
          { Key: 'validator-version', Value: '1.0' }
        ]
      }
    }).promise();
    console.log('✅ Script tagged as validated');
    
    // Send success notification
    const successMessage = `
✅ TEST SCRIPT APPROVED

File: ${key}
Status: Passed all validation checks
Ready for use: Yes
Validated at: ${new Date().toISOString()}

${report}

Your test script is now ready to run in the framework!

Questions? Contact: test-framework-team@company.com
`;
    
    try {
      await sns.publish({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: `✅ Test Script APPROVED: ${key.split('/').pop()}`,
        Message: successMessage
      }).promise();
      console.log('📧 Approval notification sent');
    } catch (snsError) {
      console.error('Failed to send SNS notification:', snsError);
      // Don't fail the Lambda if SNS fails
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('Validation complete - Script approved');
    console.log('='.repeat(70));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'approved',
        file: key,
        summary: validator.getSummary()
      })
    };
    
  } catch (error) {
    console.error('\n❌ ERROR during validation:', error);
    
    // Send error notification
    try {
      await sns.publish({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: `⚠️ Test Script Validation ERROR: ${key.split('/').pop()}`,
        Message: `
⚠️ ERROR during validation

File: ${key}
Error: ${error.message}

The validation process encountered an error. The script has NOT been deleted.
Please check CloudWatch logs and contact the framework team.

Contact: test-framework-team@company.com
`
      }).promise();
    } catch (snsError) {
      console.error('Failed to send error notification:', snsError);
    }
    
    throw error;
  }
};