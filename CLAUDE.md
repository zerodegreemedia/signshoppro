# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SignShop Pro** — Job Management & Estimating PWA for Zero Degree Media. Mobile-first web app for managing sign shop, vehicle graphics, and print jobs. Used in the field to photograph storefronts/vehicles, record measurements, estimate pricing, send proofs to clients, collect payments, and use AI to clean up client logos.

## Tech Stack

- **Frontend:** React 19 + TypeScript (strict mode) + Vite 7
- **Styling:** Tailwind CSS v4 (CSS-only config — **NO tailwind.config.js**)
- **UI Components:** shadcn/ui (Radix primitives) — install with `npx shadcn@latest add <name>`
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage)
- **State Management:** TanStack Query v5 for all server data
- **Forms:** react-hook-form + zod validation
- **Routing:** React Router v6
- **PWA:** vite-plugin-pwa with autoUpdate service worker
- **AI:** Gemini API (`gemini-2.5-flash-image`) via `@google/genai` SDK
- **Payments:** Stripe Payment Links + webhooks via Supabase Edge Functions
- **Offline:** IndexedDB queue for field use with poor cell signal

## Commands

```bash
npm run dev                           # Vite dev server (port 5173)
npm run build                         # Production build (always run to check for TS errors)
npm run lint                          # ESLint check

npx supabase start                    # Local Supabase (requires Docker)
npx supabase db reset                 # Reset DB, reapply migrations + seed
npx supabase migration new <name>     # Create new SQL migration
npx supabase db push                  # Deploy migrations to production
npx supabase functions serve          # Run Edge Functions locally
npx supabase functions deploy <name>  # Deploy Edge Function to production
npx supabase secrets set KEY=value    # Set server-side secrets
```

## Architecture

### Frontend (`src/`)

```
src/
├── components/
│   ├── ui/              # shadcn/ui (auto-generated — DO NOT manually edit)
│   ├── layout/          # AppShell, MobileNav, Sidebar, Header, CommandPalette
│   ├── jobs/            # JobCard, JobDetail, StatusBadge, StatusTimeline
│   ├── estimates/       # LineItemEditor, PricingCalculator, WrapCalculator
│   ├── proofs/          # ProofViewer, ProofApproval, VersionHistory
│   ├── photos/          # PhotoCapture, PhotoGrid, MeasurementInput
│   ├── clients/         # ClientList, ClientDetail, ClientForm
│   ├── payments/        # PaymentHistory, PaymentLinkButton
│   └── auth/            # LoginForm, SignupForm, ProtectedRoute, RoleGate
├── features/
│   ├── ai/              # useLogoRegeneration hook, LogoRegenerate page
│   ├── payments/        # usePaymentLink hook, Stripe integration
│   └── pricing/         # Estimating engine, material costs, quantity breaks
├── hooks/               # useAuth, useJobs, useClients, usePhotos, useOfflineQueue
├── lib/
│   ├── supabase.ts      # Single Supabase client (ALWAYS import from here)
│   ├── utils.ts         # cn() helper and shared utilities
│   └── constants.ts     # Job statuses, vehicle types, pricing defaults
├── pages/               # Route-level page components
├── types/
│   └── database.ts      # TypeScript types matching Supabase schema
└── index.css            # Tailwind v4 import + CSS variables for theme
```

### Supabase (`supabase/`)

```
supabase/
├── config.toml
├── migrations/              # Numbered SQL files (001_initial_schema.sql, etc.)
├── seed.sql                 # Vehicle presets, pricing presets, default materials
└── functions/
    ├── regenerate-logo/     # Gemini API call for logo cleanup
    ├── create-payment-link/ # Stripe Payment Link generator
    └── stripe-webhook/      # Payment confirmation handler
```

Edge Functions run on **Deno** (not Node.js). Use Deno APIs and imports.

## Coding Rules

1. **TypeScript strict mode** — never use `any`. Define proper interfaces.
2. **Single Supabase client** — always import from `@/lib/supabase.ts`. Never create new instances.
3. **TanStack Query for ALL data fetching** — no raw `useEffect` + `fetch` patterns.
4. **Mobile-first responsive** — base styles = mobile (375px). Use `sm`/`md`/`lg`/`xl` for larger.
5. **44px minimum tap targets** — all buttons and interactive elements.
6. **shadcn/ui for all UI elements** — don't build custom when shadcn has it.
7. **Loading states** — show `Skeleton` components. Never blank screens.
8. **Empty states** — every list view needs a helpful empty state with action button.
9. **Toast notifications** — confirm all create/update/delete operations.
10. **Error boundaries** — catch and display errors gracefully. No raw error text.

## Role-Based Access Control

- **Admin** (Luis, Maria): Full access including cost prices, margins, all client data.
- **Client**: Own jobs/estimates/proofs/payments only. **Cost/margin columns NEVER exposed.**
- Role stored as JWT custom claim via Supabase Auth Hook.
- Use `RoleGate` component to conditionally render admin-only UI.

## Environment Variables

**Client-side** (VITE_ prefix required):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`

**Server-side only** (Supabase Edge Function secrets — NEVER in frontend):
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GEMINI_API_KEY`

## Job Status Workflow

```
lead → estimate_draft → estimate_sent → estimate_approved → design_in_progress →
proof_sent → proof_approved → deposit_requested → deposit_paid → materials_ordered →
in_production → install_scheduled → install_complete → invoice_sent → paid → completed
```

Branch statuses: `estimate_rejected`, `proof_revision_requested`, `cancelled`, `archived`

## Pricing Engine

| Job Type | Pricing Method |
|---|---|
| Vehicle wraps | sqft × material rate × complexity + design fee + installation |
| Storefront signs/vinyl | sqft of vinyl used |
| Banners | flat $8/sqft retail |
| Business cards | quantity break tiers (250/500/1000/2500) |
| Door hangers | quantity break tiers (250/500/1000) |
| T-shirts/apparel | per-unit with quantity breaks + per-color/location upcharges |
| Installation | ~50% of material cost |

- Target gross margins: 40-60%
- Waste factor: 10-15% built into material calculations

### Vehicle Sqft Presets (seeded in DB)

Sedan: 200 | SUV: 250 | Pickup: 250 | Minivan: 300 | Cargo Van: 400 | Box Truck 14ft: 500 | Box Truck 26ft: 800 | 53ft Trailer: 1000

## AI Logo Regeneration

- Model: `gemini-2.5-flash-image` (free tier, good text rendering)
- SDK: `@google/genai` (**NOT** the deprecated `@google/generative-ai`)
- Runs server-side in Supabase Edge Function only
- Accepts low-quality image, returns cleaned-up high-res PNG (raster, not vector)
- Supports multi-turn refinement ("make text bolder", "change blue to navy")

## Design Guidelines

- Dark blue/slate color scheme (shadcn "slate" base) — professional, utilitarian
- Bottom nav on mobile (4 destinations: Home, Jobs, Clients, More + raised center FAB with action sheet)
- Collapsible sidebar on desktop (hidden on mobile)
- Status badges: green=completed, blue=active, amber=waiting, red=issues
- Card-based job list (not table) for mobile field use
- `Sheet` component (slide up) for mobile detail panels

## Photo System

- `capture="environment"` on file input for rear camera
- Compress to 1MB max / 1920px max via `browser-image-compression`
- Storage path: `{client_id}/{job_id}/{photo_type}/{uuid}.jpg` in Supabase "job-photos" bucket
- Capture GPS via `navigator.geolocation` when available
- Photo types: `before`, `progress`, `after`, `measurement`, `reference`, `site_survey`
- Measurements stored as JSONB: `{"width": "12ft", "height": "8ft"}`

## Offline Behavior

- Detect with `navigator.onLine` + event listeners
- Queue writes in IndexedDB when offline, process FIFO on reconnect
- Show offline indicator banner + sync status indicator
- Photos captured offline stored as blobs in IndexedDB, uploaded on reconnect

## Stripe Integration

- Payment Links for ad-hoc job payments (max 20 line items per link)
- Links created via Supabase Edge Function using Stripe secret key
- Webhook updates `payment_status` on `checkout.session.completed`
- `stripe_customer_id` on clients table for linking
- Metadata includes `job_id` for webhook identification

## Critical Warnings

- **Tailwind v4** has NO config file. Do NOT create `tailwind.config.js` or `.ts`.
- **Gemini SDK** is `@google/genai` — NOT `@google/generative-ai` (deprecated).
- **shadcn CLI** is `npx shadcn@latest` — NOT `npx shadcn-ui@latest` (old name).
- **Supabase Edge Functions** run on Deno, not Node.js.
- **VITE_ prefix** required for any env var accessible in frontend code.
- Always run `npm run build` after major changes to catch TypeScript errors.
