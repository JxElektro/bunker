"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ControlEvent, RoomState } from "@bunker/protocol";
import { TanksGame, TANKS_GAME_ID } from "@bunker/games-tanks";

type Props = {
  room: RoomState;
  inputs: Array<{ playerId: string; event: ControlEvent }>;
};

export function TanksHost({ room, inputs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);

  const playerIds = useMemo(
    () => room.players.filter((p) => p.role === "PLAYER").map((p) => p.playerId),
    [room.players]
  );

  const gameRef = useRef<TanksGame | null>(null);
  if (!gameRef.current || room.gameId !== TANKS_GAME_ID) {
    gameRef.current = new TanksGame(playerIds);
  }

  // apply incoming inputs
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    for (const i of inputs) g.handleInput(i.playerId, i.event);
  }, [inputs]);

  // tick loop (20Hz)
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    let alive = true;
    const iv = window.setInterval(() => {
      if (!alive) return;
      g.tick(Date.now());
      setTick((t) => t + 1);
    }, 50);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, []);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tile = 32;
    const w = g.state.width * tile;
    const h = g.state.height * tile;
    canvas.width = w;
    canvas.height = h;

    let raf = 0;
    const render = () => {
      // background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= g.state.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tile + 0.5, 0);
        ctx.lineTo(x * tile + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= g.state.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tile + 0.5);
        ctx.lineTo(w, y * tile + 0.5);
        ctx.stroke();
      }

      // bullets
      for (const b of g.state.bullets) {
        ctx.fillStyle = "rgba(246,193,119,0.95)";
        ctx.fillRect(b.x * tile + tile * 0.38, b.y * tile + tile * 0.38, tile * 0.24, tile * 0.24);
      }

      // tanks
      for (const t of Object.values(g.state.tanks)) {
        const hue = hashHue(t.playerId);
        ctx.fillStyle = `hsla(${hue} 80% 62% / 0.95)`;
        ctx.fillRect(t.x * tile + 3, t.y * tile + 3, tile - 6, tile - 6);

        // direction indicator
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 3;
        const cx = t.x * tile + tile / 2;
        const cy = t.y * tile + tile / 2;
        const [dx, dy] = dirVec(t.dir);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx * (tile * 0.32), cy + dy * (tile * 0.32));
        ctx.stroke();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [tick]);

  const g = gameRef.current;
  if (!g) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="pill">
        Tanks: {playerIds.length} jugadores, tick {g.state.tick}
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxWidth: 980,
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "rgba(0,0,0,0.2)"
        }}
      />
      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>Kills</div>
        <div style={{ display: "grid", gap: 6 }}>
          {Object.values(g.state.tanks)
            .sort((a, b) => b.kills - a.kills)
            .map((t) => (
              <div key={t.playerId} className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>{t.playerId.slice(0, 8)}</span>
                <span>{t.kills}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function dirVec(dir: string): [number, number] {
  switch (dir) {
    case "UP":
      return [0, -1];
    case "DOWN":
      return [0, 1];
    case "LEFT":
      return [-1, 0];
    case "RIGHT":
      return [1, 0];
    default:
      return [0, 0];
  }
}

