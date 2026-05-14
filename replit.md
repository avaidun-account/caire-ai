# Caire AI

A home health triage reference tool that sends a user's symptoms and uploaded files to 3 AI models simultaneously, then compares and summarizes their responses so the user can decide whether to go to the ER, see a doctor, or monitor at home.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mira-ai run dev` — run the frontend (port 18547)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Framer Motion
- API: Express 5
- AI: Claude (claude-sonnet-4-6), GPT (gpt-5.4), Gemini (gemini-3.1-pro-preview) — all via Replit AI Integrations (no user API keys needed)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod validation schemas
- `lib/integrations-anthropic-ai/` — Anthropic SDK client
- `lib/integrations-openai-ai-server/` — OpenAI SDK client (server)
- `lib/integrations-gemini-ai/` — Gemini SDK client
- `artifacts/api-server/src/routes/triage/` — triage route (3 parallel AI calls)
- `artifacts/mira-ai/src/` — React frontend

## Architecture decisions

- All AI calls happen server-side — API keys never exposed to client
- Health data is never stored or persisted (privacy by design)
- All 3 models called in parallel with Promise.allSettled (graceful degradation)
- Consensus urgency = lowest integer (highest urgency) from successful responses
- PDF files: text extracted server-side via pdf-parse before sending to models
- Images: base64-encoded and sent as vision content to all 3 models
- Express JSON body limit: 50MB to accommodate base64 file payloads

## Product

- Disclaimer gate (localStorage-persisted acceptance required before app access)
- Symptom text input + file upload (images + PDFs, max 4 files)
- Parallel analysis: Claude, GPT, and Gemini called simultaneously
- Urgency banner (4 tiers: ER / 24h / Monitor / Low concern) using lowest urgency
- 3 model cards with per-model urgency, summary, and considerations
- Consensus panel: agreement analysis + common considerations across models
- Persistent bottom disclaimer on every results screen

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `@google/genai` must be a direct dep of `api-server` (not just transitive) because esbuild externalizes `@google/*` patterns
- AI integration env vars (AI_INTEGRATIONS_*) are set automatically by Replit — never ask user for these
- No DATABASE_URL needed — this app intentionally has no database
- After OpenAPI spec changes, always run `pnpm --filter @workspace/api-spec run codegen`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
