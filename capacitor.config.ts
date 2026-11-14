import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Orientation is one config value (plan §7). The layout code reads the same value from
 * src/content/display.ts; the iOS/Android projects read it from here when they are generated.
 */
export const ORIENTATION: "landscape" | "portrait" | "any" = "landscape";

const config: CapacitorConfig = {
  appId: "com.sharperproducts.mmamaster",
  appName: "MMA Master",
  webDir: "dist",
  backgroundColor: "#0b0b12",
  ios: { contentInset: "never" },
  android: { backgroundColor: "#0b0b12" },
};

export default config;
