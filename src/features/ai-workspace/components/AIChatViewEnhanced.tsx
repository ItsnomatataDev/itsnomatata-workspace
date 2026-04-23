import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
  History,
  Plus,
} from "lucide-react";
import { ChatHistoryService, type ChatMessage, type ChatConversation, type ChatAttachment } from "../services/chatHistoryService";
import { ImageUploadService, type UploadResult } from "../services/imageUploadService";
import { useAuth } from "../../../app/providers/AuthProvider";

interface EnhancedChatMessage extends ChatMessage {
  pending?: boolean;
  error?: boolean;
}

interface AIChatViewEnhancedProps {
  busy: boolean;
  userName?: string | null;
  role?: string | null;
  onAsk: (prompt: string, attachments?: ChatAttachment[]) => Promise<{ content: string } | void>;
}

// Message Bubble Component with Image Support
function MessageBubble({
  message,
  userName,
  onDelete,
}: {
  message: EnhancedChatMessage;
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
            {/* Render image attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-w-full rounded-lg shadow-md"
                      style={{ maxHeight: "300px" }}
                    />
                    {attachment.metadata?.width && attachment.metadata?.height && (
                      <p className="text-xs text-white/70 mt-1">
                        {attachment.metadata.width} × {attachment.metadata.height}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
          {message.pending ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-orange-400" />
              <span className="text-white/60">Thinking...</span>
            </div>
          ) : message.error ? (
            <div className="text-red-400">
              <p>Sorry, something went wrong. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-red-300 underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-white/90">
              {message.content}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <span>{formatTime(message.createdAt)}</span>
          {!message.pending && !message.error && (
            <button
              onClick={handleCopy}
              className="opacity-0 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <Copy size={10} />
              {copied && <span>Copied!</span>}
            </button>
          )}
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
  onSearch,
}: {
  conversations: ChatConversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSearch: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-white/10 bg-black/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Chat History</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Search size={16} className="text-white/60" />
          </button>
          <button
            onClick={onNewConversation}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Plus size={16} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
          />
        </div>
      )}

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

// Image Upload Component
function ImageUploadArea({
  onImagesSelected,
  onRemoveImage,
  selectedImages,
}: {
  onImagesSelected: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  selectedImages: File[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length > 0) {
      onImagesSelected(imageFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="space-y-2">
      {/* Selected Images Preview */}
      {selectedImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedImages.map((file, index) => (
            <div key={index} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-16 h-16 object-cover rounded-lg border border-white/20"
              />
              <button
                onClick={() => onRemoveImage(index)}
                className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver 
            ? "border-orange-500 bg-orange-500/10" 
            : "border-white/20 hover:border-white/40"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <ImageIcon size={24} className="text-white/40 mx-auto mb-2" />
        <p className="text-sm text-white/60">
          Drag & drop images here or click to select
        </p>
        <p className="text-xs text-white/40 mt-1">
          PNG, JPG, GIF up to 10MB
        </p>
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

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STARTERS = [
  {
    icon: "Image",
    label: "Analyze an image",
    prompt: "I've uploaded an image. Please analyze it for me.",
  },
  {
    icon: "History",
    label: "Continue our conversation",
    prompt: "Continue our previous conversation about...",
  },
  {
    icon: "Search",
    label: "Search our chat history",
    prompt: "Search through our previous conversations for...",
  },
];

export default function AIChatViewEnhanced({
  busy,
  userName,
  role,
  onAsk,
}: AIChatViewEnhancedProps) {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  
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
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!userId) return;
    
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const createNewConversation = async () => {
    if (!userId) return;

    try {
      const conversation = await ChatHistoryService.createConversation({
        userId,
        organizationId: auth?.profile?.organization_id || "",
        title: "New Chat",
        role: role || undefined,
      });

      setConversations([conversation, ...conversations]);
      setActiveConversationId(conversation.id);
      setMessages([]);
      setShowStarters(true);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) return;
    
    try {
      // In a real implementation, you'd archive or delete the conversation
      setConversations(conversations.filter(c => c.id !== conversationId));
      
      if (activeConversationId === conversationId) {
        setActiveConversationId(undefined);
        setMessages([]);
        setShowStarters(true);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userId) return;
    
    try {
      await ChatHistoryService.deleteMessage({ messageId, userId });
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleSend = useCallback(async () => {
    if ((!input.trim() && selectedImages.length === 0) || busy || !userId) return;

    const userMessage: EnhancedChatMessage = {
      id: makeId(),
      conversationId: activeConversationId || "",
      role: "user",
      content: input.trim(),
      createdAt: nowIso(),
      userId,
      pending: false,
    };

    // Create conversation if none exists
    let conversationId = activeConversationId;
    if (!conversationId) {
      const conversation = await ChatHistoryService.createConversation({
        userId,
        organizationId: auth?.profile?.organization_id || "",
        title: input.slice(0, 50) || "New Chat",
        role: role || undefined,
      });
      conversationId = conversation.id;
      setActiveConversationId(conversationId);
      setConversations([conversation, ...conversations]);
    }

    // Upload images and create attachments
    let attachments: ChatAttachment[] = [];
    if (selectedImages.length > 0) {
      try {
        const uploadResults = await Promise.all(
          selectedImages.map(file => ImageUploadService.uploadImage(file))
        );
        
        attachments = uploadResults.map((result, index) => ({
          id: makeId(),
          messageId: userMessage.id,
          type: "image" as const,
          name: selectedImages[index].name,
          url: result.url,
          size: result.size,
          mimeType: result.mimeType,
          uploadedAt: nowIso(),
          metadata: result.metadata,
        }));
      } catch (error) {
        console.error("Error uploading images:", error);
        // Continue without images if upload fails
      }
    }

    // Add user message with attachments
    const messageWithAttachments = { ...userMessage, attachments };
    setMessages(prev => [...prev, messageWithAttachments]);
    setInput("");
    setSelectedImages([]);
    setShowStarters(false);

    // Save user message to history
    try {
      await ChatHistoryService.addMessage({
        conversationId,
        role: "user",
        content: userMessage.content,
        userId,
        type: "text",
        data: {
          attachments: attachments.map(a => ({
            type: a.type,
            name: a.name,
            url: a.url,
            size: a.size,
            mimeType: a.mimeType,
            metadata: a.metadata,
          })),
        },
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }

    // Add typing indicator
    const typingMessage: EnhancedChatMessage = {
      id: makeId(),
      conversationId,
      role: "assistant",
      content: "",
      createdAt: nowIso(),
      userId,
      pending: true,
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await onAsk(input.trim(), attachments);
      
      if (response) {
        // Remove typing indicator
        setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
        
        // Add assistant response
        const assistantMessage: EnhancedChatMessage = {
          id: makeId(),
          conversationId,
          role: "assistant",
          content: response.content,
          createdAt: nowIso(),
          userId,
          pending: false,
        };
        
        setMessages(prev => [...prev, assistantMessage]);

        // Save assistant response to history
        await ChatHistoryService.addMessage({
          conversationId,
          role: "assistant",
          content: response.content,
          userId,
          type: "text",
          data: {
            model: "gpt-4",
            tokens: response.content.length,
          },
        });
      }
    } catch (error) {
      // Remove typing indicator and show error
      setMessages(prev => prev.map(m => 
        m.id === typingMessage.id 
          ? { ...m, pending: false, error: true }
          : m
      ));
    }
  }, [input, selectedImages, busy, userId, activeConversationId, role, onAsk, conversations]);

  const handleImageSelect = (files: File[]) => {
    setSelectedImages(prev => [...prev, ...files]);
    setShowStarters(false);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStarterClick = (starter: typeof STARTERS[0]) => {
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
          onSearch={() => {}}
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
                  Ask me anything, upload images for analysis, or continue our conversation
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {STARTERS.map((starter, index) => (
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
          {/* Image Upload Area */}
          {selectedImages.length > 0 && (
            <ImageUploadArea
              onImagesSelected={handleImageSelect}
              onRemoveImage={handleRemoveImage}
              selectedImages={selectedImages}
            />
          )}

          {/* Message Input */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedImages.length > 0 
                    ? "Describe what you'd like me to do with these images..." 
                    : "Ask me anything..."
                }
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
            
            <div className="flex gap-2">
              <button
                onClick={() => document.getElementById('image-upload')?.click()}
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                title="Upload images"
              >
                <ImageIcon size={16} className="text-white/60" />
              </button>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && selectedImages.length === 0) || busy}
                className="p-3 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <ArrowUp size={16} className="text-white" />
                )}
              </button>
            </div>
            
            <input
              id="image-upload"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  handleImageSelect(Array.from(files));
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
