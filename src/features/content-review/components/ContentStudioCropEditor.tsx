import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crop,
  Focus,
  Minus,
  Plus,
  RotateCcw,
  X,
  ZoomIn,
} from "lucide-react";

export type ContentStudioCropValues = {
  crop_x: number;
  crop_y: number;
  crop_zoom: number;
};

const DEFAULT_CROP: ContentStudioCropValues = {
  crop_x: 50,
  crop_y: 50,
  crop_zoom: 1,
};

const RANGE_CLASS =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-orange-400 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-400 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function cropPreviewStyle(crop: ContentStudioCropValues): CSSProperties {
  return {
    "--crop-position": `${crop.crop_x}% ${crop.crop_y}%`,
    "--crop-transform": `scale(${crop.crop_zoom})`,
    "--crop-origin": `${crop.crop_x}% ${crop.crop_y}%`,
  } as CSSProperties;
}

function isCropDirty(crop: ContentStudioCropValues, saved: ContentStudioCropValues) {
  return (
    crop.crop_x !== saved.crop_x ||
    crop.crop_y !== saved.crop_y ||
    crop.crop_zoom !== saved.crop_zoom
  );
}

type Preset = {
  id: string;
  label: string;
  icon: typeof Focus;
  values: Pick<ContentStudioCropValues, "crop_x" | "crop_y">;
};

const PRESETS: Preset[] = [
  { id: "center", label: "Center", icon: Focus, values: { crop_x: 50, crop_y: 50 } },
  { id: "top", label: "Top", icon: ArrowUp, values: { crop_x: 50, crop_y: 18 } },
  { id: "bottom", label: "Bottom", icon: ArrowDown, values: { crop_x: 50, crop_y: 82 } },
  { id: "left", label: "Left", icon: ArrowLeft, values: { crop_x: 18, crop_y: 50 } },
  { id: "right", label: "Right", icon: ArrowRight, values: { crop_x: 82, crop_y: 50 } },
];

/** Tap image → full-screen crop editor (mobile gallery style). */
export function ContentStudioImageCropFlow({
  imageUrl,
  alt,
  savedCrop,
  saving = false,
  onSave,
  className = "",
}: {
  imageUrl: string;
  alt: string;
  savedCrop: ContentStudioCropValues;
  saving?: boolean;
  onSave: (crop: ContentStudioCropValues) => void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftCrop, setDraftCrop] = useState(savedCrop);

  useEffect(() => {
    if (!open) setDraftCrop(savedCrop);
  }, [savedCrop, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hasCustomFraming = isCropDirty(savedCrop, DEFAULT_CROP);

  function openEditor() {
    setDraftCrop(savedCrop);
    setOpen(true);
  }

  function cancel() {
    setDraftCrop(savedCrop);
    setOpen(false);
  }

  async function applyAndClose() {
    if (isCropDirty(draftCrop, savedCrop)) await onSave(draftCrop);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        disabled={saving}
        className={`group relative block w-full overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-orange-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        aria-label={`Adjust framing for ${alt}`}
      >
        <div className="aspect-video w-full overflow-hidden bg-black/50">
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-contain object-(--crop-position) origin-(--crop-origin) sm:object-cover sm:transform-(--crop-transform)"
            style={cropPreviewStyle(savedCrop)}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-10">
          <p className="text-xs font-semibold text-white">Tap to adjust framing</p>
        </div>
        <span className="pointer-events-none absolute bottom-12 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white shadow-lg backdrop-blur-sm">
          <Crop size={16} />
        </span>
        {hasCustomFraming ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-orange-400/40 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-100">
            Framed
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <ContentStudioCropModal
              imageUrl={imageUrl}
              alt={alt}
              crop={draftCrop}
              savedCrop={savedCrop}
              saving={saving}
              dirty={isCropDirty(draftCrop, savedCrop)}
              onChange={setDraftCrop}
              onCancel={cancel}
              onDone={() => void applyAndClose()}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function ContentStudioCropModal({
  imageUrl,
  alt,
  crop,
  savedCrop,
  saving,
  dirty,
  onChange,
  onCancel,
  onDone,
}: {
  imageUrl: string;
  alt: string;
  crop: ContentStudioCropValues;
  savedCrop: ContentStudioCropValues;
  saving?: boolean;
  dirty: boolean;
  onChange: (crop: ContentStudioCropValues) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-120 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust image framing"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 safe-area-inset-top">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white"
        >
          <X size={18} />
          Cancel
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-white">Adjust framing</p>
          <p className="truncate text-[11px] text-white/40">{alt}</p>
        </div>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <ContentStudioCropPanel
          variant="modal"
          imageUrl={imageUrl}
          alt={alt}
          crop={crop}
          savedCrop={savedCrop}
          saving={saving}
          dirty={dirty}
          onChange={onChange}
          hideApplyButton
        />
      </div>
    </div>
  );
}

function ContentStudioCropPanel({
  variant = "inline",
  imageUrl,
  alt,
  crop,
  savedCrop,
  saving = false,
  dirty: dirtyProp,
  onChange,
  hideApplyButton = false,
  onSave,
}: {
  variant?: "inline" | "modal";
  imageUrl: string;
  alt: string;
  crop: ContentStudioCropValues;
  savedCrop: ContentStudioCropValues;
  saving?: boolean;
  dirty?: boolean;
  onChange: (crop: ContentStudioCropValues) => void;
  hideApplyButton?: boolean;
  onSave?: () => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; crop_x: number; crop_y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dirty = dirtyProp ?? isCropDirty(crop, savedCrop);
  const isModal = variant === "modal";

  const patchCrop = useCallback(
    (patch: Partial<ContentStudioCropValues>) => {
      onChange({ ...crop, ...patch });
    },
    [crop, onChange],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        crop_x: crop.crop_x,
        crop_y: crop.crop_y,
      };
      setIsDragging(true);
    },
    [crop.crop_x, crop.crop_y],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dx = ((event.clientX - dragRef.current.x) / rect.width) * 100;
      const dy = ((event.clientY - dragRef.current.y) / rect.height) * 100;
      onChange({
        ...crop,
        crop_x: clamp(dragRef.current.crop_x - dx, 0, 100),
        crop_y: clamp(dragRef.current.crop_y - dy, 0, 100),
      });
    },
    [crop, onChange],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    }
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const preview = (
    <div
      ref={previewRef}
      className={`relative touch-none overflow-hidden bg-black ${
        isModal
          ? `min-h-0 flex-1 ${isDragging ? "ring-2 ring-inset ring-orange-500/30" : ""}`
          : `mx-4 mt-4 aspect-video rounded-xl border ${
              isDragging ? "border-orange-400/50 ring-2 ring-orange-500/20" : "border-white/15"
            }`
      }`}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={(event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.06 : 0.06;
        patchCrop({ crop_zoom: clamp(Number((crop.crop_zoom + delta).toFixed(2)), 1, 2) });
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        className={`pointer-events-none h-full w-full select-none object-cover object-(--crop-position) origin-(--crop-origin)(--crop-transform)] ${
          isModal ? "min-h-[42vh]" : ""
        }`}
        style={cropPreviewStyle(crop)}
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/20" />
      <div
        className={`pointer-events-none absolute rounded-lg border border-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${
          isModal ? "inset-4 sm:inset-8" : "inset-3"
        }`}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="border border-white/10" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
        {Math.round(crop.crop_x)}% · {Math.round(crop.crop_y)}% · {crop.crop_zoom.toFixed(2)}×
      </div>
    </div>
  );

  const controls = (
    <div className={`space-y-4 ${isModal ? "px-4 py-4" : "p-4"}`}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const active =
            Math.round(crop.crop_x) === preset.values.crop_x &&
            Math.round(crop.crop_y) === preset.values.crop_y;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={saving}
              onClick={() => patchCrop(preset.values)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-orange-400/50 bg-orange-500/20 text-orange-100"
                  : "border-white/10 bg-black/40 text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={13} />
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={saving}
          onClick={() => onChange({ ...DEFAULT_CROP })}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      <ModernSlider
        label="Horizontal"
        hint="Left ↔ Right"
        min={0}
        max={100}
        step={1}
        value={crop.crop_x}
        format={(value) => `${Math.round(value)}%`}
        onChange={(crop_x) => patchCrop({ crop_x })}
        disabled={saving}
      />
      <ModernSlider
        label="Vertical"
        hint="Top ↔ Bottom"
        min={0}
        max={100}
        step={1}
        value={crop.crop_y}
        format={(value) => `${Math.round(value)}%`}
        onChange={(crop_y) => patchCrop({ crop_y })}
        disabled={saving}
      />

      <ZoomControl crop={crop} saving={saving} onPatch={patchCrop} />

      {!hideApplyButton && onSave ? (
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? "Saving…" : dirty ? "Apply framing" : "Framing saved"}
        </button>
      ) : null}
    </div>
  );

  if (isModal) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">{preview}</div>
        <div className="max-h-[46vh] shrink-0 overflow-y-auto rounded-t-3xl border-t border-white/10 bg-neutral-950 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
          {controls}
        </div>
      </>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b frfrom-white/6o-black/40">
      <PanelHeader dirty={dirty} />
      {preview}
      {controls}
    </div>
  );
}

function PanelHeader({ dirty }: { dirty: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/10 text-orange-300">
          <Crop size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Image framing</p>
          <p className="text-[11px] text-white/45">Drag · scroll to zoom</p>
        </div>
      </div>
      {dirty ? (
        <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
          Unsaved
        </span>
      ) : (
        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
          Saved
        </span>
      )}
    </div>
  );
}

function ZoomControl({
  crop,
  saving,
  onPatch,
}: {
  crop: ContentStudioCropValues;
  saving?: boolean;
  onPatch: (patch: Partial<ContentStudioCropValues>) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-white/55">
          <ZoomIn size={14} className="text-orange-400/90" />
          <span className="font-semibold text-white/75">Zoom</span>
          <span className="text-white/35">{crop.crop_zoom.toFixed(2)}×</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving || crop.crop_zoom <= 1}
            onClick={() =>
              onPatch({ crop_zoom: clamp(Number((crop.crop_zoom - 0.05).toFixed(2)), 1, 2) })
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 hover:bg-white/5 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            disabled={saving || crop.crop_zoom >= 2}
            onClick={() =>
              onPatch({ crop_zoom: clamp(Number((crop.crop_zoom + 0.05).toFixed(2)), 1, 2) })
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 hover:bg-white/5 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={2}
        step={0.05}
        value={crop.crop_zoom}
        disabled={saving}
        onChange={(event) => onPatch({ crop_zoom: Number(event.target.value) })}
        className={RANGE_CLASS}
      />
    </div>
  );
}

function ModernSlider({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-white/75">{label}</span>
          <span className="ml-2 text-[10px] text-white/35">{hint}</span>
        </div>
        <span className="rounded-md bg-black/50 px-2 py-0.5 font-mono text-[11px] text-orange-200">
          {format(value)}
        </span>
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-linear-to-r from-orange-500/80 to-orange-400/40"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`relative z-10 ${RANGE_CLASS}`}
        />
      </div>
    </label>
  );
}

export function contentStudioCropFromAsset(asset: {
  crop_x?: number | null;
  crop_y?: number | null;
  crop_zoom?: number | null;
}): ContentStudioCropValues {
  return {
    crop_x: asset.crop_x ?? DEFAULT_CROP.crop_x,
    crop_y: asset.crop_y ?? DEFAULT_CROP.crop_y,
    crop_zoom: asset.crop_zoom ?? DEFAULT_CROP.crop_zoom,
  };
}

/** @deprecated Use ContentStudioImageCropFlow — crop opens on image tap. */
export default function ContentStudioCropEditor(props: {
  imageUrl: string;
  alt: string;
  crop: ContentStudioCropValues;
  savedCrop: ContentStudioCropValues;
  saving?: boolean;
  onChange: (crop: ContentStudioCropValues) => void;
  onSave: () => void;
}) {
  return (
    <ContentStudioCropPanel
      variant="inline"
      imageUrl={props.imageUrl}
      alt={props.alt}
      crop={props.crop}
      savedCrop={props.savedCrop}
      saving={props.saving}
      onChange={props.onChange}
      onSave={props.onSave}
    />
  );
}
