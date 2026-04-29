/**
 * Test Runner Framework
 * Common test execution framework for parallel browser/API tests
 * 
 * This module provides reusable utilities for running performance tests with:
 * - Parallel user execution (like JMeter Thread Groups)
 * - Sequential iterations per user
 * - Transaction timing (like JMeter Transaction Controllers)
 * - Automatic statistics collection
 * - Formatted console reporting
 * 
 * @example
 * const { runParallelTest, timedAction } = require('../lib/test-runner');
 * 
 * async function myTest(userId, iteration) {
 *   const result = await timedAction(userId, 'Login', async () => {
 *     // Your test logic here
 *     return { token: 'abc123' };
 *   });
 *   
 *   return { 
 *     success: true, 
 *     userId, 
 *     iteration,
 *     actionTimings: [result]
 *   };
 * }
 * 
 * const config = {
 *   parallelUsers: 10,
 *   iterations: 3,
 *   thinkTime: 2000
 * };
 * 
 * const results = await runParallelTest(myTest, config);
 * process.exit(results.totalFailures > 0 ? 1 : 0);
 */

/**
 * TransactionTimer - Measures elapsed time for individual actions
 * Similar to JMeter's Transaction Controller
 */
class TransactionTimer {
  constructor(userId, actionName) {
    this.userId = userId;
    this.actionName = actionName;
    this.startTime = Date.now();
  }
  
  /**
   * End the timer and return timing data
   * @param {string} status - 'success' or 'failed'
   * @returns {Object} Timing data with action name, elapsed time, status, timestamp
   */
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
 * Execute an action with automatic timing and error handling
 * @param {number} userId - User identifier
 * @param {string} actionName - Name of the action being timed
 * @param {Function} actionFn - Async function to execute
 * @returns {Object} Timing data plus result from actionFn
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
 * Run a single user through all iterations
 * @param {number} userId - User identifier
 * @param {Function} testFunction - Test function to execute (async function(userId, iteration))
 * @param {Object} config - Configuration with iterations and thinkTime
 * @returns {Object} Results for this user including all iterations
 */
async function runUserWorkload(userId, testFunction, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👤 USER ${userId} STARTING`);
  console.log(`${'='.repeat(60)}`);
  
  const userResults = [];
  
  for (let iteration = 1; iteration <= config.iterations; iteration++) {
    console.log(`\n👤 User ${userId}: Starting iteration ${iteration}/${config.iterations}`);
    const result = await testFunction(userId, iteration);
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
 * Run parallel users with automatic statistics collection
 * @param {Function} testFunction - Test function to execute for each user/iteration
 * @param {Object} config - Configuration object with parallelUsers, iterations, thinkTime
 * @returns {Object} Complete test results with statistics
 */
async function runParallelTest(testFunction, config) {
  const testStart = Date.now();
  
  console.log('🚀 Starting Parallel Test');
  console.log(`📊 Configuration:`);
  console.log(`   - Parallel Users: ${config.parallelUsers}`);
  console.log(`   - Iterations per User: ${config.iterations}`);
  console.log(`   - Think Time: ${config.thinkTime}ms`);
  console.log(`   - Total Executions: ${config.parallelUsers * config.iterations}`);
  if (config.testName) {
    console.log(`   - Test Name: ${config.testName}`);
  }
  
  console.log(`\n🚀 Launching ${config.parallelUsers} parallel users...\n`);
  
  // Launch all users in parallel
  const userPromises = [];
  for (let userId = 1; userId <= config.parallelUsers; userId++) {
    userPromises.push(runUserWorkload(userId, testFunction, config));
  }
  
  // Wait for all users to complete
  const userResults = await Promise.all(userPromises);
  
  // Calculate statistics
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
      if (result.success && result.duration) {
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
  
  return {
    userResults,
    totalExecutions,
    totalSuccesses,
    totalFailures,
    totalDuration
  };
}

module.exports = {
  timedAction,
  runParallelTest,
  TransactionTimer
};