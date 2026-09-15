# Architecture

This document describes how Midleton is put together, for anyone contributing to or forking the project. For setup and commands, see [`README.md`](README.md).

## High-level shape

Midleton is a chat-first CRM/SFA. Instead of navigating between list pages, detail pages, and forms, the user describes what they want in natural language, and the AI decides which of a fixed set of **agent tools** to call and which **UI component** to render with the result.

```
User message
   │
   ▼
POST /api/chat  ──────────────►  Claude API (system prompt + tool definitions)
   │                                     │
   │                                     ▼
   │                            Claude decides: call a tool? which one?
   │                                     │
   │                    ┌────────────────┴────────────────┐
   │                    ▼                                  ▼
   │           dispatchTool(name, input)            no tool needed
   │                    │                                  │
   │                    ▼                                  │
   │           DrizzleORM query/mutation                   │
   │           against Cloudflare D1                       │
   │                    │                                  │
   │                    └────────────────┬─────────────────┘
   │                                     ▼
   │                    Claude turns the result into text +
   │                    `<ui type="...">...</ui>` tags
   ◄─────────────────────────────────────┘
Streamed to the client, parsed into MessageContent[],
rendered as Svelte chat components (Form, Table, Chart, ...)
```

Two things keep this safe and fast:

- **The AI never writes to the database directly.** Every `create_*`/`update_*`/`delete_*` tool is excluded from the main chat's tool list (see `src/lib/server/ai/stream.ts`). When a write is needed, the AI returns a `form` UI component describing a dialog-launch button; the actual write happens over a plain REST call (`/api/database/[type]/records`) once the user reviews and submits the form. This keeps a human in the loop for every mutation and keeps the AI's tool surface read-mostly.
- **Not everything goes through the AI.** Purely mechanical CRUD and settings live in no-AI pages under `/database` and `/settings`. Chat is for the things that benefit from natural-language interaction (search, aggregation, drafting); direct manipulation is for everything else. "Quick actions" (the `+` button in the chat input) sit in between: they call the same read-only tools the AI would, but skip the model entirely, so common lookups don't cost tokens or round-trip latency.

## Request flow in detail

1. **`src/routes/api/chat/+server.ts`** receives the conversation history and streams the response.
2. **`src/lib/server/ai/prompt.ts`** holds `SYSTEM_PROMPT` — a single large, static prompt describing every UI component the AI can emit, with worked examples. It's split from the current date/time (which changes every request) so the static part stays eligible for Anthropic's prompt caching (see `buildSystemPrompt()`).
3. **`src/lib/server/ai/stream.ts`** calls the Claude API, filters the tool list down to non-write tools, and incrementally parses the streamed text for `<ui type="...">...</ui>` tags (`TextStreamProcessor`, `parseUITag`). Plain text becomes `delta` events; recognized tags become `ui` events carrying a typed `MessageContent`.
4. **`src/lib/server/agent-tools/`** is where each tool actually lives — a Zod input schema plus a handler function, grouped by domain (`customers.ts`, `deals.ts`, `activities.ts`, `search.ts`, `documents.ts`, `integrations.ts`, `communication.ts`, `approvals.ts` etc.). `dispatchTool(db, name, input, env?, ctx?)` is the single entry point that validates input against the Zod schema and calls the matching handler. Tools are implemented as plain in-process functions rather than a separate MCP server — this avoids a network hop for every tool call and keeps the whole request within a single Worker invocation.
5. The client (`src/routes/+page.svelte` and friends) receives the event stream, accumulates `MessageContent[]`, and renders each item with the matching Svelte component under `src/lib/components/chat/`.

## The two UI component families

- **`src/lib/components/ui/`** — the app's own design system (Textbox, Select, Table, DataGrid, charts, etc.). Used to build every hand-written page (`/database`, `/settings`, dialogs, ...).
- **`src/lib/components/chat/`** — the vocabulary the AI is allowed to speak: Form, Table, ActionSelector, Values, Gantt, Kanban, Timeline, Chart, Link, Reply, Bizcard, DocHandoff, and a couple of others. Every one of these has a documented example in `SYSTEM_PROMPT`; `src/lib/server/ai/prompt.test.ts` enforces that every UI type reachable from the main chat is actually demonstrated in the prompt, so a shipped feature can never go undiscoverable to the model.

Under the hood, both families are ordinary Svelte components — `chat/` components just happen to be driven by AI-generated props instead of hand-written ones.

## Data model

Four core entities with a fixed schema, defined with DrizzleORM in `src/lib/server/db/schema.ts`:

- **customers** — company-level records. Arbitrary extra fields live in a `custom` JSON column so users can add fields without a migration.
- **contacts** — people, linked to a customer via `customerId`.
- **deals** — opportunities linked to a customer. `status`: `open` / `won` / `lost`.
- **activities** — notes/calls/emails/meetings linked to a customer. A `deal_created` activity is added automatically whenever a deal is registered, so the activity timeline doubles as an audit trail.

Everything else (integrations, reminders, notifications, chats, email sends, accounts) hangs off these four. The record detail/edit/create UI for all four core entities is unified into a single dialog component (`src/lib/components/dialog/RecordDialog.svelte`), shared between chat, quick actions, and the `/database` list pages — so there's exactly one code path for "show/edit/create a record," no matter where the user triggered it from.

## Infrastructure

Everything runs on Cloudflare: **Workers** for compute, **D1** (SQLite) for the relational data above, **KV** for sessions and short-lived tokens (password reset, rate limiting), **R2** for generated document files, and a **Cron Trigger** (every minute) for reminder delivery.

`@sveltejs/adapter-cloudflare` can't export a `scheduled` handler alongside `fetch`, so `worker.ts` at the repo root wraps the generated `fetch` handler and adds `scheduled` itself. It imports from `.svelte-kit/cloudflare/_worker.js`, a build artifact, so `bun run build` must run before `wrangler dev`/`wrangler deploy` (see `wrangler.build.jsonc`, the adapter's build-time config, and `wrangler.toml`, the actual dev/deploy config with `main = "worker.ts"`).

## Where to look next

- `CONTRIBUTING.md` — how to propose a change and the coding conventions this project follows.
- `docs/DEPLOYMENT.md` — deploying your own instance to Cloudflare.
