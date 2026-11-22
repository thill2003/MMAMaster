import { type FighterLook, LEADER_GLOVES } from "../fighters/looks";

import { ST_LOUIS } from "./stLouis";
import type { ThemeDef, TownDef } from "./types";

/** What makes a Chicago level itself. The fight's shape — stream, packs, clock, the leader's style — comes from the St. Louis level at the same index. */
interface ChicagoStop {
  id: string;
  name: string;
  gym: string;
  blurb: string;
  leader: { id: string; name: string; title: string };
  look: Pick<FighterLook, "skin" | "hair" | "hairStyle">;
  theme: Omit<ThemeDef, "kit" | "arch">;
  map: { x: number; y: number };
}

const STOPS: ChicagoStop[] = [
  {
    id: "joliet",
    name: "Joliet",
    gym: "Iron Bridge Muay Thai",
    blurb: "Rail yards and river bridges. Welcome to Chicagoland — they hit harder up here.",
    leader: { id: "frank-kowalski", name: "Frank Kowalski", title: "The Freight Train" },
    look: { skin: 0xe8b996, hair: 0x5a3e2a, hairStyle: "bald" },
    theme: {
      timeOfDay: "morning",
      signs: ["IRON BRIDGE MUAY THAI", "DINER", "AUTO PARTS", "LAUNDROMAT"],
      gymColor: 0x5b5f66,
      gymTrim: 0xf28c28,
    },
    map: { x: 300, y: 2240 },
  },
  {
    id: "naperville",
    name: "Naperville",
    gym: "Riverwalk Striking Academy",
    blurb: "Spotless mats and long legs. Every one of them can kick your head off.",
    leader: { id: "ingrid-dahl", name: "Coach Ingrid Dahl", title: "The Long Reach" },
    look: { skin: 0xf0c9a8, hair: 0xd9b45a, hairStyle: "bun" },
    theme: { timeOfDay: "noon", signs: ["RIVERWALK STRIKING", "COFFEE", "BOOKS", "FROZEN YOGURT"], gymColor: 0x0f6e6e, gymTrim: 0xffffff },
    map: { x: 680, y: 2030 },
  },
  {
    id: "schaumburg",
    name: "Schaumburg",
    gym: "Northwest Kickboxing Club",
    blurb: "Strip malls to the horizon, and a gym full of fast hands behind one of them.",
    leader: { id: "tina-reyes", name: "Tina Reyes", title: "The Northwest Whip" },
    look: { skin: 0xc68e63, hair: 0x1a1414, hairStyle: "bun" },
    theme: {
      timeOfDay: "afternoon",
      signs: ["NORTHWEST KICKBOXING", "MATTRESS OUTLET", "PHONE REPAIR", "NAIL SALON"],
      gymColor: 0x6a2c91,
      gymTrim: 0xf2c14e,
    },
    map: { x: 320, y: 1810 },
  },
  {
    id: "cicero",
    name: "Cicero",
    gym: "Cermak Fight Club",
    blurb: "Old brick and heavy hands. Nobody here backs up.",
    leader: { id: "hector-ruiz", name: "Hector Ruiz", title: "The Bear of Cicero" },
    look: { skin: 0xb27a52, hair: 0x15110e, hairStyle: "short" },
    theme: { timeOfDay: "sunset", signs: ["CERMAK FIGHT CLUB", "TAQUERIA", "PANADERIA", "TIRES"], gymColor: 0x2e7d32, gymTrim: 0xffffff },
    map: { x: 700, y: 1590 },
  },
  {
    id: "oak-park",
    name: "Oak Park",
    gym: "Prairie House Martial Arts",
    blurb: "Quiet streets, quick feet. You won't see the first shot coming.",
    leader: { id: "darnell-price", name: "Darnell Price", title: "The Ghost Step" },
    look: { skin: 0x6b4430, hair: 0x0f0f0f, hairStyle: "mohawk" },
    theme: { timeOfDay: "dusk", signs: ["PRAIRIE HOUSE MMA", "FLORIST", "BIKE SHOP", "BAKERY"], gymColor: 0x8d5a2b, gymTrim: 0xf5deb3 },
    map: { x: 760, y: 1350 },
  },
  {
    id: "the-loop",
    name: "The Loop",
    gym: "El Track Fight Society",
    blurb: "Under the elevated tracks downtown. The trains roar and so do they.",
    leader: { id: "victor-sobczak", name: "Victor Sobczak", title: "Boss of the Loop" },
    look: { skin: 0xdcae88, hair: 0x2a2a2a, hairStyle: "short" },
    theme: {
      timeOfDay: "night",
      signs: ["EL TRACK FIGHT SOCIETY", "DELI", "SHOE SHINE", "NEWSSTAND"],
      gymColor: 0x1c2b4a,
      gymTrim: 0xe63946,
    },
    map: { x: 540, y: 1130 },
  },
  {
    id: "pilsen",
    name: "Pilsen",
    gym: "18th Street Nak Muay",
    blurb: "Murals on every wall and a gym that trains the old way.",
    leader: { id: "lupe-garza", name: "Lupe Garza", title: "Queen of 18th Street" },
    look: { skin: 0xb98058, hair: 0x1b1210, hairStyle: "headband" },
    theme: { timeOfDay: "sunset", signs: ["18TH ST NAK MUAY", "MURAL ARTS", "TAQUERIA", "PALETAS"], gymColor: 0xd62f6b, gymTrim: 0x2ec4b6 },
    map: { x: 250, y: 900 },
  },
  {
    id: "bridgeport",
    name: "Bridgeport",
    gym: "Stockyard Boxing & Muay Thai",
    blurb: "A neighborhood gym that's been here longer than anyone can remember.",
    leader: { id: "tommy-keane", name: "Tommy Keane", title: "The Bridgeport Brick" },
    look: { skin: 0xf0c4a2, hair: 0xa0522d, hairStyle: "short" },
    theme: {
      timeOfDay: "afternoon",
      signs: ["STOCKYARD BOXING", "TAVERN", "HARDWARE", "CORNER STORE"],
      gymColor: 0x14532d,
      gymTrim: 0xf2c14e,
    },
    map: { x: 610, y: 690 },
  },
  {
    id: "wicker-park",
    name: "Wicker Park",
    gym: "Six Points Striking",
    blurb: "Six streets meet and everyone here can fly. Watch the knees.",
    leader: { id: "kai-lindqvist", name: "Kai Lindqvist", title: "The Wicker Park Flyer" },
    look: { skin: 0xe9c4a6, hair: 0xe8e2d0, hairStyle: "mohawk" },
    theme: { timeOfDay: "dusk", signs: ["SIX POINTS STRIKING", "RECORDS", "VINTAGE", "COFFEE"], gymColor: 0x00a6d6, gymTrim: 0x111111 },
    map: { x: 300, y: 470 },
  },
  {
    id: "chicago",
    name: "Chicago",
    gym: "Lakefront Champions Hall",
    blurb: "On the lakefront under the skyline. The best in Chicago, then its champion.",
    leader: { id: "malik-stone", name: "Malik Stone", title: "Champion of Chicago" },
    look: { skin: 0x7a4b2e, hair: 0x0c0c0c, hairStyle: "headband" },
    theme: { timeOfDay: "night", signs: ["LAKEFRONT CHAMPIONS HALL"], gymColor: 0x0b1f3a, gymTrim: 0xd4af37 },
    map: { x: 520, y: 190 },
  },
];

/**
 * Chicago metro, tour stop 2 (MM-201): five suburbs, the Loop, three city neighborhoods, then the champion.
 * Each level reuses the shape of the St. Louis level at the same index; the metro ramp (`rampFor`, metro 1)
 * makes every enemy tougher and harder-hitting. Gym, leader and storefront names are invented (plan §12).
 */
export const CHICAGO: TownDef[] = STOPS.map((stop, i): TownDef => {
  const base = ST_LOUIS[i];
  return {
    ...base,
    id: stop.id,
    metro: "chicago",
    name: stop.name,
    gym: stop.gym,
    blurb: stop.blurb,
    seed: base.seed + 2000,
    leader: { ...base.leader, ...stop.leader },
    leaderLook: {
      ...base.leaderLook,
      ...stop.look,
      shorts: stop.theme.gymColor,
      trim: stop.theme.gymTrim,
      gloves: LEADER_GLOVES,
    },
    theme: { ...stop.theme, kit: base.theme.kit, arch: false },
    map: stop.map,
  };
});
