import type { ReactElement } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const StarIcon = ({ on, className }: { on: boolean; className?: string }): ReactElement => (
  <svg viewBox="0 0 24 24" className={className}>
    <path
      d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1 5.9 20.5l1.4-6.7-5-4.6 6.7-.8z"
      fill={on ? "#f2c14e" : "rgba(255,255,255,0.1)"}
      stroke={on ? "#8a6210" : "rgba(255,255,255,0.35)"}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const HeartIcon = ({ className }: { className?: string }): ReactElement => (
  <svg viewBox="0 0 24 24" className={className}>
    <path
      d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z"
      fill="currentColor"
      stroke="#4a0a08"
      strokeWidth="1.4"
    />
  </svg>
);

export const PauseIcon = (): ReactElement => (
  <svg viewBox="0 0 24 24">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
);

export const GearIcon = (): ReactElement => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </svg>
);

export const BackIcon = (): ReactElement => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </svg>
);

export const LockIcon = ({ className }: { className?: string }): ReactElement => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="currentColor" fillOpacity="0.25" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);

/** Strike icons, engraved-style line glyphs on the buttons. */
export const PunchIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M9 12.5c0-2 1.5-3.5 3.5-3.5h9a4.5 4.5 0 0 1 4.5 4.5v4.5a5 5 0 0 1-5 5h-7.5a4.5 4.5 0 0 1-4.5-4.5z" />
    <path d="M14 9v6M18.5 9v6M23 10v5M9 15.5h14.5" />
    <path d="M3 13h3M2 17h4M3.5 21h3" />
  </svg>
);

export const ElbowIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M6 9l11 2.5L26 6" strokeWidth="5.5" />
    <path d="M6 9l11 2.5L26 6" stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />
    <path d="M15 17l2 3M19.5 16l3 2.5M11 18l-.5 3.5" />
    <circle cx="17" cy="11.5" r="1.3" fill="currentColor" />
  </svg>
);

export const KickIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M7 8l8 7 11-1" strokeWidth="5.5" />
    <path d="M26 14l2.5-3" strokeWidth="5" />
    <path d="M7 8l8 7 11-1" stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />
    <path d="M19 20h7M17 24h6" />
  </svg>
);

export const KneeIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M8 7l12 6-5 11" strokeWidth="5.5" />
    <path d="M8 7l12 6-5 11" stroke="rgba(0,0,0,0.55)" strokeWidth="1.2" />
    <path d="M24 9l3-1.5M25 13.5h3.5M23.5 17.5l3 1.5" />
  </svg>
);

export const ShieldIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M16 4l9 3v7c0 6-4 10-9 13-5-3-9-7-9-13V7z" />
  </svg>
);

export const DrinkIcon = (): ReactElement => (
  <svg viewBox="0 0 32 32">
    <rect x="10" y="6" width="12" height="21" rx="3" fill="#27c46b" stroke="#052611" strokeWidth="2" />
    <rect x="10" y="13" width="12" height="5" fill="#f2f2f2" />
    <rect x="12" y="3.5" width="8" height="3" rx="1" fill="#cfd6dd" stroke="#052611" strokeWidth="1.5" />
    <path d="M17.5 9.5l-3 4.5h3l-1.5 4" fill="none" stroke="#052611" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

export const RotateIcon = (): ReactElement => (
  <svg viewBox="0 0 48 48" {...stroke}>
    <rect x="15" y="6" width="18" height="36" rx="3" />
    <path d="M22 37h4" />
  </svg>
);

/** The championship belt: a black leather strap, gold side plates and a big gold center plate with a star. */
export const BeltArt = ({ className }: { className?: string }): ReactElement => (
  <svg viewBox="0 0 320 140" className={className} role="img" aria-hidden>
    <defs>
      <linearGradient id="belt-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff1b8" />
        <stop offset="0.45" stopColor="#f2c14e" />
        <stop offset="1" stopColor="#9a6c12" />
      </linearGradient>
      <linearGradient id="belt-strap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a2a33" />
        <stop offset="1" stopColor="#0c0c10" />
      </linearGradient>
    </defs>
    {/* strap */}
    <path d="M4 58 Q160 44 316 58 L316 98 Q160 84 4 98Z" fill="url(#belt-strap)" stroke="#000" strokeWidth="2" />
    <path d="M10 64 Q160 51 310 64 M10 92 Q160 78 310 92" fill="none" stroke="#d62828" strokeWidth="2" strokeDasharray="5 5" />
    {/* side plates */}
    {[52, 268].map((x) => (
      <g key={x} transform={`translate(${x} 77)`}>
        <rect x="-24" y="-20" width="48" height="40" rx="8" fill="url(#belt-gold)" stroke="#6b4a08" strokeWidth="2.5" />
        <circle r="9" fill="#d62828" stroke="#6b4a08" strokeWidth="2" />
      </g>
    ))}
    {/* center plate */}
    <g transform="translate(160 72)">
      <path
        d="M0 -64 L52 -46 L66 0 L52 46 L0 64 L-52 46 L-66 0 L-52 -46Z"
        fill="url(#belt-gold)"
        stroke="#6b4a08"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M0 -50 L40 -36 L51 0 L40 36 L0 50 L-40 36 L-51 0 L-40 -36Z" fill="none" stroke="#9a6c12" strokeWidth="2" />
      <circle r="30" fill="#1b1a38" stroke="#6b4a08" strokeWidth="2.5" />
      <path
        d="M0 -21l6.2 13.2 14.4 1.6-10.7 9.9 3 14.2L0 10.3l-12.9 7.4 3-14.2L-20.6-6.2l14.4-1.6z"
        fill="url(#belt-gold)"
        stroke="#6b4a08"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

/** A small belt glyph for stat rows. */
export const BeltIcon = ({ on, className }: { on: boolean; className?: string }): ReactElement => (
  <svg viewBox="0 0 24 24" className={className}>
    <rect
      x="1"
      y="9"
      width="22"
      height="6"
      rx="2"
      fill={on ? "#1b1a20" : "rgba(255,255,255,0.1)"}
      stroke={on ? "#000" : "rgba(255,255,255,0.35)"}
      strokeWidth="1"
    />
    <path
      d="M12 5.5L16.5 7.5 17.5 12 16.5 16.5 12 18.5 7.5 16.5 6.5 12 7.5 7.5Z"
      fill={on ? "#f2c14e" : "rgba(255,255,255,0.1)"}
      stroke={on ? "#8a6210" : "rgba(255,255,255,0.35)"}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);
