

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AIKnowledgeSource,
  AIKnowledgeChunk,
  KnowledgeListOptions,
  KnowledgeSourceType,
} from './aiTypes';

type JsonRecord = Record<string, unknown>;

type PaginatedKnowledgeSources = {
  sources: AIKnowledgeSource[];
  total: number;
  page: number;
  pageSize: number;
};

type CreateKnowledgeSourceInput = {
  title: string;
  sourceType: KnowledgeSourceType;
  fileUrl?: string | null;
  rawText?: string | null;
  metadata?: JsonRecord;
  uploadedBy: string;
};

type CreateKnowledgeChunkInput = {
  text: string;
  embedding?: number[] | null;
  metadata?: JsonRecord;
};

type UpdateKnowledgeSourceInput = Partial<
  Pick<
    AIKnowledgeSource,
    | 'title'
    | 'source_type'
    | 'file_url'
    | 'raw_text'
    | 'metadata'
  >
>;

type KnowledgeSearchMatch = {
  id: string;
  source_id: string;
  organization_id: string;
  chunk_text: string;
  metadata: JsonRecord;
  similarity: number;
};

export class AIKnowledgeService {
  private supabase: SupabaseClient;

  constructor(supabaseUrlOrClient: string | SupabaseClient, supabaseAnonKey?: string) {
    if (typeof supabaseUrlOrClient === 'string') {
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key is required when initializing AIKnowledgeService with a URL.');
      }

      this.supabase = createClient(supabaseUrlOrClient, supabaseAnonKey);
    } else {
      this.supabase = supabaseUrlOrClient;
    }
  }


  async getKnowledgeSources(
    organizationId: string,
    options: KnowledgeListOptions = {},
  ): Promise<PaginatedKnowledgeSources> {
    try {
      const {
        page = 1,
        pageSize = 20,
        sourceType,
        search,
      } = options;

      let query = this.supabase
        .from('ai_knowledge_sources')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (sourceType) {
        query = query.eq('source_type', sourceType);
      }

      if (search?.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`title.ilike.${searchTerm},raw_text.ilike.${searchTerm}`);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to fetch knowledge sources: ${error.message}`);
      }

      return {
        sources: (data ?? []) as AIKnowledgeSource[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIKnowledgeService.getKnowledgeSources error:', error);
      throw error;
    }
  }

  async getKnowledgeSource(sourceId: string): Promise<AIKnowledgeSource | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_knowledge_sources')
        .select('*')
        .eq('id', sourceId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch knowledge source: ${error.message}`);
      }

      return (data as AIKnowledgeSource | null) ?? null;
    } catch (error) {
      console.error('AIKnowledgeService.getKnowledgeSource error:', error);
      throw error;
    }
  }

  async createKnowledgeSource(
    organizationId: string,
    data: CreateKnowledgeSourceInput,
  ): Promise<AIKnowledgeSource> {
    try {
      if (!data.fileUrl && !data.rawText) {
        throw new Error('Knowledge source requires either a file URL or raw text.');
      }

      const { data: source, error } = await this.supabase
        .from('ai_knowledge_sources')
        .insert({
          organization_id: organizationId,
          title: data.title,
          source_type: data.sourceType,
          file_url: data.fileUrl ?? null,
          raw_text: data.rawText ?? null,
          metadata: data.metadata ?? {},
          uploaded_by: data.uploadedBy,
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create knowledge source: ${error.message}`);
      }

      return source as AIKnowledgeSource;
    } catch (error) {
      console.error('AIKnowledgeService.createKnowledgeSource error:', error);
      throw error;
    }
  }

  async updateKnowledgeSource(
    sourceId: string,
    updates: UpdateKnowledgeSourceInput,
  ): Promise<AIKnowledgeSource> {
    try {
      const { data, error } = await this.supabase
        .from('ai_knowledge_sources')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update knowledge source: ${error.message}`);
      }

      return data as AIKnowledgeSource;
    } catch (error) {
      console.error('AIKnowledgeService.updateKnowledgeSource error:', error);
      throw error;
    }
  }

  async deleteKnowledgeSource(sourceId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_knowledge_sources')
        .delete()
        .eq('id', sourceId);

      if (error) {
        throw new Error(`Failed to delete knowledge source: ${error.message}`);
      }
    } catch (error) {
      console.error('AIKnowledgeService.deleteKnowledgeSource error:', error);
      throw error;
    }
  }


  async getKnowledgeChunks(
    organizationId: string,
    sourceId?: string,
  ): Promise<AIKnowledgeChunk[]> {
    try {
      let query = this.supabase
        .from('ai_knowledge_chunks')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch knowledge chunks: ${error.message}`);
      }

      return (data ?? []) as AIKnowledgeChunk[];
    } catch (error) {
      console.error('AIKnowledgeService.getKnowledgeChunks error:', error);
      throw error;
    }
  }

  async createKnowledgeChunks(
    organizationId: string,
    sourceId: string,
    chunks: CreateKnowledgeChunkInput[],
  ): Promise<AIKnowledgeChunk[]> {
    try {
      if (!chunks.length) {
        return [];
      }

      const chunkData = chunks.map((chunk) => ({
        source_id: sourceId,
        organization_id: organizationId,
        chunk_text: chunk.text,
        embedding: chunk.embedding ?? null,
        metadata: chunk.metadata ?? {},
      }));

      const { data, error } = await this.supabase
        .from('ai_knowledge_chunks')
        .insert(chunkData)
        .select('*');

      if (error) {
        throw new Error(`Failed to create knowledge chunks: ${error.message}`);
      }

      return (data ?? []) as AIKnowledgeChunk[];
    } catch (error) {
      console.error('AIKnowledgeService.createKnowledgeChunks error:', error);
      throw error;
    }
  }

  async deleteKnowledgeChunksBySource(sourceId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_knowledge_chunks')
        .delete()
        .eq('source_id', sourceId);

      if (error) {
        throw new Error(`Failed to delete knowledge chunks: ${error.message}`);
      }
    } catch (error) {
      console.error('AIKnowledgeService.deleteKnowledgeChunksBySource error:', error);
      throw error;
    }
  }

  async searchKnowledgeChunks(
    organizationId: string,
    queryEmbedding: number[],
    options: {
      matchThreshold?: number;
      matchCount?: number;
    } = {},
  ): Promise<KnowledgeSearchMatch[]> {
    try {
      const {
        matchThreshold = 0.7,
        matchCount = 5,
      } = options;

      const { data, error } = await this.supabase.rpc('search_knowledge_chunks', {
        p_organization_id: organizationId,
        p_query_embedding: queryEmbedding,
        p_match_threshold: matchThreshold,
        p_match_count: matchCount,
      });

      if (error) {
        throw new Error(`Failed to search knowledge chunks: ${error.message}`);
      }

      return (data ?? []) as KnowledgeSearchMatch[];
    } catch (error) {
      console.error('AIKnowledgeService.searchKnowledgeChunks error:', error);
      throw error;
    }
  }


  async getKnowledgeSourcesByType(
    organizationId: string,
    sourceType: KnowledgeSourceType,
  ): Promise<AIKnowledgeSource[]> {
    const result = await this.getKnowledgeSources(organizationId, {
      sourceType,
      pageSize: 100,
    });

    return result.sources;
  }

  async getRecentKnowledgeSources(
    organizationId: string,
    limit = 10,
  ): Promise<AIKnowledgeSource[]> {
    const result = await this.getKnowledgeSources(organizationId, {
      pageSize: limit,
    });

    return result.sources;
  }

  async getKnowledgeStats(organizationId: string): Promise<{
    totalSources: number;
    totalChunks: number;
    sourcesByType: Record<KnowledgeSourceType, number>;
  }> {
    try {
      const { data: sources, error: sourcesError } = await this.supabase
        .from('ai_knowledge_sources')
        .select('source_type')
        .eq('organization_id', organizationId);

      if (sourcesError) {
        throw new Error(`Failed to fetch knowledge source stats: ${sourcesError.message}`);
      }

      const sourcesByType: Record<KnowledgeSourceType, number> = {
        document: 0,
        faq: 0,
        website: 0,
        policy: 0,
        sop: 0,
        support_article: 0,
      };

      (sources ?? []).forEach((source) => {
        const sourceType = source.source_type as KnowledgeSourceType;
        if (sourceType in sourcesByType) {
          sourcesByType[sourceType] += 1;
        }
      });

      const { count: totalChunks, error: chunksError } = await this.supabase
        .from('ai_knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (chunksError) {
        throw new Error(`Failed to fetch knowledge chunk stats: ${chunksError.message}`);
      }

      return {
        totalSources: sources?.length ?? 0,
        totalChunks: totalChunks ?? 0,
        sourcesByType,
      };
    } catch (error) {
      console.error('AIKnowledgeService.getKnowledgeStats error:', error);
      throw error;
    }
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultKnowledgeService: AIKnowledgeService | null = null;

export const getKnowledgeService = (
  supabaseUrlOrClient?: string | SupabaseClient,
  supabaseAnonKey?: string,
): AIKnowledgeService => {
  if (!defaultKnowledgeService && supabaseUrlOrClient) {
    defaultKnowledgeService = new AIKnowledgeService(supabaseUrlOrClient, supabaseAnonKey);
  }

  if (!defaultKnowledgeService) {
    throw new Error('Knowledge service not initialized. Provide a Supabase client or Supabase URL and anon key.');
  }

  return defaultKnowledgeService;
};

// ============================================================
// Utility Functions
// ============================================================

export const getSourceTypeLabel = (type: KnowledgeSourceType): string => {
  const labels: Record<KnowledgeSourceType, string> = {
    document: 'Document',
    faq: 'FAQ',
    website: 'Website',
    policy: 'Policy',
    sop: 'SOP',
    support_article: 'Support Article',
  };

  return labels[type] ?? type;
};

export const getSourceTypeIcon = (type: KnowledgeSourceType): string => {
  const icons: Record<KnowledgeSourceType, string> = {
    document: 'file-text',
    faq: 'help-circle',
    website: 'globe',
    policy: 'shield',
    sop: 'clipboard-list',
    support_article: 'book-open',
  };

  return icons[type] ?? 'file';
};

export const formatKnowledgeSourceTitle = (title: string): string => {
  const maxLength = 60;

  if (title.length <= maxLength) {
    return title;
  }

  return `${title.substring(0, maxLength - 3)}...`;
};

export const truncateText = (text: string, maxLength = 200): string => {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength - 3)}...`;
};
