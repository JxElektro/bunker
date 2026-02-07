# Bunker

Plataforma web estilo Jackbox:
- **Host (PC/TV):** renderiza el juego (pantalla principal).
- **Controllers (móviles):** UI de control (inputs).
- **Server (realtime):** rooms/presence/routing de eventos. En MVP, la simulación puede correr en el host.

## Estructura
- `apps/server`: Socket.IO (rooms + presencia + routing).
- `apps/web`: app web (host + controller) (pendiente de scaffold).
- `packages/protocol`: tipos/contratos de eventos (shared).
- `packages/core`: utilidades compartidas (reconexión, state machine) (pendiente).
- `packages/controls`: componentes de controles reutilizables (pendiente).
- `packages/games-tanks`: primer juego (tanques) como plugin (pendiente).

## Próximo paso (para que esto quede runnable)
1. Instalar dependencias:
   - `npm install`
2. Correr server realtime:
   - `npm run dev:server` (porta `4040`)
3. Correr web:
   - `npm run dev:web` (porta `3000`)

Rutas:
- Host: `http://localhost:3000/host`
- Join: `http://localhost:3000/join`
