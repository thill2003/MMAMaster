import { type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useState } from "react";

import { ORIENTATION } from "@/content/display";
import { LIVES_RULES, STAR_RULES } from "@/content/fighters/tuning";
import { STRINGS } from "@/content/strings";
import { type MetroDef, METROS, metroById, metroOf, metroOrder, townById } from "@/content/towns";
import type { FightResult } from "@/core/fight";
import { canAttempt, hasBelt, isUnlocked, recordOutcome, type SaveData, type Settings, spendLife } from "@/core/progress";
import { audio, type GameBridge } from "@/engine";
import { haptics } from "@/platform";
import {
  BeltAward,
  FightScreen,
  KnockedOut,
  LevelCard,
  MetroMap,
  OutOfLives,
  GameView,
  Results,
  RotateIcon,
  SettingsScreen,
  Title,
  useGamepadMenu,
} from "@/ui";

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

/** A metro is open when it is the first on the tour, or the belt of the one before it has been won (MM-200). */
const metroOpen = (save: SaveData, metro: MetroDef): boolean => metro.index === 0 || hasBelt(save, metroOrder(METROS[metro.index - 1]));

/** The map opens on the furthest metro you can fight in. */
const furthestMetro = (save: SaveData): string => [...METROS].reverse().find((m) => metroOpen(save, m))?.id ?? METROS[0].id;

type Screen =
  | { name: "title" }
  | { name: "map"; metro: string; card: string | null; justCleared: string | null }
  | { name: "fight"; townId: string; attempt: number }
  | { name: "results"; townId: string; result: FightResult; attempt: number; beltWon: boolean }
  | { name: "belt"; townId: string }
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
  useGamepadMenu();

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
    else if (screen.name === "results" || screen.name === "ko" || screen.name === "belt") audio.music(null);
  }, [screen.name]);

  const changeSettings = useCallback(
    (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [update],
  );

  /** Starting a fight is free while you have lives; only losing one costs a life (plan §5). */
  const startAttempt = useCallback(
    (townId: string, attempt: number) => {
      if (!save) return;
      if (!canAttempt(save)) {
        setScreen({ name: "outOfLives" });
        return;
      }
      setScreen({ name: "fight", townId, attempt });
    },
    [save],
  );

  const onFinished = useCallback(
    (townId: string, attempt: number, result: FightResult) => {
      const won = result.outcome === "won";
      const demoRun = demo !== null && attempt === 0;
      // A metro's belt is awarded the first time its last level — the city champion — is beaten.
      const metroTowns = metroOrder(metroOf(townById(townId)!));
      const last = metroTowns[metroTowns.length - 1];
      const beltWon = won && !demoRun && townId === last && !!save && !save.levels[last]?.cleared;
      // A bot run in demo mode never touches the save.
      if (!demoRun)
        update((s) => {
          const recorded = recordOutcome(
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
          );
          // Only a loss — a KO or the clock running out — costs a life.
          return won ? recorded : (spendLife(recorded) ?? recorded);
        });
      setScreen(won ? { name: "results", townId, result, attempt, beltWon } : { name: "ko", townId, result, attempt });
    },
    [update, demo, save],
  );

  const stageStyle = useMemo(
    () => ({ width: `${stage.width}px`, height: `${stage.height}px`, "--u": `${stage.unit}px` }) as CSSProperties,
    [stage.width, stage.height, stage.unit],
  );

  // The fight stays mounted behind the results and knocked-out screens, frozen on its last frame.
  const fighting = screen.name === "fight" || screen.name === "results" || screen.name === "ko";
  const town = fighting ? townById(screen.townId) : undefined;
  /** Back to the map of a level's metro. */
  const mapOf = (townId: string): Extract<Screen, { name: "map" }> => ({
    name: "map",
    metro: townById(townId)?.metro ?? METROS[0].id,
    card: null,
    justCleared: null,
  });
  const mapMetro = screen.name === "map" ? (metroById(screen.metro) ?? METROS[0]) : METROS[0];

  return (
    <div className="shell" onContextMenu={(e) => e.preventDefault()}>
      <div className="stage" style={stageStyle}>
        <GameView onReady={setBridge} />

        {save && screen.name === "title" && (
          <Title
            toast={toast}
            onPlay={() => setScreen({ name: "map", metro: furthestMetro(save), card: null, justCleared: null })}
            onSettings={() => setSettingsOpen(true)}
          />
        )}

        {save && screen.name === "map" && (
          <>
            <MetroMap
              metro={mapMetro}
              open={metroOpen(save, mapMetro)}
              prev={METROS[mapMetro.index - 1] ?? null}
              next={METROS[mapMetro.index + 1] ?? null}
              onMetro={(id) => setScreen({ name: "map", metro: id, card: null, justCleared: null })}
              save={save}
              justCleared={screen.justCleared}
              onPick={(id) => setScreen({ name: "map", metro: mapMetro.id, card: id, justCleared: null })}
              onBack={() => setScreen({ name: "title" })}
              onSettings={() => setSettingsOpen(true)}
            />
            {toast && <div className="toast">{toast}</div>}
            {screen.card && townById(screen.card) && (
              <LevelCard
                town={townById(screen.card)!}
                index={metroOrder(mapMetro).indexOf(screen.card)}
                record={save.levels[screen.card]}
                unlocked={metroOpen(save, mapMetro) && isUnlocked(save, metroOrder(mapMetro), screen.card)}
                lives={save.lives}
                onFight={() => startAttempt(screen.card!, 0)}
                onClose={() => setScreen({ name: "map", metro: mapMetro.id, card: null, justCleared: null })}
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
            onQuit={() => setScreen(mapOf(town.id))}
            onSettings={changeSettings}
            autoplay={demo !== null && screen.attempt === 0}
          />
        )}

        {save && town && screen.name === "results" && (
          <Results
            town={town}
            result={screen.result}
            onContinue={() => setScreen(screen.beltWon ? { name: "belt", townId: town.id } : { ...mapOf(town.id), justCleared: town.id })}
          />
        )}

        {save && screen.name === "belt" && (
          <BeltAward
            metroName={STRINGS.metroNames[townById(screen.townId)?.metro ?? ""] ?? ""}
            onContinue={() => {
              // Winning a belt opens the next tour stop: go straight to its map.
              const won = metroOf(townById(screen.townId)!);
              const next = METROS[won.index + 1];
              setScreen(
                next
                  ? { name: "map", metro: next.id, card: null, justCleared: null }
                  : { ...mapOf(screen.townId), justCleared: screen.townId },
              );
            }}
          />
        )}

        {save && town && screen.name === "ko" && (
          <KnockedOut
            result={screen.result}
            lives={save.lives}
            onRetry={() => startAttempt(town.id, screen.attempt + 1)}
            onMap={() => setScreen(mapOf(town.id))}
          />
        )}

        {save && screen.name === "outOfLives" && (
          <OutOfLives
            perDay={LIVES_RULES.perDay}
            onMap={() => setScreen({ name: "map", metro: furthestMetro(save), card: null, justCleared: null })}
          />
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
