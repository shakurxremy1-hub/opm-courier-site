/**
 * generate-flight-scenes.mjs
 * Six chained Kling v1.6 image-to-video clips for the cinematic-scroll-template
 * hero: ONE continuous forward camera move (never reversing, never staging a
 * complex maneuver — Kling follows simple continued motion far more reliably
 * than scripted actions), keeping the truck/warehouse/blueprint concept as
 * things the camera flies past rather than things the truck performs.
 *
 * Scene1 gets a fresh Flux still. Scenes 2-6 chain from the previous clip's
 * exact last frame (extracted with ffmpeg, re-uploaded to fal storage) so the
 * cut lands on a matching composition — per the template's own guidance.
 *
 * Story: aerial push over a night highway toward a glowing dispatch point ->
 * low glide alongside the OPM Courier truck in transit -> forward through the
 * warehouse dock door, past the parked truck -> down a glowing cyan blueprint/
 * schematic corridor -> into a bright tracking/HUD space -> settling into a
 * calm, warmly-lit arrival space (the backdrop for founder/tiers/contact).
 *
 * Run: FAL_KEY=your-key node generate-flight-scenes.mjs
 */

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY required. export FAL_KEY=your-key');
  process.exit(1);
}

fal.config({ credentials: process.env.FAL_KEY });
mkdirSync('./src', { recursive: true });
mkdirSync('./assets/gen', { recursive: true });

const TRUCK = `a dark navy-black Mercedes-Sprinter-style cargo delivery van: a tall,
single-body panel van (no separate box container on a chassis, the roof and
cargo area are one continuous unified body), rounded modern front end, a
sliding side cargo door, with a bold glowing cyan "OPM COURIER" wordmark on
its side panel`;

const SCENES = [
  {
    id: 'scene1',
    image: `
Photoreal cinematic aerial drone shot at night, moderately high above a wet,
reflective highway threading through a mid-size American city, horizon in the
upper third of the frame. Streaks of headlight and taillight light trails
below, deep near-black sky (#05070c), a single bright cyan (#22d3ee) point of
light glowing on the horizon where the highway converges. Anamorphic lens
flare, film grain, no text, no people.
    `.trim(),
    motion: `
FAST, continuous forward drone flight, rushing toward the glowing point on the
horizon at real speed, like a high-speed flyover, not a slow drift. The
highway below visibly streaks and rushes past beneath the camera, buildings
and lights on either side sliding backward through frame as the camera
advances. The glowing point on the horizon grows noticeably larger and
brighter as the distance closes over the clip. Strong continuous forward
travel the entire duration, never static, never hovering in place. No cuts,
no stutters. 10 seconds.
    `.trim(),
  },
  {
    id: 'scene2',
    // Independent still (not chained from scene1): Kling reliably garbles
    // baked-in text when it has to invent a decal from a text description
    // alone during a video continuation. Flux placing real vinyl-decal text
    // on a still first, then Kling only animating that already-correct
    // image, is far more reliable — validated on stills before spending on
    // video. This does mean a hard cut after scene1 instead of a chained
    // one; accepted trade-off for a correctly-branded van.
    freshStill: true,
    seed: 1002, // validated against 3 seeds beforehand — this one spells "OPM COURIER" correctly
    image: `
Photoreal side-profile shot at dusk of a dark navy-black Mercedes-Sprinter-style
cargo delivery van (tall single-body panel van, no separate box container)
driving along a quiet city street. On its side cargo panel: a clean vinyl-cut
fleet decal reading OPM COURIER in bold white sans-serif letters, professional
sign lettering, sharp and legible, one line. Motion-blurred buildings behind,
cyan streetlight reflections on the paint, dark near-black sky (#05070c),
cinematic color grade, shallow depth of field on the background.
    `.trim(),
    motion: `
Smooth lateral tracking shot moving alongside the van at matching speed, camera
holds a level side profile framing so the side decal stays readable. Minor
background parallax. Stable, no cuts. 10 seconds.
    `.trim(),
  },
  {
    id: 'scene3',
    motion: `
Continue the same forward glide, closing the distance on ${TRUCK}, which is now
parked still at an open warehouse loading dock, roller door open, warehouse
interior visible beyond as a dark opening with faint cyan-white light spilling
out. The camera flies forward past the truck's side and continues in through
the open dock door into the dark interior. Smooth, continuous, no cuts, no
sudden moves. 10 seconds.
    `.trim(),
  },
  {
    id: 'scene4',
    motion: `
Continue flying forward, now fully inside a warehouse corridor. Its walls and
shelving are rendered as a glowing technical blueprint: thin, precise cyan
(#22d3ee) and pale teal (#67e8f9) wireframe linework on a near-black
background, like an X-ray schematic of the storage racks passing by on both
sides. Smooth continuous forward glide down the center of the corridor, no
cuts, no camera shake. 10 seconds.
    `.trim(),
  },
  {
    id: 'scene5',
    motion: `
Continue flying forward, emerging from the blueprint corridor into a bright,
open control-room-like space full of glowing cyan-white HUD data panels and
screens, evenly spaced, showing abstract tracking/status readouts (no legible
dense text). Smooth continuous forward glide through the open space, no cuts.
10 seconds.
    `.trim(),
  },
  {
    id: 'scene6',
    motion: `
Continue flying forward, the HUD panels falling away behind as the space opens
into a calm, warmly-lit open threshold, soft golden-white ambient light
replacing the cyan glow, near-black surroundings fading to a warm gradient.
The camera slows and settles to a smooth stop, centered and level. No cuts,
no camera shake. 10 seconds.
    `.trim(),
  },
];

async function generateStill(scene) {
  console.log(`\n[${scene.id}] still via Flux Schnell...`);
  const input = { prompt: scene.image, image_size: 'landscape_16_9', num_inference_steps: 4, num_images: 1 };
  if (scene.seed != null) input.seed = scene.seed;
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input,
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

async function lastFrameUrl(mp4Path, jpgPath) {
  execSync(`ffmpeg -y -sseof -0.5 -i "${mp4Path}" -update 1 -q:v 2 "${jpgPath}"`, { stdio: 'ignore' });
  const buf = readFileSync(jpgPath);
  const blob = new Blob([buf], { type: 'image/jpeg' });
  return await fal.storage.upload(blob);
}

async function generateVideo(scene, imageUrl) {
  console.log(`[${scene.id}] animating with Kling v1.6...`);
  const result = await fal.subscribe('fal-ai/kling-video/v1.6/standard/image-to-video', {
    input: { prompt: scene.motion, image_url: imageUrl, duration: '10', aspect_ratio: '16:9', cfg_scale: 0.6 },
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

const ONLY = process.argv[2]; // e.g. "scene1" to test just one scene cheaply
const RUN = ONLY ? SCENES.filter(s => s.id === ONLY) : SCENES;
if (ONLY && RUN.length === 0) { console.error(`no scene matches "${ONLY}"`); process.exit(1); }

try {
  // resume support: if earlier scenes already exist on disk (e.g. from a
  // prior run cut short by a billing error), reuse them as chain input
  // instead of re-spending on a clip that already succeeded.
  const startIdx = SCENES.findIndex(s => s.id === RUN[0].id);
  let prevVideoPath = startIdx > 0 && existsSync(`./src/${SCENES[startIdx - 1].id}.mp4`)
    ? `./src/${SCENES[startIdx - 1].id}.mp4` : null;

  for (const scene of RUN) {
    if (existsSync(`./src/${scene.id}.mp4`) && !ONLY) {
      console.log(`[${scene.id}] already exists, skipping (delete src/${scene.id}.mp4 to regenerate)`);
      prevVideoPath = `./src/${scene.id}.mp4`;
      continue;
    }
    let imageUrl;
    if (!prevVideoPath || scene.freshStill) {
      imageUrl = await generateStill(scene);
    } else {
      console.log(`[${scene.id}] chaining from ${prevVideoPath}'s last frame...`);
      imageUrl = await lastFrameUrl(prevVideoPath, `./assets/gen/${scene.id}-chain-in.jpg`);
    }
    await generateVideo(scene, imageUrl);
    prevVideoPath = `./src/${scene.id}.mp4`;
  }
  console.log(`\n✓ Done! ${SCENES.length} chained clips written to src/scene1.mp4..src/scene${SCENES.length}.mp4\nNext: run ./build-frames.sh.new to produce assets/frames/ + assets/frames-m/\n`);
} catch (err) {
  console.error('\nGeneration failed:', err.message || err);
  process.exit(1);
}
