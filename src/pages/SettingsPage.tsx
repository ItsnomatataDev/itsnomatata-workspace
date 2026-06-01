import { useEffect, useState } from "react";
import { Bell, Loader2, Mail, Save, Smartphone } from "lucide-react";
import Sidebar from "../components/dashboard/components/Sidebar";
import { useAuth } from "../app/providers/AuthProvider";
import { useNotifications } from "../lib/hooks/useNotifications";
import {
  getGlobalNotificationPreferences,
  saveGlobalNotificationPreferences,
  type GlobalNotificationPreferences,
} from "../features/notifications/services/advancedNotificationService";
import SoundPreferencesPanel from "../features/settings/components/SoundPreferencesPanel";

type PreferenceKey =
  | "in_app_enabled"
  | "email_enabled"
  | "email_messages"
  | "email_tasks"
  | "email_mentions"
  | "email_comments"
  | "email_weekly_summary"
  | "email_monthly_summary"
  | "email_time_tracking_reminders";

const TOGGLE_OPTIONS: Array<{
  key: PreferenceKey;
  label: string;
  description: string;
}> = [
  {
    key: "in_app_enabled",
    label: "In-app notifications",
    description: "Show notifications in the workspace bell and notification page.",
  },
  {
    key: "email_enabled",
    label: "Email notifications",
    description: "Allow email delivery for events enabled below.",
  },
  {
    key: "email_tasks",
    label: "Task notifications",
    description: "Task assignments, due reminders, and task status updates.",
  },
  {
    key: "email_mentions",
    label: "Mentions",
    description: "Direct mentions in tasks and collaboration activity.",
  },
  {
    key: "email_comments",
    label: "Comments",
    description: "Task comments and review activity.",
  },
  {
    key: "email_messages",
    label: "Chat messages",
    description: "Email alerts for chat messages. Disabled by default to reduce volume.",
  },
  {
    key: "email_weekly_summary",
    label: "Weekly time summary",
    description: "Weekly summary of tracked time and work activity.",
  },
  {
    key: "email_monthly_summary",
    label: "Monthly time summary",
    description: "Monthly time and productivity summary emails.",
  },
  {
    key: "email_time_tracking_reminders",
    label: "Time tracking reminders",
    description: "Start-of-day and running timer reminder emails.",
  },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 border border-white/10 bg-black/40 p-4">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-white/45">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-orange-500"
      />
    </label>
  );
}

export default function SettingsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const [preferences, setPreferences] =
    useState<GlobalNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pushMessage, setPushMessage] = useState("");

  const {
    pushSupported,
    pushEnabled,
    pushPermission,
    pushLoading,
    pushError,
    enablePushNotifications,
    disablePushNotifications,
  } = useNotifications(user?.id ?? null);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    setLoading(true);
    setError("");

    getGlobalNotificationPreferences({
      userId: user.id,
      organizationId: profile?.organization_id ?? null,
    })
      .then((data) => {
        if (mounted) setPreferences(data);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load notification preferences.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [profile?.organization_id, user?.id]);

  if (!user || !profile) return null;

  const updatePreference = (
    key: PreferenceKey,
    value: boolean,
  ) => {
    setPreferences((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveGlobalNotificationPreferences({
        ...preferences,
        user_id: user.id,
        organization_id: profile.organization_id ?? null,
      });
      setMessage("Notification preferences saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save notification preferences.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 border border-white/10 bg-[#050505] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">Settings</h1>
            <p className="mt-2 text-sm text-white/50">
              Manage notification delivery preferences for this workspace.
            </p>
          </div>

          <section className="border border-white/10 bg-[#050505] p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
                <Bell size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Notification Preferences
                </h2>
                <p className="text-sm text-white/45">
                  Preferences are organization-scoped and used before email
                  events are added to the n8n queue.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                <Loader2 size={16} className="animate-spin" />
                Loading preferences...
              </div>
            ) : preferences ? (
              <div className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-2">
                  {TOGGLE_OPTIONS.map((option) => (
                    <ToggleRow
                      key={option.key}
                      label={option.label}
                      description={option.description}
                      checked={Boolean(preferences[option.key])}
                      onChange={(checked) =>
                        updatePreference(option.key, checked)
                      }
                    />
                  ))}
                </div>

                <div className="border border-white/10 bg-black/40 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Browser push (tab closed)
                      </h3>
                      <p className="mt-1 text-sm text-white/45">
                        OS-level alerts on this device when you are not on the
                        app. Requires HTTPS and browser permission.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/55">
                    <span>
                      Status:{" "}
                      <span className="font-medium text-white">
                        {pushEnabled
                          ? "Enabled on this device"
                          : pushPermission === "denied"
                            ? "Blocked in browser"
                            : "Not enabled"}
                      </span>
                    </span>
                    <span>Permission: {String(pushPermission)}</span>
                  </div>

                  {pushError ? (
                    <p className="mt-3 text-sm text-red-300">{pushError}</p>
                  ) : null}
                  {pushMessage ? (
                    <p className="mt-3 text-sm text-emerald-300">{pushMessage}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!pushSupported || pushLoading || pushEnabled}
                      onClick={() => {
                        setPushMessage("");
                        void enablePushNotifications().then((ok) => {
                          if (ok) {
                            setPushMessage(
                              "Browser push enabled. Close the tab and send a test from Notifications to verify.",
                            );
                          }
                        });
                      }}
                      className="border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {pushLoading ? "Working..." : "Enable on this device"}
                    </button>

                    <button
                      type="button"
                      disabled={pushLoading || !pushEnabled}
                      onClick={() => {
                        setPushMessage("");
                        void disablePushNotifications().then((ok) => {
                          if (ok) {
                            setPushMessage("Browser push disabled on this device.");
                          }
                        });
                      }}
                      className="border border-white/10 px-4 py-2 text-sm text-white/80 disabled:opacity-50"
                    >
                      Disable on this device
                    </button>
                  </div>

                  {!pushSupported ? (
                    <div className="mt-3 space-y-2 text-xs leading-5 text-white/40">
                      <p>
                        Push is unavailable until{" "}
                        <span className="font-mono text-white/55">
                          VITE_VAPID_PUBLIC_KEY
                        </span>{" "}
                        is set in <span className="font-mono">.env</span> and the
                        app is served over HTTPS (or localhost).
                      </p>
                      <ol className="list-decimal space-y-1 pl-4 text-white/45">
                        <li>Run: npm run generate:vapid-keys</li>
                        <li>Copy public key to .env and Supabase secrets</li>
                        <li>
                          Deploy: supabase functions deploy send-push-notification
                        </li>
                        <li>Click Enable on this device below</li>
                      </ol>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 border border-white/10 bg-black/40 p-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/70">
                      Quiet hours start
                    </span>
                    <input
                      type="time"
                      value={preferences.quiet_hours_start ?? ""}
                      onChange={(event) =>
                        setPreferences((current) =>
                          current
                            ? {
                                ...current,
                                quiet_hours_start: event.target.value || null,
                              }
                            : current,
                        )
                      }
                      className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/70">
                      Quiet hours end
                    </span>
                    <input
                      type="time"
                      value={preferences.quiet_hours_end ?? ""}
                      onChange={(event) =>
                        setPreferences((current) =>
                          current
                            ? {
                                ...current,
                                quiet_hours_end: event.target.value || null,
                              }
                            : current,
                        )
                      }
                      className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-white/45">
                    <Mail size={15} />
                    Emails are queued in Supabase before n8n processes them.
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    {saving ? "Saving..." : "Save preferences"}
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className="mt-5 border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}
          </section>

          <SoundPreferencesPanel />
        </main>
      </div>
    </div>
  );
}
