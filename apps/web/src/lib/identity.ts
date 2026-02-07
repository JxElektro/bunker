export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "server";
  const key = "bunker_player_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("bunker_player_name") ?? "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("bunker_player_name", name);
}

