import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getMeetingChatService, type ChatMessage, type ChatSubscriptionCallbacks } from "../services/meetingChatService";

export interface UseMeetingChatOptions {
  meetingId: string;
  autoConnect?: boolean;
}

export interface UseMeetingChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  isConnected: boolean;
  connectionStatus: {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  };
  sendMessage: (body: string) => Promise<void>;
  editMessage: (messageId: string, newBody: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryConnection: () => void;
  clearError: () => void;
}

export function useMeetingChat({ meetingId, autoConnect = true }: UseMeetingChatOptions): UseMeetingChatReturn {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
  });

  const chatServiceRef = useRef(getMeetingChatService());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!meetingId) return;

    try {
      setLoading(true);
      clearError();
      
      const chatService = chatServiceRef.current;
      const messageList = await chatService.getMessages(meetingId);
      setMessages(messageList);
    } catch (err) {
      console.error("LOAD MESSAGES ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load messages";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [meetingId, clearError]);

  // Send message
  const sendMessage = useCallback(async (body: string) => {
    if (!user?.id || !profile?.organization_id || !meetingId) {
      setError("Missing user information");
      return;
    }

    const trimmed = body.trim();
    if (!trimmed) {
      return; // Silently ignore empty messages
    }

    try {
      setSending(true);
      clearError();

      const chatService = chatServiceRef.current;
      await chatService.sendMessage({
        meetingId,
        senderId: user.id,
        body: trimmed,
        organizationId: profile.organization_id,
      });
    } catch (err) {
      console.error("SEND MESSAGE ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      throw err; // Re-throw to let caller handle
    } finally {
      setSending(false);
    }
  }, [user?.id, profile?.organization_id, meetingId, clearError]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newBody: string) => {
    if (!user?.id) {
      setError("Missing user information");
      return;
    }

    try {
      clearError();

      const chatService = chatServiceRef.current;
      const updatedMessage = await chatService.editMessage(messageId, user.id, newBody);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? updatedMessage : msg
      ));
    } catch (err) {
      console.error("EDIT MESSAGE ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to edit message";
      setError(errorMessage);
      throw err;
    }
  }, [user?.id, clearError]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user?.id) {
      setError("Missing user information");
      return;
    }

    try {
      clearError();

      const chatService = chatServiceRef.current;
      await chatService.deleteMessage(messageId, user.id);
      
      // Update local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (err) {
      console.error("DELETE MESSAGE ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete message";
      setError(errorMessage);
      throw err;
    }
  }, [user?.id, clearError]);

  // Retry connection
  const retryConnection = useCallback(() => {
    if (!meetingId) return;

    const chatService = chatServiceRef.current;
    chatService.unsubscribe();
    
    // Force reconnection by setting up subscription again
    setupChatSubscription();
  }, [meetingId]);

  // Setup chat subscription
  const setupChatSubscription = useCallback(() => {
    if (!meetingId || !user?.id) return;

    const chatService = chatServiceRef.current;

    const callbacks: ChatSubscriptionCallbacks = {
      onMessage: (newMessage) => {
        setMessages(prev => {
          // Avoid duplicate messages
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) return prev;
          
          // Add new message and sort by timestamp
          const updated = [...prev, newMessage].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          return updated;
        });

        // Auto-scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      onError: (errorMessage) => {
        console.error("CHAT SERVICE ERROR:", errorMessage);
        setError(errorMessage);
      },
      onConnected: () => {
        setIsConnected(true);
        setConnectionStatus(chatService.getConnectionStatus());
        clearError();
      },
      onDisconnected: () => {
        setIsConnected(false);
        setConnectionStatus(chatService.getConnectionStatus());
      },
    };

    // Subscribe to chat
    unsubscribeRef.current = chatService.subscribeToChat(meetingId, callbacks);
    
    // Update initial connection status
    setConnectionStatus(chatService.getConnectionStatus());
  }, [meetingId, user?.id, clearError]);

  // Auto-connect when meetingId changes
  useEffect(() => {
    if (!autoConnect || !meetingId || !user?.id) {
      return;
    }

    // Clean up existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Load initial messages and setup subscription
    loadMessages();
    setupChatSubscription();

    return () => {
      // Cleanup subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [meetingId, user?.id, autoConnect, loadMessages, setupChatSubscription]);

  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const chatService = chatServiceRef.current;
      setConnectionStatus(chatService.getConnectionStatus());
      setIsConnected(chatService.isChatConnected());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    messages,
    loading,
    sending,
    error,
    isConnected,
    connectionStatus,
    sendMessage,
    editMessage,
    deleteMessage,
    retryConnection,
    clearError,
  };
}