import { Save } from "lucide-react";

type BrandingValues = {
  brand_name?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  company_slogan?: string | null;
  company_welcome_text?: string | null;
  dashboard_greeting_text?: string | null;
  invitation_template?: string | null;
  custom_domain?: string | null;
  subdomain?: string | null;
  domain_status?: "pending" | "verified" | "active" | "failed" | null;
  domain_verification_token?: string | null;
  dns_target?: string | null;
  domain_error?: string | null;
};

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
  const welcomeText =
    values.company_welcome_text?.trim() ||
    values.dashboard_greeting_text?.trim() ||
    `Welcome to ${brandName}.`;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-xl shadow-black/30">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">Branding</h3>
        <p className="mt-1 text-sm text-white/45">
          Configure logo, colors, domain and login branding for this
          organization.
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

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Primary Color
          </span>
          <input
            value={values.primary_color ?? "#000000"}
            onChange={(event) =>
              updateField("primary_color", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="#000000"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Accent Color
          </span>
          <input
            value={values.accent_color ?? "#f97316"}
            onChange={(event) =>
              updateField("accent_color", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="#f97316"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Secondary Color
          </span>
          <input
            value={values.secondary_color ?? "#ffffff"}
            onChange={(event) =>
              updateField("secondary_color", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="#ffffff"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Custom Domain
          </span>
          <input
            value={values.custom_domain ?? ""}
            onChange={(event) =>
              updateField("custom_domain", event.target.value)
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="workspace.company.com"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase text-white/45">
            Subdomain
          </span>
          <input
            value={values.subdomain ?? ""}
            onChange={(event) => updateField("subdomain", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="company"
          />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-orange-100">
              Domain setup
            </p>
            <p className="mt-1 text-xs text-orange-100/70">
              DNS is not automated. Point the configured host to the target
              below, then verify it outside this form.
            </p>
          </div>
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-orange-100">
            {values.domain_status ?? "pending"}
          </span>
        </div>

        <div className="mt-3 grid gap-3 text-xs text-orange-50/80 md:grid-cols-2">
          <div className="rounded-xl bg-black/30 p-3">
            <p className="font-semibold text-orange-100">CNAME target</p>
            <p className="mt-1 break-all">
              {values.dns_target || "cname.itsnomatata.com"}
            </p>
          </div>
          <div className="rounded-xl bg-black/30 p-3">
            <p className="font-semibold text-orange-100">Verification token</p>
            <p className="mt-1 break-all">
              {values.domain_verification_token || "Generated after saving a domain"}
            </p>
          </div>
        </div>

        {values.domain_error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {values.domain_error}
          </p>
        ) : null}
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

      <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {values.logo_url ? (
              <img
                src={values.logo_url}
                alt={`${brandName} logo preview`}
                className="h-12 w-12 rounded-xl border border-white/10 object-contain"
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
              <p className="truncate text-base font-semibold text-white">
                {brandName}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-white/55">
                {welcomeText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[
              ["Primary", primaryColor],
              ["Secondary", secondaryColor],
              ["Accent", accentColor],
            ].map(([label, color]) => (
              <div key={label} className="text-center">
                <span
                  className="block h-8 w-8 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                  title={`${label}: ${color}`}
                />
                <span className="mt-1 block text-[10px] text-white/45">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: accentColor,
            color: primaryColor,
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
