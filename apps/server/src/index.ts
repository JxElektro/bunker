import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, RoomCode, RoomState, Player } from "@bunker/protocol";

const PORT = Number(process.env.PORT ?? 4040);

type ServerRoom = {
  state: RoomState;
  hostSocketId: string | null;
  // Mapa para re-asociar reconexiones: playerId -> socketId
  socketsByPlayerId: Map<string, string>;
  lastActiveAtMs: number;
};

const rooms = new Map<RoomCode, ServerRoom>();

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true, credentials: true }
});

function makeRoomCode(): string {
  // Evita caracteres ambiguos: O/0, I/1.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 20; i++) {
    let code = "";
    for (let j = 0; j < 4; j++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  // Fallback (muy improbable)
  return randomUUID().slice(0, 6).toUpperCase();
}

function broadcastRoomState(room: ServerRoom) {
  io.to(room.state.roomCode).emit("room:state", { state: room.state });
}

function upsertPlayer(room: ServerRoom, next: Player): Player[] {
  const idx = room.state.players.findIndex((p) => p.playerId === next.playerId);
  if (idx === -1) return [...room.state.players, next];
  const players = room.state.players.slice();
  players[idx] = { ...players[idx], ...next };
  return players;
}

io.on("connection", (socket) => {
  // socket.id -> [{roomCode, playerId}] (un socket puede estar en 1 sala en MVP).
  let joinedRoom: { roomCode: RoomCode; playerId: string } | null = null;

  socket.on("room:create", ({ playerId, name }) => {
    const roomCode = makeRoomCode();
    const createdAtMs = Date.now();

    const host: Player = { playerId, name, role: "HOST", connected: true };
    const room: ServerRoom = {
      hostSocketId: socket.id,
      socketsByPlayerId: new Map([[playerId, socket.id]]),
      lastActiveAtMs: Date.now(),
      state: {
        roomCode,
        phase: "LOBBY",
        gameId: null,
        createdAtMs,
        players: [host]
      }
    };
    rooms.set(roomCode, room);

    socket.join(roomCode);
    joinedRoom = { roomCode, playerId };
    broadcastRoomState(room);
  });

  socket.on("room:join", ({ roomCode, playerId, name }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("room:error", { message: "Sala no existe (o expiró)." });
      return;
    }

    socket.join(roomCode);
    room.socketsByPlayerId.set(playerId, socket.id);
    room.lastActiveAtMs = Date.now();
    joinedRoom = { roomCode, playerId };

    room.state.players = upsertPlayer(room, {
      playerId,
      name,
      role: "PLAYER",
      connected: true
    });

    broadcastRoomState(room);
  });

  socket.on("room:leave", ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.socketsByPlayerId.delete(playerId);
    room.lastActiveAtMs = Date.now();
    joinedRoom = null;

    // No lo borramos de la sala: lo marcamos disconnected para permitir reconexión.
    room.state.players = room.state.players.map((p) =>
      p.playerId === playerId ? { ...p, connected: false } : p
    );

    broadcastRoomState(room);
  });

  socket.on("room:set-game", ({ roomCode, gameId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.lastActiveAtMs = Date.now();
    if (socket.id !== room.hostSocketId) {
      socket.emit("room:error", { message: "Solo el host puede seleccionar el juego." });
      return;
    }
    if (room.state.phase !== "LOBBY") {
      socket.emit("room:error", { message: "No se puede cambiar el juego con la partida iniciada." });
      return;
    }
    room.state.gameId = gameId;
    broadcastRoomState(room);
  });

  socket.on("room:start", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.lastActiveAtMs = Date.now();
    if (socket.id !== room.hostSocketId) {
      socket.emit("room:error", { message: "Solo el host puede iniciar." });
      return;
    }
    if (!room.state.gameId) {
      socket.emit("room:error", { message: "Selecciona un juego antes de iniciar." });
      return;
    }
    room.state.phase = "IN_GAME";
    broadcastRoomState(room);
  });

  socket.on("player:input", ({ roomCode, playerId, gameId, event }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.state.phase !== "IN_GAME") return;
    if (room.state.gameId !== gameId) return;
    room.lastActiveAtMs = Date.now();

    // Rate limit ultra-simple por playerId (evita spam accidental).
    const key = `${roomCode}:${playerId}`;
    const now = Date.now();
    const last = rateLimitLast.get(key) ?? 0;
    if (now - last < 12) return; // ~83 events/s max
    rateLimitLast.set(key, now);

    // MVP: el server solo routea los inputs. Los juegos viven en el host (authoritative).
    if (!room.hostSocketId) return;
    io.to(room.hostSocketId).emit("game:input", { roomCode, gameId, playerId, event });
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom.roomCode);
    if (!room) return;
    const { playerId } = joinedRoom;
    room.socketsByPlayerId.delete(playerId);
    room.lastActiveAtMs = Date.now();

    room.state.players = room.state.players.map((p) =>
      p.playerId === playerId ? { ...p, connected: false } : p
    );

    // Si el host se desconecta, terminamos la sala (MVP).
    if (socket.id === room.hostSocketId) {
      room.hostSocketId = null;
      room.state.phase = "ENDED";
      io.to(room.state.roomCode).emit("room:error", { message: "Host desconectado. Sala terminada." });
    }

    broadcastRoomState(room);
  });
});

const rateLimitLast = new Map<string, number>();

// TTL cleanup: borra salas inactivas por 10 min.
setInterval(() => {
  const now = Date.now();
  const TTL_MS = 10 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    const anyConnected = room.state.players.some((p) => p.connected);
    if (anyConnected) continue;
    if (now - room.lastActiveAtMs > TTL_MS) rooms.delete(code);
  }
}, 30_000);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[bunker/server] listening on :${PORT}`);
});
