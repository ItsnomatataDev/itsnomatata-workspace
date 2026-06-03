import type { ContentReviewLayout } from "../services/contentReviewService";

export const CONTENT_STUDIO_LAYOUT_OPTIONS: Array<{
  value: ContentReviewLayout;
  label: string;
  description: string;
}> = [
  {
    value: "media_showcase",
    label: "Showcase",
    description: "Best for schedules: all images first, then one story block.",
  },
  {
    value: "split_media_text",
    label: "Split",
    description: "Image beside story text on larger screens.",
  },
  {
    value: "gallery",
    label: "Gallery",
    description: "Grid of images with shared caption.",
  },
  {
    value: "article",
    label: "Article",
    description: "Long-form story with supporting images.",
  },
  {
    value: "event_announcement",
    label: "Event",
    description: "Headline-style announcement layout.",
  },
  {
    value: "campaign_preview",
    label: "Campaign",
    description: "Promotional campaign preview.",
  },
  {
    value: "testimonial",
    label: "Testimonial",
    description: "Quote or testimonial focused layout.",
  },
];
