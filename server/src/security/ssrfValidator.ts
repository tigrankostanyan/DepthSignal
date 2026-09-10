// ==========================================
// SSRF & WEBHOOK DESTINATION VALIDATOR
// Blocks localhost, private network, link-local, and AWS metadata endpoints
// ==========================================

import { URL } from 'url';

//  ssrf validation result
export interface SsrfValidationResult {
  isValid: boolean;
  reason?: string;
  normalizedUrl?: string;
}

// Validate webhook destination
export function validateWebhookDestination(rawUrl: string, requireHttpsInProd = true): SsrfValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, reason: 'Webhook URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, reason: 'Malformed URL format' };
  }

  // 1. Protocol check
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { isValid: false, reason: `Unsupported protocol: ${protocol}. Only HTTP and HTTPS are permitted.` };
  }

  if (process.env.NODE_ENV === 'production' && requireHttpsInProd && protocol !== 'https:') {
    return { isValid: false, reason: 'HTTPS is required in production environment.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Block direct localhost strings & local names
  const forbiddenHostnames = [
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    'broadcasthost',
    'metadata.google.internal',
    'instance-data'
  ];

  if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { isValid: false, reason: `Destination host '${hostname}' is a reserved internal or local target (SSRF prohibited).` };
  }

  let normalizedHostname = hostname;
  if (normalizedHostname.startsWith('[::ffff:') && normalizedHostname.endsWith(']')) {
    normalizedHostname = normalizedHostname.substring(8, normalizedHostname.length - 1);
  }

  // 3. Block IPv4 private & link-local ranges
  // 127.0.0.0/8 (Loopback)
  // 10.0.0.0/8 (Private RFC1918)
  // 172.16.0.0/12 (Private RFC1918)
  // 192.168.0.0/16 (Private RFC1918)
  // 169.254.0.0/16 (Link Local / Cloud Metadata e.g. 169.254.169.254)
  // 0.0.0.0/8 (Current network)
  // 100.64.0.0/10 (Carrier-grade NAT)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = normalizedHostname.match(ipv4Regex);

  if (match) {
    const octet1 = parseInt(match[1], 10);
    const octet2 = parseInt(match[2], 10);

    if (octet1 === 127) {
      return { isValid: false, reason: 'Loopback 127.0.0.0/8 destination is prohibited.' };
    }
    if (octet1 === 10) {
      return { isValid: false, reason: 'Private 10.0.0.0/8 network destination is prohibited.' };
    }
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return { isValid: false, reason: 'Private 172.16.0.0/12 network destination is prohibited.' };
    }
    if (octet1 === 192 && octet2 === 168) {
      return { isValid: false, reason: 'Private 192.168.0.0/16 network destination is prohibited.' };
    }
    if (octet1 === 169 && octet2 === 254) {
      return { isValid: false, reason: 'Link-local & cloud metadata 169.254.0.0/16 destination is prohibited.' };
    }
    if (octet1 === 0) {
      return { isValid: false, reason: 'Current network 0.0.0.0/8 destination is prohibited.' };
    }
    if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) {
      return { isValid: false, reason: 'Carrier NAT 100.64.0.0/10 destination is prohibited.' };
    }
  }

  // 4. Block IPv6 loopback & site-local
  if (hostname === '::1' || hostname === '[::1]' || hostname.startsWith('fe80:') || hostname.startsWith('[fe80:')) {
    return { isValid: false, reason: 'IPv6 Loopback or link-local destination is prohibited.' };
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}
