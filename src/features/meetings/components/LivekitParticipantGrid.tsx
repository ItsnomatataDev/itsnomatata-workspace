import { useEffect, useMemo, useState } from "react";
import {
  Expand,
  Maximize2,
  Minimize2,
  MonitorUp,
  Pin,
  PinOff,
  VideoOff,
} from "lucide-react";
import { VideoTrack, useTracks } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Track } from "livekit-client";
import UserAvatar from "../../../components/common/UserAvatar";

type ViewMode = "auto" | "grid" | "focus";

function hasPublication(
  trackRef: TrackReferenceOrPlaceholder,
): trackRef is Extract<TrackReferenceOrPlaceholder, { publication: unknown }> {
  return "publication" in trackRef && !!trackRef.publication;
}

function isPlaceholderTrack(trackRef: TrackReferenceOrPlaceholder) {
  return !hasPublication(trackRef);
}

function getTrackKey(trackRef: TrackReferenceOrPlaceholder) {
  return `${trackRef.participant.identity}:${trackRef.source}`;
}

function getParticipantName(trackRef: TrackReferenceOrPlaceholder) {
  return (
    trackRef.participant.name || trackRef.participant.identity || "Participant"
  );
}

function getGridClass(count: number) {
  if (count <= 1) return "grid grid-cols-1 gap-4";
  if (count === 2) return "grid grid-cols-1 gap-4 lg:grid-cols-2";
  if (count <= 4) return "grid grid-cols-1 gap-4 md:grid-cols-2";
  if (count <= 6) return "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
  return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function TrackTile({
  trackRef,
  isFocused = false,
  isPinned = false,
  onFocus,
  onPin,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  isFocused?: boolean;
  isPinned?: boolean;
  onFocus?: () => void;
  onPin?: () => void;
}) {
  const participantName = getParticipantName(trackRef);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const isPlaceholder = isPlaceholderTrack(trackRef);
  const shouldMirror =
    trackRef.participant.isLocal && !isScreenShare && !isPlaceholder;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFocus?.();
        }
      }}
      className={[
        "group relative overflow-hidden rounded-3xl border bg-neutral-950 text-white shadow-2xl shadow-black/30 transition",
        isFocused ? "min-h-[62vh]" : "min-h-60",
        isPinned
          ? "border-orange-500/50 ring-2 ring-orange-500/20"
          : "border-white/10 hover:border-orange-500/30",
      ].join(" ")}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-linear-to-b from-black/85 to-transparent p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="max-w-55 truncate rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white">
            {participantName}
          </span>

          {trackRef.participant.isLocal ? (
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
              You
            </span>
          ) : null}

          {isScreenShare ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-300">
              <MonitorUp size={12} />
              Sharing
            </span>
          ) : null}
        </div>

        {onPin ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPin();
            }}
            className="rounded-full border border-white/10 bg-black/70 p-2 text-white/70 transition hover:border-orange-500/30 hover:text-orange-300"
            title={isPinned ? "Unpin" : "Pin"}
          >
            {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        ) : null}
      </div>

      <div className="flex h-full min-h-60 items-center justify-center bg-black">
        {!hasPublication(trackRef) ? (
          <div className="flex h-full min-h-60 w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.14),transparent_55%)]">
            <UserAvatar
              person={{ full_name: participantName }}
              size="xl"
              className="h-24 w-24 border-orange-500/20 bg-white/5 text-orange-400"
            />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-sm text-white/45">
              <VideoOff size={14} />
              Camera off
            </div>
          </div>
        ) : (
          <VideoTrack
            trackRef={trackRef}
            className={[
              "h-full w-full",
              isScreenShare ? "object-contain" : "object-cover",
              shouldMirror ? "-scale-x-100" : "",
            ].join(" ")}
          />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-linear-to-t from-black/90 to-transparent p-4">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={[
              "rounded-full px-2.5 py-1",
              trackRef.participant.isMicrophoneEnabled
                ? "bg-green-500/15 text-green-300"
                : "bg-red-500/15 text-red-300",
            ].join(" ")}
          >
            {trackRef.participant.isMicrophoneEnabled ? "Mic on" : "Muted"}
          </span>

          <span
            className={[
              "rounded-full px-2.5 py-1",
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
}

export default function LivekitParticipantGrid() {
  const [viewMode, setViewMode] = useState<ViewMode>("auto");
  const [pinnedTrackKey, setPinnedTrackKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const cameraTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const screenTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const cameraOnlyTracks = useMemo(() => {
    const seen = new Set<string>();

    return cameraTracks.filter((trackRef) => {
      const key = trackRef.participant.identity;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cameraTracks]);

  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...screenTracks, ...cameraOnlyTracks];

    return ordered.filter((trackRef) => {
      const key = getTrackKey(trackRef);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cameraOnlyTracks, screenTracks]);

  const activeScreenShare = screenTracks[0] ?? null;

  useEffect(() => {
    if (!activeScreenShare) return;

    if (!pinnedTrackKey && viewMode === "auto") {
      setPinnedTrackKey(getTrackKey(activeScreenShare));
    }
  }, [activeScreenShare, pinnedTrackKey, viewMode]);

  useEffect(() => {
    if (!pinnedTrackKey) return;

    const stillExists = allTracks.some(
      (trackRef) => getTrackKey(trackRef) === pinnedTrackKey,
    );

    if (!stillExists) {
      setPinnedTrackKey(null);
      setExpanded(false);
    }
  }, [allTracks, pinnedTrackKey]);

  const focusedTrack = useMemo(() => {
    if (pinnedTrackKey) {
      return (
        allTracks.find(
          (trackRef) => getTrackKey(trackRef) === pinnedTrackKey,
        ) ?? null
      );
    }

    if (viewMode === "auto" && activeScreenShare) return activeScreenShare;

    return null;
  }, [activeScreenShare, allTracks, pinnedTrackKey, viewMode]);

  const shouldUseFocusLayout =
    viewMode === "focus" || Boolean(activeScreenShare) || Boolean(focusedTrack);

  const filmstripTracks = useMemo(() => {
    if (!focusedTrack) return cameraOnlyTracks;

    const focusedKey = getTrackKey(focusedTrack);

    return allTracks.filter((trackRef) => getTrackKey(trackRef) !== focusedKey);
  }, [allTracks, cameraOnlyTracks, focusedTrack]);

  async function openFullscreen() {
    const element = document.getElementById("meeting-stage");
    if (!element || !document.fullscreenEnabled) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch (error) {
      console.error("FULLSCREEN ERROR:", error);
    }
  }

  if (allTracks.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-3xl border border-white/10 bg-neutral-950 text-sm text-white/35">
        Waiting for participants to join
      </div>
    );
  }

  if (shouldUseFocusLayout && focusedTrack) {
    const focusedName = getParticipantName(focusedTrack);
    const focusedIsScreenShare =
      focusedTrack.source === Track.Source.ScreenShare;

    return (
      <div
        id="meeting-stage"
        className={[
          "space-y-4",
          expanded
            ? "fixed inset-0 z-50 overflow-y-auto bg-black p-4"
            : "relative",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-neutral-950/95 p-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">
              {focusedIsScreenShare ? "Screen share focus" : "Pinned focus"}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">
              {focusedName}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPinnedTrackKey(null);
                setViewMode("grid");
                setExpanded(false);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-orange-500/30 hover:text-orange-300"
            >
              <PinOff size={14} />
              Grid
            </button>

            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-orange-500/30 hover:text-orange-300"
            >
              {expanded ? <Minimize2 size={14} /> : <Expand size={14} />}
              {expanded ? "Minimize" : "Expand"}
            </button>

            <button
              type="button"
              onClick={() => void openFullscreen()}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-orange-400"
            >
              <Maximize2 size={14} />
              Fullscreen
            </button>
          </div>
        </div>

        <TrackTile
          trackRef={focusedTrack}
          isFocused
          isPinned={Boolean(pinnedTrackKey)}
          onPin={() => {
            setPinnedTrackKey(null);
            setViewMode("grid");
            setExpanded(false);
          }}
        />

        {filmstripTracks.length > 0 ? (
          <div className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                Participants
              </p>
              <p className="text-xs text-white/30">
                {filmstripTracks.length} other
                {filmstripTracks.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {filmstripTracks.map((trackRef) => (
                <div
                  key={getTrackKey(trackRef)}
                  className="w-56 shrink-0 sm:w-64"
                >
                  <TrackTile
                    trackRef={trackRef}
                    onFocus={() => {
                      setPinnedTrackKey(getTrackKey(trackRef));
                      setViewMode("focus");
                    }}
                    onPin={() => {
                      setPinnedTrackKey(getTrackKey(trackRef));
                      setViewMode("focus");
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeScreenShare ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-orange-500/20 bg-orange-500/10 p-3">
          <div className="flex items-center gap-2 text-sm text-orange-200">
            <MonitorUp size={16} />
            Someone is sharing their screen
          </div>

          <button
            type="button"
            onClick={() => {
              setPinnedTrackKey(getTrackKey(activeScreenShare));
              setViewMode("focus");
            }}
            className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-orange-400"
          >
            Focus screen
          </button>
        </div>
      ) : null}

      <div className={getGridClass(allTracks.length || 1)}>
        {allTracks.map((trackRef) => {
          const key = getTrackKey(trackRef);

          return (
            <TrackTile
              key={key}
              trackRef={trackRef}
              isPinned={pinnedTrackKey === key}
              onFocus={() => {
                setPinnedTrackKey(key);
                setViewMode("focus");
              }}
              onPin={() => {
                setPinnedTrackKey(key);
                setViewMode("focus");
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
