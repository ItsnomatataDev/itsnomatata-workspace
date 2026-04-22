import { supabase } from "../../../lib/supabase/client";

export interface BoardAssignmentNotification {
  id: string;
  board_id: string;
  user_id: string;
  assigned_by: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Send notification when user is assigned to board
export async function sendBoardAssignmentNotification(
  boardId: string,
  userId: string,
  assignedBy: string,
  boardName: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("board_notifications")
      .insert({
        board_id: boardId,
        user_id: userId,
        assigned_by: assignedBy,
        message: `You have been assigned to board: ${boardName}`,
        read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Failed to send board assignment notification:", error);
    }
  } catch (error) {
    console.error("Error sending board assignment notification:", error);
  }
}

// Get unread notifications for user
export async function getUnreadNotifications(userId: string): Promise<BoardAssignmentNotification[]> {
  try {
    const { data, error } = await supabase
      .from("board_notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("read", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as BoardAssignmentNotification[];
  } catch (error) {
    console.error("Failed to get unread notifications:", error);
    return [];
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("board_notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Failed to mark notification as read:", error);
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

// Create notification table if it doesn't exist
export async function ensureNotificationTable(): Promise<void> {
  try {
    const { error } = await supabase.rpc('create_board_notifications_table_if_not_exists');
    if (error) {
      console.error("Failed to ensure notification table:", error);
    }
  } catch (error) {
    console.error("Error creating notification table:", error);
  }
}
