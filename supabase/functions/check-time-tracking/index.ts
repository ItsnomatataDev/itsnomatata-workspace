// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10)
    
    // Get all time entries for today
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('user_id, duration_seconds, started_at')
      .gte('started_at', `${today}T00:00:00.000Z`)
      .lte('started_at', `${today}T23:59:59.999Z`)
    
    if (timeError) throw timeError
    
    // Group by user and calculate total hours
    const userHours = new Map<string, number>()
    
    for (const entry of timeEntries || []) {
      const userId = entry.user_id
      const hours = (entry.duration_seconds || 0) / 3600
      userHours.set(userId, (userHours.get(userId) || 0) + hours)
    }
    
    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, organization_id')
    
    if (profilesError) throw profilesError
    
    // Check each user and send notification if below 8 hours
    const DAILY_TARGET_HOURS = 8
    const notifications = []
    
    for (const profile of profiles || []) {
      const hours = userHours.get(profile.id) || 0
      
      // Only notify if they have some time tracked but below target
      if (hours > 0 && hours < DAILY_TARGET_HOURS) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            organization_id: profile.organization_id,
            user_id: profile.id,
            type: 'time_tracking',
            title: 'Time Tracking Below Target',
            message: `You've tracked ${hours.toFixed(1)}h today. The daily target is ${DAILY_TARGET_HOURS}h. Please log more time to meet your target.`,
            priority: 'medium',
            metadata: {
              hours_tracked: hours,
              target_hours: DAILY_TARGET_HOURS,
              date: today
            }
          })
        
        if (!notifError) {
          notifications.push({
            userId: profile.id,
            email: profile.email,
            hours: hours.toFixed(1)
          })
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${profiles?.length || 0} users, sent ${notifications.length} notifications`,
        notifications
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error checking time tracking:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/check-time-tracking' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json'

*/
