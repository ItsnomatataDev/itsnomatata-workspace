import { supabase } from "../../../lib/supabase/client";
import type { MeetingMessage } from "../types/meeting";

export interface ChatMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface SendMessageParams {
  meetingId: string;
  senderId: string;
  body: string;
  organizationId: string;
}

export interface ChatSubscriptionCallbacks {
  onMessage: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export class MeetingChatService {
  private channel: any = null;
  private meetingId: string | null = null;
  private callbacks: ChatSubscriptionCallbacks | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: number | null = null;

  /**
   * Send a message to the meeting chat
   */
  async sendMessage(params: SendMessageParams): Promise<ChatMessage> {
    const trimmed = params.body.trim();
    if (!trimmed) {
      throw new Error("Message cannot be empty");
    }

    if (!params.meetingId || !params.senderId || !params.organizationId) {
      throw new Error("Missing required parameters");
    }

    try {
      const { data, error } = await supabase
        .from("meeting_messages")
        .insert({
          meeting_id: params.meetingId,
          sender_id: params.senderId,
          body: trimmed,
        })
        .select(`
          *,
          sender:profiles!meeting_messages_sender_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .single();

      if (error) {
        console.error("CHAT SEND ERROR:", error);
        throw new Error(`Failed to send message: ${error.message}`);
      }

      if (!data) {
        throw new Error("No data returned from message insert");
      }

      return data as ChatMessage;
    } catch (error) {
      console.error("CHAT SERVICE SEND ERROR:", error);
      throw error;
    }
  }

  /**
   * Get all messages for a meeting
   */
  async getMessages(meetingId: string): Promise<ChatMessage[]> {
    if (!meetingId) {
      throw new Error("Meeting ID is required");
    }

    try {
      const { data, error } = await supabase
        .from("meeting_messages")
        .select(`
          *,
          sender:profiles!meeting_messages_sender_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("CHAT GET MESSAGES ERROR:", error);
        throw new Error(`Failed to get messages: ${error.message}`);
      }

      return (data || []) as ChatMessage[];
    } catch (error) {
      console.error("CHAT SERVICE GET MESSAGES ERROR:", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time chat updates for a meeting
   */
  subscribeToChat(meetingId: string, callbacks: ChatSubscriptionCallbacks): () => void {
    if (!meetingId) {
      throw new Error("Meeting ID is required");
    }

    // Clean up existing subscription
    this.unsubscribe();

    this.meetingId = meetingId;
    this.callbacks = callbacks;
    this.isConnected = false;
    this.reconnectAttempts = 0;

    this.setupSubscription();
    return this.unsubscribe.bind(this);
  }

  private setupSubscription() {
    if (!this.meetingId || !this.callbacks) {
      return;
    }

    const channelName = `meeting-chat:${this.meetingId}`;
    this.channel = supabase.channel(channelName);

    // Listen for new messages
    this.channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "meeting_messages",
        filter: `meeting_id=eq.${this.meetingId}`,
      },
      (payload: any) => {
        if (payload.new && this.callbacks) {
          this.callbacks.onMessage(payload.new as ChatMessage);
        }
      }
    );

    // Handle connection state changes
    this.channel.subscribe((status: string) => {
      console.log(`CHAT SUBSCRIPTION STATUS: ${status}`);
      
      switch (status) {
        case "SUBSCRIBED":
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.callbacks?.onConnected?.();
          break;
        case "CHANNEL_ERROR":
        case "TIMED_OUT":
        case "CLOSED":
          this.isConnected = false;
          this.callbacks?.onDisconnected?.();
          this.handleReconnect();
          break;
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.callbacks?.onError?.("Chat connection failed after multiple attempts");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`CHAT RECONNECT ATTEMPT ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      if (this.meetingId && this.callbacks) {
        this.setupSubscription();
      }
    }, delay);
  }

  /**
   * Unsubscribe from chat updates
   */
  unsubscribe() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.isConnected = false;
    this.meetingId = null;
    this.callbacks = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if chat is connected
   */
  isChatConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }

  /**
   * Delete a message (for moderators/hosts)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!messageId || !userId) {
      throw new Error("Message ID and user ID are required");
    }

    try {
      const { error } = await supabase
        .from("meeting_messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", userId); // Only allow sender to delete their own messages

      if (error) {
        console.error("CHAT DELETE ERROR:", error);
        throw new Error(`Failed to delete message: ${error.message}`);
      }
    } catch (error) {
      console.error("CHAT SERVICE DELETE ERROR:", error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, userId: string, newBody: string): Promise<ChatMessage> {
    const trimmed = newBody.trim();
    if (!trimmed) {
      throw new Error("Message cannot be empty");
    }

    if (!messageId || !userId) {
      throw new Error("Message ID and user ID are required");
    }

    try {
      const { data, error } = await supabase
        .from("meeting_messages")
        .update({
          body: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .eq("sender_id", userId) // Only allow sender to edit their own messages
        .select(`
          *,
          sender:profiles!meeting_messages_sender_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .single();

      if (error) {
        console.error("CHAT EDIT ERROR:", error);
        throw new Error(`Failed to edit message: ${error.message}`);
      }

      if (!data) {
        throw new Error("No data returned from message update");
      }

      return data as ChatMessage;
    } catch (error) {
      console.error("CHAT SERVICE EDIT ERROR:", error);
      throw error;
    }
  }
}

// Singleton instance for global use
let chatServiceInstance: MeetingChatService | null = null;

export function getMeetingChatService(): MeetingChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new MeetingChatService();
  }
  return chatServiceInstance;
}

// Utility functions
export function formatChatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString();
}

export function isMessageFromToday(dateString: string): boolean {
  const messageDate = new Date(dateString);
  const today = new Date();
  return messageDate.toDateString() === today.toDateString();
}

export function truncateMessage(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + "...";
}