export type AIWorkspaceSummaryInput = {
  role: string;
  projectsCount: number;
  openIssues: number;
  pendingInvites: number;
  failedRuns24h: number;
  topFailingFlows: string[];
};

export async function generateITWorkspaceSummary(
  input: AIWorkspaceSummaryInput,
): Promise<string> {
  const {
    role,
    projectsCount,
    openIssues,
    pendingInvites,
    failedRuns24h,
    topFailingFlows,
  } = input;

  const flowText =
    topFailingFlows.length > 0
      ? topFailingFlows.join(", ")
      : "No failing workflows detected";

  return [
    `Role: ${role}`,
    `Projects: ${projectsCount}`,
    `Open issues: ${openIssues}`,
    `Pending invites: ${pendingInvites}`,
    `Failed automation runs in last 24 hours: ${failedRuns24h}`,
    `Top failing flows: ${flowText}`,
    "",
    "Suggested IT focus:",
    failedRuns24h > 0
      ? "- Review failed automation workflows first."
      : "- Automation health looks stable.",
    openIssues > 0
      ? "- Check open technical issues and prioritize critical ones."
      : "- No active issues need urgent review.",
    pendingInvites > 0
      ? "- Review pending collaboration invitations."
      : "- Collaboration queue is clear.",
  ].join("\n");
}
