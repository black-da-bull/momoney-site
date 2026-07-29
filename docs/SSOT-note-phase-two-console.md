# SSOT note — Maestro Phase Two console: what it consumed, what it proposes

**Rung:** proposed · **Raised:** 2026-07-29 · **From:** the code repo `momoney-site`
(apps/console), first slice of the console build.
**Destination:** `D:\maestro-on-mosaic\_PROVENANCE\` (ledger + state), and the design
workspace's `_export-to-SSOT/` if mirrored there. This file is the export artifact —
carry it; do not re-author it.

## What the console consumed (verbatim, no reinterpretation)

- **`MAESTRO_v0.md`** (operator's Downloads, 2026-07-29) — committed verbatim at
  `apps/console/soul/MAESTRO_v0.md`; it is the literal system prompt. Any future edit
  to the soul is an operator act on that file, not a code change.
- **CONSOLE lane tokens** — the 12 `:root` custom properties from
  `momoneystudios.com/maestro/{lander,maestro}.html`, copied verbatim (source comments
  preserved) into `apps/console/src/app/globals.css` and
  `packages/design/tokens/console.css`. Zero label DS tokens on console surfaces
  (US-1 two-purpose split holds).
- **Infra rulings** (`specs/infra-spec.md` v1.0) — monorepo shape, `apps/console` →
  `console.momoneystudios.com`, `ANTHROPIC_API_KEY` as Vercel env, noindex on all
  console routes, Postgres as prod store.
- **Roadmap copy** (`maestro.html`) — "Phase two is the console — in your browser" is
  the mandate this build executes.

## Deviations to record (rung: operative in the repo, proposed as ledger entries)

1. **Repo path:** `~/projects/maestro` was found occupied by an existing corpus
   workspace (Obsidian vault, maestro-on-mosaic material) and was NOT touched. The code
   repo lives at `~/projects/momoney-site`, matching the ruled repo name
   `momoney-studios/site`.
2. **Package manager:** npm workspaces locally (the WSL box lacks corepack/pnpm without
   sudo). `packageManager: pnpm@9.15.0` retained in package.json as the spec'd intent;
   Turborepo config staged (`turbo.json`) but not installed. One-step swap at deploy
   time.
3. **Auth:** dev Basic-auth fallback (CONSOLE_USER/CONSOLE_PASSWORD env) until the
   Entra ID app registration (infra-spec §4) exists. All routes noindex regardless.
4. **Store:** JSON file store for dev (`.data/`, git-ignored). Drizzle schema for
   Vercel Postgres staged 1:1 in `packages/db/schema.ts`; wiring deferred to the
   factory phase. If `DATABASE_URL` is set today the console fails honestly rather
   than diverging silently.

## Seams left open (by design, per plan)

- **VIS axis** defined-but-dormant in the UST model (visual-ready); excluded from
  conversation context and quiet fills.
- **Build mode** detected and answered in-voice as "factory not yet online" — the
  pipeline (axis-fill → round-robin → lock → FOIL → triad → Suno) is the next phase.
- **LOCKED state** exists in the model but has no path in this slice — nothing locks
  without an explicit artist act, which arrives with the factory UI.

## Open rulings this build did NOT touch

Console-lane naming (PROPOSAL-console-lane.md) · MoSu content move · "unannounced"
posture (US-3). The console's public copy inherits whatever those rulings decide.
