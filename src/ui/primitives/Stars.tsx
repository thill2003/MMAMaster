import type { ReactElement } from "react";

import { StarIcon } from "./icons";

export const Stars = ({ stars, big, animate }: { stars: readonly boolean[]; big?: boolean; animate?: boolean }): ReactElement => (
  <span className={`stars ${big ? "big" : ""}`}>
    {stars.map((on, i) => (
      <span key={i} className={animate && on ? "star-pop" : ""} style={animate ? { animationDelay: `${0.35 + i * 0.35}s` } : undefined}>
        <StarIcon on={on} />
      </span>
    ))}
  </span>
);
