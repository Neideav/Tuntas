# 09. Deployment & DevOps Operations Manual

## 1. Production Requirements & Architecture

Tuntas can be deployed across multiple production topologies depending on traffic scale:
- **Topology A (Containerized Monolith)**: Single VM running `docker-compose` with Nginx reverse proxy, SQLite WAL or local PostgreSQL. Recommended for up to 5,000 active users.
- **Topology B (Decoupled Cloud Native)**: Vercel/Cloudflare Pages for `@tuntas/web` (Next.js frontend) and AWS ECS / Google Cloud Run / DigitalOcean App Platform for `@tuntas/api` connected to Managed PostgreSQL (RDS/Cloud SQL).

### Minimum Hardware Sizing
- **CPU**: 2 vCPU cores.
- **RAM**: 2 GB RAM (4 GB recommended for building Next.js).
- **Storage**: 20 GB SSD.
- **OS**: Ubuntu 22.04 LTS / Debian 12 / Alpine Linux.

---

## 2. Docker Compose Deployment (Recommended Quickstart)

The repository includes a ready-to-use [`docker-compose.yml`](file:///d:/REPO/Tuntas/docker-compose.yml) orchestrating the Next.js frontend and Laravel API:

```bash
# 1. Clone repository
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas

# 2. Configure production environments
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.production

# 3. Generate APP_KEY
cd apps/api && php artisan key:generate && cd ../..

# 4. Build and start containers in detached mode
docker compose up -d --build

# 5. Check container statuses
docker compose ps
```

The services will become available at:
- **Web Interface**: `http://your-server-ip:3000`
- **RESTful API**: `http://your-server-ip:8000/api/v1`

---

## 3. Environment Variables Reference

### Backend (`apps/api/.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `APP_NAME` | Application title | `Tuntas` |
| `APP_ENV` | Environment mode | `production` |
| `APP_KEY` | 32-character encryption key | `base64:...` |
| `APP_DEBUG` | Detailed debug error reporting | `false` |
| `APP_URL` | Public API URL | `https://api.tuntas.app` |
| `FRONTEND_URL` | Allowed origin for CORS & Sanctum | `https://tuntas.app` |
| `SANCTUM_STATEFUL_DOMAINS` | Stateful domain whitelist | `tuntas.app,www.tuntas.app` |
| `DB_CONNECTION` | Database driver | `sqlite` or `pgsql` |
| `DB_DATABASE` | SQLite file path or Postgres DB name | `/var/www/html/database/database.sqlite` |

### Frontend (`apps/web/.env.production`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base API endpoint accessible by browser | `https://api.tuntas.app/api/v1` |
| `NODE_ENV` | Node execution environment | `production` |

---

## 4. Bare-Metal & VPS Deployment (Ubuntu + Nginx + PHP-FPM)

### A. Nginx Configuration for Backend (`/etc/nginx/sites-available/tuntas-api`)
```nginx
server {
    listen 80;
    server_name api.tuntas.app;
    root /var/www/Tuntas/apps/api/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### B. Systemd Service for Next.js (`/etc/systemd/system/tuntas-web.service`)
```ini
[Unit]
Description=Tuntas Next.js Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/Tuntas/apps/web
ExecStart=/usr/bin/pnpm start -p 3000
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

---

## 5. Database Migration & Rollback Procedure

Always execute migrations with the `--force` flag in production:
```bash
cd apps/api

# Run pending migrations
php artisan migrate --force

# Inspect status
php artisan migrate:status

# Emergency rollback (rolls back previous batch)
php artisan migrate:rollback --force
```

---

## 6. Backup, Restore & Disaster Recovery

### A. SQLite Backup (Zero Downtime via Online Backup API)
```bash
# Snapshot live database safely
sqlite3 /var/www/Tuntas/apps/api/database/database.sqlite \
  ".backup '/var/backups/tuntas/tuntas-$(date +%Y%m%d_%H%M%S).sqlite'"

# Compress and upload to offsite S3
gzip -9 /var/backups/tuntas/*.sqlite
```

### B. PostgreSQL Backup (pg_dump)
```bash
pg_dump -Fc -U postgres -d tuntas > /var/backups/tuntas/pg_$(date +%Y%m%d).dump
```

### C. Restoration Test Protocol
Test backup restoration monthly in a staging environment to verify cryptographic and schema consistency:
```bash
# Verify integrity of SQLite backup
sqlite3 /var/backups/tuntas/backup.sqlite "PRAGMA integrity_check;"
```

