# keenon-xai-proxy (Railway / Render)

Прозрачный прокси к `https://api.x.ai` для серверов с российским IP.

## Railway (бесплатно)

1. Зарегистрируйтесь: https://railway.com (Free Trial $5 / Free $1 в месяц)
2. В папке проекта:
   ```bash
   cd xai-proxy-railway
   npx @railway/cli login
   npx @railway/cli init
   npx @railway/cli up
   npx @railway/cli domain
   ```
3. На VPS в `/var/www/keenon/.env`:
   ```
   XAI_BASE_URL=https://YOUR-APP.up.railway.app/v1
   ```
4. `systemctl restart keenon`

Опционально: `PROXY_TOKEN=секрет` + заголовок `x-proxy-token` (тогда доработаем `assistant.ts`).

## Render (альтернатива)

New → Web Service → этот репозиторий/папка, Start: `node server.mjs`, Instance: Free.
