#!/usr/bin/env bash
set -euo pipefail

SMART_EGG_SDK="${ANDROID_SDK_ROOT:-${HOME}/Library/Android/sdk}"
SMART_EGG_AVD="${SMART_EGG_AVD_NAME:-Smart_Egg_Phone}"

if "$SMART_EGG_SDK/platform-tools/adb" devices | grep -q '^emulator-'; then
  echo "Android 模拟器已经在运行。"
  exit 0
fi

"$SMART_EGG_SDK/emulator/emulator" "@$SMART_EGG_AVD" -gpu host >/tmp/smart-egg-emulator.log 2>&1 &
echo "已启动 ${SMART_EGG_AVD}；首次进入请点击系统全屏说明中的 Got it。"
