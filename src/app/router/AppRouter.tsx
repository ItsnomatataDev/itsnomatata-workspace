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
              <DashboardPage />
            </ProtectedRoute>
          }
        />

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
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
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
          path="/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsPage />
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
