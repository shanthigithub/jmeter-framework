#!/usr/bin/env node

/**
 * JavaScript Playwright Test Template for JMeter Batch Framework
 * 
 * ✅ k6-Compatible API! Easy migration to k6's browser module later!
 * ✅ Writes results in JTL format compatible with merge-results Lambda
 * 
 * Usage:
 *   This script is automatically invoked by the framework when a .js test is detected.
 *   Environment variables are set by entrypoint.sh:
 *     - RESULTS_BUCKET: S3 bucket for results
 *     - CONTAINER_ID: Container identifier
 *     - RUN_ID: Test run identifier
 *     - TEST_ID: Test identifier
 *     - RESULTS_PREFIX: S3 prefix for results
 */

const { chromium } = require('playwright');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Get environment variables (set by entrypoint.sh)
const RESULTS_BUCKET = process.env.RESULTS_BUCKET || '';
const CONTAINER_ID = process.env.CONTAINER_ID || '0';
const RUN_ID = process.env.RUN_ID || 'unknown';
const TEST_ID = process.env.TEST_ID || 'unknown';
const RESULTS_PREFIX = process.env.RESULTS_PREFIX || 'results';

// Results file path (must match what merge-results expects)
const RESULTS_FILE = `/tmp/results-${CONTAINER_ID}.jtl`;

console.log('========================================');
console.log('JavaScript Playwright Test Execution (k6-ready!)');
console.log('========================================');
console.log(`Test ID: ${TEST_ID}`);
console.log(`Run ID: ${RUN_ID}`);
console.log(`Container ID: ${CONTAINER_ID}`);
console.log(`Results File: ${RESULTS_FILE}`);
console.log('========================================\n');

/**
 * Write a single result record in JMeter JTL CSV format
 * This format is compatible with merge-results Lambda and JMeter's standard output
 */
function writeJTLRecord(stream, label, elapsedMs, success, responseCode = 200, url = '', errorMsg = '') {
    const record = [
        Date.now(),                                    // timeStamp (ms since epoch)
        Math.round(elapsedMs),                        // elapsed (duration in ms)
        label,                                         // label (step/transaction name)
        responseCode,                                  // responseCode (HTTP status)
        success ? 'OK' : (errorMsg || 'FAILED'),      // responseMessage
        `Playwright-JS-${CONTAINER_ID}`,             // threadName (virtual user ID)
        'text',                                        // dataType
        success ? 'true' : 'false',                   // success (pass/fail)
        0,                                             // bytes (response size)
        url                                            // URL
    ].join(',');
    
    stream.write(record + '\n');
}

/**
 * Example Playwright test - Replace this with your actual test logic
 * 
 * This example demonstrates:
 * - Navigation
 * - Form filling
 * - Button clicking
 * - Element waiting
 * - Error handling
 * - JTL result writing
 * 
 * NOTE: This API is very similar to k6's browser module!
 * Migration to k6 later = minimal code changes!
 */
async function runExampleTest() {
    // Create JTL file with CSV header
    const stream = fs.createWriteStream(RESULTS_FILE);
    stream.write('timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,bytes,URL\n');
    
    // Launch browser (headless mode for container execution)
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer'
        ]
    });
    
    const page = await browser.newPage();
    
    try {
        // ===== Step 1: Navigate to Application =====
        const stepName = '01_Navigate_Homepage';
        console.log(`[STEP] ${stepName}`);
        const start1 = Date.now();
        
        try {
            const response = await page.goto('https://example.com', { 
                waitUntil: 'domcontentloaded' 
            });
            const elapsed1 = Date.now() - start1;
            
            writeJTLRecord(
                stream, stepName, elapsed1,
                response.ok(), response.status(), response.url()
            );
            console.log(`  ✅ Navigated to homepage (${Math.round(elapsed1)}ms)`);
            
        } catch (error) {
            const elapsed1 = Date.now() - start1;
            writeJTLRecord(
                stream, stepName, elapsed1,
                false, 500, 'https://example.com', error.message
            );
            console.log(`  ❌ Navigation failed: ${error.message}`);
            throw error;
        }
        
        // ===== Step 2: Click "More information" Link =====
        const stepName2 = '02_Click_More_Info';
        console.log(`[STEP] ${stepName2}`);
        const start2 = Date.now();
        
        try {
            await page.click('a:has-text("More information")', { timeout: 5000 });
            await page.waitForLoadState('networkidle');
            const elapsed2 = Date.now() - start2;
            
            writeJTLRecord(
                stream, stepName2, elapsed2,
                true, 200, page.url()
            );
            console.log(`  ✅ Clicked link (${Math.round(elapsed2)}ms)`);
            
        } catch (error) {
            const elapsed2 = Date.now() - start2;
            writeJTLRecord(
                stream, stepName2, elapsed2,
                false, 500, page.url(), error.message
            );
            console.log(`  ❌ Click failed: ${error.message}`);
            throw error;
        }
        
        // ===== Step 3: Verify Page Content =====
        const stepName3 = '03_Verify_Content';
        console.log(`[STEP] ${stepName3}`);
        const start3 = Date.now();
        
        try {
            const content = await page.content();
            const expectedText = 'Example Domain';
            
            if (content.includes(expectedText)) {
                const elapsed3 = Date.now() - start3;
                writeJTLRecord(
                    stream, stepName3, elapsed3,
                    true, 200, page.url()
                );
                console.log(`  ✅ Content verified (${Math.round(elapsed3)}ms)`);
            } else {
                const elapsed3 = Date.now() - start3;
                const errorMsg = `Expected text "${expectedText}" not found`;
                writeJTLRecord(
                    stream, stepName3, elapsed3,
                    false, 500, page.url(), errorMsg
                );
                console.log(`  ❌ Content verification failed`);
                throw new Error(errorMsg);
            }
            
        } catch (error) {
            const elapsed3 = Date.now() - start3;
            writeJTLRecord(
                stream, stepName3, elapsed3,
                false, 500, page.url(), error.message
            );
            console.log(`  ❌ Verification failed: ${error.message}`);
            throw error;
        }
        
        console.log('\n✅ Test completed successfully');
        return 0;
        
    } catch (error) {
        console.log(`\n❌ Test failed: ${error.message}`);
        return 1;
        
    } finally {
        await browser.close();
        stream.end();
    }
}

/**
 * Upload results file to S3 (same location as JMeter results)
 * Note: Upload is also handled by entrypoint.sh, this is optional
 */
async function uploadResultsToS3() {
    if (!RESULTS_BUCKET) {
        console.log('⚠️  RESULTS_BUCKET not set, skipping S3 upload');
        return;
    }
    
    if (!fs.existsSync(RESULTS_FILE)) {
        console.log(`⚠️  Results file not found: ${RESULTS_FILE}`);
        return;
    }
    
    try {
        const s3 = new S3Client({});
        const s3Key = `${RESULTS_PREFIX}/container-${CONTAINER_ID}/results-${CONTAINER_ID}.jtl`;
        
        console.log('\n[UPLOAD] Uploading results to S3...');
        console.log(`  Bucket: ${RESULTS_BUCKET}`);
        console.log(`  Key: ${s3Key}`);
        
        const fileContent = fs.readFileSync(RESULTS_FILE);
        
        await s3.send(new PutObjectCommand({
            Bucket: RESULTS_BUCKET,
            Key: s3Key,
            Body: fileContent
        }));
        
        console.log(`✅ Results uploaded: s3://${RESULTS_BUCKET}/${s3Key}`);
        
    } catch (error) {
        console.log(`❌ Failed to upload results: ${error.message}`);
    }
}

/**
 * Main execution
 */
(async () => {
    console.log('🚀 Starting JavaScript Playwright test execution\n');
    
    // Run the test
    const exitCode = await runExampleTest();
    
    // Results are written to file during test execution
    console.log(`\n📊 Results written to: ${RESULTS_FILE}`);
    
    // Show result summary
    if (fs.existsSync(RESULTS_FILE)) {
        const content = fs.readFileSync(RESULTS_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        const total = lines.length - 1; // Subtract header
        
        console.log(`📊 Total steps executed: ${total}`);
        
        if (total > 0) {
            const successes = lines.slice(1).filter(line => line.includes(',true,')).length;
            const failures = total - successes;
            console.log(`   ✅ Passed: ${successes}`);
            console.log(`   ❌ Failed: ${failures}`);
        }
    }
    
    // Upload is handled by entrypoint.sh, but we can also do it here if needed
    // await uploadResultsToS3();
    
    console.log(`\n[EXIT] Test exiting with code: ${exitCode}`);
    process.exit(exitCode);
})();