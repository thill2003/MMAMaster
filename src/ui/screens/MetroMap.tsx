import { type ReactElement, useEffect, useMemo, useRef } from "react";

import { STRINGS } from "@/content/strings";
import { MAP_SIZE, type TownDef } from "@/content/towns/stLouis";
import { bestTotalScore, currentLevel, isUnlocked, type SaveData, starCount, totalStars } from "@/core/progress";
import { audio } from "@/engine";
import { Rng } from "@/shared/rng";

import { Button } from "../primitives/Button";
import { BackIcon, GearIcon, HeartIcon, StarIcon } from "../primitives/icons";

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** A smooth S-curve from one node to the next. */
const segment = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
};

const STAR_PATH = "M0 -9l2.6 5.6 6.1.7-4.5 4.2 1.2 6L0 4.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7z";

interface Props {
  towns: TownDef[];
  save: SaveData;
  /** A level cleared a moment ago: draw the path on to the next node and pop it open. */
  justCleared: string | null;
  onPick: (townId: string) => void;
  onBack: () => void;
  onSettings: () => void;
}

/**
 * The metro map (plan §4): a tall, scrolling map of the St. Louis area with numbered gym badges on a
 * winding path from Fenton at the bottom to the champion under the Arch at the top. Stylized — rivers,
 * bluffs, suburbs, city blocks — and deliberately free of currencies, timers, events or a store.
 */
export const MetroMap = ({ towns, save, justCleared, onPick, onBack, onSettings }: Props): ReactElement => {
  const scroller = useRef<HTMLDivElement>(null);
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

  // Scenery is seeded, so the map is the same every time.
  const scenery = useMemo(() => {
    const rng = new Rng(4242);
    const trees: Array<{ x: number; y: number; r: number }> = [];
    const houses: Array<{ x: number; y: number; c: string }> = [];
    const blocks: Array<{ x: number; y: number; w: number; h: number; tall: boolean }> = [];
    const clear = (x: number, y: number, d: number) => towns.every((t) => Math.hypot(t.map.x - x, t.map.y - y) > d);
    for (let i = 0; i < 260; i++) {
      const x = rng.range(20, 980);
      const y = rng.range(1480, 2380);
      if (clear(x, y, 90)) trees.push({ x, y, r: rng.range(9, 18) });
    }
    for (let i = 0; i < 90; i++) {
      const x = rng.range(40, 960);
      const y = rng.range(1500, 2200);
      if (clear(x, y, 100)) houses.push({ x, y, c: rng.pick(["#d9c9a8", "#c9b08c", "#e2d6c0", "#b8a184"]) });
    }
    for (let gy = 40; gy < 1380; gy += 62) {
      for (let gx = 30; gx < 960; gx += 74) {
        // Leave the river corridor and the nodes clear.
        const riverX = gy < 1040 ? 760 + (gy / 1040) * 60 - Math.max(0, gy - 600) * 0.35 : 690 + (gy - 1040) * 0.2;
        if (gx > riverX - 110) continue;
        if (!clear(gx + 28, gy + 22, 86)) continue;
        if (rng.chance(0.2)) continue;
        const downtown = Math.hypot(gx - 520, gy - 1130) < 240 || Math.hypot(gx - 500, gy - 260) < 220;
        blocks.push({ x: gx + rng.range(-4, 4), y: gy + rng.range(-4, 4), w: rng.range(44, 60), h: rng.range(34, 46), tall: downtown });
      }
    }
    return { trees, houses, blocks };
  }, [towns]);

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
          <div className="sub">Tour stop 1</div>
          <h1 className="display">{STRINGS.metroTitle}</h1>
        </div>
        <div className="stat">
          {STRINGS.totalStars}
          <b>
            <StarIcon on className="heart" />
            {totalStars(save)}/{towns.length * 3}
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
          {STRINGS.bestScore}
          <b>{bestTotalScore(save).toLocaleString()}</b>
        </div>
        <span className="grow" />
        <div className="sub">Tap a gym to fight</div>
      </aside>

      <div className="map-scroll" ref={scroller}>
        <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} role="img" aria-label={STRINGS.metroTitle}>
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

          {/* bluffs in the south */}
          <path
            d="M0 2400 L0 2180 Q120 2100 240 2190 Q360 2090 470 2200 Q600 2120 720 2210 Q860 2110 1000 2200 L1000 2400Z"
            fill="#244a30"
            opacity="0.7"
          />

          {/* city blocks */}
          {scenery.blocks.map((b, i) => (
            <g key={`b${i}`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill={b.tall ? "#6d7388" : "#5b6072"} />
              {b.tall && <rect x={b.x + 4} y={b.y - 10} width={b.w - 8} height={b.h} rx="3" fill="#868da3" />}
            </g>
          ))}

          {/* rivers: the Mississippi down the east side, the Missouri across the middle, the Meramec in the south */}
          <g fill="none" strokeLinecap="round">
            <path
              d="M760 -20 C820 300 900 700 700 1040 C620 1180 640 1300 760 1420 C840 1500 940 1520 1020 1530"
              stroke="#1f4f86"
              strokeWidth="84"
            />
            <path
              d="M760 -20 C820 300 900 700 700 1040 C620 1180 640 1300 760 1420 C840 1500 940 1520 1020 1530"
              stroke="#3c84c9"
              strokeWidth="64"
            />
            <path d="M-20 1650 C250 1600 480 1740 640 1700 C800 1660 900 1640 1020 1690" stroke="#1f4f86" strokeWidth="56" />
            <path d="M-20 1650 C250 1600 480 1740 640 1700 C800 1660 900 1640 1020 1690" stroke="#3c84c9" strokeWidth="40" />
            <path d="M-20 2330 C200 2290 380 2360 560 2320 C700 2290 860 2330 1020 2300" stroke="#3c84c9" strokeWidth="18" />
            <path
              d="M760 -20 C820 300 900 700 700 1040 C620 1180 640 1300 760 1420"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="4"
              strokeDasharray="30 50"
            />
          </g>
          <text x="842" y="640" fill="rgba(255,255,255,0.5)" fontSize="22" fontStyle="italic" transform="rotate(74 842 640)">
            Mississippi
          </text>
          <text x="150" y="1640" fill="rgba(255,255,255,0.5)" fontSize="20" fontStyle="italic" transform="rotate(-4 150 1640)">
            Missouri
          </text>

          {/* suburbs and trees */}
          {scenery.houses.map((h, i) => (
            <g key={`h${i}`} transform={`translate(${h.x} ${h.y})`}>
              <rect x="-9" y="-6" width="18" height="12" fill={h.c} />
              <path d="M-12 -6L0 -15L12 -6Z" fill="#8a4a3a" />
            </g>
          ))}
          {scenery.trees.map((t, i) => (
            <g key={`t${i}`}>
              <circle cx={t.x + 3} cy={t.y + 4} r={t.r} fill="rgba(0,0,0,0.22)" />
              <circle cx={t.x} cy={t.y} r={t.r} fill={i % 3 === 0 ? "#2f7a44" : "#256a39"} />
              <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.3} r={t.r * 0.45} fill="rgba(255,255,255,0.12)" />
            </g>
          ))}

          {/* the Arch, over the champion's node */}
          <g fill="none" strokeLinecap="round">
            <path d="M330 360 C350 -70 650 -70 670 360" stroke="rgba(0,0,0,0.3)" strokeWidth="34" transform="translate(8 10)" />
            <path d="M330 360 C350 -70 650 -70 670 360" stroke="url(#steel)" strokeWidth="30" />
            <path d="M330 360 C350 -70 650 -70 670 360" stroke="rgba(255,255,255,0.6)" strokeWidth="5" transform="translate(-6 0)" />
          </g>

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
            const open = isUnlocked(save, order, t.id);
            const isCurrent = t.id === current && !rec?.cleared;
            const r = t.isChampion ? 58 : 42;
            const fill = !open ? "#4b4d5c" : rec?.cleared ? hex(t.theme.gymColor) : "#d62828";
            const ring = !open ? "#2c2d38" : rec?.cleared ? hex(t.theme.gymTrim) : "#f2c14e";
            const popping = clearedIndex >= 0 && i === clearedIndex + 1;
            return (
              <g
                key={t.id}
                className="node"
                transform={`translate(${t.map.x} ${t.map.y})`}
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
