import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Bell,
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
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOutUser } from "../../../lib/supabase/auth";
import NotificationBell from "../../../features/notifications/components/NotificationBell";

// ── Types ──────────────────────────────────────────────────

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
  activePaths: string[]; // any of these being active expands + highlights the group
  children: LinkItem[];
};

type NavItem = LinkItem | GroupItem;

type SidebarCounts = {
  projects?: number;
  pendingInvites?: number;
  openIssues?: number;
};

// ── Common links (all roles) ───────────────────────────────

const commonLinks: LinkItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/boards", label: "Boards", icon: BriefcaseBusiness },
  { to: "/time", label: "Time Tracking", icon: Clock3 },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/roster", label: "Duty Roster", icon: CalendarClock },
  { to: "/chat", label: "Team Chat", icon: MessageSquare },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/ai-workspace", label: "AI Workspace", icon: Sparkles },
];

// ── Role nav builders ──────────────────────────────────────

function getRoleNav(role?: string | null, counts?: SidebarCounts): NavItem[] {
  switch (role) {
    case "social_media":
      return [
        {
          type: "group",
          label: "Social Media",
          icon: Megaphone,
          color: "text-pink-400",
          activePaths: ["/social-media", "/social-media-manager", "/social-posts"],
          children: [
            { to: "/social-media", label: "Command Center", icon: BarChart3 },
            { to: "/social-media-manager", label: "AI Content Manager", icon: Sparkles },
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
        { to: "/it/dashboard", label: "IT Dashboard", icon: LayoutDashboard },
        {
          to: "/it/projects",
          label: "Projects",
          icon: BriefcaseBusiness,
          badge: counts?.projects,
        },
        {
          to: "/it/collaboration",
          label: "Collaboration",
          icon: Users,
          badge: counts?.pendingInvites,
        },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets"],
          children: [
            { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
          ],
        },
        { to: "/automations", label: "Automations", icon: Sparkles },
        { to: "/automation-runs", label: "Automation Runs", icon: Activity },
        {
          to: "/it/issues",
          label: "Issues",
          icon: Bug,
          badge: counts?.openIssues,
        },
        { to: "/it/system-monitor", label: "System Monitor", icon: Activity },
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
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets", "/board-management"],
          children: [
            { to: "/timesheets/team", label: "Team Timesheet", icon: Clock3 },
            { to: "/board-management", label: "Board Management", icon: BriefcaseBusiness },
          ],
        },
        {
          type: "group",
          label: "Social Media",
          icon: Megaphone,
          color: "text-pink-400",
          activePaths: ["/social-media", "/social-media-manager", "/social-posts"],
          children: [
            { to: "/social-media", label: "Social Media Dashboard", icon: BarChart3 },
            { to: "/social-media-manager", label: "AI Content Manager", icon: Sparkles },
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
            {
              to: "/timesheets/team",
              label: "Team Timesheet",
              icon: Clock3,
            },
            {
              to: "/timesheets/reports",
              label: "Reports",
              icon: BarChart3,
            },
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
        { to: "/admin/ai", label: "AI Control", icon: Sparkles },
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

  const isAnyChildActive = item.children.some((child) =>
    location.pathname.startsWith(child.to),
  );

  const [open, setOpen] = useState(isAnyChildActive);
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isAnyChildActive
            ? "bg-white/8 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon
          size={18}
          className={isAnyChildActive ? item.color : "text-white/40"}
        />
        <span className="flex-1 text-left">{item.label}</span>
        {isAnyChildActive ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${item.color} bg-current/10`}
            style={{ backgroundColor: "rgba(249,115,22,0.12)" }}
          >
            {item.children.length}
          </span>
        ) : null}

        <span className="text-white/25 transition-transform duration-200">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/8 pl-3">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                      : "text-white/50 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                <ChildIcon size={15} />
                <span className="flex-1">{child.label}</span>
                {typeof child.badge === "number" && child.badge > 0 && (
                  <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {child.badge}
                  </span>
                )}
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleNav = getRoleNav(role, counts);
  const allNav: NavItem[] = [...commonLinks, ...roleNav];

  const handleLogout = async () => {
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleNavigateMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Workspace
          </p>
          <div className="mt-2 w-28 truncate text-2xl font-bold text-white">
            <img
              src="https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png"
              alt="it's no matata logo"
              className="h-full w-full"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-4">
        {allNav.map((item, i) => {
  
          if ("type" in item && item.type === "group") {
            return (
              <NavGroup
                key={`group-${item.label}-${i}`}
                item={item}
                onNavigate={handleNavigateMobile}
              />
            );
          }

          const link = item as LinkItem;
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={handleNavigateMobile}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={18} />
              <span className="flex-1">{link.label}</span>
              {typeof link.badge === "number" && link.badge > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {link.badge}
                </span>
              )}
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
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black px-4 py-4 lg:hidden">
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

        <div className="shrink-0">
          <NotificationBell />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-black shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-black lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
