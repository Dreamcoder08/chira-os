/**
 * Input parsing for the pilot launcher. Kept separate from the runner so the
 * address and process rules are testable without starting anything.
 */

/** Reads the local address out of `ip -4 route get 1.1.1.1` output. */
export function parseSourceAddress(output: string): string | null {
  const match = /(?:^|\s)src\s+(\d{1,3}(?:\.\d{1,3}){3})(?:\s|$)/.exec(output);
  return match?.[1] ?? null;
}

/** Reads the first pid out of `ss -ltnp` output. */
export function parseListeningPid(output: string): number | null {
  const match = /pid=(\d+)/.exec(output);
  return match === null ? null : Number(match[1]);
}

export function buildOrigin(host: string, port: string): string {
  return `https://${host}:${port}`;
}

/**
 * A phone can only reach the pilot over the LAN, so a loopback or link-local
 * address is a mistake worth catching before the certificate is issued for it.
 */
export function isLanAddress(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [first, second] = octets;
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet)))
    return false;
  if (first === undefined || second === undefined) return false;
  if (first === 127 || first === 0 || first >= 224) return false;
  if (first === 169 && second === 254) return false;
  return true;
}
