-- 20261106_passkey_credentials.sql
--
-- The door-key desk: one row per passkey the owner enrols on his own device.
--
-- Owner's word 2026-11-06: «المفتاح أيوه» — the capability is wanted. Four shipped admin doors already
-- ask for `user_public_keys` (2fa/disable, 2fa/status, admin/command, keys/public) and the record has
-- never answered: measured in docs/ledger/record-columns.json (2026-11-05) the table is absent, while
-- migration 016 declares it with two columns only.
--
-- The shape is taken from what the installed verifier actually returns, not from the 2024-era file:
-- measured in node_modules/@simplewebauthn/server/esm/registration/verifyRegistrationResponse.d.ts
-- (version 14.0.3), a verified registration yields credentialID, credentialPublicKey (bytes), counter,
-- aaguid, credentialDeviceType, credentialBackedUp and origin. `public_key` stays beside them as the
-- base64url of the same key, because the four doors above read that column by name.
--
-- `counter` is not bookkeeping: the verifier needs it to reject a replayed assertion, and the docs say
-- to keep it. `label` is the name the owner gives the key in his own words — it is what his screen
-- shows, never the credential id.
--
-- Locked like everything else since 2026-10-15: row level security on, no policy, so the public
-- browser key reads nothing and only the store's own credential writes.
--
-- No drop, no truncate, no delete: the applier refuses this file if any of those appear.

--SPLIT--

create table if not exists public.user_public_keys (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid    not null references auth.users (id) on delete cascade,
  credential_id         text    not null unique,
  credential_public_key bytea   not null,
  public_key            text    not null,
  key_type              text    not null default 'public-key',
  aaguid                text,
  counter               bigint  not null default 0,
  device_type           text    not null default 'singleDevice',
  backed_up             boolean not null default false,
  transports            text,
  origin                text,
  label                 text,
  created_at            timestamptz not null default timezone('utc', now()),
  last_used_at          timestamptz,
  constraint user_public_keys_key_type check (key_type = 'public-key'),
  constraint user_public_keys_device_type check (device_type in ('singleDevice', 'multiDevice'))
);

--SPLIT--

create index if not exists idx_user_public_keys_user
  on public.user_public_keys (user_id, created_at desc);

--SPLIT--

alter table public.user_public_keys enable row level security;
