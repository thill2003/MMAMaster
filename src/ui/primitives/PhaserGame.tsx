import { type ReactElement, useEffect, useRef } from "react";

import { GameBridge } from "@/engine";

/** Mounts the Phaser canvas once and hands the typed bridge up. The game lives for the whole session. */
export const PhaserGame = ({ onReady }: { onReady: (bridge: GameBridge | null) => void }): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onReady);
  cb.current = onReady;

  useEffect(() => {
    if (!ref.current) return;
    const bridge = new GameBridge(ref.current);
    cb.current(bridge);
    return () => {
      cb.current(null);
      bridge.destroy();
    };
  }, []);

  return <div ref={ref} className="game-mount" />;
};
