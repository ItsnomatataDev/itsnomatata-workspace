import { supabase } from "../../../lib/supabase/client";
import { sendBoardAssignmentNotification } from "./boardNotificationService";

export interface BoardTimeSettings {
  id: string;
  boardId: string;
  organizationId: string;
  estimatedHours?: number;
  isBillable?: boolean;
  billingType?: "hourly" | "fixed";
  hourlyRate?: number;
  fixedPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardTimeSummary {
  boardId: string;
  trackedHours: number;
  estimatedHours: number;
  remainingHours: number;
  progressPercentage: number;
  isOverBudget: boolean;
  totalCost?: number;
  billableHours?: number;
  nonBillableHours?: number;
}

// Get board time settings
export async function getBoardTimeSettings(
  boardId: string,
  organizationId: string,
): Promise<BoardTimeSettings | null> {
  try {
    const { data, error } = await supabase
      .from("board_time_settings")
      .select("*")
      .eq("board_id", boardId)
      .eq("organization_id", organizationId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // Map database column names to interface
    if (data) {
      return {
        id: data.id,
        boardId: data.board_id,
        organizationId: data.organization_id,
        estimatedHours: data.estimated_hours,
        isBillable: data.is_billable,
        billingType: data.billing_type,
        hourlyRate: data.hourly_rate,
        fixedPrice: data.fixed_price,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as BoardTimeSettings;
    }

    return null;
  } catch (error) {
    console.error("Failed to get board time settings:", error);
    return null;
  }
}

// Update board time settings
export async function updateBoardTimeSettings(
  boardId: string,
  organizationId: string,
  settings: Partial<Omit<BoardTimeSettings, "id" | "boardId" | "organizationId" | "createdAt" | "updatedAt">>,
): Promise<BoardTimeSettings> {
  try {
    console.log("Updating board time settings:", { boardId, organizationId, settings });
    
    // Debug authentication context
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log("Authentication context:", { 
      user: user ? { id: user.id, email: user.email } : null,
      authError,
      userMetadata: user?.user_metadata,
      appMetadata: user?.app_metadata
    });
    
    // Check if settings already exist
    const existing = await getBoardTimeSettings(boardId, organizationId);
    
    const updateData = {
      board_id: boardId,
      organization_id: organizationId,
      estimated_hours: settings.estimatedHours,
      is_billable: settings.isBillable,
      billing_type: settings.billingType,
      hourly_rate: settings.hourlyRate,
      fixed_price: settings.fixedPrice,
      updated_at: new Date().toISOString(),
    };
    
    console.log("Update data:", updateData);
    console.log("Existing settings:", existing);
    
    let data, error;
    
    if (existing) {
      // Update existing record
      console.log("Updating existing record...");
      const result = await supabase
        .from("board_time_settings")
        .update({
          estimated_hours: settings.estimatedHours,
          is_billable: settings.isBillable,
          billing_type: settings.billingType,
          hourly_rate: settings.hourlyRate,
          fixed_price: settings.fixedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("board_id", boardId)
        .eq("organization_id", organizationId)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new record
      console.log("Inserting new record...");
      const result = await supabase
        .from("board_time_settings")
        .insert(updateData)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Supabase error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Specific handling for RLS policy violations
      if (error.code === '42501') {
        throw new Error(`Permission denied: You don't have permission to update board time settings. This is likely due to Row Level Security (RLS) policies. Please ensure:
1. You are authenticated
2. Your user profile has the correct organization_id
3. The RLS policies have been updated (run migration: 20260422_fix_board_time_settings_rls.sql)`);
      }
      
      throw new Error(`Supabase error (${error.code}): ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from update operation");
    }

    console.log("Board time settings updated successfully:", data);
    
    // Map database column names back to interface
    return {
      id: data.id,
      boardId: data.board_id,
      organizationId: data.organization_id,
      estimatedHours: data.estimated_hours,
      isBillable: data.is_billable,
      billingType: data.billing_type,
      hourlyRate: data.hourly_rate,
      fixedPrice: data.fixed_price,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as BoardTimeSettings;
  } catch (error) {
    console.error("Failed to update board time settings:", error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unknown error updating board time settings: ${String(error)}`);
    }
  }
}

// Get board time summary
export async function getBoardTimeSummary(
  boardId: string,
  organizationId: string,
): Promise<BoardTimeSummary> {
  try {
    // Get time entries for this board
    const { data: timeEntries, error: timeError } = await supabase
      .from("time_entries")
      .select("duration_seconds, is_billable")
      .eq("client_id", boardId)
      .eq("organization_id", organizationId)
      .not("duration_seconds", "is", null);

    if (timeError) throw timeError;

    // Get board time settings
    const settings = await getBoardTimeSettings(boardId, organizationId);

    // Calculate totals
    let trackedSeconds = 0;
    let billableSeconds = 0;
    let nonBillableSeconds = 0;

    (timeEntries || []).forEach((entry: any) => {
      const seconds = entry.duration_seconds || 0;
      trackedSeconds += seconds;
      
      if (entry.is_billable) {
        billableSeconds += seconds;
      } else {
        nonBillableSeconds += seconds;
      }
    });

    const trackedHours = trackedSeconds / 3600;
    const estimatedHours = settings?.estimatedHours || 40;
    const remainingHours = Math.max(0, estimatedHours - trackedHours);
    const progressPercentage = estimatedHours > 0 ? (trackedHours / estimatedHours) * 100 : 0;
    const isOverBudget = trackedHours > estimatedHours;

    let totalCost = 0;
    if (settings?.isBillable) {
      if (settings.billingType === "hourly" && settings.hourlyRate) {
        totalCost = billableSeconds / 3600 * settings.hourlyRate;
      } else if (settings.billingType === "fixed" && settings.fixedPrice) {
        totalCost = settings.fixedPrice;
      }
    }

    return {
      boardId,
      trackedHours,
      estimatedHours,
      remainingHours,
      progressPercentage,
      isOverBudget,
      totalCost,
      billableHours: billableSeconds / 3600,
      nonBillableHours: nonBillableSeconds / 3600,
    };
  } catch (error) {
    console.error("Failed to get board time summary:", error);
    throw error;
  }
}

// Get multiple board time summaries
export async function getMultipleBoardTimeSummaries(
  boardIds: string[],
  organizationId: string,
): Promise<BoardTimeSummary[]> {
  try {
    const summaries = await Promise.all(
      boardIds.map((boardId) => getBoardTimeSummary(boardId, organizationId)),
    );
    return summaries;
  } catch (error) {
    console.error("Failed to get multiple board time summaries:", error);
    throw error;
  }
}

// Assign users to board
export async function assignUsersToBoard(
  boardId: string,
  organizationId: string,
  userIds: string[],
  boardName?: string,
  assignedBy?: string,
): Promise<void> {
  try {
    console.log("Assigning users to board:", { boardId, organizationId, userIds, boardName, assignedBy });
    
    if (!userIds || userIds.length === 0) {
      console.log("No users to assign");
      return;
    }

    // First, remove existing assignments for this board to avoid duplicates
    console.log("Removing existing assignments...");
    const { error: deleteError } = await supabase
      .from("board_assignments")
      .delete()
      .eq("board_id", boardId)
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Failed to remove existing assignments:", deleteError);
      // Don't throw here, continue with new assignments
    }

    // Create new assignments
    const assignments = userIds.map((userId) => ({
      board_id: boardId,
      organization_id: organizationId,
      user_id: userId,
    }));

    console.log("Inserting new assignments:", assignments);

    const { data, error } = await supabase
      .from("board_assignments")
      .insert(assignments)
      .select();

    if (error) {
      console.error("Failed to assign users to board:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to assign users: ${error.message}`);
    }

    console.log("Users assigned successfully:", data);

    // Send notifications to assigned users
    if (boardName && assignedBy) {
      console.log("Sending notifications to users...");
      for (const userId of userIds) {
        try {
          await sendBoardAssignmentNotification(boardId, userId, assignedBy, boardName);
        } catch (notificationError) {
          console.error("Failed to send notification to user:", userId, notificationError);
          // Don't fail the whole operation if notification fails
        }
      }
    }

    console.log("User assignment completed successfully");
  } catch (error) {
    console.error("Error assigning users to board:", error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unknown error assigning users: ${String(error)}`);
    }
  }
}

// Get board assignments
export async function getBoardAssignments(
  boardId: string,
  organizationId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("board_assignments")
      .select("user_id")
      .eq("board_id", boardId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    return (data || []).map((assignment: any) => assignment.user_id);
  } catch (error) {
    console.error("Failed to get board assignments:", error);
    return [];
  }
}

// Get user's assigned boards
export async function getUserAssignedBoards(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("board_assignments")
      .select("board_id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId);

    if (error) throw error;

    return (data || []).map((assignment: any) => assignment.board_id);
  } catch (error) {
    console.error("Failed to get user assigned boards:", error);
    return [];
  }
}
