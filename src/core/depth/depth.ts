import { clamp } from "@/shared/math";

/**
 * Depth math for the belt-scroller plane. `z` runs from 0 (far side of the street, top of the walkable band)
 * to `band.max` (near the camera, bottom of the band). Screen y grows with z.
 */
export interface DepthBand {
  min: number;
  max: number;
}

export const DEFAULT_BAND: DepthBand = { min: 0, max: 150 };

/** Two fighters can hit each other only when their depths are within `tolerance`. */
export const withinDepth = (az: number, bz: number, tolerance: number): boolean => Math.abs(az - bz) <= tolerance;

export const clampDepth = (z: number, band: DepthBand = DEFAULT_BAND): number => clamp(z, band.min, band.max);

/** Draw order: nearer the camera draws later. `id` breaks ties so the order is stable. */
export const sortKey = (z: number, id: number): number => Math.round(z * 100) * 1000 + (id % 1000);

/** Screen y of a fighter's feet for a given depth. */
export const depthToScreenY = (z: number, floorTop: number): number => floorTop + z;

/** Slight perspective: fighters nearer the camera draw a little larger. */
export const depthScale = (z: number, band: DepthBand = DEFAULT_BAND): number =>
  0.92 + 0.16 * ((clampDepth(z, band) - band.min) / (band.max - band.min || 1));
