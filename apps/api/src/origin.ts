const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/**
 * better-auth and the app's own guard both compare the Origin header byte for
 * byte, so a technician who types 127.0.0.1 instead of localhost reaches the
 * same server and gets a 403 that explains nothing. Every loopback spelling of
 * the configured origin is the same machine; a foreign site still does not
 * match, which is the only thing the check exists to stop.
 */
export function trustedOrigins(origin: string): string[] {
  const { protocol, hostname, port } = new URL(origin);
  if (!LOOPBACK.includes(hostname)) return [origin];
  return LOOPBACK.map(
    (host) => `${protocol}//${host}${port ? `:${port}` : ''}`,
  );
}

export function isTrustedOrigin(
  candidate: string | undefined,
  origin: string,
): boolean {
  return candidate !== undefined && trustedOrigins(origin).includes(candidate);
}
