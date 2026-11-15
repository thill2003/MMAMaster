import type { ReactElement } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const StarIcon = ({ on, className }: { on: boolean; className?: string }): ReactElement => (
  // Colours and the earned/unearned shape (filled vs dashed outline) are in styles.css (MM-109a).
  <svg viewBox="0 0 24 24" className={`star ${on ? "on" : "off"} ${className ?? ""}`}>
    <path d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1 5.9 20.5l1.4-6.7-5-4.6 6.7-.8z" strokeWidth="1.4" strokeLinejoin="round" />
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
