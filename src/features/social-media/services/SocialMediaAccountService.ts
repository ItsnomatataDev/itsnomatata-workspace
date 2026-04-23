import { supabase } from "../../../lib/supabase/client";

export interface SocialMediaAccount {
  id: string;
  organization_id: string;
  user_id: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
  account_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  is_active: boolean;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  last_sync_at?: string;
  sync_status: string;
  platform_data: any;
  created_at: string;
  updated_at: string;
}

export interface ConnectionConfig {
  platform: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
}

export class SocialMediaAccountService {
  private static readonly PLATFORM_CONFIGS: Record<string, ConnectionConfig> = {
    facebook: {
      platform: 'facebook',
      client_id: import.meta.env.VITE_FACEBOOK_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_FACEBOOK_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/facebook/callback`,
      scopes: ['pages_read_engagement', 'pages_manage_posts', 'pages_manage_engagement', 'publish_to_groups']
    },
    instagram: {
      platform: 'instagram',
      client_id: import.meta.env.VITE_INSTAGRAM_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_INSTAGRAM_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/instagram/callback`,
      scopes: ['basic', 'pages_show_list', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments']
    },
    twitter: {
      platform: 'twitter',
      client_id: import.meta.env.VITE_TWITTER_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_TWITTER_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/twitter/callback`,
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
    },
    linkedin: {
      platform: 'linkedin',
      client_id: import.meta.env.VITE_LINKEDIN_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
      scopes: ['r_liteprofile', 'r_emailaddress', 'r_organization_admin', 'w_organization_social', 'rw_organization_admin']
    },
    youtube: {
      platform: 'youtube',
      client_id: import.meta.env.VITE_YOUTUBE_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_YOUTUBE_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/youtube/callback`,
      scopes: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload']
    },
    tiktok: {
      platform: 'tiktok',
      client_id: import.meta.env.VITE_TIKTOK_CLIENT_ID || '',
      client_secret: import.meta.env.VITE_TIKTOK_CLIENT_SECRET || '',
      redirect_uri: `${window.location.origin}/auth/tiktok/callback`,
      scopes: ['user.info.basic', 'video.publish']
    }
  };

  // Get OAuth URL for platform
  static getOAuthUrl(platform: string, organizationId: string): string {
    const config = this.PLATFORM_CONFIGS[platform];
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const state = btoa(JSON.stringify({ organizationId, platform }));
    
    switch (platform) {
      case 'facebook':
      case 'instagram':
        return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${config.scopes.join(',')}&response_type=code&state=${state}`;
      
      case 'twitter':
        return `https://twitter.com/i/oauth2/authorize?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${config.scopes.join(' ')}&response_type=code&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
      
      case 'linkedin':
        return `https://www.linkedin.com/oauth/v2/authorization?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${config.scopes.join(' ')}&response_type=code&state=${state}`;
      
      case 'youtube':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${config.scopes.join(' ')}&response_type=code&state=${state}&access_type=offline&prompt=consent`;
      
      case 'tiktok':
        return `https://www.tiktok.com/v2/auth/authorize?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${config.scopes.join(',')}&response_type=code&state=${state}`;
      
      default:
        throw new Error(`OAuth URL generation not implemented for ${platform}`);
    }
  }

  // Handle OAuth callback
  static async handleOAuthCallback(code: string, state: string): Promise<SocialMediaAccount> {
    try {
      const stateData = JSON.parse(atob(state));
      const { organizationId, platform } = stateData;
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(platform, code);
      
      // Get user profile
      const profile = await this.getUserProfile(platform, tokens.access_token);
      
      // Save account to database
      const account = await this.saveAccount({
        organization_id: organizationId,
        platform: platform as any,
        account_id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        profile_image_url: profile.profile_image_url,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at,
        follower_count: profile.followers || 0,
        following_count: profile.following || 0,
        posts_count: profile.posts || 0,
        engagement_rate: profile.engagement_rate || 0,
        is_active: true,
        is_verified: profile.verified || false,
        sync_status: 'connected',
        platform_data: profile
      });

      return account;
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw new Error('Failed to connect social media account');
    }
  }

  // Exchange authorization code for tokens
  private static async exchangeCodeForTokens(platform: string, code: string): Promise<any> {
    const config = this.PLATFORM_CONFIGS[platform];
    
    switch (platform) {
      case 'facebook':
      case 'instagram':
        return this.exchangeFacebookCode(code, config);
      case 'twitter':
        return this.exchangeTwitterCode(code, config);
      case 'linkedin':
        return this.exchangeLinkedInCode(code, config);
      case 'youtube':
        return this.exchangeYouTubeCode(code, config);
      case 'tiktok':
        return this.exchangeTikTokCode(code, config);
      default:
        throw new Error(`Token exchange not implemented for ${platform}`);
    }
  }

  private static async exchangeFacebookCode(code: string, config: ConnectionConfig): Promise<any> {
    const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        code: code,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    };
  }

  private static async exchangeTwitterCode(code: string, config: ConnectionConfig): Promise<any> {
    // Get bearer token
    const basicAuth = btoa(`${config.client_id}:${config.client_secret}`);
    
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=authorization_code&code=' + code + '&redirect_uri=' + config.redirect_uri + '&code_verifier=challenge',
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description);
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
    };
  }

  private static async exchangeLinkedInCode(code: string, config: ConnectionConfig): Promise<any> {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        code: code,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    };
  }

  private static async exchangeYouTubeCode(code: string, config: ConnectionConfig): Promise<any> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        grant_type: 'authorization_code',
        code: code,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    };
  }

  private static async exchangeTikTokCode(code: string, config: ConnectionConfig): Promise<any> {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: config.client_id,
        client_secret: config.client_secret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirect_uri,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    };
  }

  // Get user profile from platform
  private static async getUserProfile(platform: string, accessToken: string): Promise<any> {
    switch (platform) {
      case 'facebook':
        return this.getFacebookProfile(accessToken);
      case 'instagram':
        return this.getInstagramProfile(accessToken);
      case 'twitter':
        return this.getTwitterProfile(accessToken);
      case 'linkedin':
        return this.getLinkedInProfile(accessToken);
      case 'youtube':
        return this.getYouTubeProfile(accessToken);
      case 'tiktok':
        return this.getTikTokProfile(accessToken);
      default:
        throw new Error(`Profile retrieval not implemented for ${platform}`);
    }
  }

  private static async getFacebookProfile(accessToken: string): Promise<any> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,picture,followers_count,accounts&access_token=${accessToken}`);
    const data = await response.json();
    
    return {
      id: data.id,
      username: data.name.toLowerCase().replace(/\s+/g, '_'),
      display_name: data.name,
      profile_image_url: data.picture?.data?.url,
      followers: data.followers_count || 0,
      verified: data.verified || false,
    };
  }

  private static async getInstagramProfile(accessToken: string): Promise<any> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=id,username,followers_count,media_count,follows_count,profile_picture_url&access_token=${accessToken}`);
    const data = await response.json();
    
    const account = data.data?.[0];
    if (!account) {
      throw new Error('No Instagram account found');
    }

    return {
      id: account.id,
      username: account.username,
      display_name: account.username,
      profile_image_url: account.profile_picture_url,
      followers: account.followers_count || 0,
      following: account.follows_count || 0,
      posts: account.media_count || 0,
      verified: account.verified || false,
    };
  }

  private static async getTwitterProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,verified', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    
    return {
      id: data.data.id,
      username: data.data.username,
      display_name: data.data.name,
      profile_image_url: data.data.profile_image_url,
      followers: data.data.public_metrics?.followers_count || 0,
      following: data.data.public_metrics?.following_count || 0,
      posts: data.data.public_metrics?.tweet_count || 0,
      verified: data.data.verified || false,
    };
  }

  private static async getLinkedInProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://api.linkedin.com/v2/people/~:(id,firstName,lastName,profilePicture(displayImage~:playableStreams),publicProfileUrl)', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    
    return {
      id: data.id,
      username: data.publicProfileUrl?.split('/in/')[1] || '',
      display_name: `${data.firstName} ${data.lastName}`,
      profile_image_url: data.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier,
      followers: 0, // LinkedIn doesn't provide follower count in basic profile
      verified: false,
    };
  }

  private static async getYouTubeProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    
    const channel = data.items?.[0];
    if (!channel) {
      throw new Error('No YouTube channel found');
    }

    return {
      id: channel.id,
      username: channel.snippet.customUrl || channel.snippet.title.toLowerCase().replace(/\s+/g, '_'),
      display_name: channel.snippet.title,
      profile_image_url: channel.snippet.thumbnails?.default?.url,
      followers: parseInt(channel.statistics.subscriberCount) || 0,
      posts: parseInt(channel.statistics.videoCount) || 0,
      verified: false,
    };
  }

  private static async getTikTokProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    
    return {
      id: data.data.user.open_id,
      username: data.data.user.display_name,
      display_name: data.data.user.display_name,
      profile_image_url: data.data.user.avatar_url,
      followers: data.data.user.stats?.follower_count || 0,
      following: data.data.user.stats?.following_count || 0,
      posts: data.data.user.stats?.video_count || 0,
      verified: data.data.user.is_verified || false,
    };
  }

  // Save account to database
  private static async saveAccount(accountData: Partial<SocialMediaAccount>): Promise<SocialMediaAccount> {
    const { data, error } = await supabase
      .from('social_media_accounts')
      .upsert(accountData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Get all accounts for organization
  static async getAccounts(organizationId: string): Promise<SocialMediaAccount[]> {
    const { data, error } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  // Disconnect account
  static async disconnectAccount(accountId: string): Promise<void> {
    const { error } = await supabase
      .from('social_media_accounts')
      .update({ is_active: false })
      .eq('id', accountId);

    if (error) {
      throw error;
    }
  }

  // Refresh access token
  static async refreshAccessToken(accountId: string): Promise<void> {
    const account = await this.getAccountById(accountId);
    if (!account || !account.refresh_token) {
      throw new Error('No refresh token available');
    }

    const newTokens = await this.refreshTokens(account.platform, account.refresh_token);
    
    await supabase
      .from('social_media_accounts')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        token_expires_at: newTokens.expires_at,
      })
      .eq('id', accountId);
  }

  private static async refreshTokens(platform: string, refreshToken: string): Promise<any> {
    // Implementation for token refresh varies by platform
    // This is a simplified version - you'd implement platform-specific refresh logic
    return {
      access_token: 'new_access_token',
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + (3600 * 1000)).toISOString(),
    };
  }

  // Get account by ID
  static async getAccountById(accountId: string): Promise<SocialMediaAccount | null> {
    const { data, error } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  // Sync account data
  static async syncAccountData(accountId: string): Promise<void> {
    const account = await this.getAccountById(accountId);
    if (!account || !account.access_token) {
      throw new Error('Account not found or no access token');
    }

    try {
      const profile = await this.getUserProfile(account.platform, account.access_token);
      
      await supabase
        .from('social_media_accounts')
        .update({
          follower_count: profile.followers || account.follower_count,
          following_count: profile.following || account.following_count,
          posts_count: profile.posts || account.posts_count,
          engagement_rate: profile.engagement_rate || account.engagement_rate,
          last_sync_at: new Date().toISOString(),
          sync_status: 'synced',
          platform_data: profile,
        })
        .eq('id', accountId);
    } catch (error) {
      await supabase
        .from('social_media_accounts')
        .update({
          sync_status: 'error',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', accountId);
      
      throw error;
    }
  }
}
