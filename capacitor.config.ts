import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ⚠️ Must match the bundle ID you register in App Store Connect
  appId: "com.yourname.photobeam",
  appName: "PhotoBeam",
  webDir: "dist",
  ios: {
    // Let the web content extend under the notch/home bar; the app uses
    // env(safe-area-inset-*) padding to stay clear of them.
    contentInset: "never",
    backgroundColor: "#0a0c13",
  },
};

export default config;
