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

/**
 * The real-time 3D view. The world is measured in logical pixels: x runs along the street as in the
 * simulation, y is up, and the simulation's depth z is stretched by `depthStretch` toward the camera so the
 * walkable band keeps its on-screen height under a tilted camera.
 */
export const CAMERA_3D = {
  /** Vertical field of view, degrees. Narrow keeps the far edge of the band close to the near edge's width. */
  fov: 22,
  /** How far the camera looks down, degrees. */
  pitch: 16,
  /** The simulation depth whose screen width equals the logical view width: the near part of the band. */
  frameDepth: 112,
  /** Height above the floor the camera aims at. */
  aimHeight: 150,
  /** World units per unit of simulation depth. */
  depthStretch: 2.2,
  /** Shadow map size; the floor device may need it lower. */
  shadowMapSize: 2048,
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
