import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(__dirname, reqPath === '/' ? 'scene.html' : reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/scene.html?w=960&h=540`);
await page.waitForFunction('window.__sceneReady === true', { timeout: 30000 });
const info = await page.evaluate(() => window.__debugDock);
console.log(JSON.stringify(info, null, 2));
await browser.close();
server.close();
