import { X } from "lucide-react";
import ContentClientMediaLibrary from "./ContentClientMediaLibrary";
import type { ContentClient, ContentClientMedia } from "../services/contentReviewService";

export default function EditorLibraryDrawer({
  open,
  client,
  organizationId,
  officeId,
  userId,
  onClose,
  onSelect,
}: {
  open: boolean;
  client: ContentClient;
  organizationId: string;
  officeId: string;
  userId: string | null;
  onClose: () => void;
  onSelect: (media: ContentClientMedia) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-400">Client library</p>
            <h2 className="text-sm font-semibold">{client.company_name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-white/70 hover:bg-white/5"
            aria-label="Close library"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <p className="mb-3 text-[11px] text-white/45">
            Click Add to post, or drag an item onto a post frame media area.
          </p>
          <ContentClientMediaLibrary
            client={client}
            organizationId={organizationId}
            officeId={officeId}
            userId={userId}
            selectable
            draggableToPosts
            onSelect={(media) => {
              onSelect(media);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
