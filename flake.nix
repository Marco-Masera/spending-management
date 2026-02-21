{
  description = "spending-management dev shell (android build)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };

        jdk = pkgs.jdk17;

        androidPkgs = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [ "35" ];
          buildToolsVersions = [ "35.0.0" ];
          includeEmulator = false;
          includeNDK = false;
          includeSystemImages = false;
        };

        androidSdk = androidPkgs.androidsdk;
        androidHome = "${androidSdk}/libexec/android-sdk";
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            jdk
            androidSdk
            gcc
            gradle
            jdk
            maven
            ncurses
            patchelf
            zlib
          ];

          ANDROID_HOME = androidHome;
          ANDROID_SDK_ROOT = androidHome;
          JAVA_HOME = jdk;

          # Help Gradle on NixOS.
          GRADLE_OPTS = "-Dorg.gradle.java.home=${jdk}";
        };
        shellHook = let
          loadLombok = "-javaagent:${pkgs.lombok}/share/java/lombok.jar";
          prev = "\${JAVA_TOOL_OPTIONS:+ $JAVA_TOOL_OPTIONS}";
        in ''
          export JAVA_TOOL_OPTIONS="${loadLombok}${prev}"
        '';
      });
}
