# EC2 Deploy (MVP)

Este folder contiene piezas para levantar `apps/server` en una instancia EC2 (Ubuntu) de forma rápida.

## user-data
- `deploy/ec2/user-data.sh` se usa como User Data al crear la instancia.
- Clona el repo, build y corre el contenedor en `:4040`.

## TLS (para Vercel)
Si el frontend se sirve por **HTTPS** (Vercel), el socket también debe ser **WSS/HTTPS**.

Para MVP, lo más simple es poner un reverse proxy con TLS en la instancia:
- Caddy (automático Let's Encrypt) o Nginx + certbot.

Requisito: tener un dominio (ej `api.tudominio.com`) apuntando a la IP pública.

