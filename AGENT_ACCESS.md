# Agent Access Setup

This project expects agents to use local machine credentials, not committed secrets.

## Installed Tools

- GitHub CLI: `gh`
- Vercel CLI: `vercel`
- Supabase CLI: `node_modules/.bin/supabase.cmd`

## Required Login

Run these once on the machine:

```powershell
gh auth login
vercel login
node_modules\.bin\supabase.cmd login
```

## Required Access

- GitHub: the logged-in account must have access to the project repository.
- Vercel: the logged-in account must have access to project `azenith-living-os`.
- Supabase: the logged-in account must have access to project `azenith-living-os`.

## Do Not Commit Secrets

Never commit `.env`, `.env.local`, service role keys, Vercel tokens, GitHub tokens, or Supabase access tokens.
