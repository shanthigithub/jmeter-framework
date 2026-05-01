package com.testframework.base;

import java.io.FileWriter;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * TestNG Framework Runner - Programmatic Parallel Execution ONLY
 * 
 * Java equivalent of lib/test-runner.js (Playwright version)
 * Provides ONLY programmatic parallel test execution (NO testng.xml, NO @Test annotations)
 * 
 * Key Features:
 * - Programmatic parallel test execution (like JMeter Thread Groups)
 * - Transaction timing similar to JMeter Transaction Controllers
 * - Automatic JTL result file generation
 * - Exception propagation (NO suppression - tests fail when they should!)
 * 
 * Usage (Programmatic ONLY - matches Playwright exactly):
 * 
 *   public static void main(String[] args) {
 *       TestResults results = TestNGRunner.runParallelTest(
 *           (userId, iteration) -> runMyTest(userId, iteration),
 *           parallelUsers,
 *           iterations,
 *           rampUpTime,
 *           thinkTime
 *       );
 *       System.exit(results.totalFailures > 0 ? 1 : 0);
 *   }
 * 
 *   private static void runMyTest(int userId, int iteration) throws Exception {
 *       WebDriver driver = timedActionStatic("Step_001_Setup", () -> {
 *           WebDriverManager.chromedriver().setup();
 *           ChromeOptions options = new ChromeOptions();
 *           options.addArguments("--headless");
 *           return new ChromeDriver(options);
 *       });
 *       
 *       try {
 *           timedActionStatic("Step_002_Login", () -> {
 *               driver.get("https://example.com");
 *               // Login logic - exceptions propagate automatically!
 *           });
 *       } finally {
 *           driver.quit();
 *       }
 *   }
 */
public class TestNGRunner {
    
    // ============================================================
    // STATIC FIELDS (for programmatic execution)
    // ============================================================
    private static final Map<String, List<TransactionData>> transactions = new ConcurrentHashMap<>();
    private static final AtomicInteger totalExecutions = new AtomicInteger(0);
    private static final AtomicInteger totalSuccesses = new AtomicInteger(0);
    private static final AtomicInteger totalFailures = new AtomicInteger(0);
    
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
    
    // ============================================================
    // STATIC METHODS (Programmatic Execution - Like Playwright)
    // ============================================================
    
    /**
     * Execute a timed action (static version for programmatic execution)
     * Automatically tracks timing and stores transaction data
     * IMPORTANT: Exceptions are propagated (NOT suppressed) - this is correct behavior!
     * 
     * @param actionName Name of the action (e.g., "Step_001_Login")
     * @param action Action to execute
     */
    public static void timedActionStatic(String actionName, Runnable action) {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            action.run();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            storeTransaction(actionName, startTime, duration, true, null);
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            storeTransaction(actionName, startTime, duration, false, e.getMessage());
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            
            // IMPORTANT: Rethrow exception (like Playwright) - DO NOT suppress!
            throw e;
        }
    }
    
    /**
     * Execute a timed action that returns a value (static version)
     * IMPORTANT: Exceptions are propagated (NOT suppressed)
     * 
     * @param actionName Name of the action
     * @param action Supplier lambda that returns a value
     * @return The result from the supplier
     */
    public static <T> T timedActionStatic(String actionName, java.util.function.Supplier<T> action) {
        String threadName = Thread.currentThread().getName();
        long startTime = System.currentTimeMillis();
        
        try {
            T result = action.get();
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            storeTransaction(actionName, startTime, duration, true, null);
            System.out.println(String.format("   ✅ [%dms] %s", duration, actionName));
            
            return result;
            
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            storeTransaction(actionName, startTime, duration, false, e.getMessage());
            System.out.println(String.format("   ❌ [%dms] %s - %s", duration, actionName, e.getMessage()));
            
            // IMPORTANT: Rethrow exception (like Playwright) - DO NOT suppress!
            throw e;
        }
    }
    
    /**
     * User test function interface (like Playwright's testFunction parameter)
     */
    @FunctionalInterface
    public interface UserTestFunction {
        void run(int userId, int iteration) throws Exception;
    }
    
    /**
     * Run parallel test execution (like Playwright's runParallelTest())
     * This is the Java equivalent of runParallelTest() in lib/test-runner.js
     * 
     * @param testFunction Function to execute for each user/iteration
     * @param parallelUsers Number of parallel users
     * @param iterations Iterations per user
     * @param rampUpTime Ramp-up time in seconds
     * @param thinkTime Think time between iterations in milliseconds
     * @return TestResults with summary statistics
     */
    public static TestResults runParallelTest(
            UserTestFunction testFunction,
            int parallelUsers,
            int iterations,
            int rampUpTime,
            int thinkTime) {
        
        System.out.println("\n🚀 Starting Parallel Test");
        System.out.println("📊 Configuration:");
        System.out.println("   - Parallel Users: " + parallelUsers);
        System.out.println("   - Iterations per User: " + iterations);
        System.out.println("   - Think Time: " + thinkTime + "ms");
        System.out.println("   - Total Executions: " + (parallelUsers * iterations));
        
        long delayBetweenUsers = 0;
        if (rampUpTime > 0 && parallelUsers > 1) {
            delayBetweenUsers = (long)((rampUpTime * 1000.0) / (parallelUsers - 1));
            System.out.println("   - Ramp-Up Time: " + rampUpTime + "s (" + delayBetweenUsers + "ms between user starts)");
        }
        
        System.out.println("\n🚀 Launching " + parallelUsers + " parallel users" + 
            (rampUpTime > 0 ? " with ramp-up" : "") + "...\n");
        
        long testStart = System.currentTimeMillis();
        ExecutorService executor = Executors.newFixedThreadPool(parallelUsers);
        List<Future<?>> futures = new ArrayList<>();
        
        // Launch users with optional ramp-up delay
        for (int userId = 1; userId <= parallelUsers; userId++) {
            final int user = userId;
            final long delay = (userId > 1 && delayBetweenUsers > 0) ? delayBetweenUsers : 0;
            
            futures.add(executor.submit(() -> {
                try {
                    // Apply ramp-up delay
                    if (delay > 0) {
                        System.out.println("⏱️  Ramp-up: Starting User " + user + " after " + delay + "ms delay...");
                        Thread.sleep(delay);
                    }
                    
                    String threadName = "User " + user;
                    System.out.println("\n" + "=".repeat(60));
                    System.out.println("👤 " + threadName + " STARTING");
                    System.out.println("=".repeat(60));
                    
                    // Initialize transaction storage for this user
                    transactions.putIfAbsent(threadName, new ArrayList<>());
                    
                    // Run iterations (like Playwright)
                    int successCount = 0;
                    int failureCount = 0;
                    
                    for (int iteration = 1; iteration <= iterations; iteration++) {
                        try {
                            System.out.println("\n👤 User " + user + ": Starting iteration " + 
                                iteration + "/" + iterations);
                            
                            // Execute test - exceptions are caught here per iteration
                            testFunction.run(user, iteration);
                            
                            successCount++;
                            totalSuccesses.incrementAndGet();
                            System.out.println("👤 User " + user + ": Iteration " + iteration + " completed ✅");
                            
                            // Think time between iterations
                            if (iteration < iterations && thinkTime > 0) {
                                System.out.println("👤 User " + user + ": Waiting " + thinkTime + 
                                    "ms before next iteration...");
                                Thread.sleep(thinkTime);
                            }
                            
                        } catch (Exception e) {
                            failureCount++;
                            totalFailures.incrementAndGet();
                            System.err.println("❌ User " + user + ": Iteration " + iteration + 
                                " FAILED: " + e.getMessage());
                            e.printStackTrace();
                        }
                    }
                    
                    totalExecutions.addAndGet(successCount + failureCount);
                    
                    System.out.println("\n" + "=".repeat(60));
                    System.out.println("👤 " + threadName + " COMPLETED");
                    System.out.println("   Iterations: " + iterations);
                    System.out.println("   Successful: " + successCount + " ✅");
                    System.out.println("   Failed: " + failureCount + " ❌");
                    System.out.println("=".repeat(60) + "\n");
                    
                } catch (Exception e) {
                    System.err.println("❌ User " + user + " FAILED: " + e.getMessage());
                    e.printStackTrace();
                }
            }));
        }
        
        // Wait for all users to complete
        for (Future<?> future : futures) {
            try {
                future.get();
            } catch (Exception e) {
                System.err.println("Error waiting for user: " + e.getMessage());
            }
        }
        
        executor.shutdown();
        try {
            executor.awaitTermination(30, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        long totalDuration = System.currentTimeMillis() - testStart;
        
        // Print final summary (like Playwright)
        printFinalSummary(parallelUsers, iterations, totalDuration);
        
        // Generate JTL file for S3 upload (like Playwright)
        generateJTLFile();
        
        return new TestResults(totalExecutions.get(), totalSuccesses.get(), 
            totalFailures.get(), totalDuration);
    }
    
    /**
     * Print final test summary (like Playwright's final summary)
     */
    private static void printFinalSummary(int parallelUsers, int iterations, long totalDuration) {
        System.out.println("\n" + "=".repeat(70));
        System.out.println("📊 FINAL TEST SUMMARY");
        System.out.println("=".repeat(70));
        System.out.println("Parallel Users: " + parallelUsers);
        System.out.println("Iterations per User: " + iterations);
        System.out.println("Total Executions: " + totalExecutions.get());
        System.out.println("Total Successful: " + totalSuccesses.get() + " ✅");
        System.out.println("Total Failed: " + totalFailures.get() + " ❌");
        
        if (totalExecutions.get() > 0) {
            double successRate = (totalSuccesses.get() * 100.0) / totalExecutions.get();
            System.out.println("Overall Success Rate: " + String.format("%.1f", successRate) + "%");
        }
        
        System.out.println("Total Test Duration: " + (totalDuration / 1000.0) + "s");
        System.out.println("=".repeat(70) + "\n");
    }
    
    /**
     * Test results class (like Playwright's return value)
     */
    public static class TestResults {
        public final int totalExecutions;
        public final int totalSuccesses;
        public final int totalFailures;
        public final long totalDuration;
        
        public TestResults(int executions, int successes, int failures, long duration) {
            this.totalExecutions = executions;
            this.totalSuccesses = successes;
            this.totalFailures = failures;
            this.totalDuration = duration;
        }
    }
    
    /**
     * Static helper to store transaction from any thread
     */
    private static void storeTransaction(String actionName, long startTime, long duration, boolean success, String error) {
        String threadName = Thread.currentThread().getName();
        transactions.putIfAbsent(threadName, new ArrayList<>());
        transactions.get(threadName).add(new TransactionData(actionName, startTime, duration, success, error));
    }
    
    /**
     * Generate JTL result file (like generateJTLResultFile() in test-runner.js)
     * CSV format compatible with merge-results Lambda
     */
    private static void generateJTLFile() {
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