# Phase 9: AI Logo Regeneration Tool — Design Spec

## Overview

Add an AI-powered logo cleanup tool that accepts a low-quality logo image, sends it to the Gemini API (`gemini-2.5-flash-image`), and returns a clean, high-resolution version. Supports multi-turn refinement (e.g., "make text bolder") and saving the result to Supabase Storage under a job's client.

## Architecture

### Components

1. **Edge Function** (`supabase/functions/regenerate-logo/index.ts`) — server-side Gemini API caller
2. **Hook** (`src/features/ai/useLogoRegeneration.ts`) — client-side state management
3. **Page** (`src/pages/LogoRegenerate.tsx`) — full UI for upload, preview, refine, download, save
4. **Job Detail integration** — "Clean Up Client Logo" button in Overview tab

### Data Flow

```
User uploads image
  → Frontend converts to base64
  → POST to /functions/v1/regenerate-logo { imageBase64, mimeType, prompt? }
  → Edge Function calls Gemini API with image + prompt
  → Gemini returns regenerated image
  → Edge Function returns { imageBase64, mimeType }
  → Frontend displays side-by-side comparison

Refinement:
  → User types instruction (e.g., "make text bolder")
  → Frontend sends regenerated image + appended instruction to same endpoint
  → New result replaces previous

Save to Job:
  → Frontend converts base64 to blob
  → Uploads to client-logos bucket: {client_id}/{uuid}.png
  → Toast confirmation
```

## Edge Function: `regenerate-logo/index.ts`

### Request

```typescript
interface RegenerateLogoRequest {
  imageBase64: string;  // base64-encoded image data (no data URI prefix)
  mimeType: string;     // "image/png" | "image/jpeg" | "image/webp" | "image/gif"
  prompt?: string;      // optional refinement instruction
}
```

### Response

Success (200):
```typescript
interface RegenerateLogoResponse {
  imageBase64: string;
  mimeType: string;
}
```

Error (400/500):
```typescript
interface RegenerateLogoError {
  error: string;  // human-readable message
}
```

### Implementation Details

- **Runtime**: Deno (Supabase Edge Functions)
- **SDK**: `@google/genai` imported from `https://esm.sh/@google/genai`
- **Model**: `gemini-2.5-flash-image`
- **Config**: `responseModalities: ["IMAGE"]` in generation config
- **Auth**: Validates `Authorization: Bearer <token>` header; verifies user is authenticated (admin-only access — consistent with other edge functions)
- **Secret**: `GEMINI_API_KEY` from `Deno.env.get()`
- **CORS**: Standard preflight handling matching existing edge functions

### Default Prompt

```
Recreate this logo as a clean, high-resolution, professional image. Preserve exact design elements, colors, text, and layout. Remove all compression artifacts, blur, and noise. Output a crisp version with clean edges on a white background.
```

When a custom prompt is provided, it is appended: `{defaultPrompt}\n\nAdditional instructions: {customPrompt}`

### Error Handling

| Scenario | Response |
|---|---|
| Missing imageBase64/mimeType | 400: "Image data and MIME type are required" |
| Gemini safety filter blocks | 400: "The AI couldn't process this image. The content may have been flagged by safety filters. Try a different image." |
| Gemini returns no image | 400: "The AI couldn't generate an image. Try a different photo or angle." |
| Gemini API error / rate limit | 500: "AI service temporarily unavailable. Please try again in a moment." |
| Missing GEMINI_API_KEY | 500: "AI service not configured" |

## Hook: `useLogoRegeneration.ts`

Uses TanStack Query `useMutation` for all server interactions (per Coding Rule #3).

### State

Local `useState` for image data (not server-cached):
```typescript
originalImage: { base64: string; mimeType: string } | null
regeneratedImage: { base64: string; mimeType: string } | null
```

Mutation states (`isPending`, `error`) come from TanStack Query mutations.

### Mutations

- **`regenerateMutation`** (`useMutation`): Validates file type and size (<10MB), converts to base64 (strips data URI prefix), calls edge function. On success, stores result in `regeneratedImage` state.
- **`refineMutation`** (`useMutation`): Takes the current `regeneratedImage`, sends it back to the edge function with the instruction as the prompt. On success, replaces `regeneratedImage` with new result.
- **`saveMutation`** (`useMutation`): Fetches the job to get `client_id`. Converts base64 to Blob. Uploads to `client-logos` bucket at path `{client_id}/{job_id}/{uuid}.png`. Shows success toast.

### Helper Methods

- **`downloadImage()`**: Converts `regeneratedImage.base64` to a Blob, creates an object URL, programmatically clicks an `<a>` element to trigger download. Filename: `logo-regenerated-{timestamp}.png`.
- **`reset()`**: Clears all state back to initial values, resets mutations.

### Exposed API

```typescript
{
  originalImage, regeneratedImage,
  regenerateLogo: (file: File) => void,
  refineLogo: (instruction: string) => void,
  downloadImage: () => void,
  saveToJob: (jobId: string) => void,
  reset: () => void,
  isProcessing: boolean,  // regenerateMutation.isPending || refineMutation.isPending
  isSaving: boolean,      // saveMutation.isPending
  error: string | null,   // derived from active mutation errors
}
```

### File Validation

- Accepted types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- Max size: 10MB (10 * 1024 * 1024 bytes)
- Client-side compression: resize to max 4096px on longest side before base64 encoding (reduces payload size for the edge function)
- Error messages: "Please upload a PNG, JPG, WEBP, or GIF image" / "File is too large. Please use an image under 10MB."

## Page: `LogoRegenerate.tsx`

Replaces the current `PlaceholderPage` at route `/ai/logo`. Wrapped in `RoleGate` for admin-only access.

### Layout

```
┌──────────────────────────────────┐
│ AI Logo Cleanup                  │
│ Upload a low-quality logo and    │
│ our AI will regenerate a clean,  │
│ high-resolution version.         │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │   Drag & drop or click     │  │
│  │   to upload a logo image   │  │
│  │                            │  │
│  │   [Upload Image] [Camera]  │  │
│  └────────────────────────────┘  │
│                                  │
│  [Regenerate Logo]  (disabled)   │
│                                  │
├──────────────────────────────────┤
│ After processing:                │
│                                  │
│  Original    │  Regenerated      │
│  ┌────────┐  │  ┌────────┐      │
│  │        │  │  │        │      │
│  │  img   │  │  │  img   │      │
│  │        │  │  │        │      │
│  └────────┘  │  └────────┘      │
│              │                   │
│  [Download] [Save to Job ▾]     │
│  [Refine]   [Start Over]        │
│                                  │
│  Refine input (when expanded):   │
│  ┌────────────────────────────┐  │
│  │ Tell the AI what to change │  │
│  └────────────────────────────┘  │
│  [Apply Refinement]              │
└──────────────────────────────────┘
```

### Mobile Layout

- Stacked vertically: original on top, regenerated below
- Upload area: full-width buttons instead of drag-and-drop zone
- Camera button uses `capture="environment"` on file input
- Images are stacked, not side-by-side

### Desktop Layout

- Side-by-side comparison: `md:grid-cols-2`
- Drag-and-drop zone with dashed border, hover state

### Image Zoom

- Click/tap on either image opens a Dialog with the full-size image
- On mobile, supports pinch-to-zoom via CSS `touch-action: pinch-zoom` on the image

### Processing State

- "Regenerate Logo" button shows spinner + "Processing..."
- Below the button: "AI is cleaning up your logo... This may take 10-20 seconds."
- Upload area and buttons disabled during processing

### Save to Job

- Searchable combobox (shadcn `Command` + `Popover`) populated from `useJobs()` filtered to active jobs only (exclude completed/archived/cancelled)
- Shows job title + client name for each option
- If page loaded with `?jobId=xxx` query param, pre-selects that job and shows it as default
- On save: uploads to storage, shows success toast
- Empty state: "No active jobs found. Create a job first to save logos."

### Refinement Flow

- "Refine" button toggles a text input area
- User types instruction, clicks "Apply Refinement"
- Shows processing state again
- New result replaces previous regenerated image
- Can refine multiple times (each refinement uses the latest regenerated image)

## Job Detail Integration

In `JobDetail.tsx`, add a button in the Overview tab content area:

```tsx
<Button variant="outline" asChild>
  <Link to={`/ai/logo?jobId=${job.id}`}>
    <Sparkles className="h-4 w-4 mr-2" />
    Clean Up Client Logo
  </Link>
</Button>
```

Placed in the overview section near existing action buttons.

## Storage

- **Bucket**: `client-logos` (already exists with public access + RLS)
- **Path**: `{client_id}/{job_id}/{uuid}.png`
- **No DB table** — logos are stored as files only, discoverable by listing the bucket path

## Edge Cases

| Case | Handling |
|---|---|
| File >10MB | Client-side validation, error toast before upload |
| Non-image file | Client-side MIME type check, error toast |
| Gemini safety filter | Display edge function error message in UI |
| Gemini rate limit (500 req/day) | Display "AI service temporarily unavailable" message |
| Network error during processing | Display "Connection error. Please check your connection and try again." |
| Very slow response (>30s) | No timeout — Gemini can take up to 30s for image generation |
| User navigates away during processing | State lost (acceptable — no side effects) |

## Dependencies

- `@google/genai` via esm.sh (Edge Function only, Deno import)
- No new npm packages needed on the frontend
- Existing: `uuid` for generating storage paths, `sonner` for toasts

## Testing Strategy

Manual testing:
1. Upload a low-quality logo screenshot
2. Verify regenerated image appears
3. Test download (check file saves correctly)
4. Test save to job (verify file in Supabase Storage dashboard)
5. Test refinement ("make text bolder") — verify updated result
6. Test file validation (>10MB file, non-image file)
7. Test mobile layout (stacked images, camera capture)
8. `npm run build` — zero TypeScript errors
