"use client";

import type { Dir } from "@bunker/games-tanks";
import { HoldButton } from "./HoldButton";

type Props = {
  onDir: (dir: Dir, pressed: boolean) => void;
};

export function DPad({ onDir }: Props) {
  const btn = "btn btnPrimary";
  const center = "btn";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      <div />
      <HoldButton className={btn} onHoldStart={() => onDir("UP", true)} onHoldEnd={() => onDir("UP", false)}>
        ↑
      </HoldButton>
      <div />

      <HoldButton className={btn} onHoldStart={() => onDir("LEFT", true)} onHoldEnd={() => onDir("LEFT", false)}>
        ←
      </HoldButton>
      <button className={center} disabled style={{ opacity: 0.6 }}>
        •
      </button>
      <HoldButton className={btn} onHoldStart={() => onDir("RIGHT", true)} onHoldEnd={() => onDir("RIGHT", false)}>
        →
      </HoldButton>

      <div />
      <HoldButton className={btn} onHoldStart={() => onDir("DOWN", true)} onHoldEnd={() => onDir("DOWN", false)}>
        ↓
      </HoldButton>
      <div />
    </div>
  );
}

