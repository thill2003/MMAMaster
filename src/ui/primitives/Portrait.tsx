import type { ReactElement } from "react";

import type { FighterLook } from "@/content/fighters/looks";

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** A leader's bust for the level card, drawn from the same look data the fight uses. */
export const Portrait = ({ look, accent }: { look: FighterLook; accent: number }): ReactElement => {
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const w = 26 + look.bulk * 16;
  return (
    <svg viewBox="0 0 120 140">
      <defs>
        <radialGradient id="pg" cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor={hex(accent)} stopOpacity="0.55" />
          <stop offset="1" stopColor="#0e0d1c" />
        </radialGradient>
      </defs>
      <rect width="120" height="140" fill="url(#pg)" />
      <path
        d={`M${60 - w - 14} 140 Q${60 - w - 10} 96 ${60 - 12} 92 L${60 + 12} 92 Q${60 + w + 10} 96 ${60 + w + 14} 140Z`}
        fill={skin}
        stroke="#17121c"
        strokeWidth="3"
      />
      <rect x="52" y="78" width="16" height="18" fill={skin} stroke="#17121c" strokeWidth="3" />
      <circle cx="60" cy="58" r="25" fill={skin} stroke="#17121c" strokeWidth="3" />
      {look.hairStyle !== "bald" && (
        <path d="M35 56 Q36 30 60 30 Q84 30 85 56 Q78 42 60 42 Q42 42 35 56Z" fill={hair} stroke="#17121c" strokeWidth="2" />
      )}
      {look.hairStyle === "mohawk" && <path d="M52 34 Q60 14 68 34Z" fill={hair} stroke="#17121c" strokeWidth="2" />}
      {look.hairStyle === "bun" && <circle cx="60" cy="27" r="8" fill={hair} stroke="#17121c" strokeWidth="2" />}
      {look.hairStyle === "headband" && (
        <rect x="35" y="44" width="50" height="7" rx="2" fill={hex(look.trim)} stroke="#17121c" strokeWidth="2" />
      )}
      <path d="M45 56l10 3M75 56l-10 3" stroke="#17121c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="62" r="2.4" fill="#17121c" />
      <circle cx="70" cy="62" r="2.4" fill="#17121c" />
      <path d="M52 73 Q60 70 68 73" fill="none" stroke="#17121c" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={60 - w - 4} cy="128" r="13" fill={hex(look.gloves)} stroke="#17121c" strokeWidth="3" />
      <circle cx={60 + w + 4} cy="128" r="13" fill={hex(look.gloves)} stroke="#17121c" strokeWidth="3" />
    </svg>
  );
};
