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
      case "leave_reminder":
        return this.leaveReminderTemplate(context, appName, appUrl);
      case "meeting_invitation":
        return this.meetingInvitationTemplate(context, appName, appUrl);
      case "meeting_reminder":
        return this.meetingReminderTemplate(context, appName, appUrl);
      case "meeting":
        return this.meetingTemplate(context, appName, appUrl);
      case "approval_required":
        return this.approvalRequiredTemplate(context, appName, appUrl);
      case "approval_approved":
        return this.approvalApprovedTemplate(context, appName, appUrl);
      case "approval_rejected":
        return this.approvalRejectedTemplate(context, appName, appUrl);
      case "approval_decision":
        return this.approvalDecisionTemplate(context, appName, appUrl);
      case "social_media_post_published":
        return this.socialMediaPublishedTemplate(context, appName, appUrl);
      case "social_media_post_failed":
        return this.socialMediaFailedTemplate(context, appName, appUrl);
      case "task_assigned":
        return this.taskAssignedTemplate(context, appName, appUrl);
      case "task_updated":
        return this.taskUpdatedTemplate(context, appName, appUrl);
      case "task_completed":
        return this.taskCompletedTemplate(context, appName, appUrl);
      case "task_due_soon":
        return this.taskDueSoonTemplate(context, appName, appUrl);
      case "task_overdue":
        return this.taskOverdueTemplate(context, appName, appUrl);
      case "task_comment":
        return this.taskCommentTemplate(context, appName, appUrl);
      case "task_collaboration_invite":
        return this.taskCollaborationInviteTemplate(context, appName, appUrl);
      case "chat_message":
        return this.chatMessageTemplate(context, appName, appUrl);
      case "announcement":
        return this.announcementTemplate(context, appName, appUrl);
      case "system_alert":
        return this.systemAlertTemplate(context, appName, appUrl);
      case "automation":
        return this.automationTemplate(context, appName, appUrl);
      case "welcome":
        return this.welcomeTemplate(context, appName, appUrl);
      case "password_reset":
        return this.passwordResetTemplate(context, appName, appUrl);
      case "user_signup":
        return this.userSignupTemplate(context, appName, appUrl);
      case "user_invite":
        return this.userInviteTemplate(context, appName, appUrl);
      case "duty_roster_assigned":
        return this.dutyRosterAssignedTemplate(context, appName, appUrl);
      case "duty_roster_updated":
        return this.dutyRosterUpdatedTemplate(context, appName, appUrl);
      case "shift_reminder":
        return this.shiftReminderTemplate(context, appName, appUrl);
      case "campaign_update":
        return this.campaignUpdateTemplate(context, appName, appUrl);
      case "campaign_assigned":
        return this.campaignAssignedTemplate(context, appName, appUrl);
      case "timesheet_reminder":
        return this.timesheetReminderTemplate(context, appName, appUrl);
      case "invoice_update":
        return this.invoiceUpdateTemplate(context, appName, appUrl);
      case "budget_alert":
        return this.budgetAlertTemplate(context, appName, appUrl);
      case "expense_submitted":
        return this.expenseSubmittedTemplate(context, appName, appUrl);
      case "expense_approved":
        return this.expenseApprovedTemplate(context, appName, appUrl);
      case "expense_rejected":
        return this.expenseRejectedTemplate(context, appName, appUrl);
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

  private static chatMessageTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New Message 💬</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Reply to Message</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New Message — ${appName}`,
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

  private static leaveReminderTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Leave Reminder 📅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Leave Request</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Leave Reminder — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static meetingTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New Meeting 📅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Meeting</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New Meeting — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static approvalDecisionTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Approval Decision</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Approval Decision — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskUpdatedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Task Updated 📝</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Task</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Task Updated — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskCompletedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Task Completed ✅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Task</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Task Completed — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskCommentTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New Task Comment 💬</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Comment</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New Task Comment — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static taskCollaborationInviteTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Task Collaboration Invite 🤝</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Accept Invite</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Task Collaboration Invite — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static announcementTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New Announcement 📢</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Announcement</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New Announcement — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static systemAlertTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>System Alert 🚨</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `System Alert — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static automationTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Automation Alert ⚙️</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Details</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Automation Alert — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static userSignupTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>New User Signup 🎉</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Profile</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `New User Signup — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static userInviteTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>You're Invited! 📨</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Accept Invitation</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `You're Invited to ${appName}!`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static dutyRosterAssignedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Duty Roster Assigned 📋</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Roster</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Duty Roster Assigned — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static dutyRosterUpdatedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Duty Roster Updated 📋</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Roster</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Duty Roster Updated — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static shiftReminderTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Shift Reminder ⏰</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Schedule</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Shift Reminder — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static campaignUpdateTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Campaign Update 📢</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Campaign</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Campaign Update — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static campaignAssignedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Campaign Assigned 🎯</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Campaign</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Campaign Assigned — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static timesheetReminderTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Timesheet Reminder ⏰</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">Submit Timesheet</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Timesheet Reminder — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static invoiceUpdateTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Invoice Update 💰</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Invoice</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Invoice Update — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static budgetAlertTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Budget Alert 💸</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Budget</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Budget Alert — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static expenseSubmittedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Expense Submitted 💳</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Expense</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Expense Submitted — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static expenseApprovedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Expense Approved ✅</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Expense</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Expense Approved — ${appName}`,
      html: this.baseTemplate(content, appName, appUrl),
    };
  }

  private static expenseRejectedTemplate(context: EmailContext, appName: string, appUrl: string): EmailTemplate {
    const content = `
      <h2>Expense Rejected ❌</h2>
      <p>Hi ${context.firstName},</p>
      <p>${context.message}</p>
      <a href="${context.actionUrl}" class="button">View Expense</a>
      ${this.renderMetadata(context)}
    `;
    return {
      subject: `Expense Rejected — ${appName}`,
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
