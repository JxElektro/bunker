"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomState } from "@bunker/protocol";
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from "@/src/lib/identity";
import { getSocket } from "@/src/lib/socket";

type InputLog = { atMs: number; playerId: string; event: unknown };

export default function HostPage() {
  const socket = useMemo(() => getSocket(), []);
  const [name, setName] = useState(getPlayerName() || "Host");
  const [state, setState] = useState<RoomState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputLog[]>([]);

  useEffect(() => {
    const onRoomState = ({ state }: { state: RoomState }) => setState(state);
    const onRoomError = ({ message }: { message: string }) => setErr(message);
    const onGameInput = (payload: { playerId: string; event: unknown }) => {
      setInputs((prev) => [{ atMs: Date.now(), playerId: payload.playerId, event: payload.event }, ...prev].slice(0, 50));
    };

    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    // payload real: { roomCode, gameId, playerId, event }
    socket.on("game:input", ((payload: any) => onGameInput({ playerId: payload.playerId, event: payload.event })) as any);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
      socket.off("game:input");
    };
  }, [socket]);

  function createRoom() {
    setErr(null);
    setPlayerName(name);
    socket.emit("room:create", { playerId: getOrCreatePlayerId(), name });
  }

  function selectTanks() {
    if (!state) return;
    socket.emit("room:set-game", { roomCode: state.roomCode, gameId: "tanks_v1" });
  }

  function start() {
    if (!state) return;
    socket.emit("room:start", { roomCode: state.roomCode });
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="title" style={{ margin: 0 }}>Host</h1>
        <div className="pill">Modo: pantalla principal</div>
      </div>

      <div className="grid2">
        <section className="card">
          <h2 style={{ margin: "0 0 8px 0" }}>Sala</h2>

          {!state ? (
            <>
              <div className="field">
                <div className="label">Nombre del host</div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <button className="btn btnPrimary" onClick={createRoom}>
                Crear sala
              </button>
              {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            </>
          ) : (
            <>
              <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
                <div>
                  <div className="label">Código</div>
                  <div className="code">{state.roomCode}</div>
                </div>
                <div className="pill">Fase: {state.phase}</div>
                <div className="pill">Juego: {state.gameId ?? "none"}</div>
              </div>

              <div style={{ height: 12 }} />
              <div className="row">
                <button className="btn" onClick={selectTanks}>Seleccionar Tanks (tanks_v1)</button>
                <button className="btn btnPrimary" onClick={start} disabled={!state.gameId || state.phase !== "LOBBY"}>
                  Start
                </button>
              </div>

              {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

              <div style={{ height: 12 }} />
              <div className="label">Jugadores</div>
              <ul className="list">
                {state.players.map((p) => (
                  <li key={p.playerId} className="player">
                    <span>{p.name} <span style={{ color: "var(--muted)" }}>({p.role})</span></span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className={"dot " + (p.connected ? "dotOk" : "dotBad")} />
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        {p.connected ? "Conectado" : "Desconectado"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2 style={{ margin: "0 0 8px 0" }}>Debug</h2>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Inputs recibidos (serán la base para el juego de tanques).
          </p>

          <div className="pill">Últimos {inputs.length} inputs</div>
          <div style={{ height: 10 }} />
          <div style={{ display: "grid", gap: 8 }}>
            {inputs.map((i) => (
              <div key={i.atMs} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.03)" }}>
                <div className="label">playerId: <code>{i.playerId}</code></div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                  {JSON.stringify(i.event, null, 2)}
                </pre>
              </div>
            ))}
            {inputs.length === 0 && <div style={{ color: "var(--muted)" }}>Aún no llegan inputs.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
