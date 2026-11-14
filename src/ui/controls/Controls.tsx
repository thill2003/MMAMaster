import { type CSSProperties, type PointerEvent, type ReactElement, type ReactNode, useCallback, useRef, useState } from "react";

import { type DeviceProfile, MIN_TOUCH_TARGET } from "@/content/display";
import { STRINGS } from "@/content/strings";
import type { Action } from "@/core/input";
import { audio } from "@/engine";
import { haptics } from "@/platform";

import { DrinkIcon, ElbowIcon, KickIcon, KneeIcon, LockIcon, PunchIcon } from "../primitives/icons";

type SetAction = (action: Action, down: boolean) => void;

const DIRS: Action[] = ["MOVE_LEFT", "MOVE_RIGHT", "MOVE_UP", "MOVE_DOWN"];

/**
 * The D-pad: a cross for movement with Guard as the hub in the middle (plan §6). One thumb, one pointer.
 * The hub and the arms have hysteresis so a thumb resting near the edge of the hub doesn't flicker
 * between guarding and walking: once on the hub you must slide well out to move, and vice versa.
 */
const DPad = ({ setAction }: { setAction: SetAction }): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const onHub = useRef(false);
  const [active, setActive] = useState<{ guard: boolean; x: number; y: number }>({ guard: false, x: 0, y: 0 });

  const apply = useCallback(
    (guard: boolean, x: number, y: number) => {
      setAction("GUARD", guard);
      setAction("MOVE_LEFT", x < 0);
      setAction("MOVE_RIGHT", x > 0);
      setAction("MOVE_UP", y < 0);
      setAction("MOVE_DOWN", y > 0);
      setActive((prev) => (prev.guard === guard && prev.x === x && prev.y === y ? prev : { guard, x, y }));
    },
    [setAction],
  );

  const read = useCallback(
    (e: PointerEvent<HTMLDivElement>, first: boolean) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const radius = r.width / 2;
      const dx = (e.clientX - (r.left + radius)) / radius;
      const dy = (e.clientY - (r.top + radius)) / radius;
      const dist = Math.hypot(dx, dy);
      // Hub radius: 0.3 to enter on a fresh touch, 0.2 when sliding in from an arm, 0.42 to leave.
      const hub = first ? dist < 0.3 : onHub.current ? dist < 0.42 : dist < 0.2;
      if (hub) {
        if (!onHub.current) haptics.tap();
        onHub.current = true;
        apply(true, 0, 0);
        return;
      }
      onHub.current = false;
      // Eight-way with a dead zone per axis, so straight lines stay straight.
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const x = ax > 0.24 && ax > ay * 0.42 ? Math.sign(dx) : 0;
      const y = ay > 0.24 && ay > ax * 0.42 ? Math.sign(dy) : 0;
      apply(false, x, y);
    },
    [apply],
  );

  const release = useCallback(() => {
    pointer.current = null;
    onHub.current = false;
    for (const d of DIRS) setAction(d, false);
    setAction("GUARD", false);
    setActive({ guard: false, x: 0, y: 0 });
  }, [setAction]);

  return (
    <div
      ref={ref}
      className="dpad"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        audio.unlock();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        read(e, true);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === pointer.current) read(e, false);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onLostPointerCapture={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        <rect className={`arm ${active.y < 0 ? "on" : ""}`} x="35" y="2" width="30" height="36" rx="7" />
        <rect className={`arm ${active.y > 0 ? "on" : ""}`} x="35" y="62" width="30" height="36" rx="7" />
        <rect className={`arm ${active.x < 0 ? "on" : ""}`} x="2" y="35" width="36" height="30" rx="7" />
        <rect className={`arm ${active.x > 0 ? "on" : ""}`} x="62" y="35" width="36" height="30" rx="7" />
        <path className="glyph" d="M44 17l6-7 6 7M44 83l6 7 6-7M17 44l-7 6 7 6M83 44l7 6-7 6" />
        <circle className={`hub ${active.guard ? "on" : ""}`} cx="50" cy="50" r="17" />
        <path className="glyph" d="M50 40l8 2.6v6c0 5.2-3.4 8.6-8 11.2-4.6-2.6-8-6-8-11.2v-6z" />
      </svg>
    </div>
  );
};

interface StrikeButtonProps {
  action: Action;
  setAction: SetAction;
  style: CSSProperties;
  tag: string;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
}

const ActionButton = ({ action, setAction, style, tag, children, className, badge }: StrikeButtonProps): ReactElement => {
  const [on, setOn] = useState(false);
  const pointer = useRef<number | null>(null);
  const up = (id: number) => {
    if (id !== pointer.current) return;
    pointer.current = null;
    setOn(false);
    setAction(action, false);
  };
  return (
    <div
      className={`sbtn ${className ?? ""} ${on ? "on" : ""}`}
      style={style}
      role="button"
      aria-label={action}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        audio.unlock();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setOn(true);
        setAction(action, true);
        haptics.tap();
      }}
      onPointerUp={(e) => up(e.pointerId)}
      onPointerCancel={(e) => up(e.pointerId)}
      onLostPointerCapture={(e) => up(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {tag && <span className="tag">{tag}</span>}
      {badge}
    </div>
  );
};

interface ControlsProps {
  setAction: SetAction;
  profile: DeviceProfile;
  buttonScale: number;
  leftHanded: boolean;
  items: number;
}

/**
 * Touch controls as a DOM overlay (MM-015): the D-pad with its guard hub on one side; on the other, four
 * live strike buttons in a diamond under the thumb's arc, two locked slots reserved for special moves
 * outside it, and the energy-drink slot. Pointer events give true multi-touch; sizes come from the device
 * profile and the player's button-size setting, never below the 44 px touch-target floor.
 */
export const Controls = ({ setAction, profile, buttonScale, leftHanded, items }: ControlsProps): ReactElement => {
  const btn = Math.max(MIN_TOUCH_TARGET, Math.round(profile.buttonSize * buttonScale));
  const dpad = Math.max(MIN_TOUCH_TARGET * 2.6, Math.round(profile.dpadSize * buttonScale));
  const vars = { "--btn": `${btn}px`, "--dpad": `${dpad}px`, "--pad-margin": `${profile.margin}px` } as CSSProperties;
  // Mirror the cluster's inner layout for left-handed play so the reserved slots stay on the outside.
  const mx = (pct: number): string => `${leftHanded ? 100 - pct : pct}%`;
  const B = STRINGS.buttons;
  return (
    <div className={`controls ${leftHanded ? "lefty" : ""}`} style={vars}>
      <DPad setAction={setAction} />
      <div className="cluster">
        <ActionButton action="ELBOW" setAction={setAction} tag={B.elbow} style={{ left: mx(58), top: "20%" }}>
          <ElbowIcon />
        </ActionButton>
        <ActionButton action="PUNCH" setAction={setAction} tag={B.punch} style={{ left: mx(24), top: "52%" }}>
          <PunchIcon />
        </ActionButton>
        <ActionButton action="KNEE" setAction={setAction} tag={B.knee} style={{ left: mx(84), top: "58%" }}>
          <KneeIcon />
        </ActionButton>
        <ActionButton action="KICK" setAction={setAction} tag={B.kick} style={{ left: mx(52), top: "84%" }}>
          <KickIcon />
        </ActionButton>
        {/* Reserved for SPECIAL_1 and SPECIAL_2: placed, muted, bound to nothing in v1. */}
        <div className="sbtn locked" style={{ left: mx(18), top: "14%" }} aria-hidden>
          <LockIcon />
        </div>
        <div className="sbtn locked" style={{ left: mx(92), top: "22%" }} aria-hidden>
          <LockIcon />
        </div>
        <ActionButton
          action="ITEM"
          setAction={setAction}
          tag=""
          className={`item ${items === 0 ? "empty" : ""}`}
          style={{ left: mx(-14), top: "86%" }}
          badge={<span className="count">{items}</span>}
        >
          <DrinkIcon />
        </ActionButton>
      </div>
    </div>
  );
};
