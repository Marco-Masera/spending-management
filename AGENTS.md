# Spending Management

This is an ionic + vue app for spending management for android.

## System
- If there is a system level dependency add it to flake.nix file so it can be reused across dev environments
- If you need to run commands that use a system dependency (such as node, npm, etc). Always run them through the nix flake where the correct version of all such dependencies is. Use `nix develop -c {command}` to run those commands. For example `nix develop -c npm run dev`
