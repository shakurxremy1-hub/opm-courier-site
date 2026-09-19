#!/usr/bin/env bash
# Builds the hero flythrough frame sequence from real stock footage of an
# actual courier journey: warehouse hub -> highway transit -> warehouse stop
# -> sorting floor -> doorstep delivery -> handoff. 60 frames per clip x 6
# clips = 360 frames, matching frameCount:360 in index.html. Real footage,
# not procedural — this is the "cinematic, going through real places" version.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=/tmp/courier-stock
OUT_D=assets/frames
OUT_M=assets/frames-m
mkdir -p "$OUT_D" "$OUT_M"

# name : start(s) : duration(s)
CLIPS=(
  "warehouse-facility:1.2:16.5"
  "truck-highway:1.0:12.5"
  "warehouse-arrival:0.5:8.3"
  "forklift:1.0:19.5"
  "loading-dolly:0.3:5.7"
  "door-delivery:0.5:8.5"
)

GRADE="eq=contrast=1.10:saturation=1.08:brightness=-0.02,vignette=PI/5.5,unsharp=5:5:0.5"

idx=0
for entry in "${CLIPS[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  start="${rest%%:*}"
  dur="${rest#*:}"
  base=$((idx * 60))

  echo "=== $name (start=$start dur=$dur) frames $((base+1))-$((base+60)) ==="

  # desktop: 1920x1080, 60 evenly spaced frames over the trimmed span
  ffmpeg -y -ss "$start" -t "$dur" -i "$SRC/$name.mp4" \
    -vf "fps=60/$dur,scale=1920:1080:flags=lanczos,$GRADE" \
    -q:v 3 -start_number $((base + 1)) "$OUT_D/f%04d.jpg" -loglevel error

  # mobile: center-crop to 9:16 (405x720 of the 1280x720 source region),
  # then scale up to 576x1024
  ffmpeg -y -ss "$start" -t "$dur" -i "$SRC/$name.mp4" \
    -vf "fps=60/$dur,crop=405:720:(in_w-405)/2:0,scale=576:1024:flags=lanczos,$GRADE" \
    -q:v 4 -start_number $((base + 1)) "$OUT_M/f%04d_tmp.jpg" -loglevel error

  idx=$((idx + 1))
done

echo "converting mobile frames to webp..."
for f in "$OUT_M"/*_tmp.jpg; do
  [ -e "$f" ] || continue
  out="${f/_tmp.jpg/.webp}"
  cwebp -quiet -q 80 "$f" -o "$out"
  rm "$f"
done

echo "desktop frames: $(ls "$OUT_D" | wc -l)"
echo "mobile frames:  $(ls "$OUT_M" | wc -l)"
