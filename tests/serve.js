/* Shared static file server for the local test harness. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(root, port) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/* Resolve a Chromium binary: env override, then the Playwright cache. */
function chromiumPath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = path.join(require('os').homedir(), '.cache/ms-playwright');
  if (!fs.existsSync(cache)) return null;
  for (const dir of fs.readdirSync(cache).sort().reverse()) {
    for (const cand of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const p = path.join(cache, dir, cand);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

class Reporter {
  constructor() { this.rows = []; this.failures = 0; }
  check(name, cond, detail = '') {
    this.rows.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) this.failures++;
    return cond;
  }
  done(label) {
    console.log('\n' + this.rows.join('\n'));
    console.log(`\n${label}: ${this.rows.length - this.failures}/${this.rows.length} checks passed`);
    return this.failures;
  }
}

module.exports = { serve, chromiumPath, Reporter };
