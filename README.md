# spending-management

Simple app to keep track of your spendings. Developed with Ionic and Vue.

Available on Play Store too: https://play.google.com/store/apps/details?id=mmasera.spendingmanager.com

## Development

This repo uses a Nix flake for consistent tool versions.

```bash
####
# Enter the dev shell once, then use npm scripts.
####
nix develop

####
# CouchDB (local dev)
####
# Local CouchDB data lives under .couchdb/ (ignored by git)
# Web UI: http://127.0.0.1:5984/_utils/#login

# Start CouchDB (creates the DB if missing)
npm run db:dev

# CouchDB URLs for sync (already automatically applied via env variables for dev):
# - Web (host browser):    http://admin:admin@127.0.0.1:5984/spending
# - Android emulator only: http://admin:admin@10.0.2.2:5984/spending


####
# Both android & web
####
npm run build
npm run build:debug

####
# Checks
####
npm run checks # runs typecheck & lint
npm run checks:lint
npm run checks:types
npm run tests # all tests 
npm run tests:unit # only unit tests


####
# Web only
####
npm run web:dev
npm run web:build

####
# Android only
####
npm run android:build
npm run android:build:debug


####
# Emulator.
####
# Prerequisites (host)
# - Hardware virtualization enabled in BIOS/UEFI
# - KVM available and accessible (`/dev/kvm` exists and is writable by your user)

# Requires entering emulator shell
nix develop .#emulator


# commands
npm run emulator:dev # starts dev emulator with live reloading!

npm run emulator:start # start emulator
npm run emulator:app:run # runs app in emulator
npm run emulator:logcat # logs
npm run emulator:nuke # nuke emulator
android-studio # open android studio

####
# Other useful stuff
####

# To view the browser console from the app in the emulator go to chrome on your computer and visit this page:
chrome://inspect/#devices
#
```

