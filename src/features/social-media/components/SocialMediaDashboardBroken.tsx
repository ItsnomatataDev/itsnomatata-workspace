import { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Globe,
  Camera,
  Globe2,
  MessageSquare,
  Briefcase,
  Play,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface SocialMetrics {
  platform: string;
  icon: any;
  followers: number;
  engagement: number;
  reach: number;
  posts: number;
  growth: number;
}

interface ContentPerformance {
  id: string;
  title: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagement: number;
  postedAt: string;
  status: "published" | "scheduled" | "draft";
}

interface SocialGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  progress: number;
  status: "on-track" | "behind" | "ahead";
}

export default function SocialMediaDashboard() {
  const [metrics, setMetrics] = useState<SocialMetrics[]>([]);
  const [topContent, setTopContent] = useState<any[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load real data from Supabase
      const { data: accounts } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('is_active', true);

      const { data: content } = await supabase
        .from('content_calendar')
        .select(`
          *,
          social_media_accounts(platform, username)
        `)
        .in('status', ['published', 'scheduled'])
        .order('performance_score', { ascending: false })
        .limit(10);

      // Transform account data to metrics
      const accountMetrics = accounts?.map(account => ({
        platform: account.platform,
        icon: getPlatformIcon(account.platform),
        followers: account.follower_count || 0,
        engagement: account.engagement_rate || 0,
        reach: calculateReach(account.follower_count, account.engagement_rate),
        posts: account.posts_count || 0,
        growth: calculateGrowth(account.id)
      })) || [];

      // Transform content data to top content
      const topPerforming = content?.map((item: any) => ({
        id: item.id,
        title: item.title,
        platform: item.social_media_accounts.platform,
        type: item.post_type,
        engagement: await calculateEngagement(item.id),
        reach: await calculateReachFromContent(item.id),
        likes: await getEngagementCount(item.id, 'like'),
        comments: await getEngagementCount(item.id, 'comment'),
        shares: await getEngagementCount(item.id, 'share'),
        performance: item.performance_score || 0
      })) || [];

      setMetrics(accountMetrics);
      setTopContent(topPerforming);
      setMonthlyGoals(await loadMonthlyGoals());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <ArrowUp size={16} className="text-green-400" />
    ) : (
      <ArrowDown size={16} className="text-red-400" />
    );
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? "text-green-400" : "text-red-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-track":
        return "bg-green-500/10 border-green-500/20 text-green-400";
      case "ahead":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      case "behind":
        return "bg-orange-500/10 border-orange-500/20 text-orange-400";
      default:
        return "bg-gray-500/10 border-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-white/60">Loading social media dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Social Media Dashboard</h1>
            <p className="text-white/60 mt-1">Track performance across all social platforms</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors">
              Create Content
            </button>
            <button className="px-4 py-2 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors">
              Export Report
            </button>
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Total Followers</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatNumber(metrics.reduce((sum, m) => sum + m.followers, 0))}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp size={14} className="text-green-400" />
                  <span className="text-xs text-green-400">+12.5%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-blue-500/15 p-3">
                <Users size={20} className="text-blue-400" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Avg Engagement</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(metrics.reduce((sum, m) => sum + m.engagement, 0) / metrics.length).toFixed(1)}%
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp size={14} className="text-green-400" />
                  <span className="text-xs text-green-400">+2.3%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-green-500/15 p-3">
                <Heart size={20} className="text-green-400" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Total Reach</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatNumber(metrics.reduce((sum, m) => sum + m.reach, 0))}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp size={14} className="text-green-400" />
                  <span className="text-xs text-green-400">+18.7%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-purple-500/15 p-3">
                <Eye size={20} className="text-purple-400" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Posts This Month</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {metrics.reduce((sum, m) => sum + m.posts, 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp size={14} className="text-orange-400" />
                  <span className="text-xs text-orange-400">+8.2%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-orange-500/15 p-3">
                <MessageCircle size={20} className="text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Platform Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-orange-400" />
              Platform Performance
            </h3>
            <div className="space-y-4">
              {metrics.map((platform) => (
                <div key={platform.platform} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <platform.icon size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{platform.platform}</p>
                      <p className="text-xs text-white/60">{formatNumber(platform.followers)} followers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      {getGrowthIcon(platform.growth)}
                      <span className={`text-sm font-medium ${getGrowthColor(platform.growth)}`}>
                        {platform.growth >= 0 ? "+" : ""}{platform.growth}%
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{platform.engagement}% engagement</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Content */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-400" />
              Top Performing Content
            </h3>
            <div className="space-y-3">
              {topContent.map((content) => (
                <div key={content.id} className="p-3 rounded-lg bg-white/5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{content.title}</p>
                      <p className="text-xs text-white/60 mt-1">{content.platform}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Heart size={12} />
                          {formatNumber(content.likes)}
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <MessageCircle size={12} />
                          {content.comments}
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Share2 size={12} />
                          {content.shares}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-400">{content.engagement}%</p>
                      <p className="text-xs text-white/40">engagement</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Goals Progress */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target size={18} className="text-blue-400" />
            Monthly Goals Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {goals.map((goal) => (
              <div key={goal.id} className={`p-4 rounded-lg border ${getStatusColor(goal.status)}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">{goal.title}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-white/10">
                    {goal.status.replace('-', ' ')}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>{goal.current} / {goal.target} {goal.unit}</span>
                    <span>{goal.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-white/60">Due: {goal.deadline}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
