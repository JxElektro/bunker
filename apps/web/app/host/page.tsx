"use client";

import { useEffect, useMemo, useState } from "react";
import type { ControlEvent, RoomState } from "@bunker/protocol";
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from "@/src/lib/identity";
import { getSocket } from "@/src/lib/socket";
import { TanksHost } from "@/src/components/TanksHost";
import { TANKS_GAME_ID } from "@bunker/games-tanks";

type InputLog = { atMs: number; playerId: string; event: ControlEvent };

export default function HostPage() {
  const socket = useMemo(() => getSocket(), []);
  const [name, setName] = useState(getPlayerName() || "Host");
  const [state, setState] = useState<RoomState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputLog[]>([]);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [matchNonce, setMatchNonce] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [joinBaseUrl, setJoinBaseUrl] = useState<string>("");

  useEffect(() => {
    const onRoomState = ({ state }: { state: RoomState }) => setState(state);
    const onRoomError = ({ message }: { message: string }) => setErr(message);
    const onGameInput = (payload: { playerId: string; event: ControlEvent }) => {
      setInputs((prev) =>
        [{ atMs: Date.now(), playerId: payload.playerId, event: payload.event }, ...prev].slice(0, 250)
      );
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    // payload real: { roomCode, gameId, playerId, event }
    socket.on("game:input", ((payload: any) => onGameInput({ playerId: payload.playerId, event: payload.event })) as any);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
      socket.off("game:input");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  // match clock
  useEffect(() => {
    const iv = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(iv);
  }, []);

  // reset game instance when a match starts
  useEffect(() => {
    if (!state) return;
    if (state.phase === "IN_GAME" && state.gameId === TANKS_GAME_ID && state.startedAtMs) {
      setInputs([]); // clear old inputs
      setMatchNonce(state.startedAtMs);
    }
  }, [state?.phase, state?.gameId, state?.startedAtMs]);

  // join base url (para pruebas LAN cuando el host está en localhost)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("bunker_join_base_url");
    const initial = (saved && saved.trim()) ? saved : window.location.origin;
    setJoinBaseUrl(initial);
  }, []);

  useEffect(() => {
    async function buildQr() {
      if (!state?.roomCode) {
        setQrUrl(null);
        return;
      }
      const base = (joinBaseUrl || window.location.origin).replace(/\/$/, "");
      // QR usa el "join link" (sirve en prod también).
      const url = `${base}/play/${encodeURIComponent(state.roomCode)}`;
      try {
        const mod = await import("qrcode");
        const dataUrl = await mod.toDataURL(url, { margin: 1, scale: 6 });
        setQrUrl(dataUrl);
      } catch {
        setQrUrl(null);
      }
    }
    void buildQr();
  }, [state?.roomCode, joinBaseUrl]);

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

  function endMatch() {
    if (!state) return;
    socket.emit("room:end", { roomCode: state.roomCode });
  }

  function restart() {
    if (!state) return;
    socket.emit("room:restart", { roomCode: state.roomCode });
  }

  async function copyCode() {
    if (!state?.roomCode) return;
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="title" style={{ margin: 0 }}>Host</h1>
        <div className="row">
          <div className="pill">Socket: {connected ? "conectado" : "desconectado"}</div>
          <div className="pill">Pantalla principal</div>
        </div>
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
                <button className="btn" onClick={copyCode}>
                  {copied ? "Copiado" : "Copiar código"}
                </button>
                <button className="btn" onClick={selectTanks}>Seleccionar Tanks (tanks_v1)</button>
                <button className="btn btnPrimary" onClick={start} disabled={!state.gameId || state.phase !== "LOBBY"}>
                  Start
                </button>
                <button className="btn" onClick={endMatch} disabled={state.phase !== "IN_GAME"}>
                  Terminar
                </button>
                <button className="btn" onClick={restart}>
                  Reiniciar
                </button>
              </div>

              {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

	              <div style={{ height: 12 }} />
	              <div className="row">
	                <div className="pill">
	                  Link:{" "}
	                  <code>
	                    {typeof window !== "undefined"
	                      ? `${(joinBaseUrl || window.location.origin).replace(/\\/$/, "")}/play/${state.roomCode}`
	                      : ""}
	                  </code>
	                </div>
	              </div>
	              <div style={{ height: 10 }} />
	              <div className="field" style={{ margin: 0 }}>
	                <div className="label">Join base URL (para celular)</div>
	                <input
	                  type="text"
	                  value={joinBaseUrl}
	                  onChange={(e) => {
	                    const v = e.target.value;
	                    setJoinBaseUrl(v);
	                    try {
	                      window.localStorage.setItem("bunker_join_base_url", v);
	                    } catch {
	                      // ignore
	                    }
	                  }}
	                  placeholder="Ej: http://192.168.1.10:3000"
	                />
	              </div>
	              {qrUrl && (
                <>
                  <div style={{ height: 10 }} />
                  <div className="row">
                    <div className="pill">QR</div>
                  </div>
                  <img
                    alt="QR Join"
                    src={qrUrl}
                    style={{ width: 160, height: 160, borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                </>
              )}

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
          <h2 style={{ margin: "0 0 8px 0" }}>Juego</h2>
          {!state || state.gameId !== TANKS_GAME_ID ? (
            <>
              <p className="subtitle" style={{ marginTop: 0 }}>
                Cuando inicies la partida con <code>tanks_v1</code>, acá aparece el canvas del juego.
              </p>
              <div className="pill">Inputs buffer: {inputs.length}</div>
            </>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="pill">
                  Tiempo:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {formatMs(remainingMs(state, nowMs))}
                  </strong>
                </div>
                <div className="pill">Fase: {state.phase}</div>
              </div>
              <div style={{ height: 12 }} />

              {state.phase === "IN_GAME" ? (
                <TanksHost
                  key={matchNonce}
                  room={state}
                  inputs={inputs.map((i) => ({ playerId: i.playerId, event: i.event }))}
                />
              ) : (
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Partida terminada</h3>
                  <p className="subtitle" style={{ marginTop: 0 }}>
                    Presiona <strong>Reiniciar</strong> para volver al lobby y empezar otra ronda.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function remainingMs(state: RoomState, nowMs: number): number {
  if (!state.startedAtMs || !state.matchDurationMs) return state.matchDurationMs ?? 90_000;
  const end = state.startedAtMs + state.matchDurationMs;
  return Math.max(0, end - nowMs);
}

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
