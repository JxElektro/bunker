# TODO (MVP)

Estado actual (2026-02-07):
- Web deployada en Vercel: `https://bunker-web-ochre.vercel.app`
- Server Socket.IO en EC2 (HTTP `:4040`) + acceso publico
- Para evitar "Mixed Content" (HTTPS -> WSS), se uso **Cloudflare Quick Tunnel** (trycloudflare) apuntando a `http://127.0.0.1:4040`

## P0 (Bugs / Bloqueadores)
- Controller deja de responder (inputs dejan de aplicarse) despues de algunos movimientos/disparos.
  - Repro:
    - Host: `/host` -> crear sala -> seleccionar `tanks_v1` -> `Start`
    - Phone: `/play/<CODE>` -> mover/disparar
    - A veces se mueve/dispara 1-2 veces y luego no.
  - Hipotesis:
    - Input pipeline en Host: se re-procesa el buffer completo de inputs en cada render (puede generar estados raros / rendimiento).
    - Render loop de `TanksHost` se reinicia con frecuencia (depende de `tick`).
    - Eventos pointer/touch en iOS: `pointerup/cancel` no siempre llega; `pointerleave` corta el hold.
    - Match phase en controller: si pierde un `room:state` y queda en `LOBBY`, no envia inputs (guard actual).
  - Acciones:
    - Cambiar a **queue** de inputs (ref) y drenar por tick en `TanksHost` (no re-aplicar historial).
    - Rehacer render loop: un solo `requestAnimationFrame` estable (no depender de `tick`).
    - Ajustar `HoldButton`: remover `onPointerLeave` o agregar fallback `touchstart/touchend`.
    - Agregar debug en controller: "last input sent at", "last room:state at", "socket id", "phase".
    - Agregar `game:input:ack` (host->server->controller o directo server->controller) para confirmar recepcion.

- Gameplay: si el tanque queda pegado a pared, disparo puede no salir (bullet spawn bloqueado por tile).
  - Ajustar: permitir disparo aunque el tile adelante sea brick/metal; la bala debe colisionar y destruir brick.

## P1 (Infra / Deploy)
- Reemplazar Cloudflare Quick Tunnel (URL cambia, no hay uptime garantizado).
  - Opcion A: Cloudflare Tunnel con cuenta (named tunnel) + subdominio estable.
  - Opcion B: dominio propio + TLS en EC2 (Caddy/Nginx) y `NEXT_PUBLIC_SOCKET_URL=https://api...`
- Cerrar puertos innecesarios en Security Group:
  - si se usa tunnel: cerrar `4040` publico y `80/443` si no se usan
  - mantener `22` cerrado (usar SSM)
- Dejar SSM como camino oficial (tu red puede bloquear SSH/22).

## P1 (Producto / UX)
- Lobby host:
  - indicador mas claro de estado (esperando / en juego / terminado)
  - boton "Start" solo si min players
  - boton "Start new round" al terminar
- Scoreboard:
  - mostrar **nombres** en vez de `playerId`
  - pantalla final (top kills) + CTA "Reiniciar"
- Controller:
  - vibracion/haptic al disparar (opcional)
  - feedback de cooldown de disparo

## P2 (Tanques)
- Mapas:
  - mapa fijo (curado) en vez de random (evitar spawns/trampas)
  - power-ups (despues)
- Reglas:
  - limitar respawn loops, invulnerabilidad visible
  - friendly fire off/on (definir)

## P2 (Observabilidad / Calidad)
- Logs en server:
  - contar inputs por jugador por minuto
  - loguear disconnects/reconnects y reasociacion playerId->socketId
- Small smoke test manual:
  - 2 phones + 1 host, 90s match, reconectar wifi y confirmar recovery

