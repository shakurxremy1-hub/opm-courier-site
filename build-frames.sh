#!/usr/bin/env bash
# build-frames.sh — turn scene clips into the desktop + mobile frame sets.
#
#   src/*.mp4   landscape 16:9 scene clips, sorted by name (scene1, scene2, …)
#
# Output:
#   assets/frames/fNNNN.jpg    1440w JPEG   (desktop)
#   assets/frames-m/fNNNN.jpg  640x1138 JPEG (mobile portrait, centre-cropped)
#
# Requires: ffmpeg
set -euo pipefail

FPS="${FPS:-8}"
DESKTOP_W="${DESKTOP_W:-1440}"
MOBILE_W="${MOBILE_W:-640}"
MOBILE_H="${MOBILE_H:-1138}"
JPEG_Q="${JPEG_Q:-3}"

command -v ffmpeg >/dev/null || { echo "need ffmpeg"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mapfile -t LAND < <(ls src/*.mp4 2>/dev/null | sort)
[ "${#LAND[@]}" -gt 0 ] || { echo "no clips in src/*.mp4"; exit 1; }
echo "landscape clips: ${#LAND[@]}"

: > "$WORK/land.txt"
i=0
for f in "${LAND[@]}"; do
  i=$((i+1)); o="$WORK/L$(printf '%02d' $i).mp4"
  ffmpeg -v error -y -i "$f" \
    -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=$FPS,setsar=1" \
    -an -c:v libx264 -pix_fmt yuv420p -g 4 "$o"
  echo "file '$o'" >> "$WORK/land.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/land.txt" -an -c copy "$WORK/land.mp4"

rm -rf assets/frames && mkdir -p assets/frames
ffmpeg -v error -i "$WORK/land.mp4" -vf "scale=${DESKTOP_W}:-2:flags=lanczos" \
  -q:v "$JPEG_Q" "assets/frames/f%04d.jpg"
N=$(ls assets/frames | wc -l | tr -d ' ')
echo "desktop frames: $N  ($(du -sh assets/frames | cut -f1))"

rm -rf assets/frames-m && mkdir -p assets/frames-m
ffmpeg -v error -i "$WORK/land.mp4" \
  -vf "crop=ih*${MOBILE_W}/${MOBILE_H}:ih,scale=${MOBILE_W}:${MOBILE_H}:flags=lanczos" \
  -q:v "$JPEG_Q" "assets/frames-m/f%04d.jpg"
M=$(ls assets/frames-m | wc -l | tr -d ' ')
echo "mobile frames:  $M  ($(du -sh assets/frames-m | cut -f1))"

echo
if [ "$N" != "$M" ]; then
  echo "!! desktop ($N) and mobile ($M) frame counts differ — trim the longer set"
else
  echo "==> set  frameCount: $N  and  frameCountMobile: $M  in index.html"
fi
