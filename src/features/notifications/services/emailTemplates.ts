export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailContext {
  fullName: string;
  firstName: string;
  title: string;
  message: string;
  actionUrl: string;
  metadata?: Record<string, unknown>;
  appName?: string;
  appUrl?: string;
}

export class EmailTemplateService {
  private static readonly DEFAULT_APP_NAME = "Nomatata";
  private static readonly DEFAULT_APP_URL = "https://itsnomatata.com";

  static generateTemplate(type: string, context: EmailContext): EmailTemplate {
    const appName = context.appName || this.DEFAULT_APP_NAME;
    const appUrl = context.appUrl || this.DEFAULT_APP_URL;

    switch (type) {
      case "leave_request_submitted":
        return this.leaveRequestTemplate(context, appName, appUrl);
      case "leave_request_approved":
        return this.leaveApprovedTemplate(context, appName, appUrl);
      case "leave_request_rejected":
        return this.leaveRejectedTemplate(context, appName, appUrl);
      case "meeting_invitation":
        return this.meetingInvitationTemplate(context, appName, appUrl);
      case "meeting_reminder":
        return this.meetingReminderTemplate(context, appName, appUrl);
      case "approval_required":
        return this.approvalRequiredTemplate(context, appName, appUrl);
      case "approval_approved":
        return this.approvalApprovedTemplate(context, appName, appUrl);
      case "approval_rejected":
        return this.approvalRejectedTemplate(context, appName, appUrl);
      case "social_media_post_published":
        return this.socialMediaPublishedTemplate(context, appName, appUrl);
      case "social_media_post_failed":
        return this.socialMediaFailedTemplate(context, appName, appUrl);
      case "task_assigned":
        return this.taskAssignedTemplate(context, appName, appUrl);
      case "task_due_soon":
        return this.taskDueSoonTemplate(context, appName, appUrl);
      case "task_overdue":
        return this.taskOverdueTemplate(context, appName, appUrl);
      case "welcome":
        return this.welcomeTemplate(context, appName, appUrl);
      case "password_reset":
        return this.passwordResetTemplate(context, appName, appUrl);
      default:
        return this.defaultTemplate(context, appName, appUrl);
    }
  }

  private static baseTemplate(content: string, appName: string, appUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${appName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #0a0a0a; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
          .content { padding: 32px; color: #ffffff; }
          .content h2 { color: #ffffff; margin: 0 0 16px; font-size: 20px; font-weight: 600; }
          .content p { color: #a3a3a3; line-height: 1.6; margin: 0 0 16px; }
          .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
          .button:hover { background: #ea580c; }
          .footer { padding: 24px; text-align: center; color: #525252; font-size: 12px; border-top: 1px solid #262626; }
          .footer a { color: #f97316; text-decoration: none; }
          .metadata { background: #171717; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #737373; }
          .metadata-item { margin: 8px 0; }
          .metadata-label { color: #a3a3a3; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            <p><a href="${appUrl}">Visit ${appName}</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static leaveRequestTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Leave Request Submitted</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Review Request</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Leave Request Submitted — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static leaveApprovedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Leave Request Approved ✅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Leave Request Approved — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static leaveRejectedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Leave Request Rejected ❌</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Leave Request Rejected — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static meetingInvitationTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Meeting Invitation 📅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Accept Invitation</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Meeting Invitation — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static meetingReminderTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Meeting Reminder ⏰</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Join Meeting</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Meeting Reminder — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static approvalRequiredTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Approval Required 📋</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Review & Approve</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Approval Required — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static approvalApprovedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Request Approved ✅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Request Approved — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static approvalRejectedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Request Rejected ❌</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Request Rejected — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static socialMediaPublishedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Social Media Post Published 📱</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Post</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Social Media Post Published — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static socialMediaFailedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Social Media Post Failed ⚠️</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Social Media Post Failed — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskAssignedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New Task Assigned 📝</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Task</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New Task Assigned — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskDueSoonTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Task Due Soon ⏰</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Task</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Task Due Soon — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskOverdueTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Task Overdue 🚨</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Task</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Task Overdue — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static welcomeTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Welcome to ${appName}! 🎉</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Get Started</a>
    `;
    return {
      subject: `Welcome to ${appName}!`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static passwordResetTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Password Reset Request 🔐</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Reset Password</a>
      <p style="font-size: 12px; color: #737373;">If you didn't request this, please ignore this email.</p>
    `;
    return {
      subject: `Password Reset — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static defaultTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>${context.title}</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      ${context.actionUrl ? `<a href="${context.actionUrl}" class="button">View Details</a>` : ''}
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `${context.title} — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static renderMetadata(context: EmailContext): string {
    if (!context.metadata || Object.keys(context.metadata).length === 0) {
      return '';
    }

    const metadataItems = Object.entries(context.metadata)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `
        <div class="metadata-item">
          <span class="metadata-label">${this.formatKey(key)}:</span> ${this.formatValue(value)}
        </div>
      `).join('');

    if (!metadataItems) return '';

    return `
      <div class="metadata">
        ${metadataItems}
      </div>
    `;
  }

  private static formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private static formatValue(value: unknown): string {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
