import { Bot } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useFloatingAiAssistant } from "../hooks/useFloatingAiAssistant";
import FloatingAiChat from "./FloatingAiChat";

const BUBBLE_SIZE = 56;
const VIEWPORT_MARGIN = 20;
const STORAGE_KEY = "itsnomatata-floating-ai-position";

type BubblePosition = {
  x: number;
  y: number;
};

function getDefaultPosition(): BubblePosition {
  return {
    x: window.innerWidth - BUBBLE_SIZE - VIEWPORT_MARGIN,
    y: window.innerHeight - BUBBLE_SIZE - VIEWPORT_MARGIN,
  };
}

function clampPosition(position: BubblePosition): BubblePosition {
  return {
    x: Math.min(
      Math.max(position.x, VIEWPORT_MARGIN),
      window.innerWidth - BUBBLE_SIZE - VIEWPORT_MARGIN,
    ),
    y: Math.min(
      Math.max(position.y, VIEWPORT_MARGIN),
      window.innerHeight - BUBBLE_SIZE - VIEWPORT_MARGIN,
    ),
  };
}

function readStoredPosition(): BubblePosition {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultPosition();
    const parsed = JSON.parse(stored) as Partial<BubblePosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return getDefaultPosition();
    }
    return clampPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return getDefaultPosition();
  }
}

export default function FloatingAiAssistant() {
  const {
    visible,
    open,
    setOpen,
    busy,
    messages,
    error,
    sendMessage,
    reset,
  } = useFloatingAiAssistant();
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setPosition(readStoredPosition());
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        if (!current) return current;
        const next = clampPosition(current);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const persistPosition = useCallback((next: BubblePosition) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? getDefaultPosition().x,
      originY: position?.y ?? getDefaultPosition().y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const movedEnough = Math.hypot(deltaX, deltaY) > 4;
    if (!movedEnough && !drag.moved) return;

    drag.moved = true;
    setDragging(true);
    setPosition(
      clampPosition({
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      }),
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setDragging(false);

    if (drag.moved) {
      const next = clampPosition({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      });
      setPosition(next);
      persistPosition(next);
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const handleClick = () => {
    if (suppressClickRef.current) return;
    setOpen((current) => !current);
  };

  if (!visible) return null;
  if (!position) return null;

  return (
    <>
      <FloatingAiChat
        open={open}
        anchorPosition={position}
        busy={busy}
        messages={messages}
        error={error}
        onClose={() => setOpen(false)}
        onSend={sendMessage}
        onReset={reset}
      />

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          "fixed z-[9999] inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-black shadow-lg shadow-orange-500/30 transition hover:bg-orange-400",
          dragging ? "cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        style={{
          left: position.x,
          top: position.y,
          touchAction: "none",
        }}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        title="Workspace AI"
      >
        <Bot size={22} />
      </button>
    </>
  );
}
