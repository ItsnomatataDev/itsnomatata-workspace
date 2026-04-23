import { supabase } from "../../../lib/supabase/client";

export interface EmailPreferences {
  all: boolean;
  types: string[];
  digest: boolean;
  digestTime: string;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface EmailTracking {
  id: string;
  organization_id: string;
  user_id: string;
  notification_id: string | null;
  email_to: string;
  email_subject: string;
  email_type: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class EmailPreferencesService {
  // Get user email preferences
  static async getUserPreferences(userId: string): Promise<EmailPreferences> {
    const { data, error } = await supabase
      .from('profiles')
      .select('email_preferences')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching email preferences:', error);
      return this.getDefaultPreferences();
    }

    return (data.email_preferences as EmailPreferences) || this.getDefaultPreferences();
  }

  // Update user email preferences
  static async updateUserPreferences(
    userId: string,
    preferences: Partial<EmailPreferences>
  ): Promise<EmailPreferences> {
    const currentPrefs = await this.getUserPreferences(userId);
    const updatedPrefs = { ...currentPrefs, ...preferences };

    const { data, error } = await supabase
      .from('profiles')
      .update({ email_preferences: updatedPrefs })
      .eq('id', userId)
      .select('email_preferences')
      .single();

    if (error) {
      throw new Error('Failed to update email preferences');
    }

    return data.email_preferences as EmailPreferences;
  }

  // Check if user should receive email for specific notification type
  static async shouldSendEmail(
    userId: string,
    notificationType: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);

    // Master switch
    if (!prefs.all) {
      return false;
    }

    // Check if type is in excluded list
    if (prefs.types.length > 0 && !prefs.types.includes(notificationType)) {
      return false;
    }

    // Check quiet hours
    if (prefs.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = prefs.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = prefs.quietHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (currentTime >= startTime && currentTime <= endTime) {
        // Only send high priority during quiet hours
        return priority === 'high';
      }
    }

    return true;
  }

  // Track email sent
  static async trackEmail(params: {
    organizationId: string;
    userId: string;
    notificationId?: string;
    emailTo: string;
    emailSubject: string;
    emailType: string;
    metadata?: Record<string, unknown>;
  }): Promise<EmailTracking> {
    const { data, error } = await supabase
      .from('email_tracking')
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        notification_id: params.notificationId || null,
        email_to: params.emailTo,
        email_subject: params.emailSubject,
        email_type: params.emailType,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error tracking email:', error);
      throw error;
    }

    return data as EmailTracking;
  }

  // Update email status (sent, delivered, opened, clicked, failed)
  static async updateEmailStatus(
    trackingId: string,
    status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'opened') {
      updateData.opened_at = new Date().toISOString();
    } else if (status === 'clicked') {
      updateData.clicked_at = new Date().toISOString();
    } else if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('email_tracking')
      .update(updateData)
      .eq('id', trackingId);

    if (error) {
      console.error('Error updating email status:', error);
      throw error;
    }
  }

  // Get email analytics for organization
  static async getEmailAnalytics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalFailed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    byType: Record<string, number>;
  }> {
    let query = supabase
      .from('email_tracking')
      .select('*')
      .eq('organization_id', organizationId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching email analytics:', error);
      throw error;
    }

    const emails = data || [];
    const totalSent = emails.length;
    const totalDelivered = emails.filter(e => e.status === 'delivered' || e.status === 'opened' || e.status === 'clicked').length;
    const totalOpened = emails.filter(e => e.status === 'opened' || e.status === 'clicked').length;
    const totalClicked = emails.filter(e => e.status === 'clicked').length;
    const totalFailed = emails.filter(e => e.status === 'failed').length;

    const byType: Record<string, number> = {};
    emails.forEach(email => {
      byType[email.email_type] = (byType[email.email_type] || 0) + 1;
    });

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      byType,
    };
  }

  // Get user's email history
  static async getUserEmailHistory(
    userId: string,
    limit = 50
  ): Promise<EmailTracking[]> {
    const { data, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching email history:', error);
      throw error;
    }

    return (data || []) as EmailTracking[];
  }

  private static getDefaultPreferences(): EmailPreferences {
    return {
      all: true,
      types: [],
      digest: false,
      digestTime: '09:00',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }
}
