import { supabase } from "../client";
import { pauseRunningTimersAt6pmForOrganization } from "../mutations/timeEntries";
import { isAtOrAfterZimbabwePause } from "../../utils/zimbabweCalendar";


export async function runDailyTimerPauseJob() {
  try {
  
    if (!isAtOrAfterZimbabwePause(new Date(), "18:00:00")) {
      console.log("Timer pause job skipped: Not yet 6 PM Harare time");
      return {
        success: true,
        message: "Not yet 6 PM Harare time",
        pausedCount: 0,
        organizationsProcessed: 0,
      };
    }


    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("is_active", true);

    if (orgError) {
      throw new Error(`Failed to fetch organizations: ${orgError.message}`);
    }

    let totalPaused = 0;
    const results: Array<{
      organizationId: string;
      organizationName: string | null;
      pausedCount: number;
      error?: string;
    }> = [];

    for (const org of organizations ?? []) {
      try {
        const pausedCount = await pauseRunningTimersAt6pmForOrganization(org.id);
        totalPaused += pausedCount;
        
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          pausedCount,
        });

        if (pausedCount > 0) {
          console.log(`Paused ${pausedCount} timers for organization: ${org.name || org.id}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed to pause timers for organization ${org.id}:`, errorMessage);
        
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          pausedCount: 0,
          error: errorMessage,
        });
      }
    }

    return {
      success: true,
      message: `Daily timer pause completed. Paused ${totalPaused} timers across ${organizations?.length || 0} organizations`,
      pausedCount: totalPaused,
      organizationsProcessed: organizations?.length || 0,
      results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Daily timer pause job failed:", errorMessage);
    
    return {
      success: false,
      message: `Daily timer pause job failed: ${errorMessage}`,
      pausedCount: 0,
      organizationsProcessed: 0,
      error: errorMessage,
    };
  }
}

export async function pauseTimersForOrganization(organizationId: string) {
  try {
    const pausedCount = await pauseRunningTimersAt6pmForOrganization(organizationId);
    
    return {
      success: true,
      message: `Paused ${pausedCount} timers for organization ${organizationId}`,
      pausedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to pause timers: ${errorMessage}`,
      pausedCount: 0,
      error: errorMessage,
    };
  }
}

export function shouldRunDailyPauseJob() {
  return isAtOrAfterZimbabwePause(new Date(), "18:00:00");
}
