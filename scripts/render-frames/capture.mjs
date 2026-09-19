// Renders the tunnel/truck Three.js scene (scene.html) to a sequence of still
// frames by stepping through progress values 0..1 and screenshotting the
// canvas after each render — the same "continuous camera move split into
// frames" source the cinematic-scroll-template's build-frames.sh expects,
// except the footage is our own wireframe 3D render instead of a paid AI
// video clip.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FRAME_COUNT = 384;

const targets = [
  { dir: path.join(ROOT, 'assets/frames'), w: 1440, h: 810, prefix: 'f', ext: 'jpg', quality: 78 },
  { dir: path.join(ROOT, 'assets/frames-m'), w: 640, h: 1138, prefix: 'f', ext: 'jpg', quality: 76 },
];

async function renderSet(browser, target) {
  fs.mkdirSync(target.dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: target.w, height: target.h } });
  const url = `file://${path.join(__dirname, 'scene.html')}?w=${target.w}&h=${target.h}`;
  await page.goto(url);
  await page.waitForFunction('window.__sceneReady === true', { timeout: 30000 });
  const canvas = await page.$('#tjsCanvas');

  for (let i = 0; i < FRAME_COUNT; i++) {
    const u = FRAME_COUNT === 1 ? 0 : i / (FRAME_COUNT - 1);
    await page.evaluate((u) => window.renderFrame(u), u);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const num = String(i + 1).padStart(4, '0');
    const file = path.join(target.dir, `${target.prefix}${num}.${target.ext}`);
    await canvas.screenshot({ path: file, type: 'jpeg', quality: target.quality });
    if ((i + 1) % 48 === 0) console.log(`  ${target.dir}: ${i + 1}/${FRAME_COUNT}`);
  }
  await page.close();
}

const browser = await chromium.launch();
for (const target of targets) {
  console.log('Rendering', target.dir, `${target.w}x${target.h}`);
  await renderSet(browser, target);
}
await browser.close();
console.log('Done. Frame count:', FRAME_COUNT);
