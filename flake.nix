{
  description = "spending-management dev shell (android build)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };

        jdk = pkgs.jdk21;

        androidPkgs = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [
            "35"
            "34"
          ];
          buildToolsVersions = [
            "35.0.0"
            "34.0.0"
          ];
          includeEmulator = false;
          includeNDK = false;
          includeSystemImages = false;
        };

        androidPkgsEmulator = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [
            "35"
            "34"
          ];
          buildToolsVersions = [
            "35.0.0"
            "34.0.0"
          ];

          includeEmulator = true;
          includeNDK = false;

          # Keep this minimal; you can add more images later.
          includeSystemImages = true;
          abiVersions = [ "x86_64" ];
          systemImageTypes = [ "default" ];
        };

        androidSdk = androidPkgs.androidsdk;
        androidSdkEmulator = androidPkgsEmulator.androidsdk;
        androidHome = "${androidSdk}/libexec/android-sdk";
        androidHomeEmulator = "${androidSdkEmulator}/libexec/android-sdk";
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.android-tools
            pkgs.couchdb3
            jdk
            androidSdk
          ];

          ANDROID_HOME = androidHome;
          ANDROID_SDK_ROOT = androidHome;
          JAVA_HOME = jdk;

          # Help Gradle on NixOS.
          GRADLE_OPTS = "-Dorg.gradle.java.home=${jdk}";

          shellHook =
            let
              loadLombok = "-javaagent:${pkgs.lombok}/share/java/lombok.jar";
              prev = "\${JAVA_TOOL_OPTIONS:+ $JAVA_TOOL_OPTIONS}";
            in
            ''
              export JAVA_TOOL_OPTIONS="${loadLombok}${prev}"
            '';
        };

        # Heavier shell with emulator + system images.
        devShells.emulator = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.android-tools
            pkgs.couchdb3
            pkgs.qemu_kvm
            pkgs.libGL
            pkgs.vulkan-loader
            pkgs.xorg.libX11
            pkgs.xorg.libxcb
            pkgs.xorg.libXcomposite
            pkgs.xorg.libXcursor
            pkgs.xorg.libXdamage
            pkgs.xorg.libXext
            pkgs.xorg.libXi
            pkgs.xorg.libXrandr
            pkgs.xorg.libXrender
            pkgs.xorg.libXScrnSaver
            pkgs.xorg.libXtst
            pkgs.libxkbcommon
            pkgs.glib
            pkgs.nss
            pkgs.nspr
            pkgs.alsa-lib
            pkgs.dbus
            pkgs.fontconfig
            pkgs.freetype
            pkgs.android-studio
            jdk
            androidSdkEmulator
          ];

          ANDROID_HOME = androidHomeEmulator;
          ANDROID_SDK_ROOT = androidHomeEmulator;
          JAVA_HOME = jdk;
          GRADLE_OPTS = "-Dorg.gradle.java.home=${jdk}";

          # Shared AVD name used by repo scripts.
          SMT_EMULATOR_AVD_NAME = "spending_api35";

          shellHook =
            let
              loadLombok = "-javaagent:${pkgs.lombok}/share/java/lombok.jar";
              prev = "\${JAVA_TOOL_OPTIONS:+ $JAVA_TOOL_OPTIONS}";
            in
            ''
              export JAVA_TOOL_OPTIONS="${loadLombok}${prev}"

              echo "Emulator notes:" >&2
              echo "- Requires KVM enabled on the host (/dev/kvm)" >&2
              echo "- Start Android Studio: android-studio" >&2
              echo "- Or run emulator CLI once an AVD exists: emulator -list-avds" >&2
            '';
        };
      }
    );
}
