/**
 * Bundler guard, not a behaviour fake.
 *
 * The `server-only` package throws at import time outside a Next server bundle — it exists to stop a
 * Client Component reaching a secret-bearing module. Substituting it lets this instrument load the
 * real watcher, with the real database client and the real log table, from a plain Node process.
 * Nothing about what is measured is replaced.
 */
module.exports = {};
