import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useAuth } from "../../../app/providers/AuthProvider";
import { SocialMediaScheduler } from "../services/SocialMediaScheduler";
import { AISocialMediaManager } from "../services/AISocialMediaManager";
import {
  Calendar,
  Clock,
  Send,
  Image,
  Video,
  FileText,
  Hash,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Save,
  Trash2,
  Edit3,
  Plus,
  Settings,
  Camera,
  Globe2,
  MessageSquare,
  Briefcase,
  Play,
} from "lucide-react";

interface ContentCreatorProps {
  organizationId: string;
  selectedAccountId?: string;
}

interface ContentItem {
  id: string;
  title: string;
  content: string;
  post_type: 'post' | 'reel' | 'story' | 'carousel' | 'video' | 'image' | 'text';
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
  status: 'draft' | 'scheduled' | 'processing' | 'published' | 'failed' | 'archived';
  scheduled_at?: string;
  published_at?: string;
  hashtags: string[];
  mentions: string[];
  media_urls: string[];
  ai_generated: boolean;
  performance_score?: number;
  engagement_prediction?: number;
  campaign_id?: string;
  social_media_accounts?: {
    platform: string;
    username: string;
  };
}

export default function ContentCreator({ organizationId, selectedAccountId }: ContentCreatorProps) {
  const auth = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>(selectedAccountId || '');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [newContent, setNewContent] = useState({
    title: '',
    content: '',
    post_type: 'post' as const,
    platform: 'instagram' as const,
    hashtags: [],
    mentions: [],
    media_urls: [],
    scheduled_at: ''
  });

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      // Load accounts
      const { data: accountsData } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Load content
      const { data: contentData } = await supabase
        .from('content_calendar')
        .select(`
          *,
          social_media_accounts!inner(
            platform,
            username
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Load campaigns
      const { data: campaignsData } = await supabase
        .from('content_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      setAccounts(accountsData || []);
      setContent(contentData || []);
      setCampaigns(campaignsData || []);
      
      // Set default account if none selected
      if (!selectedAccount && accountsData && accountsData.length > 0) {
        setSelectedAccount(accountsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreateContent = async () => {
    if (!selectedAccount) {
      alert('Please select a social media account');
      return;
    }

    try {
      setIsCreating(true);
      
      const contentData = {
        organization_id: organizationId,
        user_id: auth.user?.id,
        account_id: selectedAccount,
        campaign_id: selectedCampaign || null,
        title: newContent.title,
        content: newContent.content,
        post_type: newContent.post_type,
        platform: newContent.platform,
        status: 'draft',
        hashtags: newContent.hashtags,
        mentions: newContent.mentions,
        media_urls: newContent.media_urls,
        scheduled_at: newContent.scheduled_at || null,
        ai_generated: false,
        engagement_prediction: null,
        performance_score: null
      };

      const { data, error } = await supabase
        .from('content_calendar')
        .insert(contentData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Reset form
      setNewContent({
        title: '',
        content: '',
        post_type: 'post',
        platform: 'instagram',
        hashtags: [],
        mentions: [],
        media_urls: [],
        scheduled_at: ''
      });

      // Reload content
      await loadData();
      
      alert('Content created successfully!');
    } catch (error) {
      console.error('Error creating content:', error);
      alert('Failed to create content');
    } finally {
      setIsCreating(false);
    }
  };

  const handleScheduleContent = async (contentId: string, scheduledTime: string) => {
    try {
      await SocialMediaScheduler.schedulePost(contentId, new Date(scheduledTime));
      await loadData();
      alert('Content scheduled successfully!');
    } catch (error) {
      console.error('Error scheduling content:', error);
      alert('Failed to schedule content');
    }
  };

  const handleAIGenerate = async () => {
    if (!selectedAccount) {
      alert('Please select a social media account');
      return;
    }

    try {
      setLoading(true);
      
      const account = accounts.find(acc => acc.id === selectedAccount);
      if (!account) return;

      const context: any = {
        brandName: account.username,
        platform: account.platform,
        industry: 'general',
        targetAudience: 'general',
        toneOfVoice: 'friendly',
        contentType: 'post',
        goal: 'engagement'
      };

      const strategy = await AISocialMediaManager.generateContentStrategy(context);
      
      if (strategy.bestVersion) {
        setNewContent({
          title: (strategy.bestVersion as any).title || 'AI Generated Content',
          content: (strategy.bestVersion as any).content || '',
          post_type: 'post',
          platform: account.platform,
          hashtags: (strategy.hashtags as any) || [],
          mentions: [],
          media_urls: [],
          scheduled_at: ''
        });
      }
    } catch (error) {
      console.error('Error generating AI content:', error);
      alert('Failed to generate AI content');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await supabase
        .from('content_calendar')
        .delete()
        .eq('id', contentId);

      if (error) {
        throw error;
      }

      await loadData();
      alert('Content deleted successfully!');
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete content');
    }
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

  const getPostTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      post: FileText,
      reel: Video,
      story: Camera,
      carousel: Image,
      video: Video,
      image: Image,
      text: FileText,
    };
    return icons[type] || FileText;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500',
      scheduled: 'bg-blue-500',
      processing: 'bg-yellow-500',
      published: 'bg-green-500',
      failed: 'bg-red-500',
      archived: 'bg-gray-400',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Content Creator</h1>
            <p className="text-white/60">Create and schedule social media content</p>
          </div>
          <button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium text-white transition-colors"
          >
            <TrendingUp size={20} />
            {showAIAssistant ? 'Hide AI Assistant' : 'AI Assistant'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account and Campaign Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Choose an account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.platform} - {account.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Campaign (Optional)</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">No campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Creation Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Create New Content</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Title</label>
                  <input
                    type="text"
                    value={newContent.title}
                    onChange={(e) => setNewContent({...newContent, title: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter content title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Content</label>
                  <textarea
                    value={newContent.content}
                    onChange={(e) => setNewContent({...newContent, content: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={4}
                    placeholder="Write your content here..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Post Type</label>
                    <select
                      value={newContent.post_type}
                      onChange={(e) => setNewContent({...newContent, post_type: e.target.value as any})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="post">Post</option>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                      <option value="carousel">Carousel</option>
                      <option value="video">Video</option>
                      <option value="image">Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Platform</label>
                    <select
                      value={newContent.platform}
                      onChange={(e) => setNewContent({...newContent, platform: e.target.value as any})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="twitter">Twitter</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="youtube">YouTube</option>
                      <option value="tiktok">TikTok</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Schedule (Optional)</label>
                  <input
                    type="datetime-local"
                    value={newContent.scheduled_at}
                    onChange={(e) => setNewContent({...newContent, scheduled_at: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAIGenerate}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 rounded-lg font-medium text-white transition-colors"
                  >
                    <TrendingUp size={16} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Generating...' : 'Generate with AI'}
                  </button>

                  <button
                    onClick={handleCreateContent}
                    disabled={isCreating || !newContent.title || !newContent.content}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 rounded-lg font-medium text-white transition-colors"
                  >
                    <Save size={16} className={isCreating ? 'animate-spin' : ''} />
                    {isCreating ? 'Creating...' : 'Save as Draft'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="border border-white/10 bg-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Content</h2>
          
          {content.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="text-white/20 mx-auto mb-4" />
              <p className="text-white/60">No content created yet</p>
              <p className="text-white/40 text-sm">Create your first social media post to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {content.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getPostTypeIcon(item.post_type)}
                      {getPlatformIcon(item.platform)}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-white font-medium">{item.title}</h3>
                    <p className="text-white/60 text-sm line-clamp-2">{item.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-white/40">
                      <span className="flex items-center gap-1">
                        <Hash size={12} />
                        {item.hashtags.length} hashtags
                      </span>
                      {item.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(item.scheduled_at).toLocaleString()}
                        </span>
                      )}
                      {item.performance_score && (
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} />
                          {item.performance_score}% score
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {item.status === 'draft' && (
                      <button
                        onClick={() => handleScheduleContent(item.id, new Date().toISOString().slice(0, 16))}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm text-white transition-colors"
                      >
                        <Calendar size={14} />
                        Schedule
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDeleteContent(item.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm text-white transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
