import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  BrainCircuit,
  Car,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Cpu,
  DatabaseZap,
  Gauge,
  LifeBuoy,
  PackageCheck,
  RadioTower,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { createBulkNotifications } from "../../../lib/supabase/mutations/notifications";
import {
  createSupportTicket,
  type TicketPriority,
} from "../services/supportTicketService";
import {
  getITControlCentreData,
  type ControlStatus,
  type ITControlCentreData,
} from "../services/controlCentreService";

type IconType = typeof Activity;

const statusCopy: Record<ControlStatus, { label: string; classes: string; dot: string }> = {
  green: {
    label: "Green",
    classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
  },
  amber: {
    label: "Amber",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400",
  },
  red: {
    label: "Red",
    classes: "border-red-500/25 bg-red-500/10 text-red-200",
    dot: "bg-red-400",
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(value: number | string) {
  if (typeof value === "string") return value;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not checked";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusFromCount(value: number, amberAt = 1, redAt = 4): ControlStatus {
  if (value >= redAt) return "red";
  if (value >= amberAt) return "amber";
  return "green";
}

function StatusPill({ status }: { status: ControlStatus }) {
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", statusCopy[status].classes)}>
      <span className={cx("h-2 w-2 rounded-full", statusCopy[status].dot)} />
      {statusCopy[status].label}
    </span>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: IconType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/80 p-4 shadow-2xl shadow-black/30 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-300">
            <Icon size={18} />
          </div>
          <h2 className="truncate text-base font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  status,
  route,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: ControlStatus;
  route: string;
  icon: IconType;
}) {
  return (
    <a
      href={route}
      className="group rounded-lg border border-white/10 bg-zinc-950 p-4 transition hover:border-orange-500/50 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon size={18} className="text-orange-300" />
        <StatusPill status={status} />
      </div>
      <p className="mt-5 text-3xl font-semibold text-white">{formatNumber(value)}</p>
      <p className="mt-1 text-sm font-medium text-white/75">{label}</p>
      <p className="mt-2 min-h-10 text-sm text-white/45">{detail}</p>
      <div className="mt-4 flex items-center text-xs font-semibold text-orange-300">
        Open <ChevronRight size={14} className="transition group-hover:translate-x-1" />
      </div>
    </a>
  );
}

function CommandHeader({
  data,
  firstName,
  onRefresh,
  refreshing,
}: {
  data: ITControlCentreData;
  firstName: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="mb-6 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.2),transparent_36%)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
              <RadioTower size={15} />
              IT Control Centre
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Command view for {firstName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
              Whole-platform health across people, boards, systems, assets, fleet, notifications, workflows, and AI activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={data.healthStatus} />
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <a
              href="/boards"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
            >
              <ClipboardList size={16} />
              Boards
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function HealthScoreCard({ data }: { data: ITControlCentreData }) {
  const m = data.metrics;
  return (
    <section className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_2fr]">
      <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">Platform health score</p>
            <p className="mt-3 text-6xl font-black tracking-tight text-white">{data.healthScore}</p>
          </div>
          <Gauge size={58} className="text-orange-400" />
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className={cx(
              "h-full rounded-full",
              data.healthStatus === "green" && "bg-emerald-400",
              data.healthStatus === "amber" && "bg-amber-400",
              data.healthStatus === "red" && "bg-red-400",
            )}
            style={{ width: `${data.healthScore}%` }}
          />
        </div>
        <p className="mt-4 text-sm text-white/50">
          {m.criticalAlerts} critical alerts, {m.downMonitors} down monitors, {m.workflowFailures24h} workflow failures in 24h.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.topMetrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            {...metric}
            icon={[ShieldAlert, AlertTriangle, LifeBuoy, Workflow, Bell, Car][index] ?? Activity}
          />
        ))}
      </div>
    </section>
  );
}

function CriticalAlertsPanel({ data }: { data: ITControlCentreData }) {
  const alerts = data.alerts
    .filter((alert) => alert.status !== "resolved")
    .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"))
    .slice(0, 6);

  return (
    <Panel title="Critical Alerts" icon={ShieldAlert}>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState text="No open system alerts." />
        ) : (
          alerts.map((alert) => (
            <a key={alert.id} href={alert.route} className="block rounded-lg border border-white/10 bg-black/35 p-3 hover:border-orange-500/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{alert.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/50">{alert.message ?? alert.module}</p>
                </div>
                <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", alert.severity === "critical" ? "bg-red-500/15 text-red-200" : "bg-amber-500/15 text-amber-200")}>
                  {alert.severity}
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </Panel>
  );
}

function SystemMonitorsGrid({ data }: { data: ITControlCentreData }) {
  const statusForMonitor = (status: string): ControlStatus =>
    status === "healthy" ? "green" : status === "degraded" ? "amber" : "red";
  return (
    <Panel title="System Monitors" icon={Cpu}>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.monitors.length === 0 ? (
          <EmptyState text="No monitors configured." />
        ) : (
          data.monitors.map((monitor) => (
            <div key={monitor.id} className="rounded-lg border border-white/10 bg-black/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">{monitor.name}</p>
                <StatusPill status={statusForMonitor(monitor.status)} />
              </div>
              <p className="mt-2 text-xs text-white/45">{monitor.monitor_type}</p>
              <p className="mt-1 text-xs text-white/35">{formatDateTime(monitor.last_checked_at)}</p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function TeamPulsePanel({ data }: { data: ITControlCentreData }) {
  const m = data.metrics;
  const visible = data.teamPulse.slice(0, 8);
  return (
    <Panel title="Team Pulse" icon={Users}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Active users" value={m.activeUsers} status="green" />
        <MiniStat label="Suspended" value={m.suspendedUsers} status={statusFromCount(m.suspendedUsers)} />
        <MiniStat label="Tracking now" value={m.activeTimers} status="green" />
        <MiniStat label="Not tracking" value={m.usersNotTracking} status={statusFromCount(m.usersNotTracking, 3, 8)} />
      </div>
      <div className="mt-4 space-y-2">
        {visible.map((member) => (
          <a
            key={member.id}
            href={member.active_board_id && member.active_timer_started_at ? `/boards/${member.active_board_id}` : "/organization/team"}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{member.full_name ?? member.email}</p>
              <p className="truncate text-xs text-white/40">{member.active_task_title ?? member.status}</p>
            </div>
            <span className={cx("rounded-full px-2.5 py-1 text-xs", member.status === "tracking" ? "bg-emerald-500/15 text-emerald-200" : member.status === "online" ? "bg-orange-500/15 text-orange-200" : "bg-white/10 text-white/45")}>
              {member.status}
            </span>
          </a>
        ))}
      </div>
    </Panel>
  );
}

function BoardsHealthPanel({ data }: { data: ITControlCentreData }) {
  const m = data.metrics;
  return (
    <Panel title="Boards Health" icon={ClipboardList}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniStat label="Boards" value={m.boardsCount} status="green" />
        <MiniStat label="Open" value={m.openCards} status="green" />
        <MiniStat label="Overdue" value={m.overdueCards} status={statusFromCount(m.overdueCards, 1, 6)} />
        <MiniStat label="Blocked" value={m.blockedCards} status={statusFromCount(m.blockedCards, 1, 3)} />
        <MiniStat label="Unassigned" value={m.unassignedCards} status={statusFromCount(m.unassignedCards, 3, 10)} />
      </div>
      <div className="mt-4 space-y-2">
        {data.boardRisks.length === 0 ? (
          <EmptyState text="No board risk detected." />
        ) : (
          data.boardRisks.map((board) => (
            <a key={board.board_id} href={board.route} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/35 p-3 hover:border-orange-500/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{board.board_name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {board.open_cards} open, {board.overdue_cards} overdue, {board.blocked_cards} blocked, {board.high_priority_cards} high priority
                </p>
              </div>
              <StatusPill status={board.status} />
            </a>
          ))
        )}
      </div>
    </Panel>
  );
}

function AssetsHealthPanel({ data }: { data: ITControlCentreData }) {
  const m = data.metrics;
  return (
    <Panel title="Assets Health" icon={PackageCheck}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="Total" value={m.totalAssets} status="green" />
        <MiniStat label="In stock" value={m.inStockAssets} status="green" />
        <MiniStat label="Assigned" value={m.assignedAssets} status="green" />
        <MiniStat label="Repair" value={m.damagedRepairAssets} status={statusFromCount(m.damagedRepairAssets)} />
        <MiniStat label="Warranty soon" value={m.warrantyExpiringSoon} status={statusFromCount(m.warrantyExpiringSoon, 1, 5)} />
        <MiniStat label="Uninsured" value={m.uninsuredAssets} status={statusFromCount(m.uninsuredAssets, 1, 10)} />
      </div>
      <a href="/assets" className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-white/70 hover:border-orange-500/40">
        Open asset register <ChevronRight size={16} />
      </a>
    </Panel>
  );
}

function FleetHealthPanel({ data }: { data: ITControlCentreData }) {
  const m = data.metrics;
  return (
    <Panel title="Fleet Health" icon={Car}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="Active vehicles" value={m.activeVehicles} status="green" />
        <MiniStat label="Maintenance" value={m.vehiclesInMaintenance} status={statusFromCount(m.vehiclesInMaintenance)} />
        <MiniStat label="Service overdue" value={m.serviceOverdue} status={statusFromCount(m.serviceOverdue)} />
        <MiniStat label="Service soon" value={m.serviceSoon} status={statusFromCount(m.serviceSoon, 1, 6)} />
        <MiniStat label="Fuel month" value={formatMoney(m.fuelSpendThisMonth)} status="green" />
        <MiniStat label="KM month" value={formatNumber(m.kmDrivenThisMonth)} status="green" />
      </div>
      <a href="/fleet" className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-white/70 hover:border-orange-500/40">
        Open fleet dashboard <ChevronRight size={16} />
      </a>
    </Panel>
  );
}

function SupportTicketsPanel({ data }: { data: ITControlCentreData }) {
  const tickets = data.supportTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).slice(0, 6);
  return (
    <Panel title="Support Tickets" icon={LifeBuoy}>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Open" value={data.metrics.openSupportTickets} status={statusFromCount(data.metrics.openSupportTickets, 5, 12)} />
        <MiniStat label="Urgent" value={data.metrics.urgentSupportTickets} status={statusFromCount(data.metrics.urgentSupportTickets)} />
        <MiniStat label="Unassigned" value={data.metrics.unassignedSupportTickets} status={statusFromCount(data.metrics.unassignedSupportTickets)} />
      </div>
      <ListRows rows={tickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        meta: `${ticket.priority} · ${ticket.status}${ticket.requester_email ? ` · ${ticket.requester_email}` : ""}`,
        route: "/it/support",
        status: ticket.priority === "urgent" ? "red" : ticket.priority === "high" ? "amber" : "green",
      }))} empty="No open support tickets." />
    </Panel>
  );
}

function NotificationDeliveryPanel({ data }: { data: ITControlCentreData }) {
  return (
    <Panel title="Notification Delivery" icon={Bell}>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Failed 24h" value={data.metrics.failedNotificationDeliveries24h} status={statusFromCount(data.metrics.failedNotificationDeliveries24h, 1, 8)} />
        <MiniStat label="Queued email" value={data.metrics.queuedEmailDeliveries} status={statusFromCount(data.metrics.queuedEmailDeliveries, 5, 20)} />
      </div>
      <a href="/notifications" className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-white/70 hover:border-orange-500/40">
        Inspect notifications <ChevronRight size={16} />
      </a>
    </Panel>
  );
}

function WorkflowHealthPanel({ data }: { data: ITControlCentreData }) {
  return (
    <Panel title="Workflow Health" icon={Workflow}>
      <MiniStat label="Failures in last 24h" value={data.metrics.workflowFailures24h} status={statusFromCount(data.metrics.workflowFailures24h)} />
      <ListRows rows={data.workflowFailures.slice(0, 5).map((failure) => ({
        id: failure.id,
        title: failure.workflow_name ?? failure.execution_id,
        meta: failure.error_message ?? failure.status,
        route: "/automation-runs",
        status: "red" as ControlStatus,
      }))} empty="No workflow failures in the last 24h." />
    </Panel>
  );
}

function RecentSystemEventsPanel({ data }: { data: ITControlCentreData }) {
  return (
    <Panel title="Recent System Events" icon={DatabaseZap}>
      <ListRows rows={data.recentEvents.slice(0, 8).map((event) => ({
        id: event.id,
        title: event.title,
        meta: `${event.module} · ${formatDateTime(event.created_at)}`,
        route: "/it/system-monitor",
        status: event.severity === "critical" ? "red" : event.severity === "warning" ? "amber" : "green",
      }))} empty="No recent system events." />
    </Panel>
  );
}

function AICommandPanel({
  data,
  organizationId,
  userId,
}: {
  data: ITControlCentreData;
  organizationId: string;
  userId: string;
}) {
  const [output, setOutput] = useState("Select a command to generate an operational brief from the live control-centre snapshot.");
  const [busy, setBusy] = useState(false);

  const generateBrief = (mode: string) => {
    const m = data.metrics;
    const lines = {
      health: [
        `Health is ${statusCopy[data.healthStatus].label.toLowerCase()} at ${data.healthScore}/100.`,
        `${m.criticalAlerts} critical alerts, ${m.downMonitors} down monitors, ${m.workflowFailures24h} workflow failures, and ${m.failedNotificationDeliveries24h} failed notification deliveries need review.`,
      ],
      alerts: data.alerts.length
        ? data.alerts.slice(0, 4).map((alert) => `${alert.severity.toUpperCase()}: ${alert.title} (${alert.module})`)
        : ["No unresolved critical alert is currently visible."],
      report: [
        `Daily IT report: ${m.activeUsers} active users, ${m.activeTimers} active timers, ${m.openCards} open cards, ${m.openSupportTickets} support tickets.`,
        `Assets: ${m.damagedRepairAssets} repair/damaged, ${m.warrantyExpiringSoon} warranties expiring soon. Fleet: ${m.serviceOverdue} services overdue, ${formatMoney(m.fuelSpendThisMonth)} fuel spend this month.`,
      ],
      today: [
        `${m.criticalAlerts + m.downMonitors + m.workflowFailures24h + m.serviceOverdue} items need attention today.`,
        `Start with critical alerts, down monitors, failed workflows, overdue service, and blocked board cards.`,
      ],
      workflows: data.workflowFailures.length
        ? data.workflowFailures.slice(0, 4).map((failure) => `Check ${failure.workflow_name ?? failure.execution_id}: ${failure.error_message ?? failure.status}. Review credentials, payload shape, and retry policy.`)
        : ["No failed workflow is visible in the last 24 hours."],
      boards: data.boardRisks.length
        ? data.boardRisks.slice(0, 4).map((board) => `${board.board_name}: ${board.overdue_cards} overdue, ${board.blocked_cards} blocked, ${board.high_priority_cards} high priority.`)
        : ["Board/card risk is currently low."],
      assets: [
        `Asset risk: ${m.damagedRepairAssets} repair/damaged, ${m.warrantyExpiringSoon} warranty expiring soon, ${m.uninsuredAssets} uninsured.`,
        `Fleet risk: ${m.serviceOverdue} service overdue, ${m.serviceSoon} service soon, ${m.vehiclesInMaintenance} vehicles in maintenance.`,
      ],
    } as Record<string, string[]>;
    setOutput((lines[mode] ?? lines.health).join("\n\n"));
  };

  const createTicketFromAlert = async () => {
    const alert = data.alerts.find((item) => item.status !== "resolved");
    if (!alert) {
      setOutput("No open alert is available to convert into a support ticket.");
      return;
    }
    setBusy(true);
    try {
      const priority: TicketPriority = alert.severity === "critical" ? "urgent" : "high";
      await createSupportTicket({
        organizationId,
        requesterId: userId,
        ticketType: "other",
        priority,
        title: `Alert follow-up: ${alert.title}`,
        description: alert.message ?? `System alert from ${alert.module}`,
      });
      setOutput(`Created a ${priority} support ticket for: ${alert.title}`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to create support ticket.");
    } finally {
      setBusy(false);
    }
  };

  const notifyResponsibleUsers = async () => {
    const recipients = data.teamPulse
      .filter((member) => member.status === "tracking" || member.status === "online")
      .map((member) => member.id)
      .slice(0, 12);
    if (recipients.length === 0) recipients.push(userId);
    setBusy(true);
    try {
      await createBulkNotifications({
        organizationId,
        userIds: recipients,
        type: "workspace_admin_notice",
        title: "IT Control Centre attention required",
        message: output,
        actionUrl: "/it/dashboard",
        priority: data.healthStatus === "red" ? "urgent" : "high",
        actorUserId: userId,
        category: "it_control_centre",
        channels: ["in_app", "email", "push"],
        sendEmail: true,
      });
      setOutput(`Notified ${recipients.length} active command-centre user(s).`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Failed to notify users.");
    } finally {
      setBusy(false);
    }
  };

  const commands = [
    ["Summarize system health", () => generateBrief("health"), BrainCircuit],
    ["Explain critical alerts", () => generateBrief("alerts"), ShieldAlert],
    ["Generate daily IT report", () => generateBrief("report"), ClipboardList],
    ["Needs attention today", () => generateBrief("today"), AlertTriangle],
    ["Create ticket from alert", createTicketFromAlert, LifeBuoy],
    ["Notify responsible users", notifyResponsibleUsers, Send],
    ["Suggest workflow fixes", () => generateBrief("workflows"), Workflow],
    ["Summarize board/card risk", () => generateBrief("boards"), ClipboardList],
    ["Summarize asset/fleet risk", () => generateBrief("assets"), Car],
  ] as const;

  return (
    <Panel title="AI Command Panel" icon={Bot}>
      <div className="grid gap-2 sm:grid-cols-2">
        {commands.map(([label, action, Icon]) => (
          <button
            key={label}
            type="button"
            disabled={busy}
            onClick={() => void action()}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-left text-sm text-white/75 hover:border-orange-500/40 hover:text-white disabled:opacity-60"
          >
            <Icon size={15} className="shrink-0 text-orange-300" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      <pre className="mt-4 min-h-48 whitespace-pre-wrap rounded-lg border border-orange-500/20 bg-orange-500/10 p-4 text-sm leading-6 text-orange-50">
        {output}
      </pre>
    </Panel>
  );
}

function MiniStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  status: ControlStatus;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/35 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-white/45">{label}</p>
        <span className={cx("h-2 w-2 shrink-0 rounded-full", statusCopy[status].dot)} />
      </div>
      <p className="truncate text-xl font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/35 p-4 text-sm text-white/45">
      {text}
    </div>
  );
}

function ListRows({
  rows,
  empty,
}: {
  rows: Array<{ id: string; title: string; meta: string; route: string; status: ControlStatus }>;
  empty: string;
}) {
  return (
    <div className="mt-4 space-y-2">
      {rows.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        rows.map((row) => (
          <a key={row.id} href={row.route} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/35 p-3 hover:border-orange-500/40">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{row.title}</p>
              <p className="mt-1 truncate text-xs text-white/45">{row.meta}</p>
            </div>
            <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", statusCopy[row.status].dot)} />
          </a>
        ))
      )}
    </div>
  );
}

export default function ITDashboardPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;
  const [data, setData] = useState<ITControlCentreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const firstName = useMemo(() => {
    const name = profile?.display_name || profile?.full_name || user?.email || "Operator";
    return String(name).split(" ")[0];
  }, [profile?.display_name, profile?.full_name, user?.email]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      setData(await getITControlCentreData(organizationId));
    } catch (err) {
      console.error("IT CONTROL CENTRE LOAD ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to load IT Control Centre.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !userId) return;
    void load();
  }, [organizationId, userId, load]);

  if (authLoading) {
    return <div className="min-h-screen bg-black p-6 text-white">Loading IT Control Centre...</div>;
  }

  if (!user || !profile || !organizationId || !userId) {
    return <div className="min-h-screen bg-black p-6 text-white">Your IT account is missing user or organization context.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: 0,
            boards: data?.metrics.boardsCount ?? 0,
            openCards: data?.metrics.openCards ?? 0,
            pendingInvites: data?.metrics.pendingAccountRequests ?? 0,
            openIssues: data?.metrics.openSupportTickets ?? 0,
          }}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {loading && !data ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-lg border border-white/10 bg-zinc-950" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-5 text-red-100">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle size={18} />
                Control Centre unavailable
              </div>
              <p className="mt-2 text-sm text-red-100/75">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              <CommandHeader data={data} firstName={firstName} onRefresh={() => void load()} refreshing={loading} />
              <HealthScoreCard data={data} />

              <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr] 2xl:grid-cols-[1fr_1fr_1fr]">
                <CriticalAlertsPanel data={data} />
                <SystemMonitorsGrid data={data} />
                <AICommandPanel data={data} organizationId={organizationId} userId={userId} />
              </div>

              <div className="mb-6 grid gap-4 xl:grid-cols-2">
                <TeamPulsePanel data={data} />
                <BoardsHealthPanel data={data} />
              </div>

              <div className="mb-6 grid gap-4 xl:grid-cols-2">
                <AssetsHealthPanel data={data} />
                <FleetHealthPanel data={data} />
              </div>

              <div className="mb-6 grid gap-4 xl:grid-cols-3">
                <SupportTicketsPanel data={data} />
                <NotificationDeliveryPanel data={data} />
                <WorkflowHealthPanel data={data} />
              </div>

              <RecentSystemEventsPanel data={data} />

              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/35">
                <CheckCircle2 size={14} className="text-emerald-300" />
                <span>Generated {formatDateTime(data.generatedAt)}</span>
                <Clock3 size={14} className="text-orange-300" />
                <span>All panels are scoped to this organization.</span>
                <Sparkles size={14} className="text-orange-300" />
                <span>{data.metrics.aiActions24h} AI actions in the last 24h.</span>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
