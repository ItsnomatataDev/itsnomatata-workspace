export type BrandingColorValues = {
  brand_name?: string | null;
  app_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  card_color?: string | null;
  sidebar_color?: string | null;
  topbar_color?: string | null;
  text_color?: string | null;
  muted_text_color?: string | null;
  border_color?: string | null;
  button_color?: string | null;
  button_text_color?: string | null;
  button_hover_color?: string | null;
  link_color?: string | null;
  link_hover_color?: string | null;
  input_focus_color?: string | null;
};

/** Individual swatches platform admins can suggest for other organizations. */
export const SUGGESTED_ORGANIZATION_COLORS = [
  { hex: "#ccc3bf", label: "Warm Sand" },
  { hex: "#281f55", label: "Deep Plum" },
  { hex: "#99694d", label: "Copper" },
  { hex: "#7a6d81", label: "Mauve" },
  { hex: "#8c8cac", label: "Lavender Gray" },
] as const;

export type SuggestedColorTarget =
  | "primary_color"
  | "secondary_color"
  | "accent_color"
  | "muted_text_color"
  | "border_color";

export const SUGGESTED_COLOR_TARGETS: Array<{
  key: SuggestedColorTarget;
  label: string;
}> = [
  { key: "primary_color", label: "Primary" },
  { key: "secondary_color", label: "Secondary" },
  { key: "accent_color", label: "Accent" },
  { key: "muted_text_color", label: "Muted" },
  { key: "border_color", label: "Border" },
];

/** IT's No Matata official palette (itsnomatata). */
export const ITSNOMATATA_PALETTE_PRESET: {
  id: "itsnomatata";
  label: string;
  description: string;
  values: BrandingColorValues;
} = {
  id: "itsnomatata",
  label: "itsnomatata",
  description: "IT's No Matata official brand colors.",
  values: {
    brand_name: "IT's No Matata",
    app_name: "IT's No Matata",
    primary_color: "#281f55",
    secondary_color: "#ccc3bf",
    accent_color: "#99694d",
    background_color: "#1a1438",
    card_color: "#231c4a",
    sidebar_color: "#281f55",
    topbar_color: "#231c4a",
    text_color: "#ccc3bf",
    muted_text_color: "#7a6d81",
    border_color: "#8c8cac",
    button_color: "#99694d",
    button_text_color: "#ccc3bf",
    button_hover_color: "#7f553c",
    link_color: "#8c8cac",
    link_hover_color: "#ccc3bf",
    input_focus_color: "#99694d",
  },
};
