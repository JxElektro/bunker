import type { ControlEvent } from "@bunker/protocol";

export const TANKS_GAME_ID = "tanks_v1" as const;

export type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type Tank = {
  playerId: string;
  x: number; // tile
  y: number; // tile
  dir: Dir;
  alive: boolean;
  respawnAtMs: number | null;
  invulnerableUntilMs: number;
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
  tiles: number[]; // 0 empty, 1 brick(destructible), 2 metal(solid)
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
  respawnDelayMs: number;
  respawnInvulnMs: number;
};

const DEFAULT_CONFIG: TanksConfig = {
  width: 20,
  height: 14,
  moveCooldownMs: 120,
  shotCooldownMs: 350,
  bulletSpeedTilesPerTick: 1,
  maxBulletsPerPlayer: 1,
  respawnDelayMs: 900,
  respawnInvulnMs: 1400
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

    const tiles = generateMap(this.config.width, this.config.height);

    const tanks: Record<string, Tank> = {};
    playerIds.forEach((pid, idx) => {
      const [x, y, dir] = spawns[idx % spawns.length];
      tanks[pid] = {
        playerId: pid,
        x,
        y,
        dir,
        alive: true,
        respawnAtMs: null,
        invulnerableUntilMs: 0,
        lastMoveAtMs: 0,
        lastShotAtMs: 0,
        kills: 0
      };
      this.inputs[pid] = { move: {}, shoot: false };
    });

    return {
      width: this.config.width,
      height: this.config.height,
      tiles,
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

    // respawns
    for (const t of Object.values(this.state.tanks)) {
      if (t.alive) continue;
      if (t.respawnAtMs === null) continue;
      if (nowMs < t.respawnAtMs) continue;
      this.doRespawn(t, nowMs);
    }

    // Move tanks (tile-based)
    for (const [pid, tank] of Object.entries(this.state.tanks)) {
      if (!tank.alive) continue;
      const input = this.inputs[pid];
      if (!input) continue;

      const dir = pickDir(input.move);
      if (dir && nowMs - tank.lastMoveAtMs >= this.config.moveCooldownMs) {
        tank.dir = dir;
        const [nx, ny] = step(tank.x, tank.y, dir);
        if (this.inBounds(nx, ny) && this.tileAt(nx, ny) === 0 && !this.isTankAt(nx, ny, pid)) {
          tank.x = nx;
          tank.y = ny;
        }
        tank.lastMoveAtMs = nowMs;
      }

      if (input.shoot && nowMs - tank.lastShotAtMs >= this.config.shotCooldownMs) {
        if (this.countBullets(pid) < this.config.maxBulletsPerPlayer) {
          const [bx, by] = step(tank.x, tank.y, tank.dir);
          if (this.inBounds(bx, by) && this.tileAt(bx, by) === 0) {
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

        const tile = this.tileAt(b.x, b.y);
        if (tile === 1) {
          // brick destroyed
          this.setTile(b.x, b.y, 0);
          b.alive = false;
          break;
        }
        if (tile === 2) {
          // metal stops bullet
          b.alive = false;
          break;
        }

        const hit = this.findTankAt(b.x, b.y);
        if (
          hit &&
          hit.playerId !== b.ownerId &&
          hit.alive &&
          nowMs >= hit.invulnerableUntilMs
        ) {
          hit.alive = false;
          hit.respawnAtMs = nowMs + this.config.respawnDelayMs;
          const shooter = this.state.tanks[b.ownerId];
          if (shooter) shooter.kills++;
          b.alive = false;
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
    // kept for backward compat (unused)
    void nowMs;
    void tank;
  }

  private doRespawn(tank: Tank, nowMs: number) {
    // scan for first free tile that isn't a wall
    for (let y = 1; y < this.config.height - 1; y++) {
      for (let x = 1; x < this.config.width - 1; x++) {
        if (this.tileAt(x, y) !== 0) continue;
        if (this.isTankAt(x, y)) continue;
        tank.x = x;
        tank.y = y;
        tank.alive = true;
        tank.respawnAtMs = null;
        tank.invulnerableUntilMs = nowMs + this.config.respawnInvulnMs;
        tank.lastMoveAtMs = nowMs;
        tank.lastShotAtMs = nowMs;
        return;
      }
    }
  }

  private inBounds(x: number, y: number) {
    return x >= 0 && x < this.config.width && y >= 0 && y < this.config.height;
  }

  private idx(x: number, y: number) {
    return y * this.config.width + x;
  }

  private tileAt(x: number, y: number) {
    return this.state.tiles[this.idx(x, y)] ?? 0;
  }

  private setTile(x: number, y: number, v: number) {
    this.state.tiles[this.idx(x, y)] = v;
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

function generateMap(w: number, h: number): number[] {
  const tiles = new Array<number>(w * h).fill(0);
  const set = (x: number, y: number, v: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    tiles[y * w + x] = v;
  };

  // Simple arena: some bricks + metal pillars, leaving spawn corners open.
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if ((x % 4 === 0) && (y % 3 === 0)) set(x, y, 2); // metal
      else if ((x + y) % 5 === 0) set(x, y, 1); // brick
    }
  }

  // clear spawn zones
  const clears: Array<[number, number]> = [
    [1, 1], [2, 1], [1, 2],
    [w - 2, 1], [w - 3, 1], [w - 2, 2],
    [1, h - 2], [2, h - 2], [1, h - 3],
    [w - 2, h - 2], [w - 3, h - 2], [w - 2, h - 3]
  ];
  for (const [x, y] of clears) set(x, y, 0);

  return tiles;
}
