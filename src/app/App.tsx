import { type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useState } from "react";

import { ORIENTATION } from "@/content/display";
import { LIVES_RULES, STAR_RULES } from "@/content/fighters/tuning";
import { STRINGS } from "@/content/strings";
import { ST_LOUIS, TOWN_ORDER, townById } from "@/content/towns/stLouis";
import type { FightResult } from "@/core/fight";
import { isUnlocked, recordOutcome, type Settings, spendLife } from "@/core/progress";
import { audio, type GameBridge } from "@/engine";
import { haptics } from "@/platform";
import { FightScreen, KnockedOut, LevelCard, MetroMap, OutOfLives, PhaserGame, Results, RotateIcon, SettingsScreen, Title } from "@/ui";

import { useSave } from "./useSave";
import { useStage } from "./useStage";

/**
 * Demo mode for playtests and screenshots: `?demo=<townId>` opens straight into that town with the
 * scripted bot playing, and costs no life. Nothing in the shipped flow links to it.
 */
const demoTown = (): string | null => {
  const id = new URLSearchParams(window.location.search).get("demo");
  return id && townById(id) ? id : null;
};

type Screen =
  | { name: "title" }
  | { name: "map"; card: string | null; justCleared: string | null }
  | { name: "fight"; townId: string; attempt: number }
  | { name: "results"; townId: string; result: FightResult; attempt: number }
  | { name: "ko"; townId: string; result: FightResult; attempt: number }
  | { name: "outOfLives" };

/** Composition root: owns navigation and the save, and wires the screens to the engine bridge. */
export const App = (): ReactElement => {
  const stage = useStage();
  const { save, update, reset, toast } = useSave();
  const [bridge, setBridge] = useState<GameBridge | null>(null);
  const [demo] = useState(demoTown);
  const [screen, setScreen] = useState<Screen>(demo ? { name: "fight", townId: demo, attempt: 0 } : { name: "title" });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Keep the engine in step with the stage and the settings.
  useEffect(() => {
    bridge?.resize();
  }, [bridge, stage.width, stage.height]);

  const settings = save?.settings;
  useEffect(() => {
    if (!settings) return;
    audio.setVolumes(settings.sfx, settings.music);
    haptics.setEnabled(settings.haptics);
  }, [settings]);

  useEffect(() => {
    if (screen.name === "title") audio.music("title");
    else if (screen.name === "map" || screen.name === "outOfLives") audio.music("map");
    else if (screen.name === "results" || screen.name === "ko") audio.music(null);
  }, [screen.name]);

  const changeSettings = useCallback(
    (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [update],
  );

  /** Every attempt costs a life (plan §5). */
  const startAttempt = useCallback(
    (townId: string, attempt: number) => {
      if (!save) return;
      const spent = spendLife(save);
      if (!spent) {
        setScreen({ name: "outOfLives" });
        return;
      }
      update(() => spent);
      setScreen({ name: "fight", townId, attempt });
    },
    [save, update],
  );

  const onFinished = useCallback(
    (townId: string, attempt: number, result: FightResult) => {
      const won = result.outcome === "won";
      // A bot run in demo mode never touches the save.
      if (!(demo !== null && attempt === 0))
        update((s) =>
          recordOutcome(
            s,
            townId,
            {
              won,
              healthFraction: result.healthFraction,
              clockFraction: result.clockFraction,
              score: result.score,
              bestCombo: result.bestCombo,
            },
            STAR_RULES,
          ),
        );
      setScreen(won ? { name: "results", townId, result, attempt } : { name: "ko", townId, result, attempt });
    },
    [update, demo],
  );

  const stageStyle = useMemo(
    () => ({ width: `${stage.width}px`, height: `${stage.height}px`, "--u": `${stage.unit}px` }) as CSSProperties,
    [stage.width, stage.height, stage.unit],
  );

  // The fight stays mounted behind the results and knocked-out screens, frozen on its last frame.
  const fighting = screen.name === "fight" || screen.name === "results" || screen.name === "ko";
  const town = fighting ? townById(screen.townId) : undefined;

  return (
    <div className="shell" onContextMenu={(e) => e.preventDefault()}>
      <div className="stage" style={stageStyle}>
        <PhaserGame onReady={setBridge} />

        {save && screen.name === "title" && (
          <Title
            toast={toast}
            onPlay={() => setScreen({ name: "map", card: null, justCleared: null })}
            onSettings={() => setSettingsOpen(true)}
          />
        )}

        {save && screen.name === "map" && (
          <>
            <MetroMap
              towns={ST_LOUIS}
              save={save}
              justCleared={screen.justCleared}
              onPick={(id) => setScreen({ name: "map", card: id, justCleared: null })}
              onBack={() => setScreen({ name: "title" })}
              onSettings={() => setSettingsOpen(true)}
            />
            {toast && <div className="toast">{toast}</div>}
            {screen.card && townById(screen.card) && (
              <LevelCard
                town={townById(screen.card)!}
                index={TOWN_ORDER.indexOf(screen.card)}
                record={save.levels[screen.card]}
                unlocked={isUnlocked(save, TOWN_ORDER, screen.card)}
                lives={save.lives}
                onFight={() => startAttempt(screen.card!, 0)}
                onClose={() => setScreen({ name: "map", card: null, justCleared: null })}
              />
            )}
          </>
        )}

        {save && bridge && town && fighting && (
          <FightScreen
            bridge={bridge}
            town={town}
            attempt={screen.attempt}
            settings={save.settings}
            lives={save.lives}
            profile={stage.profile}
            unit={stage.unit}
            onFinished={(r) => onFinished(town.id, screen.attempt, r)}
            onQuit={() => setScreen({ name: "map", card: null, justCleared: null })}
            onSettings={changeSettings}
            autoplay={demo !== null && screen.attempt === 0}
          />
        )}

        {save && town && screen.name === "results" && (
          <Results town={town} result={screen.result} onContinue={() => setScreen({ name: "map", card: null, justCleared: town.id })} />
        )}

        {save && town && screen.name === "ko" && (
          <KnockedOut
            result={screen.result}
            lives={save.lives}
            onRetry={() => startAttempt(town.id, screen.attempt + 1)}
            onMap={() => setScreen({ name: "map", card: null, justCleared: null })}
          />
        )}

        {save && screen.name === "outOfLives" && (
          <OutOfLives perDay={LIVES_RULES.perDay} onMap={() => setScreen({ name: "map", card: null, justCleared: null })} />
        )}

        {save && settingsOpen && (
          <SettingsScreen
            settings={save.settings}
            onChange={changeSettings}
            onClose={() => setSettingsOpen(false)}
            onReset={() => {
              reset();
              setSettingsOpen(false);
              setScreen({ name: "title" });
            }}
          />
        )}
      </div>

      {ORIENTATION === "landscape" && stage.portrait && (
        <div className="rotate">
          <div>
            <RotateIcon />
            <div>{STRINGS.rotate}</div>
          </div>
        </div>
      )}
    </div>
  );
};
