import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Info,
  MessageSquare,
  Shield,
  UserPlus,
  Video,
  Zap,
  RefreshCw,
  Smartphone,
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
  medium: "border-white/10 bg-white/5",
  low: "border-white/10 bg-black/30",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500 animate-pulse",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-white/30",
};

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
        "border p-4 transition",
        item.is_read
          ? "border-white/10 bg-black/30"
          : (PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium),
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-black",
            meta.color,
          ].join(" ")}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!item.is_read ? (
                  <span
                    className={[
                      "mt-0.5 h-2 w-2 shrink-0",
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
                    "border border-white/10 bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                    meta.color,
                  ].join(" ")}
                >
                  {meta.label}
                </span>

                {priority !== "medium" ? (
                  <span
                    className={[
                      "border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
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
                    className="text-xs font-medium text-orange-400 hover:text-orange-300"
                  >
                    View →
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-[11px] text-white/35">
                {timeAgo(item.created_at)}
              </span>

              {!item.is_read ? (
                <button
                  type="button"
                  onClick={() => onRead(item.id)}
                  className="border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Mark read
                </button>
              ) : (
                <span className="text-[11px] text-white/25">Read</span>
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

      setTestMessage("Push notifications enabled for this device.");
    } catch (err: unknown) {
      setTestError(
        err instanceof Error
          ? err.message
          : "Failed to enable push notifications. Check browser permissions and push_subscriptions RLS.",
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
          "This is a live test confirming the notification system is active.",
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
        "Test notification sent. Check the list, bell, email inbox, push popup, and delivery logs.",
      );
    } catch (err: unknown) {
      setTestError(
        err instanceof Error
          ? err.message
          : "Failed to send test notification. If this mentions RLS, confirm notification insert and delivery policies are applied.",
      );
    } finally {
      setTestingNotification(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border border-white/10 bg-black p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Notifications</h1>
              <p className="mt-2 text-sm text-white/50">
                Activity across duty roster, leave, meetings, chat, tasks, and
                system events — filtered to your role.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowUnreadOnly((prev) => !prev)}
                className={[
                  "border px-4 py-2.5 text-sm font-medium transition",
                  showUnreadOnly
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                ].join(" ")}
              >
                {showUnreadOnly ? "Unread only ✓" : "Show unread only"}
              </button>

              <button
                type="button"
                onClick={() => void markEverythingAsRead()}
                className="border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Mark all read ({unreadCount})
              </button>

              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mb-6 border border-white/10 bg-black p-4 text-xs text-white/45">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <p>Auth user ID: {currentUser.id}</p>
              <p>Profile ID: {currentProfile.id}</p>
              <p>Current role: {role}</p>
              <p>Organization ID: {organizationId || "—"}</p>
              <p>Notifications loaded: {notifications.length}</p>
              <p>Unread count: {unreadCount}</p>
              <p>Loading: {loading ? "yes" : "no"}</p>
            </div>

            {error ? (
              <p className="mt-3 text-red-300">Hook error: {error}</p>
            ) : null}
          </div>

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
                    "inline-flex items-center gap-2 border px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-orange-500/30 bg-orange-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  <Icon size={14} className={isActive ? meta.color : ""} />
                  {meta.label}
                  {count > 0 ? (
                    <span className="bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
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
                className="inline-flex items-center gap-2 border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 transition hover:bg-amber-500/15"
              >
                <CalendarClock size={15} />
                Manage Duty Roster
              </Link>

              <Link
                to="/admin/leave"
                className="inline-flex items-center gap-2 border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-200 transition hover:bg-sky-500/15"
              >
                <CalendarDays size={15} />
                Review Leave Requests
              </Link>
            </div>
          )}

          <section className="space-y-3">
            {loading ? (
              <div className="border border-white/10 bg-white/5 p-6 text-sm text-white/50">
                Loading notifications...
              </div>
            ) : error ? (
              <div className="border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="border border-white/10 bg-white/5 p-10 text-center">
                <Bell size={32} className="mx-auto mb-3 text-white/20" />
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
            <section className="mt-8 border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-orange-500" />
                    <p className="text-sm font-semibold text-white">
                      Notification delivery test
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-white/55">
                    Sends a live system alert to this account, tests realtime
                    delivery, triggers the n8n email webhook, and can trigger
                    push once the Edge Function is connected.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleEnablePush()}
                    disabled={enablingPush}
                    className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Smartphone size={15} />
                    {enablingPush ? "Enabling..." : "Enable push"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSendTestNotification()}
                    disabled={testingNotification}
                    className="border border-orange-500 bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testingNotification ? "Sending..." : "Send test"}
                  </button>
                </div>
              </div>

              {testMessage ? (
                <div className="mt-4 border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {testMessage}
                </div>
              ) : null}

              {testError ? (
                <div className="mt-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {testError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 text-sm text-white/55 sm:grid-cols-5">
                {(
                  [
                    ["1. DB row", "Notification should appear in the table."],
                    [
                      "2. Bell",
                      "Counter and dropdown should update instantly.",
                    ],
                    ["3. n8n", "Email webhook execution should appear."],
                    ["4. Email", "Message should arrive in the inbox."],
                    [
                      "5. Push",
                      "Browser push should arrive if enabled and Edge Function is connected.",
                    ],
                  ] as [string, string][]
                ).map(([title, desc]) => (
                  <div
                    key={title}
                    className="border border-white/10 bg-black/30 p-4"
                  >
                    <p className="font-medium text-white">{title}</p>
                    <p className="mt-2">{desc}</p>
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
