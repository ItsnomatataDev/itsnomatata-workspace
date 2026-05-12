import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getProjects,
  type ProjectRow,
} from "../supabase/queries/projects";
import {
  createProject as createProjectMutation,
  updateProject as updateProjectMutation,
  deleteProject as deleteProjectMutation,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "../supabase/mutations/projects";

export const useProjects = ({
  organizationId,
  clientId,
  campaignId,
  isActive = true,
}: {
  organizationId?: string | null;
  clientId?: string;
  campaignId?: string;
  isActive?: boolean;
}) => {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const fetchProjects = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setError("Missing organization id.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const projectsData = await getProjects({
        organizationId,
        clientId,
        campaignId,
        isActive,
      });
      
      setProjects(projectsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, [organizationId, clientId, campaignId, isActive]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (input: CreateProjectInput) => {
    try {
      await createProjectMutation(input);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      throw err;
    }
  }, [fetchProjects]);

  const updateProject = useCallback(async (id: string, input: UpdateProjectInput) => {
    try {
      await updateProjectMutation(id, input);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
      throw err;
    }
  }, [fetchProjects]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      if (!organizationId) throw new Error("Organization ID is required");
      await deleteProjectMutation({
        organizationId,
        projectId: id,
      });
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      throw err;
    }
  }, [fetchProjects, organizationId]);

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      value: project.id,
      label: project.name,
      project,
    }));
  }, [projects]);

  return {
    projects,
    projectOptions,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
  };
};
