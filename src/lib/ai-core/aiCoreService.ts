import type { AIChatRequest, AIChatResponse } from './aiTypes';


export class AICoreService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(supabaseUrl?: string, supabaseAnonKey?: string) {

    this.supabaseUrl = supabaseUrl || this.getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
    this.supabaseAnonKey = supabaseAnonKey || this.getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  private getEnvVar(name: string): string {
    try {

      if (typeof window !== 'undefined') {

        return (window as any).__ENV?.[name] || (window as any).process?.env?.[name] || '';
      }

      return (globalThis as any).process?.env?.[name] || '';
    } catch {
      return '';
    }
  }


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
          stream: true, 
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
             
              continue;
            }
            
            try {
              const chunk = JSON.parse(data);
              if (chunk.content) {
                onChunk(chunk.content);
              }
            } catch (e) {
            }
          }
        }
      }

      const finalResponse = await this.sendMessage({
        ...request,

      });
      
      onComplete(finalResponse);

    } catch (error) {
      console.error('AI Core Service Streaming Error:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

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

export const aiCoreService = new AICoreService();


export const createChatMessage = (
  content: string,
  role: 'user' | 'assistant' = 'user'
): AIChatRequest => ({
  message: content,
  channel: 'internal',
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
