alter table public.content_review_drafts
  drop constraint if exists content_review_drafts_layout_check;

alter table public.content_review_drafts
  add constraint content_review_drafts_layout_check
  check (
    layout_type in (
      'split_media_text',
      'article',
      'gallery',
      'event_announcement',
      'campaign_preview',
      'testimonial',
      'media_showcase'
    )
  );
