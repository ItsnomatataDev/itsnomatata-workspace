import { useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import WorkflowStatusCard from "../components/WorkflowStatusCard";
import SystemHealthCard from "../components/SystemHealthCard";
import ProjectActivityList from "../components/ProjectActivityList";
import ProjectMembersPanel from "../components/ProjectMembersPanel";

export default function ITProjectDetailsPage() {
  const auth = useAuth();
  const profile = auth?.profile;
  const { projectId } = useParams();

  const organizationId = profile?.organization_id;

  if (!organizationId || !projectId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        Missing project context.
      </div>
    );
  }

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
