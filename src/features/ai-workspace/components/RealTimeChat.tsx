import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Copy,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ChatHistoryService, type ChatMessage, type ChatConversation } from "../services/chatHistoryService";
import { useAuth } from "../../../app/providers/AuthProvider";

interface RealTimeChatProps {
  busy: boolean;
  userName?: string | null;
  role?: string | null;
  onAsk: (prompt: string) => Promise<{ content: string }>;
}

// Message Bubble Component
function MessageBubble({
  message,
  userName,
  onDelete,
}: {
  message: ChatMessage;
  userName?: string | null;
  onDelete?: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = () => {
    if (onDelete && message.id) {
      onDelete(message.id);
    }
  };

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-3 group">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-orange-500 px-4 py-3 text-sm leading-relaxed text-white shadow-lg shadow-orange-500/10">
            {message.content}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-white/25">
            <span>{formatTime(message.createdAt)}</span>
            {onDelete && (
              <button
                onClick={handleDelete}
                className="opacity-0 hover:opacity-100 transition-opacity"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
          <User size={14} className="text-white/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500/30 to-orange-600/20 ring-1 ring-orange-500/20">
        <Bot size={14} className="text-orange-400" />
      </div>
      <div className="max-w-[80%] space-y-1">
        <div className="rounded-2xl rounded-bl-sm border border-white/8 bg-white/5 px-4 py-3">
          <div className="text-sm leading-relaxed text-white/90">
            {message.content}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <span>{formatTime(message.createdAt)}</span>
          <button
            onClick={handleCopy}
            className="opacity-0 hover:opacity-100 transition-opacity flex items-center gap-1"
          >
            <Copy size={10} />
            {copied && <span>Copied!</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Chat Sidebar Component
function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  searchQuery,
  onSearch,
}: {
  conversations: ChatConversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
}) {
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-white/10 bg-black/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Chat History</h3>
        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Plus size={16} className="text-white/60" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
        />
      </div>

      {/* Conversations List */}
      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`p-3 rounded-lg cursor-pointer transition-colors group ${
              activeConversationId === conversation.id
                ? "bg-orange-500/20 border border-orange-500/30"
                : "hover:bg-white/5 border border-transparent"
            }`}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white truncate">
                {conversation.title}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conversation.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
              >
                <Trash2 size={12} className="text-red-400" />
              </button>
            </div>
            <p className="text-xs text-white/40 mt-1">
              {new Date(conversation.updatedAt).toLocaleDateString()}
            </p>
            {conversation.metadata?.totalMessages && (
              <p className="text-xs text-white/30 mt-1">
                {conversation.metadata.totalMessages} messages
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500/30 to-orange-600/20 ring-1 ring-orange-500/20">
        <Bot size={14} className="text-orange-400" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-white/8 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// Helper functions
function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHAT_STARTERS = [
  {
    icon: "Task",
    label: "Help with tasks",
    prompt: "Can you help me organize my tasks for today?",
  },
  {
    icon: "Report",
    label: "Generate report",
    prompt: "Generate a summary of my recent work and progress",
  },
  {
    icon: "Question",
    label: "Ask anything",
    prompt: "I have a question about my work. Can you help?",
  },
  {
    icon: "Plan",
    label: "Plan my day",
    prompt: "Help me plan my day based on my current priorities",
  },
];

export default function RealTimeChat({
  busy,
  userName,
  role,
  onAsk,
}: RealTimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const userId = auth?.user?.id;

  // Load conversations on mount
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    if (!userId) return;
    
    try {
      const { conversations } = await ChatHistoryService.getUserConversations({
        userId,
        limit: 50,
      });
      setConversations(conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
      setError("Failed to load conversations");
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const session = await ChatHistoryService.getChatSession({
        conversationId,
        userId,
        limit: 100,
      });
      
      setMessages(session.messages);
      setActiveConversationId(conversationId);
      setShowStarters(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  const createNewConversation = async () => {
    if (!userId) return;
    
    try {
      const conversation = await ChatHistoryService.createConversation({
        userId,
        title: "New Chat",
        role: role || undefined,
      });
      
      setConversations([conversation, ...conversations]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setShowStarters(true);
      setError(null);
    } catch (error) {
      console.error("Error creating conversation:", error);
      setError("Failed to create new conversation");
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) return;
    
    try {
      await ChatHistoryService.deleteConversation(conversationId);
      setConversations(conversations.filter(c => c.id !== conversationId));
      
      if (activeConversationId === conversationId) {
        setActiveConversationId(undefined);
        setMessages([]);
        setShowStarters(true);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      setError("Failed to delete conversation");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userId) return;
    
    try {
      await ChatHistoryService.deleteMessage({ messageId, userId });
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      setError("Failed to delete message");
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || busy || !userId) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: makeId(),
      conversationId: activeConversationId || "",
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
      userId,
    };

    // Create conversation if none exists
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const conversation = await ChatHistoryService.createConversation({
          userId,
          title: input.slice(0, 50) || "New Chat",
          role: role || undefined,
        });
        conversationId = conversation.id;
        setActiveConversationId(conversationId);
        setConversations([conversation, ...conversations]);
      } catch (error) {
        console.error("Error creating conversation:", error);
        setError("Failed to create conversation");
        return;
      }
    }

    // Add user message to UI
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setShowStarters(false);

    // Save user message to history
    try {
      await ChatHistoryService.addMessage({
        conversationId,
        role: "user",
        content: userMessage.content,
        userId,
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }

    // Add typing indicator
    const typingMessage: ChatMessage = {
      id: makeId(),
      conversationId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      userId,
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await onAsk(input.trim());
      
      if (response) {
        // Remove typing indicator
        setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
        
        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: makeId(),
          conversationId,
          role: "assistant",
          content: response.content,
          createdAt: new Date().toISOString(),
          userId,
        };
        
        setMessages(prev => [...prev, assistantMessage]);

        // Save assistant response to history
        try {
          await ChatHistoryService.addMessage({
            conversationId,
            role: "assistant",
            content: response.content,
            userId,
            metadata: {
              model: "gpt-4",
              tokens: response.content.length,
            },
          });
        } catch (error) {
          console.error("Error saving assistant message:", error);
        }
      }
    } catch (error) {
      // Remove typing indicator and show error
      setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
      setError("Failed to get response. Please try again.");
    }
  }, [input, busy, userId, activeConversationId, role, onAsk, conversations]);

  const handleStarterClick = (starter: typeof CHAT_STARTERS[0]) => {
    setInput(starter.prompt);
    setShowStarters(false);
  };

  return (
    <div className="flex h-full bg-black">
      {/* Sidebar */}
      {showSidebar && (
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={loadConversation}
          onNewConversation={createNewConversation}
          onDeleteConversation={deleteConversation}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <History size={16} className="text-white/60" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
              <p className="text-xs text-white/40">
                {role && `Role: ${role}`} {userName && `· ${userName}`}
              </p>
            </div>
          </div>
          <button
            onClick={createNewConversation}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm text-white transition-colors"
          >
            New Chat
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-300 hover:text-red-200"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-orange-400" />
            </div>
          ) : showStarters && messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center">
                <Sparkles size={48} className="text-orange-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  How can I help you today?
                </h3>
                <p className="text-white/60 mb-6">
                  Ask me anything about your work, tasks, or get help with planning
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {CHAT_STARTERS.map((starter, index) => (
                  <button
                    key={index}
                    onClick={() => handleStarterClick(starter)}
                    className="p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{starter.icon}</span>
                      <span className="text-sm font-medium text-white">
                        {starter.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/60">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                userName={userName}
                onDelete={message.role === "user" ? deleteMessage : undefined}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:border-orange-500/50"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || busy}
              className="p-3 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <ArrowUp size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
