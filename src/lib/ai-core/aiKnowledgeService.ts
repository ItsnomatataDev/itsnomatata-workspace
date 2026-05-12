// ============================================================
// AI Knowledge Service - Knowledge Management
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { 
  AIKnowledgeSource,
  AIKnowledgeChunk,
  KnowledgeListOptions,
  KnowledgeSourceType
} from './aiTypes';

// ============================================================
// Knowledge Service Class
// ============================================================

export class AIKnowledgeService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // ============================================================
  // Knowledge Source Management
  // ============================================================

  async getKnowledgeSources(
    organizationId: string,
    options: KnowledgeListOptions = {}
  ): Promise<{ sources: AIKnowledgeSource[]; total: number; page: number; pageSize: number }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        sourceType,
        search,
      } = options;

      let query = this.supabase
        .from('ai_knowledge_sources')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (sourceType) {
        query = query.eq('source_type', sourceType);
      }
      if (search) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      // Get total count
      const { count } = await this.supabase
        .from('ai_knowledge_sources')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: sources, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch knowledge sources: ${error.message}`);
      }

      return {
        sources: sources || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  async getKnowledgeSource(sourceId: string): Promise<AIKnowledgeSource | null> {
    try {
      const { data: source, error } = await this.supabase
        .from('ai_knowledge_sources')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('id', sourceId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch knowledge source: ${error.message}`);
      }

      return source;
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  async createKnowledgeSource(
    organizationId: string,
    data: {
      title: string;
      sourceType: KnowledgeSourceType;
      fileUrl?: string;
      rawText?: string;
      metadata?: Record<string, unknown>;
      uploadedBy: string;
    }
  ): Promise<AIKnowledgeSource> {
    try {
      const { data: source, error } = await (this.supabase
        .from('ai_knowledge_sources')
        .insert({
          organization_id: organizationId,
          title: data.title,
          source_type: data.sourceType,
          file_url: data.fileUrl || null,
          raw_text: data.rawText || null,
          metadata: data.metadata || {},
          uploaded_by: data.uploadedBy,
        } as any)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to create knowledge source: ${error.message}`);
      }

      return source!;
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  async updateKnowledgeSource(
    sourceId: string,
    updates: Partial<AIKnowledgeSource>
  ): Promise<AIKnowledgeSource> {
    try {
      const { data: source, error } = await this.supabase
        .from('ai_knowledge_sources')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', sourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update knowledge source: ${error.message}`);
      }

      return source!;
    } catch (error) {
      console.error('Knowledge Service Error:', error);
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
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  // ============================================================
  // Knowledge Chunk Management
  // ============================================================

  async getKnowledgeChunks(
    organizationId: string,
    sourceId?: string
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

      const { data: chunks, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch knowledge chunks: ${error.message}`);
      }

      return chunks || [];
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  async createKnowledgeChunks(
    organizationId: string,
    sourceId: string,
    chunks: Array<{
      text: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }>
  ): Promise<AIKnowledgeChunk[]> {
    try {
      const chunkData = chunks.map(chunk => ({
        source_id: sourceId,
        organization_id: organizationId,
        chunk_text: chunk.text,
        embedding: chunk.embedding,
        metadata: chunk.metadata || {},
      }));

      const { data: createdChunks, error } = await (this.supabase
        .from('ai_knowledge_chunks')
        .insert(chunkData as any)
        .select());

      if (error) {
        throw new Error(`Failed to create knowledge chunks: ${error.message}`);
      }

      return createdChunks || [];
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }

  // ============================================================

  if (error) {
    throw new Error(`Failed to fetch knowledge chunks: ${error.message}`);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  async getKnowledgeSourcesByType(
    organizationId: string,
    sourceType: KnowledgeSourceType
  ): Promise<AIKnowledgeSource[]> {
    const result = await this.getKnowledgeSources(organizationId, {
      sourceType,
      pageSize: 100, // Get all of this type
    });

    return result.sources;
  }

  async getRecentKnowledgeSources(
    organizationId: string,
    limit: number = 10
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
      // Get source counts by type
      const { data: sources } = await this.supabase
        .from('ai_knowledge_sources')
        .select('source_type')
        .eq('organization_id', organizationId);

      const sourcesByType: Record<KnowledgeSourceType, number> = {
        document: 0,
        faq: 0,
        website: 0,
        policy: 0,
        sop: 0,
        support_article: 0,
      };

      sources?.forEach((source: any) => {
        if (source.source_type in sourcesByType) {
          sourcesByType[source.source_type as KnowledgeSourceType]++;
        }
      });

      // Get chunk count
      const { count: totalChunks } = await this.supabase
        .from('ai_knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      return {
        totalSources: sources?.length || 0,
        totalChunks: totalChunks || 0,
        sourcesByType,
      };
    } catch (error) {
      console.error('Knowledge Service Error:', error);
      throw error;
    }
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultKnowledgeService: AIKnowledgeService | null = null;

export const getKnowledgeService = (
  supabaseUrl?: string,
  supabaseAnonKey?: string
): AIKnowledgeService => {
  if (!defaultKnowledgeService && supabaseUrl && supabaseAnonKey) {
    defaultKnowledgeService = new AIKnowledgeService(supabaseUrl, supabaseAnonKey);
  }
  
  if (!defaultKnowledgeService) {
    throw new Error('Knowledge service not initialized. Provide Supabase URL and anon key.');
  }
  
  return defaultKnowledgeService;
};

// ============================================================
// Utility Functions
// ============================================================

export const getSourceTypeLabel = (type: KnowledgeSourceType): string => {
  const labels = {
    document: 'Document',
    faq: 'FAQ',
    website: 'Website',
    policy: 'Policy',
    sop: 'SOP',
    support_article: 'Support Article',
  };
  
  return labels[type] || type;
};

export const getSourceTypeIcon = (type: KnowledgeSourceType): string => {
  const icons = {
    document: 'file-text',
    faq: 'help-circle',
    website: 'globe',
    policy: 'shield',
    sop: 'clipboard-list',
    support_article: 'book-open',
  };
  
  return icons[type] || 'file';
};

export const formatKnowledgeSourceTitle = (title: string): string => {
  const maxLength = 60;
  if (title.length <= maxLength) {
    return title;
  }
  
  return title.substring(0, maxLength - 3) + '...';
};

export const truncateText = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
};
