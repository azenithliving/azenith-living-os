# Remote Browser Setup

This repository now expects `Browser Workspace` to render a real remote desktop session backed by Oracle Cloud Always Free + XFCE + Chromium + noVNC.

If you do not have a payment card or do not want Oracle at all, use:

- [SELF_HOSTED_BROWSER_SETUP.md](<D:/Program Files/azenith living/my-app/SELF_HOSTED_BROWSER_SETUP.md>)

## App Environment Variables

Add these values to `.env.local` or your deployment environment:

```env
REMOTE_BROWSER_BASE_URL=https://browser.example.com/vnc.html
REMOTE_BROWSER_HEALTHCHECK_URL=https://browser.example.com/vnc.html
REMOTE_BROWSER_VNC_PASSWORD=replace-with-a-long-random-secret
REMOTE_BROWSER_LABEL=OCI XFCE Browser
```

Do not expose these variables as `NEXT_PUBLIC_*`.

## Oracle Cloud VM

Create an OCI instance with these exact settings:

- Shape: `VM.Standard.A1.Flex`
- CPU / RAM: `2 OCPU / 12 GB`
- Image: `Ubuntu 22.04 aarch64`
- Boot Volume: `50 GB`
- Public IP: enabled
- Ingress ports: `22`, `80`, `443`

Do not open `5901` or `6080` publicly.

## DNS

Point a hostname such as `browser.example.com` to the public IP of the OCI VM.

## Bootstrap the VM

Copy the repository to the VM or at least the `scripts/remote-browser` directory, then run:

```bash
sudo REMOTE_BROWSER_HOSTNAME=browser.example.com \
  APP_PROD_ORIGIN=https://your-app.example.com \
  REMOTE_BROWSER_VNC_PASSWORD='replace-with-a-long-random-secret' \
  bash scripts/remote-browser/bootstrap-oci-remote-browser.sh
```

The script will:

- install `XFCE`, `TigerVNC`, `noVNC`, `websockify`, `Caddy`, `Chromium`
- create a dedicated `remotebrowser` user
- configure a persistent VNC desktop on `:1`
- expose `https://browser.example.com/vnc.html`
- allow the app origin to embed the session

## Validation

After bootstrap succeeds:

```bash
systemctl status browser-vnc.service
systemctl status browser-websockify.service
systemctl status caddy
```

Then validate:

- `https://browser.example.com/vnc.html` returns the noVNC client
- `/admin/browser` renders the remote desktop inside the admin app
- logins and popups stay inside the remote desktop session

## App Behavior

`/admin/browser` now does the following:

- fetches a server-side viewer URL from `/api/admin/remote-browser/session`
- checks health through `/api/admin/remote-browser/health`
- embeds the remote desktop session fullscreen
- never falls back to Google search or manual URL entry
