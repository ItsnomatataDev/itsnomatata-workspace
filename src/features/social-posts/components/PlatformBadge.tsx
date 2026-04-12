import type { SocialPlatform } from "../../../lib/hooks/useSocialPosts";

const PLATFORM_STYLES: Record<SocialPlatform, string> = {
  LinkedIn: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  Instagram: "border-pink-400/30 bg-pink-400/10 text-pink-200",
  Facebook: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  X: "border-white/20 bg-white/10 text-white/80",
  TikTok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

export default function PlatformBadge({
  platform,
}: {
  platform: SocialPlatform;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase",
        PLATFORM_STYLES[platform],
      ].join(" ")}
    >
      {platform}
    </span>
  );
}
