import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../../features/auth/pages/LoginPage";
import SignupPage from "../../features/auth/pages/SignupPage";
import ForgotPasswordPage from "../../features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "../../features/auth/pages/ResetPasswordPage";
import DashboardPage from "../../pages/DashboardPage";
import SettingsPage from "../../pages/SettingsPage";
import ClientsPage from "../../features/clients/pages/ClientsPage";
import ClientDetailsPage from "../../features/clients/pages/ClientDetailsPage";
import ClientWorkspacePage from "../../features/clients/pages/ClientWorkspacePage";
import BoardsGridPage from "../../features/boards/pages/BoardsGridPage";
import BoardViewPage from "../../features/boards/pages/BoardViewPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import FeatureRoute from "./FeatureRoute";
import SystemOwnerAdminRoute from "./SystemOwnerAdminRoute";
import TasksPage from "../../features/tasks/pages/TasksPage";
import TimePage from "../../features/time/pages/TimePage";
import CampaignsPage from "../../features/campaigns/pages/CampaignsPage";
import ReportsPage from "../../features/reports/pages/ReportsPage";
import ContentLibraryPage from "../../features/content-assets/pages/ContentLibraryPage";
import ITDashboardPage from "../../features/it-workspace/pages/ITDashboardPage";
import ITProjectsPage from "../../features/it-workspace/pages/ITProjectsPage";
import ITProjectDetailsPage from "../../features/it-workspace/pages/ITProjectDetailsPage";
import ITCollaborationPage from "../../features/it-workspace/pages/ITCollaborationPage";
import ITIssuesPage from "../../features/it-workspace/pages/ITIssuesPage";
import ITSystemMonitorPage from "../../features/it-workspace/pages/ITSystemMonitorPage";
import ITSupportPage from "../../features/it-workspace/pages/ITSupportPage";
import AutomationFlowsPage from "../../features/automation-flows/pages/AutomationFlowsPage";
import AutomationRunsPage from "../../features/automation-flows/pages/AutomationRunsPage";
import AdminDashboardPage from "../../features/admin/pages/AdminDashboardPage";
import LeavePage from "../../features/leave/pages/LeavePage";
import AdminLeavePage from "../../features/admin/pages/AdminLeavePage";
import AdminRosterPage from "../../features/admin/pages/AdminRosterPage";
import DutyRosterViewPage from "../../features/admin/pages/DutyRosterViewPage";
import AdminEmployeesPage from "../../features/admin/pages/AdminEmployeesPage";
import AdminEmployeeDetailsPage from "../../features/admin/pages/AdminEmployeeDetailsPage";
import AdminNotificationsPage from "../../features/admin/pages/AdminNotificationsPage";
import NotificationsPage from "../../features/notifications/pages/NotificationsPage";
import ChatPage from "../../features/chat/pages/ChatPage";
import MeetingsPage from "../../features/meetings/pages/MeetingsPage";
import MeetingRoomPage from "../../features/meetings/pages/MeetingRoomPage";
import GuestMeetingJoinPage from "../../features/meetings/pages/GuestMeetingJoinPage";
import SocialPostsPage from "../../features/social-posts/pages/SocialPostsPage";
import SocialMediaDashboardPage from "../../features/social-media/pages/SocialMediaDashboardPage";
import MediaDashboardPage from "../../features/media-dashboard/pages/MediaDashboardPage";
import CreativeRequestsPage from "../../features/media-dashboard/pages/CreativeRequestsPage";
import DeliveryTrackerPage from "../../features/media-dashboard/pages/DeliveryTrackerPage";
import AssetsPage from "../../features/stock/pages/AssetsPage";
import AssetDetailsPage from "../../features/stock/pages/AssetDetailsPage";
import ScanAssetPage from "../../features/stock/pages/ScanAssetPage";
import FleetDashboardPage from "../../features/fleet/pages/FleetDashboardPage";
import AIWorkspacePage from "../../features/ai-workspace/pages/AIWorkspacePage";
import AiAssistantPage from "../../features/ai-assistant/pages/AiAssistantPage";
import AIAutomationReviewPage from "../../features/ai-automation-review/pages/AIAutomationReviewPage";
import WorkIntelligenceBoardPage from "../../features/timesheets/pages/WorkIntelligenceBoardPage";
import TeamTimesheetsPage from "../../features/timesheets/pages/TeamTimesheetsPage";
import EverhourAdminPage from "../../features/timesheets/pages/EverhourAdminPage";
import BoardTimeManagementPage from "../../features/boards/pages/BoardTimeManagementPage";
import TimeTrackingPage from "../../features/time-tracking/pages/TimeTrackingPage";
import BoardDetailView from "../../features/boards/pages/BoardDetailView";
import AttendancePage from "../../features/attendance/pages/AttendancePage";
import AdminAttendancePage from "../../features/attendance/pages/AdminAttendancePage";
import UserTimesheetPage from "../../features/timesheets/pages/UserTimesheetPage";
import EmployeeInboxPage from "../../features/employee-inbox/pages/EmployeeInboxPage";
import AdminDocumentCenterPage from "../../features/employee-inbox/pages/AdminDocumentCenterPage";
import PayslipDeliveryPage from "../../features/employee-inbox/pages/PayslipDeliveryPage";
import PlatformAdminPage from "../../features/platform-admin/pages/PlatformAdminPage";
import OperationsCenterPage from "../../features/platform-admin/pages/OperationsCenterPage";
import OrganizationSettingsPage from "../../features/organization/pages/OrganizationSettingsPage";
import AcceptOrganizationInvitePage from "../../features/organization/pages/AcceptOrganizationInvitePage";
import TeamPage from "../../features/organization-members/pages/TeamPage";
import ContentStudioPage from "../../features/content-review/pages/ContentStudioPage";
import ContentStudioEditorPage from "../../features/content-review/pages/ContentStudioEditorPage";
import ContentStudioClientsPage from "../../features/content-review/pages/ContentStudioClientsPage";
import PublicClientReviewPage from "../../features/content-review/pages/PublicClientReviewPage";
import ClientPortalLoginPage from "../../features/content-review/pages/ClientPortalLoginPage";
import ClientPortalPage from "../../features/content-review/pages/ClientPortalPage";
import ClientPortalReviewPage from "../../features/content-review/pages/ClientPortalReviewPage";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/resetpassword" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptOrganizationInvitePage />} />
        <Route path="/client-review/:token" element={<PublicClientReviewPage />} />
        <Route path="/client-portal" element={<ClientPortalLoginPage />} />
        <Route path="/client-portal/login" element={<ClientPortalLoginPage />} />
        <Route path="/client-portal/:clientToken/login" element={<ClientPortalLoginPage />} />
        <Route path="/client-portal/:clientToken" element={<ClientPortalPage />} />
        <Route path="/client-portal/:clientToken/reviews/:draftId" element={<ClientPortalReviewPage />} />
     
        {/* Public guest meeting routes */}
        <Route path="/join/:meetingCode" element={<GuestMeetingJoinPage />} />
        <Route
          path="/guest/meetings/:meetingId"
          element={<GuestMeetingJoinPage />}
        />

        {/* Protected app routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/meetings"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="meetings"><MeetingsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/meetings/:meetingId"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="meetings"><MeetingRoomPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/boards"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="boards"><BoardsGridPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/boards/:boardId"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="boards"><BoardViewPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="clients"><ClientsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients/:clientId"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="clients"><ClientDetailsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients/:clientId/workspace"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="clients"><ClientWorkspacePage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="tasks"><TasksPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="stock"><AssetsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/assets/:assetId"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="stock"><AssetDetailsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="stock"><ScanAssetPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/fleet"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="fleet">
                  <FleetDashboardPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/fleet/imports"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="fleet">
                  <FleetDashboardPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/fleet/fuel-purchases"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="fleet">
                  <FleetDashboardPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/fleet/service"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="fleet">
                  <FleetDashboardPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/time"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="timesheets"><TimePage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/time-tracking"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="timesheets"><TimeTrackingPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="leave_requests"><LeavePage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="chat"><ChatPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />
<Route 
          path="/platform-admin"
          element={
            <ProtectedRoute>
              <SystemOwnerAdminRoute>
                <PlatformAdminPage />
              </SystemOwnerAdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/platform-admin"
          element={
            <ProtectedRoute>
              <SystemOwnerAdminRoute>
                <PlatformAdminPage />
              </SystemOwnerAdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations-center"
          element={
            <ProtectedRoute>
              <SystemOwnerAdminRoute>
                <OperationsCenterPage />
              </SystemOwnerAdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operations-center"
          element={
            <ProtectedRoute>
              <SystemOwnerAdminRoute>
                <OperationsCenterPage />
              </SystemOwnerAdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="social_media"><CampaignsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/media-dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "seo_specialist",
                  "social_media",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><MediaDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {[
          "/admin/content-studio",
          "/admin/content-studio/drafts",
          "/admin/content-studio/uploads",
          "/admin/content-studio/reviews",
          "/admin/content-studio/calendar",
        ].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <RoleRoute roles={["admin", "social_media", "media_team"]}>
                  <FeatureRoute feature="content_review">
                    <ContentStudioPage />
                  </FeatureRoute>
                </RoleRoute>
              </ProtectedRoute>
            }
          />
        ))}

        {[
          "/admin/content-studio/clients",
          "/admin/content-studio/clients/:clientId",
        ].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <RoleRoute roles={["admin", "social_media", "media_team"]}>
                  <FeatureRoute feature="content_review">
                    <ContentStudioClientsPage />
                  </FeatureRoute>
                </RoleRoute>
              </ProtectedRoute>
            }
          />
        ))}

        <Route
          path="/admin/content-studio/editor/:draftId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "social_media", "media_team"]}>
                <FeatureRoute feature="content_review">
                  <ContentStudioEditorPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/creative-requests"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><CreativeRequestsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/production-pipeline"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><MediaDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/content-assets"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "seo_specialist",
                  "social_media",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><ContentLibraryPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/campaign-visuals"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><MediaDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/editing-queue"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><MediaDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/delivery-tracker"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="media_dashboard"><DeliveryTrackerPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/social-posts"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={[
                  "admin",
                  "manager",
                  "seo_specialist",
                  "social_media",
                  "media_team",
                ]}
              >
                <FeatureRoute feature="social_media"><SocialPostsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/social-media"
          element={
            <ProtectedRoute>
              <RoleRoute
                roles={["social_media", "media_team", "admin", "manager"]}
              >
                <FeatureRoute feature="social_media"><SocialMediaDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="reports"><ReportsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/content-library"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="media_dashboard"><ContentLibraryPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="notifications"><NotificationsPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inbox"
          element={
            <ProtectedRoute>
              <EmployeeInboxPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organization/settings"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin", "superadmin", "it-superadmin"]}>
                <OrganizationSettingsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-workspace"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="ai_workspace"><AIWorkspacePage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="ai_workspace"><AiAssistantPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-automation-review"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "manager", "it", "superadmin", "it-superadmin"]}>
                <FeatureRoute feature="automation"><AIAutomationReviewPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="attendance"><AttendancePage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/timesheet"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="timesheets"><UserTimesheetPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin"]}>
                <FeatureRoute feature="admin_dashboard"><AdminDashboardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin"]}>
                <FeatureRoute feature="admin_users"><AdminEmployeesPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees/:userId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin"]}>
                <FeatureRoute feature="admin_users"><AdminEmployeeDetailsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/leave"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="admin_leave">
                  <AdminLeavePage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/roster"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="admin_roster">
                  <AdminRosterPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "hr"]}>
                <FeatureRoute feature="attendance"><AdminAttendancePage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/documents"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "hr"]}>
                <FeatureRoute feature="knowledge_base"><AdminDocumentCenterPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/payslips"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "hr"]}>
                <FeatureRoute feature="finance"><PayslipDeliveryPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/everhouradmin"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin"]}>
                <FeatureRoute feature="timesheets"><EverhourAdminPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/notification-deliveries"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="notifications"><AdminNotificationsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/work-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="timesheets"><WorkIntelligenceBoardPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* IT routes */}
        <Route
          path="/it/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/war-room"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/projects"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITProjectsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/projects/:projectId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITProjectDetailsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/collaboration"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITCollaborationPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/issues"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITIssuesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/system-monitor"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITSystemMonitorPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/support"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITSupportPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/support/:ticketId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <ITSupportPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/attendance"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <FeatureRoute feature="attendance"><AttendancePage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <FeatureRoute feature="automation">
                  <AutomationFlowsPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/automation-runs"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "it", "superadmin", "it-superadmin"]}>
                <FeatureRoute feature="automation">
                  <AutomationRunsPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Roster */}
        <Route
          path="/roster"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="duty_roster"><DutyRosterViewPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />

        {/* Timesheets */}
        <Route
          path="/timesheets/team"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager", "it"]}>
                <FeatureRoute feature="timesheets"><TeamTimesheetsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/timesheets/reports"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="reports"><ReportsPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/timesheets/everhouradmin"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "super_admin"]}>
                <FeatureRoute feature="timesheets"><EverhourAdminPage /></FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Board management / admin board detail */}
        <Route
          path="/board-management"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="boards">
                  <BoardTimeManagementPage />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/board-details/:boardId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "org_admin", "manager"]}>
                <FeatureRoute feature="boards">
                  <BoardDetailView />
                </FeatureRoute>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
        <Route
          path="/organization/team"
          element={
            <ProtectedRoute>
              <FeatureRoute feature="admin_users"><TeamPage /></FeatureRoute>
            </ProtectedRoute>
          }
        />
