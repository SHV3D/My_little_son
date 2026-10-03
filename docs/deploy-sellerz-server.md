# Deploy son.shved.su on the sellerz server (Docker, same stack as app.sellerz.ru)

Goal: move `son.shved.su` off Beget onto the sellerz Docker host, served the same
way as the working `app.sellerz.ru` — the `frontend` nginx container terminates
TLS and reverse-proxies the domain to a dedicated **my-little-son** container that
runs our Express server (static client + `/api` + `/ws`). nginx→Node (not
Passenger) fixes the iOS standalone white-screen; `/ws` works; the client is
unchanged (it calls the relative `/api`, same origin).

Paths below assume the sellerz repo at `~/Saas/app` and this repo checked out on
the server (e.g. `~/My_little_son`).

---

## 1. DNS
Point `son.shved.su` A-record to the sellerz server IP (the one serving
app.sellerz.ru). Remove the old Beget IP. Wait for propagation.

## 2. TLS cert (certbot, same as other domains)
The `frontend` container mounts `/etc/letsencrypt` and `/var/www/certbot`. Issue:
```bash
certbot certonly --webroot -w /var/www/certbot -d son.shved.su
# creates /etc/letsencrypt/live/son.shved.su/{fullchain,privkey}.pem
```
(If certbot runs in a container/host wrapper on this server, use the same method
used for app.sellerz.ru / monitor.sellerz.ru.)

## 3. Add the container to the compose stack
Add this service to `~/Saas/app/app/infra/docker-compose.yml` (under `services:`)
and the volume under `volumes:`. `context` points at this repo on the server.

```yaml
  my-little-son:
    build:
      context: /home/<user>/My_little_son      # path to this repo on the server
      dockerfile: Dockerfile
    container_name: my_little_son
    mem_limit: 256m
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_PATH: /data/my_little_son.db
      JWT_SECRET: ${MLS_JWT_SECRET}
      PUSH_CRON_KEY: ${MLS_PUSH_CRON_KEY}
    volumes:
      - mls_data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001/api/health"]
      interval: 15s
      timeout: 5s
      retries: 5
```
```yaml
volumes:
  # ... existing volumes ...
  mls_data:
```
Set the two secrets in the infra `.env` (same file the other `${...}` come from):
```
MLS_JWT_SECRET=<long random string>
MLS_PUSH_CRON_KEY=<long random string>
```
It joins the default compose network, so the frontend nginx reaches it by the
name `my-little-son`.

## 4. nginx server block for son.shved.su
Add to `~/Saas/app/app/frontend/nginx.conf` (same file that has app.sellerz.ru):

```nginx
server {
    listen 80;
    server_name son.shved.su;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name son.shved.su;

    ssl_certificate /etc/letsencrypt/live/son.shved.su/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/son.shved.su/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20m;

    # WebSocket (family presence/sync) — needs the upgrade headers.
    location /ws {
        proxy_pass http://my-little-son:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Everything else (static client + /api) → our Node container.
    location / {
        proxy_pass http://my-little-son:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # our app trusts this for HTTPS/HSTS
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;
}
```

The frontend container only has the HTML build baked in for app.sellerz.ru; here
we proxy the whole domain to the Node container, so nothing extra is baked in.
(Optional later optimization: serve the client statically from nginx and proxy
only `/api` + `/ws`, exactly like app.sellerz.ru. Not required to fix iOS.)

## 5. Bring it up
```bash
cd ~/Saas/app/app/infra
docker compose build my-little-son
docker compose up -d my-little-son
docker compose restart frontend        # reload nginx with the new server block
# verify
curl -s https://son.shved.su/api/health      # {"status":"ok"}
curl -sS -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-Proto: http" http://son.shved.su/   # 301
```

## 6. Cron for push dispatch (host crontab on the sellerz server)
```
* * * * * curl -s -m 50 https://son.shved.su/api/push/dispatch -H "X-Cron-Key: $MLS_PUSH_CRON_KEY" >/dev/null 2>&1
```
(Use the value you set in the infra `.env`. The app also reads `PUSH_CRON_KEY`
from env, so this matches without touching the DB.)

## 7. Decommission Beget
- Stop the GitHub Actions Beget deploy (disable/delete `.github/workflows/deploy.yml`
  or repoint it) so pushes no longer deploy to Beget.
- Remove the Beget `.htaccess` Passenger app / site once son.shved.su resolves to
  the new server and is confirmed working.

## Notes
- Client needs NO changes: it uses relative `/api` and `wss://<host>/ws`, both
  same-origin, proxied by this nginx.
- `X-Forwarded-Proto` is set by nginx, so the app's HTTPS-redirect/HSTS logic
  behaves correctly (no redirect loop like on Beget Passenger).
- SQLite persists in the `mls_data` volume across redeploys.
- Once the PWA is confirmed working on the new host, the service worker can be
  re-enabled (push) — the Passenger-specific breakage is gone here.
