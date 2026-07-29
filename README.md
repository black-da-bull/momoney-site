# MoMoney Studios — site monorepo

Per `specs/infra-spec.md` v1.0 (design workspace, RULED): Turborepo + pnpm, deployed on
Vercel.

```
/apps
  /console    → Maestro Phase Two — the console, in the browser
                → console.momoneystudios.com
  /web        → (slot reserved — the label site currently ships as static HTML
                 from the design workspace; migration is its own ruled path)
/packages
  /design     → CONSOLE lane tokens (the console uses ZERO label DS tokens by design)
  /db         → drizzle schema for Vercel Postgres (activation deferred; dev uses file store)
```

## Maestro — the console

*"Phase one is the studio. Phase two is the console — in your browser."* — maestro.html

The console is the conversational Maestro: a music collaborator holding a simulated
record label in its head, for the independent artist. The soul of the system is
`apps/console/soul/MAESTRO_v0.md`, committed **verbatim** — it is the literal system
prompt, not a paraphrase.

- Conversational by default; build mode only on request (factory phase lands next).
- The artist's word is canon. Raw input is preserved immutably.
- The song lives in an addressable 8-axis memory (Technical UST), updated quietly,
  invisible unless reached for. Nulls are reserved addresses, not walls.
- Every memory change is append-only with provenance. Nothing is silently filled.

## Run locally

```bash
pnpm install
cp apps/console/.env.example apps/console/.env.local   # add your ANTHROPIC_API_KEY
pnpm dev
```

## Deploy

Vercel project `console`, root directory `apps/console`. Set env per
`apps/console/.env.example`. Domain: `console.momoneystudios.com`
(DNS already specced at Namecheap in infra-spec). All routes send
`X-Robots-Tag: noindex` and sit behind auth.
