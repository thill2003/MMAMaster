import type { ReactElement, ReactNode } from "react";

import { audio } from "@/engine";
import { haptics } from "@/platform";

interface Props {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  small?: boolean;
  disabled?: boolean;
  /** Sound on press; "back" for dismissals. */
  sound?: "tap" | "back" | "none";
  label?: string;
  className?: string;
}

/** Every button unlocks audio on first touch (WebAudio needs a gesture) and clicks. */
export const Button = ({
  children,
  onPress,
  variant = "primary",
  small,
  disabled,
  sound = "tap",
  label,
  className,
}: Props): ReactElement => (
  <button
    type="button"
    className={`${className ?? "btn"} ${variant === "primary" ? "" : variant} ${small ? "small" : ""}`}
    disabled={disabled}
    aria-label={label}
    onClick={() => {
      audio.unlock();
      if (sound !== "none") audio.sfx(sound === "back" ? "ui_back" : "ui_tap");
      haptics.tap();
      onPress();
    }}
  >
    {children}
  </button>
);
