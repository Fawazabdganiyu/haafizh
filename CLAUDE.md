# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Rules

- Do NOT add pagination, extra features, or refactors beyond what was explicitly requested. Keep changes minimal and scoped to the ask.

## Git Workflow

- Always target `dev` branch for PRs and merges — use `gh pr create --base dev`. Never target `main` unless explicitly told.
- Never delete git worktree directories directly. Use `git worktree remove <path>` from outside the worktree to avoid breaking the shell session.

## Testing

- Run targeted backend tests from the api directory: `cd apps/api && npx jest --testPathPattern="<pattern>" --no-coverage`
- `pnpm --filter api test -- --testPathPattern=<x>` mangles args in worktrees — use the `cd apps/api && npx jest` form instead.
- In test files, use `as unknown as T` double-cast to access private members — never `as any` and never eslint-disable comments to suppress `no-explicit-any`.
- When using `jest.spyOn`, always add `afterEach(() => jest.restoreAllMocks())` in the same describe block to prevent cross-test mock leakage.
- Frontend (Vitest): `@testing-library/user-event` is **not installed** — use `fireEvent` from `@testing-library/react` for click/interaction tests.
- When mocking `useQuery`/`useMutation` by GraphQL operation name in Vitest, don't assume `document.definitions[0]` is the operation — a query built with an interpolated fragment (`${SOME_FIELDS}`) puts the FragmentDefinition first. Find it via `definitions.find(d => d.kind === "OperationDefinition")`.
- **Manual browser QA**: fresh signups block login on email verification (no local inbox access to the token) — bypass with `psql ... -c "UPDATE users SET \"isEmailVerified\" = true WHERE email = '...'"` on the local dev DB. Same for testing org features: `UPDATE users SET tier = 'PRO' WHERE email = '...'`. Clean up test users/orgs/contacts afterward.
- **Browser pane clicks**: the screenshot image is scaled down from the actual viewport (e.g. 800×455 image for a 1280×720 viewport) — clicking raw screenshot pixel coordinates lands in the wrong place. Use `ref` from `read_page`/`find` instead of coordinates whenever possible.

## TypeScript Checks

- `pnpm typecheck` runs `tsc --noEmit` across both apps via Turbo. Use it for full-monorepo type validation.

## TanStack Router — Typed Search Params

- Routes with `validateSearch` (e.g. `/pricing`, `/transactions`) require all search params to be passed explicitly in `<Link search={{ ... }}>`. Omitting `search` is a TypeScript error. Use `search={{ param: undefined }}` when no value is needed.

## TanStack Router — Typed Params (Dynamic Segments)

- Never build a dynamic-segment href via string interpolation: `<Link to={`/org/${slug}/members` as never}>` updates the URL bar correctly and the route matches, but `Route.useParams()` comes back `undefined` on the resulting *client-side* transition (a hard reload works fine since it re-parses the URL through route matching from scratch). Always use `<Link to="/org/$slug/members" params={{ slug }}>` instead.
- Same applies to `navigate({ to: ... })` — pass `params`, never a pre-built path string.
- This holds even for a fully-resolved concrete path (e.g. a server-generated string like `/transactions/abc-123`, not just a visibly-interpolated template) — confirmed via a live bug where `navigate({ to: someResolvedPath as never })` left `Route.useParams()` undefined and broke the destination page's query. Don't rationalize an exception for "it's already resolved" — always route dynamic segments through `params`.

## Pre-commit Hook Auto-formats Files

- lefthook runs `api-format` (Prettier) and `web-biome` on staged files. If you get "file has been modified since read" on a second edit to the same file, the formatter ran between edits — re-read the file before editing again.

## HMR Artifacts on Root-Level Providers

- Editing a provider mounted once at the app root (e.g. `OrgProvider` in `__root.tsx`) across several edits in one dev session can leave Vite's Fast Refresh in a state where React logs "useEffect deps array changed size between renders" — a stale-fiber HMR artifact, not a real bug. If this warning won't go away after a code change you're confident is correct, restart the dev server (not just the browser) before debugging further.

## Configuration Changes

- Before modifying any config (lefthook, Atlas, CI, lint-staged), read the existing config files first. Never assume defaults.

## Apollo Client — One Watcher Per Query

- Don't run a second `useQuery()` for a query that's already watched elsewhere (e.g. in a context provider) "just to get a local refetch handle." Two independent watchers for the same query can observe different cache snapshots during a race window (one's background refetch hasn't landed when the other's `cache-first` read fires) — this caused an intermittent false "not found" earlier. Read state from the existing context/hook instead, and expose its `refetch` if a consumer needs to trigger one.

## UI Components — radix-ui Package

- Newer shadcn components (e.g. `progress.tsx`) import from the unified `radix-ui` meta-package (`import { X as XPrimitive } from "radix-ui"`) instead of per-primitive `@radix-ui/react-x` packages. Check an existing component's import style before adding a new `@radix-ui/react-*` dependency — it's likely already covered.

## Quick Start

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers (backend + frontend) |
| `pnpm build` | Build all apps |
| `pnpm lint` / `pnpm lint:fix` | Run linting |
| `pnpm format:fix` | Format code |
| `pnpm test` | Run all tests |
| `pnpm --filter api dev` | Backend only |
| `pnpm --filter web dev` | Frontend only |
| `pnpm --filter api db:generate` | Generate Prisma client |
| `pnpm --filter api test:watch` | Run tests in watch mode |

### Environment Setup

**Backend** (`apps/api`):
- Copy `.env.example` to `.env`
- Key vars: `DATABASE_URL`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `MAILTRAP_TOKEN` or `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `EXCHANGE_RATE_API_KEY`

**Frontend** (`apps/web`):
- Copy `.env.example` to `.env.local`
- Key var: `VITE_API_URL`

## Project Architecture

### Monorepo Structure

```
wathiqah/
├── apps/
│   ├── api/          # NestJS GraphQL Backend (port 3001)
│   └── web/          # TanStack Start Frontend (port 3000)
├── packages/         # Shared TypeScript types
└── turbo.json        # Turborepo config
```

### Tech Stack

- **Backend**: NestJS + GraphQL (Code First) + Prisma 7 (PostgreSQL) + JWT
- **Frontend**: TanStack Start (React 19) + TanStack Router + Apollo Client + Shadcn UI + Tailwind CSS
- **Package Manager**: pnpm 10 with workspaces
- **Build System**: Turbo 2
- **Linting**: Biome (frontend), ESLint (backend)

### Key Principles

1. **Strict TypeScript** - No `any` types allowed. Use specific interfaces or generated types.
2. **Standardized Monetary Inputs** - Always use the `useAmountInput` hook for amount/monetary fields in the frontend to ensure consistent real-time formatting and decimal support.
3. **Module-based Architecture** - Each feature is a self-contained module in `src/modules/`
4. **Separation of Concerns**:
   - Resolvers handle GraphQL queries/mutations
   - Services contain business logic
   - Entities define GraphQL schema
   - DTOs validate input data

## Critical Business Logic

### AssetCategory Enum

All code should use the `AssetCategory` enum instead of hardcoded strings:

**Backend** (`apps/api/src/generated/prisma/enums.ts`):
- `AssetCategory.FUNDS` (value: `'FUNDS'`): For monetary transactions
- `AssetCategory.ITEM` (value: `'ITEM'`): For physical items

**Frontend** (`apps/web/src/types/__generated__/graphql.ts`):
- `AssetCategory.Funds` (value: `'FUNDS'`): For monetary transactions
- `AssetCategory.Item` (value: `'ITEM'`): For physical items

**Note**: Do not use hardcoded strings like `"FUNDS"` or `"ITEM"` in comparisons. Always use the enum values from `AssetCategory`.

### Transaction Types & Color Coding

12 self-describing formal types replace the old ambiguous ones:

| Type | Meaning | Color | Contact-standing sign |
|------|---------|-------|-----------------------|
| `LOAN_GIVEN` | I lent money out | Blue | + (contact owes me) |
| `LOAN_RECEIVED` | I borrowed money | Rose | − (I owe contact) |
| `REPAYMENT_MADE` | I repaid a debt (cash out, debt-clearing) | Emerald | + (reduces my debt) |
| `REPAYMENT_RECEIVED` | Contact repaid me (cash in, debt-clearing) | Emerald | − (reduces their debt) |
| `GIFT_GIVEN` | Gift I gave | Pink | _(no obligation)_ |
| `GIFT_RECEIVED` | Gift I received | Purple | _(no obligation)_ |
| `ADVANCE_PAID` | Advance I paid out | Orange | + (contact owes goods/money) |
| `ADVANCE_RECEIVED` | Advance I received | Purple | − (I owe goods/service) |
| `DEPOSIT_PAID` | Deposit I paid | Orange | + (contact owes it back) |
| `DEPOSIT_RECEIVED` | Deposit I received | Purple | − (I owe it back) |
| `ESCROWED` | Cash I'm holding | Emerald | − (I owe disbursement) |
| `REMITTED` | Cash I disbursed | Orange | + (I paid on their behalf) |
| `EXPENSE` | Personal expense _(legacy, read-only)_ | — | — |
| `INCOME` | Personal income _(legacy, read-only)_ | — | — |

**Note**: Use `AssetCategory.FUNDS` and `AssetCategory.ITEM` when referencing categories in code.

**TransactionType enum active values**: the 12 types above. `EXPENSE`/`INCOME` remain in the DB enum for existing rows but new creation is blocked via `@IsNotIn` guard — a follow-up PersonalEntry plan will migrate them.

- `Transaction.amount` is `Decimal?` — always use `.toNumber()` with a null guard (e.g. `?.toNumber() ?? 0`)
- There is no `returnDirection` field. Direction is encoded in the type name itself.

### Shared Ledger & Perspective Flipping

When a transaction's contact is a registered user (`linkedUserId`):
- The transaction is visible to both parties
- Perspectives flip via `PERSPECTIVE_FLIP_MAP` in `transactions.service.ts`:
  - `LOAN_GIVEN ↔ LOAN_RECEIVED`
  - `REPAYMENT_MADE ↔ REPAYMENT_RECEIVED`
  - `GIFT_GIVEN ↔ GIFT_RECEIVED`
  - `ADVANCE_PAID ↔ ADVANCE_RECEIVED`
  - `DEPOSIT_PAID ↔ DEPOSIT_RECEIVED`
  - `ESCROWED ↔ REMITTED`

### Witness System

- **States**: `PENDING` → `ACKNOWLEDGED` \| `DECLINED` \| `MODIFIED`
- **No Deletion**: Transactions with witnesses cannot be deleted; mark as `CANCELLED` instead
- **Status Reset**: Updating an `ACKNOWLEDGED` transaction resets all witnesses to `MODIFIED`
- See `WITNESS_SYSTEM.md` for full details

### Balance Logic

- **Net Balance (contact-obligation)**: Computed by `computeNetBalance()` in `transactions.service.ts` using all 12 new types. EXPENSE/INCOME are excluded from this computation. Formula: `(LOAN_RECEIVED − LOAN_GIVEN) + (REPAYMENT_RECEIVED − REPAYMENT_MADE) + (GIFT_RECEIVED − GIFT_GIVEN) + (ADVANCE_RECEIVED − ADVANCE_PAID) + (DEPOSIT_RECEIVED − DEPOSIT_PAID) + (ESCROWED − REMITTED)`
- **Contact Standing**: Computed via `CONTACT_STANDING_SIGN` in `contacts.service.ts`. GIFT types are excluded (no ongoing obligation). Positive = contact owes me, negative = I owe contact.
- **Sign convention warning**: Net Balance and Contact Standing use *opposite* sign conventions for the same transaction types (confirmed against `transactions.balance.spec.ts`) — e.g. `LOAN_GIVEN` makes Contact Standing positive (contact owes me) but makes Net Balance *negative*. Don't assume the two move together; check the existing test suite before asserting an expected value for either.
- **Cash Position (Dashboard)**: Displayed as a dedicated stat card in `components/dashboard/Dashboard.tsx` alongside Total Balance, Inflow, and Outflow. Sourced from `PersonalEntriesTab` cash position computation — not from transaction types.
- **Project Balance**: `project.balance` = `totalIncome − totalExpenses` — `totalIncome`/`totalExpenses` are `@ResolveField` on `Project`, unrelated to transaction types above.

### Dashboard Stat Cards

`components/dashboard/Dashboard.tsx` is the single unified dashboard for both personal and org mode (`isOrgMode` from `useOrgContext()`). The financial stats row differs by mode:

**Personal mode** — exactly 4 cards:
1. **Total Balance** — net contact-obligation balance, always all-time
2. **Cash Position** — personal income minus expenses (sourced from Personal Entries — no org equivalent exists)
3. **Inflow** — period-filtered inflows
4. **Outflow** — period-filtered outflows

**Org mode** — exactly 3 cards (no Cash Position — it's explicitly personal-only data, hiding it avoids showing the admin's own personal finances on what's meant to be the org's view): Total Balance, Inflow, Outflow.

Do not add a fifth card or duplicate Cash Position in personal mode, and do not show Cash Position in org mode. Layout: Total Balance (and Cash Position, in personal mode) span full width below `lg`; Inflow and Outflow are always side-by-side. The grid is `lg:grid-cols-4` in personal mode, `lg:grid-cols-3` in org mode.

### Org-Scoped vs Personal-Only Features

Backend resolvers that accept `@ActiveOrg() orgId: string | null` (Transactions, Contacts, Promises, Projects) automatically scope to the active org's data when an org JWT is present, and to the user's personal data otherwise — **same route, same query, no frontend branching needed**. The "Activity Stats" row's Promises/Contacts counts on the dashboard already reflect this correctly with zero extra logic.

Features with **no org-scoping at all** (always the individual user's own data, regardless of active org): Witness requests, Personal Entries (Cash Position), Personal Notes. These either have no org equivalent (Cash Position, Personal Notes — org notes live under the separate Events & Notes page) or are intentionally personal action items shown in both modes (Witnesses).

`Header.tsx`'s nav dropdowns (desktop) and `mobile-bottom-nav.tsx` (mobile) must stay aligned on this: Transactions/Ledger, Contacts, Promises, Projects, and Witnesses are reachable in both modes; personal Notes is hidden in org mode; Events & Notes/Members/Org Settings are org-mode-only (desktop: dedicated "Organisation" dropdown; mobile: primary tabs).

**Checklist when adding org-membership access control to a resource**: it's not enough to scope the *list* query by `orgId` — grep every other method on that service (`findOne`, `update`, `remove`, and sub-actions like `addWitness`) for a stale creator-only check, and check every *indirect* caller too (e.g. `ProjectContactLinkService` wrapping `TransactionsService`). A resource that lists correctly for all org members but 403s on open/edit/delete for non-creators is the signature of this gap — caught by ultrareview after the fact in the shared-contacts PR, not by initial implementation or tests.

### Personal Notes (`/notes` route)

Route: `apps/web/src/routes/notes.tsx`. Backend module: `apps/api/src/modules/notes/`.

**Purpose**: A personal journal — users document anything they want: important events, life milestones, activities, or day-to-day happenings. Not limited to transactions or financial activity. Think of it as a general-purpose life tracker the user owns.

- Fields: optional `title`, required `body`, optional `category`
- Free tier: 5 notes lifetime max (checked against DB count via `@CheckFeature('maxNotes')` on `createNote` resolver). UI shows usage indicator and disables the form with an upgrade prompt at the limit.
- Pro tier: unlimited (`maxNotes: -1` in `subscription.constants.ts`)
- Nav placement: Header "Network" dropdown (desktop) and mobile More sheet
- The limit field is `maxNotes` in both `TierLimits` interface and `SUBSCRIPTION_LIMITS` — not `maxNotesPerMonth` (that name is stale and does not exist)

### Org Notes (`/org/:orgId/notes` route)

**Purpose**: Same journal concept as personal notes but scoped to a specific organisation — members document anything relevant to that org: operational events, decisions, activities, or context about that organisation's work.

The org notes `title` field (`string?`) is wired end-to-end:
- Backend DTO: `CreateNoteInput` and `UpdateNoteInput` both declare `title?: string`
- Backend entity: `Note` entity exposes `title` as an optional `@Field`
- Backend service: `createNote` and `updateNote` both pass `title: input.title`
- Frontend: `NoteFormValues` includes `title?: string`; edit pre-populates `title`; `note-entry.tsx` renders the title conditionally when present

### Shared Access — Purpose and Gating

**Intent**: Legacy/estate access — users pre-grant trusted contacts (family, executors) read-only access to their records so those records can be reviewed if the user is deceased or incapacitated.

**Gate rules**:
- Granting access (`grantAccess`) → **free**, no subscription check
- Accepting a grant (`acceptAccess`) → **free**, no subscription check
- Viewing records (`getSharedData` → `sharedData` query) → **viewer must be Pro**

**Implementation** (`shared-access.service.ts`, `getSharedData`): after verifying the grant is `ACCEPTED` and the caller is the correct recipient, look up the viewer's user record by email and check `viewer.tier !== SubscriptionTier.PRO`. Throw `ForbiddenException('You need a Pro subscription to view shared records.')` if not Pro. The granter's tier is irrelevant.

**Frontend locked state** (`routes/shared-access/view.$grantId.tsx`): detects `error.message.includes('Pro subscription')`, shows heading "Pro subscription required" with viewer-centric body copy and an "Upgrade to Pro" CTA linking to `/pricing` (with `search={{ reason: undefined }}`).

### Subscription Tier Check Pattern

**For checking the authenticated caller's features**: use `@CheckFeature('featureName')` decorator on the resolver method. This is the standard path.

**For checking a *different* user's tier** (e.g. checking the granter's or viewer's subscription in shared-access scenarios): do NOT use `@CheckFeature`. Instead, look up that user inline in the service method:
```ts
const user = await this.prisma.user.findUnique({
  where: { id: userId },   // or { email }
  select: { tier: true },
});
if (!user || user.tier !== SubscriptionTier.PRO) {
  throw new ForbiddenException('...');
}
```
`@CheckFeature` always operates on the authenticated caller — using it for cross-user tier checks is wrong.

### Subscription Feature Limit Patterns

Two check patterns exist in `SubscriptionService.checkFeatureLimit` (`apps/api/src/modules/subscription/subscription.service.ts`):

- **DB-count** (`maxContacts`, `maxNotes`): counts actual Prisma rows. `incrementFeatureUsage` skips these (no counter). Add a special-case block in `checkFeatureLimit` to implement a new one.
- **Monthly counter** (`maxWitnessesPerMonth`, `contactNotificationSms`): tracked in `featureUsage` JSON with key `${feature}_${year}_${month}`. `incrementFeatureUsage` bumps these automatically. New monthly-counter features work without any special-casing.

### Admin Console

Role-gated platform administration surface. Backend module: `apps/api/src/modules/admin/`. Frontend route: `apps/web/src/routes/admin/` (Overview, Users, Subscriptions, Audit Log), gated by `isPlatformAdmin(user.role)` (`apps/web/src/utils/auth.ts`).

**Roles** (`UserRole` enum: `USER`, `ADMIN`, `SUPER_ADMIN`):
- Read queries (`adminUsers`, `adminUser`, `adminStats`, `adminAuditLogs`) and PRO provisioning (`provisionPro`/`deprovisionPro`) — open to `ADMIN` and `SUPER_ADMIN`.
- `setUserRole` — `SUPER_ADMIN`-only. `SUPER_ADMIN` cannot be assigned via this mutation (reserved for the bootstrap account), and a target who is already `SUPER_ADMIN` cannot be demoted through it either — closes a self-lockout path the frontend-only guard didn't cover.
- `AdminResolver` carries a class-level `@Roles(ADMIN, SUPER_ADMIN)` as a safety net: `RolesGuard` lets any authenticated user through a handler with no `@Roles` metadata, so a future undecorated method would otherwise be open platform-wide.

**Audit log**: every mutation (`provisionPro`, `deprovisionPro`, `setUserRole`) writes an `AdminAuditLog` row (`actorId`, `AdminAction` enum, `targetUserId`, optional `metadata` JSON) in the same `$transaction`/`Promise.all` as the mutation itself — never as a fire-and-forget follow-up call.

**Pagination**: shared `PaginationInput` (`apps/api/src/common/dto/pagination.input.ts`) validates `page >= 1` and `1 <= limit <= 100` via `class-validator`; `getPrismaSkip(page, limit)` computes Prisma `skip`. GraphQL `defaultValue` only covers an omitted arg — `adminUsers`/`adminAuditLogs` explicitly guard against `filter: null` too.

**Search**: `AdminUsersFilterInput.search` matches against email/first/last name via case-insensitive `contains`; `%`/`_` are escaped so they match literally instead of acting as SQL wildcards.

**Header nav placement**: the "Admin" link lives inside the account dropdown (`apps/web/src/components/auth/header-user.tsx`), not the top-level nav — a standalone `Admin` NavLink overflowed org mode's wider header (extra "Organisation" dropdown) and visually collided with the account switcher. Mobile already treated Admin as a secondary action (in the "More" sheet); desktop now mirrors that.

### TanStack Router — Route Registration

`apps/web/src/routeTree.gen.ts` is **auto-generated** by the TanStack Router dev server. When adding a new route file without running the server, TypeScript will error: `Argument of type '"/new-route"' is not assignable to parameter of type 'keyof FileRoutesByPath'` in many places. Fix: run `pnpm --filter web dev` briefly — it regenerates the file within seconds of startup. Never edit `routeTree.gen.ts` manually.

### GraphQL Schema Generation

- `apps/api/src/schema.gql` is **auto-generated at runtime** when NestJS starts — do NOT edit it manually.
- After adding or changing `@Field()` decorators, run `pnpm --filter api dev` once to regenerate `schema.gql`. Kill it as soon as the server prints "Nest application successfully started".
- After regenerating `schema.gql`, run `pnpm --filter web codegen` to regenerate `apps/web/src/types/__generated__/graphql.ts`.
- Commit both `schema.gql` and `graphql.ts` together — a stale `schema.gql` in the repo will break CI codegen validation even if the backend code is correct.
- Frontend codegen reads from `../api/src/schema.gql` — see `apps/web/codegen.ts`.

## Backend Conventions

### HTTP Controllers & Auth
- HTTP controllers are **unauthenticated by default** — auth is GraphQL-only via `GqlAuthGuard`; no `@Public()` decorator exists or is needed
- NestJS global prefix is `/api` — all HTTP routes are under `/api/`, critical when constructing webhook URLs

### Notifications
- `SubscriptionModule` is `@Global()` — `SubscriptionService` is injectable anywhere without adding it to module imports
- BullMQ queue name is `'notifications'`; see `NotificationsProcessor` for existing job patterns
- Format currency amounts with `getLocaleForCurrency` + `Intl.NumberFormat` — never concatenate raw ISO codes (e.g. `"NGN"`)
- Two separate SMS gates: `allowSMS` (witness invite SMS — boolean, Pro only) and `contactNotificationSms` (contact notification SMS sent when a witness verifies a transaction — monthly counter, 10/month free, unlimited Pro). These gate independent code paths and are not redundant.

### Database Migrations

**Atlas is the only migration tool.** Never use `prisma migrate dev`, `prisma migrate deploy`, or any Prisma migrate command — they are disabled. All schema changes go through Atlas.

#### Normal workflow (covers 95% of cases)
1. Edit `apps/api/prisma/schema.prisma`
2. `pnpm --filter api db:generate` — regenerates the Prisma client
3. `pnpm --filter api db:migrate` — Atlas diffs schema.prisma against the DB and **auto-generates** both the migration SQL file and the updated `atlas.sum`. Do not write migration SQL manually.
4. `pnpm --filter api db:apply` — applies the migration locally. Verify zero errors before continuing.
5. Commit `apps/api/atlas/migrations/<timestamp>.sql` and the updated `apps/api/atlas/migrations/atlas.sum` together. Never commit one without the other.

#### Rules
- **Never use `atlas migrate set`** to mark a migration as applied unless every SQL statement in that file has already been executed. Marking without running causes silent schema drift — missing columns crash the app on startup.
- **Do not run `db:apply` on production manually** — CI applies migrations automatically via `.github/workflows/ci-atlas.yaml` on merge to `main`.
- **FK constraints must use `NOT VALID`**: `ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID` followed by `ALTER TABLE ... VALIDATE CONSTRAINT ...`. `db:migrate`'s auto-generated SQL never adds this automatically, even for a brand-new nullable FK column — check every generated migration by hand before committing.
- Atlas requires `atlas login` (browser-based); token expires periodically.
- **Checksum mismatch** on `db:migrate`/`atlas migrate status` (e.g. "X.sql was added... checksum mismatch"): `atlas.sum` is out of sync with files already in `atlas/migrations/` (usually from a merge). Fix with `atlas migrate hash --dir file://atlas/migrations` — recomputes hashes only, applies nothing.
- **`db:migrate` can bundle in unrelated drift**: if the generated SQL touches tables you didn't change (seen on `contacts`, `notes`, `org_events`, `org_subscriptions`, `organisation_members`, `projects`, `promises`, `transactions` — FK `ON DELETE` behavior drifts from committed schema), that's pre-existing DB drift, not your change. Trim the generated `.sql` to your actual diff before `atlas migrate hash`/`db:apply`.
- **Worktrees**: if two worktrees both run `db:migrate`, each generates its own migration file with its own timestamp. They will conflict when merged. Coordinate: only one worktree should generate a schema-changing migration at a time, or rebase and re-generate after merging the other.

#### Special case: removing a PostgreSQL enum value

PostgreSQL does not support `ALTER TYPE ... DROP VALUE`. Atlas will error with "reordering enum value is not supported" if you auto-generate a migration that removes enum values. This is the **only** case where you write migration SQL manually:
1. Write the SQL by hand (see `20260403120000.sql` as a reference):
   - `CREATE TYPE foo_new AS ENUM (...)` with only the desired values
   - `ALTER TABLE ... ALTER COLUMN type TYPE foo_new USING type::text::foo_new`
   - `DROP TYPE foo_old; ALTER TYPE foo_new RENAME TO foo_old;`
2. Run `atlas migrate hash --dir file://atlas/migrations` from `apps/api/` to rehash `atlas.sum` — CI will fail with a checksum mismatch if you skip this.
3. Do NOT write migration SQL manually for any other reason — let `db:migrate` generate it.

#### PostgreSQL column naming

Prisma uses **camelCase** column names by default (without `@map`). When writing raw SQL in migrations, use the Prisma field name directly: `"returnDirection"` not `"return_direction"`, `"previousState"` not `"previous_state"`. Check the initial migration SQL (`20260224181022.sql`) if unsure.

#### Diagnosing schema drift
If the app crashes with `column X does not exist` or `relation X does not exist` despite Atlas reporting all migrations applied:
1. Run `atlas migrate status --env local` to confirm Atlas thinks everything is applied
2. Query the DB directly (`psql ... -c "SELECT column_name FROM information_schema.columns WHERE table_name='...' AND column_name='...'"`) to check what's actually there
3. For each missing object, find the migration that creates it and run that SQL directly via `psql`
4. Do **not** re-run `atlas migrate set` — the revision table already has the entry; only the actual DB object is missing

### Project Fund Balance Semantics
- `project.balance` = `totalIncome − totalExpenses` (net cash position, not a budget figure)
- **Budget remaining** = `budget − totalExpenses` — never `budget − balance`, which incorrectly factors in income
- `totalIncome` and `totalExpenses` are `@ResolveField` on `Project`; always include them in fragments when budget analytics are needed

### ESLint
- `@typescript-eslint/no-explicit-any` is enforced — use `unknown` or double-cast (`as unknown as T`) in tests, never `as any`

## AI Development Workflow

This project uses an AI-driven development process:

- **PRs target `dev`**, not `main` — always use `gh pr create --base dev`
- **Primary IDE**: Zed IDE with Google Gemini AI
- **Claude models**: Primary driver for complex architectural decisions and logic
- **Gemini AI**: Rapid exploration and large-scale context understanding
- **No Placeholders**: Never use TODOs or placeholders in production code
- **Context-Aware**: Agents receive Prisma schemas, GraphQL definitions, and file diffs before coding

See `AGENTS.md` for full details.

## Reference Files

- `README.md` - Project overview and user-facing documentation
- `ARCHITECTURE.md` - Detailed architecture and folder structures
- `AGENTS.md` - AI development rules and workflow
- `WITNESS_SYSTEM.md` - Witness system feature documentation
- `apps/api/prisma/schema.prisma` - Database schema
- `apps/web/src/router.tsx` - Frontend routing configuration
