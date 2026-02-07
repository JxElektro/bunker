# Deploy Socket.IO Server en AWS (EC2/Lightsail)

Objetivo: correr `apps/server` en una instancia (MVP) con WebSockets estables.

## Antes de tocar AWS (CLI/credenciales)
Si tu `aws` CLI está logueado con la org de Akademi y no tu cuenta personal, **verifica identidad antes de crear/editar recursos**:

```bash
aws sts get-caller-identity
aws configure list
aws configure list-profiles
```

Recomendación: usa perfiles siempre:

```bash
export AWS_PROFILE=personal
aws sts get-caller-identity
```

## Opción A: Docker (recomendado)
1. En la instancia, instala Docker.
2. Abre el puerto `4040` en el Security Group (o publica detrás de Nginx con TLS).
3. Build y run:
```bash
cd bunker
docker build -f apps/server/Dockerfile -t bunker-server .
docker run -d --restart unless-stopped -p 4040:4040 -e PORT=4040 --name bunker-server bunker-server
```

Healthcheck:
- `GET http://HOST:4040/health`

## Opción B: Node + PM2 (sin Docker)
1. Instala Node 22 en la instancia.
2. Clona el repo.
3. Build:
```bash
cd bunker
npm ci
npm run build:server
node apps/server/dist/index.js
```

## Frontend (Vercel)
- Despliega `apps/web` en Vercel.
- En Vercel setea:
  - `NEXT_PUBLIC_SOCKET_URL=https://TU_DOMINIO_O_IP:4040`

## Notas de escalamiento
- Si escalas a más de 1 instancia: necesitas sticky sessions o `socket.io-redis` (ElastiCache).
