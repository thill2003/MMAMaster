import { FONTS, type FontRole, TYPE_SCALE, type TypeStep } from "@/content/display";

/**
 * The retro type from `content/display` as CSS custom properties (MM-094): `--font-<role>` and `--fs-<step>`.
 * Steps are unitless so each element sizes text as `calc(var(--u) * var(--fs-<step>))` against its own --u —
 * the HUD's --u carries the device profile's hudScale, the screens' does not.
 */
export const typeVars = (): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const role of Object.keys(FONTS) as FontRole[]) vars[`--font-${role}`] = FONTS[role];
  for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) vars[`--fs-${step}`] = String(TYPE_SCALE[step]);
  return vars;
};

/** Set once at startup on the document root, so text outside the stage (the rotate prompt) has it too. */
export const applyType = (root: HTMLElement): void => {
  for (const [name, value] of Object.entries(typeVars())) root.style.setProperty(name, value);
};
