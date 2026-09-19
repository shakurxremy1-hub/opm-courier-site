#!/usr/bin/env bash
# Re-grades the already-extracted flythrough frames into the deep-navy/cyan
# "telemetry HUD" night look from the reference video, in place.
set -euo pipefail
cd "$(dirname "$0")/.."

GRADE="eq=contrast=1.3:brightness=-0.1:saturation=0.5:gamma=0.85,colorbalance=rs=-0.2:gs=-0.05:bs=0.15:rm=-0.2:gm=0.0:bm=0.3:rh=-0.15:gh=0.1:bh=0.4,curves=all='0/0 0.5/0.4 1/1'"

echo "grading desktop frames..."
for f in assets/frames/*.jpg; do
  ffmpeg -y -i "$f" -vf "$GRADE" -q:v 3 "${f}.tmp.jpg" -loglevel error
  mv "${f}.tmp.jpg" "$f"
done

echo "grading mobile frames..."
for f in assets/frames-m/*.webp; do
  tmp="${f%.webp}.tmp.jpg"
  ffmpeg -y -i "$f" -vf "$GRADE" -q:v 4 "$tmp" -loglevel error
  cwebp -quiet -q 80 "$tmp" -o "$f"
  rm "$tmp"
done

echo "desktop: $(ls assets/frames | wc -l)  mobile: $(ls assets/frames-m | wc -l)"
