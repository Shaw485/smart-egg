#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SMART_EGG_SDK="${ANDROID_SDK_ROOT:-${HOME}/Library/Android/sdk}"
APK_PATH="$(find "$PROJECT_DIR/dist" -maxdepth 1 -name 'Smart-Egg-v*.apk' -print | sort -V | tail -n 1)"

if [[ -z "$APK_PATH" ]]; then
  echo "没有找到 dist/Smart-Egg-v*.apk"
  exit 1
fi

"$SMART_EGG_SDK/platform-tools/adb" wait-for-device
"$SMART_EGG_SDK/platform-tools/adb" install -r "$APK_PATH"
"$SMART_EGG_SDK/platform-tools/adb" shell am force-stop com.shaw485.smartegg
"$SMART_EGG_SDK/platform-tools/adb" shell am start -n com.shaw485.smartegg/.MainActivity
echo "已安装并启动：$APK_PATH"
