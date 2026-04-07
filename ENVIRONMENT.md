# Environment Requirements

This project requires a set of runtime environment variables for Supabase, analytics, WhatsApp closing, and brand configuration.

## Required variables

- `NEXT_PUBLIC_SUPABASE_URL` — Public Supabase URL for client and server access.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous public key for browser clients.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for server/admin operations.
- `NEXT_PUBLIC_POSTHOG_KEY` — PostHog project key for analytics capture.
- `NEXT_PUBLIC_POSTHOG_HOST` — PostHog host endpoint.
- `WHATSAPP_DEFAULT_NUMBER` — WhatsApp number used for closing links.
- `CONTACT_EMAIL` — Customer contact email displayed in the site.
- `CONTACT_PHONE` — Contact phone number normalized for display.
- `BUSINESS_ADDRESS` — Business address for footer and legal pages.
- `PRIMARY_DOMAIN` — Primary domain used for tenant resolution.
- `BRAND_NAME` — Brand name in Latin script.
- `BRAND_NAME_AR` — Brand name in Arabic script.
- `FREE_HOOK_OFFER` — Short text for the free hook callout.

## Optional / extended variables

- `TIMEZONE` — Site timezone, default: `Africa/Cairo`.
- `DEFAULT_LOCALE` — Default locale, recommended: `ar-EG`.
- `BOOKING_MODE` — Enable booking flows, e.g. `enabled`.
- `BOOKING_TIMEZONE` — Booking timezone.
- `BOOKING_WORKING_HOURS` — Working hours string.
- `BOOKING_SLOT_DURATION` — Booking slot duration in minutes.
- `STOCK_IMAGE_PROVIDER` — Free stock image provider (e.g. `pexels`).
- `STOCK_IMAGE_API_KEY` — API key for the stock image provider.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in all required variables.
3. Run `npm install`.
4. Run `npm run dev`.

## CI and validation

- `npm run lint:ci`
- `npm run typecheck:ci`
- `npm run test:ci`
- `npm run ci`
