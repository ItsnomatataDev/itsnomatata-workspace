create extension if not exists vector;

alter table public.ai_document_chunks
  add column if not exists embedding vector(1536),
  add column if not exists embedding_model text,
  add column if not exists token_count integer;

create index if not exists idx_ai_document_chunks_embedding
  on public.ai_document_chunks using ivfflat (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists idx_ai_document_chunks_text_search
  on public.ai_document_chunks using gin (to_tsvector('english', chunk_text));

create table if not exists public.document_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_id uuid not null references public.ai_document_chunks(id) on delete cascade,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now(),
  unique (chunk_id, embedding_model)
);

create index if not exists idx_document_embeddings_org
  on public.document_embeddings (organization_id, document_id);

create index if not exists idx_document_embeddings_embedding
  on public.document_embeddings using ivfflat (embedding vector_cosine_ops);

create or replace view public.document_chunks as
select
  c.id,
  c.document_id,
  c.organization_id,
  c.chunk_index,
  c.chunk_text as content,
  c.chunk_summary as summary,
  c.access_level,
  c.metadata,
  c.created_at
from public.ai_document_chunks c;

create or replace function public.search_ai_document_chunks(
  p_organization_id uuid,
  p_query_embedding vector(1536),
  p_match_threshold float default 0.2,
  p_match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  name text,
  type text,
  url text,
  snippet text,
  score float
) as $$
begin
  return query
  select
    c.id,
    d.id as document_id,
    d.document_name as name,
    d.file_type as type,
    d.source_url as url,
    left(regexp_replace(coalesce(c.chunk_summary, c.chunk_text), '\s+', ' ', 'g'), 700) as snippet,
    1 - (c.embedding <=> p_query_embedding) as score
  from public.ai_document_chunks c
  join public.ai_documents d on d.id = c.document_id
  where c.organization_id = p_organization_id
    and d.organization_id = p_organization_id
    and d.status = 'trained'
    and c.embedding is not null
    and 1 - (c.embedding <=> p_query_embedding) >= p_match_threshold
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$ language plpgsql security definer;

grant execute on function public.search_ai_document_chunks(uuid, vector, float, int) to authenticated;
grant select on public.document_chunks to authenticated;
