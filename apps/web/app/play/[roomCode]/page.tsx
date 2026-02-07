"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ControlEvent, RoomState } from "@bunker/protocol";
import { getOrCreatePlayerId, getPlayerName } from "@/src/lib/identity";
import { getSocket } from "@/src/lib/socket";
import { DPad } from "@/src/components/controls/DPad";
import { HoldButton } from "@/src/components/controls/HoldButton";

export default function ControllerPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode ?? "").toUpperCase();

  const socket = useMemo(() => getSocket(), []);
  const [state, setState] = useState<RoomState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const name = useMemo(() => getPlayerName() || `Player`, []);

  useEffect(() => {
    const onRoomState = ({ state }: { state: RoomState }) => setState(state);
    const onRoomError = ({ message }: { message: string }) => setErr(message);
    const onConnect = () => {
      setConnected(true);
      socket.emit("room:join", { roomCode, playerId, name });
    };
    const onDisconnect = () => setConnected(false);

    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.emit("room:join", { roomCode, playerId, name });

    return () => {
      socket.emit("room:leave", { roomCode, playerId });
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
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
          <div style={{ height: 8 }} />
          <div className="pill">Socket: {connected ? "conectado" : "desconectado (reconectando...)"}</div>
        </div>
        <div className="pill">Yo: {name}</div>
      </div>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Controles</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          MVP: botones grandes (hold). Optimizado para jugar mirando la pantalla del host.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DPad onDir={(dir, pressed) => send({ type: "MOVE", dir, pressed })} />

          <div style={{ display: "grid", gap: 10 }}>
            <HoldButton
              className="btn btnPrimary"
              style={{ padding: 18, fontSize: 18 }}
              onHoldStart={() => send({ type: "ACTION", id: "SHOOT", pressed: true })}
              onHoldEnd={() => send({ type: "ACTION", id: "SHOOT", pressed: false })}
            >
              Disparar
            </HoldButton>

            <div className="pill">
              Tip: si el host aún está en lobby o no seleccionó juego, no se envían inputs.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
