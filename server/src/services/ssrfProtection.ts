import { URL } from 'url';
import dns from 'dns';
import http from 'http';
import https from 'https';

export interface SSRFCheckResult {
  allowed: boolean;
  reason?: string;
  url?: URL;
  resolvedIp?: string;
}

/**
 * Helper to check if an IPv4 address is in a private/internal CIDR range
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata 169.254.169.254)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8
  if (parts[0] === 0) return true;

  return false;
}

/**
 * Helper to check if an IPv6 address is in a private/internal range
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized.startsWith('fe80:')) return true; // Link-local
  if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true; // Unique local
  return false;
}

/**
 * Validate URL string and resolve DNS to ensure non-SSRF internal access
 */
export async function validateSSRF(targetUrl: string): Promise<SSRFCheckResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return { allowed: false, reason: 'Invalid or malformed URL' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { allowed: false, reason: `Unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsedUrl.hostname;

  // Block localhost string directly
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === 'internal') {
    return { allowed: false, reason: `Access to internal host "${hostname}" is forbidden due to security rules.` };
  }

  // Check direct IP address
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return { allowed: false, reason: `Access to private/internal IP address "${hostname}" is forbidden.` };
  }

  // Resolve DNS to verify IP
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIPv4(addr.address) || isPrivateIPv6(addr.address)) {
        return {
          allowed: false,
          reason: `Domain "${hostname}" resolved to forbidden internal IP "${addr.address}". Access denied.`,
          resolvedIp: addr.address,
        };
      }
    }
    return { allowed: true, url: parsedUrl, resolvedIp: addresses[0]?.address };
  } catch (err: any) {
    return { allowed: false, reason: `DNS resolution failed for hostname "${hostname}": ${err.message}` };
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  json: () => any;
}

/**
 * Safe HTTP/HTTPS client enforcing SSRF checks, timeouts, max payload size, and safe redirects
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs || 8000;
  const maxSizeBytes = options.maxSizeBytes || 5 * 1024 * 1024; // 5MB limit
  const maxRedirects = options.maxRedirects ?? 3;

  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    const ssrfCheck = await validateSSRF(currentUrl);
    if (!ssrfCheck.allowed || !ssrfCheck.url) {
      throw new Error(`SSRF Validation Error: ${ssrfCheck.reason}`);
    }

    const parsedUrl = ssrfCheck.url;
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Veridex-Agentic-RAG-Ingestion-Bot/1.0',
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {}),
      },
    };

    const resObj = await new Promise<{ statusCode: number; statusMessage: string; headers: any; bodyText: string }>((resolve, reject) => {
      let isSettled = false;
      const req = requestModule.request(requestOptions, (res) => {
        let size = 0;
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxSizeBytes) {
            req.destroy(new Error(`Response body exceeded maximum size limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`));
          } else {
            chunks.push(chunk);
          }
        });

        res.on('end', () => {
          if (isSettled) return;
          isSettled = true;
          const bodyText = Buffer.concat(chunks).toString('utf8');
          const headerMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            headerMap[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : (v || '');
          }
          resolve({
            statusCode: res.statusCode || 200,
            statusMessage: res.statusMessage || '',
            headers: headerMap,
            bodyText,
          });
        });
      });

      req.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms.`));
      });

      req.end();
    });

    // Handle redirects (301, 302, 307, 308)
    if ([301, 302, 307, 308].includes(resObj.statusCode) && resObj.headers['location']) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}.`);
      }
      currentUrl = new URL(resObj.headers['location'], currentUrl).toString();
      continue;
    }

    return {
      status: resObj.statusCode,
      statusText: resObj.statusMessage,
      headers: resObj.headers,
      bodyText: resObj.bodyText,
      json: () => JSON.parse(resObj.bodyText),
    };
  }

  throw new Error('Too many redirects');
}
