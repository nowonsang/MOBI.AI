<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Team rules (shared by every contributor and every AI session)

Detailed rules live in project skills under `.claude/skills/`. Load them before working:

| Skill | Load when |
| --- | --- |
| `project-setup` | First-time setup after cloning, `.env.local` setup, onboarding a teammate, or when `npm run check:supabase` fails |
| `project-architecture` | Before adding, changing, moving, or reviewing any code |
| `add-service` | Creating a new service (domain module) |
| `secure-coding` | Touching Server Actions, Route Handlers, auth, env vars, caching, external requests, CSP, or dependencies |
| `supabase-schema` | Any database work: tables, SQL migrations, RLS, Supabase queries, auth users, storage, cleanup |
| `ui-design` | Any web UI work: pages, components, layout, styles, forms, copy, images, animation |

Non-negotiable core rules:

- Layers: `app → core → features → shared`. No imports between services (`features/a` → `features/b`). Features may use only `@/core/store/hooks` from core. Enforced by ESLint (`boundaries/*`); a PostToolUse hook lints every file you edit, so fix reported violations before moving on.
- Each service is `features/<service>/{model,server,api,ui}` + `app/(<service>)/` + `app/api/<service>/`. Follow the templates in the `add-service` skill (`SKILL.md`, `templates.md`) as the reference implementation. No barrel `index.ts` files.
- Every web UI must be responsive (mobile-first; must work at 360, 768, 1024, and 1440px with no horizontal scroll) and follow the `ui-design` skill: Hyundai-derived colors and proportions, Toss-style UX rules. Use only the design tokens in `src/app/globals.css`; hard-coded colors are ESLint errors.
- State: server data via Server Components + TanStack Query; client UI state via Redux; shareable state in the URL. Never copy server data into Redux.
- Server Actions and Route Handlers are public endpoints: validate input with zod, re-check auth inside them, return minimal DTOs. Never cache per-user data with `'use cache'`.
- Supabase (Free plan, hackathon) is shared with another live service, including API keys, auth users, and storage. All MOBI.AI database objects live in the `mobi_ai` schema; never modify `public`, `auth`, `storage`, extensions, or project settings. Access the DB only from `features/*/server` via `@/shared/supabase/admin`. Schema changes are new files in `supabase/migrations/` that must pass `npm run check:migrations`; the user runs them in the SQL Editor (never `supabase db push`). Verify connectivity only with `npm run check:supabase`.
- Done means `npm run lint`, `npm run typecheck` (and `npm run build` for structural changes) all pass. Update `README.md` when structure or rules change.
- If a structure outside these rules seems necessary, ask the user first instead of improvising.

## Sensitive files

Never read, print, copy, or edit secret files (`.env*`, private keys, credentials) or dump environment variables. They are blocked by `.claude/settings.json` and `.claude/hooks/protect-sensitive-files.mjs`; do not try to work around a block. If a value is needed, ask the user for the variable name only. Env files must be owner-only (mode 600): run `npm run secure:env` (it changes permissions without reading contents). `.claude/settings*.json` and `.claude/hooks/**` are protected guard files: AI must not modify them; ask the user to change them directly.
