import { Mail, Phone, User2 } from "lucide-react";
import type { ClientContactItem } from "../services/clientContactService";

export default function ClientContactsList({
  contacts,
}: {
  contacts: ClientContactItem[];
}) {
  if (contacts.length === 0) {
    return (
      <div className="border border-white/10 bg-[#050505] p-5 text-white/50">
        No client contacts found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="border border-white/10 bg-[#050505] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <User2 size={15} className="text-orange-400" />
                <p className="font-semibold text-white">{contact.full_name}</p>
              </div>
              {contact.title ? (
                <p className="mt-1 text-sm text-white/50">{contact.title}</p>
              ) : null}
            </div>

            {contact.is_primary ? (
              <span className="rounded-xl bg-orange-500 px-3 py-1 text-xs font-semibold text-black">
                Primary
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-2 text-sm text-white/65">
            {contact.email ? (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-orange-400" />
                <span>{contact.email}</span>
              </div>
            ) : null}
            {contact.phone ? (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-orange-400" />
                <span>{contact.phone}</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
