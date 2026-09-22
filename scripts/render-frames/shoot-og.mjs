import { chromium } from 'playwright';
import path from 'path';

const DIR = '/Users/shakurremy/projects/opm-courier-site/assets/img';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + path.join(DIR, 'og-compose.html'));
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(DIR, 'og.jpg'), type: 'jpeg', quality: 92 });
await browser.close();
console.log('saved og.jpg');
