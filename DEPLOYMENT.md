# 🚀 PANDUAN DEPLOYMENT PRODUKSI — AKSES LANGSUNG IP & DOMAIN (PORT 80 & 443)

Dokumen ini merupakan panduan resmi standar DevOps untuk men-deploy aplikasi **Tuntas** ke lingkungan produksi (VPS Ubuntu 22.04/24.04, AWS EC2, DigitalOcean, dsb.) dengan arsitektur **Nginx Reverse Proxy**.

Setelah menerapkan panduan ini, aplikasi dapat diakses langsung tanpa perlu menambahkan port `:3000` pada URL browser:
- **Akses Langsung via IP VPS**: `http://IP-VPS-ANDA`
- **Akses Langsung via Domain**: `https://DOMAIN-ANDA.com` (atau `https://www.DOMAIN-ANDA.com`)

---

## 1. Arsitektur Produksi & Topologi Server

```
                          Internet (Browser Klien)
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    Port Publik: 80 & 443    │
                      └──────────────┬──────────────┘
                                     │
                      ┌──────────────▼──────────────┐
                      │   Service: tuntas-nginx     │
                      │   (Reverse Proxy & SSL)     │
                      └──────┬───────────────┬──────┘
                             │               │
            Routing Frontend │               │ Routing Backend
            location /       │               │ location /api/
                             ▼               ▼
                      ┌──────────────┐┌──────────────┐
                      │ Next.js Web  ││ Laravel API  │
                      │ Port: 3000   ││ Port: 8000   │
                      │ (Internal)   ││ (Internal)   │
                      └──────────────┘└──────────────┘
                       ▲              ▲
                       └──────┬───────┘
                              │ Bridge Network: tuntas-network
                              │ (Port 3000 & 8000 TIDAK diekspos ke publik)
                              ▼
                      ┌─────────────────────────────┐
                      │ AWS RDS / MariaDB Database  │
                      │ (TLS/SSL: global-bundle.pem)│
                      └─────────────────────────────┘
```

### Prinsip Utama Keamanan & Akses:
1. **Satu-satunya Entry Point**: Container `tuntas-nginx` adalah satu-satunya service yang membuka port publik `80` (HTTP) dan `443` (HTTPS).
2. **Port Internal Terisolasi**: Port Next.js `3000` dan port Laravel `8000` **TIDAK dipublikasikan ke host**. Port tersebut hanya dapat diakses melalui jaringan internal Docker `tuntas-network`.
3. **Dukungan Akses IP Langsung**: Jika diakses menggunakan IP VPS (`http://103.xxx.xxx.xxx`), Nginx langsung meneruskan ke frontend Next.js tanpa memaksakan redirect HTTPS (menghindari error SSL sertifikat tidak valid pada IP).
4. **Dukungan Domain & SSL Otomatis**: Jika diakses menggunakan domain yang telah dikonfigurasi SSL, request HTTP otomatis dialihkan ke HTTPS (`301 Redirect`).

---

## 2. Prasyarat Server & Konfigurasi Firewall (UFW)

### Spesifikasi Minimum:
- **OS**: Ubuntu 22.04 LTS atau 24.04 LTS (RAM 2 GB+, CPU 1-2 Core).
- **Storage**: SSD 20 GB+.

### Pengaturan Firewall Host (UFW / Security Group):
Pastikan port 3000 dan 8000 **DITUTUP** dari akses publik, dan hanya port web standar yang dibuka:

```bash
# Buka akses SSH, HTTP, dan HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Pastikan port internal tidak dapat diakses publik
sudo ufw deny 3000/tcp
sudo ufw deny 8000/tcp
sudo ufw deny 3306/tcp

# Aktifkan firewall
sudo ufw enable
sudo ufw status
```

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

## 10. Konfigurasi Domain & Otomasi SSL (Let's Encrypt / Certbot)

Aplikasi Tuntas telah dilengkapi dengan skrip otomatisasi SSL satu perintah (`scripts/setup-ssl.sh`) yang terintegrasi dengan service `tuntas-nginx` dan `tuntas-certbot` di Docker Compose.

### Langkah 1: Pastikan DNS Domain Mengarah ke IP VPS
Buat DNS A Record pada domain registrar atau Cloudflare:
- `tuntas.id` -> `IP_VPS_ANDA`
- `www.tuntas.id` -> `IP_VPS_ANDA`

### Langkah 2: Jalankan Skrip Otomasi SSL
Cukup jalankan satu perintah berikut di root project:

```bash
# Berikan izin eksekusi jika belum
chmod +x scripts/setup-ssl.sh

# Jalankan aktivasi SSL
./scripts/setup-ssl.sh tuntas.id admin@tuntas.id
```

### Apa yang Dilakukan Skrip `setup-ssl.sh` Secara Otomatis:
1. Memverifikasi container `tuntas-nginx` berjalan dan siap menerima ACME webroot challenge pada `/.well-known/acme-challenge/`.
2. Menjalankan Certbot via Docker Compose untuk menerbitkan sertifikat resmi Let's Encrypt.
3. Meng-generate file konfigurasi `docker/nginx/conf.d/ssl.conf` dari template resmi.
4. Menjalankan `nginx -t` dan me-reload Nginx tanpa downtime.
5. Menjadwalkan cron job otomatis di VPS untuk memperpanjang (*renew*) sertifikat setiap hari pukul 03:00 dini hari.

### Hasil Setelah SSL Aktif:
- `http://tuntas.id` -> Otomatis dialihkan ke `https://tuntas.id` (HTTP 301).
- `https://tuntas.id` -> Berjalan penuh dengan enkripsi TLS 1.2/1.3, HTTP/2, dan security headers.
- `http://IP_VPS_ANDA` -> **Tetap dapat diakses via HTTP langsung** tanpa error mismatch SSL.
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
