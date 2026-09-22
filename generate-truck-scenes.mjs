/**
 * generate-truck-scenes.mjs
 * Cinematic truck story for the OPM Courier scroll hero:
 * Flux Schnell still -> Kling v1.6 image-to-video, one INDEPENDENT clip per
 * scene, written to src/sceneN.mp4 for build-frames.sh to consume.
 *
 * Each scene gets its own purpose-built still so the staged action (reverse
 * into a dock, dissolve into a blueprint, explode into panels) actually
 * happens — image-to-video chaining from a moving clip's last frame was
 * tried and reliably ignores staged actions in favor of continuing the
 * dominant motion. Continuity across cuts is instead handled by
 * build-frames.sh, which crossfades between clips rather than hard-cutting.
 *
 * Story: truck approaches -> transit tracking shot -> reverses into a
 * warehouse dock -> settles docked -> dissolves into a glowing cyan
 * cross-section blueprint -> the blueprint explodes open into separated,
 * evenly spaced service compartments. Palette matches the site: near-black
 * (#05070c) background, cyan/teal accents (#22d3ee / #67e8f9 / #06b6d4).
 *
 * Run: FAL_KEY=your-key node generate-truck-scenes.mjs
 */

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'fs';

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY required. export FAL_KEY=your-key');
  process.exit(1);
}

fal.config({ credentials: process.env.FAL_KEY });
mkdirSync('./src', { recursive: true });
mkdirSync('./assets/gen', { recursive: true });

const TRUCK = `matte dark-graphite box truck with a bold glowing cyan "OPM COURIER" wordmark
on the cargo box side panel, clean modern livery, no other text or logos`;

const SCENES = [
  {
    id: 'scene1',
    name: 'Approach',
    image: `
Photoreal cinematic wide shot at night. ${TRUCK}, driving toward camera along a wet,
reflective highway. Headlights on, cyan neon reflections streaking across the wet
asphalt. Deep near-black sky (#05070c), teal/cyan rim lighting on the truck body,
low camera angle, anamorphic lens flare, film grain. No other vehicles, no people.
Ultra-detailed automotive photography, premium tech-brand mood.
    `.trim(),
    motion: `
Slow, steady tracking shot: the truck approaches the camera at a moderate, controlled
speed. Low angle holds. Headlight glare pulses gently on wet road. No cuts, no camera
shake, stable cinematic motion. 5 seconds.
    `.trim(),
  },
  {
    id: 'scene2',
    name: 'Transit',
    image: `
Photoreal side-profile shot at dusk. ${TRUCK}, driving along a quiet city street,
cargo box side clearly facing camera so the wordmark reads. Motion-blurred buildings
behind, cyan streetlight reflections on the paint, dark near-black sky (#05070c),
cinematic color grade, shallow depth of field on the background. No people.
    `.trim(),
    motion: `
Smooth lateral tracking shot moving alongside the truck at matching speed, camera
holds a level side profile framing so the side wordmark stays readable. Minor
background parallax. Stable, no cuts. 5 seconds.
    `.trim(),
  },
  {
    id: 'scene3',
    name: 'Reverse',
    image: `
Photoreal wide shot at night. ${TRUCK}, positioned reversing toward an open warehouse
loading dock. Overhead cyan-white work lights illuminate the dock bay, red-white
reverse lights glow at the truck's rear, roller door open revealing a dark warehouse
interior beyond. Wide angle, camera set back watching the approach, near-black sky.
    `.trim(),
    motion: `
The truck slowly, precisely backs itself toward the dock bay in a controlled reverse
maneuver, reverse lights pulsing. Camera holds a static wide shot, fully stable.
No cuts, no camera movement. 5 seconds.
    `.trim(),
  },
  {
    id: 'scene4',
    name: 'Docked',
    image: `
Photoreal shot at night. ${TRUCK}, now fully backed into the warehouse dock, cargo
doors aligned flush with the dock bay opening. Warehouse interior glows cyan-white,
a faint mist drifts through the light beams, wet dock floor reflecting the glow.
Cinematic stillness, premium industrial mood, near-black background (#05070c).
    `.trim(),
    motion: `
Slow cinematic push-in toward the truck's rear cargo doors and the dock opening.
Ambient light flickers subtly, mist drifts. Fully stable, no cuts. 5 seconds.
    `.trim(),
  },
  {
    id: 'scene5',
    name: 'Blueprint',
    image: `
A glowing technical engineering blueprint of a box truck on a near-black background
(#05070c). Thin, precise cyan (#22d3ee) and pale teal (#67e8f9) wireframe linework
on a cutaway side view, revealing the cargo bay interior structure, chassis rails,
wheel wells, and interior shelving as a clean X-ray schematic. Faint HUD-style
tick marks and callout lines (no legible dense paragraphs of text). Premium
automotive engineering blueprint aesthetic, high contrast, ultra sharp linework,
symmetrical centered composition.
    `.trim(),
    motion: `
The blueprint schematic assembles itself: glowing cyan wireframe lines draw
themselves in from top to bottom as if scanning into existence, holographic
assembly effect, very slow subtle camera drift inward. Stable, no cuts. 5 seconds.
    `.trim(),
  },
  {
    id: 'scene6',
    name: 'Explode',
    image: `
A glowing technical exploded-view diagram of the same box truck cutaway blueprint,
on a near-black background (#05070c). The cargo bay's internal compartments and
panels are separated and floating apart from each other in a clean exploded
technical-diagram layout, each piece outlined with thin cyan (#22d3ee) and pale
teal (#67e8f9) wireframe linework and a faint HUD-style bracket outline. Evenly
spaced, symmetrical, centered composition, premium automotive engineering
diagram aesthetic, high contrast, ultra sharp linework, no dense paragraphs of text.
    `.trim(),
    motion: `
The exploded panels drift very slowly apart and then gently settle, camera pulls
back slowly to reveal the full evenly spaced layout, subtle ambient cyan glow
pulsing softly across the panels. Smooth, stable, no cuts, no camera shake.
5 seconds.
    `.trim(),
  },
];

async function generateStill(scene) {
  console.log(`\n[${scene.id}] 1/2 — still via Flux Schnell...`);
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt: scene.image,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate(u) { if (u.status === 'IN_PROGRESS') process.stdout.write('.'); }
  });
  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`[${scene.id}] no image URL: ` + JSON.stringify(result));
  const res = await fetch(imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`./assets/gen/${scene.id}-still.jpg`, buf);
  console.log(`\n  saved assets/gen/${scene.id}-still.jpg`);
  return imageUrl;
}

async function generateVideo(scene, imageUrl) {
  console.log(`[${scene.id}] 2/2 — animating with Kling v1.6...`);
  const result = await fal.subscribe('fal-ai/kling-video/v1.6/standard/image-to-video', {
    input: {
      prompt: scene.motion,
      image_url: imageUrl,
      duration: '5',
      aspect_ratio: '16:9',
      cfg_scale: 0.5,
    },
    logs: true,
    onQueueUpdate(u) {
      if (u.status === 'IN_PROGRESS') {
        const msg = u.logs?.map(l => l.message).join(' | ') || '...';
        process.stdout.write('\r  ' + msg.substring(0, 60).padEnd(60));
      }
    }
  });
  const videoUrl = result.data?.video?.url;
  if (!videoUrl) throw new Error(`[${scene.id}] no video URL: ` + JSON.stringify(result));
  const res = await fetch(videoUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`./src/${scene.id}.mp4`, buf);
  console.log(`\n  saved src/${scene.id}.mp4`);
}

try {
  for (const scene of SCENES) {
    const imageUrl = await generateStill(scene);
    await generateVideo(scene, imageUrl);
  }
  console.log(`
✓ Done! ${SCENES.length} scene clips written to src/scene1.mp4..src/scene${SCENES.length}.mp4
Next: run ./build-frames.sh to produce assets/frames/ + assets/frames-m/
`);
} catch (err) {
  console.error('\nGeneration failed:', err.message || err);
  process.exit(1);
}
