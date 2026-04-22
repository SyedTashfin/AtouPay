# ATouPay

ATouPay is an Expo Router mobile MVP focused only on payment-first rental workflows for tenants and owners.

## Local native development on Mac

This project is set up for local development builds on macOS using iOS Simulator and Android Emulator. It does not require Expo Go for day-to-day development.

### Prerequisites

- Node.js and npm installed locally
- Xcode installed from the App Store
- Xcode command line tools installed: `xcode-select --install`
- Android Studio installed with:
  - Android SDK
  - Android Emulator
  - at least one bootable Android Virtual Device (AVD)

### Install dependencies

```bash
cd /Users/syedtashfin/Documents/GitHub/AtouPay
npm install
```

### Verify the project

```bash
npm run doctor
npm run typecheck
```

### Start Metro

Run Metro in one terminal and keep it open:

```bash
npm run start
```

### Run on iOS Simulator

Boot a simulator first if needed:

```bash
open -a Simulator
```

Then build and install the local development build:

```bash
npm run ios
```

Notes:
- The first `npm run ios` may take longer because Expo will generate native iOS files and compile the development build locally.
- `npm run ios` is configured with `--no-bundler`, so Metro should already be running via `npm run start`.

### Run on Android Emulator

Start an Android emulator from Android Studio Device Manager first, then run:

```bash
npm run android
```

Notes:
- The first `npm run android` may take longer because Expo will generate native Android files and compile the development build locally.
- `npm run android` is configured with `--no-bundler`, so Metro should already be running via `npm run start`.

### Reset Metro cache

If Metro is behaving unexpectedly, restart it with a clean cache:

```bash
npm run start:clear
```

### Optional local config

The app already includes a simple runtime config layer for future API endpoints. If you want to override it locally, you can export environment variables before running Metro or native builds:

```bash
export APP_VARIANT=development
export EXPO_PUBLIC_API_BASE_URL=https://placeholder-api.atoupay.local
export EXPO_PUBLIC_ENABLE_DEV_TOOLS=true
```

## Troubleshooting

### Android emulator not detected

1. Start an emulator manually from Android Studio > Device Manager.
2. Confirm the emulator is visible to ADB:

```bash
adb devices
```

3. If `adb` is not found, add Android SDK tools to your shell profile:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

4. Re-open the terminal and run `npm run android` again.

### iOS simulator not opening

1. Make sure Xcode is installed and has been opened at least once.
2. Install command line tools if needed:

```bash
xcode-select --install
```

3. Open Simulator manually:

```bash
open -a Simulator
```

4. If Xcode path selection is wrong, reset it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Metro port conflicts

If port `8081` is already in use:

```bash
lsof -nP -iTCP:8081
kill -9 <PID>
```

Then restart Metro:

```bash
npm run start:clear
```

### Stale native build caches

If simulator/emulator builds get stuck on stale native caches:

```bash
npm run prebuild:clean
```

For iOS, you can also clear Xcode derived data:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

For Android, if native Android files already exist, you can clean Gradle:

```bash
cd android && ./gradlew clean
```

Then restart Metro and rerun the platform build:

```bash
npm run start
npm run ios
# or
npm run android
```
