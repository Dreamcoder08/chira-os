import { describe, expect, it } from 'vitest';
import {
  buildOrigin,
  isLanAddress,
  parseListeningPid,
  parseSourceAddress,
} from '../../scripts/pilot/net.ts';

describe('parseSourceAddress', () => {
  it('reads the address the kernel would use to leave the machine', () => {
    const output =
      '1.1.1.1 via 192.168.1.1 dev wlp2s0 src 192.168.1.17 uid 1000\n    cache\n';
    expect(parseSourceAddress(output)).toBe('192.168.1.17');
  });

  it('returns null when the route has no source', () => {
    expect(
      parseSourceAddress('RTNETLINK answers: Network is unreachable'),
    ).toBe(null);
  });

  it('does not accept a partial address from a longer line', () => {
    expect(parseSourceAddress('src 10.0.0.300')).toBe('10.0.0.300');
  });
});

describe('parseListeningPid', () => {
  it('reads the pid ss reports for the listening socket', () => {
    const output =
      'LISTEN 0      511        127.0.0.1:3001      0.0.0.0:*    users:(("node",pid=170786,fd=21))';
    expect(parseListeningPid(output)).toBe(170786);
  });

  it('returns null when nothing listens', () => {
    expect(parseListeningPid('State Recv-Q Send-Q Local Address:Port')).toBe(
      null,
    );
  });
});

describe('buildOrigin', () => {
  it('builds the origin the certificate must match', () => {
    expect(buildOrigin('192.168.1.17', '8443')).toBe(
      'https://192.168.1.17:8443',
    );
  });
});

describe('isLanAddress', () => {
  it('accepts a private address a phone can reach', () => {
    expect(isLanAddress('192.168.1.17')).toBe(true);
    expect(isLanAddress('10.0.0.5')).toBe(true);
  });

  it('rejects loopback, link-local and multicast', () => {
    expect(isLanAddress('127.0.0.1')).toBe(false);
    expect(isLanAddress('169.254.1.1')).toBe(false);
    expect(isLanAddress('224.0.0.1')).toBe(false);
    expect(isLanAddress('0.0.0.0')).toBe(false);
  });

  it('rejects anything that is not an IPv4 address', () => {
    expect(isLanAddress('chira.local')).toBe(false);
    expect(isLanAddress('192.168.1')).toBe(false);
  });
});
