import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
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

interface TopContent {
  id: string;
  title: string;
  platform: string;
  type: string;
  engagement: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  performance: number;
}

interface MonthlyGoal {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  deadline: string;
  progress: number;
  status: "on-track" | "behind" | "ahead";
}

export default function SocialMediaDashboard() {
  const [metrics, setMetrics] = useState<SocialMetrics[]>([]);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
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
      const accountMetrics = accounts?.map((account: any) => ({
        platform: account.platform,
        icon: getPlatformIcon(account.platform),
        followers: account.follower_count || 0,
        engagement: account.engagement_rate || 0,
        reach: calculateReach(account.follower_count, account.engagement_rate),
        posts: account.posts_count || 0,
        growth: await calculateGrowth(account.id)
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

  const getPlatformIcon = (platform: string) => {
    const icons = {
      instagram: Camera,
      facebook: Globe2,
      twitter: MessageSquare,
      linkedin: Briefcase,
      youtube: Play
    };
    return icons[platform] || Globe;
  };

  const calculateReach = (followers: number, engagement: number) => {
    return Math.round(followers * (engagement / 100) * 10);
  };

  const calculateGrowth = async (accountId: string) => {
    // Calculate growth based on historical data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalData } = await supabase
      .from('social_media_accounts')
      .select('follower_count')
      .eq('id', accountId)
      .gte('updated_at', thirtyDaysAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(2);

    if (historicalData && historicalData.length >= 2) {
      const current = historicalData[0].follower_count;
      const previous = historicalData[1].follower_count;
      return previous > 0 ? ((current - previous) / previous * 100) : 0;
    }
    return 0;
  };

  const calculateEngagement = async (contentId: string) => {
    const { data } = await supabase
      .from('content_analytics')
      .select('count')
      .eq('content_id', contentId);
    
    return data?.reduce((sum, item) => sum + item.count, 0) || 0;
  };

  const calculateReachFromContent = async (contentId: string) => {
    // Calculate reach based on content performance
    const { data } = await supabase
      .from('content_analytics')
      .select('count, engagement_type')
      .eq('content_id', contentId)
      .eq('engagement_type', 'view');
    
    return data?.[0]?.count || 0;
  };

  const getEngagementCount = async (contentId: string, type: string) => {
    const { data } = await supabase
      .from('content_analytics')
      .select('count')
      .eq('content_id', contentId)
      .eq('engagement_type', type);
    
    return data?.[0]?.count || 0;
  };

  const loadMonthlyGoals = async () => {
    // Load goals from settings or calculate based on targets
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return [
      {
        id: "1",
        title: "Increase Instagram followers",
        current: await getCurrentFollowers('instagram'),
        target: await getTargetFollowers('instagram'),
        unit: "followers",
        deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`,
        progress: 0, // Calculate based on current/target
        status: "on-track" as const,
      },
      {
        id: "2",
        title: "Improve engagement rate",
        current: await getCurrentEngagementRate(),
        target: 5.0,
        unit: "%",
        deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`,
        progress: 0,
        status: "on-track" as const,
      },
      {
        id: "3",
        title: "Publish 30 posts",
        current: await getCurrentMonthPosts(),
        target: 30,
        unit: "posts",
        deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`,
        progress: 0,
        status: "on-track" as const,
      },
      {
        id: "4",
        title: "Generate 50K reach",
        current: await getCurrentMonthReach(),
        target: 50000,
        unit: "reach",
        deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`,
        progress: 0,
        status: "on-track" as const,
      }
    ];
  };

  const getCurrentFollowers = async (platform: string) => {
    const { data } = await supabase
      .from('social_media_accounts')
      .select('follower_count')
      .eq('platform', platform)
      .eq('is_active', true)
      .single();
    
    return data?.follower_count || 0;
  };

  const getTargetFollowers = async (platform: string) => {
    // Get target from settings or use default
    const { data } = await supabase
      .from('social_media_settings')
      .select('value')
      .eq('key', `${platform}_target_followers`)
      .single();
    
    return data?.value || 150000;
  };

  const getCurrentEngagementRate = async () => {
    const { data } = await supabase
      .from('social_media_accounts')
      .select('engagement_rate')
      .eq('is_active', true);
    
    if (data && data.length > 0) {
      const total = data.reduce((sum, item) => sum + (item.engagement_rate || 0), 0);
      return total / data.length;
    }
    return 0;
  };

  const getCurrentMonthPosts = async () => {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    
    const { data } = await supabase
      .from('content_calendar')
      .select('id')
      .gte('published_at', firstDayOfMonth.toISOString())
      .eq('status', 'published');
    
    return data?.length || 0;
  };

  const getCurrentMonthReach = async () => {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    
    const { data } = await supabase
      .from('content_analytics')
      .select('count')
      .eq('engagement_type', 'view')
      .gte('recorded_at', firstDayOfMonth.toISOString());
    
    return data?.reduce((sum, item) => sum + item.count, 0) || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading dashboard...</p>
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
            <h1 className="text-3xl font-bold text-white mb-2">Social Media Analytics</h1>
            <p className="text-white/60">Real-time performance metrics and insights</p>
          </div>
        </div>

        {/* Platform Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <div key={index} className="border border-white/10 bg-white/5 p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <metric.icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white capitalize">{metric.platform}</h3>
                    <p className="text-sm text-white/60">Performance Overview</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  metric.growth > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {metric.growth > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  {Math.abs(metric.growth)}%
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-white/60">Followers</p>
                  <p className="text-xl font-bold text-white">{metric.followers.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Engagement</p>
                  <p className="text-xl font-bold text-white">{metric.engagement}%</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Reach</p>
                  <p className="text-xl font-bold text-white">{metric.reach.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Posts</p>
                  <p className="text-xl font-bold text-white">{metric.posts}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Performing Content */}
        <div className="border border-white/10 bg-white/5 p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-orange-400" />
            Top Performing Content
          </h2>
          
          <div className="space-y-4">
            {topContent.map((content) => (
              <div key={content.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex-1">
                  <h3 className="text-white font-medium">{content.title}</h3>
                  <p className="text-sm text-white/60">{content.platform} - {content.type}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                    <span className="flex items-center gap-1">
                      <Heart size={14} />
                      {content.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={14} />
                      {content.comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 size={14} />
                      {content.shares}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={14} />
                      {content.reach}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{content.performance}%</div>
                  <div className="text-sm text-white/60">Performance</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Goals */}
        <div className="border border-white/10 bg-white/5 p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="text-orange-400" />
            Monthly Goals
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthlyGoals.map((goal) => (
              <div key={goal.id} className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">{goal.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    goal.status === 'on-track' ? 'bg-green-500/20 text-green-400' :
                    goal.status === 'behind' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {goal.status}
                  </span>
                </div>
                
                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm text-white/60 mb-1">
                    <span>{goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}</span>
                    <span>{Math.round(goal.progress)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <p className="text-xs text-white/40">Deadline: {goal.deadline}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
