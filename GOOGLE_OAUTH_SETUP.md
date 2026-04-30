# Google OAuth Setup Guide

## 🔴 CURRENT ERROR: "provider is not enabled"

This error occurs because Google OAuth is not configured in your Supabase Dashboard.

---

## ✅ SOLUTION: Enable Google Sign-In

### Step 1: Get Your Supabase Redirect URLs

Your Supabase Auth callback URL:
```
https://dmavypdmtbxzwrexqesu.supabase.co/auth/v1/callback
```

Your local dev callback URL:
```
http://localhost:3000/admin-gate/callback
```

### Step 2: Create Google Cloud OAuth Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select or create a project**
3. **Navigate to**: APIs & Services → Credentials
4. **Click**: "Create Credentials" → "OAuth client ID"
5. **Configure Consent Screen**:
   - User Type: External
   - App Name: "Azenith Living"
   - Support Email: your email
   - Developer Contact: your email
   - Authorized Domains:
     - `dmavypdmtbxzwrexqesu.supabase.co`
     - `azenithliving.vercel.app`
     - `localhost`

6. **Create OAuth Client ID**:
   - Application Type: Web application
   - Name: "Azenith Living Web"
   - Authorized JavaScript Origins:
     - `http://localhost:3000`
     - `https://azenithliving.vercel.app`
     - `https://dmavypdmtbxzwrexqesu.supabase.co`
   - **Authorized redirect URIs** (CRITICAL):
     - `https://dmavypdmtbxzwrexqesu.supabase.co/auth/v1/callback`
     - `http://localhost:3000/admin-gate/callback`

7. **Click "Create"**
8. **Copy the Client ID and Client Secret**

### Step 3: Configure Supabase

1. **Go to Supabase Dashboard**: https://app.supabase.io
2. **Select your project**: dmavypdmtbxzwrexqesu
3. **Navigate to**: Authentication → Providers → Google
4. **Enable the Google provider**
5. **Paste credentials**:
   - Client ID: (from Google Cloud Console)
   - Client Secret: (from Google Cloud Console)
6. **Click "Save"

### Step 4: Update Your .env.local

Add the credentials to your local environment:

```bash
# .env.local
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id-here
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret-here
```

### Step 5: Test

1. Restart your Next.js dev server
2. Go to `/admin-gate/login`
3. Click "Continue with Gmail"
4. You should see the Google consent screen instead of the 400 error

---

## 🚀 IMMEDIATE WORKAROUND: Developer Backdoor

While setting up Google OAuth, use the **Developer Backdoor** to access the Admin Dashboard immediately:

### On the Login Page:

1. Click **"Developer Mode"** (small button below recovery code)
2. Enter password: `azenith-dev-2024`
3. Click **"🔓 Unlock Admin Dashboard"**

⚠️ **WARNING**: This bypasses authentication completely. Only use for local development!

---

## 📋 Quick Reference

### Required Redirect URIs for Google Cloud Console:

```
Production:
https://dmavypdmtbxzwrexqesu.supabase.co/auth/v1/callback

Local Development:
http://localhost:3000/admin-gate/callback
```

### Your Supabase Project Details:
- **Project ID**: dmavypdmtbxzwrexqesu
- **Region**: (check Supabase dashboard)
- **Auth URL**: https://dmavypdmtbxzwrexqesu.supabase.co/auth/v1

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
- You didn't add the correct redirect URI in Google Cloud Console
- Go back to Credentials → OAuth 2.0 Client IDs → Edit → Add the missing URI

### Error: "provider is not enabled"
- You forgot to enable Google in Supabase Dashboard
- Go to Supabase → Auth → Providers → Google → Toggle ON

### Error: "access_denied"
- Your app is in testing mode in Google Cloud
- Add your email as a "Test User" in OAuth Consent Screen settings

---

## 📁 Files Related to Auth:

- `app/admin-gate/login/page.tsx` - Login UI with Gmail button
- `app/admin-gate/callback/page.tsx` - OAuth callback handler
- `app/api/auth/dev-login/route.ts` - Developer backdoor
- `lib/supabase-client.ts` - Supabase client setup

---

## 🎯 Next Steps After Setup:

1. ✅ Test Google OAuth login
2. ✅ Disable Developer Backdoor in production
3. ✅ Set up recovery vault for passwordless backup
4. ✅ Configure trusted devices

**You're 3 steps away from a fully functional admin login!**
