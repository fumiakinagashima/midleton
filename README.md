# Midleton

An AI-first, chat-based CRM/SFA. Users give business instructions in chat, and Claude AI uses agent tools to dynamically generate forms, tables, and charts, and to drive the workflow to completion.

## Key features

- **Chat AI** (`/`) — search, aggregate, and analyze customers, deals, and tasks via the Claude API + agent tools; generates no-code UI (forms, tables, charts, Gantt charts, kanban boards, timelines, etc.) and source material for documents (CSV/Markdown)
- **Quick actions** — run read-only/aggregate tools instantly from the "+" button in the chat input, without going through the AI (no token cost)
- **Data management** (`/database`) — CRUD and custom field definitions for the core entities (customers, contacts, deals, activity history), account management, reminder management
- **Business card capture** (`/bizcard`) — extracts customer information from a business card photo using AI and registers it
- **Settings** (`/settings`) — external API integrations, email sending configuration, quick action selection, profile editing
- **Notifications & reminders** — a notification center, plus automated reminder delivery via a Cron Trigger (notification center / email / Slack)
- **Auth & permissions** — login required everywhere (full route guarding), with `general`/`admin` permission levels controlling access to admin pages and APIs

## Tech stack

| Category | Technology |
|------|------|
| Package manager | Bun |
| Frontend | SvelteKit, TypeScript |
| Validation | Zod |
| ORM | DrizzleORM |
| Infrastructure | Cloudflare (Wrangler, D1, R2, KV, Queue) |
| AI | Claude API (Anthropic); tool calling is implemented as in-app functions |
| i18n | Paraglide-JS |
| Testing | Vitest (unit), Playwright (E2E) |

## Development setup

### Prerequisites

- [Bun](https://bun.sh/) v1.x or later
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Install

```sh
git clone https://github.com/fumiakinagashima/midleton.git
cd midleton
bun install
```

### 2. Configure environment variables

Copy `.dev.vars.example` to `.dev.vars` and fill in the values you need:

```sh
cp .dev.vars.example .dev.vars
```

The minimum required setup:

```sh
ANTHROPIC_API_KEY="sk-ant-..."  # Your Anthropic API key
MOCK_AI="false"                 # Set to true to try the app with mock responses, no API key needed
```

To use email features, also set `EMAIL_PROVIDER` and the corresponding keys (`resend` / `ses` / `smtp`).

### 3. Run database migrations

Apply migrations to the local D1 database (creates a SQLite file under `.wrangler/state/`):

```sh
bunx wrangler d1 migrations apply midleton --local
```

Once migrations finish, 5 test accounts and an admin account are created automatically:

| Email | Password | Permission |
|---|---|---|
| `admin@example.com` | `password` | admin |
| `user1@example.com` – `user5@example.com` | `password` | general |

### 4. Seed demo data (optional)

To load sample customers, contacts, deals, and activities:

```sh
bun run db:seed:demo
```

### 5. Start the dev server

```sh
bun dev   # Vite + platformProxy, with HMR
```

Open `http://localhost:5173` in your browser and sign in from `/signin`.

KV and R2 are created automatically under `.wrangler/state/` for local development, so no extra setup is required.

> **Note on sending email (SMTP)**: the SMTP provider under `/settings/email` uses `cloudflare:sockets` (a workerd-runtime-only API), so it doesn't work under `bun dev` (Vite on Node.js). Use Resend or AWS SES if you need to test email locally.

### Other commands

```sh
bun run check          # Type-check (svelte-check)
bun run test:unit      # Unit tests (Vitest)
bun run test:e2e       # E2E tests (Playwright)
bun run db:studio      # Inspect the local DB with Drizzle Studio
```

## UI components

Components fall into two categories:

- **`src/lib/components/ui/`** — the app's UI (design system)
- **`src/lib/components/chat/`** — components the AI returns as no-code UI in chat responses

A live demo is available at the `/ui` route.

---

### App UI components

#### Textbox

A text input field.

```svelte
<Textbox label="Company name" bind:value={name} placeholder="Acme Inc..." required />
<Textbox label="Email" bind:value={email} type="email" error="Please enter a valid email address" />
```

| prop | type | description |
|------|----|------|
| `label` | `string?` | Label text |
| `value` | `string` (bindable) | Input value |
| `type` | `string?` | The input's `type` attribute (default `text`) |
| `placeholder` | `string?` | Placeholder text |
| `required` | `boolean?` | Shows a required marker |
| `disabled` | `boolean?` | Disabled state |
| `error` | `string?` | Error message |

---

#### Textarea

A multi-line text input.

```svelte
<Textarea label="Notes" bind:value={memo} rows={4} placeholder="Free text..." />
```

| prop | type | description |
|------|----|------|
| `rows` | `number?` | Number of rows (default `3`) |
| others | — | Same as Textbox |

---

#### Select

A native select (with a custom arrow).

```svelte
<Select label="Status" bind:value={status} options={[
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]} />
```

| prop | type | description |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | Options |
| `placeholder` | `string?` | Text shown when nothing is selected |

---

#### SearchSelect

A combobox with search. Supports keyboard navigation (↑↓ Enter Esc).

```svelte
<SearchSelect label="Country" bind:value={country} options={countryOptions} placeholder="Search or select..." />
```

| prop | type | description |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | Options |
| `placeholder` | `string?` | Placeholder text |

---

#### Toggle

An on/off switch.

```svelte
<Toggle label="Receive email notifications" bind:checked={enabled} />
```

| prop | type | description |
|------|----|------|
| `label` | `string?` | Label text |
| `checked` | `boolean` (bindable) | State |
| `disabled` | `boolean?` | Disabled state |

---

#### MultiSelect

Multi-select buttons (an alternative to checkboxes). The value is `string[]`.

```svelte
<MultiSelect label="Tags" bind:value={tags} options={[
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Partner' }
]} />
```

| prop | type | description |
|------|----|------|
| `value` | `string[]` (bindable) | Array of selected values |
| `options` | `{ value: string; label: string }[]` | Options |

---

#### SingleSelect

Single-select buttons (an alternative to radio buttons). A segmented-control look.

```svelte
<SingleSelect label="Priority" bind:value={priority} options={[
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
]} />
```

---

#### DatePicker

A date input (native `<input type="date">`).

```svelte
<DatePicker label="Contract date" bind:value={date} min="2024-01-01" />
```

| prop | type | description |
|------|----|------|
| `value` | `string` (bindable) | An ISO 8601 date string |
| `min` / `max` | `string?` | Allowed range |

---

#### TimePicker

A time input (native `<input type="time">`).

```svelte
<TimePicker label="Start time" bind:value={time} />
```

| prop | type | description |
|------|----|------|
| `value` | `string` (bindable) | `HH:MM` format |

---

#### DateTimePicker

A date/time input (native `<input type="datetime-local">`).

```svelte
<DateTimePicker label="Scheduled date/time" bind:value={datetime} />
```

| prop | type | description |
|------|----|------|
| `value` | `string` (bindable) | `YYYY-MM-DDTHH:MM` format |
| `min` / `max` | `string?` | Allowed range |

---

#### NumberInput

A numeric input (with -/+ stepper buttons). The browser's native spin buttons are hidden.

```svelte
<NumberInput label="Quantity" bind:value={qty} min={0} max={100} step={5} suffix="pcs" />
<NumberInput label="Amount" bind:value={amount} prefix="$" step={1000} />
```

| prop | type | description |
|------|----|------|
| `value` | `number` (bindable) | The numeric value |
| `min` / `max` | `number?` | Range (disables the stepper buttons at the bounds) |
| `step` | `number?` | Step size (default `1`) |
| `prefix` / `suffix` | `string?` | A unit shown before/after the value |

---

#### FileUpload

A drag-and-drop file picker.

```svelte
<FileUpload label="Attachment" accept=".pdf,.xlsx" multiple />
```

| prop | type | description |
|------|----|------|
| `accept` | `string?` | Allowed file extensions |
| `multiple` | `boolean?` | Allow selecting multiple files |

---

#### Table

A data table with sorting and pagination.

```svelte
<Table
  columns={[
    { key: 'name', label: 'Company name', sortable: true },
    { key: 'status', label: 'Status' }
  ]}
  rows={tableData}
  pageSize={10}
/>
```

| prop | type | description |
|------|----|------|
| `columns` | `{ key, label, sortable? }[]` | Column definitions |
| `rows` | `Record<string, unknown>[]` | Data |
| `pageSize` | `number?` | Rows per page (default `10`) |

---

#### Pagination

Pagination controls (also used inside Table).

```svelte
<Pagination bind:page={currentPage} totalPages={20} />
```

| prop | type | description |
|------|----|------|
| `page` | `number` (bindable) | Current page (1-indexed) |
| `totalPages` | `number` | Total number of pages |

---

#### List

A card-based list. Generic, so it accepts a type-safe snippet.

```svelte
<List items={customers} columns={3}>
  {#snippet card(c)}
    <p>{c.name}</p>
    <p>{c.contact}</p>
  {/snippet}
</List>
```

| prop | type | description |
|------|----|------|
| `items` | `T[]` | The data array |
| `columns` | `number?` | Number of grid columns (default `2`) |
| `card` | `Snippet<[T]>` | The snippet used to render each card |

---

#### DataGrid

A spreadsheet-style grid input. Move between cells with Tab/Enter.

```svelte
<DataGrid
  bind:rows={gridRows}
  columns={[
    { key: 'name', label: 'Name', width: 160 },
    { key: 'dept', label: 'Department', type: 'select', options: [
      { value: 'sales', label: 'Sales' },
      { value: 'eng', label: 'Engineering' }
    ]},
    { key: 'age', label: 'Age', type: 'number', width: 90 },
    { key: 'note', label: 'Notes', readonly: true }
  ]}
  onchange={(rows) => console.log(rows)}
/>
```

| prop | type | description |
|------|----|------|
| `columns` | `GridColumn[]` | Column definitions |
| `rows` | `GridRow[]` (bindable) | Data (`Record<string, string\|number\|null>`) |
| `addable` | `boolean?` | Show the "add row" button (default `true`) |
| `deletable` | `boolean?` | Show the "delete row" button (default `true`) |
| `onchange` | `(rows) => void?` | Change callback |

**GridColumn fields:**

| field | type | description |
|----------|----|------|
| `key` | `string` | The data key |
| `label` | `string` | Header text |
| `type` | `'text'\|'number'\|'select'?` | The cell's input type |
| `options` | `{ value, label }[]?` | Options, when type is `select` |
| `width` | `number?` | Column width (px) |
| `readonly` | `boolean?` | Not editable |

**Keyboard controls:**

| key | action |
|------|------|
| Tab / Shift+Tab | Move to the next/previous cell |
| Enter | Move to the cell below |
| Esc | Stop editing |

---


#### TypingIndicator

An animated "AI is typing" indicator (three dots).

```svelte
{#if isLoading}
  <TypingIndicator />
{/if}
```

---

### Chat UI components (`src/lib/components/chat/`)

Dynamic UI components the AI returns as part of its response. Per the system prompt's spec, the AI outputs `<ui type="...">` tags, which are parsed and rendered client-side. The full spec is centrally managed in the system prompts under `src/lib/server/ai/`.

#### Form (chat)

```
<ui type="form" title="Register customer">
[{"key":"name","label":"Company name","type":"text","required":true},{"key":"industry","label":"Industry","type":"select","options":[...]}]
</ui>
```

Field types: `text` / `email` / `number` / `textarea` / `select` / `date` / `datetime-local` / `recordSelect` (a search-select for a related record) / `hidden`

#### Table (chat)

```
<ui type="table" title="Customer list">
{"columns":[{"key":"name","label":"Company name"},...],"rows":[...]}
</ui>
```

#### ActionSelector

```
<ui type="actions" title="What would you like to do?">
[{"id":"create","label":"Register a customer","description":"Enter new customer information in a form"}]
</ui>
```

When the user picks an action, its label is sent as a chat message.

#### Other components

| component | purpose |
|------|------|
| `Values` | A key/value summary view (e.g. a health score) |
| `Gantt` | A Gantt chart of project/deal schedules |
| `Timeline` | A chronological visualization of activity history |
| `Kanban` | A kanban board (e.g. deal pipeline by stage) |
| `Link` | A link to a record. `newTab="true"` opens it in a new tab (without interrupting the conversation) |
| `Reply` | An inline reply UI for the AI to ask a question or offer choices (single-select, multi-select, or text input) |
| `Bizcard` | Business card scanning and extraction result display |
| `DocHandoff` | A download link for a document source file (CSV/Markdown) plus a prompt for an external AI tool |
| `DocumentJob` | Progress/completion status for an async document-generation job (deprecated in favor of `DocHandoff`) |

---

## Directory structure

```
midleton/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte    # Sidebar, theme switching
│   │   ├── +page.svelte      # Chat screen (/)
│   │   ├── signin/           # Sign in, password reset
│   │   ├── ui/               # UI component demo (/ui)
│   │   ├── bizcard/          # Business card capture (/bizcard)
│   │   ├── settings/         # Settings (/settings, /settings/integrations, /settings/quick-actions, /settings/email, /settings/account)
│   │   ├── database/         # Data management (/database, /database/[type], /database/accounts, /database/reminders, etc.)
│   │   └── api/
│   │       ├── chat/         # Chat API endpoint
│   │       ├── auth/         # Sign in, sign out, password reset
│   │       ├── bizcard/      # Business card image → Claude vision → JSON extraction
│   │       ├── integrations/ # External API integration CRUD
│   │       ├── quick-actions/# Quick action execution
│   │       ├── database/     # Data management REST API (table info, record CRUD)
│   │       ├── documents/    # Document generation jobs
│   │       ├── reminders/    # Reminder delivery
│   │       ├── notifications/# Notification center
│   │       └── email/        # Sending email, email settings
│   └── lib/
│       ├── components/
│       │   ├── ui/           # App UI components (design system)
│       │   ├── chat/         # Components the AI returns as a response
│       │   ├── dialog/       # The central detail/edit/create dialogs (shared between chat and /database)
│       │   ├── database/     # Components specific to the data management pages
│       │   ├── icon/         # SVG icon components
│       │   └── bizcard/      # Business card scanning components
│       ├── quick-actions/    # Quick action catalog definitions
│       ├── server/
│       │   ├── db/           # DrizzleORM schema and queries
│       │   ├── agent-tools/  # Agent tool definitions
│       │   ├── ai/           # Claude API integration and system prompts
│       │   ├── auth/         # Session and password hashing
│       │   ├── documents/    # Document source file generation, R2 storage
│       │   ├── reminders/    # Reminder delivery
│       │   ├── email/        # System email sending
│       │   ├── slack/        # Slack Incoming Webhook sending
│       │   └── quick-actions/# Quick action execution and formatting
│       ├── styles/           # Global styles, theme
│       └── types/            # Shared types
├── messages/                 # i18n resources (en.json, ja.json)
├── drizzle/                  # Migration files
├── docs/
│   └── DEPLOYMENT.md
├── worker.ts                 # Cloudflare Workers entry point (with Cron Trigger support)
├── wrangler.toml
└── wrangler.build.jsonc
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a deeper look at how the pieces fit together, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development conventions this project follows.

## Theme

Light, dark, or system (follows the OS setting) — toggle with the switch at the bottom of the sidebar. Tokens are defined as CSS custom properties (`--color-*`) and switched via the `data-theme` attribute.

## i18n

English (`messages/en.json`) is the default language; a Japanese translation (`messages/ja.json`) is also included. Strings are referenced in code via `m.key()` (Paraglide-JS).

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deploying to Cloudflare via GitHub integration.
