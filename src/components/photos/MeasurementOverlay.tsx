import { useState, useCallback, useRef } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { useUpdatePhoto } from "@/hooks/usePhotos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MeasurementLine, PhotoMeasurements } from "@/types/database";

const MAX_LINES = 10;

/* ─── View-only overlay (used in PhotoGrid thumbnails & viewer) ─── */
interface ViewOverlayProps {
  measurements: PhotoMeasurements;
}

export function MeasurementOverlay({ measurements }: ViewOverlayProps) {
  const lines = measurements?.lines;
  const width = measurements?.width;
  const height = measurements?.height;

  const hasLegacy = width || height;
  const hasLines = lines && lines.length > 0;

  if (!hasLegacy && !hasLines) return null;

  return (
    <>
      {/* SVG line annotations */}
      {hasLines && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {lines.map((line) => (
            <g key={line.id}>
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#22d3ee"
                strokeWidth="0.4"
                strokeLinecap="round"
              />
              {/* Endpoint dots */}
              <circle cx={line.x1} cy={line.y1} r="0.6" fill="#22d3ee" />
              <circle cx={line.x2} cy={line.y2} r="0.6" fill="#22d3ee" />
              {/* Label background + text at midpoint */}
              <rect
                x={(line.x1 + line.x2) / 2 - measureLabelWidth(line.label) / 2}
                y={(line.y1 + line.y2) / 2 - 2}
                width={measureLabelWidth(line.label)}
                height={4}
                rx="0.5"
                fill="rgba(0,0,0,0.75)"
              />
              <text
                x={(line.x1 + line.x2) / 2}
                y={(line.y1 + line.y2) / 2 + 1.2}
                textAnchor="middle"
                fill="white"
                fontSize="2.8"
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
              >
                {line.label}
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Legacy width/height banner */}
      {hasLegacy && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center py-2 px-3">
          <span className="text-sm font-medium tracking-wide">
            {width && height
              ? `${width} × ${height}`
              : width
                ? `W: ${width}`
                : `H: ${height}`}
          </span>
        </div>
      )}
    </>
  );
}

function measureLabelWidth(label: string): number {
  return Math.max(label.length * 1.8, 6);
}

/* ─── Interactive annotation editor ─── */
interface AnnotationEditorProps {
  photoId: string;
  jobId: string;
  measurements: PhotoMeasurements | null;
  onClose: () => void;
}

interface PendingPoint {
  x: number;
  y: number;
}

export function AnnotationEditor({
  photoId,
  jobId,
  measurements,
  onClose,
}: AnnotationEditorProps) {
  const updatePhoto = useUpdatePhoto();
  const svgRef = useRef<SVGSVGElement>(null);

  const [lines, setLines] = useState<MeasurementLine[]>(
    measurements?.lines ?? []
  );
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [pendingLine, setPendingLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toPercent = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    []
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (lines.length >= MAX_LINES && !pendingPoint) return;
      const pt = toPercent(e);
      if (!pt) return;

      if (!pendingPoint) {
        setPendingPoint(pt);
        setSelectedId(null);
      } else {
        // Second point — show label input
        setPendingLine({
          x1: pendingPoint.x,
          y1: pendingPoint.y,
          x2: pt.x,
          y2: pt.y,
        });
        setPendingPoint(null);
        setLabelInput("");
      }
    },
    [pendingPoint, lines.length, toPercent]
  );

  const confirmLine = useCallback(() => {
    if (!pendingLine || !labelInput.trim()) return;
    const newLine: MeasurementLine = {
      id: crypto.randomUUID(),
      ...pendingLine,
      label: labelInput.trim(),
    };
    setLines((prev) => [...prev, newLine]);
    setPendingLine(null);
    setLabelInput("");
  }, [pendingLine, labelInput]);

  const cancelPending = useCallback(() => {
    setPendingPoint(null);
    setPendingLine(null);
    setLabelInput("");
  }, []);

  const deleteLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(null);
  }, []);

  const save = useCallback(() => {
    updatePhoto.mutate(
      {
        photoId,
        jobId,
        updates: {
          measurements: {
            ...(measurements ?? {}),
            lines,
          },
        },
      },
      { onSuccess: () => onClose() }
    );
  }, [photoId, jobId, lines, measurements, updatePhoto, onClose]);

  return (
    <div className="absolute inset-0 z-10">
      {/* Interactive SVG layer */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onClick={handleSvgClick}
      >
        {/* Saved lines */}
        {lines.map((line) => (
          <g
            key={line.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(selectedId === line.id ? null : line.id);
            }}
            className="cursor-pointer"
          >
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={selectedId === line.id ? "#f97316" : "#22d3ee"}
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <circle cx={line.x1} cy={line.y1} r="0.8" fill={selectedId === line.id ? "#f97316" : "#22d3ee"} />
            <circle cx={line.x2} cy={line.y2} r="0.8" fill={selectedId === line.id ? "#f97316" : "#22d3ee"} />
            <rect
              x={(line.x1 + line.x2) / 2 - measureLabelWidth(line.label) / 2}
              y={(line.y1 + line.y2) / 2 - 2.2}
              width={measureLabelWidth(line.label)}
              height={4.4}
              rx="0.6"
              fill={selectedId === line.id ? "rgba(249,115,22,0.85)" : "rgba(0,0,0,0.75)"}
            />
            <text
              x={(line.x1 + line.x2) / 2}
              y={(line.y1 + line.y2) / 2 + 1.2}
              textAnchor="middle"
              fill="white"
              fontSize="2.8"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* First pending point */}
        {pendingPoint && (
          <circle
            cx={pendingPoint.x}
            cy={pendingPoint.y}
            r="1"
            fill="#22d3ee"
            className="animate-pulse"
          />
        )}

        {/* Pending line preview */}
        {pendingLine && (
          <g>
            <line
              x1={pendingLine.x1}
              y1={pendingLine.y1}
              x2={pendingLine.x2}
              y2={pendingLine.y2}
              stroke="#22d3ee"
              strokeWidth="0.5"
              strokeDasharray="1 0.5"
              strokeLinecap="round"
            />
            <circle cx={pendingLine.x1} cy={pendingLine.y1} r="0.8" fill="#22d3ee" />
            <circle cx={pendingLine.x2} cy={pendingLine.y2} r="0.8" fill="#22d3ee" />
          </g>
        )}
      </svg>

      {/* Top toolbar */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
        <div className="pointer-events-auto bg-black/70 text-white text-xs px-2 py-1 rounded">
          {pendingPoint
            ? "Tap second point"
            : pendingLine
              ? "Enter dimension"
              : `Tap to add (${lines.length}/${MAX_LINES})`}
        </div>
        <div className="flex gap-1 pointer-events-auto">
          {selectedId && (
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={() => deleteLine(selectedId)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={() => {
              cancelPending();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Label input bar (shown when pending line exists) */}
      {pendingLine && (
        <div className="absolute bottom-14 left-2 right-2 z-20 flex gap-2">
          <Input
            autoFocus
            placeholder='e.g. 12ft 6in'
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmLine();
              if (e.key === "Escape") cancelPending();
            }}
            className="bg-black/80 border-cyan-500/50 text-white placeholder:text-white/50 text-sm"
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={confirmLine} disabled={!labelInput.trim()}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-9 w-9 shrink-0" onClick={cancelPending}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bottom save bar */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex gap-2">
        <Button
          className="flex-1 gap-2"
          onClick={save}
          disabled={updatePhoto.isPending}
        >
          <Check className="h-4 w-4" />
          {updatePhoto.isPending ? "Saving..." : "Save Measurements"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Toggle button for entering annotation mode ─── */
interface MeasureButtonProps {
  onClick: () => void;
}

export function MeasureButton({ onClick }: MeasureButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
      Add Measurement
    </Button>
  );
}
