# 🚀 PANDUAN DEPLOYMENT PRODUKSI & DOKUMENTASI DOCKER TUNTAS

Dokumen ini merupakan panduan resmi standar DevOps untuk men-deploy aplikasi **Tuntas** ke lingkungan produksi (AWS EC2, AWS ECS, atau server mandiri Ubuntu Linux) dengan database **AWS RDS MariaDB / MySQL**.

---

## 1. Arsitektur Produksi & Topologi Server

Aplikasi Tuntas dibangun dengan arsitektur **Monorepo Cohesive**:
- **Frontend**: Next.js 15 (React 19, TypeScript) berjalan di port `3000`.
- **Backend API**: Headless Laravel 12 (PHP 8.3 CLI / Octane / Server) berjalan di port `8000`.
- **Reverse Proxy**: Next.js me-rewrite rute `/api/:path*` langsung ke `http://127.0.0.1:8000/api/:path*`, sehingga browser klien hanya perlu berkomunikasi ke port 80/443 tanpa kendala CORS beda origin.
- **Database**: AWS RDS MariaDB 10.11 / 11.4 dengan enkripsi transport TLS/SSL (`global-bundle.pem`).
- **Container**: Satu unit container Docker monorepo terisolasi (`tuntas`) mengekspos port 80 dan 3000.

---

## 2. Prasyarat Server AWS EC2

- **OS**: Ubuntu 22.04 LTS atau 24.04 LTS (Instance Type: `t3.small` / `t3.medium`).
- **Storage**: EBS 20 GB+ (gp3).
- **Security Group Inbound**:
  - Port `22` (SSH) — batasi ke IP administrator.
  - Port `80` (HTTP) — buka untuk public (0.0.0.0/0).
  - Port `443` (HTTPS) — buka untuk public (0.0.0.0/0).
  - Port `3000` (Next.js opsional jika diakses langsung).
- **Security Group Outbound**:
  - Port `3306` — arahkan ke Security Group AWS RDS MariaDB.

---

## 3. Langkah Instalasi Docker & Persiapan Host

Jalankan perintah berikut pada instance Ubuntu AWS EC2:

```bash
# 1. Update package repository & install alat bantu
sudo apt update && sudo apt install -y ca-certificates curl git mariadb-client

# 2. Setup GPG key dan repository Docker resmi
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# 3. Install Docker Engine dan Docker Compose Plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER

# Relogin session agar grup docker aktif
exit
```

---

## 4. Setup Database AWS RDS MariaDB

Pastikan database `tuntas` telah dibuat di instance AWS RDS Anda:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS tuntas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## 5. Clone Repository & Konfigurasi Environment

```bash
sudo mkdir -p /var/www
sudo git clone https://github.com/Neideav/Tuntas.git /var/www/tuntas
sudo chown -R $USER:$USER /var/www/tuntas
cd /var/www/tuntas

# Salin template environment produksi
cp .env.example .env
nano .env
```

### Variabel Wajib yang Harus Disesuaikan pada `.env`:

| Variabel | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `APP_NAME` | `"Tuntas"` | Nama resmi platform |
| `APP_ENV` | `production` | Mengaktifkan optimasi cache |
| `APP_DEBUG` | `false` | Mencegah kebocoran stack trace error |
| `APP_KEY` | *(hasil `php artisan key:generate`)* | Kunci enkripsi sesi & data sensitif |
| `APP_URL` | `http://IP_PUBLIC_EC2` | URL root API / domain server |
| `FRONTEND_URL` | `http://IP_PUBLIC_EC2:3000` | URL frontend Next.js |
| `DB_CONNECTION` | `mariadb` | Driver database resmi MariaDB |
| `DB_HOST` | `your-rds-endpoint.rds.amazonaws.com` | Endpoint host AWS RDS |
| `DB_PORT` | `3306` | Port standar MariaDB |
| `DB_DATABASE` | `tuntas` | Nama skema database |
| `DB_USERNAME` | `admin` | User master database |
| `DB_PASSWORD` | `YOUR_SECURE_PASSWORD` | Password database |
| `MYSQL_ATTR_SSL_CA` | `/etc/ssl/certs/global-bundle.pem` | Path bundle CA AWS RDS di container |
| `DB_SSL_VERIFY_CERT` | `true` | Validasi sertifikat TLS/SSL |
| `SESSION_DRIVER` | `database` | Sesi tersimpan aman di database |
| `SESSION_SECURE_COOKIE` | `true` | Cookie hanya dikirim via HTTPS |
| `TRUSTED_PROXIES` | `"*"` | Proxy AWS ALB / CloudFront |
| `CORS_ALLOWED_ORIGINS` | `http://IP_PUBLIC:3000,http://localhost:3000` | Asal domain yang diizinkan |

---

## 6. Build & Jalankan Docker Container

```bash
# 1. Build image Docker
docker compose build

# 2. Jalankan container di background
docker compose up -d

# 3. Periksa status container
docker compose ps

# 4. Pantau log inisialisasi & migrasi otomatis
docker compose logs -f app
```

---

## 7. Inisialisasi Database & Cache Optimization

Container `tuntas` secara otomatis menjalankan migrasi saat startup (`docker-entrypoint.sh`). Namun, Anda dapat menjalankan perintah Artisan secara manual:

```bash
# Generate APP_KEY jika belum terisi
docker compose exec app php artisan key:generate --force

# Jalankan database seeder awal (opsional)
docker compose exec app php artisan db:seed --force

# Validasi status optimasi cache
docker compose exec app php artisan config:cache
docker compose exec app php artisan route:cache
docker compose exec app php artisan view:cache
```

---

## 8. Strategi Background Queue Worker & Cron Reminders

Container Tuntas telah dilengkapi dengan *auto-spawn background worker*:
- **Queue Worker**: Memproses tugas antrean (pengiriman email, kalkulasi analitik, pemrosesan ujian) dengan opsi `--sleep=3 --tries=3 --max-time=3600`.
- **Scheduled Reminders**: Untuk menjalankan penjadwalan cron reminder Tuntas di host Linux, tambahkan entri crontab di Ubuntu host:

```bash
crontab -e
```
Tambahkan baris berikut:
```cron
* * * * * docker compose -f /var/www/tuntas/docker-compose.yml exec -T app php artisan schedule:run >> /dev/null 2>&1
```

---

## 9. Pengujian & Verifikasi Endpoint Produksi

Uji kesehatan aplikasi dari terminal host:

```bash
# Uji API Health check (melalui Next.js reverse proxy di port 80)
curl -i http://localhost/api/v1/health
```

Respon sukses saat database terhubung (HTTP 200 OK):
```json
{
  "status": "ok",
  "health": "healthy",
  "system": "Tuntas API",
  "version": "2.0.0",
  "environment": "production",
  "timestamp": "2026-11-24T12:00:00Z",
  "services": {
    "database": "connected"
  }
}
```

Jika database terputus atau mengalami gangguan (HTTP 503 Service Unavailable):
```json
{
  "status": "degraded",
  "health": "degraded",
  "system": "Tuntas API",
  "version": "2.0.0",
  "environment": "production",
  "timestamp": "2026-11-24T12:00:00Z",
  "services": {
    "database": "disconnected"
  }
}
```

---

## 10. Konfigurasi HTTPS & SSL Termination

Untuk produksi publik, sangat direkomendasikan mengaktifkan enkripsi HTTPS menggunakan **Nginx Host Reverse Proxy + Certbot (Let's Encrypt)** atau **AWS Application Load Balancer (ALB)**.

### Opsi A: Nginx Reverse Proxy di Host EC2 + Let's Encrypt (Certbot)

Jika instance EC2 langsung menerima traffic publik:

1. Install Nginx dan Certbot di host Ubuntu:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

2. Konfigurasikan virtual host Nginx (`/etc/nginx/sites-available/tuntas`):
```nginx
server {
    server_name app.tuntas.id; # Ganti dengan domain Anda

    location / {
        proxy_pass http://127.0.0.1:80; # Meneruskan ke container Docker Tuntas
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

3. Aktifkan konfigurasi dan generate sertifikat SSL otomatis:
```bash
sudo ln -s /etc/nginx/sites-available/tuntas /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.tuntas.id
```

### Opsi B: AWS Application Load Balancer (ALB) + ACM (Amazon Certificate Manager)

Jika menggunakan topologi enterprise AWS:
1. Buat **Target Group**: Target type `Instance` atau `IP`, Protocol `HTTP`, Port `80`.
2. Set Health Check path ke `/api/v1/health` dengan matcher `200`.
3. Buat **ALB Listener**:
   - Port `80` (HTTP) -> Redirect ke `443` (HTTPS).
   - Port `443` (HTTPS) -> Forward ke Target Group Tuntas dengan sertifikat ACM.
4. Pastikan di `.env` file Tuntas:
   ```env
   TRUSTED_PROXIES=*
   SESSION_SECURE_COOKIE=true
   ```

---

## 11. Monitoring, Health Check & Logging

### Health Check Docker
Container `tuntas` memiliki internal healthcheck terkonfigurasi di `docker-compose.yml`:
```bash
docker inspect --format='{{json .State.Health}}' tuntas | jq
```
Status akan bernilai `"Status": "healthy"` jika endpoint `/api/v1/health` mengembalikan status 200.

### Logging Terkelola
Docker Compose membatasi ukuran log agar disk EBS EC2 tidak penuh:
- Driver: `json-file`
- Max size: `10m`
- Max file: `3` (rotasi maksimal 30 MB)

Melihat log live:
```bash
# Log seluruh aplikasi (Next.js & Laravel)
docker compose logs -f app

# Log Laravel internal
docker compose exec app tail -n 100 /var/www/html/storage/logs/laravel.log
```

---

## 12. Panduan Troubleshooting Masalah Produksi

### 1. Database Connection Timeout / Refused
- **Gejala**: `Failed to connect to database at ... after 30 attempts. Aborting startup.`
- **Penyebab**: Security group RDS tidak mengizinkan inbound dari IP privat EC2, atau credential salah.
- **Solusi**:
  1. Periksa Security Group AWS RDS: pastikan inbound port 3306 mengizinkan Security Group ID dari instance EC2 (`sg-xxxxxx`).
  2. Tes koneksi dari host EC2: `nc -zv YOUR_RDS_ENDPOINT 3306`.
  3. Periksa file `.env`: pastikan `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD` sesuai.

### 2. AWS RDS SSL Certificate Verification Failure
- **Gejala**: `SQLSTATE[HY000] [2002] ... SSL certificate validation failed`.
- **Penyebab**: File bundle sertifikat CA tidak ditemukan atau corrupt.
- **Solusi**:
  1. File `global-bundle.pem` telah di-download otomatis saat build Docker ke `/etc/ssl/certs/global-bundle.pem`.
  2. Pastikan di `.env`:
     ```env
     MYSQL_ATTR_SSL_CA=/etc/ssl/certs/global-bundle.pem
     DB_SSL_VERIFY_CERT=true
     ```

### 3. Migrasi Terkunci (`Isolated migration lock busy`)
- **Gejala**: Migrasi tidak berjalan atau log menampilkan peringatan lock.
- **Penyebab**: Container sebelumnya mati mendadak saat menjalankan migrasi dan atomic cache lock belum kedaluwarsa.
- **Solusi**:
  1. Hapus cache lock migrasi:
     ```bash
     docker compose exec app php artisan cache:forget "illuminate:migrations"
     ```
  2. Jalankan migrasi manual:
     ```bash
     docker compose exec app php artisan migrate --force
     ```

### 4. Permission Denied pada Storage / Cache
- **Gejala**: `The stream or file ".../storage/logs/laravel.log" could not be opened: Failed to open stream: Permission denied`.
- **Solusi**:
  Jalankan perbaikan permission pada volume storage:
  ```bash
  docker compose exec -u root app chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache
  ```

---

## 13. Prosedur Rollback Aman (Safe Rollback Procedure)

Jika rilis versi baru mengalami bug kritis di produksi, lakukan rollback dengan prosedur berikut:

### Langkah 1: Identifikasi Versi Stabil Sebelumnya
Periksa commit hash stabil terakhir di repository:
```bash
git log --oneline -n 5
```

### Langkah 2: Revert Kode ke Commit Stabil
```bash
# Checkout ke commit stabil sebelumnya
git checkout <COMMIT_HASH_SEBELUMNYA>
```

### Langkah 3: Rollback Database (Jika Ada Perubahan Skema)
Jika commit yang dibatalkan memiliki migrasi baru yang perlu dibatalkan:
```bash
docker compose exec app php artisan migrate:rollback --step=1 --force
```

### Langkah 4: Rebuild & Restart Container
```bash
# Rebuild image Docker dengan kode versi stabil
docker compose build --no-cache

# Restart container
docker compose down
docker compose up -d

# Verifikasi status dan health check
docker compose ps
curl -i http://localhost/api/v1/health
```
Aplikasi akan kembali berjalan pada versi stabil sebelumnya dalam hitungan detik tanpa meninggalkan data corrupt.
