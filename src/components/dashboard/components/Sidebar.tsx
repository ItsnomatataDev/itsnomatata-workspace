import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Clock3,
  BriefcaseBusiness,
  Megaphone,
  Image,
  Search,
  ShieldCheck,
  Sparkles,
  LogOut,
  Bug,
  Activity,
  CalendarDays,
  CalendarClock,
  Menu,
  X,
  Video,
  MessageSquare,
  ScanLine,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Timer,
  Package,
  ClipboardList,
  Settings,
  Inbox,
  FileText,
  Camera,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOutUser } from "../../../lib/supabase/auth";
import NotificationBell from "../../../features/notifications/components/NotificationBell";
import { useAuth } from "../../../app/providers/AuthProvider";
import { OFFICE_SLUGS } from "../../../lib/offices";

type LinkItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

type GroupItem = {
  type: "group";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  activePaths: string[];
  children: LinkItem[];
};

type NavItem = LinkItem | GroupItem;

type SidebarCounts = {
  projects?: number;
  boards?: number;
  openCards?: number;
  pendingInvites?: number;
  openIssues?: number;
};

const mediaDashboardRoles = new Set([
  "admin",
  "manager",
  "media_team",
  "social_media",
  "seo_specialist",
  "marketing",
]);

const commonLinks: LinkItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/boards", label: "Boards", icon: BriefcaseBusiness },
  { to: "/timesheet", label: "Timesheet", icon: Clock3 },
  { to: "/attendance", label: "Attendance", icon: Timer },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/roster", label: "Duty Roster", icon: CalendarClock },
  { to: "/chat", label: "Team Chat", icon: MessageSquare },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/ai-workspace", label: "AI Workspace", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

function getRoleNav(role?: string | null, counts?: SidebarCounts): NavItem[] {
  switch (role) {
    case "social_media":
      return [
        {
          type: "group",
          label: "Social Media",
          icon: Megaphone,
          color: "text-pink-400",
          activePaths: [
            "/social-media",
            "/social-media-manager",
            "/social-posts",
          ],
          children: [
            { to: "/social-media", label: "Command Center", icon: BarChart3 },
            {
              to: "/social-media-manager",
              label: "AI Content Manager",
              icon: Sparkles,
            },
            { to: "/social-posts", label: "Social Posts", icon: Megaphone },
          ],
        },
      ];

    case "media_team":
      return [{ to: "/content-library", label: "Content", icon: Image }];

    case "seo_specialist":
      return [{ to: "/seo", label: "SEO", icon: Search }];

    case "it":
      return [
        { to: "/it/war-room", label: "War Room", icon: LayoutDashboard },
        {
          to: "/boards",
          label: "Boards / Clients",
          icon: BriefcaseBusiness,
          badge: counts?.boards ?? counts?.projects,
        },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheet", "/timesheets", "/admin/attendance"],
          children: [
            { to: "/timesheet", label: "My Timesheet", icon: Clock3 },
            { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
            { to: "/admin/attendance", label: "Attendance", icon: Timer },
          ],
        },
        {
          type: "group",
          label: "Assets",
          icon: Package,
          color: "text-blue-400",
          activePaths: ["/assets", "/scan"],
          children: [
            { to: "/assets", label: "Assets", icon: ShieldCheck },
            { to: "/scan", label: "Scan Asset", icon: ScanLine },
          ],
        },
        { to: "/automations", label: "Automations", icon: Sparkles },
        { to: "/automation-runs", label: "Automation Runs", icon: Activity },
        {
          to: "/admin/notification-deliveries",
          label: "Notification Logs",
          icon: Activity,
        },
        {
          to: "/it/issues",
          label: "Issues",
          icon: Bug,
          badge: counts?.openIssues,
        },
        { to: "/it/system-monitor", label: "System Monitor", icon: Activity },
        { to: "/it/support", label: "Account Support", icon: ShieldCheck },
      ];

    case "hr":
      return [
        { to: "/admin/employees", label: "Employees", icon: Users },
        { to: "/admin/documents", label: "Documents", icon: FileText },
        { to: "/admin/payslips", label: "Payslips", icon: ClipboardList },
        { to: "/admin/leave", label: "Leave Request", icon: CalendarDays },
        { to: "/admin/attendance", label: "Attendance", icon: Timer },
        { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
      ];

    case "manager":
      return [
        { to: "/approvals", label: "Approvals", icon: ShieldCheck },
        { to: "/campaigns", label: "Campaigns", icon: BriefcaseBusiness },
        {
          type: "group",
          label: "Assets",
          icon: Package,
          color: "text-blue-400",
          activePaths: ["/assets", "/scan"],
          children: [
            { to: "/assets", label: "Assets", icon: ShieldCheck },
            { to: "/scan", label: "Scan Asset", icon: ScanLine },
          ],
        },
        { to: "/admin/roster", label: "Manage Roster", icon: CalendarClock },
        { to: "/admin/leave", label: "Leave Request", icon: CalendarDays },
        { to: "/admin/attendance", label: "Attendance", icon: Timer },
        { to: "/admin/documents", label: "Documents", icon: FileText },
        { to: "/admin/payslips", label: "Payslips", icon: ClipboardList },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets", "/board-management"],
          children: [
            { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
            {
              to: "/board-management",
              label: "Board Management",
              icon: BriefcaseBusiness,
            },
          ],
        },
        {
          type: "group",
          label: "Assets",
          icon: Package,
          color: "text-blue-400",
          activePaths: ["/assets", "/scan"],
          children: [
            { to: "/assets", label: "Assets", icon: ShieldCheck },
            { to: "/scan", label: "Scan Asset", icon: ScanLine },
          ],
        },
        {
          type: "group",
          label: "Social Media",
          icon: Megaphone,
          color: "text-pink-400",
          activePaths: [
            "/social-media",
            "/social-media-manager",
            "/social-posts",
          ],
          children: [
            {
              to: "/social-media",
              label: "Social Media Dashboard",
              icon: BarChart3,
            },
            {
              to: "/social-media-manager",
              label: "AI Content Manager",
              icon: Sparkles,
            },
            { to: "/social-posts", label: "Social Posts", icon: Megaphone },
          ],
        },
      ];

    case "admin":
      return [
        {
          to: "/admin/dashboard",
          label: "Admin Dashboard",
          icon: LayoutDashboard,
        },

        { to: "/admin/employees", label: "Employees", icon: Users },
        { to: "/admin/leave", label: "Leave Request", icon: CalendarDays },
        { to: "/admin/roster", label: "Duty Roster", icon: CalendarClock },
        { to: "/admin/attendance", label: "Attendance", icon: Timer },
        { to: "/admin/documents", label: "Documents", icon: FileText },
        { to: "/admin/payslips", label: "Payslips", icon: ClipboardList },
        { to: "/admin/crm", label: "CRM", icon: BriefcaseBusiness },
        {
          type: "group",
          label: "Assets",
          icon: Package,
          color: "text-blue-400",
          activePaths: ["/assets", "/scan"],
          children: [
            { to: "/assets", label: "All Assets", icon: ShieldCheck },
            { to: "/scan", label: "Scan Asset", icon: ScanLine },
          ],
        },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets", "/everhour", "/board-management"],
          children: [
            { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
            { to: "/timesheets/reports", label: "Reports", icon: BarChart3 },
            {
              to: "/timesheets/everhouradmin",
              label: "Admin Everhour",
              icon: ClipboardList,
            },
            {
              to: "/board-management",
              label: "Board Management",
              icon: BriefcaseBusiness,
            },
          ],
        },
      
      ];

    default:
      return [];
  }
}

function NavGroup({
  item,
  onNavigate,
}: {
  item: GroupItem;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const isAnyChildActive =
    item.activePaths.some((path) => location.pathname.startsWith(path)) ||
    item.children.some((child) => location.pathname.startsWith(child.to));

  const [open, setOpen] = useState(isAnyChildActive);
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
          isAnyChildActive
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon
          size={18}
          className={isAnyChildActive ? item.color : "text-white/40"}
        />
        <span className="flex-1 text-left">{item.label}</span>
        <span className="text-white/30">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
          {item.children.map((child) => {
            const ChildIcon = child.icon;

            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                      : "text-white/50 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                <ChildIcon size={15} />
                <span className="flex-1">{child.label}</span>
                {typeof child.badge === "number" && child.badge > 0 ? (
                  <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {child.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  role,
  counts,
}: {
  role?: string | null;
  counts?: SidebarCounts;
}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isThreeLittleBirds =
    auth?.profile?.office && "slug" in auth.profile.office
      ? auth.profile.office.slug === OFFICE_SLUGS.threeLittleBirds
      : false;
  const visibleCommonLinks = isThreeLittleBirds
    ? commonLinks.filter((link) => !["/ai-workspace", "/meetings"].includes(link.to))
    : commonLinks;
  const roleAwareCommonLinks = visibleCommonLinks.filter((link) => {
    if (link.to !== "/media-dashboard") return true;
    return mediaDashboardRoles.has(String(role ?? ""));
  });
  const allNav: NavItem[] = [...roleAwareCommonLinks, ...getRoleNav(role, counts)];

  const handleLogout = async () => {
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const closeMobileMenu = () => setMobileOpen(false);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Workspace
          </p>

          <div className="mt-2 w-28">
            <img
              src="https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png"
              alt="IT's Nomatata logo"
              className="h-auto w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            type="button"
            onClick={closeMobileMenu}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {allNav.map((item, index) => {
          if ("type" in item && item.type === "group") {
            return (
              <NavGroup
                key={`group-${item.label}-${index}`}
                item={item}
                onNavigate={closeMobileMenu}
              />
            );
          }

          const link = item as LinkItem;
          const Icon = link.icon;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={18} />
              <span className="flex-1">{link.label}</span>

              {typeof link.badge === "number" && link.badge > 0 ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {link.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-black px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <h1 className="truncate text-lg font-bold text-white">
          IT's<span className="text-orange-500">No matata</span>
        </h1>

        <NotificationBell />
      </div>

      {/* Desktop spacer prevents overlap */}
      <div className="hidden w-72 shrink-0 lg:block" />

      {/* Desktop fixed sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-white/10 bg-black lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 bg-black/75"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-black shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
