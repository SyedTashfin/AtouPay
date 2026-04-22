# ATouPay

ATouPay is an Expo Router mobile MVP focused only on payment-first rental workflows for tenants and owners.

## Local native development on Mac

This project is configured for laptop-first Expo native development on macOS with:

- iOS Simulator
- Android Emulator
- Expo development builds via `expo-dev-client`
- local Metro bundling
- local native compilation with `npx expo run:ios` and `npx expo run:android`

### Prerequisites

Make sure the laptop has the following installed and working:

- Node.js and npm
- Xcode
- Xcode Command Line Tools
- at least one installed iOS Simulator runtime
- Watchman
- Android Studio
- Android SDK
- Android SDK command-line tools
- Java 17
- at least one bootable Android Virtual Device (AVD)

Recommended shell environment variables:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
```

### Install dependencies

```bash
cd /Users/syedtashfin/Documents/GitHub/AtouPay
npm install
```

### How to start Metro

Run Metro in one terminal and leave it running:

```bash
npm run start
```

Equivalent direct Expo command:

```bash
npx expo start --dev-client
```

### How to open iOS Simulator

```bash
open -a Simulator
```

If no simulator is booted yet, Xcode or Expo will usually boot one automatically. You can also keep the currently booted simulator open while running local builds.

### How to run on iOS locally

Use the local native compile workflow:

```bash
npm run ios
```

Equivalent direct Expo command:

```bash
npx expo run:ios --no-bundler
```

Notes:
- Keep Metro running first with `npm run start` because the iOS script is configured with `--no-bundler`.
- The first local run may generate the `ios/` folder and install CocoaPods.
- The first native build can take several minutes.

### How to open Android Emulator

Start the default emulator from the terminal:

```bash
emulator -avd Pixel_8_API_34
```

Or open it from Android Studio > Device Manager.

Verify the emulator is connected:

```bash
adb devices
```

### How to run on Android locally

Use the local native compile workflow:

```bash
npm run android
```

Equivalent direct Expo command:

```bash
npx expo run:android --no-bundler
```

Notes:
- Keep Metro running first with `npm run start` because the Android script is configured with `--no-bundler`.
- The first local run may generate the `android/` folder and download missing native toolchain pieces such as NDK/build tools.
- The first native Android build can take several minutes.

### How to clear Metro cache

```bash
npm run start:clear
```

Equivalent direct Expo command:

```bash
npx expo start --dev-client --clear
```

### How to recover from stale native builds

If native folders or generated native state get out of sync, rebuild from a clean Expo prebuild:

```bash
npm run prebuild:clean
```

Then rerun Metro and the platform build:

```bash
npm run start
npm run ios
# or
npm run android
```

Additional cleanup commands:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
cd android && ./gradlew clean
```

### How to rerun Expo Doctor

```bash
npm run doctor
```

Equivalent direct Expo command:

```bash
npx expo-doctor
```

### Any environment variables that matter

This app reads a small set of environment variables for local configuration:

```bash
export APP_VARIANT=development
export EXPO_PUBLIC_API_BASE_URL=https://placeholder-api.atoupay.local
export EXPO_PUBLIC_ENABLE_DEV_TOOLS=true
```

Native toolchain environment variables that matter:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```

## Troubleshooting

### Xcode installed but simulator not opening

```bash
open -a Simulator
```

If that still fails:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcrun simctl list devices
```

If Expo built successfully but did not bring the Simulator window to the front, open it manually and relaunch the installed app:

```bash
open -a Simulator
xcrun simctl launch booted com.atoupay.mobile.dev
```

### Xcode license issues

Check Xcode first-launch status:

```bash
xcodebuild -checkFirstLaunchStatus
```

If Xcode asks for license acceptance or first-launch components, open Xcode once and complete the prompts, or run:

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

### watchman missing

Install with Homebrew:

```bash
brew install watchman
```

Verify:

```bash
watchman --version
```

### Android emulator not detected

Start an emulator and confirm ADB can see it:

```bash
adb devices
```

If needed, launch the default emulator manually:

```bash
emulator -avd Pixel_8_API_34
```

### adb not found

Add Android SDK tools to your shell profile:

```bash
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
```

Then open a new terminal and verify:

```bash
adb version
```

### JAVA_HOME issues

Set Java 17 explicitly:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
java -version
```

If Gradle or `sdkmanager` cannot find Java, re-open the shell after updating your shell profile.

### Metro port conflicts

Check what is using port 8081:

```bash
lsof -nP -iTCP:8081
```

Stop the conflicting process and restart Metro cleanly:

```bash
kill -9 <PID>
npm run start:clear
```

### stale native cache

Reset generated native state and local build caches:

```bash
npm run prebuild:clean
rm -rf ~/Library/Developer/Xcode/DerivedData
cd android && ./gradlew clean
```

Then rerun Metro and the platform build.

### project builds on web but not on native

Run the native sanity checks first:

```bash
npm run doctor
npm run typecheck
```

Then rebuild the native projects:

```bash
npm run prebuild:clean
npm run ios
# or
npm run android
```

If the issue is native-only, inspect `ios/` and `android/` build output rather than assuming the web bundle is representative.

### simulator/emulator boots but app does not install

Confirm the target device is visible:

```bash
xcrun simctl list devices available
adb devices
```

Then rerun the local native build:

```bash
npx expo run:ios --no-bundler
npx expo run:android --no-bundler
```

If the build succeeds but the app does not open automatically, launch it manually:

```bash
xcrun simctl launch booted com.atoupay.mobile.dev
adb shell monkey -p com.atoupay.mobile.dev -c android.intent.category.LAUNCHER 1
```