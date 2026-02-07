import type { ControlEvent } from "@bunker/protocol";

export const TANKS_GAME_ID = "tanks_v1" as const;

export type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type Tank = {
  playerId: string;
  x: number; // tile
  y: number; // tile
  dir: Dir;
  alive: boolean;
  lastMoveAtMs: number;
  lastShotAtMs: number;
  kills: number;
};

export type Bullet = {
  id: string;
  ownerId: string;
  x: number; // tile (float allowed but we keep int steps)
  y: number;
  dir: Dir;
  alive: boolean;
};

export type TanksState = {
  width: number; // tiles
  height: number; // tiles
  tanks: Record<string, Tank>;
  bullets: Bullet[];
  tick: number;
};

export type TanksConfig = {
  width: number;
  height: number;
  moveCooldownMs: number; // tile-based movement
  shotCooldownMs: number;
  bulletSpeedTilesPerTick: number;
  maxBulletsPerPlayer: number;
};

const DEFAULT_CONFIG: TanksConfig = {
  width: 20,
  height: 14,
  moveCooldownMs: 120,
  shotCooldownMs: 350,
  bulletSpeedTilesPerTick: 1,
  maxBulletsPerPlayer: 1
};

type InputState = {
  move: Partial<Record<Dir, boolean>>;
  shoot: boolean;
};

export class TanksGame {
  readonly config: TanksConfig;
  state: TanksState;

  private inputs: Record<string, InputState> = {};
  private idSeq = 0;

  constructor(playerIds: string[], config?: Partial<TanksConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    this.state = this.createInitialState(playerIds);
  }

  private createInitialState(playerIds: string[]): TanksState {
    const spawns: Array<[number, number, Dir]> = [
      [1, 1, "RIGHT"],
      [this.config.width - 2, 1, "LEFT"],
      [1, this.config.height - 2, "RIGHT"],
      [this.config.width - 2, this.config.height - 2, "LEFT"],
      [Math.floor(this.config.width / 2), 1, "DOWN"],
      [Math.floor(this.config.width / 2), this.config.height - 2, "UP"]
    ];

    const tanks: Record<string, Tank> = {};
    playerIds.forEach((pid, idx) => {
      const [x, y, dir] = spawns[idx % spawns.length];
      tanks[pid] = {
        playerId: pid,
        x,
        y,
        dir,
        alive: true,
        lastMoveAtMs: 0,
        lastShotAtMs: 0,
        kills: 0
      };
      this.inputs[pid] = { move: {}, shoot: false };
    });

    return {
      width: this.config.width,
      height: this.config.height,
      tanks,
      bullets: [],
      tick: 0
    };
  }

  handleInput(playerId: string, event: ControlEvent) {
    const input = this.inputs[playerId];
    if (!input) return;

    if (event.type === "MOVE") {
      input.move[event.dir] = event.pressed;
      return;
    }

    if (event.type === "ACTION") {
      if (event.id === "SHOOT") input.shoot = event.pressed;
    }
  }

  tick(nowMs: number) {
    this.state.tick++;

    // Move tanks (tile-based)
    for (const [pid, tank] of Object.entries(this.state.tanks)) {
      if (!tank.alive) continue;
      const input = this.inputs[pid];
      if (!input) continue;

      const dir = pickDir(input.move);
      if (dir && nowMs - tank.lastMoveAtMs >= this.config.moveCooldownMs) {
        tank.dir = dir;
        const [nx, ny] = step(tank.x, tank.y, dir);
        if (this.inBounds(nx, ny) && !this.isTankAt(nx, ny, pid)) {
          tank.x = nx;
          tank.y = ny;
        }
        tank.lastMoveAtMs = nowMs;
      }

      if (input.shoot && nowMs - tank.lastShotAtMs >= this.config.shotCooldownMs) {
        if (this.countBullets(pid) < this.config.maxBulletsPerPlayer) {
          const [bx, by] = step(tank.x, tank.y, tank.dir);
          if (this.inBounds(bx, by)) {
            this.state.bullets.push({
              id: `b${++this.idSeq}`,
              ownerId: pid,
              x: bx,
              y: by,
              dir: tank.dir,
              alive: true
            });
            tank.lastShotAtMs = nowMs;
          }
        }
      }
    }

    // Move bullets and resolve hits
    for (const b of this.state.bullets) {
      if (!b.alive) continue;
      for (let i = 0; i < this.config.bulletSpeedTilesPerTick; i++) {
        const [nx, ny] = step(b.x, b.y, b.dir);
        b.x = nx;
        b.y = ny;

        if (!this.inBounds(b.x, b.y)) {
          b.alive = false;
          break;
        }

        const hit = this.findTankAt(b.x, b.y);
        if (hit && hit.playerId !== b.ownerId && hit.alive) {
          hit.alive = false;
          const shooter = this.state.tanks[b.ownerId];
          if (shooter) shooter.kills++;
          b.alive = false;
          // respawn after hit (simple)
          this.respawn(hit, nowMs);
          break;
        }
      }
    }

    // cleanup bullets
    if (this.state.bullets.length > 0) {
      this.state.bullets = this.state.bullets.filter((b) => b.alive);
    }
  }

  private respawn(tank: Tank, nowMs: number) {
    // naive respawn: scan for first free tile
    for (let y = 1; y < this.config.height - 1; y++) {
      for (let x = 1; x < this.config.width - 1; x++) {
        if (!this.isTankAt(x, y)) {
          tank.x = x;
          tank.y = y;
          tank.alive = true;
          tank.lastMoveAtMs = nowMs;
          tank.lastShotAtMs = nowMs;
          return;
        }
      }
    }
    // If no space: leave dead (should never happen in MVP maps).
  }

  private inBounds(x: number, y: number) {
    return x >= 0 && x < this.config.width && y >= 0 && y < this.config.height;
  }

  private isTankAt(x: number, y: number, excludePlayerId?: string) {
    for (const t of Object.values(this.state.tanks)) {
      if (excludePlayerId && t.playerId === excludePlayerId) continue;
      if (t.alive && t.x === x && t.y === y) return true;
    }
    return false;
  }

  private findTankAt(x: number, y: number) {
    for (const t of Object.values(this.state.tanks)) {
      if (t.alive && t.x === x && t.y === y) return t;
    }
    return null;
  }

  private countBullets(ownerId: string) {
    let n = 0;
    for (const b of this.state.bullets) if (b.alive && b.ownerId === ownerId) n++;
    return n;
  }
}

function pickDir(move: Partial<Record<Dir, boolean>>): Dir | null {
  // Priority order (feels OK on mobile). Later: last-pressed wins.
  if (move.UP) return "UP";
  if (move.DOWN) return "DOWN";
  if (move.LEFT) return "LEFT";
  if (move.RIGHT) return "RIGHT";
  return null;
}

function step(x: number, y: number, dir: Dir): [number, number] {
  switch (dir) {
    case "UP":
      return [x, y - 1];
    case "DOWN":
      return [x, y + 1];
    case "LEFT":
      return [x - 1, y];
    case "RIGHT":
      return [x + 1, y];
  }
}

