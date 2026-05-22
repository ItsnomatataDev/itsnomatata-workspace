import { Save } from "lucide-react";

type BrandingValues = {
  brand_name?: string | null;
  app_name?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
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
  company_slogan?: string | null;
  company_welcome_text?: string | null;
  dashboard_greeting_text?: string | null;
  invitation_template?: string | null;
};

const colorFields: Array<{
  key: keyof BrandingValues;
  label: string;
  fallback: string;
}> = [
  { key: "primary_color", label: "Primary", fallback: "#000000" },
  { key: "secondary_color", label: "Secondary", fallback: "#ffffff" },
  { key: "accent_color", label: "Accent", fallback: "#f97316" },
  { key: "background_color", label: "App Background", fallback: "#020202" },
  { key: "card_color", label: "Cards & Panels", fallback: "#070707" },
  { key: "sidebar_color", label: "Sidebar", fallback: "#020202" },
  { key: "topbar_color", label: "Topbar", fallback: "#020202" },
  { key: "text_color", label: "Main Text", fallback: "#ffffff" },
  { key: "muted_text_color", label: "Muted Text", fallback: "#a3a3a3" },
  { key: "border_color", label: "Borders", fallback: "#1f1f1f" },
  { key: "button_color", label: "Buttons", fallback: "#f97316" },
  { key: "button_text_color", label: "Button Text", fallback: "#ffffff" },
  { key: "button_hover_color", label: "Button Hover", fallback: "#ea580c" },
  { key: "link_color", label: "Links", fallback: "#fb923c" },
  { key: "link_hover_color", label: "Link Hover", fallback: "#fdba74" },
  { key: "input_focus_color", label: "Input Focus", fallback: "#f97316" },
];

export default function BrandingForm({
  values,
  saving,
  onChange,
  onSave,
}: {
  values: BrandingValues;
  saving?: boolean;
  onChange: (next: BrandingValues) => void;
  onSave: () => void;
}) {
  function updateField(key: keyof BrandingValues, value: string) {
    onChange({
      ...values,
      [key]: value,
    });
  }

  const brandName = values.brand_name?.trim() || "ITsNomatata";
  const primaryColor = values.primary_color || "#000000";
  const secondaryColor = values.secondary_color || "#ffffff";
  const accentColor = values.accent_color || "#f97316";
  const backgroundColor = values.background_color || "#020202";
  const cardColor = values.card_color || "#070707";
  const sidebarColor = values.sidebar_color || "#020202";
  const textColor = values.text_color || "#ffffff";
  const mutedTextColor = values.muted_text_color || "#a3a3a3";
  const borderColor = values.border_color || "#1f1f1f";
  const buttonColor = values.button_color || accentColor;
  const buttonTextColor = values.button_text_color || "#ffffff";
  const buttonHoverColor = values.button_hover_color || "#ea580c";
  const linkColor = values.link_color || "#fb923c";
  const welcomeText =
    values.company_welcome_text?.trim() ||
    values.dashboard_greeting_text?.trim() ||
    `Welcome to ${brandName}.`;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-xl shadow-black/30">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">Branding</h3>
        <p className="mt-1 text-sm text-white/45">
          Configure the organization identity and the system-wide theme.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Brand Name
          </span>
          <input
            value={values.brand_name ?? ""}
            onChange={(event) => updateField("brand_name", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Company brand name"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            App Name
          </span>
          <input
            value={values.app_name ?? ""}
            onChange={(event) => updateField("app_name", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Name shown in browser title"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Logo URL
          </span>
          <input
            value={values.logo_url ?? ""}
            onChange={(event) => updateField("logo_url", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="https://..."
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Favicon URL
          </span>
          <input
            value={values.favicon_url ?? ""}
            onChange={(event) => updateField("favicon_url", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="https://..."
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Login Background URL
          </span>
          <input
            value={values.login_background_url ?? ""}
            onChange={(event) =>
              updateField("login_background_url", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="https://..."
          />
        </label>
      </div>

      <div className="mt-5">
        <div>
          <h4 className="text-sm font-semibold text-white">System Palette</h4>
          <p className="mt-1 text-xs text-white/45">
            These colors drive the workspace shell, pages, cards, forms, links and primary actions.
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {colorFields.map((field) => {
            const value = String(values[field.key] ?? field.fallback);

            return (
              <label
                key={field.key}
                className="rounded-2xl border border-white/10 bg-black p-3"
              >
                <span className="text-xs font-semibold uppercase text-white/45">
                  {field.label}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-transparent p-1"
                    aria-label={`${field.label} color picker`}
                  />
                  <input
                    value={value}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                    placeholder={field.fallback}
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Company Slogan
          </span>
          <input
            value={values.company_slogan ?? ""}
            onChange={(event) =>
              updateField("company_slogan", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Your operating promise"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Dashboard Greeting
          </span>
          <input
            value={values.dashboard_greeting_text ?? ""}
            onChange={(event) =>
              updateField("dashboard_greeting_text", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Here is what needs attention today."
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Welcome Text
          </span>
          <textarea
            value={values.company_welcome_text ?? ""}
            onChange={(event) =>
              updateField("company_welcome_text", event.target.value)
            }
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Welcome your teams into their branded workspace."
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Invitation Template
          </span>
          <textarea
            value={values.invitation_template ?? ""}
            onChange={(event) =>
              updateField("invitation_template", event.target.value)
            }
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="You have been invited to join {brand_name}."
          />
        </label>
      </div>

      <div
        className="mt-4 overflow-hidden rounded-2xl border p-4"
        style={{
          backgroundColor,
          borderColor,
          color: textColor,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {values.logo_url ? (
              <img
                src={values.logo_url}
                alt={`${brandName} logo preview`}
                className="h-12 w-12 rounded-xl border object-contain"
                style={{ borderColor }}
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
                style={{
                  backgroundColor: accentColor,
                  color: primaryColor,
                }}
              >
                {brandName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-base font-semibold" style={{ color: textColor }}>
                {brandName}
              </p>
              <p
                className="mt-1 line-clamp-2 text-sm"
                style={{ color: mutedTextColor }}
              >
                {welcomeText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[
              ["Primary", primaryColor],
              ["Secondary", secondaryColor],
              ["Accent", accentColor],
              ["Panel", cardColor],
              ["Sidebar", sidebarColor],
            ].map(([label, color]) => (
              <div key={label} className="text-center">
                <span
                  className="block h-8 w-8 rounded-full border"
                  style={{ backgroundColor: color, borderColor }}
                  title={`${label}: ${color}`}
                />
                <span
                  className="mt-1 block text-[10px]"
                  style={{ color: mutedTextColor }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-4 grid gap-3 rounded-2xl border p-3 md:grid-cols-[180px_1fr]"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <div
            className="rounded-xl border p-3 text-sm font-semibold"
            style={{
              backgroundColor: sidebarColor,
              borderColor,
              color: textColor,
            }}
          >
            Navigation
            <p className="mt-2 text-xs font-normal" style={{ color: mutedTextColor }}>
              Branded sidebar and shell
            </p>
          </div>
          <div className="min-w-0 rounded-xl border p-3" style={{ borderColor }}>
            <p className="text-sm font-semibold" style={{ color: textColor }}>
              Workspace card preview
            </p>
            <p className="mt-1 text-xs" style={{ color: mutedTextColor }}>
              Forms, tables and panels inherit the selected background, text and border colors.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: buttonColor,
                  color: buttonTextColor,
                }}
              >
                Primary action
              </button>
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: buttonHoverColor,
                  borderColor,
                  color: buttonTextColor,
                }}
              >
                Hover state
              </button>
              <span className="text-sm font-semibold" style={{ color: linkColor }}>
                Link text
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: buttonColor,
            color: buttonTextColor,
          }}
        >
          Sample action
        </button>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Saving..." : "Save Branding"}
      </button>
    </div>
  );
}
