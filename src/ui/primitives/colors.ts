import { HUD_COLORS, type HudColor } from "@/content/display";

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The HUD colours from `content/display` as CSS custom properties (MM-109a): `--hud-<kebab-name>`. */
export const hudColorVars = (): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const name of Object.keys(HUD_COLORS) as HudColor[]) vars[`--hud-${kebab(name)}`] = HUD_COLORS[name];
  return vars;
};

/** Set once at startup on the document root, beside the type variables. */
export const applyHudColors = (root: HTMLElement): void => {
  for (const [name, value] of Object.entries(hudColorVars())) root.style.setProperty(name, value);
};
