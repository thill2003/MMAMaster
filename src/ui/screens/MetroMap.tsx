import { type ReactElement, useEffect, useMemo, useRef } from "react";

import { STRINGS } from "@/content/strings";
import { MAP_SIZE, type MetroDef } from "@/content/towns";
import { currentLevel, hasBelt, isUnlocked, type SaveData, starCount } from "@/core/progress";
import { audio } from "@/engine";

import { Button } from "../primitives/Button";
import { BackIcon, BeltIcon, GearIcon, HeartIcon, StarIcon } from "../primitives/icons";

import { MetroArt } from "./MetroArt";

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** A smooth S-curve from one node to the next. */
const segment = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
};

const STAR_PATH = "M0 -9l2.6 5.6 6.1.7-4.5 4.2 1.2 6L0 4.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7z";

interface Props {
  metro: MetroDef;
  /** The metro's gyms can be fought: it is the first, or the one before it has been won. */
  open: boolean;
  /** The metro before this one, for the locked hint and the back arrow; null on the first. */
  prev: MetroDef | null;
  next: MetroDef | null;
  onMetro: (metroId: string) => void;
  save: SaveData;
  /** A level cleared a moment ago: draw the path on to the next node and pop it open. */
  justCleared: string | null;
  onPick: (townId: string) => void;
  onBack: () => void;
  onSettings: () => void;
}

/**
 * The metro map (plan §4): a tall, scrolling map of one metro with numbered gym badges on a winding path from
 * the first suburb at the bottom to the champion at the top. The arrows step between tour stops (MM-200). Stylized — rivers,
 * bluffs, suburbs, city blocks — and deliberately free of currencies, timers, events or a store.
 */
export const MetroMap = ({
  metro,
  open: metroOpen,
  prev,
  next,
  onMetro,
  save,
  justCleared,
  onPick,
  onBack,
  onSettings,
}: Props): ReactElement => {
  const towns = metro.towns;
  const scroller = useRef<HTMLDivElement>(null);
  const name = STRINGS.metroNames[metro.id] ?? metro.id;
  const stars = towns.reduce((n, t) => n + starCount(save.levels[t.id]?.stars ?? []), 0);
  const score = towns.reduce((n, t) => n + (save.levels[t.id]?.bestScore ?? 0), 0);
  const order = useMemo(() => towns.map((t) => t.id), [towns]);
  const current = currentLevel(save, order);
  const currentIndex = order.indexOf(current);
  const clearedIndex = justCleared ? order.indexOf(justCleared) : -1;

  // Open on the current node.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = towns[clearedIndex >= 0 ? clearedIndex : currentIndex] ?? towns[0];
    const scale = el.scrollWidth / MAP_SIZE.width;
    el.scrollTop = focus.map.y * scale - el.clientHeight / 2;
    if (clearedIndex >= 0 && clearedIndex < towns.length - 1) {
      const next = towns[clearedIndex + 1];
      const t1 = setTimeout(() => el.scrollTo({ top: next.map.y * scale - el.clientHeight / 2, behavior: "smooth" }), 500);
      const t2 = setTimeout(() => audio.sfx("unlock"), 1900);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [towns, currentIndex, clearedIndex]);

  return (
    <div className="screen opaque map-screen">
      <aside className="map-side">
        <div className="row">
          <Button className="icon-btn" sound="back" onPress={onBack} label={STRINGS.back}>
            <BackIcon />
          </Button>
          <span className="grow" />
          <Button className="icon-btn" onPress={onSettings} label={STRINGS.settings}>
            <GearIcon />
          </Button>
        </div>
        <div>
          <div className="row tour-row">
            <Button
              className="icon-btn small"
              sound="back"
              onPress={() => prev && onMetro(prev.id)}
              label={STRINGS.prevStop}
              disabled={!prev}
            >
              ‹
            </Button>
            <div className="sub grow">{STRINGS.tourStop(metro.index + 1)}</div>
            <Button className="icon-btn small" onPress={() => next && onMetro(next.id)} label={STRINGS.nextStop} disabled={!next}>
              ›
            </Button>
          </div>
          <h1 className="display">{name}</h1>
        </div>
        <div className="stat">
          {STRINGS.totalStars}
          <b>
            <StarIcon on className="heart" />
            {stars}/{towns.length * 3}
          </b>
        </div>
        <div className="stat">
          {STRINGS.lives}
          <b>
            <HeartIcon className="heart" />
            {save.lives}
          </b>
        </div>
        <div className="stat">
          {STRINGS.belt}
          <b>
            <BeltIcon on={hasBelt(save, order)} className="heart" />
            {hasBelt(save, order) ? STRINGS.beltWon : STRINGS.beltNotYet}
          </b>
        </div>
        <div className="stat">
          {STRINGS.bestScore}
          <b>{score.toLocaleString()}</b>
        </div>
        <span className="grow" />
        <div className="sub">{metroOpen || !prev ? STRINGS.tapGym : STRINGS.stopLocked(STRINGS.metroNames[prev.id] ?? prev.id)}</div>
      </aside>

      <div className="map-scroll" ref={scroller}>
        <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} role="img" aria-label={name}>
          <defs>
            <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a4f63" />
              <stop offset="0.5" stopColor="#566057" />
              <stop offset="0.66" stopColor="#3f6b47" />
              <stop offset="1" stopColor="#2c5236" />
            </linearGradient>
            <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#9aa6b8" />
              <stop offset="0.5" stopColor="#f2f5f8" />
              <stop offset="1" stopColor="#8894a8" />
            </linearGradient>
          </defs>
          <rect width={MAP_SIZE.width} height={MAP_SIZE.height} fill="url(#land)" />

          <MetroArt metro={metro.id} towns={towns} />

          {/* the path: the whole route dimmed, the part you've won in gold */}
          <g fill="none" strokeLinecap="round">
            {towns.slice(0, -1).map((t, i) => (
              <path key={`p${i}`} d={segment(t.map, towns[i + 1].map)} stroke="rgba(10,10,18,0.55)" strokeWidth="26" />
            ))}
            {towns.slice(0, -1).map((t, i) => (
              <path
                key={`d${i}`}
                d={segment(t.map, towns[i + 1].map)}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="6"
                strokeDasharray="4 22"
              />
            ))}
            {towns.slice(0, -1).map((t, i) => {
              if (i >= currentIndex && !(save.levels[towns[i + 1].id]?.cleared || save.levels[t.id]?.cleared)) return null;
              if (!save.levels[t.id]?.cleared) return null;
              const drawing = i === clearedIndex;
              return (
                <path
                  key={`g${i}`}
                  d={segment(t.map, towns[i + 1].map)}
                  stroke="#f2c14e"
                  strokeWidth="14"
                  pathLength={1}
                  className={drawing ? "path-draw" : ""}
                />
              );
            })}
          </g>

          {/* nodes */}
          {towns.map((t, i) => {
            const rec = save.levels[t.id];
            const open = metroOpen && isUnlocked(save, order, t.id);
            const isCurrent = metroOpen && t.id === current && !rec?.cleared;
            const r = t.isChampion ? 58 : 42;
            const fill = !open ? "#4b4d5c" : rec?.cleared ? hex(t.theme.gymColor) : "#d62828";
            const ring = !open ? "#2c2d38" : rec?.cleared ? hex(t.theme.gymTrim) : "#f2c14e";
            const popping = clearedIndex >= 0 && i === clearedIndex + 1;
            return (
              <g
                key={t.id}
                className="node"
                transform={`translate(${t.map.x} ${t.map.y})`}
                role="button"
                tabIndex={0}
                aria-label={t.name}
                data-pad-first={t.id === current || undefined}
                onClick={() => {
                  audio.unlock();
                  audio.sfx(open ? "ui_tap" : "ui_back");
                  onPick(t.id);
                }}
              >
                {isCurrent && <circle className="pulse" r={r + 12} fill="none" stroke="#f2c14e" strokeWidth="8" />}
                <g className={popping ? "node-pop" : ""}>
                  <circle r={r + 6} cy="5" fill="rgba(0,0,0,0.4)" />
                  {/* gym crest: a shield */}
                  <path
                    d={`M0 ${-r} L${r * 0.92} ${-r * 0.62} L${r * 0.92} ${r * 0.1} Q${r * 0.9} ${r * 0.78} 0 ${r * 1.08} Q${-r * 0.9} ${r * 0.78} ${-r * 0.92} ${r * 0.1} L${-r * 0.92} ${-r * 0.62}Z`}
                    fill={fill}
                    stroke={ring}
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M0 ${-r * 0.8} L${r * 0.7} ${-r * 0.48} L${r * 0.7} ${-r * 0.2} L${-r * 0.7} ${-r * 0.2} L${-r * 0.7} ${-r * 0.48}Z`}
                    fill="rgba(255,255,255,0.16)"
                  />
                  {t.isChampion && open && (
                    <path
                      d={`M-30 ${-r - 6} L-22 ${-r - 34} L-8 ${-r - 14} L0 ${-r - 40} L8 ${-r - 14} L22 ${-r - 34} L30 ${-r - 6}Z`}
                      fill="#f2c14e"
                      stroke="#8a6210"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                  )}
                  {open ? (
                    <text
                      y={r * 0.38}
                      textAnchor="middle"
                      fontSize={t.isChampion ? 56 : 44}
                      fill={rec?.cleared ? hex(t.theme.gymTrim) : "#fff"}
                      stroke="rgba(0,0,0,0.5)"
                      strokeWidth="2"
                      paintOrder="stroke"
                    >
                      {t.isChampion ? "★" : i + 1}
                    </text>
                  ) : (
                    <g transform="translate(0 4)" fill="none" stroke="#c9cad6" strokeWidth="6" strokeLinecap="round">
                      <rect x="-15" y="-4" width="30" height="24" rx="5" fill="#8f91a3" />
                      <path d="M-9 -4v-8a9 9 0 0 1 18 0v8" />
                    </g>
                  )}
                </g>
                {/* stars beneath a cleared node */}
                {rec?.cleared && (
                  <g transform={`translate(0 ${r + 30})`}>
                    {rec.stars.map((on, s) => (
                      <path
                        key={s}
                        d={STAR_PATH}
                        transform={`translate(${(s - 1) * 30} ${s === 1 ? 6 : 0}) scale(1.55)`}
                        fill={on ? "#f2c14e" : "rgba(0,0,0,0.45)"}
                        stroke={on ? "#8a6210" : "rgba(255,255,255,0.3)"}
                        strokeWidth="1.2"
                      />
                    ))}
                  </g>
                )}
                <text
                  y={rec?.cleared ? r + 78 : r + 44}
                  textAnchor="middle"
                  fontSize="27"
                  fill={open ? "#fff" : "rgba(255,255,255,0.5)"}
                  stroke="rgba(10,10,18,0.85)"
                  strokeWidth="7"
                  paintOrder="stroke"
                  style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  {t.name}
                </text>
                {starCount(rec?.stars ?? []) === 3 && (
                  <circle r="9" cx={r * 0.8} cy={-r * 0.8} fill="#35c46b" stroke="#052611" strokeWidth="3" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
