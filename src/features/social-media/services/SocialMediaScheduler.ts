import { supabase } from "../../../lib/supabase/client";
import { SocialMediaAccountService } from "./SocialMediaAccountService";

export interface ScheduledPost {
  id: string;
  content_id: string;
  account_id: string;
  scheduled_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_attempt_at?: string;
  next_attempt_at?: string;
  error_message?: string;
  platform_response?: any;
}

export interface PostContent {
  id: string;
  title: string;
  content: string;
  post_type: 'post' | 'reel' | 'story' | 'carousel' | 'video' | 'image' | 'text';
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
  hashtags: string[];
  mentions: string[];
  media_urls: string[];
  media_metadata: any;
  location_data: any;
  targeting: any;
}

export class SocialMediaScheduler {
  // Schedule a post for automatic publishing
  static async schedulePost(contentId: string, scheduledAt: Date): Promise<ScheduledPost> {
    try {
      // Get content details
      const { data: content, error: contentError } = await supabase
        .from('content_calendar')
        .select('*')
        .eq('id', contentId)
        .single();

      if (contentError || !content) {
        throw new Error('Content not found');
      }

      // Create scheduled post queue entry
      const { data: scheduledPost, error: scheduleError } = await supabase
        .from('scheduled_posts_queue')
        .insert({
          content_id: contentId,
          account_id: content.account_id,
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
        })
        .select()
        .single();

      if (scheduleError) {
        throw scheduleError;
      }

      // Update content status to scheduled
      await supabase
        .from('content_calendar')
        .update({ status: 'scheduled', scheduled_at: scheduledAt.toISOString() })
        .eq('id', contentId);

      return scheduledPost;
    } catch (error) {
      console.error('Error scheduling post:', error);
      throw error;
    }
  }

  // Process pending scheduled posts
  static async processPendingPosts(): Promise<void> {
    try {
      const now = new Date();
      
      // Get posts that are ready to be published
      const { data: pendingPosts, error } = await supabase
        .from('scheduled_posts_queue')
        .select(`
          *,
          content_calendar!inner(
            title,
            content,
            post_type,
            platform,
            hashtags,
            mentions,
            media_urls,
            media_metadata,
            location_data,
            targeting
          ),
          social_media_accounts!inner(
            platform,
            access_token,
            refresh_token,
            token_expires_at
          )
        `)
        .eq('status', 'pending')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Process each post
      for (const post of pendingPosts || []) {
        await this.publishPost(post);
      }
    } catch (error) {
      console.error('Error processing pending posts:', error);
    }
  }

  // Publish a single post
  private static async publishPost(scheduledPost: any): Promise<void> {
    try {
      // Mark as processing
      await this.updatePostStatus(scheduledPost.id, 'processing');

      // Check if access token is valid
      const account = scheduledPost.social_media_accounts;
      if (this.isTokenExpired(account.token_expires_at)) {
        await SocialMediaAccountService.refreshAccessToken(account.id);
        // Refresh account data
        const refreshedAccount = await SocialMediaAccountService.getAccountById(account.id);
        if (refreshedAccount) {
          scheduledPost.social_media_accounts = refreshedAccount;
        }
      }

      // Publish based on platform
      const platform = scheduledPost.content_calendar.platform;
      let platformResponse;

      switch (platform) {
        case 'facebook':
          platformResponse = await this.publishToFacebook(scheduledPost);
          break;
        case 'instagram':
          platformResponse = await this.publishToInstagram(scheduledPost);
          break;
        case 'twitter':
          platformResponse = await this.publishToTwitter(scheduledPost);
          break;
        case 'linkedin':
          platformResponse = await this.publishToLinkedIn(scheduledPost);
          break;
        case 'youtube':
          platformResponse = await this.publishToYouTube(scheduledPost);
          break;
        case 'tiktok':
          platformResponse = await this.publishToTikTok(scheduledPost);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // Update content with platform response
      await this.updateContentAfterPublish(
        scheduledPost.content_id,
        platformResponse,
        'published'
      );

      // Mark scheduled post as completed
      await this.updatePostStatus(scheduledPost.id, 'completed', platformResponse);

      // Record analytics
      await this.recordInitialAnalytics(scheduledPost.content_id, platformResponse);

    } catch (error) {
      console.error('Error publishing post:', error);
      
      // Handle retry logic
      const newAttempts = scheduledPost.attempts + 1;
      if (newAttempts < scheduledPost.max_attempts) {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, newAttempts) * 60000; // 1min, 2min, 4min
        const nextAttemptAt = new Date(Date.now() + retryDelay);

        await this.updatePostStatus(scheduledPost.id, 'pending', undefined, {
          attempts: newAttempts,
          next_attempt_at: nextAttemptAt.toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        });
      } else {
        // Mark as failed
        await this.updatePostStatus(scheduledPost.id, 'failed', undefined, {
          attempts: newAttempts,
          error_message: error instanceof Error ? error.message : String(error),
        });

        // Update content status
        await this.updateContentAfterPublish(
          scheduledPost.content_id,
          null,
          'failed',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  // Publish to Facebook
  private static async publishToFacebook(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    // Prepare post data
    const postData: any = {
      message: this.formatContent(content_calendar.content, content_calendar.hashtags, content_calendar.mentions),
    };

    // Add media if present
    if (content_calendar.media_urls && content_calendar.media_urls.length > 0) {
      if (content_calendar.post_type === 'video') {
        // Upload video first
        const videoUrl = content_calendar.media_urls[0];
        const uploadResponse = await this.uploadFacebookVideo(videoUrl, accessToken, postData.message);
        return uploadResponse;
      } else {
        // Upload images
        postData.attached_media = await Promise.all(
          content_calendar.media_urls.map((url: string) => this.uploadFacebookImage(url, accessToken))
        );
      }
    }

    // Add location if present
    if (content_calendar.location_data) {
      postData.place = content_calendar.location_data;
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/me/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      platform_post_id: data.id,
      post_url: `https://facebook.com/${data.id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Publish to Instagram
  private static async publishToInstagram(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    // Get Instagram Business Account ID
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,instagram_business_account&access_token=${accessToken}`
    );
    const accountsData = await accountsResponse.json();
    
    const igAccount = accountsData.data?.[0]?.instagram_business_account;
    if (!igAccount) {
      throw new Error('No Instagram Business Account found');
    }

    let mediaResponse;

    if (content_calendar.post_type === 'reel' || content_calendar.post_type === 'video') {
      // Upload video
      mediaResponse = await this.uploadInstagramReel(
        content_calendar.media_urls[0],
        igAccount.id,
        accessToken,
        content_calendar.content
      );
    } else if (content_calendar.media_urls && content_calendar.media_urls.length > 0) {
      // Upload image
      mediaResponse = await this.uploadInstagramImage(
        content_calendar.media_urls[0],
        igAccount.id,
        accessToken,
        content_calendar.content
      );
    } else {
      throw new Error('Instagram posts require media');
    }

    // Publish the media
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igAccount.id}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: mediaResponse.id,
        }),
      }
    );

    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      throw new Error(publishData.error.message);
    }

    return {
      platform_post_id: publishData.id,
      post_url: `https://instagram.com/p/${publishData.id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Publish to Twitter
  private static async publishToTwitter(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    const tweetText = this.formatContent(content_calendar.content, content_calendar.hashtags, content_calendar.mentions);
    
    // Twitter has character limit
    if (tweetText.length > 280) {
      throw new Error('Tweet exceeds 280 character limit');
    }

    const postData: any = {
      text: tweetText,
    };

    // Add media if present
    if (content_calendar.media_urls && content_calendar.media_urls.length > 0) {
      const mediaIds = await Promise.all(
        content_calendar.media_urls.map((url: string) => this.uploadTwitterMedia(url, accessToken))
      );
      postData.media = { media_ids: mediaIds };
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      platform_post_id: data.data.id,
      post_url: `https://twitter.com/user/status/${data.data.id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Publish to LinkedIn
  private static async publishToLinkedIn(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    // Get LinkedIn person ID
    const profileResponse = await fetch('https://api.linkedin.com/v2/people/~:id', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const profileData = await profileResponse.json();

    const postData: any = {
      author: `urn:li:person:${profileData.id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: this.formatContent(content_calendar.content, content_calendar.hashtags, content_calendar.mentions),
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add media if present
    if (content_calendar.media_urls && content_calendar.media_urls.length > 0) {
      const mediaId = await this.uploadLinkedInMedia(content_calendar.media_urls[0], accessToken);
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          id: mediaId,
          status: 'READY',
          originalUrl: content_calendar.media_urls[0],
        },
      ];
    }

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      platform_post_id: data.id,
      post_url: `https://linkedin.com/feed/update/${data.id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Publish to YouTube
  private static async publishToYouTube(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    if (content_calendar.post_type !== 'video' || !content_calendar.media_urls?.[0]) {
      throw new Error('YouTube posts require video content');
    }

    const videoData = {
      snippet: {
        title: content_calendar.title,
        description: this.formatContent(content_calendar.content, content_calendar.hashtags, content_calendar.mentions),
        tags: content_calendar.hashtags,
      },
      status: {
        privacyStatus: 'public',
        publishAt: scheduledPost.scheduled_at,
      },
    };

    // Upload video
    const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoData),
    });

    const uploadUrl = response.headers.get('Location');
    
    if (!uploadUrl) {
      throw new Error('No upload URL returned from Twitter');
    }
    
    // Upload actual video file
    const videoResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
      },
      body: await fetch(content_calendar.media_urls[0]).then(r => r.blob()),
    });

    const data = await videoResponse.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return {
      platform_post_id: data.id,
      post_url: `https://youtube.com/watch?v=${data.id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Publish to TikTok
  private static async publishToTikTok(scheduledPost: any): Promise<any> {
    const { content_calendar, social_media_accounts } = scheduledPost;
    const accessToken = social_media_accounts.access_token;

    if (content_calendar.post_type !== 'video' || !content_calendar.media_urls?.[0]) {
      throw new Error('TikTok posts require video content');
    }

    // Initialize upload
    const initResponse = await fetch('https://open.tiktokapis.com/v2/video/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        declare_info: {
          title: content_calendar.title,
          privacy_level: 'PUBLIC_TO_EVERYONE',
        },
        video_info: {
          title: content_calendar.title,
          caption: this.formatContent(content_calendar.content, content_calendar.hashtags, content_calendar.mentions),
          tags: content_calendar.hashtags,
        },
      }),
    });

    const initData = await initResponse.json();
    
    if (initData.error) {
      throw new Error(initData.error.message);
    }

    // Upload video
    const uploadResponse = await fetch(initData.data.upload_url, {
      method: 'PUT',
      body: await fetch(content_calendar.media_urls[0]).then(r => r.blob()),
    });

    if (!uploadResponse.ok) {
      throw new Error('Video upload failed');
    }

    // Publish video
    const publishResponse = await fetch('https://open.tiktokapis.com/v2/video/publish/video/publish/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: initData.data.video_id,
        privacy_level: 'PUBLIC_TO_EVERYONE',
      }),
    });

    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      throw new Error(publishData.error.message);
    }

    return {
      platform_post_id: publishData.data.video_id,
      post_url: `https://tiktok.com/@${social_media_accounts.username}/video/${publishData.data.video_id}`,
      published_at: new Date().toISOString(),
    };
  }

  // Helper methods
  private static formatContent(content: string, hashtags: string[], mentions: string[]): string {
    let formattedContent = content;
    
    // Add hashtags
    if (hashtags && hashtags.length > 0) {
      formattedContent += '\n\n' + hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
    }
    
    // Add mentions
    if (mentions && mentions.length > 0) {
      formattedContent += '\n\n' + mentions.map(mention => mention.startsWith('@') ? mention : `@${mention}`).join(' ');
    }
    
    return formattedContent;
  }

  private static isTokenExpired(expiresAt?: string): boolean {
    if (!expiresAt) return true;
    return new Date(expiresAt) <= new Date();
  }

  private static async updatePostStatus(
    postId: string, 
    status: string, 
    platformResponse?: any,
    additionalData?: any
  ): Promise<void> {
    const updateData: any = { status };
    
    if (platformResponse) {
      updateData.platform_response = platformResponse;
    }
    
    if (additionalData) {
      Object.assign(updateData, additionalData);
    }
    
    if (status === 'processing') {
      updateData.last_attempt_at = new Date().toISOString();
    }

    await supabase
      .from('scheduled_posts_queue')
      .update(updateData)
      .eq('id', postId);
  }

  private static async updateContentAfterPublish(
    contentId: string,
    platformResponse: any,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (platformResponse) {
      updateData.published_at = platformResponse.published_at;
    }
    
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await supabase
      .from('content_calendar')
      .update(updateData)
      .eq('id', contentId);
  }

  private static async recordInitialAnalytics(contentId: string, platformResponse: any): Promise<void> {
    // Record initial analytics (views, etc. will be updated later)
    await supabase
      .from('content_analytics')
      .insert([
        {
          content_id: contentId,
          platform_post_id: platformResponse.platform_post_id,
          engagement_type: 'view',
          count: 0,
          recorded_at: new Date().toISOString(),
        },
        {
          content_id: contentId,
          platform_post_id: platformResponse.platform_post_id,
          engagement_type: 'like',
          count: 0,
          recorded_at: new Date().toISOString(),
        },
        {
          content_id: contentId,
          platform_post_id: platformResponse.platform_post_id,
          engagement_type: 'comment',
          count: 0,
          recorded_at: new Date().toISOString(),
        },
        {
          content_id: contentId,
          platform_post_id: platformResponse.platform_post_id,
          engagement_type: 'share',
          count: 0,
          recorded_at: new Date().toISOString(),
        },
      ]);
  }

  // Media upload methods (simplified - you'd implement actual upload logic)
  private static async uploadFacebookImage(imageUrl: string, accessToken: string): Promise<any> {
    // Implementation for Facebook image upload
    return { id: 'image_id', url: imageUrl };
  }

  private static async uploadFacebookVideo(videoUrl: string, accessToken: string, description: string): Promise<any> {
    // Implementation for Facebook video upload
    return { id: 'video_id', url: videoUrl };
  }

  private static async uploadInstagramImage(imageUrl: string, accountId: string, accessToken: string, caption: string): Promise<any> {
    // Implementation for Instagram image upload
    return { id: 'media_id' };
  }

  private static async uploadInstagramReel(videoUrl: string, accountId: string, accessToken: string, caption: string): Promise<any> {
    // Implementation for Instagram Reel upload
    return { id: 'media_id' };
  }

  private static async uploadTwitterMedia(mediaUrl: string, accessToken: string): Promise<string> {
    // Implementation for Twitter media upload
    return 'media_id';
  }

  private static async uploadLinkedInMedia(mediaUrl: string, accessToken: string): Promise<string> {
    // Implementation for LinkedIn media upload
    return 'media_id';
  }

  // Get scheduled posts for an account
  static async getScheduledPosts(accountId: string): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_posts_queue')
      .select(`
        *,
        content_calendar!inner(title, scheduled_at, status)
      `)
      .eq('account_id', accountId)
      .in('status', ['pending', 'processing'])
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  // Cancel scheduled post
  static async cancelScheduledPost(postId: string): Promise<void> {
    await supabase
      .from('scheduled_posts_queue')
      .update({ status: 'cancelled' })
      .eq('id', postId);

    await supabase
      .from('content_calendar')
      .update({ status: 'draft', scheduled_at: null })
      .eq('id', postId);
  }

  // Reschedule post
  static async reschedulePost(postId: string, newScheduledAt: Date): Promise<void> {
    await supabase
      .from('scheduled_posts_queue')
      .update({ 
        scheduled_at: newScheduledAt.toISOString(),
        status: 'pending',
        attempts: 0,
        error_message: null
      })
      .eq('id', postId);

    await supabase
      .from('content_calendar')
      .update({ 
        scheduled_at: newScheduledAt.toISOString(),
        status: 'scheduled'
      })
      .eq('id', postId);
  }
}
