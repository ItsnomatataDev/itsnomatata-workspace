export default function AnnouncementsCard({
  announcements,
}: {
  announcements: {
    id: string;
    title: string;
    content: string;
    created_at: string;
  }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">Role News & Updates</h2>

      <div className="mt-4 space-y-3">
        {announcements.length === 0 ? (
          <p className="text-sm text-white/50">No announcements available.</p>
        ) : (
          announcements.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
            >
              <p className="font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm text-white/65">{item.content}</p>
              <p className="mt-2 text-xs text-orange-400">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
