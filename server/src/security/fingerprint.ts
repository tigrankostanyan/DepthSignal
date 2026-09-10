import crypto from 'crypto';

// Normalize a client IP to a strict subnet prefix so that a stable client on the
// same network keeps matching, while a copied session from a different network does not.
//   IPv4 -> /24  (e.g. 203.0.113.45 -> 203.0.113.0/24)
//   IPv6 -> /48
//   loopback/localhost -> a stable identifier
function normalizeIpToSubnet(ip: string | undefined): string {
  if (!ip) return 'unknown';
  let host = ip.trim();

  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end !== -1) host = host.slice(1, end);
  } else if (host.split(':').length === 2) {
    host = host.split(':')[0];
  }

  if (host === '::1' || host === '127.0.0.1' || host.toLowerCase() === 'localhost') {
    return 'loopback';
  }

  if (host.includes(':')) {
    const parts = host.split(':');
    return `${parts.slice(0, 3).join(':')}::/48`;
  }

  const octets = host.split('.');
  if (octets.length === 4) {
    return `${octets.slice(0, 3).join('.')}.0/24`;
  }

  return host;
}

// Compute a cryptographic fingerprint hash combining the client's User-Agent,
// a strict subnet/IP check, and an optional browser-side entropy token.
export function computeFingerprintHash(
  userAgent: string | undefined,
  ip: string | undefined,
  entropyToken?: string | undefined
): string {
  const ua = (userAgent || '').trim();
  const subnet = normalizeIpToSubnet(ip);
  const entropy = (entropyToken || '').trim();
  return crypto
    .createHash('sha256')
    .update(`${ua}\u0000${subnet}\u0000${entropy}`)
    .digest('hex');
}