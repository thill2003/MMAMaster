/**
 * Display rules (plan §7). Orientation is this one value — scenes never hardcode it.
 * The simulation is locked to 60 Hz; only rendering adapts to the device.
 */
export const ORIENTATION: "landscape" | "portrait" | "any" = "landscape";

export const DISPLAY = {
  /** Fixed logical height; width fills the device's aspect. */
  logicalHeight: 540,
  /** 4:3 tablets: the narrowest view. Narrower screens letterbox. */
  minAspect: 4 / 3,
  /** 19.5:9 phones: the widest view. Wider screens pillarbox. */
  maxAspect: 19.5 / 9,
  /** Older phones can't afford 3× pixels. */
  dprCap: 2,
  /** Screen y of the far edge of the walkable band. */
  floorTop: 352,
  tickRate: 60,
  /** Size of every fighter on screen, on top of each look's own scale. */
  fighterScale: 1.2,
};

export type DeviceProfileId = "phone-small" | "phone" | "tablet";

export interface DeviceProfile {
  id: DeviceProfileId;
  /** D-pad diameter and strike button diameter, in CSS px at buttonScale 1. */
  dpadSize: number;
  buttonSize: number;
  /** Gap from the safe-area edge. */
  margin: number;
  hudScale: number;
  dprCap: number;
}

/** Profiles are data; Settings can scale the buttons per player on top (MM-012). */
export const DEVICE_PROFILES: Record<DeviceProfileId, DeviceProfile> = {
  "phone-small": { id: "phone-small", dpadSize: 138, buttonSize: 56, margin: 10, hudScale: 0.9, dprCap: 2 },
  phone: { id: "phone", dpadSize: 156, buttonSize: 62, margin: 16, hudScale: 1, dprCap: 2 },
  tablet: { id: "tablet", dpadSize: 190, buttonSize: 76, margin: 28, hudScale: 0.92, dprCap: 2 },
};

/** Chosen at launch from the short side of the screen in CSS px. */
export const pickDeviceProfile = (cssWidth: number, cssHeight: number): DeviceProfile => {
  const short = Math.min(cssWidth, cssHeight);
  if (short >= 600) return DEVICE_PROFILES.tablet;
  if (short < 380) return DEVICE_PROFILES["phone-small"];
  return DEVICE_PROFILES.phone;
};

/** Accessibility floor (MM-109): no touch target smaller than this, whatever the scale setting. */
export const MIN_TOUCH_TARGET = 44;

/**
 * Retro type (MM-094). Three faces: `display` for titles and buttons, `retro` for the arcade numbers —
 * clock, score, combo, stats — and `body` for reading text. v0 ships no font files, so each is a system
 * stack; when a bundled pixel font lands in `assets/`, its name goes at the front of `retro` here.
 */
export const FONTS = {
  display: '"Futura-CondensedExtraBold", "HelveticaNeue-CondensedBlack", "Arial Narrow", "Roboto Condensed", Impact, sans-serif',
  retro: 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", "Courier New", monospace',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

export type FontRole = keyof typeof FONTS;

/**
 * The type scale, in logical px of the 540-high stage (multiplied by the UI's --u, so text scales with the
 * game). Every font size in the UI is one of these steps — no one-off sizes.
 */
export const TYPE_SCALE = {
  micro: 11,
  small: 13,
  body: 15,
  large: 18,
  title: 22,
  heading: 34,
  headline: 58,
  display: 84,
  logo: 118,
};

export type TypeStep = keyof typeof TYPE_SCALE;

/** Accessibility floor: no step drawn smaller than this at hudScale 1 (MM-109). */
export const MIN_FONT_SIZE = 11;
