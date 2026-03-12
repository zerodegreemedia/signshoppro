interface MeasurementOverlayProps {
  measurements: Record<string, string>;
}

export function MeasurementOverlay({ measurements }: MeasurementOverlayProps) {
  const width = measurements.width;
  const height = measurements.height;

  if (!width && !height) return null;

  const label = width && height
    ? `${width} × ${height}`
    : width
      ? `W: ${width}`
      : `H: ${height}`;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center py-2 px-3">
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </div>
  );
}
