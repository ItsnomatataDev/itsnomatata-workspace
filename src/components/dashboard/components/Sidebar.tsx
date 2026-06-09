import { Fragment, useEffect, useState } from "react";
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
  Bot,
  LogOut,
  Bug,
  Activity,
  CalendarDays,
  CalendarClock,
  MapPinned,
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
  UserCircle,
  Inbox,
  FileText,
  Camera,
  Truck,
  Wrench,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOutUser } from "../../../lib/supabase/auth";
import NotificationBell from "../../../features/notifications/components/NotificationBell";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useOrganizationBranding } from "../../../app/providers/OrganizationBrandingProvider";
import {
  canUseDetailedTimeTracking,
  getOfficeCapabilities,
} from "../../../lib/offices";
import { checkIsPlatformAdmin } from "../../../features/platform-admin/services/platformAdminService";
import { useOrganizationFeatures, type FeatureKey } from "../../../lib/hooks/useOrganizationFeatures";
import { useSidebarBadges } from "../../../lib/hooks/useSidebarBadges";

type LinkItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  featureKey?: FeatureKey;
};

type GroupItem = {
  type: "group";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  activePaths: string[];
  children: LinkItem[];
  featureKey?: FeatureKey;
};

type NavItem = LinkItem | GroupItem;

type SidebarCounts = {
  projects?: number;
  boards?: number;
  openCards?: number;
  pendingInvites?: number;
  openIssues?: number;
};

const commonLinks: LinkItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox, featureKey: "notifications" },
  { to: "/boards", label: "Boards", icon: BriefcaseBusiness, featureKey: "boards" },
  { to: "/time-entries", label: "Time entries", icon: Clock3, featureKey: "timesheets" },
  { to: "/attendance", label: "Attendance", icon: Timer, featureKey: "attendance" },
  { to: "/leave", label: "Leave", icon: CalendarDays, featureKey: "leave_requests" },
  { to: "/roster", label: "Duty Roster", icon: CalendarClock, featureKey: "duty_roster" },
  { to: "/my-schedule", label: "My Schedule", icon: CalendarDays },
  { to: "/chat", label: "Team Chat", icon: MessageSquare, featureKey: "chat" },
  { to: "/meetings", label: "Meetings", icon: Video, featureKey: "meetings" },
  { to: "/ai-workspace", label: "AI Workspace", icon: Sparkles, featureKey: "ai_workspace" },

];

const systemOwnerAdminLinks: LinkItem[] = [
  { to: "/admin/platform-admin", label: "Platform Admin", icon: ShieldCheck },
  { to: "/admin/operations-center", label: "Operations Center", icon: Activity },
];

function tourismOperationsNav(): GroupItem {
  return {
    type: "group",
    label: "Tourism Ops",
    icon: MapPinned,
    color: "text-teal-300",
    activePaths: ["/tourism"],
    featureKey: "tourism_operations",
    children: [
      { to: "/tourism", label: "Operations", icon: LayoutDashboard, featureKey: "tourism_operations" },
      { to: "/tourism/bookings", label: "Bookings", icon: ClipboardList, featureKey: "tourism_operations" },
      { to: "/tourism/itineraries", label: "Itineraries", icon: CalendarClock, featureKey: "tourism_operations" },
      { to: "/tourism/guests", label: "Guests", icon: Users, featureKey: "tourism_operations" },
      { to: "/tourism/transfers", label: "Transfers", icon: Truck, featureKey: "tourism_operations" },
    ],
  };
}

function filterNavByFeatures(items: NavItem[], isEnabled: (featureKey?: string | null) => boolean) {
  return items.flatMap((item) => {
    if ("type" in item && item.type === "group") {
      if (!isEnabled(item.featureKey)) return [];
      const children = item.children.filter((child) => isEnabled(child.featureKey));
      if (children.length === 0) return [];
      return [{ ...item, children }];
    }

    return isEnabled(item.featureKey) ? [item] : [];
  });
}

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
            "/content-studio",
          ],
          children: [
            { to: "/social-media", label: "Command Center", icon: BarChart3, featureKey: "social_media" },
            {
              to: "/social-media-manager",
              label: "AI Content Manager",
              icon: Sparkles,
              featureKey: "social_media",
            },
            { to: "/social-posts", label: "Social Posts", icon: Megaphone, featureKey: "social_media" },
            { to: "/content-studio/clients", label: "Content Studio", icon: FileText, featureKey: "content_review" },
          ],
        },
      ];

    case "media_team":
      return [
        {
          type: "group",
          label: "Media Team",
          icon: Camera,
          color: "text-purple-400",
          activePaths: [
            "/media-dashboard",
            "/creative-requests",
            "/production-pipeline",
            "/content-assets",
            "/campaign-visuals",
            "/editing-queue",
            "/delivery-tracker",
            "/admin/content-studio",
            "/content-studio",
          ],
          children: [
            { to: "/media-dashboard", label: "Media Dashboard", icon: LayoutDashboard, featureKey: "media_dashboard" },
            { to: "/creative-requests", label: "Creative Requests", icon: Sparkles, featureKey: "media_dashboard" },
            { to: "/production-pipeline", label: "Production Pipeline", icon: BarChart3, featureKey: "media_dashboard" },
            { to: "/content-assets", label: "Content Assets", icon: Image, featureKey: "media_dashboard" },
            { to: "/content-studio/clients", label: "Content Studio", icon: FileText, featureKey: "content_review" },
            { to: "/content-studio/uploads", label: "Review Uploads", icon: FileText, featureKey: "content_review" },
            { to: "/campaign-visuals", label: "Campaign Visuals", icon: Megaphone, featureKey: "media_dashboard" },
            { to: "/editing-queue", label: "Editing Queue", icon: Timer, featureKey: "media_dashboard" },
            { to: "/delivery-tracker", label: "Delivery Tracker", icon: Package, featureKey: "media_dashboard" },
          ],
        },
      ];

    case "seo_specialist":
      return [{ to: "/seo", label: "SEO", icon: Search }];

    case "tourism_operations_manager":
      return [
        tourismOperationsNav(),
        { to: "/location-planner", label: "Location Planner", icon: MapPinned },
        { to: "/fleet", label: "Fleet", icon: Truck, featureKey: "fleet" },
        { to: "/reports", label: "Reports", icon: BarChart3, featureKey: "reports" },
      ];

    case "reservations_agent":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/bookings", "/tourism/itineraries", "/tourism/guests"].includes(child.to),
          ),
        },
      ];

    case "guest_relations":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/itineraries", "/tourism/guests"].includes(child.to),
          ),
        },
      ];

    case "tour_guide":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/itineraries"].includes(child.to),
          ),
        },
      ];

    case "driver":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/transfers"].includes(child.to),
          ),
        },
      ];

    case "activity_coordinator":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/bookings", "/tourism/itineraries"].includes(child.to),
          ),
        },
      ];

    case "fleet_coordinator":
      return [
        {
          ...tourismOperationsNav(),
          children: tourismOperationsNav().children.filter((child) =>
            ["/tourism", "/tourism/transfers"].includes(child.to),
          ),
        },
        { to: "/fleet", label: "Fleet", icon: Truck, featureKey: "fleet" },
      ];

    case "it":
      return [
        { to: "/it/war-room", label: "War Room", icon: LayoutDashboard },
        {
          to: "/boards",
          label: "Boards / Clients",
          icon: BriefcaseBusiness,
          badge: counts?.boards ?? counts?.projects,
          featureKey: "boards",
        },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets", "/admin/attendance"],
          children: [
            { to: "/timesheets/team", label: "Team timesheet", icon: Clock3, featureKey: "timesheets" },
            { to: "/admin/attendance", label: "Attendance", icon: Timer, featureKey: "attendance" },
          ],
        },
        {
          type: "group",
          label: "Assets",
          icon: Package,
          color: "text-blue-400",
          activePaths: ["/assets", "/scan", "/fleet"],
          children: [
            { to: "/assets", label: "Assets", icon: ShieldCheck, featureKey: "stock" },
            { to: "/scan", label: "Scan Asset", icon: ScanLine, featureKey: "stock" },
            { to: "/fleet", label: "Fleet", icon: Truck, featureKey: "fleet" },
            { to: "/fleet/imports", label: "Fleet Imports", icon: ClipboardList, featureKey: "fleet" },
            { to: "/fleet/fuel-purchases", label: "Fuel Purchases", icon: Timer, featureKey: "fleet" },
            { to: "/fleet/service", label: "Fleet Service", icon: Wrench, featureKey: "fleet" },
          ],
        },
        { to: "/automations", label: "Automations", icon: Sparkles, featureKey: "automation" },
        { to: "/ai-automation-review", label: "AI Automation Review", icon: Bot, featureKey: "automation" },
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

case "manager":
return [
tourismOperationsNav(),
{ to: "/location-planner", label: "Location Planner", icon: MapPinned },
{ type: "group", label: "Assets", icon: Package, color: "text-blue-400", activePaths: ["/assets", "/scan", "/fleet"], children: [
{ to: "/assets", label: "Assets", icon: ShieldCheck, featureKey: "stock" },
{ to: "/scan", label: "Scan Asset", icon: ScanLine, featureKey: "stock" },
{ to: "/fleet", label: "Fleet", icon: Truck, featureKey: "fleet" },
{ to: "/fleet/imports", label: "Fleet Imports", icon: ClipboardList, featureKey: "fleet" },
{ to: "/fleet/fuel-purchases", label: "Fuel Purchases", icon: Timer, featureKey: "fleet" },
{ to: "/fleet/service", label: "Fleet Service", icon: Wrench, featureKey: "fleet" },
],
},
{ to: "/ai-automation-review", label: "AI Automation Review", icon: Bot, featureKey: "automation" },
];

 case "org_admin":
 case "admin":
 return [
    {to: "/admin/dashboard", label: "Admin Dashboard", icon: LayoutDashboard, featureKey: "admin_dashboard",},
    tourismOperationsNav(),
    { to: "/admin/employees", label: "Employees", icon: Users, featureKey: "admin_users" },
    { to: "/admin/leave", label: "Leave Request", icon: CalendarDays, featureKey: "admin_leave" },
    { to: "/admin/roster", label: "Duty Roster", icon: CalendarClock, featureKey: "admin_roster" },
    { to: "/admin/location-planner", label: "Location Planner", icon: MapPinned },
    { to: "/admin/attendance", label: "Attendance", icon: Timer, featureKey: "attendance" },
    { to: "/organization/settings", label: "Org Settings", icon: Settings },
    { to: "/admin/documents", label: "Documents", icon: FileText, featureKey: "knowledge_base" },
    { to: "/admin/content-studio/clients", label: "Content Studio", icon: FileText, featureKey: "content_review" },
    { to: "/admin/payslips", label: "Payslips", icon: ClipboardList, featureKey: "finance" },
    {type: "group", label: "Assets", icon: Package, color: "text-blue-400",activePaths: ["/assets", "/scan", "/fleet"],
          children: [
            { to: "/assets", label: "All Assets", icon: ShieldCheck, featureKey: "stock" },
            { to: "/scan", label: "Scan Asset", icon: ScanLine, featureKey: "stock" },
            { to: "/fleet", label: "Fleet", icon: Truck, featureKey: "fleet" },
            { to: "/fleet/imports", label: "Fleet Imports", icon: ClipboardList, featureKey: "fleet" },
            { to: "/fleet/fuel-purchases", label: "Fuel Purchases", icon: Timer, featureKey: "fleet" },
            { to: "/fleet/service", label: "Fleet Service", icon: Wrench, featureKey: "fleet" },
          ],
        },
        {
          type: "group",
          label: "Time Management",
          icon: Timer,
          color: "text-orange-400",
          activePaths: ["/timesheets", "/everhour", "/board-management", "/time-approvals"],
          children: [
            { to: "/timesheets/team", label: "Team timesheet", icon: Clock3, featureKey: "timesheets" },
            { to: "/time-approvals", label: "Time Approvals", icon: ShieldCheck, featureKey: "timesheets" },
            { to: "/timesheets/reports", label: "Reports", icon: BarChart3, featureKey: "reports" },
            {
              to: "/timesheets/everhouradmin",
              label: "Admin Everhour",
              icon: ClipboardList,
              featureKey: "timesheets",
            },
            {
              to: "/board-management",
              label: "Board Management",
              icon: BriefcaseBusiness,
              featureKey: "boards",
            },
            {
              to: "/board-management",
              label: "Stop All Timers",
              icon: Timer,
              featureKey: "timesheets",
            },
          ],
        },
        { to: "/ai-automation-review", label: "AI Automation Review", icon: Bot, featureKey: "automation" },
      
      ];

    case "user":
      return [];

    case "super_admin":
    case "superadmin":
    case "it-superadmin":
      return getRoleNav("admin", counts);

    default:
      return [];
  }
}

function resolveNavBadge(
  to: string,
  explicitBadge: number | undefined,
  badges: ReturnType<typeof useSidebarBadges>,
) {
  if (typeof explicitBadge === "number") return explicitBadge;
  if (to === "/inbox") return badges.inbox;
  if (to === "/chat") return badges.chat;
  if (to === "/leave") return badges.leave;
  if (to === "/admin/leave") return badges.adminLeave;
  return 0;
}

function NavGroup({
  item,
  onNavigate,
  badges,
}: {
  item: GroupItem;
  onNavigate: () => void;
  badges: ReturnType<typeof useSidebarBadges>;
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
                {(() => {
                  const badge = resolveNavBadge(child.to, child.badge, badges);
                  return badge > 0 ? (
                    <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null;
                })()}
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
  const { isEnabled } = useOrganizationFeatures();
  const { branding } = useOrganizationBranding();
  const sidebarBadges = useSidebarBadges();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    checkIsPlatformAdmin()
      .then((result) => {
        if (mounted) setIsPlatformAdmin(result);
      })
      .catch((err) => {
        console.error("SIDEBAR PLATFORM ADMIN CHECK ERROR:", err);
        if (mounted) setIsPlatformAdmin(false);
      });

    return () => {
      mounted = false;
    };
  }, [auth?.user?.id]);

  const officeCapabilities = getOfficeCapabilities(auth?.profile?.office);
  const isThreeLittleBirds = officeCapabilities.isThreeLittleBirds;
  const canUseTimeTracking = canUseDetailedTimeTracking(auth?.profile);
  const organization = auth?.profile?.organization as
    | {
        slug?: string;
        is_system_organization?: boolean;
        is_system_owner?: boolean;
      }
    | null
    | undefined;
  const isItsNomatataOrganization = Boolean(
    organization?.slug === "its-nomatata" ||
      organization?.is_system_organization ||
      organization?.is_system_owner,
  );
  const baseCommonLinks = isThreeLittleBirds
    ? commonLinks.filter((link) =>
        !["/ai-workspace", "/meetings"].includes(link.to),
      )
    : commonLinks;
  const visibleCommonLinks = filterNavByFeatures(baseCommonLinks, isEnabled) as LinkItem[];
  const canSeeSystemOwnerAdminLinks =
    isPlatformAdmin &&
    isItsNomatataOrganization &&
    ["admin", "org_admin", "super_admin", "superadmin", "it-superadmin"].includes(
      String(role ?? ""),
    );
  const isAdminRole = ["admin", "org_admin", "super_admin", "superadmin"].includes(String(role ?? ""));
  const canUseLocationPlanner =
    officeCapabilities.locationPlanner &&
    isAdminRole;
  const canUseMySchedule = officeCapabilities.isThreeLittleBirds || canUseLocationPlanner;
  const rawRoleNav = getRoleNav(role, counts);
  const officeScopedRoleNav = rawRoleNav.flatMap<NavItem>((item) => {
        if ("type" in item && item.type === "group") {
          const children = item.children.filter(
            (child) =>
              !child.to.includes("location-planner") &&
              !child.to.startsWith("/admin/content-studio") &&
              (!isThreeLittleBirds || canUseTimeTracking || child.to !== "/timesheets/team") &&
              (!isThreeLittleBirds || canUseTimeTracking || child.to !== "/board-management"),
          );
          return children.length > 0 ? [{ ...item, children } as GroupItem] : [];
        }
        const link = item as LinkItem;
        if (link.to === "/admin/location-planner") {
          return canUseLocationPlanner ? [link] : [];
        }
        if (link.to.includes("location-planner")) return [];
        if (isThreeLittleBirds && link.to.startsWith("/admin/content-studio")) return [];
        if (isThreeLittleBirds && !canUseTimeTracking && link.to === "/timesheets/team") return [];
        return [link];
      });
  const roleNav = filterNavByFeatures(officeScopedRoleNav, isEnabled);
  const mainNav = visibleCommonLinks.filter((link) => link.to !== "/my-schedule" || canUseMySchedule);
  const roleSpecificNav = [
    ...roleNav,
    ...(canSeeSystemOwnerAdminLinks ? systemOwnerAdminLinks : []),
  ];
  const allNav: NavItem[] = [
    ...mainNav,
    ...roleSpecificNav,
  ];
  const roleSectionStartsAt = mainNav.length;
  const showRoleDivider = roleSectionStartsAt > 0 && roleSpecificNav.length > 0;

  const handleLogout = async () => {
    try {
      await signOutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const closeMobileMenu = () => setMobileOpen(false);
  const brandName = branding.brand_name || "ITsNomatata";
  const logoUrl = branding.logo_url;
  const accentColor = branding.accent_color || "#f97316";

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Workspace
          </p>

          <div className="mt-2 w-28">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${brandName} logo`}
                className="h-auto max-h-16 w-full object-contain object-left"
              />
            ) : (
              <p className="truncate text-xl font-bold text-white">
                {brandName}
              </p>
            )}
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
          const divider = showRoleDivider && index === roleSectionStartsAt ? (
            <div className="px-4 py-3" aria-hidden="true">
              <div
                className="h-px rounded-full"
                style={{
                  backgroundColor: "var(--org-button)",
                  boxShadow: "0 0 16px color-mix(in srgb, var(--org-button) 45%, transparent)",
                }}
              />
            </div>
          ) : null;

          if ("type" in item && item.type === "group") {
            return (
              <Fragment key={`group-${item.label}-${index}`}>
                {divider}
                <NavGroup
                  item={item}
                  onNavigate={closeMobileMenu}
                  badges={sidebarBadges}
                />
              </Fragment>
            );
          }

          const link = item as LinkItem;
          const Icon = link.icon;

          return (
            <Fragment key={link.to}>
              {divider}
              <NavLink
                to={link.to}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "text-white shadow-md"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: "var(--org-button)",
                        boxShadow: "0 10px 24px color-mix(in srgb, var(--org-button) 20%, transparent)",
                      }
                    : undefined
                }
              >
                <Icon size={18} />
                <span className="flex-1">{link.label}</span>

                {(() => {
                  const badge = resolveNavBadge(link.to, link.badge, sidebarBadges);
                  return badge > 0 ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: "var(--org-button)",
                        color: "var(--org-button-text)",
                      }}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null;
                })()}
              </NavLink>
            </Fragment>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <NavLink
          to="/profile"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            [
              "mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
              isActive
                ? "text-white shadow-md"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            ].join(" ")
          }
          style={({ isActive }) =>
            isActive
              ? {
                  backgroundColor: "var(--org-button)",
                  boxShadow: "0 10px 24px color-mix(in srgb, var(--org-button) 20%, transparent)",
                }
              : undefined
          }
        >
          <UserCircle size={18} />
          Profile
        </NavLink>

        <NavLink
          to="/settings"
          onClick={closeMobileMenu}
          className={({ isActive }) =>
            [
              "mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
              isActive
                ? "text-white shadow-md"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            ].join(" ")
          }
          style={({ isActive }) =>
            isActive
              ? {
                  backgroundColor: "var(--org-button)",
                  boxShadow: "0 10px 24px color-mix(in srgb, var(--org-button) 20%, transparent)",
                }
              : undefined
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>

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
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 px-4 lg:hidden" style={{ backgroundColor: "var(--org-topbar)" }}>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <h1 className="truncate text-lg font-bold text-white">
          {brandName}
        </h1>

        <NotificationBell />
      </div>

      {/* Desktop spacer prevents overlap */}
      <div className="hidden w-72 shrink-0 lg:block" />

      {/* Desktop fixed sidebar */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-white/10 lg:flex"
        style={{ backgroundColor: "var(--org-sidebar)", borderRightColor: `${accentColor}33` }}
      >
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

          <aside
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 shadow-2xl"
            style={{ backgroundColor: "var(--org-sidebar)", borderRightColor: `${accentColor}33` }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
