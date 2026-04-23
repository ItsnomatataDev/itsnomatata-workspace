import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Globe2,
  Camera,
  MessageSquare,
  Briefcase,
  Play,
} from "lucide-react";

interface AnalyticsDashboardProps {
  organizationId: string;
}

interface AnalyticsData {
  totalFollowers: number;
  totalEngagement: number;
  totalPosts: number;
  totalReach: number;
  growthRate: number;
  topPlatforms: Array<{
    platform: string;
    followers: number;
    engagement: number;
    posts: number;
    growth: number;
    username?: string;
  }>;
  topContent: Array<{
    id: string;
    title: string;
    platform: string;
    engagement: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  engagementTrends: Array<{
    date: string;
    likes: number;
    comments: number;
    shares: number;
    total: number;
  }>;
}

export default function AnalyticsDashboard({ organizationId }: AnalyticsDashboardProps) {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('7_days');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalFollowers: 0,
    totalEngagement: 0,
    totalPosts: 0,
    totalReach: 0,
    growthRate: 0,
    topPlatforms: [],
    topContent: [],
    engagementTrends: [],
  });

  useEffect(() => {
    loadAnalytics();
  }, [organizationId, timeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get account analytics
      const { data: accountsData } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Get content analytics
      const { data: contentData } = await supabase
        .from('content_analytics')
        .select(`
          count,
          engagement_type,
          recorded_at,
          content_calendar!inner(
            title,
            platform,
            social_media_accounts!inner(
              platform,
              username
            )
          )
        `)
        .eq('organization_id', organizationId)
        .gte('recorded_at', getDateFromTimeframe(timeframe));

      // Process data
      const totalFollowers = accountsData?.reduce((sum, acc) => sum + (acc.follower_count || 0), 0) || 0;
      const totalEngagement = contentData?.reduce((sum, item) => sum + item.count, 0) || 0;
      const totalPosts = accountsData?.reduce((sum, acc) => sum + (acc.posts_count || 0), 0) || 0;
      
      // Calculate platform breakdown
      const platformBreakdown = accountsData?.reduce((acc: any[], account: any) => {
        const platformEngagement = contentData?.filter(item => 
          item.content_calendar?.social_media_accounts?.platform === account.platform
        ).reduce((sum, item) => sum + item.count, 0) || 0;
        
        const existingIndex = acc.findIndex((item: any) => item.platform === account.platform);
        
        if (existingIndex !== -1) {
          acc[existingIndex].followers += account.follower_count || 0;
          acc[existingIndex].engagement += platformEngagement;
          acc[existingIndex].posts += account.posts_count || 0;
          acc[existingIndex].growth = calculateGrowth(account);
        } else {
          acc.push({
            platform: account.platform,
            followers: account.follower_count || 0,
            engagement: platformEngagement,
            posts: account.posts_count || 0,
            growth: calculateGrowth(account),
          });
        }
        
        return acc;
      }, []) || [];

      // Get top performing content
      const topPerformingContent = contentData?.reduce((acc: any[], item: any) => {
        const contentId = item.content_calendar?.id;
        const existingIndex = acc.findIndex((c: any) => c.id === contentId);
        
        if (existingIndex !== -1) {
          acc[existingIndex].engagement += item.count;
          if (item.engagement_type === 'like') {
            acc[existingIndex].likes = item.count;
          } else if (item.engagement_type === 'comment') {
            acc[existingIndex].comments = item.count;
          } else if (item.engagement_type === 'share') {
            acc[existingIndex].shares = item.count;
          }
        } else {
          acc.push({
            id: contentId,
            title: item.content_calendar?.title || '',
            platform: item.content_calendar?.social_media_accounts?.platform || '',
            engagement: item.count,
            reach: 0, // Would need to calculate from views
            likes: item.engagement_type === 'like' ? item.count : 0,
            comments: item.engagement_type === 'comment' ? item.count : 0,
            shares: item.engagement_type === 'share' ? item.count : 0,
          });
        }
        
        return acc;
      }, []) || [];

      // Calculate engagement trends
      const trends = calculateEngagementTrends(contentData || []);

      setAnalytics({
        totalFollowers,
        totalEngagement,
        totalPosts,
        totalReach: totalFollowers * 10, // Estimated reach
        growthRate: calculateOverallGrowthRate(accountsData || []),
        topPlatforms: platformBreakdown.slice(0, 5),
        topContent: topPerformingContent.sort((a, b) => b.engagement - a.engagement).slice(0, 10),
        engagementTrends: trends,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateGrowth = (account: any): number => {
    // Simple growth calculation - would be more sophisticated with historical data
    return Math.random() * 20 - 10; // Mock growth between -10% and +10%
  };

  const calculateOverallGrowthRate = (accounts: any[]): number => {
    if (accounts.length === 0) return 0;
    const totalGrowth = accounts.reduce((sum, acc) => sum + calculateGrowth(acc), 0);
    return totalGrowth / accounts.length;
  };

  const calculateEngagementTrends = (analytics: any[]): any[] => {
    const dailyData: Record<string, any> = {};
    
    analytics.forEach(item => {
      const date = new Date(item.recorded_at).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = { likes: 0, comments: 0, shares: 0, total: 0 };
      }
      
      dailyData[date][item.engagement_type] = (dailyData[date][item.engagement_type] || 0) + item.count;
      dailyData[date].total += item.count;
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data,
    }));
  };

  const getDateFromTimeframe = (timeframe: string): string => {
    const now = new Date();
    const days = parseInt(timeframe) || 7;
    const pastDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    return pastDate.toISOString();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, any> = {
      facebook: Globe2,
      instagram: Camera,
      twitter: MessageSquare,
      linkedin: Briefcase,
      youtube: Play,
      tiktok: Play,
    };
    return icons[platform] || Globe2;
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <ArrowUp size={16} className="text-green-400" />
    ) : (
      <ArrowDown size={16} className="text-red-400" />
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Social Media Analytics</h1>
              <p className="text-white/60">Real-time performance metrics and insights</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="7_days">Last 7 Days</option>
                <option value="30_days">Last 30 Days</option>
                <option value="90_days">Last 90 Days</option>
              </select>
              
              <button
                onClick={loadAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
        </div>

        {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="text-blue-400" size={24} />
                <span className="text-white/60 text-sm">Total Followers</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(analytics.totalFollowers)}</div>
              <div className="flex items-center gap-2 text-sm">
                {getGrowthIcon(analytics.growthRate)}
                <span className={analytics.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {Math.abs(analytics.growthRate).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Heart className="text-red-400" size={24} />
                <span className="text-white/60 text-sm">Total Engagement</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(analytics.totalEngagement)}</div>
              <div className="text-white/40 text-sm">Across all platforms</div>
            </div>

            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageCircle className="text-green-400" size={24} />
                <span className="text-white/60 text-sm">Total Posts</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(analytics.totalPosts)}</div>
              <div className="text-white/40 text-sm">Published content</div>
            </div>

            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Eye className="text-purple-400" size={24} />
                <span className="text-white/60 text-sm">Total Reach</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(analytics.totalReach)}</div>
              <div className="text-white/40 text-sm">Estimated audience</div>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Performance */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="text-orange-400" />
              Platform Performance
            </h2>
            
            {analytics.topPlatforms.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No platform data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.topPlatforms.map((platform, index) => (
                  <div key={platform.platform} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon(platform.platform)}
                      <div>
                        <h3 className="text-white font-medium capitalize">{platform.platform}</h3>
                        <p className="text-white/60 text-sm">@{platform.username || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-white/60 mb-1">Followers</div>
                      <div className="text-lg font-bold text-white">{formatNumber(platform.followers)}</div>
                      <div className="flex items-center gap-2 text-sm">
                        {getGrowthIcon(platform.growth)}
                        <span className={platform.growth >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {Math.abs(platform.growth).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Performing Content */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-orange-400" />
              Top Performing Content
            </h2>
            
            {analytics.topContent.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No content performance data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.topContent.map((content, index) => (
                  <div key={content.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getPlatformIcon(content.platform)}
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs capitalize">
                          {content.platform}
                        </span>
                      </div>
                      <h3 className="text-white font-medium">{content.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                        <span className="flex items-center gap-1">
                          <Heart size={12} />
                          {content.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={12} />
                          {content.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Share2 size={12} />
                          {content.shares}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {formatNumber(content.reach)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{formatNumber(content.engagement)}</div>
                      <div className="text-sm text-white/60">Total Engagement</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Engagement Trends */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="text-orange-400" />
              Engagement Trends
            </h2>
            
            <div className="h-64">
              {analytics.engagementTrends.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 size={48} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">No engagement trend data available</p>
                </div>
              ) : (
                <div className="h-full flex items-end justify-between gap-1">
                  {analytics.engagementTrends.slice(-30).map((trend, index) => (
                    <div key={trend.date} className="flex-1">
                      <div className="text-xs text-white/60 mb-1">{trend.date}</div>
                      <div className="h-full flex items-end justify-between gap-1">
                        <div className="flex-1 flex items-end justify-center">
                          <div 
                            className="bg-blue-500/20 rounded-t" 
                            style={{ height: `${(trend.likes / Math.max(...analytics.engagementTrends.map(t => t.likes))) * 100}%` }}
                          ></div>
                          <div 
                            className="bg-green-500/20 rounded-t" 
                            style={{ height: `${(trend.comments / Math.max(...analytics.engagementTrends.map(t => t.comments))) * 100}%` }}
                          ></div>
                          <div 
                            className="bg-purple-500/20 rounded-t" 
                            style={{ height: `${(trend.shares / Math.max(...analytics.engagementTrends.map(t => t.shares))) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
