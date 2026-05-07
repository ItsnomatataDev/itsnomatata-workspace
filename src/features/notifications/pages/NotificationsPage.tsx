import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Info,
  MessageSquare,
  RefreshCw,
  Shield,
  Smartphone,
  UserPlus,
  Video,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNotifications } from "../../../lib/hooks/useNotifications";
import { sendNotification } from "../services/notificationService";
import {
  getPushConfigurationError,
  getPushSupportError,
  registerPushNotifications,
} from "../services/pushService";
import type { NotificationItem } from "../services/notificationService";

type NotificationCategory =
  | "all"
  | "roster"
  | "leave"
  | "meetings"
  | "chat"
  | "tasks"
  | "system"
  | "users"
  | "campaigns"
  | "approvals";

interface CategoryMeta {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

const CATEGORY_META: Record<NotificationCategory, CategoryMeta> = {
  all: { label: "All", icon: Bell, color: "text-white" },
  roster: {
    label: "Duty Roster",
    icon: CalendarClock,
    color: "text-amber-300",
  },
  leave: { label: "Leave", icon: CalendarDays, color: "text-sky-300" },
  meetings: { label: "Meetings", icon: Video, color: "text-purple-300" },
  chat: { label: "Chat", icon: MessageSquare, color: "text-emerald-300" },
  tasks: { label: "Tasks", icon: CheckSquare, color: "text-blue-300" },
  system: { label: "System / IT", icon: AlertTriangle, color: "text-red-300" },
  users: { label: "New Users", icon: UserPlus, color: "text-teal-300" },
  campaigns: {
    label: "Campaigns",
    icon: BriefcaseBusiness,
    color: "text-orange-300",
  },
  approvals: { label: "Approvals", icon: Shield, color: "text-yellow-300" },
};

const ROLE_CATEGORY_VISIBILITY: Record<string, NotificationCategory[]> = {
  admin: [
    "all",
    "roster",
    "leave",
    "meetings",
    "chat",
    "tasks",
    "system",
    "users",
    "campaigns",
    "approvals",
  ],
  manager: [
    "all",
    "roster",
    "leave",
    "meetings",
    "chat",
    "tasks",
    "campaigns",
    "approvals",
  ],
  it: ["all", "system", "tasks", "meetings", "chat", "users"],
  seo_specialist: ["all", "tasks", "campaigns", "meetings", "chat"],
  social_media: ["all", "tasks", "campaigns", "meetings", "chat"],
  media_team: ["all", "tasks", "campaigns", "meetings", "chat"],
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-red-500/40 bg-red-500/10",
  high: "border-orange-500/30 bg-orange-500/10",
  medium: "border-white/10 bg-white/[0.04]",
  low: "border-white/10 bg-black/30",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500 animate-pulse",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-white/30",
};

function getCategory(type: string | null | undefined): NotificationCategory {
  if (!type) return "all";

  const t = type.toLowerCase();

  if (t.includes("roster") || t.includes("duty") || t.includes("shift")) {
    return "roster";
  }
  if (t.includes("leave")) return "leave";
  if (t.includes("meeting")) return "meetings";
  if (t.includes("chat") || t.includes("message")) return "chat";
  if (t.includes("task")) return "tasks";
  if (
    t.includes("system") ||
    t.includes("alert") ||
    t.includes("it_") ||
    t.includes("monitor") ||
    t.includes("automation")
  ) {
    return "system";
  }
  if (t.includes("user") || t.includes("signup") || t.includes("invite")) {
    return "users";
  }
  if (t.includes("campaign")) return "campaigns";
  if (t.includes("approval")) return "approvals";

  return "all";
}

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return `${Math.floor(diffHr / 24)}d ago`;
}

function NotificationCard({
  item,
  onRead,
}: {
  item: NotificationItem & { _category: NotificationCategory };
  onRead: (id: string) => void;
}) {
  const meta = CATEGORY_META[item._category] ?? CATEGORY_META.all;
  const Icon = meta.icon;
  const priority = item.priority ?? "medium";

  return (
    <div
      className={[
        "rounded-3xl border p-4 shadow-xl shadow-black/20 transition hover:border-orange-500/25",
        item.is_read
          ? "border-white/10 bg-black/35"
          : (PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium),
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50",
            meta.color,
          ].join(" ")}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!item.is_read ? (
                  <span
                    className={[
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      PRIORITY_DOT[priority] ?? PRIORITY_DOT.medium,
                    ].join(" ")}
                  />
                ) : null}

                <p
                  className={[
                    "text-sm font-semibold",
                    item.is_read ? "text-white/65" : "text-white",
                  ].join(" ")}
                >
                  {item.title}
                </p>
              </div>

              {item.message ? (
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {item.message}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                    meta.color,
                  ].join(" ")}
                >
                  {meta.label}
                </span>

                {priority !== "medium" ? (
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                      priority === "urgent"
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : priority === "high"
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                          : "border-white/10 bg-black text-white/45",
                    ].join(" ")}
                  >
                    {priority}
                  </span>
                ) : null}

                {item.action_url ? (
                  <Link
                    to={item.action_url}
                    className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20"
                  >
                    View →
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <span className="text-[11px] text-white/35">
                {timeAgo(item.created_at)}
              </span>

              {!item.is_read ? (
                <button
                  type="button"
                  onClick={() => onRead(item.id)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Mark read
                </button>
              ) : (
                <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/25">
                  Read
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const auth = useAuth();
  const currentUser = auth?.user ?? null;
  const currentProfile = auth?.profile ?? null;
  const userId = currentProfile?.id ?? null;
  const role = currentProfile?.primary_role ?? "social_media";

  const {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotifications(userId);

  const [activeCategory, setActiveCategory] =
    useState<NotificationCategory>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testError, setTestError] = useState("");

  if (!currentUser || !currentProfile) return null;

  const organizationId = currentProfile.organization_id ?? null;
  const visibleCategories: NotificationCategory[] =
    ROLE_CATEGORY_VISIBILITY[role] ?? ROLE_CATEGORY_VISIBILITY.social_media;

  const enriched = useMemo(
    () => notifications.map((n) => ({ ...n, _category: getCategory(n.type) })),
    [notifications],
  );

  const filtered = useMemo(() => {
    let list = enriched;

    if (activeCategory !== "all") {
      list = list.filter((n) => n._category === activeCategory);
    }

    if (showUnreadOnly) {
      list = list.filter((n) => !n.is_read);
    }

    return list;
  }, [enriched, activeCategory, showUnreadOnly]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<NotificationCategory, number>> = {};

    for (const n of enriched) {
      if (!n.is_read) {
        counts[n._category] = (counts[n._category] ?? 0) + 1;
        counts.all = (counts.all ?? 0) + 1;
      }
    }

    return counts;
  }, [enriched]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleEnablePush() {
    if (!organizationId) {
      setTestError("Missing organization ID on your profile.");
      return;
    }

    if (!userId) {
      setTestError("Missing user ID.");
      return;
    }

    const supportError = getPushSupportError();
    if (supportError) {
      setTestError(supportError);
      return;
    }

    const configurationError = getPushConfigurationError();
    if (configurationError) {
      setTestError(configurationError);
      return;
    }

    try {
      setEnablingPush(true);
      setTestError("");
      setTestMessage("");

      await registerPushNotifications({
        userId,
        organizationId,
      });

      setPushEnabled(true);
      setTestMessage("Push notifications are enabled for this device.");
    } catch (err: unknown) {
      setTestError(
        err instanceof Error
          ? err.message
          : "Failed to enable push notifications.",
      );
    } finally {
      setEnablingPush(false);
    }
  }

  async function handleSendTestNotification() {
    if (!organizationId) {
      setTestError("Missing organization ID on your profile.");
      return;
    }

    if (!userId) {
      setTestError("Missing user ID.");
      return;
    }

    try {
      setTestingNotification(true);
      setTestError("");
      setTestMessage("");

      await sendNotification({
        organizationId,
        userId,
        type: "system_alert",
        title: "System notification test",
        message:
          "This is a live test confirming in-app, email, and push delivery are active.",
        actionUrl: "/notifications",
        priority: "high",
        sendEmail: true,
        metadata: {
          source: "notifications_test_button",
          triggered_at: new Date().toISOString(),
          push_test: true,
        },
        category: "system",
        dedupeKey: `notification-test:${userId}:${Date.now()}`,
        channels: ["in_app", "email", "push"],
      });

      await reload();

      setTestMessage(
        "Test notification sent. Check the list, bell, email inbox, and device push notification.",
      );
    } catch (err: unknown) {
      setTestError(
        err instanceof Error
          ? err.message
          : "Failed to send test notification.",
      );
    } finally {
      setTestingNotification(false);
    }
  }

  async function handleSendPushOnlyTest() {
    if (!organizationId || !userId) {
      setTestError("Missing user or organization details.");
      return;
    }

    try {
      setTestingNotification(true);
      setTestError("");
      setTestMessage("");

      await sendNotification({
        organizationId,
        userId,
        type: "system_alert",
        title: "Push notification test",
        message:
          "This test only targets your browser push notification channel.",
        actionUrl: "/notifications",
        priority: "high",
        sendEmail: false,
        metadata: {
          source: "push_only_test_button",
          triggered_at: new Date().toISOString(),
        },
        category: "system",
        dedupeKey: `push-only-test:${userId}:${Date.now()}`,
        channels: ["push"],
      });

      await reload();
      setTestMessage("Push-only test sent.");
    } catch (err: unknown) {
      setTestError(
        err instanceof Error ? err.message : "Failed to send push-only test.",
      );
    } finally {
      setTestingNotification(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_30%)]" />

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={role} />

        <main className="min-w-0 flex-1 p-4 sm:px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/85 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="border-b border-white/10 bg-white/3 p-5 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
                    <Bell size={14} />
                    Workspace notifications
                  </div>

                  <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                    Notifications
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                    Activity across duty roster, leave, meetings, chat, tasks,
                    approvals, and system events.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUnreadOnly((prev) => !prev)}
                    className={[
                      "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                      showUnreadOnly
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    {showUnreadOnly ? "Unread only ✓" : "Unread only"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void markEverythingAsRead()}
                    disabled={unreadCount === 0}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Mark all read ({unreadCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                  >
                    <RefreshCw
                      size={14}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-black/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                  Loaded
                </p>
                <p className="mt-3 text-3xl font-bold">
                  {notifications.length}
                </p>
              </div>

              <div className="rounded-3xl border border-orange-500/15 bg-orange-500/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300/70">
                  Unread
                </p>
                <p className="mt-3 text-3xl font-bold text-orange-300">
                  {unreadCount}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                  Delivery
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                  <Smartphone size={16} className="text-green-300" />
                  {pushEnabled ? "Push enabled" : "Push optional"}
                </p>
              </div>
            </div>
          </div>

          {import.meta.env.DEV ? (
            <div className="mb-6 rounded-3xl border border-white/10 bg-black/40 p-4 text-xs text-white/45">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <p>Auth user ID: {currentUser.id}</p>
                <p>Profile ID: {currentProfile.id}</p>
                <p>Current role: {role}</p>
                <p>Organization ID: {organizationId || "—"}</p>
                <p>Notifications loaded: {notifications.length}</p>
                <p>Unread count: {unreadCount}</p>
              </div>

              {error ? (
                <p className="mt-3 text-red-300">Hook error: {error}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mb-6 flex flex-wrap gap-2">
            {visibleCategories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const count = categoryCounts[cat] ?? 0;
              const isActive = activeCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                    isActive
                      ? "border-orange-500/30 bg-orange-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  <Icon size={14} className={isActive ? meta.color : ""} />
                  {meta.label}
                  {count > 0 ? (
                    <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {(role === "admin" || role === "manager") && (
            <div className="mb-6 flex flex-wrap gap-3">
              <Link
                to="/admin/roster"
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15"
              >
                <CalendarClock size={15} />
                Manage Duty Roster
              </Link>

              <Link
                to="/admin/leave"
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/15"
              >
                <CalendarDays size={15} />
                Review Leave Requests
              </Link>
            </div>
          )}

          <section className="space-y-3">
            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
                Loading notifications...
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
                <Bell size={36} className="mx-auto mb-4 text-white/20" />
                <p className="font-semibold text-white">
                  {showUnreadOnly
                    ? "No unread notifications"
                    : "No notifications yet"}
                </p>
                <p className="mt-2 text-sm text-white/45">
                  {activeCategory === "all"
                    ? "Activity across the system will appear here."
                    : `No ${CATEGORY_META[
                        activeCategory
                      ].label.toLowerCase()} notifications yet.`}
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onRead={(id) => void markOneAsRead(id)}
                />
              ))
            )}
          </section>

          {(role === "admin" || role === "manager" || role === "it") && (
            <section className="mt-8 rounded-3xl border border-white/10 bg-neutral-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-orange-500" />
                    <p className="text-sm font-semibold text-white">
                      Notification delivery test
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    Enable push for this device, then send a live notification
                    to test in-app, email, and browser push delivery.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleEnablePush()}
                    disabled={enablingPush || pushEnabled}
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
                      pushEnabled
                        ? "border-green-500/20 bg-green-500/10 text-green-300"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    {pushEnabled ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Smartphone size={15} />
                    )}
                    {enablingPush
                      ? "Enabling..."
                      : pushEnabled
                        ? "Push enabled"
                        : "Enable push"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSendPushOnlyTest()}
                    disabled={testingNotification}
                    className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-2.5 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Push-only test
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSendTestNotification()}
                    disabled={testingNotification}
                    className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-orange-500/10 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testingNotification ? "Sending..." : "Send full test"}
                  </button>
                </div>
              </div>

              {testMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {testMessage}
                </div>
              ) : null}

              {testError ? (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {testError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 text-sm text-white/55 sm:grid-cols-5">
                {(
                  [
                    ["1. DB row", "Notification appears in the table."],
                    ["2. Bell", "Counter updates instantly."],
                    ["3. Email", "Email delivery is queued/sent."],
                    ["4. Push", "Browser notification appears."],
                    ["5. Logs", "Delivery state is updated."],
                  ] as [string, string][]
                ).map(([title, desc]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <p className="font-medium text-white">{title}</p>
                    <p className="mt-2 text-xs leading-5">{desc}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="mt-6 flex items-center gap-2 text-xs text-white/30">
            <Info size={12} />
            Viewing as{" "}
            <span className="capitalize text-white/50">
              {role.replace(/_/g, " ")}
            </span>
            . Notification categories are filtered to your role.
          </p>
        </main>
      </div>
    </div>
  );
}
