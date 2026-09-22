#!/usr/bin/env bash
# build-frames.sh — turn scene clips into the desktop + mobile frame sets.
#
#   src/*.mp4            landscape 16:9 scene clips, sorted by name (scene1, scene2, …)
#   src/portrait/*.mp4   OPTIONAL 9:16 versions of the same scenes, same count/order.
#                        If missing, the mobile frames are centre-cropped from the
#                        landscape concat (works, but softer).
#
# Output:
#   assets/frames/fNNNN.jpg    1440w, JPEG q4     (desktop)
#   assets/frames-m/fNNNN.webp 640x1138, WebP q72 (mobile portrait)
#
# Requires: ffmpeg, cwebp
set -euo pipefail

FPS="${FPS:-8}"                 # frames per second of source -> flight frames
DESKTOP_W="${DESKTOP_W:-1440}"
MOBILE_W="${MOBILE_W:-640}"
MOBILE_H="${MOBILE_H:-1138}"    # 640 * 16/9 rounded to even
JPEG_Q="${JPEG_Q:-4}"           # ffmpeg -q:v, lower = better
WEBP_Q="${WEBP_Q:-72}"

command -v ffmpeg >/dev/null || { echo "need ffmpeg"; exit 1; }
command -v cwebp  >/dev/null || { echo "need cwebp (brew install webp)"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mapfile -t LAND < <(ls src/*.mp4 2>/dev/null | sort)
[ "${#LAND[@]}" -gt 0 ] || { echo "no clips in src/*.mp4"; exit 1; }
echo "landscape clips: ${#LAND[@]}"

# ---- desktop: normalise each clip to 1920x1080, concat, extract ----
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

# ---- mobile: portrait source if present, else crop the landscape concat ----
mapfile -t PORT < <(ls src/portrait/*.mp4 2>/dev/null | sort)
if [ "${#PORT[@]}" -gt 0 ]; then
  echo "portrait clips: ${#PORT[@]}"
  : > "$WORK/port.txt"; i=0
  for f in "${PORT[@]}"; do
    i=$((i+1)); o="$WORK/P$(printf '%02d' $i).mp4"
    ffmpeg -v error -y -i "$f" \
      -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=$FPS,setsar=1" \
      -an -c:v libx264 -pix_fmt yuv420p -g 4 "$o"
    echo "file '$o'" >> "$WORK/port.txt"
  done
  ffmpeg -v error -y -f concat -safe 0 -i "$WORK/port.txt" -an -c copy "$WORK/port.mp4"
  SRC_M="$WORK/port.mp4"; VF_M="scale=${MOBILE_W}:${MOBILE_H}:flags=lanczos"
else
  echo "no src/portrait/ — centre-cropping mobile frames from the landscape concat"
  SRC_M="$WORK/land.mp4"; VF_M="crop=ih*9/16:ih,scale=${MOBILE_W}:${MOBILE_H}:flags=lanczos"
fi

rm -rf assets/frames-m "$WORK/m" && mkdir -p assets/frames-m "$WORK/m"
ffmpeg -v error -i "$SRC_M" -vf "$VF_M" -q:v 3 "$WORK/m/f%04d.jpg"
for f in "$WORK"/m/f*.jpg; do
  cwebp -quiet -q "$WEBP_Q" -m 4 "$f" -o "assets/frames-m/$(basename "$f" .jpg).webp"
done
M=$(ls assets/frames-m | wc -l | tr -d ' ')
echo "mobile frames:  $M  ($(du -sh assets/frames-m | cut -f1))"

echo
if [ "$N" != "$M" ]; then
  echo "!! desktop ($N) and mobile ($M) frame counts differ — trim the longer set"
  echo "   so they match, then set both to the same number."
else
  echo "==> set  frameCount: $N  and  frameCountMobile: $M  in index.html"
fi
