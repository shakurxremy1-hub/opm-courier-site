// Quick visual preview: renders scene.html at a handful of chosen u values
// so the dock/clip/explode choreography can be checked before running the
// full 384-frame capture.mjs.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[3] || '/tmp/scene-preview';
const US = (process.argv[2] || '0,0.2,0.4,0.5,0.58,0.65,0.72,0.78,0.85,0.92,1.0')
  .split(',').map(Number);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(__dirname, reqPath === '/' ? 'scene.html' : reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
const PORT = server.address().port;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', (m) => console.log('PAGE:', m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`http://localhost:${PORT}/scene.html?w=960&h=540`);
await page.waitForFunction('window.__sceneReady === true || window.__sceneError', { timeout: 30000 });
const err = await page.evaluate(() => window.__sceneError);
if (err) { console.error('Scene error:', err); process.exit(1); }
const canvas = await page.$('#tjsCanvas');

for (const u of US) {
  await page.evaluate((u) => window.renderFrame(u), u);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const file = path.join(OUT, `u${u.toFixed(2)}.jpg`);
  await canvas.screenshot({ path: file, type: 'jpeg', quality: 85 });
  console.log('saved', file);
}
await browser.close();
server.close();
