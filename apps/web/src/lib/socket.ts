import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@bunker/protocol";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4040";
  socket = io(url, {
    transports: ["websocket"],
    autoConnect: true
  });
  return socket;
}
