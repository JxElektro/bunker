import { TANKS_GAME_ID } from "@bunker/games-tanks";

export const GameRegistry = {
  [TANKS_GAME_ID]: {
    name: "Tanks",
    controllerSchema: "dpad+shoot" as const
  }
} as const;

export type GameId = keyof typeof GameRegistry;

