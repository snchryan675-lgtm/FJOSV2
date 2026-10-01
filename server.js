// FJOS Web: static host + rewriting web proxy (Node 18+, no extra dependencies)
const http = require('http'), fs = require('fs'), path = require('path'), net = require('net');
const dns = require('dns').promises, { Readable } = require('stream');
const PORT = process.env.PORT || 3000, ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' };
const STATIC = /^\/(index\.html|shim\.js|px-client\.js|icons\/|games\/|build\/|node_modules\/js-dos\/)/;
const end = (res, code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain' }); res.end(msg); };

// Never let the proxy reach private / internal addresses
function priv(ip) {
  if (net.isIPv6(ip)) { ip = ip.toLowerCase(); if (ip.startsWith('::ffff:')) ip = ip.slice(7); else return ip === '::1' || ip === '::' || /^f[cd]/.test(ip) || ip.startsWith('fe80'); }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
const P = u => '/proxy?u=' + encodeURIComponent(u);
const abs = (u, base) => { try { if (/^\s*(data:|blob:|javascript:|mailto:|tel:|about:|#)/i.test(u)) return null; return new URL(u.trim(), base).href; } catch { return null; } };
function rwCss(c, base) {
  return c.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, q, u) => { const x = abs(u, base); return x ? 'url(' + q + P(x) + q + ')' : m; })
          .replace(/@import\s+(['"])(.*?)\1/gi, (m, q, u) => { const x = abs(u, base); return x ? '@import ' + q + P(x) + q : m; });
}
function rwHtml(h, base) {
  h = h.replace(/<base\b[^>]*>/gi, '').replace(/\s(?:integrity|nonce)\s*=\s*(["']).*?\1/gi, '');
  h = h.replace(/(\s(?:src|href|action|poster|data-src)\s*=\s*)(["'])(.*?)\2/gis, (m, a, q, v) => { const x = abs(v.replace(/&amp;/g, '&'), base); return x ? a + q + P(x) + q : m; });
  h = h.replace(/(\ssrcset\s*=\s*)(["'])(.*?)\2/gis, (m, a, q, v) => a + q + v.split(',').map(s => { const [u, ...r] = s.trim().split(/\s+/); const x = abs(u, base); return (x ? P(x) : u) + (r.length ? ' ' + r.join(' ') : ''); }).join(', ') + q);
  h = h.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, s => rwCss(s, base));
  const inj = '<script>window.__PX=' + JSON.stringify(base) + ';</script><script src="/px-client.js"></script>';
  return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, m => m + inj) : inj + h;
}
const DROP = /^(content-security-policy.*|x-frame-options|content-encoding|content-length|transfer-encoding|set-cookie|strict-transport-security|report-to|nel|cross-origin-.*|permissions-policy|connection|keep-alive)$/;

async function proxy(req, res, url) {
  let t; try { t = new URL(url); } catch { return end(res, 400, 'Bad URL'); }
  if (!/^https?:$/.test(t.protocol)) return end(res, 400, 'Only http(s) is supported');
  try { if ((await dns.lookup(t.hostname, { all: true })).some(a => priv(a.address))) return end(res, 403, 'Blocked address'); } catch { return end(res, 502, 'Could not resolve ' + t.hostname); }
  const h = {}; for (const k of ['user-agent', 'accept', 'accept-language', 'content-type', 'range']) if (req.headers[k]) h[k] = req.headers[k];
  let body; if (!['GET', 'HEAD'].includes(req.method)) { const c = []; for await (const x of req) c.push(x); body = Buffer.concat(c); }
  let r; try { r = await fetch(t, { method: req.method, headers: h, body, redirect: 'manual', signal: AbortSignal.timeout(30000) }); } catch (e) { return end(res, 502, 'Fetch failed: ' + e.message); }
  const out = {}; r.headers.forEach((v, k) => { if (!DROP.test(k)) out[k] = v; });
  if (r.status >= 300 && r.status < 400 && out.location) { const x = abs(out.location, t.href); if (x) out.location = P(x); }
  const ct = r.headers.get('content-type') || '';
  if (/text\/html/i.test(ct)) { const s = rwHtml(await r.text(), t.href); res.writeHead(r.status, out); return res.end(s); }
  if (/text\/css/i.test(ct)) { const s = rwCss(await r.text(), t.href); res.writeHead(r.status, out); return res.end(s); }
  res.writeHead(r.status, out);
  if (!r.body) return res.end();
  Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/proxy') { const t = u.searchParams.get('u'); return t ? proxy(req, res, t) : end(res, 400, 'Missing u'); }
    let p = decodeURIComponent(u.pathname); if (p === '/' || p.endsWith('/')) p += 'index.html';
    const f = path.resolve(ROOT, '.' + p);
    if (!STATIC.test(p) || !f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return end(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { end(res, 500, String(e.message)); }
}).listen(PORT, () => console.log('FJOS Web running on http://localhost:' + PORT));
