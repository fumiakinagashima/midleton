# Contributing

Thanks for your interest in Midleton. This document covers the conventions the codebase follows, so a change fits in without a lot of back-and-forth in review.

## Getting set up

See the "Development setup" section of [`README.md`](README.md). In short: Bun, `bun install`, copy `.dev.vars.example` to `.dev.vars`, run migrations locally with `wrangler d1 migrations apply midleton --local`, then `bun dev`.

Useful commands while working:

```sh
bun run check          # Type-check (svelte-check)
bun run test:unit      # Unit tests (Vitest)
bun run test:e2e       # E2E tests (Playwright)
bun run db:studio      # Inspect the local DB with Drizzle Studio
```

## Project layout

See the "Directory structure" section of [`README.md`](README.md) for the full tree, and [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit together at runtime.

## Coding conventions

- **UI components** live under `src/lib/components/`: the app's own design system in `ui/`, components the AI returns in chat responses in `chat/`, the shared record detail/edit/create dialogs in `dialog/`, data-management-only components in `database/`, and SVG icons in `icon/`.
- **New SVG icons** are added as their own Svelte component under `src/lib/components/icon/` (props: `size?: number; class?: string`, with `aria-hidden="true"`) — never inline an SVG directly in a template.
- **Component styles** use `<style lang="scss">`, and SCSS nesting is welcome. Dynamic values go through Svelte's `style:property={value}` directive rather than a `style="..."` attribute string. Status-dependent colors etc. that can be expressed statically should be CSS classes instead (e.g. `class="status-badge status-{status}"`).
- **Hardcoded constants** (poll intervals, max lengths, default page sizes, etc.) belong in `src/lib/constants.ts`, not scattered through call sites.
- **List views** (the chat `chat/Table.svelte` and the `/database/[type]` list pages) paginate client-side using `LIST_PAGE_SIZE` (in `constants.ts`; reuses `ui/Pagination.svelte`, hidden when the count doesn't exceed the page size).
- The chat `link` component supports `newTab="true"` (renders `target="_blank" rel="noopener noreferrer"`) — use it for links to a referenced record so the link doesn't interrupt the conversation.
- **Schema changes** always go through a Drizzle migration — never touch D1 directly, and avoid depending on D1-specific APIs so the project stays portable to another SQLite-compatible backend later.
- **Multi-table/multi-record writes** (creating, editing, or deleting more than one row atomically) use `db.batch([...])`. DrizzleORM's D1 driver supports `db.transaction()` (BEGIN/COMMIT) locally under Miniflare, but it errors in production D1 — don't use it. Note that `batch()` needs every query built up front; it can't branch mid-batch based on an earlier query's result.
- **Agent tools** live in `src/lib/server/agent-tools/`, validated with Zod. Zod schema variables use the naming convention `camelCase` + `Schema` suffix (e.g. `createCustomerInputSchema`).
- **Secrets** (API keys, etc.) go in Cloudflare environment variables/secrets — never hardcode them. A tool handler that needs access to `platform.env` receives it through `dispatchTool`'s optional `env` argument (see `send_email` for an example).
- **AI system prompts** are centrally managed under `src/lib/server/ai/`. When you add a new chat UI component type (a new `<ui type="...">` value), you must add a worked example to `SYSTEM_PROMPT` in `src/lib/server/ai/prompt.ts` — `src/lib/server/ai/prompt.test.ts` enforces that every UI type reachable from the main chat has one. Skipping this means the AI has no way to know the feature exists and may incorrectly tell the user it isn't supported.
- **Enter-to-submit inputs**: when a `keydown` handler treats Enter as submit/confirm, guard it with `if (event.isComposing) return` so committing an IME (Japanese, etc.) composition with Enter doesn't fire it by accident. See the chat input's `handleKey` or the sidebar history rename input's `handleRenameKeydown` for the pattern.
- **Dates and times**: the app treats all business timestamps as JST (`Asia/Tokyo`), while Cloudflare Workers always run in UTC — this is an easy thing to get wrong, so double-check it on any date/time code:
  - An `<input type="datetime-local">` value (`"YYYY-MM-DDTHH:mm"`) passed to `new Date(value)` is interpreted in the **server's local time zone (UTC)**, which is off by several hours from JST. Use `parseJstDatetime` from `src/lib/datetime.ts` (it appends an explicit `+09:00`) instead.
  - An `<input type="date">` value (`"YYYY-MM-DD"`, date only) passed to `new Date(value)` is interpreted as **UTC midnight** per the ISO 8601 spec. If you mean JST midnight, append `T00:00:00+09:00` explicitly before parsing (or `T23:59:59+09:00` for end-of-day); see `src/lib/server/ai/briefing.ts` for an example.
  - For display formatting or comparing JST times, use `formatJstDateTime` / `toJstDatetimeLocal` / `getJstHourMinute` from `src/lib/datetime.ts`.

## Git

- Commit messages in English.
- Don't add a `Co-Authored-By` line or similar.

## Pull requests

- Keep changes focused — a bug fix shouldn't carry along an unrelated refactor.
- Run `bun run check` and `bun run test:unit` before opening a PR.
- If your change is user-visible, a screenshot or short clip helps a lot.
