/**
 * SUREPREP UI APPROVAL TEST - Programmatic Parallel Execution
 * 
 * This is the Java equivalent of tests/sureprep-ui-approval-test.js
 * Uses runParallelTest() method (NO testng.xml, NO @Test annotations)
 * 
 * Comprehensive Salesforce workflow test that creates:
 * - Account with detailed information
 * - Contact associated with account
 * - Opportunity associated with contact
 * 
 * Run with: java -cp ... SureprepUIApprovalTest
 * Or: mvn exec:java -Dexec.mainClass="SureprepUIApprovalTest"
 */

import com.testframework.base.TestNGRunner;
import com.testframework.base.TestNGRunner.TestResults;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import io.github.bonigarcia.wdm.WebDriverManager;

import javax.net.ssl.HttpsURLConnection;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

public class SureprepUIApprovalTest {
    
    // ============================================================
    // CONFIGURATION (from environment variables like Playwright)
    // ============================================================
    private static final int PARALLEL_USERS = Integer.parseInt(System.getenv().getOrDefault("PARALLEL_USERS", "1"));
    private static final int ITERATIONS = Integer.parseInt(System.getenv().getOrDefault("ITERATIONS", "1"));
    private static final int RAMP_UP_TIME = Integer.parseInt(System.getenv().getOrDefault("RAMP_UP_TIME", "0"));
    private static final int THINK_TIME = Integer.parseInt(System.getenv().getOrDefault("THINK_TIME", "2000"));
    
    private static final String CONSUMER_KEY = System.getenv().getOrDefault("CONSUMER_KEY",
        "3MVG9snQZy6aQDh0Mi6xuTbD1.hKJD6MKrlqsV.vYW5ma0Uj.1tzbHhVpWdqimgfxZePCx88IiYfxL.IcDdzG");
    private static final String USERNAME = System.getenv().getOrDefault("USERNAME",
        "rambabu.chitteti@thomsonreuters.com.uat");
    private static final String LOGIN_URL = System.getenv().getOrDefault("LOGIN_URL",
        "https://test.salesforce.com");
    private static final String PRIVATE_KEY = System.getenv().getOrDefault("PRIVATE_KEY",
        "-----BEGIN PRIVATE KEY-----\n" +
        "MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQC9dssBwne5Fgch\n" +
        "sbM4Tn628qgrnm4ATgaPMz5hKP9Sq1TunKT4fXnlFbvAvrpLupiVkM8BN/FfUJ1K\n" +
        "KwTaUniqMGK18jFgxm9BlktCiRuhS2YGBkVSXi8MQgtUWSa8qzttIifPeM9NfCHY\n" +
        "havBlc6ZEqbqx73f0S4cS55TW8E8+X959xa5ViqMzbctyApMGYQNOtEjITtcAfhi\n" +
        "2IsV+t+SToF/WC+/dC7geu9AbQUOXPgOJWXyINmbNiJbm1VPlb7pG0qlScg/iQV9\n" +
        "I9GgtWgS4Bd01lD4QapzQeEYO9H1usfCDAJjgNqAESTySto7B8QFqT/5d1cM9ruJ\n" +
        "JS3dIN1hAgMBAAECgf9rzDMlBShpPodAPILj/oVKQjY82x9rPPmucFGFpnXe62yf\n" +
        "drDGUV4RYZQ5zkrg24IFVybwYowK1ysnD+Lq9RGCg5UmQG6nyT9z6bdYW/pEg0nB\n" +
        "E8BNZRkPuGQJ0c+geSyOo2hTO0F3rLD1KNjYhAvQPDSMUKlPtwytPLkQZJxFvBPZ\n" +
        "Bn5BWP5DDJmO60cQlow1gybpZjN8hFixnVW5Nt9kcqY8mDIeTNAW4CBWDSIFlAdE\n" +
        "jVu+I+Zu/HK7zh0TytDpzgT6qCYTQJgTUt+NFZFgFal8ivVYWC6aSex61HQjuhNd\n" +
        "ip6g7PqOfNSHkJ5SvW+ca/J2V1VvjK0GC9DItsECgYEA7ddVCTCO6DzQBAS7pn/9\n" +
        "UAIZHdGPzrYAK/FClIVEuPq8Rv7RnjZLC797VreN6R1FHumUeHSUy3Tt6KeLWaj0\n" +
        "iEA5haip/7mT5bp4nazk17yOlfkZiB3XuPCY0Q7XI53GZd3JgS/JCnNgizYmRy1H\n" +
        "VOgTQmnWj8YXKGe/fEybqMECgYEAy+3q4wY6xDwItTkprZaheHNhqAcqhL3KSi2o\n" +
        "lj0kDJceJ/Fnp7w/SFeJS5lPpcgwM30SU4PPlIdCAdgWLu/J/VeoKahV9ewD4C/I\n" +
        "POfAUSLOcl05ZNBvRzrC8LKNYvyg54YiWHqnpCRBojfLxu8GAaO9ixWFIDTJ9VDK\n" +
        "bpTOvKECgYAGP9QyK551p7Nnh6BOnapQQd3bFLiMm+ehP/OZ526I1b3At81WNOL/\n" +
        "6gYZnzURXP2F9Gk8SQPn3KirpktZDcFvGxDn3CirWXrzXFTy/6n7qS6t7h+nnfEf\n" +
        "IONDCvrIKssdvhgfVtwXdDSjM8cJs7zeFEL9Sb6jhHbzTtaPM4wbgQKBgAZaoWj1\n" +
        "drtKi5Lp9wx7lwhjv/U2U/LS3wy0o34a5Zam1r+z2+D0Epy0bYi3fC3UMPxJt1p2\n" +
        "zu73z+yyyO4pdoe4RXsWzabd9bj0hC6xoeJlTT1u/izP+cekYxKQ3arp6DGOkl9j\n" +
        "YvnQT2M4jdbi97LxYSSGRSGdw3UrUUNky5RBAoGBAIwawSpDuUfvXXnBOnCjr1Bu\n" +
        "lJWRaeOI0yLCQwidS0LQrgubJALO7ufMukNeD8QEJAoB4+C/n+MfkzJNH6WzSWB1\n" +
        "rGL8dX8V+F4kC+zj3myyKTI5BLyro/2W5y2IDtcCkd8ciOYSW+9n22LoS30CJ+tP\n" +
        "4uBTR2hKrREzxhynsGDM\n" +
        "-----END PRIVATE KEY-----");
    
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(120);
    private static final Duration NAVIGATION_TIMEOUT = Duration.ofSeconds(240);
    
    /**
     * Main method - Entry point for programmatic execution (like Playwright)
     */
    public static void main(String[] args) {
        System.out.println("🚀 Sureprep UI Approval Test - Programmatic Parallel Execution");
        System.out.println("📊 Test Parameters:");
        System.out.println("   Parallel Users: " + PARALLEL_USERS);
        System.out.println("   Iterations: " + ITERATIONS);
        System.out.println("   Ramp-up Time: " + RAMP_UP_TIME + "s");
        System.out.println("   Think Time: " + THINK_TIME + "ms");
        
        // Run parallel test (exactly like Playwright's runParallelTest())
        TestResults results = TestNGRunner.runParallelTest(
            (userId, iteration) -> runSalesforceWorkflow(userId, iteration),
            PARALLEL_USERS,
            ITERATIONS,
            RAMP_UP_TIME,
            THINK_TIME
        );
        
        // Exit with appropriate code (like Playwright)
        System.exit(results.totalFailures > 0 ? 1 : 0);
    }
    
    /**
     * Test function for a single user iteration (like Playwright's runUser)
     */
    private static void runSalesforceWorkflow(int userId, int iteration) throws InterruptedException {
        WebDriver driver = null;
        WebDriverWait wait = null;
        WebDriverWait longWait = null;
        JavascriptExecutor js = null;
        
        // Unique test data for this execution
        final String ACCOUNT_NUMBER = "TestAccount_U" + userId + "_I" + iteration + "_" + System.currentTimeMillis();
        final String FIRST_NAME = "TestUser" + userId;
        final String LAST_NAME = "Iteration" + iteration;
        final String OPP_NAME = "TestOpp_U" + userId + "_I" + iteration + "_" + System.currentTimeMillis();
        
        try {
            // Step_001: Browser Setup (TIMED)
            driver = TestNGRunner.timedActionStatic("Step_001_BrowserSetup", () -> {
                WebDriverManager.chromedriver().setup();
                
                ChromeOptions options = new ChromeOptions();
                options.addArguments("--headless");
                options.addArguments("--no-sandbox");
                options.addArguments("--disable-dev-shm-usage");
                options.addArguments("--disable-gpu");
                options.addArguments("--window-size=1920,1080");
                
                // Healenium configuration
                options.setCapability("healenium:serverUrl", "http://localhost:7878");
                options.setCapability("healenium:recoveryTries", 3);
                options.setCapability("healenium:scoreCapThreshold", 0.5);
                
                return new ChromeDriver(options);
            });
            
            // Initialize wait objects
            wait = new WebDriverWait(driver, DEFAULT_TIMEOUT);
            longWait = new WebDriverWait(driver, NAVIGATION_TIMEOUT);
            js = (JavascriptExecutor) driver;
            
            // Make final for lambda usage
            final WebDriver finalDriver = driver;
            final WebDriverWait finalWait = wait;
            final WebDriverWait finalLongWait = longWait;
            final JavascriptExecutor finalJs = js;
            
            // Step_002: OAuth Authentication (TIMED)
            Map<String, String> authData = TestNGRunner.timedActionStatic("Step_002_OAuth", () -> {
                try {
                    return getSalesforceAccessToken();
                } catch (Exception e) {
                    throw new RuntimeException("OAuth authentication failed", e);
                }
            });
            
            System.out.println("OAuth successful, got access token");
            
            // Step_003: Enterprise Login (TIMED)
            TestNGRunner.timedActionStatic("Step_003_Enterprise_Login", () -> {
                String frontDoorUrl = authData.get("instance_url") + 
                    "/secur/frontdoor.jsp?sid=" + authData.get("access_token");
                finalDriver.get(frontDoorUrl);
                
                Thread.sleep(5000);
                
                // Switch to dashboard iframe
                WebElement iframe = finalLongWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("(//*[@title='dashboard'])")
                ));
                finalDriver.switchTo().frame(iframe);
                
                // Wait for widget-container
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[contains(@class,'widget-container')][1]")
                ));
                
                finalDriver.switchTo().defaultContent();
            });
            
            Thread.sleep(2000);
            
            // Step_004: Click Accounts (TIMED)
            TestNGRunner.timedActionStatic("Step_004_Enterprise_Clickon_Accounts", () -> {
                WebElement accountsLink = finalWait.until(ExpectedConditions.elementToBeClickable(
                    By.xpath("//*[@title='Accounts']")
                ));
                finalJs.executeScript("arguments[0].click();", accountsLink);
                
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[@role='grid']")
                ));
            });
            
            Thread.sleep(5000);
            
            // Step_005: Click New Account (TIMED)
            TestNGRunner.timedActionStatic("Step_005_Enterprise_Click_Accounts_New", () -> {
                WebElement newButton = finalWait.until(ExpectedConditions.elementToBeClickable(
                    By.xpath("//a[@title='New']")
                ));
                newButton.click();
                
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[@name='CancelEdit']")
                ));
            });
            
            Thread.sleep(2000);
            
            // Fill Account Details (NOT TIMED - data entry)
            System.out.println("Filling account details for " + ACCOUNT_NUMBER + "...");
            
            finalDriver.findElement(By.xpath("//label[text()='Account Name']/parent::div/div/input"))
                .sendKeys(ACCOUNT_NUMBER);
            
            WebElement countryBtn = finalDriver.findElement(By.xpath("//*[@name='country']"));
            finalJs.executeScript("arguments[0].click();", countryBtn);
            Thread.sleep(1000);
            
            WebElement usOption = finalDriver.findElement(By.xpath("//*[@title='UNITED STATES']"));
            finalJs.executeScript("arguments[0].click();", usOption);
            Thread.sleep(1000);
            
            finalDriver.findElement(By.xpath("//*[@name='street']")).sendKeys("400 Pine St");
            finalDriver.findElement(By.xpath("//*[@name='city']")).sendKeys("Abilene");
            
            finalDriver.findElement(By.xpath("//*[@name='province']")).click();
            WebElement texasOption = finalDriver.findElement(By.xpath("//*[@title='TEXAS']"));
            finalJs.executeScript("arguments[0].click();", texasOption);
            Thread.sleep(1000);
            
            finalDriver.findElement(By.xpath("//*[@name='postalCode']")).sendKeys("79601-5108");
            finalDriver.findElement(By.xpath("//*[@name='VAT_Number__c']")).sendKeys("796018");
            Thread.sleep(2000);
            
            WebElement frozenEl = finalDriver.findElement(By.xpath("//button[@aria-label='Frozen Market Current Year Segment L1']"));
            finalJs.executeScript("arguments[0].scrollIntoView(true);", frozenEl);
            frozenEl.click();
            finalDriver.findElement(By.xpath("//*[@title='Professional Tax']")).click();
            
            WebElement taxAcctEl = finalDriver.findElement(By.xpath("//button[@aria-label='Tax & Accounting Firms']"));
            finalJs.executeScript("arguments[0].scrollIntoView(true);", taxAcctEl);
            taxAcctEl.click();
            finalDriver.findElement(By.xpath("//*[@title='Not on this list']")).click();
            
            finalDriver.findElement(By.xpath("//button[@aria-label='Number Of Employees']")).click();
            finalDriver.findElement(By.xpath("//*[@title='1-29']")).click();
            Thread.sleep(2000);
            
            // Step_006: Save Account (TIMED)
            TestNGRunner.timedActionStatic("Step_006_Enterprise_Enter_AccountDetails_Click_Save", () -> {
                finalDriver.findElement(By.xpath("//*[@name='SaveEdit']")).click();
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[contains(@class,'toastMessage')]")
                ));
            });
            
            Thread.sleep(3000);
            
            // Step_007: Click Contacts (TIMED)
            TestNGRunner.timedActionStatic("Step_007_Enterprise_Click_Contacts_QuickLink", () -> {
                finalDriver.findElement(By.xpath("//slot[contains(text(),'Contacts')]//ancestor::a")).click();
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//button[contains(text(),'New')]")
                ));
            });
            
            Thread.sleep(2000);
            
            // Step_008: Click New Contact (TIMED)
            TestNGRunner.timedActionStatic("Step_008_Enterprise_Click_Contacts_New_Button", () -> {
                finalDriver.findElement(By.xpath("//button[contains(text(),'New')]")).click();
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[@name='CancelEdit']")
                ));
            });
            
            Thread.sleep(2000);
            
            // Fill Contact Details (NOT TIMED)
            System.out.println("Filling contact details...");
            
            finalDriver.findElement(By.xpath("//*[@name='firstName']")).sendKeys(FIRST_NAME);
            finalDriver.findElement(By.xpath("//*[@name='lastName']")).sendKeys(LAST_NAME);
            finalDriver.findElement(By.xpath("//*[@name='Email']")).sendKeys("rambabu.chitteti@thomsonreuters.com");
            Thread.sleep(2000);
            
            WebElement langBtn = finalDriver.findElement(By.xpath("(//*[@aria-label='Language Preference'])[1]"));
            finalJs.executeScript("arguments[0].click();", langBtn);
            Thread.sleep(2000);
            finalDriver.findElement(By.xpath("//*[@title='English']")).click();
            
            // Step_009: Save Contact (TIMED)
            TestNGRunner.timedActionStatic("Step_009_Enterprise_Enter_ContactDetails_Click_Save", () -> {
                finalDriver.findElement(By.xpath("//*[@name='SaveEdit']")).click();
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[contains(@class,'toastMessage')]")
                ));
            });
            
            Thread.sleep(3000);
            
            // Step_010: Click New Opportunity (TIMED)
            TestNGRunner.timedActionStatic("Step_010_Enterprise_Click_NewOpportunity_Button", () -> {
                WebElement newOppBtn = finalDriver.findElement(By.xpath("//*[@name='Contact.LTGS_New_Opportunity']"));
                finalJs.executeScript("arguments[0].click();", newOppBtn);
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[@name='CancelEdit']")
                ));
            });
            
            Thread.sleep(3000);
            
            // Fill Opportunity Details (NOT TIMED)
            System.out.println("Filling opportunity details...");
            
            finalDriver.findElement(By.xpath("//*[@name='Name']")).sendKeys(OPP_NAME);
            
            WebElement stageBtn = finalDriver.findElement(By.xpath("//button[@aria-label='Stage']"));
            finalJs.executeScript("arguments[0].click();", stageBtn);
            WebElement stageOption = finalDriver.findElement(By.xpath("//*[@data-value='1 Lead Management']"));
            finalJs.executeScript("arguments[0].click();", stageOption);
            
            finalDriver.findElement(By.xpath("//*[@name='CloseDate']")).sendKeys("06/30/2026");
            
            WebElement brandBtn = finalDriver.findElement(By.xpath("//button[@aria-label='Brand']"));
            finalJs.executeScript("arguments[0].click();", brandBtn);
            WebElement checkpointOption = finalDriver.findElement(By.xpath("//*[@data-value='Checkpoint']"));
            finalJs.executeScript("arguments[0].click();", checkpointOption);
            
            WebElement materialEl = finalDriver.findElement(By.xpath("//*[@title='AUDIT & ACCOUNTING']"));
            finalJs.executeScript("arguments[0].scrollIntoView(true);", materialEl);
            materialEl.click();
            finalDriver.findElement(By.xpath("//button[@title='Move selection to Chosen']")).click();
            Thread.sleep(2000);
            
            WebElement sourceEl = finalDriver.findElement(By.xpath("//button[@aria-label='Source']"));
            finalJs.executeScript("arguments[0].scrollIntoView(true);", sourceEl);
            sourceEl.click();
            finalDriver.findElement(By.xpath("//*[@data-value='Call Center']")).click();
            
            // Step_011: Save Opportunity (TIMED)
            TestNGRunner.timedActionStatic("Step_011_Enterprise_Enter_OpportunityDetails_Click_Save", () -> {
                finalDriver.findElement(By.xpath("//*[@name='SaveEdit']")).click();
                finalWait.until(ExpectedConditions.presenceOfElementLocated(
                    By.xpath("//*[@title='Create Quote/Proposal']")
                ));
            });
            
            Thread.sleep(3000);
            
            System.out.println("✅ User " + userId + " Iteration " + iteration + ": All steps completed (Account + Contact + Opportunity)");
            
        } finally {
            // Cleanup (NOT TIMED)
            if (driver != null) {
                driver.quit();
            }
        }
    }
    
    /**
     * Helper methods for Salesforce OAuth
     */
    private static String generateJWT() throws Exception {
        // Header
        String header = "{\"alg\":\"RS256\",\"typ\":\"JWT\"}";
        String encodedHeader = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(header.getBytes(StandardCharsets.UTF_8));
        
        // Claims
        long exp = System.currentTimeMillis() / 1000 + 300; // 5 minutes
        String claims = String.format(
            "{\"iss\":\"%s\",\"sub\":\"%s\",\"aud\":\"%s\",\"exp\":%d}",
            CONSUMER_KEY, USERNAME, LOGIN_URL, exp
        );
        String encodedClaims = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(claims.getBytes(StandardCharsets.UTF_8));
        
        // Signature
        String signatureInput = encodedHeader + "." + encodedClaims;
        
        // Parse private key
        String privateKeyPEM = PRIVATE_KEY
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(privateKeyPEM);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        PrivateKey privateKey = kf.generatePrivate(spec);
        
        // Sign
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(signatureInput.getBytes(StandardCharsets.UTF_8));
        byte[] signatureBytes = signature.sign();
        String encodedSignature = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(signatureBytes);
        
        return signatureInput + "." + encodedSignature;
    }
    
    private static Map<String, String> getSalesforceAccessToken() throws Exception {
        String jwt = generateJWT();
        
        URL url = new URL(LOGIN_URL + "/services/oauth2/token");
        HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        
        String postData = "grant_type=" + URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", "UTF-8") +
                         "&assertion=" + URLEncoder.encode(jwt, "UTF-8");
        
        try (OutputStream os = conn.getOutputStream()) {
            os.write(postData.getBytes(StandardCharsets.UTF_8));
        }
        
        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            throw new Exception("OAuth failed with status: " + responseCode);
        }
        
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
        }
        
        // Parse JSON response
        String responseStr = response.toString();
        String instanceUrl = responseStr.split("\"instance_url\":\"")[1].split("\"")[0];
        String accessToken = responseStr.split("\"access_token\":\"")[1].split("\"")[0];
        
        Map<String, String> authData = new HashMap<>();
        authData.put("instance_url", instanceUrl);
        authData.put("access_token", accessToken);
        
        return authData;
    }
}
