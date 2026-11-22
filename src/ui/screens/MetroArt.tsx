import { type ReactElement, useMemo } from "react";

import type { TownDef } from "@/content/towns";
import { Rng } from "@/shared/rng";

interface ArtProps {
  towns: TownDef[];
}

/** Trees and houses for the suburbs at the bottom of a map, kept off the nodes. Seeded, so a map never changes. */
const suburbs = (rng: Rng, towns: TownDef[]) => {
  const clear = (x: number, y: number, d: number) => towns.every((t) => Math.hypot(t.map.x - x, t.map.y - y) > d);
  const trees: Array<{ x: number; y: number; r: number }> = [];
  const houses: Array<{ x: number; y: number; c: string }> = [];
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
  return { trees, houses, clear };
};

const Suburbs = ({ trees, houses }: Pick<ReturnType<typeof suburbs>, "trees" | "houses">): ReactElement => (
  <>
    {houses.map((h, i) => (
      <g key={`h${i}`} transform={`translate(${h.x} ${h.y})`}>
        <rect x="-9" y="-6" width="18" height="12" fill={h.c} />
        <path d="M-12 -6L0 -15L12 -6Z" fill="#8a4a3a" />
      </g>
    ))}
    {trees.map((t, i) => (
      <g key={`t${i}`}>
        <circle cx={t.x + 3} cy={t.y + 4} r={t.r} fill="rgba(0,0,0,0.22)" />
        <circle cx={t.x} cy={t.y} r={t.r} fill={i % 3 === 0 ? "#2f7a44" : "#256a39"} />
        <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.3} r={t.r * 0.45} fill="rgba(255,255,255,0.12)" />
      </g>
    ))}
  </>
);

/** St. Louis: the Mississippi down the east side, the Missouri across the middle, the Arch over the champion. */
const StLouisArt = ({ towns }: ArtProps): ReactElement => {
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
    <>
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
    </>
  );
};

/** The lakeshore, as one path: Lake Michigan fills everything east of it. */
const SHORE = "M840 -20 C800 260 870 520 820 800 C790 980 830 1180 900 1360 C930 1440 980 1480 1020 1500";
const RIVER_MAIN = "M826 1040 C720 1050 600 1030 470 1040";
const RIVER_NORTH = "M470 1040 C460 820 500 620 430 330";
const RIVER_SOUTH = "M470 1040 C470 1250 420 1420 330 1560 C240 1700 120 1820 -20 1900";

/**
 * Chicago: Lake Michigan on the east, the river's main stem with its north and south branches, the city grid,
 * the elevated loop downtown and a skyline behind the champion. Stylized and invented — no real buildings.
 */
const ChicagoArt = ({ towns }: ArtProps): ReactElement => {
  const scenery = useMemo(() => {
    const rng = new Rng(6060);
    const { trees, houses, clear } = suburbs(rng, towns);
    const blocks: Array<{ x: number; y: number; w: number; h: number; tall: boolean }> = [];
    // The grid: square blocks, streets straight north–south and east–west.
    for (let gy = 40; gy < 1440; gy += 58) {
      // Stay west of the shore, which bows out to x≈900 at the bottom of the city.
      const shoreX = gy < 800 ? 820 + Math.sin((gy / 800) * Math.PI) * 30 : 800 + ((gy - 800) / 560) * 100;
      for (let gx = 24; gx < 960; gx += 58) {
        if (gx > shoreX - 80) continue;
        if (Math.abs(gy + 20 - 1040) < 46 && gx > 420) continue; // the main stem
        if (!clear(gx + 22, gy + 20, 84)) continue;
        if (rng.chance(0.12)) continue;
        const tall = Math.hypot(gx - 560, gy - 1130) < 230 || Math.hypot(gx - 560, gy - 190) < 250;
        blocks.push({ x: gx, y: gy, w: 46, h: 42, tall });
      }
    }
    return { trees, houses, blocks };
  }, [towns]);

  return (
    <>
      {/* prairie in the south */}
      <path d="M0 2400 L0 2200 Q200 2150 420 2210 Q640 2160 820 2220 Q920 2190 1000 2210 L1000 2400Z" fill="#2f5a34" opacity="0.6" />

      {/* city blocks */}
      {scenery.blocks.map((b, i) => (
        <g key={`b${i}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={b.tall ? "#6d7388" : "#5b6072"} />
          {b.tall && <rect x={b.x + 4} y={b.y - 12} width={b.w - 8} height={b.h} rx="2" fill="#878ea5" />}
        </g>
      ))}

      {/* Lake Michigan, with a strip of lakefront park along the shore */}
      <path d={`${SHORE} L1020 -20Z`} fill="#1f4f86" />
      <path d={SHORE} fill="none" stroke="#2f7a44" strokeWidth="22" />
      <path d={SHORE} fill="none" stroke="#3c84c9" strokeWidth="8" transform="translate(14 0)" />
      {[260, 620, 980].map((y) => (
        <path key={y} d={`M920 ${y} q20 -10 40 0 t40 0`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      ))}
      <text x="930" y="560" fill="rgba(255,255,255,0.5)" fontSize="24" fontStyle="italic" transform="rotate(84 930 560)">
        Lake Michigan
      </text>

      {/* the river: main stem from the lake, a north branch and a south branch running off toward Joliet */}
      <g fill="none" strokeLinecap="round">
        {[RIVER_MAIN, RIVER_NORTH, RIVER_SOUTH].map((d) => (
          <path key={`o${d}`} d={d} stroke="#1f4f86" strokeWidth="40" />
        ))}
        {[RIVER_MAIN, RIVER_NORTH, RIVER_SOUTH].map((d) => (
          <path key={`i${d}`} d={d} stroke="#3c84c9" strokeWidth="26" />
        ))}
      </g>
      <text x="610" y="1018" fill="rgba(255,255,255,0.55)" fontSize="20" fontStyle="italic">
        Chicago River
      </text>

      {/* the elevated tracks that ring downtown */}
      <g fill="none">
        <rect x="410" y="1000" width="260" height="230" rx="18" stroke="rgba(0,0,0,0.35)" strokeWidth="14" transform="translate(4 6)" />
        <rect x="410" y="1000" width="260" height="230" rx="18" stroke="#3b3d48" strokeWidth="12" />
        <rect x="410" y="1000" width="260" height="230" rx="18" stroke="#c9ccd6" strokeWidth="3" strokeDasharray="10 8" />
      </g>

      {/* suburbs and trees */}
      <Suburbs trees={scenery.trees} houses={scenery.houses} />

      {/* the skyline behind the champion's node */}
      <g>
        {[
          [330, 120, 50, 230],
          [385, 40, 44, 310],
          [600, 20, 52, 330],
          [660, 90, 46, 260],
          [440, 150, 40, 200],
          [555, 120, 40, 230],
        ].map(([x, top, w, h], i) => (
          <g key={`s${i}`}>
            <rect x={x + 6} y={top + 8} width={w} height={h} fill="rgba(0,0,0,0.3)" />
            <rect x={x} y={top} width={w} height={h} fill={i % 2 ? "#3a4058" : "#2c3147"} />
            <rect
              x={x + 6}
              y={top + 10}
              width={w - 12}
              height={h - 20}
              fill="none"
              stroke="rgba(242,193,78,0.35)"
              strokeWidth="2"
              strokeDasharray="4 10"
            />
          </g>
        ))}
        <path d="M402 40 V-10 M418 40 V0" stroke="#c9ccd6" strokeWidth="4" />
      </g>
    </>
  );
};

/** The scenery under a metro's path and nodes. */
export const MetroArt = ({ metro, towns }: ArtProps & { metro: string }): ReactElement =>
  metro === "chicago" ? <ChicagoArt towns={towns} /> : <StLouisArt towns={towns} />;
