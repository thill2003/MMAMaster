#!/usr/bin/env node
/**
 * Applies the one orientation value (capacitor.config.ts → ORIENTATION) to the native projects after
 * `cap sync` (plan §7, MM-013). Does nothing for a platform that hasn't been added yet.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const config = readFileSync(new URL("../capacitor.config.ts", import.meta.url), "utf8");
const orientation = /ORIENTATION[^=]*=\s*"(landscape|portrait|any)"/.exec(config)?.[1] ?? "landscape";

const IOS = {
  landscape: ["UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
  portrait: ["UIInterfaceOrientationPortrait"],
  any: ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
};
const ANDROID = { landscape: "sensorLandscape", portrait: "portrait", any: "fullSensor" };

const plist = new URL("../ios/App/App/Info.plist", import.meta.url);
if (existsSync(plist)) {
  const list = IOS[orientation].map((o) => `\t\t<string>${o}</string>`).join("\n");
  const next = readFileSync(plist, "utf8").replace(
    /(<key>UISupportedInterfaceOrientations(?:~ipad)?<\/key>\s*<array>)[\s\S]*?(<\/array>)/g,
    `$1\n${list}\n\t$2`,
  );
  writeFileSync(plist, next);
  console.log(`iOS orientation → ${orientation}`);
}

const manifest = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
if (existsSync(manifest)) {
  let xml = readFileSync(manifest, "utf8");
  xml = /android:screenOrientation=/.test(xml)
    ? xml.replace(/android:screenOrientation="[^"]*"/, `android:screenOrientation="${ANDROID[orientation]}"`)
    : xml.replace(/<activity\b/, `<activity android:screenOrientation="${ANDROID[orientation]}"`);
  writeFileSync(manifest, xml);
  console.log(`Android orientation → ${orientation}`);
}
