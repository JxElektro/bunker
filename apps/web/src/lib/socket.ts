import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@bunker/protocol";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  socket = io("http://localhost:4040", {
    transports: ["websocket"],
    autoConnect: true
  });
  return socket;
}

