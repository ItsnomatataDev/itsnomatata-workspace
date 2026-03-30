import { useAuth } from "../../../app/providers/AuthProvider";
import WorkflowStatusCard from "../components/WorkflowStatusCard";
import SystemHealthCard from "../components/SystemHealthCard";
import ProjectActivityList from "../components/ProjectActivityList";
import ProjectMembersPanel from "../components/ProjectMembersPanel";

export default function ITProjectDetailsPage() {
  const auth = useAuth();
  const profile = auth?.profile;

  const organizationId = profile?.organization_id;
  const projectId = "YOUR_ROUTE_PROJECT_ID";

  if (!organizationId || !projectId) return null;

  return (
    <div className="space-y-6">
      <WorkflowStatusCard
        organizationId={organizationId}
        projectId={projectId}
        workflowName="Social Reply Agent"
      />

      <SystemHealthCard organizationId={organizationId} />

      <ProjectMembersPanel projectId={projectId} canManage />

      <ProjectActivityList projectId={projectId} limit={12} />
    </div>
  );
}
