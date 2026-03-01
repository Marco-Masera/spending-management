# Spending Management

This is an ionic + vue app for spending management for android.

## IMPORTANT NOTES
- This app is completely new. There are no users for the app. We can and should always approach problems without considering backwards compatibility. We will not break any existing user's flow by doing so.

## Standard Operating Procedures
- When making code changes
  - Always run `npm run checks` and `npm run build`.  Fix any issues before returning control over to the user

## System
- If there is a system level dependency add it to flake.nix file so it can be reused across dev environments
- If you need to run commands that use a system dependency (such as node, npm, etc). Always run them through the nix flake where the correct version of all such dependencies is. Use `nix develop -c {command}` to run those commands. For example `nix develop -c npm run dev`

## Tests
- We use vitetest for tests
- Unit tests with vitest should be place next to the file they are testing following the convertion of {filename}.test.ts

## Using this document
- This document is for you. If you get stuck on a problem for a while and eventually find a solution feel free to append that finding to the Agent notes section of this document to improve your understanding. Additionally remove anything that becomes out of date from that section.


## Agent Notes
 
