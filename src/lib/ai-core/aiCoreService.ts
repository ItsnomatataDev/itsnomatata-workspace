// ============================================================
// AI Core Service - Main AI Chat Service
// ============================================================

import type { AIChatRequest, AIChatResponse } from './aiTypes';

// ============================================================
// AI Core Service Class
// ============================================================

export class AICoreService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(supabaseUrl?: string, supabaseAnonKey?: string) {
    // Allow passing in environment variables for better testability
    this.supabaseUrl = supabaseUrl || this.getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
    this.supabaseAnonKey = supabaseAnonKey || this.getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  private getEnvVar(name: string): string {
    try {
      // Try multiple ways to access environment variables
      if (typeof window !== 'undefined') {
        // Browser environment
        return (window as any).__ENV?.[name] || (window as any).process?.env?.[name] || '';
      }
      
      // Server environment
      return (globalThis as any).process?.env?.[name] || '';
    } catch {
      return '';
    }
  }

  // ============================================================
  // Main Chat Method
  // ============================================================

  async sendMessage(request: AIChatRequest): Promise<AIChatResponse> {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'apikey': this.supabaseAnonKey,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AI Core Service Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================
  // Streaming Chat Method (for real-time responses)
  // ============================================================

  async sendMessageStream(
    request: AIChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: AIChatResponse) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'apikey': this.supabaseAnonKey,
        },
        body: JSON.stringify({
          ...request,
          stream: true, // Note: This would require edge function support
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Stream complete - we'd need to handle final response
              continue;
            }
            
            try {
              const chunk = JSON.parse(data);
              if (chunk.content) {
                onChunk(chunk.content);
              }
            } catch (e) {
              // Ignore malformed chunks
            }
          }
        }
      }

      // Note: In a real implementation, we'd get the final response
      // For now, we'll make a separate call to get the complete response
      const finalResponse = await this.sendMessage({
        ...request,
        // Don't stream for the final call
      });
      
      onComplete(finalResponse);

    } catch (error) {
      console.error('AI Core Service Streaming Error:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.supabaseUrl}/functions/v1/${endpoint}`;
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'apikey': this.supabaseAnonKey,
    };

    return fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================
  // Context Building Helpers
  // ============================================================

  buildContext(params: {
    userId?: string;
    organizationId?: string;
    role?: string;
    fullName?: string;
    department?: string;
    currentModule?: string;
    currentRoute?: string;
    timezone?: string;
  }) {
    return {
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
      fullName: params.fullName,
      department: params.department,
      currentModule: params.currentModule,
      currentRoute: params.currentRoute,
      timezone: params.timezone,
    };
  }

  // ============================================================
  // Error Handling
  // ============================================================

  isRetryableError(error: string): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'rate limit',
      'temporary',
    ];
    
    return retryableErrors.some(retryableError => 
      error.toLowerCase().includes(retryableError)
    );
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries || !this.isRetryableError(lastError.message)) {
          throw lastError;
        }

        // Exponential backoff
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

export const aiCoreService = new AICoreService();

// ============================================================
// Utility Functions
// ============================================================

export const createChatMessage = (
  content: string,
  role: 'user' | 'assistant' = 'user'
): AIChatRequest => ({
  message: content,
  channel: 'internal', // Default channel
});

export const createChatMessageWithContext = (
  content: string,
  context: AIChatRequest['context'],
  options: {
    assistantId?: string;
    conversationId?: string;
    customerId?: string;
    channel?: AIChatRequest['channel'];
  } = {}
): AIChatRequest => ({
  message: content,
  channel: options.channel || 'internal',
  assistantId: options.assistantId,
  conversationId: options.conversationId,
  customerId: options.customerId,
  context,
});

export const isChatError = (response: AIChatResponse): boolean => {
  return !response.success || !!response.error;
};

export const getChatErrorMessage = (response: AIChatResponse): string => {
  return response.error || 'Unknown error occurred';
};
