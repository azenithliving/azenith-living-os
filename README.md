# Azenith OS ∞

Production revenue engine for luxury interiors.

## Setup
1. Copy `.env.example` to `.env.local` and fill in the required variables.
2. Supabase: Run SQL migrations + seed.
3. `npm i`
4. `npm run dev`

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run ci`

## Test
- / : CTA → console event
- /start : Stepper → store update
- /dashboard : Protected CRM

## Environment
See `ENVIRONMENT.md` for the required environment variables and descriptions.

## Deploy
`npm run build && vercel`

## Cost Mode
FREE_ONLY - all paid fallbacks active.

