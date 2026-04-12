import { useMemo } from "react";
import { VideoTrack, useTracks } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Track } from "livekit-client";

function getInitials(label: string) {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getGridClass(count: number) {
  if (count <= 1) return "grid gap-4 grid-cols-1";
  if (count === 2) return "grid gap-4 md:grid-cols-2";
  if (count <= 4) return "grid gap-4 md:grid-cols-2";
  if (count <= 6) return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
  if (count <= 9) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return "grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

function isPlaceholderTrack(
  trackRef: TrackReferenceOrPlaceholder,
): trackRef is Extract<
  TrackReferenceOrPlaceholder,
  { participant: unknown }
> & {
  publication?: undefined;
} {
  return !("publication" in trackRef) || !trackRef.publication;
}

export default function LivekitParticipantGrid() {
  const cameraTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const screenTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...screenTracks, ...cameraTracks];

    return ordered.filter((trackRef) => {
      const key = `${trackRef.participant.identity}:${trackRef.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cameraTracks, screenTracks]);

  return (
    <div className={getGridClass(allTracks.length || 1)}>
      {allTracks.length === 0 ? (
        <div className="flex min-h-55 items-center justify-center border border-white/10 bg-neutral-950 text-sm text-white/35">
          Waiting for participants to join
        </div>
      ) : (
        allTracks.map((trackRef) => {
          const participantName =
            trackRef.participant.name ||
            trackRef.participant.identity ||
            "Participant";

          const isScreenShare = trackRef.source === Track.Source.ScreenShare;
          const placeholder = isPlaceholderTrack(trackRef);

          return (
            <div
              key={`${trackRef.participant.identity}:${trackRef.source}`}
              className="group relative overflow-hidden border border-white/10 bg-neutral-950 text-white min-h-55"
            >
              <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                    {participantName}
                  </span>

                  {isScreenShare ? (
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-300">
                      Sharing
                    </span>
                  ) : null}

                  {trackRef.participant.isLocal ? (
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                      You
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex h-full min-h-55 items-center justify-center bg-black">
                {placeholder ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-black">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-semibold text-orange-400">
                      {getInitials(participantName)}
                    </div>
                    <p className="mt-4 text-sm text-white/45">Camera off</p>
                  </div>
                ) : (
                  <VideoTrack
                    trackRef={trackRef}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-linear-to-t from-black/90 to-transparent p-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={[
                      "rounded-full px-2 py-1",
                      trackRef.participant.isMicrophoneEnabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-red-500/15 text-red-300",
                    ].join(" ")}
                  >
                    {trackRef.participant.isMicrophoneEnabled
                      ? "Mic on"
                      : "Muted"}
                  </span>

                  <span
                    className={[
                      "rounded-full px-2 py-1",
                      isScreenShare || trackRef.participant.isCameraEnabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-white/10 text-white/60",
                    ].join(" ")}
                  >
                    {isScreenShare
                      ? "Screen share"
                      : trackRef.participant.isCameraEnabled
                        ? "Camera on"
                        : "Camera off"}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
