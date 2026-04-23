import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useAuth } from "../../../app/providers/AuthProvider";
import { SocialMediaAccountService, type SocialMediaAccount } from "../services/SocialMediaAccountService";
import {
  Plus,
  Settings,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  TrendingUp,
  Camera,
  Globe2,
  MessageSquare,
  Briefcase,
  Play,
  X,
} from "lucide-react";

interface SocialMediaAccountManagerProps {
  organizationId: string;
  onAccountConnected?: (account: SocialMediaAccount) => void;
}

export default function SocialMediaAccountManager({ organizationId, onAccountConnected }: SocialMediaAccountManagerProps) {
  const auth = useAuth();
  const [accounts, setAccounts] = useState<SocialMediaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [organizationId]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const accountData = await SocialMediaAccountService.getAccounts(organizationId);
      setAccounts(accountData);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setError('Failed to load social media accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = async (platform: string) => {
    try {
      setConnecting(platform);
      setError(null);

      const oauthUrl = SocialMediaAccountService.getOAuthUrl(platform, organizationId);

      const popup = window.open(oauthUrl, 'connect-social', 'width=600,height=600');
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          const account = await SocialMediaAccountService.handleOAuthCallback(
            event.data.code,
            event.data.state
          );
          
          setAccounts(prev => [...prev, account]);
          setSuccess(`${platform} account connected successfully!`);
          onAccountConnected?.(account);
          
          popup?.close();
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'OAUTH_ERROR') {
          setError(`Failed to connect ${platform}: ${event.data.error}`);
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
    } catch (error) {
      console.error('Error connecting account:', error);
      setError(`Failed to connect ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    
    try {
      await SocialMediaAccountService.disconnectAccount(accountId);
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      setSuccess('Account disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting account:', error);
      setError('Failed to disconnect account');
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId);
      await SocialMediaAccountService.syncAccountData(accountId);
      await loadAccounts(); 
      setSuccess('Account synced successfully');
    } catch (error) {
      console.error('Error syncing account:', error);
      setError('Failed to sync account');
    } finally {
      setSyncing(null);
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

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      facebook: 'bg-blue-500',
      instagram: 'bg-pink-500',
      twitter: 'bg-sky-500',
      linkedin: 'bg-blue-600',
      youtube: 'bg-red-500',
      tiktok: 'bg-black',
    };
    return colors[platform] || 'bg-gray-500';
  };

  const getPlatformUrl = (account: SocialMediaAccount) => {
    const urls = {
      facebook: `https://facebook.com/${account.username}`,
      instagram: `https://instagram.com/${account.username}`,
      twitter: `https://twitter.com/${account.username}`,
      linkedin: `https://linkedin.com/in/${account.username}`,
      youtube: `https://youtube.com/channel/${account.account_id}`,
      tiktok: `https://tiktok.com/@${account.username}`,
    };
    return urls[account.platform] || '#';
  };

  const platforms = [
    { id: 'facebook', name: 'Facebook', description: 'Connect your Facebook Page', icon: Globe2 },
    { id: 'instagram', name: 'Instagram', description: 'Connect your Instagram Business Account', icon: Camera },
    { id: 'twitter', name: 'Twitter', description: 'Connect your Twitter account', icon: MessageSquare },
    { id: 'linkedin', name: 'LinkedIn', description: 'Connect your LinkedIn Page', icon: Briefcase },
    { id: 'youtube', name: 'YouTube', description: 'Connect your YouTube Channel', icon: Play },
    { id: 'tiktok', name: 'TikTok', description: 'Connect your TikTok account', icon: Play },
  ];

  const connectedPlatforms = accounts.map(acc => acc.platform);
  const availablePlatforms = platforms.filter(p => !connectedPlatforms.includes(p.id as any));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Social Media Accounts</h2>
          <p className="text-white/60">Connect and manage your social media profiles</p>
        </div>
        <button
          onClick={loadAccounts}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} className="text-red-400" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <span className="text-green-400">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X size={16} className="text-green-400" />
          </button>
        </div>
      )}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Connected Accounts</h3>
        
        {accounts.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-lg bg-white/5">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-white/40" />
            </div>
            <p className="text-white/60">No social media accounts connected yet</p>
            <p className="text-white/40 text-sm mt-2">Connect your accounts to start managing your social media</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="border border-white/10 bg-white/5 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${getPlatformColor(account.platform)} rounded-lg flex items-center justify-center`}>
                      {(() => {
                        const Icon = getPlatformIcon(account.platform);
                        return <Icon size={24} className="text-white" />;
                      })()}
                    </div>
                    <div>
                      <h4 className="text-white font-medium capitalize">{account.platform}</h4>
                      <p className="text-white/60 text-sm">@{account.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${
                          account.is_verified ? 'bg-green-400' : 'bg-gray-400'
                        }`}></span>
                        <span className="text-xs text-white/60">
                          {account.is_verified ? 'Verified' : 'Not Verified'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {account.is_active ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-white/60">Followers</p>
                    <p className="text-lg font-bold text-white">{account.follower_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Engagement</p>
                    <p className="text-lg font-bold text-white">{account.engagement_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Posts</p>
                    <p className="text-lg font-bold text-white">{account.posts_count}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} className="text-white/40" />
                  <span className="text-xs text-white/40">
                    Last sync: {account.last_sync_at ? 
                      new Date(account.last_sync_at).toLocaleString() : 
                      'Never'
                    }
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    account.sync_status === 'synced' ? 'bg-green-500/20 text-green-400' :
                    account.sync_status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {account.sync_status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncAccount(account.id)}
                    disabled={syncing === account.id}
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-sm text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncing === account.id ? 'animate-spin' : ''} />
                    {syncing === account.id ? 'Syncing...' : 'Sync'}
                  </button>
                  
                  <a
                    href={getPlatformUrl(account)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-sm text-white hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink size={14} />
                    View
                  </a>
                  
                  <button
                    onClick={() => handleDisconnectAccount(account.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 size={14} />
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {availablePlatforms.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Connect New Account</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlatforms.map((platform) => (
              <div key={platform.id} className="border border-white/10 bg-white/5 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 ${getPlatformColor(platform.id)} rounded-lg flex items-center justify-center`}>
                    <platform.icon size={24} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{platform.name}</h4>
                    <p className="text-white/60 text-xs">{platform.description}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleConnectAccount(platform.id)}
                  disabled={connecting === platform.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
                >
                  {connecting === platform.id ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Connect {platform.name}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border border-white/10 bg-white/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">How to Connect Accounts</h3>
        <ol className="space-y-2 text-white/60">
          <li>Click "Connect" on the platform you want to add</li>
          <li>Sign in to your social media account in the popup window</li>
          <li>Grant permission for our system to manage your account</li>
          <li>Your account will be automatically connected and ready to use</li>
        </ol>
        
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
          <p className="text-blue-400 text-sm">
            <strong>Privacy & Security:</strong> We only access the permissions needed to manage your social media accounts. Your data is encrypted and secure.
          </p>
        </div>
      </div>
    </div>
  );
}
