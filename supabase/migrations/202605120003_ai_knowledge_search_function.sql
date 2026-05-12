
create or replace function public.search_knowledge_chunks(
  p_organization_id uuid,
  p_query_embedding vector(1536),
  p_match_threshold float default 0.7,
  p_match_count int default 5
)
returns table (
  id uuid,
  source_id uuid,
  organization_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
) as $$
begin
  return query
  select 
    kc.id,
    kc.source_id,
    kc.organization_id,
    kc.chunk_text,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.ai_knowledge_chunks kc
  where kc.organization_id = p_organization_id
    and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  order by similarity desc
  limit p_match_count;
end;
$$ language plpgsql security definer;

grant execute on function public.search_knowledge_chunks to authenticated;
