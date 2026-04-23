import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  Wand2,
  Settings,
  Users,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Hash,
  Clock,
  Target,
  Zap,
  FileText,
  Image,
  Video,
  Mic,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";

interface SocialMediaSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SocialMediaSidebar({ isOpen = true, onClose }: SocialMediaSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth?.profile;

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    analytics: true,
    content: true,
    tools: false,
  });

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const menuItems = [
    {
      title: "Dashboard",
      icon: Home,
      path: "/social-media",
      badge: null,
    },
    {
      title: "Analytics",
      icon: BarChart3,
      path: "/social-media",
      badge: "Live",
      section: "analytics",
    },
    {
      title: "Content Calendar",
      icon: Calendar,
      path: "/social-media",
      badge: null,
      section: "analytics",
    },
    {
      title: "AI Content Manager",
      icon: Wand2,
      path: "/social-media-manager",
      badge: "AI",
      section: "content",
    },
    {
      title: "Quick Create",
      icon: Zap,
      path: "/social-media-manager",
      badge: null,
      section: "content",
    },
    {
      title: "Scheduled Posts",
      icon: Clock,
      path: "/social-media",
      badge: "12",
      section: "content",
    },
    {
      title: "Engagement Hub",
      icon: MessageCircle,
      path: "/social-media",
      badge: "5",
      section: "tools",
    },
    {
      title: "Hashtag Generator",
      icon: Hash,
      path: "/social-media-manager",
      badge: null,
      section: "tools",
    },
    {
      title: "Performance Reports",
      icon: FileText,
      path: "/social-media",
      badge: null,
      section: "tools",
    },
  ];

  const quickStats = [
    { label: "Followers", value: "349K", icon: Users, color: "text-blue-400" },
    { label: "Engagement", value: "4.8%", icon: Heart, color: "text-green-400" },
    { label: "Reach", value: "2.3M", icon: Eye, color: "text-purple-400" },
    { label: "Posts", value: "936", icon: Share2, color: "text-orange-400" },
  ];

  const handleLogout = () => {
    // TODO: Implement logout functionality
    navigate("/login");
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 ${isOpen ? "w-64" : "w-0"} bg-black border-r border-white/10 transition-all duration-300 overflow-hidden`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Share2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Social Media</h2>
              <p className="text-xs text-white/60">Command Center</p>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-white/40">
              Social Media Command Center
            </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-b border-white/10">
          <div className="grid grid-cols-2 gap-3">
            {quickStats.map((stat, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1">
                  <stat.icon size={12} className={stat.color} />
                  <span className="text-xs text-white/60">{stat.label}</span>
                </div>
                <div className="text-sm font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {Object.entries(
            menuItems.reduce((acc, item: any) => {
              if (!item.section) {
                acc.main.push(item);
              } else {
                if (!acc[item.section]) acc[item.section] = [];
                acc[item.section].push(item);
              }
              return acc;
            }, { main: [] } as Record<string, any>)
          ).map(([section, items]: [string, any[]]) => (
            <div key={section}>
              {section !== "main" && (
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between p-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
                >
                  <span className="capitalize">{section}</span>
                  {expandedSections[section] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              
              {(section === "main" || expandedSections[section]) && (
                <div className="space-y-1">
                  {items.map((item: any) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isActive(item.path)
                          ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={18} />
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      
                      {item.badge && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.badge === "AI" 
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                            : item.badge === "Live"
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-orange-500/20 text-orange-400"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Platform Quick Access */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs font-medium text-white/60 mb-3">Quick Access</div>
          <div className="grid grid-cols-5 gap-2">
            <button className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors">
              <span className="text-xs font-bold text-blue-400">f</span>
            </button>
            <button className="p-2 bg-pink-500/20 border border-pink-500/30 rounded-lg hover:bg-pink-500/30 transition-colors">
              <span className="text-xs font-bold text-pink-400">i</span>
            </button>
            <button className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors">
              <span className="text-xs font-bold text-blue-400">t</span>
            </button>
            <button className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors">
              <span className="text-xs font-bold text-red-400">y</span>
            </button>
            <button className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors">
              <span className="text-xs font-bold text-blue-400">in</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
