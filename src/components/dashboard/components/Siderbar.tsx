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
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../../../lib/supabase/auth";

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
    admin: [
      { to: "/approvals", label: "Approvals", icon: ShieldCheck },
      { to: "/campaigns", label: "Campaigns", icon: BriefcaseBusiness },
    ],
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

  const links = [...commonLinks, ...getRoleLinks(role, counts)];

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-black lg:flex lg:flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">
          ITs <span className="text-orange-500">Nomatata</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.to}
              to={link.to}
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
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
