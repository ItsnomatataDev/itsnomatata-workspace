import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";

export default function MeetingReconnectBanner() {
  const room = useRoomContext();
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!room) return;

    const sync = (state: ConnectionState) => {
      setIsReconnecting(
        state === ConnectionState.Reconnecting ||
          state === ConnectionState.SignalReconnecting,
      );
    };

    sync(room.state);

    const onReconnecting = () => setIsReconnecting(true);
    const onReconnected = () => setIsReconnecting(false);
    const onConnected = () => setIsReconnecting(false);
    const onDisconnected = () => setIsReconnecting(false);
    const onConnectionStateChanged = (state: ConnectionState) => sync(state);

    room
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.SignalReconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.Connected, onConnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);

    return () => {
      room
        .off(RoomEvent.Reconnecting, onReconnecting)
        .off(RoomEvent.SignalReconnecting, onReconnecting)
        .off(RoomEvent.Reconnected, onReconnected)
        .off(RoomEvent.Connected, onConnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    };
  }, [room]);

  if (!isReconnecting) return null;

  return (
    <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      Reconnecting to meeting media...
    </div>
  );
}
