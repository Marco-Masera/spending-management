# spending-management

Simple app to keep track of your spendings. Developed with Ionic and Vue.

Available on Play Store too: https://play.google.com/store/apps/details?id=mmasera.spendingmanager.com

## Development

This repo uses a Nix flake for consistent tool versions.

```bash
# Enter the dev shell once, then use npm scripts.
nix develop

# Web dev
npm run dev

# Quality checks
npm run lint
npm run typecheck
npm run test:unit

# Web build only
npm run web:build
```

## Android

```bash
# From inside `nix develop` (or `nix develop .#emulator`):

# Build (web + Android)
npm run build

# Build debug (web + Android)
npm run build:debug
```

## Android Emulator

The Android emulator is available via a separate, heavier Nix dev shell that
includes the emulator binaries, system images, and Android Studio.

Prerequisites (host)

- Hardware virtualization enabled in BIOS/UEFI
- KVM available and accessible (`/dev/kvm` exists and is writable by your user)

```bash
# Enter the emulator dev shell (includes emulator + system images + Android Studio)
nix develop .#emulator

# The AVD name comes from the Nix flake env var:
echo "SMT_EMULATOR_AVD_NAME=$SMT_EMULATOR_AVD_NAME"

# Start a clean emulator (this nukes and recreates the AVD first)
npm run emulator:start

# One-command live reload dev flow (starts emulator + Vite + cap run -l)
npm run emulator:dev

# Build + (re)install debug + launch (no live reload)
npm run emulator:app:run

# Tail logs
npm run emulator:logcat

# Optional: delete the AVD (start will recreate it)
npm run emulator:nuke

# Optional: open Android Studio (Device Manager, logcat UI, etc)
android-studio
```
