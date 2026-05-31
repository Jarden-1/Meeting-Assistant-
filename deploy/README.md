# Production Deployment

Target server checked: Ubuntu 24.04, Docker, Docker Compose, Nginx, and Certbot are installed.

## DNS

Create an `A` record for your domain or subdomain pointing to:

```text
14.103.219.42
```

Example:

```text
meeting.example.com -> 14.103.219.42
```

## Server Deploy

On the server:

```bash
mkdir -p /opt/meeting-assistant
cd /opt/meeting-assistant
```

Copy this repository into `/opt/meeting-assistant`, then create production env:

```bash
cp deploy/production.env.example deploy/production.env
openssl rand -base64 32
```

Edit `deploy/production.env` and replace at least:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `USER_LLM_ENCRYPTION_KEY`
- `LLM_API_KEY` if you want system-level AI enabled
- Tencent ASR values if you use Tencent realtime ASR

Build and start the app:

```bash
docker compose --env-file deploy/production.env -f docker-compose.prod.yml run --rm migrate
docker compose --env-file deploy/production.env -f docker-compose.prod.yml up -d --build db api web
```

Start local FunASR too, if you want the browser realtime transcription socket:

```bash
docker compose --env-file deploy/production.env -f docker-compose.prod.yml --profile funasr up -d --build
```

## Nginx

Replace `__DOMAIN__` with your real domain:

```bash
DOMAIN=meeting.example.com
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx/meeting-assistant.conf.template > /etc/nginx/conf.d/meeting-assistant.conf
nginx -t
systemctl reload nginx
```

Enable HTTPS:

```bash
certbot --nginx -d "$DOMAIN"
```

Then check:

```bash
curl -I "https://$DOMAIN/"
curl "https://$DOMAIN/api/v1/health"
```

## Runtime URLs

- Web: `https://your-domain/`
- API: `https://your-domain/api/v1`
- Health: `https://your-domain/api/v1/health`
- Optional FunASR WebSocket: `wss://your-domain/funasr`
