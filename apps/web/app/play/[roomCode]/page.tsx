"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ControlEvent, RoomState } from "@bunker/protocol";
import { getOrCreatePlayerId, getPlayerName } from "@/src/lib/identity";
import { getSocket } from "@/src/lib/socket";

function holdButtonHandlers(onDown: () => void, onUp: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onDown();
    },
    onPointerUp: () => onUp(),
    onPointerCancel: () => onUp(),
    onPointerLeave: () => onUp()
  };
}

export default function ControllerPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode ?? "").toUpperCase();

  const socket = useMemo(() => getSocket(), []);
  const [state, setState] = useState<RoomState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const name = useMemo(() => getPlayerName() || `Player`, []);

  useEffect(() => {
    const onRoomState = ({ state }: { state: RoomState }) => setState(state);
    const onRoomError = ({ message }: { message: string }) => setErr(message);

    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);

    socket.emit("room:join", { roomCode, playerId, name });

    return () => {
      socket.emit("room:leave", { roomCode, playerId });
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
    };
  }, [socket, roomCode, playerId, name]);

  function send(event: ControlEvent) {
    if (!state?.gameId) return;
    socket.emit("player:input", { roomCode, playerId, gameId: state.gameId, event });
  }

  const phase = state?.phase ?? "LOBBY";
  const gameId = state?.gameId ?? null;

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="pill">Sala <strong style={{ color: "var(--text)" }}>{roomCode}</strong></div>
          <div style={{ height: 8 }} />
          <div className="pill">Fase: {phase}</div>
          <div style={{ height: 8 }} />
          <div className="pill">Juego: {gameId ?? "none"}</div>
        </div>
        <div className="pill">Yo: {name}</div>
      </div>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Controles</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          MVP: botones grandes (hold). El juego real viene después.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div />
            <button
              className="btn btnPrimary"
              {...holdButtonHandlers(
                () => send({ type: "MOVE", dir: "UP", pressed: true }),
                () => send({ type: "MOVE", dir: "UP", pressed: false })
              )}
            >
              ↑
            </button>
            <div />

            <button
              className="btn btnPrimary"
              {...holdButtonHandlers(
                () => send({ type: "MOVE", dir: "LEFT", pressed: true }),
                () => send({ type: "MOVE", dir: "LEFT", pressed: false })
              )}
            >
              ←
            </button>
            <button className="btn" disabled style={{ opacity: 0.6 }}>•</button>
            <button
              className="btn btnPrimary"
              {...holdButtonHandlers(
                () => send({ type: "MOVE", dir: "RIGHT", pressed: true }),
                () => send({ type: "MOVE", dir: "RIGHT", pressed: false })
              )}
            >
              →
            </button>

            <div />
            <button
              className="btn btnPrimary"
              {...holdButtonHandlers(
                () => send({ type: "MOVE", dir: "DOWN", pressed: true }),
                () => send({ type: "MOVE", dir: "DOWN", pressed: false })
              )}
            >
              ↓
            </button>
            <div />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              className="btn btnPrimary"
              style={{ padding: 18, fontSize: 18 }}
              {...holdButtonHandlers(
                () => send({ type: "ACTION", id: "SHOOT", pressed: true }),
                () => send({ type: "ACTION", id: "SHOOT", pressed: false })
              )}
            >
              Disparar
            </button>

            <div className="pill">
              Tip: si el host aún está en lobby o no seleccionó juego, no se envían inputs.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

