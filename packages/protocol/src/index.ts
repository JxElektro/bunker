export type RoomCode = string;

export type RoomPhase = "LOBBY" | "IN_GAME" | "ENDED";

export type PlayerRole = "HOST" | "PLAYER";

export type Player = {
  playerId: string; // persistente (localStorage) o auth userId en el futuro
  name: string;
  role: PlayerRole;
  connected: boolean;
};

export type RoomState = {
  roomCode: RoomCode;
  phase: RoomPhase;
  gameId: string | null;
  createdAtMs: number;
  players: Player[];
};

// Inputs genéricos (los juegos mapean esto a su lógica).
export type ControlEvent =
  | { type: "MOVE"; dir: "UP" | "DOWN" | "LEFT" | "RIGHT"; pressed: boolean }
  | { type: "ACTION"; id: string; pressed: boolean };

export type ClientToServerEvents = {
  "room:create": (payload: { playerId: string; name: string }) => void;
  "room:join": (payload: { roomCode: RoomCode; playerId: string; name: string }) => void;
  "room:leave": (payload: { roomCode: RoomCode; playerId: string }) => void;
  "room:set-game": (payload: { roomCode: RoomCode; gameId: string }) => void;
  "room:start": (payload: { roomCode: RoomCode }) => void;
  "player:input": (payload: { roomCode: RoomCode; playerId: string; gameId: string; event: ControlEvent }) => void;
};

export type ServerToClientEvents = {
  "room:state": (payload: { state: RoomState }) => void;
  "room:error": (payload: { message: string }) => void;
  // Para MVP host-authoritative: el host puede publicar estado del juego
  "game:state": (payload: { roomCode: RoomCode; gameId: string; tick: number; state: unknown }) => void;
};

