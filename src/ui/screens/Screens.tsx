import { type ReactElement, useEffect, useState } from "react";

import { KEYBOARD_HELP } from "@/content/bindings";
import { STAR_RULES } from "@/content/fighters/tuning";
import { COMBO_LIST } from "@/content/moves/player";
import { STRINGS } from "@/content/strings";
import type { TownDef } from "@/content/towns/stLouis";
import type { FightResult } from "@/core/fight";
import { computeStars, type Difficulty, type LevelRecord, type Settings } from "@/core/progress";
import { audio } from "@/engine";

import { Button } from "../primitives/Button";
import { HeartIcon } from "../primitives/icons";
import { Portrait } from "../primitives/Portrait";
import { Stars } from "../primitives/Stars";

// ---------------------------------------------------------------- title

export const Title = ({
  onPlay,
  onSettings,
  toast,
}: {
  onPlay: () => void;
  onSettings: () => void;
  toast: string | null;
}): ReactElement => (
  <div className="screen opaque title-screen">
    <svg className="title-skyline" viewBox="0 0 960 330" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M330 330 C345 -20 615 -20 630 330" fill="none" stroke="#8a93b8" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
      <path
        d="M0 330V250h50v-40h36v60h44v-110h52v90h40v-50h60v80h70v-120h40v-30h30v150h60v-90h48v70h56v-130h44v110h50v-70h62v50h40v-90h54v130h60v-60h64v90z"
        fill="#1b1a38"
      />
    </svg>
    {toast && <div className="toast">{toast}</div>}
    <h1 className="logo display">
      MMA <span>MASTER</span>
    </h1>
    <div className="tagline">{STRINGS.tagline}</div>
    <div className="title-actions">
      <Button onPress={onPlay}>{STRINGS.play}</Button>
      <Button variant="secondary" onPress={onSettings}>
        {STRINGS.settings}
      </Button>
    </div>
    <div className="kbd-help">{KEYBOARD_HELP}</div>
  </div>
);

// ---------------------------------------------------------------- level card

interface LevelCardProps {
  town: TownDef;
  index: number;
  record: LevelRecord | undefined;
  unlocked: boolean;
  lives: number;
  onFight: () => void;
  onClose: () => void;
}

export const LevelCard = ({ town, index, record, unlocked, lives, onFight, onClose }: LevelCardProps): ReactElement => (
  <div className="screen veil" onClick={onClose}>
    <div className="panel card" onClick={(e) => e.stopPropagation()}>
      <div className="portrait">
        <Portrait look={town.leaderLook} accent={town.theme.gymColor} />
      </div>
      <div>
        <div className="eyebrow">{town.isChampion ? STRINGS.champion : `Level ${index + 1} · ${town.gym}`}</div>
        <h2 className="display">{town.name}</h2>
        <p>{unlocked ? town.blurb : STRINGS.lockedHint}</p>
        <div className="leader-title">{town.isChampion ? STRINGS.champion : STRINGS.leader}</div>
        <div className="leader-name display">{unlocked ? town.leader.name : "???"}</div>
        {unlocked && <div className="leader-title">“{town.leader.title}”</div>}
        <div className="kv">
          <span>
            {STRINGS.best} <Stars stars={record?.stars ?? [false, false, false]} />
          </span>
          <span>
            {STRINGS.bestScore} <b>{(record?.bestScore ?? 0).toLocaleString()}</b>
          </span>
          <span className="lives-inline">
            <HeartIcon className="heart" />
            {lives}
          </span>
        </div>
        <div className="row">
          <Button onPress={onFight} disabled={!unlocked}>
            {unlocked ? STRINGS.fight : STRINGS.locked}
          </Button>
          <Button variant="secondary" small sound="back" onPress={onClose}>
            {STRINGS.close}
          </Button>
          {unlocked && <span className="eyebrow">{STRINGS.costsLife}</span>}
        </div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------- results

export const Results = ({ town, result, onContinue }: { town: TownDef; result: FightResult; onContinue: () => void }): ReactElement => {
  const stars = computeStars(
    {
      won: true,
      healthFraction: result.healthFraction,
      clockFraction: result.clockFraction,
      score: result.score,
      bestCombo: result.bestCombo,
    },
    STAR_RULES,
  );
  useEffect(() => {
    const timers = stars.map((on, i) => (on ? setTimeout(() => audio.sfx("star"), 350 + i * 350) : null));
    return () => timers.forEach((t) => t && clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lines: Array<[string, boolean]> = [
    [STRINGS.starFinish, stars[0]],
    [STRINGS.starHealth, stars[1]],
    [STRINGS.starClock, stars[2]],
  ];
  return (
    <div className="screen veil">
      <div className="panel results">
        <div className="eyebrow">
          {town.name} · {town.gym}
        </div>
        <h2 className="display">{town.isChampion ? STRINGS.resultsChampion : STRINGS.results}</h2>
        <div style={{ margin: "calc(var(--u) * 8) 0" }}>
          <Stars stars={stars} big animate />
        </div>
        <div className="lines">
          <div>
            {lines.map(([label, on]) => (
              <div key={label} className={`line ${on ? "" : "miss"}`}>
                <span>{label}</span>
                <b>{on ? "★" : "—"}</b>
              </div>
            ))}
          </div>
          <div>
            <div className="line">
              <span>{STRINGS.hitsScore}</span>
              <b>{result.baseScore.toLocaleString()}</b>
            </div>
            <div className="line">
              <span>{STRINGS.timeBonus}</span>
              <b>+{result.timeBonus.toLocaleString()}</b>
            </div>
            <div className="line">
              <span>{STRINGS.healthBonus}</span>
              <b>+{result.healthBonus.toLocaleString()}</b>
            </div>
            <div className="line">
              <span>{STRINGS.bestCombo}</span>
              <b>{result.bestCombo}</b>
            </div>
          </div>
        </div>
        <div className="total">
          {STRINGS.total} {result.score.toLocaleString()}
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: "calc(var(--u) * 12)" }}>
          <Button onPress={onContinue}>{STRINGS.continue}</Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- knocked out / out of lives

interface KnockedOutProps {
  result: FightResult;
  lives: number;
  onRetry: () => void;
  onMap: () => void;
}

export const KnockedOut = ({ result, lives, onRetry, onMap }: KnockedOutProps): ReactElement => (
  <div className="screen veil">
    <div className="center-col">
      <div className="ko-title display">{result.outcome === "timeout" ? STRINGS.timeOut : STRINGS.knockedOut}</div>
      <p>{STRINGS.knockedOutBody}</p>
      <p>
        {STRINGS.score} <b>{result.baseScore.toLocaleString()}</b> · {STRINGS.bestCombo} <b>{result.bestCombo}</b>
      </p>
      <span className="lives-inline">
        <HeartIcon className="heart" />
        {lives} {STRINGS.lives.toLowerCase()} left
      </span>
      <div className="row">
        <Button onPress={onRetry}>{STRINGS.retry}</Button>
        <Button variant="secondary" sound="back" onPress={onMap}>
          {STRINGS.toMap}
        </Button>
      </div>
      <span className="eyebrow" style={{ color: "var(--muted)", fontSize: "calc(var(--u) * var(--fs-small))", letterSpacing: "0.14em" }}>
        {STRINGS.retry} · {STRINGS.costsLife.toLowerCase()}
      </span>
    </div>
  </div>
);

const untilMidnight = (): string => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};

export const OutOfLives = ({ perDay, onMap }: { perDay: number; onMap: () => void }): ReactElement => {
  const [left, setLeft] = useState(untilMidnight);
  useEffect(() => {
    const t = setInterval(() => setLeft(untilMidnight()), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="screen veil">
      <div className="center-col">
        <div className="ko-title display" style={{ fontSize: "calc(var(--u) * var(--fs-headline))" }}>
          {STRINGS.outOfLives}
        </div>
        <p>{STRINGS.outOfLivesBody}</p>
        <p>
          {STRINGS.nextLives} <b style={{ color: "var(--gold)" }}>{left}</b> (+{perDay})
        </p>
        <Button variant="secondary" sound="back" onPress={onMap}>
          {STRINGS.toMap}
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- settings and pause

interface SettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onReset?: () => void;
}

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }): ReactElement => (
  <button
    type="button"
    className={`toggle ${on ? "on" : ""}`}
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
  />
);

export const SettingsRows = ({ settings, onChange }: Pick<SettingsProps, "settings" | "onChange">): ReactElement => {
  const L = STRINGS.settingsLabels;
  const diffs: Difficulty[] = ["easy", "normal", "hard"];
  return (
    <>
      <div className="setting">
        {L.difficulty}
        <span className="seg">
          {diffs.map((d) => (
            <button key={d} type="button" className={settings.difficulty === d ? "on" : ""} onClick={() => onChange({ difficulty: d })}>
              {L[d]}
            </button>
          ))}
        </span>
      </div>
      <div className="setting">
        {L.music}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.music}
          aria-label={L.music}
          onChange={(e) => onChange({ music: Number(e.target.value) })}
        />
      </div>
      <div className="setting">
        {L.sfx}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.sfx}
          aria-label={L.sfx}
          onChange={(e) => {
            onChange({ sfx: Number(e.target.value) });
            audio.sfx("hit_punch");
          }}
        />
      </div>
      <div className="setting">
        {L.buttonScale}
        <input
          type="range"
          min={0.8}
          max={1.4}
          step={0.05}
          value={settings.buttonScale}
          aria-label={L.buttonScale}
          onChange={(e) => onChange({ buttonScale: Number(e.target.value) })}
        />
      </div>
      <div className="setting">
        {L.leftHanded}
        <Toggle on={settings.leftHanded} label={L.leftHanded} onChange={(v) => onChange({ leftHanded: v })} />
      </div>
      <div className="setting">
        {L.haptics}
        <Toggle on={settings.haptics} label={L.haptics} onChange={(v) => onChange({ haptics: v })} />
      </div>
      <div className="setting">
        {L.reduceShake}
        <Toggle on={settings.reduceShake} label={L.reduceShake} onChange={(v) => onChange({ reduceShake: v })} />
      </div>
      <div className="setting">
        {L.showHints}
        <Toggle on={settings.showHints} label={L.showHints} onChange={(v) => onChange({ showHints: v })} />
      </div>
      <div className="setting">
        {L.debug}
        <Toggle on={settings.debug} label={L.debug} onChange={(v) => onChange({ debug: v })} />
      </div>
    </>
  );
};

export const SettingsScreen = ({ settings, onChange, onClose, onReset }: SettingsProps): ReactElement => {
  const [confirm, setConfirm] = useState(false);
  const L = STRINGS.settingsLabels;
  return (
    <div className="screen veil" style={{ zIndex: 40 }}>
      <div className="panel settings">
        <div className="row">
          <h2 className="display grow">{STRINGS.settings}</h2>
          <Button variant="secondary" small sound="back" onPress={onClose}>
            {STRINGS.close}
          </Button>
        </div>
        <SettingsRows settings={settings} onChange={onChange} />
        {onReset && (
          <div className="setting" style={{ borderBottom: 0 }}>
            <span />
            <Button
              variant="danger"
              small
              onPress={() => {
                if (confirm) {
                  onReset();
                  setConfirm(false);
                } else setConfirm(true);
              }}
            >
              {confirm ? L.resetConfirm : L.reset}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

interface PauseProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResume: () => void;
  onQuit: () => void;
}

export const Pause = ({ settings, onChange, onResume, onQuit }: PauseProps): ReactElement => {
  const [tab, setTab] = useState<"combos" | "settings">("combos");
  return (
    <div className="screen veil" style={{ zIndex: 30 }}>
      <div className="panel settings">
        <div className="row">
          <h2 className="display grow">{STRINGS.paused}</h2>
          <span className="seg">
            <button type="button" className={tab === "combos" ? "on" : ""} onClick={() => setTab("combos")}>
              {STRINGS.combos}
            </button>
            <button type="button" className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>
              {STRINGS.settings}
            </button>
          </span>
        </div>
        {tab === "combos" ? (
          <div className="combo-list">
            {COMBO_LIST.flatMap((c) => [<span key={`${c.name}-n`}>{c.name}</span>, <span key={`${c.name}-i`}>{c.input}</span>])}
          </div>
        ) : (
          <SettingsRows settings={settings} onChange={onChange} />
        )}
        <div className="row" style={{ marginTop: "calc(var(--u) * 12)" }}>
          <Button onPress={onResume}>{STRINGS.resume}</Button>
          <Button variant="secondary" sound="back" onPress={onQuit}>
            {STRINGS.quit}
          </Button>
        </div>
      </div>
    </div>
  );
};
