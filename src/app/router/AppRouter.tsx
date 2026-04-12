import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../../features/auth/pages/LoginPage";
import SignupPage from "../../features/auth/pages/SignupPage";
import DashboardPage from "../../pages/DashboardPage";
import ClientsPage from "../../features/clients/pages/ClientsPage";
import ClientDetailsPage from "../../features/clients/pages/ClientDetailsPage";
import ClientWorkspacePage from "../../features/clients/pages/ClientWorkspacePage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
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
import AutomationFlowsPage from "../../features/automation-flows/pages/AutomationFlowsPage";
import AutomationRunsPage from "../../features/automation-flows/pages/AutomationRunsPage";
import AdminDashboardPage from "../../features/admin/pages/AdminDashboardPage";
import LeavePage from "../../features/leave/pages/LeavePage";
import AdminLeavePage from "../../features/admin/pages/AdminLeavePage";
import AdminRosterPage from "../../features/admin/pages/AdminRosterPage";
import AdminEmployeesPage from "../../features/admin/pages/AdminEmployeesPage";
import AdminEmployeeDetailsPage from "../../features/admin/pages/AdminEmployeeDetailsPage";
import NotificationsPage from "../../features/notifications/pages/NotificationsPage";
import ChatPage from "../../features/chat/pages/ChatPage";
import MeetingsPage from "../../features/meetings/pages/MeetingsPage";
import MeetingRoomPage from "../../features/meetings/pages/MeetingRoomPage";
import SocialPostsPage from "../../features/social-posts/pages/SocialPostsPage";
import TimeApprovalPage from "../../features/timesheets/pages/TimeApprovalPage";
import AssetsPage from "../../features/stock/pages/AssetsPage";
import AssetDetailsPage from "../../features/stock/pages/AssetDetailsPage";
import ScanAssetPage from "../../features/stock/pages/ScanAssetPage";
import AIWorkspacePage from "../../features/ai-workspace/pages/AIWorkspacePage";
const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              {" "}
              <DashboardPage />{" "}
            </ProtectedRoute>
          }
        />

        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/meetings/:meetingId" element={<MeetingRoomPage />} />

        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients/:clientId"
          element={
            <ProtectedRoute>
              <ClientDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients/:clientId/workspace"
          element={
            <ProtectedRoute>
              <ClientWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees/:userId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]}>
                <AdminEmployeeDetailsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/time-approval"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin", "manager"]}>
                <TimeApprovalPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <AssetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/time"
          element={
            <ProtectedRoute>
              <TimePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <LeavePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leave"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]}>
                <AdminLeavePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/chat" element={<ChatPage />} />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsPage />
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
                <SocialPostsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <AutomationFlowsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets/:assetId"
          element={
            <ProtectedRoute>
              <AssetDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <ScanAssetPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/automation-runs"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <AutomationRunsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]}>
                <AdminDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/content-library"
          element={
            <ProtectedRoute>
              <ContentLibraryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/projects"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITProjectsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]}>
                <AdminEmployeesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/projects/:projectId"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITProjectDetailsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/collaboration"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITCollaborationPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/issues"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITIssuesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it/system-monitor"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["it"]}>
                <ITSystemMonitorPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roster"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["admin"]}>
                <AdminRosterPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/ai-workspace" element={<AIWorkspacePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
