#!/usr/bin/env python3
"""Generate the hero flythrough as ONE continuous procedural camera move
through a glowing cyan wireframe logistics environment — a curving
structural corridor (warehouse trusses / highway guardrails, same wireframe
language throughout) that the camera flies down, passing two wireframe
delivery trucks and a wide "gate" threshold along the way, with telemetry
HUD readouts fading in for the back half.

This is a from-scratch procedural equivalent of the reference video's
technique (a single continuous virtual camera through a modeled 3D scene) —
not a copy of its specific brand, models, or shot list. Real photographic
stock clips can't do this: different cameras in different places can only
ever crossfade, never fly continuously. A single parametric camera path can.

Usage: python3 scripts/gen-flythrough.py [--frames N] [--test]
Writes assets/frames/f####.jpg (1920x1080) and assets/frames-m/f####.webp
(576x1024), matching frameCount/frameDir already wired into index.html.
"""
import argparse, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

random.seed(11)
np.random.seed(11)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DESK = os.path.join(ROOT, "assets/frames")
OUT_MOB = os.path.join(ROOT, "assets/frames-m")

DESK_W, DESK_H = 1920, 1080
MOB_W, MOB_H = 576, 1024

NEAR = 30.0
FAR = 1500.0
RING_SPACING = 48.0
RING_SIDES = 8
TOTAL_TRAVEL = 3600.0
N_RINGS = int(TOTAL_TRAVEL / RING_SPACING) + int(FAR / RING_SPACING) + 6

N_PARTICLES = 130
LOOP = FAR - NEAR

CYAN = np.array([56, 214, 240])     # #38d6f0
CYAN_DIM = np.array([20, 110, 140])
WHITE = np.array([225, 245, 250])

FONT_PATH = "/System/Library/Fonts/Menlo.ttc"

# world-space z of the two trucks and the gate threshold (fixed in space;
# the camera's own forward progress is what carries us past them)
TRUCK_Z = [980.0, 2350.0]
GATE_Z = 560.0


def smoothstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def path_x(k):
    return 90 * math.sin(k * 0.050) + 36 * math.sin(k * 0.019 + 1.1)


def path_y(k):
    return 60 * math.sin(k * 0.034 + 0.5)


def ring_radius(k):
    return 125 + 18 * math.sin(k * 0.085 + 1.7)


def build_rings():
    rings = []
    for i in range(N_RINGS):
        z0 = i * RING_SPACING
        is_gate = abs(z0 - GATE_Z) < RING_SPACING * 0.6
        rings.append({"z0": z0, "r": ring_radius(z0 / RING_SPACING),
                      "cx": path_x(z0 / RING_SPACING), "cy": path_y(z0 / RING_SPACING),
                      "gate": is_gate})
    return rings


def build_particles():
    ps = []
    for _ in range(N_PARTICLES):
        ang = random.uniform(0, 2 * math.pi)
        rad = random.uniform(0.2, 0.9)
        ps.append({"ang": ang, "rad": rad, "z0": random.uniform(0, LOOP),
                   "activation": random.uniform(0, 0.7), "size_bias": random.uniform(0.6, 1.4)})
    return ps


def project(x, y, z, w, h, focal, cam_x, cam_y):
    z = max(z, 1.0)
    sx = w / 2.0 + (x - cam_x) * focal / z
    sy = h * 0.46 + (y - cam_y) * focal / z
    return sx, sy


def ring_points(ring, sides=RING_SIDES):
    if ring["gate"]:
        # a wide rectangular threshold frame, distinct from the round trusses,
        # marking "entering the depot" without ever cutting the shot
        w2, h2 = ring["r"] * 1.35, ring["r"] * 1.0
        return [(ring["cx"] - w2, ring["cy"] - h2), (ring["cx"] + w2, ring["cy"] - h2),
                (ring["cx"] + w2, ring["cy"] + h2), (ring["cx"] - w2, ring["cy"] + h2)]
    pts = []
    for s in range(sides):
        a = (s / sides) * 2 * math.pi
        pts.append((ring["cx"] + ring["r"] * math.cos(a), ring["cy"] + ring["r"] * math.sin(a)))
    return pts


# ---- a simple wireframe cab-over box truck, drawn as 12+8 edges ----
def truck_edges(z0, k_hint):
    r = ring_radius(k_hint)
    cx, cy = path_x(k_hint), path_y(k_hint)
    floor_y = cy + r * 0.55
    cab_w, cab_h, cab_d = 62, 78, 62
    trl_w, trl_h, trl_d = 80, 96, 190

    def box(w, h, d, z_start):
        x0, x1 = cx - w / 2, cx + w / 2
        y0, y1 = floor_y - h, floor_y
        z_a, z_b = z0 + z_start, z0 + z_start + d
        corners = {
            'a': (x0, y0, z_a), 'b': (x1, y0, z_a), 'c': (x1, y1, z_a), 'd': (x0, y1, z_a),
            'e': (x0, y0, z_b), 'f': (x1, y0, z_b), 'g': (x1, y1, z_b), 'h': (x0, y1, z_b),
        }
        edges = [('a', 'b'), ('b', 'c'), ('c', 'd'), ('d', 'a'),
                 ('e', 'f'), ('f', 'g'), ('g', 'h'), ('h', 'e'),
                 ('a', 'e'), ('b', 'f'), ('c', 'g'), ('d', 'h')]
        return corners, edges

    cab_c, cab_e = box(cab_w, cab_h, cab_d, 0)
    trl_c, trl_e = box(trl_w, trl_h, trl_d, cab_d + 6)
    return [(cab_c, cab_e), (trl_c, trl_e)]


def make_glow_sprite(radius, color):
    size = max(3, radius * 2 + 1)
    ys, xs = np.mgrid[0:size, 0:size]
    c = size / 2.0
    dist = np.sqrt((xs - c) ** 2 + (ys - c) ** 2) / (size / 2.0)
    alpha = np.clip(1 - dist, 0, 1) ** 2.3
    alpha = (alpha * 255).astype("uint8")
    img = Image.new("RGBA", (size, size), (int(color[0]), int(color[1]), int(color[2]), 0))
    img.putalpha(Image.fromarray(alpha, "L"))
    return img


def make_bg(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h * 0.46
    maxd = math.hypot(max(cx, w - cx), max(cy, h - cy))
    dist = np.clip(np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / maxd, 0, 1)
    base = np.array([3, 6, 10])
    core = np.array([6, 18, 24])
    t = (1 - dist) ** 1.8
    rgb = base[None, None, :] + (core[None, None, :] - base[None, None, :]) * t[:, :, None]
    return Image.fromarray(rgb.astype("uint8"), "RGB")


def make_vignette(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h / 2.0
    maxd = math.hypot(cx, cy)
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / maxd
    a = np.clip((dist - 0.5) / 0.5, 0, 1) ** 1.3 * 175
    rgba = np.zeros((h, w, 4), dtype="uint8")
    rgba[:, :, 3] = a.astype("uint8")
    return Image.fromarray(rgba, "RGBA")


PIPELINE_WALK = None


def get_route_walk(n=40):
    global PIPELINE_WALK
    if PIPELINE_WALK is None:
        rnd = random.Random(3)
        vals, v = [], 0.1
        for i in range(n):
            v += rnd.uniform(0.005, 0.045)
            vals.append(min(1.0, v))
        PIPELINE_WALK = vals
    return PIPELINE_WALK


def draw_hud(draw, w, h, t, font_sm, font_lg):
    ac = tuple(int(c) for c in CYAN) + (255,)
    reveal = smoothstep((t - 0.15) / 0.3)
    if reveal > 0.02:
        km = int(lerp(0, 118, t))
        eta = int(lerp(34, 2, t))
        draw.text((w * 0.045, h * 0.14), f"{km} KM", font=font_lg, fill=(255, 190, 90, int(230 * reveal)))
        draw.text((w * 0.045 + 118, h * 0.14 + 6), f"{eta:02d}:00 ETA", font=font_sm, fill=ac[:3] + (int(200 * reveal),))
    reveal2 = smoothstep((t - 0.4) / 0.4)
    if reveal2 > 0.02:
        pw, ph = int(w * 0.2), int(h * 0.13)
        px0, py0 = w - pw - int(w * 0.035), h - ph - int(h * 0.06)
        draw.rounded_rectangle([px0, py0, px0 + pw, py0 + ph], radius=12,
                                fill=(6, 12, 16, int(150 * reveal2)), outline=ac[:3] + (int(120 * reveal2),), width=1)
        draw.text((px0 + 14, py0 + 10), "UNIT NX-0442-SA", font=font_sm, fill=ac[:3] + (int(210 * reveal2),))
        walk = get_route_walk()
        n_show = max(2, int(len(walk) * reveal2))
        pad = 14
        cx0, cy0 = px0 + pad, py0 + ph - pad
        cw, ch = pw - pad * 2, ph - pad * 2 - 12
        pts = [(cx0 + cw * (i / (len(walk) - 1)), cy0 - ch * walk[i]) for i in range(n_show)]
        if len(pts) >= 2:
            draw.line(pts, fill=ac[:3] + (int(220 * reveal2),), width=2)
    reveal3 = smoothstep((t - 0.6) / 0.35)
    if reveal3 > 0.02:
        bx, by = int(w * 0.045), int(h * 0.2)
        draw.text((bx, by), "TELEMETRY ONBOARD", font=font_sm, fill=ac[:3] + (int(200 * reveal3),))
        for i in range(4):
            yy = by + 20 + i * 13
            level = 0.35 + 0.55 * (0.5 + 0.5 * math.sin(t * 16 + i * 1.9))
            draw.rounded_rectangle([bx, yy, bx + w * 0.1, yy + 4], radius=2, fill=(255, 255, 255, int(24 * reveal3)))
            draw.rounded_rectangle([bx, yy, bx + w * 0.1 * level, yy + 4], radius=2, fill=ac[:3] + (int(210 * reveal3),))


def render_frame(t, w, h, rings, particles, sprite_cache, font_sm, font_lg):
    focal = max(w, h) * 0.30
    S = (t ** 1.1) * TOTAL_TRAVEL
    cam_k = S / RING_SPACING
    cam_x, cam_y = path_x(cam_k), path_y(cam_k)

    img = make_bg(w, h)
    struct = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(struct)

    edges_on = 2 + int(round(lerp(2, RING_SIDES - 2, smoothstep(t))))
    wall_a = lerp(50, 170, smoothstep(t))
    ring_a = lerp(90, 230, smoothstep(t))
    cc = tuple(int(c) for c in CYAN)

    visible = []
    for ring in rings:
        z = ring["z0"] - S + NEAR
        if z < NEAR or z > FAR:
            continue
        pts = [project(px, py, z, w, h, focal, cam_x, cam_y) for px, py in ring_points(ring)]
        fade = smoothstep(1 - (z - NEAR) / (FAR - NEAR))
        visible.append((ring["z0"], z, pts, fade, ring["gate"]))
    visible.sort(key=lambda v: -v[1])

    for z0, z, pts, fade, gate in visible:
        a = int((ring_a * 1.4 if gate else ring_a) * fade)
        if a > 3:
            sd.line(pts + [pts[0]], fill=cc + (a,), width=3 if gate else 2)

    by_z = {round(v[0]): v for v in visible}
    for z0, z, pts, fade, gate in visible:
        nxt = by_z.get(round(z0 + RING_SPACING))
        if not nxt:
            continue
        npts, nfade = nxt[2], nxt[3]
        a = int(wall_a * min(fade, nfade))
        if a <= 3:
            continue
        n_edges = min(edges_on, len(pts))
        step = max(1, len(pts) // n_edges)
        for s in range(0, len(pts), step):
            sd.line([pts[s], npts[s % len(npts)]], fill=cc + (a,), width=1)

    # ---- trucks: fixed in world space, camera flies toward and past them ----
    for tz in TRUCK_Z:
        z_front = tz - S + NEAR
        if z_front < NEAR - 300 or z_front > FAR:
            continue
        k_hint = tz / RING_SPACING
        fade = smoothstep(1 - max(0, (z_front - NEAR)) / (FAR - NEAR)) if z_front > NEAR else 1.0
        boxes = truck_edges(tz, k_hint)
        for corners, edges in boxes:
            proj = {}
            ok = True
            for name, (lx, ly, lz) in corners.items():
                zz = lz - S + NEAR
                if zz < 4:
                    ok = False
                    break
                proj[name] = project(lx, ly, zz, w, h, focal, cam_x, cam_y)
            if not ok:
                continue
            a = int(210 * fade)
            for p, q in edges:
                sd.line([proj[p], proj[q]], fill=cc + (max(30, a),), width=2)

    img = Image.alpha_composite(img.convert("RGBA"), struct)

    # ---- ambient drifting light nodes ----
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    buckets = [3, 5, 8, 12, 18]
    for p in particles:
        if t < p["activation"]:
            continue
        d = (p["z0"] - S) % LOOP
        z = NEAR + d
        k = z / RING_SPACING + cam_k
        r = ring_radius(k) * p["rad"]
        wx = path_x(k) + r * math.cos(p["ang"])
        wy = path_y(k) + r * math.sin(p["ang"])
        sx, sy = project(wx, wy, z, w, h, focal, cam_x, cam_y)
        if sx < -40 or sx > w + 40 or sy < -40 or sy > h + 40:
            continue
        depth_f = focal / z
        size = max(1.5, min(26, p["size_bias"] * depth_f * 1.4))
        bright = max(0.15, min(1.0, depth_f * 0.8))
        b = min(buckets, key=lambda x: abs(x - size))
        key = (b,)
        sprite = sprite_cache.get(key)
        if sprite is None:
            sprite = make_glow_sprite(b, CYAN)
            sprite_cache[key] = sprite
        a = sprite.split()[3].point(lambda v, br=bright: int(v * br))
        tinted = sprite.copy(); tinted.putalpha(a)
        glow.alpha_composite(tinted, (int(sx - sprite.width / 2), int(sy - sprite.height / 2)))
    img = Image.alpha_composite(img, glow)

    hud = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_hud(ImageDraw.Draw(hud), w, h, t, font_sm, font_lg)
    img = Image.alpha_composite(img, hud)
    return img.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, default=360)
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    rings = build_rings()
    particles = build_particles()
    vign_d = make_vignette(DESK_W, DESK_H)
    vign_m = make_vignette(MOB_W, MOB_H)
    font_sm = ImageFont.truetype(FONT_PATH, 13)
    font_lg = ImageFont.truetype(FONT_PATH, 22)
    cache = {}

    if args.test:
        os.makedirs("/tmp/flight-preview", exist_ok=True)
        for t in [0, 0.1, 0.22, 0.35, 0.5, 0.65, 0.8, 0.92, 1.0]:
            img = render_frame(t, DESK_W, DESK_H, rings, particles, cache, font_sm, font_lg)
            img = Image.alpha_composite(img.convert("RGBA"), vign_d).convert("RGB")
            path = f"/tmp/flight-preview/t{t:.2f}.jpg"
            img.save(path, quality=88)
            print("wrote", path)
        return

    os.makedirs(OUT_DESK, exist_ok=True)
    os.makedirs(OUT_MOB, exist_ok=True)
    n = args.frames
    for i in range(n):
        t = i / (n - 1)
        d = render_frame(t, DESK_W, DESK_H, rings, particles, cache, font_sm, font_lg)
        d = Image.alpha_composite(d.convert("RGBA"), vign_d).convert("RGB")
        d.save(os.path.join(OUT_DESK, f"f{i+1:04d}.jpg"), quality=84, optimize=True)
        m = render_frame(t, MOB_W, MOB_H, rings, particles, cache, font_sm, font_lg)
        m = Image.alpha_composite(m.convert("RGBA"), vign_m).convert("RGB")
        m.save(os.path.join(OUT_MOB, f"f{i+1:04d}.webp"), quality=82)
        if (i + 1) % 30 == 0:
            print(f"{i+1}/{n}")


if __name__ == "__main__":
    main()
