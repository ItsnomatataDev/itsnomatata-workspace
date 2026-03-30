import type { AutomationRunRow } from "../services/automationRunService";

type AutomationRunTableProps = {
  runs: AutomationRunRow[];
};

function statusClasses(status: string) {
  if (status === "success") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "failed") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border border-white/10 bg-white/5 text-white/70";
}

export default function AutomationRunTable({ runs }: AutomationRunTableProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No automation runs found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Triggered At</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-white/10">
                <td className="px-4 py-3">{run.workflow_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                      run.status,
                    )}`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/65">
                  {run.message || "No message"}
                </td>
                <td className="px-4 py-3 text-white/65">
                  {run.project_id || "No project"}
                </td>
                <td className="px-4 py-3 text-white/65">
                  {new Date(run.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
