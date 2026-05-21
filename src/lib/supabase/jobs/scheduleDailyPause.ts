import { runDailyTimerPauseJob } from "./dailyTimerPause";


export function initializeDailyTimerPauseScheduler() {
  console.log("Initializing daily timer pause scheduler...");
  

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
