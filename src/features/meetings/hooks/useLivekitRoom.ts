import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  VideoPresets,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RoomOptions,
} from "livekit-client";

export type LivekitRoomStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export function useLivekitRoom(params: {
  roomName?: string | null;
  options?: RoomOptions;
  onError?: (error: Error) => void;
}) {
  const { roomName, options, onError } = params;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [lastDisconnectReason, setLastDisconnectReason] =
    useState<DisconnectReason | null>(null);

  const room = useMemo(() => new Room(options), [options]);

  const syncParticipants = useCallback(() => {
    setParticipants([
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ]);
  }, [room]);

  useEffect(() => {
    setConnectionError("");
    setLastDisconnectReason(null);
  }, [roomName]);

  useEffect(() => {
    const handleConnected = () => {
      setConnectionState(ConnectionState.Connected);
      setConnectionError("");
      syncParticipants();
    };

    const handleReconnecting = () => {
      setConnectionState(ConnectionState.Reconnecting);
    };

    const handleSignalReconnecting = () => {
      setConnectionState(ConnectionState.SignalReconnecting);
    };

    const handleReconnected = () => {
      setConnectionState(ConnectionState.Connected);
      setConnectionError("");
      syncParticipants();
    };

    const handleDisconnected = (reason?: DisconnectReason) => {
      setConnectionState(ConnectionState.Disconnected);
      setLastDisconnectReason(reason ?? null);
      syncParticipants();
    };

    const handleConnectionStateChanged = (state: ConnectionState) => {
      setConnectionState(state);
    };

    const handleParticipantConnected = () => syncParticipants();
    const handleParticipantDisconnected = () => syncParticipants();
    const handleTrackUpdate = () => syncParticipants();
    const handleActiveSpeakersChanged = (speakers: Participant[]) => {
      setActiveSpeakers(speakers);
    };

    const handleMediaDevicesError = (error: Error) => {
      setConnectionError(error.message);
      onError?.(error);
    };

    const handleConnectionQualityChanged = () => syncParticipants();

    room
      .on(RoomEvent.Connected, handleConnected)
      .on(RoomEvent.Reconnecting, handleReconnecting)
      .on(RoomEvent.SignalReconnecting, handleSignalReconnecting)
      .on(RoomEvent.Reconnected, handleReconnected)
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
      .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
      .on(RoomEvent.TrackPublished, handleTrackUpdate)
      .on(RoomEvent.TrackSubscribed, handleTrackUpdate)
      .on(RoomEvent.TrackUnpublished, handleTrackUpdate)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUpdate)
      .on(RoomEvent.TrackMuted, handleTrackUpdate)
      .on(RoomEvent.TrackUnmuted, handleTrackUpdate)
      .on(RoomEvent.LocalTrackPublished, handleTrackUpdate)
      .on(RoomEvent.LocalTrackUnpublished, handleTrackUpdate)
      .on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged)
      .on(RoomEvent.MediaDevicesError, handleMediaDevicesError)
      .on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

    syncParticipants();

    return () => {
      room
        .off(RoomEvent.Connected, handleConnected)
        .off(RoomEvent.Reconnecting, handleReconnecting)
        .off(RoomEvent.SignalReconnecting, handleSignalReconnecting)
        .off(RoomEvent.Reconnected, handleReconnected)
        .off(RoomEvent.Disconnected, handleDisconnected)
        .off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
        .off(RoomEvent.ParticipantConnected, handleParticipantConnected)
        .off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .off(RoomEvent.TrackPublished, handleTrackUpdate)
        .off(RoomEvent.TrackSubscribed, handleTrackUpdate)
        .off(RoomEvent.TrackUnpublished, handleTrackUpdate)
        .off(RoomEvent.TrackUnsubscribed, handleTrackUpdate)
        .off(RoomEvent.TrackMuted, handleTrackUpdate)
        .off(RoomEvent.TrackUnmuted, handleTrackUpdate)
        .off(RoomEvent.LocalTrackPublished, handleTrackUpdate)
        .off(RoomEvent.LocalTrackUnpublished, handleTrackUpdate)
        .off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged)
        .off(RoomEvent.MediaDevicesError, handleMediaDevicesError)
        .off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    };
  }, [onError, room, syncParticipants]);

  useEffect(() => {
    return () => {
      void room.disconnect(true);
    };
  }, [room]);

  const setMicrophoneEnabled = useCallback(
    async (enabled: boolean) => {
      return room.localParticipant.setMicrophoneEnabled(enabled);
    },
    [room],
  );

  const setCameraEnabled = useCallback(
    async (enabled: boolean) => {
      return room.localParticipant.setCameraEnabled(enabled);
    },
    [room],
  );

  const setScreenShareEnabled = useCallback(
    async (enabled: boolean): Promise<LocalTrackPublication | undefined> => {
      return room.localParticipant.setScreenShareEnabled(
        enabled,
        {
          audio: false,
          video: { displaySurface: "monitor" },
          resolution: ScreenSharePresets.h1080fps30.resolution,
          contentHint: "detail",
          selfBrowserSurface: "include",
          surfaceSwitching: "include",
          systemAudio: "exclude",
        },
        {
          simulcast: false,
          screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
          degradationPreference: "maintain-resolution",
        },
      );
    },
    [room],
  );

  const switchDevice = useCallback(
    async (kind: MediaDeviceKind, deviceId: string) => {
      return room.switchActiveDevice(kind, deviceId, true);
    },
    [room],
  );

  const remoteParticipants = useMemo(
    () =>
      participants.filter(
        (participant): participant is RemoteParticipant => !participant.isLocal,
      ),
    [participants],
  );

  const status: LivekitRoomStatus =
    connectionState === ConnectionState.Connected
      ? "connected"
      : connectionState === ConnectionState.Connecting
        ? "connecting"
        : connectionState === ConnectionState.Reconnecting ||
            connectionState === ConnectionState.SignalReconnecting
          ? "reconnecting"
          : connectionState === ConnectionState.Disconnected
            ? "disconnected"
            : "idle";

  return {
    room,
    status,
    connectionState,
    connectionError,
    lastDisconnectReason,
    participants,
    remoteParticipants,
    activeSpeakers,
    localParticipant: room.localParticipant,
    isConnected: connectionState === ConnectionState.Connected,
    isReconnecting:
      connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting,
    isMicrophoneEnabled: room.localParticipant.isMicrophoneEnabled,
    isCameraEnabled: room.localParticipant.isCameraEnabled,
    isScreenShareEnabled: room.localParticipant.isScreenShareEnabled,
    microphonePublication: room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    ),
    cameraPublication: room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    ),
    screenSharePublication: room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    ),
    setMicrophoneEnabled,
    setCameraEnabled,
    setScreenShareEnabled,
    switchDevice,
    disconnect: () => room.disconnect(true),
  };
}
