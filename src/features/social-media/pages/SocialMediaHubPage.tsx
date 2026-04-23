import { useState } from "react";
import SocialMediaDashboard from "../components/SocialMediaDashboard";
import ContentCreator from "../components/ContentCreator";
import AIWorkflowManager from "../components/AIWorkflowManager";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import SocialMediaAccountManager from "../components/SocialMediaAccountManager";
import {
  BarChart3,
  Calendar,
  FileText,
  Users,
  Settings,
  Zap,
  Globe2,
} from "lucide-react";

interface TabType {
  id: string;
  label: string;
  icon: any;
  component: React.ComponentType<any>;
}

export default function SocialMediaHubPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs: TabType[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      component: SocialMediaDashboard,
    },
    {
      id: 'content',
      label: 'Content Creator',
      icon: FileText,
      component: ContentCreator,
    },
    {
      id: 'workflows',
      label: 'AI Workflows',
      icon: Zap,
      component: AIWorkflowManager,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      component: AnalyticsDashboard,
    },
    {
      id: 'accounts',
      label: 'Account Manager',
      icon: Users,
      component: SocialMediaAccountManager,
    },
  ];

  const ActiveComponent = tabs.find((tab: any) => tab.id === activeTab)?.component || SocialMediaDashboard;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-b border-white/10 bg-white/5 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Social Media Hub</h1>
                <p className="text-white/60">Complete social media management system</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-white/40 text-sm">
                  Powered by AI • Real API Integration • Resellable Workflows
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-8 overflow-x-auto">
              {tabs.map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-orange-400 border-b-2 border-orange-400 bg-white/10'
                      : 'text-white/60 border-b-2 border-transparent hover:text-white hover:bg-white/10'
                  }`}
                >
                  <tab.icon size={20} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2 flex items-center gap-2">
                {tabs.find((tab: any) => tab.id === activeTab)?.icon}
                <span className="text-orange-400">•</span>
                {tabs.find((tab: any) => tab.id === activeTab)?.label}
              </h2>
            </div>
            
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
