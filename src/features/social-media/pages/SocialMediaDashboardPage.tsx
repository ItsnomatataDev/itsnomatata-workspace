import { useState } from "react";
import SocialMediaSidebar from "../../../components/dashboard/components/SocialMediaSidebar";
import SocialMediaDashboard from "../components/SocialMediaDashboard";
import ContentCalendar from "../components/ContentCalendar";
import SocialMediaManager from "../components/SocialMediaManager";
import { useAuth } from "../../../app/providers/AuthProvider";
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
} from "lucide-react";

export default function SocialMediaDashboardPage() {
  const auth = useAuth();
  const user = auth?.user;
  const profile = auth?.profile;
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "manager">("dashboard");

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/60">Please log in to access the Social Media Dashboard.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "dashboard",
      label: "Analytics Dashboard",
      icon: BarChart3,
      description: "View performance metrics and insights"
    },
    {
      id: "calendar",
      label: "Content Calendar",
      icon: Calendar,
      description: "Schedule and manage your content"
    },
    {
      id: "manager",
      label: "AI Content Manager",
      icon: Wand2,
      description: "Generate AI-powered content strategies"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white lg:flex">
      <SocialMediaSidebar />
      
      <div className="flex-1 lg:ml-64">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              Social Media Command Center
            </h1>
            <p className="text-white/60">
              Complete AI-powered social media management for your brand
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-orange-500 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Total Followers</p>
                  <p className="text-2xl font-bold text-white">349K</p>
                  <p className="text-xs text-green-400">+12.5%</p>
                </div>
                <Users className="text-blue-400" size={20} />
              </div>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Avg Engagement</p>
                  <p className="text-2xl font-bold text-white">4.8%</p>
                  <p className="text-xs text-green-400">+2.3%</p>
                </div>
                <Heart className="text-green-400" size={20} />
              </div>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Total Reach</p>
                  <p className="text-2xl font-bold text-white">2.3M</p>
                  <p className="text-xs text-green-400">+18.7%</p>
                </div>
                <Eye className="text-purple-400" size={20} />
              </div>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Posts This Month</p>
                  <p className="text-2xl font-bold text-white">936</p>
                  <p className="text-xs text-orange-400">+8.2%</p>
                </div>
                <MessageCircle className="text-orange-400" size={20} />
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "dashboard" && <SocialMediaDashboard />}
          {activeTab === "calendar" && <ContentCalendar organizationId={profile.organization_id || ""} />}
          {activeTab === "manager" && <SocialMediaManager />}
        </div>
      </div>
    </div>
  );
}
