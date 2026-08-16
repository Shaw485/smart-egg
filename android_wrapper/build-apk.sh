#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_ROOT="${SMART_EGG_ANDROID_SDK:?Set SMART_EGG_ANDROID_SDK}"
JAVA_ROOT="${SMART_EGG_JAVA_HOME:?Set SMART_EGG_JAVA_HOME}"
export JAVA_HOME="$JAVA_ROOT"
export PATH="$JAVA_ROOT/bin:$PATH"
BUILD_TOOLS="${SMART_EGG_BUILD_TOOLS:-35.0.0}"
PLATFORM="${SMART_EGG_PLATFORM:-android-35}"
BUILD_DIR="$SCRIPT_DIR/build"
ANDROID_JAR="$SDK_ROOT/platforms/$PLATFORM/android.jar"
TOOLS_DIR="$SDK_ROOT/build-tools/$BUILD_TOOLS"

mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex"
"$JAVA_ROOT/bin/javac" -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD_DIR/classes" "$SCRIPT_DIR/src/com/shaw485/smartegg/MainActivity.java"
"$TOOLS_DIR/d8" --lib "$ANDROID_JAR" --min-api 23 \
  --output "$BUILD_DIR/dex" "$BUILD_DIR/classes/com/shaw485/smartegg/MainActivity.class"
"$TOOLS_DIR/aapt2" compile --dir "$SCRIPT_DIR/res" -o "$BUILD_DIR/compiled-res.zip"
"$TOOLS_DIR/aapt2" link -o "$BUILD_DIR/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest "$SCRIPT_DIR/AndroidManifest.xml" -A "$SCRIPT_DIR/assets" \
  --min-sdk-version 23 --target-sdk-version 35 --version-code 134 --version-name 44.0 \
  "$BUILD_DIR/compiled-res.zip"
(cd "$BUILD_DIR/dex" && zip -q -j "$BUILD_DIR/unsigned.apk" classes.dex)
"$TOOLS_DIR/zipalign" -f 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

if [[ ! -f "$BUILD_DIR/smart-egg.keystore" ]]; then
  "$JAVA_ROOT/bin/keytool" -genkeypair -v -keystore "$BUILD_DIR/smart-egg.keystore" \
    -storepass android -alias smartegg -keypass android -keyalg RSA -keysize 2048 \
    -validity 10000 -dname "CN=Smart Egg, OU=Game, O=Smart Egg, C=CN"
fi

"$TOOLS_DIR/apksigner" sign --ks "$BUILD_DIR/smart-egg.keystore" \
  --ks-pass pass:android --key-pass pass:android \
  --out "$BUILD_DIR/Smart-Egg-v134.apk" "$BUILD_DIR/aligned.apk"
"$TOOLS_DIR/apksigner" verify --verbose "$BUILD_DIR/Smart-Egg-v134.apk"
