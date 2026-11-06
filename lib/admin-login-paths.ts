/**
 * The admin doors a browser may knock on before it has a session.
 *
 * Two rules depend on this list and must not disagree: the outer gate lets these addresses through
 * unsigned, and the rate limiter caps them like any door a stranger can open. Before this file, the
 * addresses were written once in `proxy.ts` and never in the limiter at all — which is how a front
 * door ends up exposed with no ceiling, or a new one answered 401 before its ceremony ever starts.
 *
 * Exact addresses, never prefixes: `/api/admin/passkeys/enroll` sits under the same folder and must
 * stay behind the session, because it writes.
 */
export const ADMIN_LOGIN_PATHS = [
  "/api/admin/gate/validate",
  "/api/admin/gate/health",
  "/api/admin/gate/reset-2fa",
  "/api/admin/verify-2fa",
  "/api/admin/passkeys/authenticate/options",
  "/api/admin/passkeys/authenticate/verify",
] as const;

export function isAdminLoginPath(pathname: string): boolean {
  return (ADMIN_LOGIN_PATHS as readonly string[]).includes(pathname);
}
