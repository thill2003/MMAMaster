import { type CSSProperties, type ReactElement, useEffect, useRef, useState } from "react";

import { STRINGS } from "@/content/strings";
import type { HudState } from "@/core/fight";

import { HeartIcon, PauseIcon } from "../primitives/icons";

const PIPS = 6;

type HintKey = keyof typeof STRINGS.hints;

/** Fenton is the tutorial (MM-107): a hint per stretch of the level, each shown for a few seconds. */
const hintFor = (hud: HudState): HintKey | null => {
  if (hud.phase === "leaderIntro" || hud.phase === "leader") return "leader";
  if (hud.phase !== "fight" && hud.phase !== "ready") return null;
  const p = hud.progress;
  if (p < 0.1) return "move";
  if (p < 0.24) return "punch";
  if (p < 0.38) return "mix";
  if (p < 0.52) return "guard";
  if (p < 0.64) return "hold";
  if (p < 0.76) return "clinch";
  if (p < 0.86) return "dash";
  return "drink";
};

interface Props {
  hud: HudState;
  lives: number;
  isChampion: boolean;
  showHints: boolean;
  /** CSS px per logical px for the HUD: the stage unit times the device profile's HUD scale. */
  unit: number;
  onPause: () => void;
}

export const Hud = ({ hud, lives, isChampion, showHints, unit, onPause }: Props): ReactElement => {
  const hpFrac = hud.hp / hud.maxHp;
  const warn = hud.clockSeconds <= 30 && (hud.phase === "fight" || hud.phase === "leader");

  // Banners: FIGHT! at the start, the leader's name when he walks on.
  const [banner, setBanner] = useState<"ready" | "leader" | null>(null);
  const lastPhase = useRef<string>("");
  useEffect(() => {
    if (hud.phase === lastPhase.current) return;
    lastPhase.current = hud.phase;
    if (hud.phase === "ready") setBanner("ready");
    else if (hud.phase === "leaderIntro") setBanner("leader");
    else if (hud.phase === "fight" || hud.phase === "leader") {
      const t = setTimeout(() => setBanner(null), hud.phase === "leader" ? 1400 : 900);
      return () => clearTimeout(t);
    } else setBanner(null);
  }, [hud.phase]);

  // Hints: show each for a few seconds after it changes.
  const hintKey = showHints ? hintFor(hud) : null;
  const [hintVisible, setHintVisible] = useState(true);
  useEffect(() => {
    setHintVisible(true);
    const t = setTimeout(() => setHintVisible(false), 7000);
    return () => clearTimeout(t);
  }, [hintKey]);

  // Combo counter bumps on every hit.
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (hud.combo > 0) setBump((b) => b + 1);
  }, [hud.combo]);

  const pipsOn = Math.min(PIPS, Math.floor(hud.progress * PIPS + 0.001));
  const bossActive = hud.boss !== null;

  return (
    <div className="hud" style={{ "--u": `${unit}px` } as CSSProperties}>
      <div className="hud-top">
        <div className="hud-left">
          <div className="hud-label">
            <span>YOU</span>
            <span>{Math.ceil(hud.hp)}</span>
          </div>
          <div className="bar" role="meter" aria-label="Health" aria-valuenow={hud.hp} aria-valuemax={hud.maxHp}>
            <i className="lag" style={{ width: `${hpFrac * 100}%` }} />
            <i className={hpFrac <= 0.3 ? "low" : ""} style={{ width: `${hpFrac * 100}%` }} />
          </div>
          <div className="hud-score">{hud.score.toLocaleString()}</div>
        </div>

        <div className={`clock ${warn ? "warn" : ""}`}>
          <small>TIME</small>
          <b>{hud.clockSeconds}</b>
        </div>

        <div className="hud-right">
          <div className="row">
            <span className="lives-inline" aria-label={STRINGS.lives}>
              <HeartIcon className="heart" />
              {lives}
            </span>
            <button type="button" className="icon-btn" aria-label="Pause" onClick={onPause}>
              <PauseIcon />
            </button>
          </div>
          <div className="pips" aria-label="Level progress">
            {Array.from({ length: PIPS }, (_, i) => (
              <span key={i} className={`pip ${i < pipsOn ? "on" : ""}`} />
            ))}
            <span className={`pip bosspip ${bossActive ? "on" : ""}`} />
          </div>
        </div>
      </div>

      {hud.boss && (
        <div className="boss-plate">
          <div className="hud-label">
            <span>{hud.boss.name}</span>
            <em>{hud.boss.title}</em>
          </div>
          <div className="bar boss" role="meter" aria-label="Leader health">
            <i className="lag" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
            <i style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
          </div>
        </div>
      )}

      {hud.combo >= 2 && (
        <div className="combo bump" key={bump}>
          <b>{hud.combo}</b>
          <span>{STRINGS.combo}</span>
        </div>
      )}

      {banner === "ready" && (
        <div className="banner display">
          <div className="big">{STRINGS.ready}</div>
        </div>
      )}
      {banner === "leader" && hud.boss && (
        <div className="banner long display">
          <div className="sub">{isChampion ? STRINGS.championIntro : STRINGS.leaderIntro}</div>
          <div className="big" style={{ fontSize: "calc(var(--u) * 64)" }}>
            {hud.boss.name}
          </div>
          <div className="sub">{hud.boss.title}</div>
        </div>
      )}

      {hud.clinched && <div className="chip">{STRINGS.mash}</div>}
      {hud.slowed && <div className="chip slow">{STRINGS.slowed}</div>}
      {hintKey && hintVisible && !hud.clinched && (
        <div className={`hint ${hud.boss ? "below-boss" : ""}`} key={hintKey}>
          {STRINGS.hints[hintKey]}
        </div>
      )}
    </div>
  );
};
