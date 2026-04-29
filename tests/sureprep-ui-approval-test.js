/**
 * Sureprep UI Approval Test - JavaScript Playwright Version (k6-ready!)
 * 
 * Converted from JMeter + Selenium to Playwright for:
 * - Better performance (no JVM overhead)
 * - Easier maintenance (readable JavaScript vs XML/Groovy)
 * - k6 migration path (minimal changes needed later)
 * - Modern browser automation (faster, more reliable)
 * 
 * Test Flow:
 * 1. Salesforce JWT authentication
 * 2. Create Account
 * 3. Create Contact
 * 4. Create Opportunity
 * 5. Create SSD (Sales Support Document)
 * 6. Add Products
 */

const { chromium } = require('playwright');
const crypto = require('crypto');
const https = require('https');

// Configuration - Built-in defaults (can be overridden via env vars)
const config = {
  // Load testing parameters (equivalent to JMeter Thread Group)
  parallelUsers: parseInt(process.env.PARALLEL_USERS || '5'), // Number of concurrent browsers (like Thread Count)
  iterations: parseInt(process.env.ITERATIONS || '3'), // Number of times to run this test (like Loop Count)
  thinkTime: parseInt(process.env.THINK_TIME || '2000'), // Delay between actions in ms (like Think Time)
  
  // Salesforce OAuth settings
  consumerKey: process.env.CONSUMER_KEY || '3MVG9snQZy6aQDh0Mi6xuTbD1.hKJD6MKrlqsV.vYW5ma0Uj.1tzbHhVpWdqimgfxZePCx88IiYfxL.IcDdzG',
  username: process.env.USERNAME || 'rambabu.chitteti@thomsonreuters.com.uat',
  loginUrl: process.env.LOGIN_URL || 'https://test.salesforce.com',
  privateKey: process.env.PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQC9dssBwne5Fgch
sbM4Tn628qgrnm4ATgaPMz5hKP9Sq1TunKT4fXnlFbvAvrpLupiVkM8BN/FfUJ1K
KwTaUniqMGK18jFgxm9BlktCiRuhS2YGBkVSXi8MQgtUWSa8qzttIifPeM9NfCHY
havBlc6ZEqbqx73f0S4cS55TW8E8+X959xa5ViqMzbctyApMGYQNOtEjITtcAfhi
2IsV+t+SToF/WC+/dC7geu9AbQUOXPgOJWXyINmbNiJbm1VPlb7pG0qlScg/iQV9
I9GgtWgS4Bd01lD4QapzQeEYO9H1usfCDAJjgNqAESTySto7B8QFqT/5d1cM9ruJ
JS3dIN1hAgMBAAECgf9rzDMlBShpPodAPILj/oVKQjY82x9rPPmucFGFpnXe62yf
drDGUV4RYZQ5zkrg24IFVybwYowK1ysnD+Lq9RGCg5UmQG6nyT9z6bdYW/pEg0nB
E8BNZRkPuGQJ0c+geSyOo2hTO0F3rLD1KNjYhAvQPDSMUKlPtwytPLkQZJxFvBPZ
Bn5BWP5DDJmO60cQlow1gybpZjN8hFixnVW5Nt9kcqY8mDIeTNAW4CBWDSIFlAdE
jVu+I+Zu/HK7zh0TytDpzgT6qCYTQJgTUt+NFZFgFal8ivVYWC6aSex61HQjuhNd
ip6g7PqOfNSHkJ5SvW+ca/J2V1VvjK0GC9DItsECgYEA7ddVCTCO6DzQBAS7pn/9
UAIZHdGPzrYAK/FClIVEuPq8Rv7RnjZLC797VreN6R1FHumUeHSUy3Tt6KeLWaj0
iEA5haip/7mT5bp4nazk17yOlfkZiB3XuPCY0Q7XI53GZd3JgS/JCnNgizYmRy1H
VOgTQmnWj8YXKGe/fEybqMECgYEAy+3q4wY6xDwItTkprZaheHNhqAcqhL3KSi2o
lj0kDJceJ/Fnp7w/SFeJS5lPpcgwM30SU4PPlIdCAdgWLu/J/VeoKahV9ewD4C/I
POfAUSLOcl05ZNBvRzrC8LKNYvyg54YiWHqnpCRBojfLxu8GAaO9ixWFIDTJ9VDK
bpTOvKECgYAGP9QyK551p7Nnh6BOnapQQd3bFLiMm+ehP/OZ526I1b3At81WNOL/
6gYZnzURXP2F9Gk8SQPn3KirpktZDcFvGxDn3CirWXrzXFTy/6n7qS6t7h+nnfEf
IONDCvrIKssdvhgfVtwXdDSjM8cJs7zeFEL9Sb6jhHbzTtaPM4wbgQKBgAZaoWj1
drtKi5Lp9wx7lwhjv/U2U/LS3wy0o34a5Zam1r+z2+D0Epy0bYi3fC3UMPxJt1p2
zu73z+yyyO4pdoe4RXsWzabd9bj0hC6xoeJlTT1u/izP+cekYxKQ3arp6DGOkl9j
YvnQT2M4jdbi97LxYSSGRSGdw3UrUUNky5RBAoGBAIwawSpDuUfvXXnBOnCjr1Bu
lJWRaeOI0yLCQwidS0LQrgubJALO7ufMukNeD8QEJAoB4+C/n+MfkzJNH6WzSWB1
rGL8dX8V+F4kC+zj3myyKTI5BLyro/2W5y2IDtcCkd8ciOYSW+9n22LoS30CJ+tP
4uBTR2hKrREzxhynsGDM
-----END PRIVATE KEY-----`,
  
  // Test data
  accountName: `TestAccount_${Date.now()}`,
  contactFirstName: 'Test',
  contactLastName: `Contact_${Date.now()}`,
  opportunityName: `TestOpportunity_${Date.now()}`,
  
  // Timeouts
  defaultTimeout: 120000, // 120 seconds (same as JMX)
  navigationTimeout: 240000, // 240 seconds for login
  
  // Datadog tags (for metrics tracking - framework handles automatically)
  datadogTags: {
    testId: 'sureprep-ui-approval',
    testType: 'browser',
    app: 'salesforce',
    environment: 'uat',
    priority: 'high'
  }
};

// Log configuration on startup (helps with debugging)
console.log('📋 Test Configuration:');
console.log(`   Test ID: ${config.datadogTags.testId}`);
console.log(`   Test Type: ${config.datadogTags.testType}`);
console.log(`   App: ${config.datadogTags.app}`);
console.log(`   Environment: ${config.datadogTags.environment}`);
console.log(`   Parallel Users: ${config.parallelUsers}`);
console.log(`   Iterations: ${config.iterations}`);
console.log(`   Think Time: ${config.thinkTime}ms`);

/**
 * Generate JWT for Salesforce OAuth
 */
function generateJWT() {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const claims = {
    iss: config.consumerKey,
    sub: config.username,
    aud: config.loginUrl,
    exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaims}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();

  const signature = sign.sign(config.privateKey, 'base64url');
  
  return `${signatureInput}.${signature}`;
}

/**
 * Get Salesforce access token using JWT
 */
async function getSalesforceAccessToken() {
  return new Promise((resolve, reject) => {
    const jwt = generateJWT();
    const postData = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString();

    const options = {
      hostname: new URL(config.loginUrl).hostname,
      path: '/services/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`OAuth failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Take screenshot helper
 */
async function takeScreenshot(page, name) {
  try {
    await page.screenshot({
      path: `/jmeter/results/screenshot_${name}_${Date.now()}.png`,
      fullPage: true
    });
    console.log(`✅ Screenshot saved: ${name}`);
  } catch (error) {
    console.log(`⚠️ Screenshot failed: ${error.message}`);
  }
}

/**
 * Transaction Timer - Measures elapsed time for each action (like JMeter)
 */
class TransactionTimer {
  constructor(userId, actionName) {
    this.userId = userId;
    this.actionName = actionName;
    this.startTime = Date.now();
  }
  
  end(status = 'success') {
    const elapsed = Date.now() - this.startTime;
    const statusIcon = status === 'success' ? '✅' : '❌';
    console.log(`   ${statusIcon} [${elapsed}ms] ${this.actionName}`);
    
    return {
      action: this.actionName,
      userId: this.userId,
      elapsed: elapsed,
      status: status,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Timed action wrapper - executes action and measures response time
 */
async function timedAction(userId, actionName, actionFn) {
  const timer = new TransactionTimer(userId, actionName);
  try {
    const result = await actionFn();
    return { ...timer.end('success'), result };
  } catch (error) {
    timer.end('failed');
    throw error;
  }
}

/**
 * Run a single user's test (can be called in parallel)
 */
async function runUser(userId, iterationNumber) {
  const userStart = Date.now();
  console.log(`👤 User ${userId}: Starting iteration ${iterationNumber}/${config.iterations}`);
  
  let browser;
  let page;
  const actionTimings = []; // Store all action timings
  
  try {
    // Step 1: Get Salesforce access token
    console.log('Step 1: Authenticating with Salesforce...');
    const authTiming = await timedAction(userId, 'OAuth Authentication', async () => {
      return await getSalesforceAccessToken();
    });
    const authData = authTiming.result;
    actionTimings.push(authTiming);
    
    // Step 2: Launch browser
    console.log('Step 2: Launching browser...');
    const browserTiming = await timedAction(userId, 'Launch Browser', async () => {
      const b = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ]
      });
      
      const context = await b.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      const p = await context.newPage();
      p.setDefaultTimeout(config.defaultTimeout);
      return { browser: b, page: p };
    });
    browser = browserTiming.result.browser;
    page = browserTiming.result.page;
    actionTimings.push(browserTiming);
    
    // Step 3: Navigate to Salesforce
    console.log('Step 3: Opening Salesforce...');
    await timedAction(userId, 'Navigate to Salesforce', async () => {
      await page.goto(`${authData.instance_url}/secur/frontdoor.jsp?sid=${authData.access_token}`, {
        timeout: config.navigationTimeout,
        waitUntil: 'networkidle'
      });
      await page.waitForLoadState('domcontentloaded');
      await takeScreenshot(page, 'salesforce_home');
    }).then(t => actionTimings.push(t));
    
    // Step 4: Navigate to Accounts tab
    console.log('Step 4: Navigate to Accounts...');
    await timedAction(userId, 'Click Accounts Tab', async () => {
      await page.click("//\*[@title='Accounts']");
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 5: Click New Account button
    await timedAction(userId, 'Click New Account Button', async () => {
      await page.click("//button[contains(text(),'New')]");
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 6: Fill Account Name
    await timedAction(userId, 'Fill Account Name', async () => {
      await page.fill("//input[@name='Name']", config.accountName);
    }).then(t => actionTimings.push(t));
    
    // Step 7: Select Country
    await timedAction(userId, 'Select Country (UNITED STATES)', async () => {
      await page.click("//\*[@name='country']");
      await page.click("//\*[@title='UNITED STATES']");
      await page.waitForTimeout(1000);
    }).then(t => actionTimings.push(t));
    
    // Step 8: Select State
    await timedAction(userId, 'Select State (TEXAS)', async () => {
      await page.click("//\*[@name='state']");
      await page.click("//\*[@title='TEXAS']");
      await page.waitForTimeout(1000);
    }).then(t => actionTimings.push(t));
    
    // Step 9: Save Account
    await timedAction(userId, 'Save Account', async () => {
      await page.click("//button[@name='SaveEdit']");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'account_created');
    }).then(t => actionTimings.push(t));
    
    // Step 10: Navigate to Contacts
    console.log('Step 5: Creating Contact...');
    await timedAction(userId, 'Click Contacts Tab', async () => {
      await page.click("//\*[contains(text(),'Contacts')]");
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 11: Click New Contact
    await timedAction(userId, 'Click New Contact Button', async () => {
      await page.click("//button[contains(text(),'New')]");
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 12: Fill Contact Details
    await timedAction(userId, 'Fill Contact Name', async () => {
      await page.fill("//input[@name='firstName']", config.contactFirstName);
      await page.fill("//input[@name='lastName']", config.contactLastName);
    }).then(t => actionTimings.push(t));
    
    // Step 13: Select Language
    await timedAction(userId, 'Select Language Preference', async () => {
      await page.click("(//*[@aria-label='Language Preference'])[1]");
      await page.click("//\*[@data-value='English']");
      await page.waitForTimeout(1000);
    }).then(t => actionTimings.push(t));
    
    // Step 14: Save Contact
    await timedAction(userId, 'Save Contact', async () => {
      await page.click("//button[@name='SaveEdit']");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'contact_created');
    }).then(t => actionTimings.push(t));
    
    // Step 15: Create New Opportunity
    console.log('Step 6: Creating Opportunity...');
    await timedAction(userId, 'Click New Opportunity Button', async () => {
      await page.click("//\*[@name='Contact.LTGS_New_Opportunity']");
      await page.waitForTimeout(3000);
    }).then(t => actionTimings.push(t));
    
    // Step 16: Fill Opportunity Name
    await timedAction(userId, 'Fill Opportunity Name', async () => {
      await page.fill("//input[@name='Name']", config.opportunityName);
    }).then(t => actionTimings.push(t));
    
    // Step 17: Select Stage
    await timedAction(userId, 'Select Stage (1 Lead Management)', async () => {
      await page.click("//button[@aria-label='Stage']");
      await page.click("//\*[@data-value='1 Lead Management']");
      await page.waitForTimeout(1000);
    }).then(t => actionTimings.push(t));
    
    // Step 18: Select Brand
    await timedAction(userId, 'Select Brand (Checkpoint)', async () => {
      await page.click("//button[@aria-label='Brand']");
      await page.click("//\*[@data-value='Checkpoint']");
      await page.waitForTimeout(1000);
    }).then(t => actionTimings.push(t));
    
    // Step 19: Save Opportunity
    await timedAction(userId, 'Save Opportunity', async () => {
      await page.click("//button[@name='SaveEdit']");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'opportunity_created');
    }).then(t => actionTimings.push(t));
    
    // Step 20: Edit Opportunity
    console.log('Step 7: Editing Opportunity...');
    await timedAction(userId, 'Click Edit Opportunity', async () => {
      await page.waitForTimeout(5000);
      await page.click("(//*[@name='Edit'])[2]");
      await page.waitForTimeout(3000);
    }).then(t => actionTimings.push(t));
    
    // Step 21: Create SSD
    console.log('Step 8: Creating SSD...');
    await timedAction(userId, 'Click Create SSD Button', async () => {
      await page.click("//\*[contains(text(),'Create SSD')]");
      await page.waitForTimeout(3000);
    }).then(t => actionTimings.push(t));
    
    // Step 22: Select SSD Sales Org
    await timedAction(userId, 'Select SSD Sales Org (Global)', async () => {
      const frames = page.frames();
      let ssdFrame = page;
      for (const frame of frames) {
        const title = await frame.title().catch(() => '');
        if (title.includes('SSD') || title.includes('Sales Support')) {
          ssdFrame = frame;
          break;
        }
      }
      await ssdFrame.selectOption("//select[@id='mainPg:mainFrm:entryBlock:ssdSalesOrg']", { label: 'Global' });
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 23: Save SSD
    await timedAction(userId, 'Save SSD', async () => {
      const frames = page.frames();
      let ssdFrame = page;
      for (const frame of frames) {
        const title = await frame.title().catch(() => '');
        if (title.includes('SSD') || title.includes('Sales Support')) {
          ssdFrame = frame;
          break;
        }
      }
      await ssdFrame.click("//input[@value='Save']");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'ssd_created');
    }).then(t => actionTimings.push(t));
    
    // Step 24: Navigate to Products
    console.log('Step 9: Adding Products...');
    await timedAction(userId, 'Click Products Tab', async () => {
      await page.click("//\*[contains(text(),'Products')]");
      await page.waitForTimeout(3000);
    }).then(t => actionTimings.push(t));
    
    // Step 25: Choose Price Book
    await timedAction(userId, 'Click Choose Price Book', async () => {
      await page.click("//button[contains(text(),'Choose Price Book')]");
      await page.waitForTimeout(2000);
    }).then(t => actionTimings.push(t));
    
    // Step 26: Select Standard Price Book
    await timedAction(userId, 'Select Standard Price Book', async () => {
      await page.click("//\*[@data-value='Standard Price Book']");
      await page.click("//button[contains(text(),'Save')]");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'products_added');
    }).then(t => actionTimings.push(t));
    
    // User iteration completed successfully
    const duration = ((Date.now() - userStart) / 1000).toFixed(2);
    console.log(`✅ User ${userId}: Iteration ${iterationNumber} completed in ${duration}s`);
    
    // Print action timing summary
    console.log(`\n📊 Action Timings for User ${userId}, Iteration ${iterationNumber}:`);
    actionTimings.forEach((timing, index) => {
      console.log(`   ${index + 1}. ${timing.action}: ${timing.elapsed}ms`);
    });
    
    return {
      success: true,
      userId: userId,
      iteration: iterationNumber,
      duration: parseFloat(duration),
      actionTimings: actionTimings,
      accountName: config.accountName,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ User ${userId}: Iteration ${iterationNumber} failed: ${error.message}`);
    
    if (page) {
      await takeScreenshot(page, `error_user${userId}_iter${iterationNumber}`);
    }
    
    return {
      success: false,
      userId: userId,
      iteration: iterationNumber,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Run a single user through all iterations
 */
async function runUserWorkload(userId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👤 USER ${userId} STARTING`);
  console.log(`${'='.repeat(60)}`);
  
  const userResults = [];
  
  for (let iteration = 1; iteration <= config.iterations; iteration++) {
    const result = await runUser(userId, iteration);
    userResults.push(result);
    
    // Think time between iterations (except after last one)
    if (iteration < config.iterations) {
      console.log(`👤 User ${userId}: Waiting ${config.thinkTime}ms before next iteration...`);
      await new Promise(resolve => setTimeout(resolve, config.thinkTime));
    }
  }
  
  const successCount = userResults.filter(r => r.success).length;
  const failureCount = userResults.filter(r => !r.success).length;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👤 USER ${userId} COMPLETED`);
  console.log(`   Iterations: ${config.iterations}`);
  console.log(`   Successful: ${successCount} ✅`);
  console.log(`   Failed: ${failureCount} ❌`);
  console.log(`${'='.repeat(60)}\n`);
  
  return {
    userId,
    results: userResults,
    successCount,
    failureCount
  };
}

/**
 * Main test function - runs parallel users
 */
async function main() {
  const testStart = Date.now();
  console.log('🚀 Starting Sureprep UI Approval Test');
  console.log(`📊 Configuration:`);
  console.log(`   - Parallel Users: ${config.parallelUsers}`);
  console.log(`   - Iterations per User: ${config.iterations}`);
  console.log(`   - Think Time: ${config.thinkTime}ms`);
  console.log(`   - Total Executions: ${config.parallelUsers * config.iterations}`);
  console.log(`   - Environment: ${config.loginUrl}`);
  
  // Launch all users in parallel
  console.log(`\n🚀 Launching ${config.parallelUsers} parallel users...\n`);
  
  const userPromises = [];
  for (let userId = 1; userId <= config.parallelUsers; userId++) {
    userPromises.push(runUserWorkload(userId));
  }
  
  // Wait for all users to complete
  const userResults = await Promise.all(userPromises);
  
  // Calculate overall statistics
  const totalDuration = ((Date.now() - testStart) / 1000).toFixed(2);
  let totalExecutions = 0;
  let totalSuccesses = 0;
  let totalFailures = 0;
  const allDurations = [];
  
  userResults.forEach(user => {
    totalExecutions += user.results.length;
    totalSuccesses += user.successCount;
    totalFailures += user.failureCount;
    
    user.results.forEach(result => {
      if (result.success) {
        allDurations.push(result.duration);
      }
    });
  });
  
  // Print final summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 FINAL TEST SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Parallel Users: ${config.parallelUsers}`);
  console.log(`Iterations per User: ${config.iterations}`);
  console.log(`Total Executions: ${totalExecutions}`);
  console.log(`Total Successful: ${totalSuccesses} ✅`);
  console.log(`Total Failed: ${totalFailures} ❌`);
  console.log(`Overall Success Rate: ${((totalSuccesses / totalExecutions) * 100).toFixed(1)}%`);
  console.log(`Total Test Duration: ${totalDuration}s`);
  
  if (allDurations.length > 0) {
    const avgDuration = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    const minDuration = Math.min(...allDurations);
    const maxDuration = Math.max(...allDurations);
    
    console.log(`\nPerformance Metrics:`);
    console.log(`   - Average Duration: ${avgDuration.toFixed(2)}s`);
    console.log(`   - Min Duration: ${minDuration.toFixed(2)}s`);
    console.log(`   - Max Duration: ${maxDuration.toFixed(2)}s`);
    console.log(`   - Throughput: ${(totalExecutions / parseFloat(totalDuration)).toFixed(2)} tests/second`);
  }
  
  console.log(`${'='.repeat(70)}\n`);
  
  // Exit with appropriate code
  process.exit(totalFailures > 0 ? 1 : 0);
}

// Run the test
main();
