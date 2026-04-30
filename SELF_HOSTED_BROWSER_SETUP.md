# Self-Hosted Browser Workspace

This path removes the dependency on Oracle and the old OCI-only browser flow.

If `BROWSER_WORKSPACE_VIEWER_URL` is set, `/admin/browser` will auto-connect to your self-hosted viewer first.
If it is missing, the app falls back to the legacy `REMOTE_BROWSER_*` OCI setup.

## What This Supports

Any real browser-accessible viewer that exposes an `http` or `https` URL, such as:

- LinuxServer Chromium
- KasmVNC
- noVNC
- Apache Guacamole
- Any similar HTML5 remote desktop/browser viewer

## Fastest No-Card Path

Use the included local Docker stack:

- [docker-compose.browser-workspace.yml](<D:/Program Files/azenith living/my-app/docker-compose.browser-workspace.yml>)
- [.env.browser-workspace.example](<D:/Program Files/azenith living/my-app/.env.browser-workspace.example>)

This runs a real Chromium browser in a web-accessible container on your own machine.

### 1. Prepare local env

Copy:

```powershell
Copy-Item .env.browser-workspace.example .env.browser-workspace
```

Then change at least:

- `BROWSER_WORKSPACE_CUSTOM_USER`
- `BROWSER_WORKSPACE_PASSWORD`

### 2. Start the browser container

```powershell
docker compose --env-file .env.browser-workspace -f docker-compose.browser-workspace.yml up -d
```

The browser will be available locally at:

- `https://localhost:3001`

LinuxServer documents this Chromium image as browser-accessible over `https://yourhost:3001/`.

### 3. Connect it to the admin page

You now have two ways:

1. Quick local use:
   Open `/admin/browser`, save `https://localhost:3001` as a custom viewer, then use `Open Active Viewer`.
2. Stable app-level auto-connect:
   Put your public or reverse-proxied viewer URL into `BROWSER_WORKSPACE_VIEWER_URL`.

## App Environment Variables

Add these values to `.env.local` or your deployment environment:

```env
BROWSER_WORKSPACE_VIEWER_URL=https://browser.your-domain.com/
BROWSER_WORKSPACE_HEALTHCHECK_URL=https://browser.your-domain.com/
BROWSER_WORKSPACE_LABEL=Self-Hosted Browser
```

Notes:

- `BROWSER_WORKSPACE_VIEWER_URL` is the full URL the admin page should embed or open.
- `BROWSER_WORKSPACE_HEALTHCHECK_URL` is optional. If omitted, the app reuses the viewer URL.
- Keep using `REMOTE_BROWSER_*` only if you still want the OCI noVNC fallback.

## Exposure Modes

### A. Quick Tunnel for testing only

Cloudflare documents `cloudflared tunnel --url http://localhost:8080` as a quick tunnel that works without a Cloudflare account.

For this stack, use:

```powershell
cloudflared tunnel --url https://localhost:3001 --no-tls-verify
```

Or use the helper script:

- [scripts/browser-workspace/start-quick-tunnel.ps1](<D:/Program Files/azenith living/my-app/scripts/browser-workspace/start-quick-tunnel.ps1>)

Quick Tunnel gives you a random public URL. Save that URL in `/admin/browser` as a custom viewer.

Cloudflare also states Quick Tunnels are for testing only.

### B. Named Tunnel for stable usage

For a stable hostname, keep using Cloudflare Tunnel with your own domain. That is the stronger path if you want the browser workspace to stay reachable under one fixed URL.

## Recommended Low-Cost Architecture

1. Run the actual browser/viewer on your own machine or your own always-on box.
2. Publish it through Cloudflare Tunnel.
3. Put the resulting public viewer URL in `BROWSER_WORKSPACE_VIEWER_URL`.
4. Open `/admin/browser` and the app will auto-connect.

This keeps the website light because the heavy browser session stays outside Next.js and outside Vercel Functions.

## Cloudflare Tunnel Template

A ready example lives at:

- [scripts/browser-workspace/cloudflared/config.example.yml](<D:/Program Files/azenith living/my-app/scripts/browser-workspace/cloudflared/config.example.yml>)

Replace the hostname, tunnel ID, credentials path, and local service port with your real values.

## Important Reality Check

- Arbitrary websites cannot be reliably forced inside an iframe because many sites block embedding.
- The reliable path is a real remote browser session, then either embed that viewer or open it in a separate tab.
- The admin page now supports both modes.
- Oracle is not required for this path at all.
