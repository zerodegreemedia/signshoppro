import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useUploadPhoto } from "@/hooks/usePhotos";
import { PHOTO_TYPES } from "@/lib/constants";
import type { PhotoType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PhotoCaptureProps {
  jobId: string;
  clientId: string;
  /** When provided, component operates in controlled mode (no trigger button). */
  open?: boolean;
  /** Called when the sheet wants to close. Required for controlled mode. */
  onOpenChange?: (open: boolean) => void;
}

export function PhotoCapture({ jobId, clientId, open: controlledOpen, onOpenChange: controlledOnOpenChange }: PhotoCaptureProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState<PhotoType>("reference");
  const [notes, setNotes] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const resetForm = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setPhotoType("reference");
    setNotes("");
    setWidth("");
    setHeight("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSave = async () => {
    if (!file) return;

    // Attempt GPS (non-blocking)
    let gpsLatitude: number | undefined;
    let gpsLongitude: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 60000,
        });
      });
      gpsLatitude = pos.coords.latitude;
      gpsLongitude = pos.coords.longitude;
    } catch {
      // GPS unavailable or denied — continue without it
    }

    const measurements =
      width || height ? { width: width || "0", height: height || "0" } : undefined;

    uploadPhoto.mutate(
      {
        file,
        jobId,
        clientId,
        photoType,
        notes: notes || undefined,
        measurements,
        gpsLatitude,
        gpsLongitude,
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  };

  const sheetContent = (
    <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Capture Photo</SheetTitle>
      </SheetHeader>

      <div className="space-y-4 mt-4">
        {/* Camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {!preview ? (
          <Button
            type="button"
            variant="outline"
            className="w-full h-32 border-dashed flex flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Tap to take photo or choose from gallery
            </span>
          </Button>
        ) : (
          <div className="space-y-2">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-48 object-contain rounded-lg bg-muted"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Retake
            </Button>
          </div>
        )}

        {/* Photo type */}
        <div className="space-y-2">
          <Label>Photo Type</Label>
          <Select value={photoType} onValueChange={(v) => setPhotoType(v as PhotoType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="photo-notes">Notes</Label>
          <Textarea
            id="photo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this photo..."
            rows={2}
          />
        </div>

        {/* Measurements */}
        <div className="space-y-2">
          <Label>Measurements</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">×</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground font-medium">ft</span>
          </div>
        </div>

        {/* Save button */}
        <Button
          className="w-full min-h-[44px]"
          disabled={!file || uploadPhoto.isPending}
          onClick={handleSave}
        >
          {uploadPhoto.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Save Photo"
          )}
        </Button>
      </div>
    </SheetContent>
  );

  // Controlled mode: no trigger button, parent manages open state
  if (isControlled) {
    return (
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        {sheetContent}
      </Sheet>
    );
  }

  // Uncontrolled mode: renders its own trigger button
  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <SheetTrigger asChild>
        <Button className="gap-2 min-h-[44px]">
          <Camera className="h-4 w-4" />
          Add Photo
        </Button>
      </SheetTrigger>
      {sheetContent}
    </Sheet>
  );
}
