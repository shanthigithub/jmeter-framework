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

// Configuration (from JMX variables)
const config = {
  // Load testing parameters (equivalent to JMeter Thread Group)
  iterations: parseInt(process.env.ITERATIONS || '1'), // Number of times to run this test (like Loop Count)
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
};

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
 * Run a single iteration of the test
 */
async function runIteration(iterationNumber) {
  const iterationStart = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Iteration ${iterationNumber}/${config.iterations}`);
  console.log(`${'='.repeat(60)}\n`);
  
  let browser;
  let page;
  
  try {
    // Step 1: Get Salesforce access token
    console.log('Step 1: Authenticating with Salesforce...');
    const authData = await getSalesforceAccessToken();
    console.log(`✅ Authentication successful: ${authData.instance_url}`);
    
    // Step 2: Launch browser
    console.log('Step 2: Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    page = await context.newPage();
    page.setDefaultTimeout(config.defaultTimeout);
    
    // Step 3: Navigate to Salesforce with access token
    console.log('Step 3: Opening Salesforce...');
    await page.goto(`${authData.instance_url}/secur/frontdoor.jsp?sid=${authData.access_token}`, {
      timeout: config.navigationTimeout,
      waitUntil: 'networkidle'
    });
    await page.waitForLoadState('domcontentloaded');
    await takeScreenshot(page, 'salesforce_home');
    console.log('✅ Salesforce opened successfully');
    
    // Step 4: Navigate to Accounts and create new account
    console.log('Step 4: Creating Account...');
    await page.click("//\*[@title='Accounts']");
    await page.waitForTimeout(2000);
    
    await page.click("//button[contains(text(),'New')]");
    await page.waitForTimeout(2000);
    
    // Fill account details
    await page.fill("//input[@name='Name']", config.accountName);
    
    // Select country: UNITED STATES
    await page.click("//\*[@name='country']");
    await page.click("//\*[@title='UNITED STATES']");
    await page.waitForTimeout(1000);
    
    // Select state: TEXAS
    await page.click("//\*[@name='state']");
    await page.click("//\*[@title='TEXAS']");
    await page.waitForTimeout(1000);
    
    // Save account
    await page.click("//button[@name='SaveEdit']");
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'account_created');
    console.log(`✅ Account created: ${config.accountName}`);
    
    // Step 5: Create Contact
    console.log('Step 5: Creating Contact...');
    await page.click("//\*[contains(text(),'Contacts')]");
    await page.waitForTimeout(2000);
    
    await page.click("//button[contains(text(),'New')]");
    await page.waitForTimeout(2000);
    
    // Fill contact details
    await page.fill("//input[@name='firstName']", config.contactFirstName);
    await page.fill("//input[@name='lastName']", config.contactLastName);
    
    // Select language preference
    await page.click("(//*[@aria-label='Language Preference'])[1]");
    await page.click("//\*[@data-value='English']");
    await page.waitForTimeout(1000);
    
    // Save contact
    await page.click("//button[@name='SaveEdit']");
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'contact_created');
    console.log(`✅ Contact created: ${config.contactFirstName} ${config.contactLastName}`);
    
    // Step 6: Create New Opportunity
    console.log('Step 6: Creating Opportunity...');
    await page.click("//\*[@name='Contact.LTGS_New_Opportunity']");
    await page.waitForTimeout(3000);
    
    // Fill opportunity details
    await page.fill("//input[@name='Name']", config.opportunityName);
    
    // Select Stage: 1 Lead Management
    await page.click("//button[@aria-label='Stage']");
    await page.click("//\*[@data-value='1 Lead Management']");
    await page.waitForTimeout(1000);
    
    // Select Brand: Checkpoint
    await page.click("//button[@aria-label='Brand']");
    await page.click("//\*[@data-value='Checkpoint']");
    await page.waitForTimeout(1000);
    
    // Save opportunity
    await page.click("//button[@name='SaveEdit']");
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'opportunity_created');
    console.log(`✅ Opportunity created: ${config.opportunityName}`);
    
    // Step 7: Edit Opportunity to add more details
    console.log('Step 7: Editing Opportunity...');
    await page.waitForTimeout(5000);
    await page.click("(//*[@name='Edit'])[2]");
    await page.waitForTimeout(3000);
    
    // Step 8: Create SSD (Sales Support Document)
    console.log('Step 8: Creating SSD...');
    await page.click("//\*[contains(text(),'Create SSD')]");
    await page.waitForTimeout(3000);
    
    // Switch to SSD iframe if needed
    const frames = page.frames();
    let ssdFrame = page;
    for (const frame of frames) {
      const title = await frame.title().catch(() => '');
      if (title.includes('SSD') || title.includes('Sales Support')) {
        ssdFrame = frame;
        break;
      }
    }
    
    // Select Global sales org
    await ssdFrame.selectOption("//select[@id='mainPg:mainFrm:entryBlock:ssdSalesOrg']", { label: 'Global' });
    await page.waitForTimeout(2000);
    
    // Fill SSD details and save
    await ssdFrame.click("//input[@value='Save']");
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'ssd_created');
    console.log('✅ SSD created successfully');
    
    // Step 9: Add Products
    console.log('Step 9: Adding Products...');
    await page.click("//\*[contains(text(),'Products')]");
    await page.waitForTimeout(3000);
    
    await page.click("//button[contains(text(),'Choose Price Book')]");
    await page.waitForTimeout(2000);
    
    await page.click("//\*[@data-value='Standard Price Book']");
    await page.click("//button[contains(text(),'Save')]");
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'products_added');
    console.log('✅ Products configured successfully');
    
    // Iteration completed successfully
    const duration = ((Date.now() - iterationStart) / 1000).toFixed(2);
    console.log(`\n✅ Iteration ${iterationNumber} completed in ${duration}s`);
    console.log(`   Account: ${config.accountName}`);
    console.log(`   Contact: ${config.contactFirstName} ${config.contactLastName}`);
    console.log(`   Opportunity: ${config.opportunityName}`);
    
    return {
      success: true,
      iteration: iterationNumber,
      duration: parseFloat(duration),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`\n❌ Iteration ${iterationNumber} failed: ${error.message}`);
    console.error(error.stack);
    
    if (page) {
      await takeScreenshot(page, `error_iteration_${iterationNumber}`);
    }
    
    return {
      success: false,
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
 * Main test function - runs all iterations
 */
async function main() {
  const testStart = Date.now();
  console.log('🚀 Starting Sureprep UI Approval Test');
  console.log(`📊 Configuration:`);
  console.log(`   - Iterations: ${config.iterations}`);
  console.log(`   - Think Time: ${config.thinkTime}ms`);
  console.log(`   - Environment: ${config.loginUrl}`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Run iterations sequentially (browser tests don't scale well in parallel)
  for (let i = 1; i <= config.iterations; i++) {
    const result = await runIteration(i);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Think time between iterations (except after last one)
    if (i < config.iterations) {
      console.log(`\n⏸️  Waiting ${config.thinkTime}ms before next iteration...`);
      await new Promise(resolve => setTimeout(resolve, config.thinkTime));
    }
  }
  
  // Print summary
  const totalDuration = ((Date.now() - testStart) / 1000).toFixed(2);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Iterations: ${config.iterations}`);
  console.log(`Successful: ${successCount} ✅`);
  console.log(`Failed: ${failureCount} ❌`);
  console.log(`Success Rate: ${((successCount / config.iterations) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration}s`);
  
  if (successCount > 0) {
    const avgDuration = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / successCount;
    console.log(`Avg Duration: ${avgDuration.toFixed(2)}s per iteration`);
  }
  
  console.log(`${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run the test
main();
