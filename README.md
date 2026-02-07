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
1. Definir stack del frontend: Next.js o Vite (recomendado: Next.js para rutas `/host`, `/join`, `/play/:room`).
2. Instalar dependencias y agregar scripts de dev en root.

