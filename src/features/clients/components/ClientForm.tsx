import { useState } from "react";

export interface ClientFormValues {
  name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  notes: string;
}

export default function ClientForm({
  busy = false,
  onSubmit,
}: {
  busy?: boolean;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ClientFormValues>({
    name: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    notes: "",
  });

  const handleChange = (key: keyof ClientFormValues, value: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;

    await onSubmit(values);

    setValues({
      name: "",
      email: "",
      phone: "",
      website: "",
      industry: "",
      notes: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm text-white/60">Client name</label>
        <input
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="BluePeak Logistics"
          className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-white/60">Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="hello@client.com"
            className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/60">Phone</label>
          <input
            value={values.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="+263..."
            className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-white/60">Website</label>
          <input
            value={values.website}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="https://client.com"
            className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/60">Industry</label>
          <input
            value={values.industry}
            onChange={(e) => handleChange("industry", e.target.value)}
            placeholder="Logistics"
            className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/60">Notes</label>
        <textarea
          rows={4}
          value={values.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Internal notes about this client..."
          className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      <button
        type="submit"
        disabled={busy || !values.name.trim()}
        className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Creating..." : "Create Client"}
      </button>
    </form>
  );
}
