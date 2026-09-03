const dns = require('dns').promises;
const net = require('net');

function ipv4ToInt(ip) {
  return ip.split('.').reduce((n, oct) => (n * 256) + Number(oct), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  const ranges = [
    ['0.0.0.0', '0.255.255.255'],
    ['10.0.0.0', '10.255.255.255'],
    ['100.64.0.0', '100.127.255.255'],
    ['127.0.0.0', '127.255.255.255'],
    ['169.254.0.0', '169.254.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.0.0.0', '192.0.0.255'],
    ['192.168.0.0', '192.168.255.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['224.0.0.0', '255.255.255.255']
  ];
  return ranges.some(([a, b]) => n >= ipv4ToInt(a) && n <= ipv4ToInt(b));
}

function isPrivateIPv6(ip) {
  const v = ip.toLowerCase();
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

function isPrivateAddress(ip) {
  const normalized = String(ip).replace(/^\[|\]$/g, '');
  if (net.isIPv4(normalized)) return isPrivateIPv4(normalized);
  if (net.isIPv6(normalized)) return isPrivateIPv6(normalized);
  return true;
}

async function assertPublicHttpUrl(raw, options = {}) {
  const parsed = raw instanceof URL ? new URL(raw.toString()) : new URL(String(raw));
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) URLs are allowed.');
  if (parsed.username || parsed.password) throw new Error('URLs with embedded credentials are not allowed.');
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private/local hosts are not allowed.');
  }
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private/local IP addresses are not allowed.');
    return parsed;
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('URL resolves to a private/local network address.');
  }
  if (options.allowedHosts && !options.allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error(`Host is not allowed: ${hostname}`);
  }
  return parsed;
}

module.exports = { assertPublicHttpUrl, isPrivateAddress };
