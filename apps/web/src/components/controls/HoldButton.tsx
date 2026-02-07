"use client";

import type { ReactNode } from "react";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  children: ReactNode;
};

export function HoldButton({ className, style, onHoldStart, onHoldEnd, children }: Props) {
  return (
    <button
      className={className}
      style={style}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onHoldStart();
      }}
      onPointerUp={() => onHoldEnd()}
      onPointerCancel={() => onHoldEnd()}
      onPointerLeave={() => onHoldEnd()}
    >
      {children}
    </button>
  );
}

