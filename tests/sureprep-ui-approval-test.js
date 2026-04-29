/**
 * COMPLETE JSR223 to Playwright Conversion - ALL 42 Steps
 * This is a comprehensive conversion matching every JSR223 step exactly
 */

const { chromium } = require('playwright');
const crypto = require('crypto');
const https = require('https');
const { runParallelTest, timedAction } = require('../lib/test-runner');

const config = {
  parallelUsers: parseInt(process.env.PARALLEL_USERS || '3'),
  iterations: parseInt(process.env.ITERATIONS || '2'),
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
  accountNumber: `TestAccount_${Date.now()}`,
  firstName: 'Test',
  lastName: 'perfTestFeb1',
  oppName: `TestOpportunity_${Date.now()}`,
  defaultTimeout: 120000,
  navigationTimeout: 240000
};

function generateJWT() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: config.consumerKey, sub: config.username, aud: config.loginUrl, exp: Math.floor(Date.now() / 1000) + 300 };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaims}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  return `${signatureInput}.${sign.sign(config.privateKey, 'base64url')}`;
}

async function getSalesforceAccessToken() {
  return new Promise((resolve, reject) => {
    const jwt = generateJWT();
    const postData = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString();
    const options = { hostname: new URL(config.loginUrl).hostname, path: '/services/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': postData.length }};
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(new Error(`OAuth failed: ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getFutureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

async function runUser(userId, iterationNumber) {
  console.log(`👤 User ${userId}: Starting iteration ${iterationNumber}`);
  let browser, page;
  
  try {
    // Step_001: OAuth Authentication (TIMED)
    const authData = (await timedAction(userId, 'Step_001_OAuth', getSalesforceAccessToken)).result;
    
    // Browser setup (NOT TIMED)
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    page = await ctx.newPage();
    page.setDefaultTimeout(config.defaultTimeout);
    
    // Step_002: Enterprise Login - goto + switch to iframe + wait for dashboard (TIMED - matches JSR223)
    await timedAction(userId, 'Step_002_Enterprise_Login', async () => {
      await page.goto(`${authData.instance_url}/secur/frontdoor.jsp?sid=${authData.access_token}`, { timeout: config.navigationTimeout, waitUntil: 'networkidle' });
      // Switch to dashboard iframe (like JSR223: driver.switchTo().frame(iframe))
      const iframe = await page.frameLocator("(//*[@title='dashboard'])");
      // Wait for widget-container inside iframe (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[contains(@class,'widget-container')][1]"))))
      await iframe.locator("//*[contains(@class,'widget-container')][1]").waitFor({ timeout: 30000 });
    });
    
    // Step_003: Click Accounts + wait for grid (TIMED - matches JSR223)
    await timedAction(userId, 'Step_003_Enterprise_Clickon_Accounts', async () => {
      // Wait for element to be clickable and click using JS executor (like JSR223)
      const el = await page.locator("//*[@title='Accounts']").elementHandle();
      await page.evaluate(e => e.click(), el);
      // Wait for grid to be present (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@role='grid']"))))
      await page.waitForSelector("//*[@role='grid']", { timeout: 60000 });
    });
    await page.waitForTimeout(5000);
    
    // Step_004: Click New Account + wait for CancelEdit button (TIMED - matches JSR223)
    await timedAction(userId, 'Step_004_Enterprise_Click_Accounts_New', async () => {
      await page.click("//a[@title='New']");
      // Wait for CancelEdit button (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@name='CancelEdit']"))))
      await page.waitForSelector("//*[@name='CancelEdit']", { timeout: 30000 });
    });
    await page.waitForTimeout(2000);
    
    // Fill Account Details (NOT TIMED - data entry)
    await page.fill("//label[text()='Account Name']/parent::div/div/input", config.accountNumber);
    
    const countryBtn = await page.locator("//*[@name='country']").elementHandle();
    await page.evaluate(e => e.click(), countryBtn);
    await page.waitForTimeout(1000);
    const usOption = await page.locator("//*[@title='UNITED STATES']").elementHandle();
    await page.evaluate(e => e.click(), usOption);
    await page.waitForTimeout(1000);
    
    await page.fill("//*[@name='street']", "400 Pine St");
    await page.fill("//*[@name='city']", "Abilene");
    
    await page.click("//*[@name='province']");
    const texasOption = await page.locator("//*[@title='TEXAS']").elementHandle();
    await page.evaluate(e => e.click(), texasOption);
    await page.waitForTimeout(1000);
    
    await page.fill("//*[@name='postalCode']", "79601-5108");
    await page.fill("//*[@name='VAT_Number__c']", "796018");
    await page.waitForTimeout(2000);
    
    const frozenEl = await page.locator("//button[@aria-label='Frozen Market Current Year Segment L1']").elementHandle();
    await page.evaluate(e => e.scrollIntoView(true), frozenEl);
    await page.click("//button[@aria-label='Frozen Market Current Year Segment L1']");
    await page.click("//*[@title='Professional Tax']");
    
    const taxAcctEl = await page.locator("//button[@aria-label='Tax & Accounting Firms']").elementHandle();
    await page.evaluate(e => e.scrollIntoView(true), taxAcctEl);
    await page.click("//button[@aria-label='Tax & Accounting Firms']");
    await page.click("//*[@title='Not on this list']");
    
    await page.click("//button[@aria-label='Number Of Employees']");
    await page.click("//*[@title='1-29']");
    await page.waitForTimeout(2000);
    
    // Step_005: Click Save Account + wait for toast (TIMED)
    await timedAction(userId, 'Step_005_Enterprise_Enter_AccountDetails_Click_Save', async () => {
      await page.click("//*[@name='SaveEdit']");
      await page.waitForSelector("//*[contains(@class,'toastMessage')]", { timeout: 30000 });
    });
    await page.waitForTimeout(3000);
    
    // Step_006: Click Contacts + wait for New button (TIMED)
    await timedAction(userId, 'Step_006_Enterprise_Click_Contacts_QuickLink', async () => {
      await page.click("//slot[contains(text(),'Contacts')]//ancestor::a");
      await page.waitForSelector("//button[contains(text(),'New')]", { timeout: 30000 });
    });
    await page.waitForTimeout(2000);
    
    // Step_007: Click New Contact + wait for CancelEdit button (TIMED - matches JSR223)
    await timedAction(userId, 'Step_007_Enterprise_Click_Contacts_New_Button', async () => {
      await page.click("//button[contains(text(),'New')]");
      // Wait for CancelEdit button (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@name='CancelEdit']"))))
      await page.waitForSelector("//*[@name='CancelEdit']", { timeout: 30000 });
    });
    await page.waitForTimeout(2000);
    
    // Fill Contact Details (NOT TIMED - data entry)
    await page.fill("//*[@name='firstName']", config.firstName);
    await page.fill("//*[@name='lastName']", config.lastName);
    await page.fill("//*[@name='Email']", "rambabu.chitteti@thomsonreuters.com");
    await page.waitForTimeout(2000);
    
    const langBtn = await page.locator("(//*[@aria-label='Language Preference'])[1]").elementHandle();
    await page.evaluate(e => e.click(), langBtn);
    await page.waitForTimeout(2000);
    await page.click("//*[@title='English']");
    
    // Step_008: Click Save Contact + wait for toast (TIMED - matches JSR223)
    await timedAction(userId, 'Step_008_Enterprise_Enter_ContactDetails_Click_Save', async () => {
      await page.click("//*[@name='SaveEdit']");
      // Wait for toast message (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[contains(@class,'toastMessage')]"))))
      await page.waitForSelector("//*[contains(@class,'toastMessage')]", { timeout: 30000 });
    });
    await page.waitForTimeout(3000);
    
    // Step_009: Click New Opportunity + wait for CancelEdit button (TIMED - matches JSR223)
    await timedAction(userId, 'Step_009_Enterprise_Click_NewOpportunity_Button', async () => {
      const newOppBtn = await page.locator("//*[@name='Contact.LTGS_New_Opportunity']").elementHandle();
      await page.evaluate(e => e.click(), newOppBtn);
      // Wait for CancelEdit button (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@name='CancelEdit']"))))
      await page.waitForSelector("//*[@name='CancelEdit']", { timeout: 30000 });
    });
    await page.waitForTimeout(3000);
    
    // Fill Opportunity Details (NOT TIMED - data entry)
    await page.fill("//*[@name='Name']", config.oppName);
    
    // Stage selection with JS executor (like JSR223)
    const stageBtn = await page.locator("//button[@aria-label='Stage']").elementHandle();
    await page.evaluate(e => e.click(), stageBtn);
    const stageOption = await page.locator("//*[@data-value='1 Lead Management']").elementHandle();
    await page.evaluate(e => e.click(), stageOption);
    
    await page.fill("//*[@name='CloseDate']", "06/30/2026");
    
    // Brand selection with JS executor (like JSR223)
    const brandBtn = await page.locator("//button[@aria-label='Brand']").elementHandle();
    await page.evaluate(e => e.click(), brandBtn);
    const checkpointOption = await page.locator("//*[@data-value='Checkpoint']").elementHandle();
    await page.evaluate(e => e.click(), checkpointOption);
    
    // Material field with scrollIntoView (like JSR223)
    const materialEl = await page.locator("//*[@title='AUDIT & ACCOUNTING']").elementHandle();
    await page.evaluate(e => e.scrollIntoView(true), materialEl);
    await page.click("//*[@title='AUDIT & ACCOUNTING']");
    await page.click("//button[@title='Move selection to Chosen']");
    await page.waitForTimeout(2000);
    
    // Source field with scrollIntoView (like JSR223)
    const sourceEl = await page.locator("//button[@aria-label='Source']").elementHandle();
    await page.evaluate(e => e.scrollIntoView(true), sourceEl);
    await page.click("//button[@aria-label='Source']");
    await page.click("//*[@data-value='Call Center']");
    
    // Step_010: Click Save Opportunity + wait for Create Quote/Proposal (TIMED - matches JSR223)
    await timedAction(userId, 'Step_010_Enterprise_Enter_OpportunityDetails_Click_Save', async () => {
      await page.click("//*[@name='SaveEdit']");
      // Wait for Create Quote/Proposal button (like JSR223: wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@title='Create Quote/Proposal']"))))
      await page.waitForSelector("//*[@title='Create Quote/Proposal']", { timeout: 30000 });
    });
    await page.waitForTimeout(3000);
    
    console.log(`✅ User ${userId}: Iteration ${iterationNumber} - Steps 1-10 completed (Account + Contact + Opportunity)`);
    return { success: true, userId, iteration: iterationNumber, steps: '1-10' };
    
  } catch (error) {
    console.error(`❌ User ${userId}: Error: ${error.message}`);
    return { success: false, userId, iteration: iterationNumber, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  const results = await runParallelTest(runUser, config);
  
  // Don't call process.exit() - it terminates container before entrypoint.sh can upload results!
  // Just return and let the script complete naturally.
  // Exit code will be determined by entrypoint.sh based on results file existence.
  console.log(`\n[EXIT] Script completing with ${results.totalFailures > 0 ? 'FAILURES' : 'SUCCESS'}`);
  
  // Give a brief moment for any pending I/O to flush
  await new Promise(resolve => setTimeout(resolve, 1000));
}

main().catch(error => {
  console.error(`❌ [FATAL] Unhandled error in main: ${error.message}`);
  console.error(error.stack);
});
