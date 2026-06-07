import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import type { CompanyRole } from "../../types";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  roles: CompanyRole[];
  onSave: (role: Partial<CompanyRole> & { name: string }) => Promise<void>;
};

export default function ManageRolesModal({ open, onClose, roles, onSave }: Props) {
  const [editing, setEditing] = useState<Partial<CompanyRole> | null>(null);
  const [skillsText, setSkillsText] = useState("");

  useEffect(() => {
    if (!open) return;
    setSkillsText(editing?.required_skills?.join(", ") ?? "");
  }, [editing, open]);

  if (!open) return null;

  const form = editing ?? { name: "", category: "", description: "", required_skills: [], is_temporary: false, is_active: true };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Manage Roles</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="grid lg:grid-cols-2">
          <div className="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
            <button type="button" onClick={() => setEditing({ name: "", category: "", description: "", required_skills: [], is_temporary: false, is_active: true })} className="mb-3 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white">
              <Plus size={14} className="inline" /> Add role
            </button>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {roles.map((role) => (
                <li key={role.id}>
                  <button type="button" onClick={() => setEditing(role)} className="flex w-full justify-between rounded-xl border border-gray-200 px-3 py-2 text-left text-sm">
                    <span><span className="font-semibold">{role.name}</span><span className="block text-xs text-gray-500">{role.category}</span></span>
                    <Pencil size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <form
            className="space-y-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await onSave({
                ...form,
                name: String(form.name).trim(),
                required_skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
              });
              setEditing(null);
            }}
          >
            <input className={inputClass} placeholder="Role name" value={form.name ?? ""} onChange={(e) => setEditing({ ...form, name: e.target.value })} required />
            <input className={inputClass} placeholder="Category" value={form.category ?? ""} onChange={(e) => setEditing({ ...form, category: e.target.value })} />
            <textarea className={`${inputClass} min-h-[72px]`} placeholder="Description" value={form.description ?? ""} onChange={(e) => setEditing({ ...form, description: e.target.value })} />
            <input className={inputClass} placeholder="Required skills" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
            <button type="submit" className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white">Save role</button>
          </form>
        </div>
      </div>
    </div>
  );
}
