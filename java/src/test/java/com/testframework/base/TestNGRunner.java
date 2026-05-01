package com.testframework.base;

import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.testng.ITestResult;
import org.testng.annotations.*;
import io.github.bonigarcia.wdm.WebDriverManager;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * TestNG Runner - DO NOT EDIT (Framework Code - Same as test-runner.js)
 * 
 * This is the TestNG equivalent of test-runner.js
 * Provides the same functionality for Java/TestNG tests
 * 
 * Features:
 * - WebDriver management with Healenium self-healing
 * - Transaction timing for each user action (like JMeter)
 * - JTL result file generation for S3 upload
 * - Screenshot capture on failure
 * - Thread-safe parallel execution
 */
public abstract class TestNGRunner {
    
    // Thread-local WebDriver for parallel execution
    private static ThreadLocal<WebDriver> driver = new ThreadLocal<>();
    
    // Transaction storage (like global.jmeterTransactions in test-runner.js)
    private static Map<String, List<TransactionData>> transactions = new ConcurrentHashMap<>();
    private static AtomicInteger totalExecutions = new AtomicInteger(0);
    private static AtomicInteger totalSuccesses = new AtomicInteger(0);
    private static AtomicInteger totalFailures = new AtomicInteger(0);
    
    /**
     * Transaction data structure (like test-runner.js)
     */
    static class TransactionData {
        String name;
        long timestamp;
        long duration; // milliseconds
        boolean success;
        String error;
        
        TransactionData(String name, long timestamp, long duration, boolean success, String error) {
            this.name = name;
            this.timestamp = timestamp;
            this.duration = duration;
            this.success = success;
            this.error = error;
        }
    }
    
    /**
     * Setup WebDriver before each test method
     */
    @BeforeMethod(alwaysRun = true)
    public void setUp() {
        String threadName = Thread.currentThread().getName();
        System.out.println("\n" + "=".repeat(60));
        System.out.println("👤 " + threadName + " STARTING");
        System.out.println("=".repeat(60));
        
        // Initialize transaction storage for this thread
        transactions.putIfAbsent(threadName, new ArrayList<>());
        
        // Setup ChromeDriver
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
        
        WebDriver webDriver = new ChromeDriver(options);
        driver.set(webDriver);
        
        System.out.println("✅ WebDriver initialized for " + threadName);
    }
    
    /**
     * Cleanup after each test method
     */
    @AfterMethod(alwaysRun = true)
    public void tearDown(ITestResult result) {
        String threadName = Thread.currentThread().getName();
        
        // Record test result
        if (result.isSuccess()) {
            totalSuccesses.incrementAndGet();
            System.out.println("\n✅ Test PASSED: " + result.getName());
        } else {
            totalFailures.incrementAndGet();
            System.out.println("\n❌ Test FAILED: " + result.getName());
            
            // Take screenshot on failure
            captureScreenshot(result.getName());
        }
        
        totalExecutions.incrementAndGet();
        
        // Close WebDriver
        WebDriver webDriver = driver.get();
        if (webDriver != null) {
            webDriver.quit();
            driver.remove();
        }
        
        System.out.println("\n" + "=".repeat(60));
        System.out.println("👤 " + threadName + " COMPLETED");
        System.out.println("=".repeat(60) + "\n");
    }
    
    /**
     * Generate JTL result file after all tests complete
     */
    @AfterSuite(alwaysRun = true)
    public void generateResults() {
        System.out.println("\n" + "=".repeat(70));
        System.out.println("📊 FINAL TEST SUMMARY");
        System.out.println("=".repeat(70));
        System.out.println("Total Executions: " + totalExecutions.get());
        System.out.println("Total Successful: " + totalSuccesses.get() + " ✅");
        System.out.println("Total Failed: " + totalFailures.get() + " ❌");
        
        if (totalExecutions.get() > 0) {
            double successRate = (totalSuccesses.get() * 100.0) / totalExecutions.get();
            System.out.println("Success Rate: " + String.format("%.1f", successRate) + "%");
        }
        
        System.out.println("=".repeat(70) + "\n");
        
        // Generate JTL file for S3 upload (required by entrypoint.sh)
        generateJTLFile();
    }
    
    /**
     * Get WebDriver for current thread
     */
    protected WebDriver getDriver() {
        return driver.get();
    }
    
    /**
     * Execute a timed action (like timedAction() in test-runner.js)
     * Measures response time for each user action
     * 
     * @param actionName Name of the action (e.g., "Login", "Search")
     * @param action Lambda to execute
     */
    protected void timedAction(String actionName, Runnable action) {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            action.run();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store transaction data
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, true, null)
            );
            
            // Log like test-runner.js
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store failed transaction
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, false, e.getMessage())
            );
            
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            throw e;
        }
    }
    
    /**
     * Execute a timed action that returns a value
     * 
     * @param actionName Name of the action
     * @param action Supplier lambda that returns a value
     * @return The result from the supplier
     */
    protected <T> T timedAction(String actionName, java.util.function.Supplier<T> action) {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            T result = action.get();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store transaction data
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, true, null)
            );
            
            // Log like test-runner.js
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
            return result;
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store failed transaction
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, false, e.getMessage())
            );
            
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            throw e;
        }
    }
    
    /**
     * Functional interface that allows throwing checked exceptions
     */
    @FunctionalInterface
    protected interface ThrowingRunnable {
        void run() throws Exception;
    }
    
    /**
     * Functional interface that allows throwing checked exceptions and returns a value
     */
    @FunctionalInterface
    protected interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
    
    /**
     * Execute a timed action that may throw checked exceptions
     * 
     * @param actionName Name of the action
     * @param action Lambda that may throw checked exceptions
     */
    protected void timedAction(String actionName, ThrowingRunnable action) throws Exception {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            action.run();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store transaction data
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, true, null)
            );
            
            // Log like test-runner.js
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store failed transaction
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, false, e.getMessage())
            );
            
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            throw e;
        }
    }
    
    /**
     * Execute a timed action that returns a value and may throw checked exceptions
     * 
     * @param actionName Name of the action
     * @param action Supplier lambda that may throw checked exceptions
     * @return The result from the supplier
     */
    protected <T> T timedAction(String actionName, ThrowingSupplier<T> action) throws Exception {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            T result = action.get();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store transaction data
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, true, null)
            );
            
            // Log like test-runner.js
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
            return result;
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // Store failed transaction
            transactions.get(threadName).add(
                new TransactionData(actionName, startTime, duration, false, e.getMessage())
            );
            
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            throw e;
        }
    }
    
    /**
     * Think time (pause between actions - like JMeter)
     */
    protected void thinkTime(int milliseconds) {
        try {
            Thread.sleep(milliseconds);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Log test step
     */
    protected void logStep(String stepNumber, String description) {
        System.out.println(String.format("\n📋 %s: %s", stepNumber, description));
    }
    
    /**
     * Simple log method (alias for easier test writing)
     */
    protected void log(String message) {
        System.out.println(message);
    }
    
    /**
     * Get environment variable with default value
     */
    protected static String getEnv(String name, String defaultValue) {
        String value = System.getenv(name);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }
    
    /**
     * Capture screenshot on test failure
     */
    private void captureScreenshot(String testName) {
        try {
            WebDriver webDriver = driver.get();
            if (webDriver != null) {
                TakesScreenshot screenshot = (TakesScreenshot) webDriver;
                File srcFile = screenshot.getScreenshotAs(OutputType.FILE);
                
                String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
                String fileName = String.format("screenshot_%s_%s.png", testName, timestamp);
                File destFile = new File("/jmeter/results/" + fileName);
                
                Files.copy(srcFile.toPath(), destFile.toPath());
                System.out.println("📸 Screenshot saved: " + fileName);
            }
        } catch (IOException e) {
            System.err.println("⚠️  Failed to capture screenshot: " + e.getMessage());
        }
    }
    
    /**
     * Generate JTL result file (like generateJTLResultFile() in test-runner.js)
     * CSV format compatible with merge-results Lambda
     */
    private void generateJTLFile() {
        String jtlPath = "/tmp/results-0.jtl";
        
        System.out.println("📝 Generating JTL result file for S3 upload...");
        
        try (FileWriter writer = new FileWriter(jtlPath)) {
            // JTL CSV header (same format as test-runner.js)
            writer.write("timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect\n");
            
            int transactionCount = 0;
            
            // Write all transactions
            for (Map.Entry<String, List<TransactionData>> entry : transactions.entrySet()) {
                String threadName = entry.getKey();
                List<TransactionData> threadTransactions = entry.getValue();
                
                for (TransactionData txn : threadTransactions) {
                    transactionCount++;
                    String responseCode = txn.success ? "200" : "500";
                    String responseMessage = txn.success ? "OK" : "Error";
                    String failureMessage = txn.success ? "" : (txn.error != null ? txn.error : "Transaction failed");
                    
                    // CSV line (same format as test-runner.js)
                    writer.write(String.format("%d,%d,%s,%s,%s,%s,text,%s,%s,0,0,1,1,,%d,0,0\n",
                        txn.timestamp,
                        txn.duration,
                        txn.name,
                        responseCode,
                        responseMessage,
                        threadName,
                        txn.success,
                        failureMessage,
                        txn.duration
                    ));
                }
            }
            
            System.out.println("✅ JTL result file saved: " + jtlPath);
            System.out.println("   - Format: CSV (compatible with merge-results Lambda)");
            System.out.println("   - Transaction Samples: " + transactionCount);
            System.out.println("   - This file will be uploaded to S3 by the container");
            
        } catch (IOException e) {
            System.err.println("⚠️  Warning: Failed to write JTL file: " + e.getMessage());
            System.err.println("   Results will not be available in S3, but test execution completed");
        }
    }
}