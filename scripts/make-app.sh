#!/bin/bash
#
# Builds ClinicMaxx.app on the Desktop: an icon (from assets/icon.svg) plus a
# launcher that starts the dev server and opens the browser.
#
# Re-run this any time the icon changes or the project folder moves.
#
#   ./scripts/make-app.sh            -> ~/Desktop/ClinicMaxx.app
#   ./scripts/make-app.sh /some/dir  -> /some/dir/ClinicMaxx.app

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="${1:-$HOME/Desktop}"
APP="$DEST_DIR/ClinicMaxx.app"
ICNS_OUT="$PROJECT_DIR/assets/ClinicMaxx.icns"

# The icon master may be a PNG (exported brand art) or an SVG. PNG wins if both
# are present, since that is the higher-fidelity source when one exists.
if   [ -f "$PROJECT_DIR/assets/icon.png" ]; then SOURCE="$PROJECT_DIR/assets/icon.png"
elif [ -f "$PROJECT_DIR/assets/icon.svg" ]; then SOURCE="$PROJECT_DIR/assets/icon.svg"
else echo "No assets/icon.png or assets/icon.svg to build from" >&2; exit 1
fi

# --- 1. rasterise the master into a full .iconset --------------------------
# macOS wants every size from 16 to 1024, at 1x and 2x. sips reads both PNG and
# SVG, so there is no third-party dependency here.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ICONSET="$WORK/ClinicMaxx.iconset"
mkdir -p "$ICONSET"

echo "Rendering icon from $(basename "$SOURCE")…"
sips -s format png -z 1024 1024 "$SOURCE" --out "$WORK/master.png" >/dev/null 2>&1

emit() { # emit <pixels> <filename>
  sips -s format png -z "$1" "$1" "$WORK/master.png" --out "$ICONSET/$2" >/dev/null 2>&1
}
emit 16   icon_16x16.png
emit 32   icon_16x16@2x.png
emit 32   icon_32x32.png
emit 64   icon_32x32@2x.png
emit 128  icon_128x128.png
emit 256  icon_128x128@2x.png
emit 256  icon_256x256.png
emit 512  icon_256x256@2x.png
emit 512  icon_512x512.png
cp "$WORK/master.png" "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$ICNS_OUT"
echo "  → $ICNS_OUT"

# --- 2. assemble the bundle ------------------------------------------------
echo "Building $APP…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp "$ICNS_OUT" "$APP/Contents/Resources/ClinicMaxx.icns"

# Bake the project path into the launcher so the app works from anywhere.
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$PROJECT_DIR/scripts/launcher.sh" \
  > "$APP/Contents/MacOS/ClinicMaxx"
chmod +x "$APP/Contents/MacOS/ClinicMaxx"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>                  <string>ClinicMaxx</string>
  <key>CFBundleDisplayName</key>           <string>ClinicMaxx</string>
  <key>CFBundleExecutable</key>            <string>ClinicMaxx</string>
  <key>CFBundleIconFile</key>              <string>ClinicMaxx</string>
  <key>CFBundleIdentifier</key>            <string>health.clinicmaxx.launcher</string>
  <key>CFBundleInfoDictionaryVersion</key> <string>6.0</string>
  <key>CFBundlePackageType</key>           <string>APPL</string>
  <key>CFBundleShortVersionString</key>    <string>1.0</string>
  <key>CFBundleVersion</key>               <string>1</string>
  <key>LSMinimumSystemVersion</key>        <string>12.0</string>
  <key>NSHighResolutionCapable</key>       <true/>
</dict>
</plist>
PLIST

# --- 3. make Finder notice the new icon ------------------------------------
touch "$APP"
/usr/bin/touch "$APP/Contents/Info.plist"
# Nudge the icon cache; harmless if it is not listening.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP" >/dev/null 2>&1 || true

echo "Done. Double-click $APP"
