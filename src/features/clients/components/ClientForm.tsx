import { useEffect, useState } from "react";
import { Building2, Globe, PenSquare, Tag, Type } from "lucide-react";
import type { ClientStatus } from "../../../lib/supabase/queries/clients";
import { slugifyClientName } from "../services/clientService";

export interface ClientFormValues {
  name: string;
  slug: string;
  industry: string;
  description: string;
  website_url: string;
  brand_voice: string;
  status: ClientStatus;
}

interface ClientFormProps {
  initialValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  submitLabel?: string;
  busy?: boolean;
}

const defaultValues: ClientFormValues = {
  name: "",
  slug: "",
  industry: "",
  description: "",
  website_url: "",
  brand_voice: "",
  status: "active",
};

function InputWrap({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
        <span className="text-orange-500">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ClientForm({
  initialValues,
  onSubmit,
  submitLabel = "Save Client",
  busy = false,
}: ClientFormProps) {
  const [values, setValues] = useState<ClientFormValues>({
    ...defaultValues,
    ...initialValues,
  });

  useEffect(() => {
    setValues({
      ...defaultValues,
      ...initialValues,
    });
  }, [initialValues]);

  const handleChange = (field: keyof ClientFormValues, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };

      if (
        field === "name" &&
        (!prev.slug || prev.slug === slugifyClientName(prev.name))
      ) {
        next.slug = slugifyClientName(value);
      }

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <InputWrap label="Client Name" icon={<Type size={16} />}>
        <input
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Shearwater Adventures"
          required
        />
      </InputWrap>

      <div className="grid gap-4 md:grid-cols-2">
        <InputWrap label="Slug" icon={<Tag size={16} />}>
          <input
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
            value={values.slug}
            onChange={(e) => handleChange("slug", e.target.value)}
            placeholder="shearwater-adventures"
            required
          />
        </InputWrap>

        <InputWrap label="Industry" icon={<Building2 size={16} />}>
          <input
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
            value={values.industry}
            onChange={(e) => handleChange("industry", e.target.value)}
            placeholder="Tourism"
          />
        </InputWrap>
      </div>

      <InputWrap label="Website" icon={<Globe size={16} />}>
        <input
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
          value={values.website_url}
          onChange={(e) => handleChange("website_url", e.target.value)}
          placeholder="https://example.com"
        />
      </InputWrap>

      <InputWrap label="Brand Voice" icon={<PenSquare size={16} />}>
        <input
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
          value={values.brand_voice}
          onChange={(e) => handleChange("brand_voice", e.target.value)}
          placeholder="Professional, warm, premium"
        />
      </InputWrap>

      <InputWrap label="Status" icon={<Tag size={16} />}>
        <select
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
          value={values.status}
          onChange={(e) =>
            handleChange("status", e.target.value as ClientStatus)
          }
        >
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
      </InputWrap>

      <InputWrap label="Description" icon={<PenSquare size={16} />}>
        <textarea
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
          rows={5}
          value={values.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Add a strong internal description of this client..."
        />
      </InputWrap>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
      >
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
