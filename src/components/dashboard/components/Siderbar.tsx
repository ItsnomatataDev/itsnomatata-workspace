import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
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
  Menu,
  X,
  Bot
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOutUser } from "../../../lib/supabase/auth";
import NotificationBell from "../../../features/notifications/components/NotificationBell";

type LinkItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

type SidebarCounts = {
  projects?: number;
  pendingInvites?: number;
  openIssues?: number;
};

const commonLinks: LinkItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/time", label: "Time Tracking", icon: Clock3 },
  { to: "/leave", label: "Leave", icon: CalendarDays },

];

function getRoleLinks(
  role?: string | null,
  counts?: SidebarCounts,
): LinkItem[] {
  const roleLinks: Record<string, LinkItem[]> = {
    social_media: [
      { to: "/social-posts", label: "Social Posts", icon: Megaphone },
    ],
    media_team: [{ to: "/content-library", label: "Content", icon: Image }],
    seo_specialist: [{ to: "/seo", label: "SEO", icon: Search }],
    it: [
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
      { to: "/automations", label: "Automations", icon: Sparkles },
      { to: "/automation-runs", label: "Automation Runs", icon: Activity },
      {
        to: "/it/issues",
        label: "Issues",
        icon: Bug,
        badge: counts?.openIssues,
      },
      { to: "/it/system-monitor", label: "System Monitor", icon: Activity },
    ],
    manager: [
      { to: "/approvals", label: "Approvals", icon: ShieldCheck },
      { to: "/campaigns", label: "Campaigns", icon: BriefcaseBusiness },
    ],
    admin: [
      {
        to: "/admin/dashboard",
        label: "Admin Dashboard",
        icon: LayoutDashboard,
      },
      { to: "/admin/employees", label: "Employees", icon: Users },
      { to: "/admin/leave", label: "Leave Review", icon: CalendarDays },
      { to: "/admin/roster", label: "Duty Roster", icon: Clock3 },
      { to: "/admin/crm", label: "CRM", icon: BriefcaseBusiness },
      { to: "/admin/stock", label: "Stock", icon: ShieldCheck },
      { to: "/admin/chat", label: "Team Chat", icon: Image },
      { to: "/admin/ai", label: "AI Control", icon: Sparkles },
    ],
  };

  return (role && roleLinks[role]) || [];
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

  const links = [...commonLinks, ...getRoleLinks(role, counts)];

  const handleLogout = async () => {
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleNavigateMobile = () => {
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Workspace
          </p>
          <h1 className="mt-2 truncate text-2xl font-bold text-white">
            ITs<span className="text-orange-500">Nomatata</span>
          </h1>
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

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {links.map((link) => {
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
                    ? "bg-orange-500 text-black shadow-md"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={18} />
              <span className="flex-1">{link.label}</span>
              {typeof link.badge === "number" && link.badge > 0 ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-black">
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
          ITs<span className="text-orange-500">Nomatata</span>
        </h1>

        <div className="shrink-0">
          <NotificationBell />
        </div>
      </div>

      {mobileOpen ? (
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
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-black lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
