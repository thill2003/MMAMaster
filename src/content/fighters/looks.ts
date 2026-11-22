/** How a fighter is drawn. v0 art is procedural; these fields carry over as palette swaps for real sprites. */
export interface FighterLook {
  skin: number;
  shorts: number;
  trim: number;
  gloves: number;
  hair: number;
  hairStyle: "short" | "bald" | "mohawk" | "bun" | "headband";
  /** Padded boxing gloves (the default) or open-finger MMA gloves. */
  gloveStyle?: "boxing" | "mma";
  /** Overall size. */
  scale: number;
  /** Limb and torso thickness. */
  bulk: number;
  /** Ink colour for tattoos (arm sleeves, a chest piece, a calf band), or absent for none. */
  tattoo?: number;
  /** 0–1: muscle definition — bigger biceps, calves and shoulders, a pec line and abs. Absent is none. */
  muscle?: number;
}

/** Every computer-controlled fighter wears these. */
export const CPU_GLOVES = 0x1f5fd6;

/** Town leaders wear gold. */
export const LEADER_GLOVES = 0xd4af37;

export const PLAYER_LOOK: FighterLook = {
  skin: 0xe6b58e,
  shorts: 0x1d3fbf,
  trim: 0xf2c14e,
  gloves: 0x141414,
  gloveStyle: "mma",
  hair: 0x2b1d14,
  hairStyle: "headband",
  scale: 1.06,
  bulk: 1,
  tattoo: 0x1b2a3a,
  muscle: 1,
};

/** Base look per archetype; the level's gym colours replace shorts and trim, the rank sets the armband. */
export const ARCHETYPE_LOOKS: Record<string, FighterLook> = {
  brawler: {
    skin: 0xdcae88,
    shorts: 0x777777,
    trim: 0xffffff,
    gloves: CPU_GLOVES,
    gloveStyle: "mma",
    hair: 0x3a2a1e,
    hairStyle: "short",
    scale: 1.04,
    bulk: 1.15,
  },
  kicker: {
    skin: 0xc99872,
    shorts: 0x777777,
    trim: 0xffffff,
    gloves: CPU_GLOVES,
    gloveStyle: "mma",
    hair: 0x15131a,
    hairStyle: "bun",
    scale: 1.08,
    bulk: 0.86,
  },
  grappler: {
    skin: 0xe8bf9e,
    shorts: 0x777777,
    trim: 0xffffff,
    gloves: CPU_GLOVES,
    gloveStyle: "mma",
    hair: 0x6b4a2e,
    hairStyle: "bald",
    scale: 1.1,
    bulk: 1.4,
  },
  quick: {
    skin: 0x8a5a3a,
    shorts: 0x777777,
    trim: 0xffffff,
    gloves: CPU_GLOVES,
    gloveStyle: "mma",
    hair: 0x111111,
    hairStyle: "mohawk",
    scale: 0.94,
    bulk: 0.78,
  },
};

/** Armband (prajioud) colour by rank: white, blue, brown, black. */
export const RANK_COLORS = [0xf4f4f4, 0x2f6fde, 0x7a4a22, 0x141414];
