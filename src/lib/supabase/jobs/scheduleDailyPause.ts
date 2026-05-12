import { runDailyTimerPauseJob } from "./dailyTimerPause";

/**
 * Initialize the daily timer pause scheduler
 * This function sets up an interval to check every minute if it's 6 PM Harare time
 * and runs the pause job if needed.
 * 
 * Call this function when your app starts (e.g., in your main app initialization)
 */
export function initializeDailyTimerPauseScheduler() {
  console.log("Initializing daily timer pause scheduler...");
  
  // Check every minute
  const intervalId = setInterval(async () => {
    try {
      const result = await runDailyTimerPauseJob();
      
      // Log results only when timers were actually paused
      if (result.pausedCount > 0) {
        console.log(`Daily timer pause job executed: ${result.message}`);
      }
    } catch (error) {
      console.error("Error in daily timer pause scheduler:", error);
    }
  }, 60000); // Check every minute (60,000ms)

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log("Daily timer pause scheduler stopped");
  };
}

/**
 * Manual trigger for the daily pause job
 * Useful for testing or manual execution
 */
export async function triggerDailyPauseJob() {
  console.log("Manually triggering daily timer pause job...");
  const result = await runDailyTimerPauseJob();
  console.log("Daily timer pause job result:", result);
  return result;
}
