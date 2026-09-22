/**
 * generate-brand-assets.mjs
 * OPM Courier logo mark + 1200x630 OG social share image via Flux.
 * Run: FAL_KEY=your-key node generate-brand-assets.mjs
 */
import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'fs';

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY required. export FAL_KEY=your-key');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });
mkdirSync('./assets/img', { recursive: true });

async function gen(name, prompt, size) {
  console.log(`\n[${name}] generating...`);
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: { prompt, image_size: size, num_inference_steps: 4, num_images: 1 },
    logs: true,
    onQueueUpdate(u) { if (u.status === 'IN_PROGRESS') process.stdout.write('.'); }
  });
  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error(`[${name}] no image URL: ` + JSON.stringify(result));
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`./assets/img/${name}`, buf);
  console.log(`\n  saved assets/img/${name}`);
}

try {
  await gen('logo-raw.jpg', `
Minimalist circular brand logomark for a courier delivery company called "OPM
Courier". A simple, bold, abstract geometric icon suggesting speed and motion
(e.g. a stylized forward chevron/wing or route line), rendered in glowing cyan
(#22d3ee) on a solid near-black (#05070c) circular background. Flat vector
icon style, no photographic detail, no gradients other than a subtle glow,
centered, clean negative space, no text, no letters.
  `.trim(), 'square_hd');

  await gen('og-raw.jpg', `
Premium dark tech-brand social share card, 1200x630 aspect ratio. Near-black
background (#05070c) with a subtle glowing cyan (#22d3ee) wireframe box-truck
silhouette on the right side, cinematic HUD/schematic aesthetic. Large bold
clean sans-serif wordmark "OPM COURIER" in off-white on the left, with smaller
cyan text underneath reading "SAME-DAY COURIER — SAN ANTONIO, TX". Subtle
cyan glow accents, high contrast, no clutter, plenty of negative space.
  `.trim(), 'landscape_16_9');

  console.log('\n✓ Done. Raw stills in assets/img/ — crop/clean up before using as final logo.png / og.jpg.');
} catch (err) {
  console.error('\nGeneration failed:', err.message || err);
  process.exit(1);
}
