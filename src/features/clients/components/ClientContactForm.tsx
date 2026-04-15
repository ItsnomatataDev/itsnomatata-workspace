import { useState } from "react";

export interface ClientContactFormValues {
  fullName: string;
  email: string;
  phone: string;
  title: string;
  isPrimary: boolean;
  sendInvite: boolean;
}

export default function ClientContactForm({
  busy = false,
  onSubmit,
}: {
  busy?: boolean;
  onSubmit: (values: ClientContactFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ClientContactFormValues>({
    fullName: "",
    email: "",
    phone: "",
    title: "",
    isPrimary: false,
    sendInvite: false,
  });

  const handleChange = (
    key: keyof ClientContactFormValues,
    value: string | boolean,
  ) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.fullName.trim()) return;

    await onSubmit(values);

    setValues({
      fullName: "",
      email: "",
      phone: "",
      title: "",
      isPrimary: false,
      sendInvite: false,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm text-white/60">Full name</label>
        <input
          value={values.fullName}
          onChange={(e) => handleChange("fullName", e.target.value)}
          placeholder="Tariro Moyo"
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
            placeholder="contact@client.com"
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

      <div>
        <label className="mb-2 block text-sm text-white/60">Title</label>
        <input
          value={values.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Operations Manager"
          className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={values.isPrimary}
            onChange={(e) => handleChange("isPrimary", e.target.checked)}
          />
          Set as primary contact
        </label>

        <label className="flex items-center gap-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={values.sendInvite}
            onChange={(e) => handleChange("sendInvite", e.target.checked)}
          />
          Send automated invite email
        </label>
      </div>

      <button
        type="submit"
        disabled={busy || !values.fullName.trim()}
        className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Saving..." : "Add Contact"}
      </button>
    </form>
  );
}
