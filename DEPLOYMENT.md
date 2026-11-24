# 🚀 PANDUAN LENGKAP DEPLOYMENT PRODUKSI TUNTAS — AWS EC2 & AWS RDS MARIADB

Dokumen ini merupakan panduan resmi standar DevOps untuk men-deploy aplikasi **Tuntas** ke lingkungan produksi (AWS EC2 Ubuntu 22.04/24.04 LTS & AWS RDS MariaDB) menggunakan **Docker Compose**, **Nginx Reverse Proxy**, dan **Let's Encrypt SSL**.

Setelah deployment berhasil, aplikasi dapat diakses langsung tanpa menyertakan port `:3000` atau `:8000`:
- **Akses Langsung via IP Publik EC2**: `http://IP_EC2`
- **Akses Langsung via Domain / Subdomain**: `https://tuntas.id` atau `https://app.tuntas.id`

---

## Ringkasan Arsitektur Container & Jaringan

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

- **Satu Gateway Publik**: Hanya service `tuntas-nginx` yang mempublikasikan port `80` (HTTP) dan `443` (HTTPS).
- **Port Terisolasi**: Port Next.js `3000` dan Laravel `8000` hanya terbuka di jaringan bridge internal Docker (`tuntas-network`).
- **Akses Langsung via IP**: Request ke IP publik EC2 langsung dilayani via HTTP tanpa redirect keliru ke HTTPS.
- **SSL / HTTPS Otomatis**: Request ke domain dengan SSL aktif otomatis dialihkan dari HTTP (80) ke HTTPS (443) dengan HTTP/2 dan TLS 1.2/1.3.

---

## A. Persiapan AWS EC2

1. **Luncurkan Instance EC2**:
   - **AMI**: Ubuntu Server 24.04 LTS atau 22.04 LTS (64-bit x86_64).
   - **Instance Type**: Minimum `t3.small` (2 vCPU, 2 GB RAM) atau direkomendasikan `t3.medium` (2 vCPU, 4 GB RAM) untuk kompilasi Next.js yang cepat.
   - **Storage (EBS)**: 25–40 GB General Purpose SSD (gp3).
   - **Key Pair**: Pilih atau buat key pair SSH baru (`.pem`).

2. **Hubungkan ke Server EC2 via SSH**:
   ```bash
   ssh -i /path/ke/keypair.pem ubuntu@EC2_PUBLIC_IP
   ```

3. **Update Paket Sistem & Atur Zona Waktu**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo timedatectl set-timezone Asia/Jakarta
   ```

---

## B. Konfigurasi Security Group

Konfigurasikan AWS Security Group pada AWS Management Console untuk EC2 dan RDS.

### 1. Inbound Rules pada Security Group EC2 (`sg-ec2-tuntas`):
| Type | Protocol | Port Range | Source | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | `IP_ADMIN_ANDA/32` | Akses terminal aman |
| **HTTP** | TCP | 80 | `0.0.0.0/0` | Akses web publik & ACME challenge Certbot |
| **HTTPS** | TCP | 443 | `0.0.0.0/0` | Akses web aman terenkripsi TLS |

> **PERINGATAN KEAMANAN**: Pastikan port `3000`, `8000`, dan `3306` **TIDAK** dibuka pada Inbound Rules EC2!

### 2. Inbound Rules pada Security Group RDS (`sg-rds-tuntas`):
| Type | Protocol | Port Range | Source | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **MySQL/Aurora** | TCP | 3306 | `sg-ec2-tuntas` (Security Group EC2) | Akses database hanya dari EC2 |

### 3. Konfigurasi Firewall Lokal (UFW) di EC2:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

---

## C. Install Docker & Docker Compose

Jalankan perintah berikut pada host EC2 untuk menginstal Docker Engine resmi:

```bash
# 1. Pasang dependensi sertifikat dan kunci apt
sudo apt update && sudo apt install -y ca-certificates curl gnupg

# 2. Tambahkan GPG key resmi Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 3. Daftarkan repository resmi Docker
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# 4. Install Docker Engine, Buildx, dan Docker Compose Plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Berikan izin non-root kepada user ubuntu
sudo usermod -aG docker ubuntu

# 6. Terapkan grup baru atau logout-login kembali
newgrp docker
docker --version
docker compose version
```

---

## D. Install MariaDB Client

Pasang `mariadb-client` di host EC2 untuk melakukan pengujian konektivitas, verifikasi SSL, dan inisialisasi skema database ke AWS RDS:

```bash
sudo apt update && sudo apt install -y mariadb-client
mariadb --version
```

---

## E. Membuat Database AWS RDS

1. **Uji Konektivitas Jaringan ke AWS RDS**:
   ```bash
   nc -zv YOUR_RDS_ENDPOINT.rds.amazonaws.com 3306
   ```

2. **Buat Skema Database `tuntas`**:
   Hubungi instance RDS dari host EC2:
   ```bash
   mariadb -h YOUR_RDS_ENDPOINT.rds.amazonaws.com -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS tuntas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

3. **Verifikasi Database**:
   ```bash
   mariadb -h YOUR_RDS_ENDPOINT.rds.amazonaws.com -P 3306 -u admin -p -e "SHOW DATABASES LIKE 'tuntas';"
   ```

---

## F. Clone Repository

Siapkan direktori aplikasi `/var/www/tuntas` dan unduh kode program:

```bash
# 1. Buat direktori kerja
sudo mkdir -p /var/www/tuntas
sudo chown -R $USER:$USER /var/www/tuntas

# 2. Clone repository Tuntas
git clone https://github.com/Neideav/Tuntas.git /var/www/tuntas
cd /var/www/tuntas

# 3. Berikan permission eksekusi pada skrip otomasi
chmod +x deploy.sh auto-deploy.sh docker-entrypoint.sh scripts/setup-ssl.sh
```

---

## G. Membuat dan Mengisi `.env`

Salin template `.env.example` ke `.env` produksi:

```bash
cp .env.example .env
nano .env
```

### Konfigurasi Wajib Produksi:
```env
APP_NAME="Tuntas"
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=Asia/Jakarta

# =============================================================================
# URL & SESSION MODE
# =============================================================================
# --- MODE 1: Akses Langsung via IP Publik EC2 (HTTP) ---
APP_URL=http://EC2_PUBLIC_IP
FRONTEND_URL=http://EC2_PUBLIC_IP
CORS_ALLOWED_ORIGINS=http://EC2_PUBLIC_IP
SANCTUM_STATEFUL_DOMAINS=EC2_PUBLIC_IP,localhost,127.0.0.1
SESSION_SECURE_COOKIE=false  # Wajib false agar cookie session tidak ditolak browser di HTTP

# --- MODE 2: Akses via Domain Resmi dengan SSL (HTTPS) ---
# Aktifkan setelah menjalankan ./scripts/setup-ssl.sh tuntas.id admin@tuntas.id:
# APP_URL=https://tuntas.id
# FRONTEND_URL=https://tuntas.id
# CORS_ALLOWED_ORIGINS=https://tuntas.id,https://www.tuntas.id
# SANCTUM_STATEFUL_DOMAINS=tuntas.id,www.tuntas.id,localhost,127.0.0.1
# SESSION_SECURE_COOKIE=true   # Wajib true untuk proteksi Secure Cookie di HTTPS

# Next.js Build Variables
NEXT_PUBLIC_APP_NAME="Tuntas"
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_URL=/api/v1
INTERNAL_API_URL=http://127.0.0.1:8000/api/v1

# Koneksi Database AWS RDS MariaDB
DB_CONNECTION=mariadb
DB_HOST=YOUR_RDS_ENDPOINT.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=tuntas
DB_USERNAME=admin
DB_PASSWORD=YOUR_STRONG_PASSWORD

# AWS RDS SSL Configuration
MYSQL_ATTR_SSL_CA=/etc/ssl/certs/global-bundle.pem
DB_SSL_VERIFY_CERT=true

# Cache, Session, & Queue Drivers
CACHE_STORE=database
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
QUEUE_CONNECTION=database

# Reverse Proxy Trust
TRUSTED_PROXIES=*
```

---

## H. Menghasilkan `APP_KEY` Secara Permanen

Kunci enkripsi `APP_KEY` **harus dibuat satu kali pada file `.env` di host** sebelum container berjalan. Ini memastikan user session dan token enkripsi tidak hangus saat container restart:

```bash
# Jalankan helper php sekali pakai melalui Docker untuk mengisi APP_KEY di .env host
docker run --rm -v $(pwd):/app -w /app composer:2 php -r '
  $key = "base64:" . base64_encode(random_bytes(32));
  $envFile = ".env";
  $content = file_get_contents($envFile);
  if (preg_match("/^APP_KEY=.*$/m", $content)) {
    $content = preg_replace("/^APP_KEY=.*$/m", "APP_KEY=" . $key, $content);
  } else {
    $content .= "\nAPP_KEY=" . $key;
  }
  file_put_contents($envFile, $content);
  echo "Persistent APP_KEY generated: " . $key . PHP_EOL;
'
```

Atau gunakan skrip otomatis `deploy.sh` yang secara otomatis mendeteksi dan meng-generate `APP_KEY` jika belum ada.

---

## I. Build Docker Image

Build image Docker `tuntas` secara terisolasi. Tahap ini akan:
- Mengunduh AWS RDS global CA bundle ke `/etc/ssl/certs/global-bundle.pem`.
- Menginstal dependensi PHP via Composer dengan `--no-dev --optimize-autoloader`.
- Menginstal dependensi Node.js via pnpm (`--frozen-lockfile`), meng-compile Next.js, dan melakukan `pnpm prune --prod`.

```bash
docker compose build --pull
```

---

## J. Menjalankan Docker Compose

Luncurkan stack layanan menggunakan skrip deployment terpadu atau Docker Compose:

### Cara 1: Menggunakan Skrip Deployment Resmi (Direkomendasikan)
```bash
./deploy.sh
```

### Cara 2: Menjalankan Manual
```bash
# Jalankan container di background
docker compose up -d

# Periksa status seluruh container
docker compose ps
```

Container yang berjalan:
1. `tuntas` (`app`): Container aplikasi terpadu dengan process supervisor bash (PID 1):
   - **Laravel API**: Port internal `8000`.
   - **Next.js Web**: Port internal `3000`.
   - **Queue Worker Daemon**: Auto-restarting worker dengan driver database (`--sleep=3 --tries=3 --max-time=3600`).
   - **Laravel Scheduler Daemon**: Menjalankan cron tasks (`reminders:generate`) tiap menit, mencatat log ke `/var/www/html/storage/logs/scheduler.log`, dan memperbarui heartbeat `/tmp/scheduler-health.txt`.
   - **Graceful Shutdown**: Menangani sinyal `SIGTERM`/`SIGINT`, memanggil `queue:restart`, dan menunggu seluruh proses anak berhenti dengan aman tanpa meninggalkan orphan process.
2. `tuntas-nginx` (`nginx`): Reverse proxy pada port publik `80` dan `443`.
3. `tuntas-certbot` (`certbot`): Menangani penerbitan dan renewal sertifikat SSL.

---

## K. Menjalankan Database Migration

Pada saat container `app` pertama kali dinyalakan, `docker-entrypoint.sh` secara otomatis:
1. Memverifikasi koneksi TLS/SSL ke AWS RDS MariaDB.
2. Mendeteksi apakah tabel `cache_locks` sudah tersedia.
3. Menjalankan `php artisan migrate --force` (untuk database baru) atau `php artisan migrate --force --isolated` (untuk database yang sudah berjalan).

Jika Anda ingin menjalankan migrasi atau seeder secara manual dari host:

```bash
# Jalankan migrasi
docker compose exec app php artisan migrate --force

# Buat akun administrator resmi dengan input password tersembunyi (aman dari bash history & process inspection)
docker compose exec app php artisan admin:create --name="Admin Tuntas" --email="admin@tuntas.id"
# Sistem akan meminta input password secara tersembunyi dan mengonfirmasinya.
```

---

## L. Menyiapkan Cache & Optimasi Laravel

Docker entrypoint secara otomatis meng-cache konfigurasi, route, dan view saat container boot. Anda dapat menyegarkan cache sewaktu-waktu:

```bash
docker compose exec app php artisan config:cache
docker compose exec app php artisan route:cache
docker compose exec app php artisan view:cache
```

---

## M. Menguji Akses Frontend

Buka browser atau gunakan `curl` dari terminal host:

```bash
# Uji HTTP Status Code Frontend
curl -I http://localhost
# Atau dari komputer lokal Anda:
curl -I http://EC2_PUBLIC_IP
```
**Ekspektasi Output**: `HTTP/1.1 200 OK` dengan header `X-Powered-By: Next.js`.

---

## N. Menguji Akses Backend & Health Check

Uji endpoint API melalui reverse proxy port 80:

```bash
curl -i http://localhost/api/v1/health
```

**Respon Sukses (HTTP 200 OK)**:
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

---

## O. Mengaktifkan HTTPS (Let's Encrypt SSL)

Jika Anda memiliki domain (misal: `tuntas.id`):

1. **Arahkan DNS**:
   - `A Record`: `tuntas.id` -> `EC2_PUBLIC_IP`
   - `A Record`: `www.tuntas.id` -> `EC2_PUBLIC_IP`

2. **Jalankan Skrip Otomasi SSL**:
   ```bash
   ./scripts/setup-ssl.sh tuntas.id admin@tuntas.id
   ```

3. **Perbarui `.env` untuk HTTPS**:
   ```env
   APP_URL=https://tuntas.id
   FRONTEND_URL=https://tuntas.id
   CORS_ALLOWED_ORIGINS=https://tuntas.id,https://www.tuntas.id
   SESSION_SECURE_COOKIE=true
   ```

4. **Reload Cache Aplikasi**:
   ```bash
   docker compose exec app php artisan config:cache
   ```

5. **Verifikasi Renewal Otomatis**:
   Sertifikat akan di-renew secara otomatis oleh Certbot. Anda dapat mengujinya dengan simulasi dry-run:
   ```bash
   docker compose run --rm certbot renew --dry-run
   ```

---

## P. Panduan Troubleshooting Masalah Produksi

### 1. Database Connection Timeout / Refused
- **Gejala**: `Failed to connect to database at ... after 30 attempts. Aborting startup.`
- **Penyebab**: Security group RDS tidak mengizinkan port 3306 dari Security Group EC2, atau credential database salah.
- **Solusi**:
  1. Periksa inbound rule Security Group RDS: pastikan type `MySQL/Aurora` port 3306 mengizinkan source `sg-ec2-tuntas`.
  2. Tes koneksi dari host EC2: `mariadb -h YOUR_RDS_ENDPOINT -u admin -p`.
  3. Periksa file `.env` dan pastikan variabel `DB_*` sudah tepat.

### 2. RDS SSL Certificate Verification Failure
- **Gejala**: `SQLSTATE[HY000] [2002] ... SSL certificate validation failed`.
- **Penyebab**: File sertifikat CA tidak ditemukan atau salah konfigurasi.
- **Solusi**:
  1. Image Docker Tuntas telah memuat Amazon Root CA bundle di `/etc/ssl/certs/global-bundle.pem`.
  2. Pastikan file `.env` memuat:
     ```env
     MYSQL_ATTR_SSL_CA=/etc/ssl/certs/global-bundle.pem
     DB_SSL_VERIFY_CERT=true
     ```

### 3. Migration Lock Terhambat (`Isolated migration lock`)
- **Gejala**: Log startup menampilkan peringatan lock migrasi sedang berjalan.
- **Penyebab**: Container dimatikan mendadak saat migrasi sedang aktif.
- **Solusi**:
  ```bash
  docker compose exec app php artisan cache:forget "illuminate:migrations"
  docker compose exec app php artisan migrate --force
  ```

### 4. Permission Denied pada Folder Storage / Logs
- **Gejala**: `The stream or file ".../storage/logs/laravel.log" could not be opened: Permission denied`.
- **Solusi**:
  Pastikan folder storage dimiliki oleh `www-data` dengan permission `775`:
  ```bash
  docker compose exec -u root app chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
  docker compose exec -u root app chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache
  ```

### 5. Memeriksa Log Aplikasi Secara Real-Time
```bash
# Log seluruh stack
docker compose logs -f

# Log Laravel saja
docker compose exec app tail -n 100 /var/www/html/storage/logs/laravel.log

# Log Nginx reverse proxy
docker compose logs -f nginx
```

---

## Q. Prosedur Rollback Aman (Safe Rollback)

Jika rilis versi baru mengalami kendala pada produksi:

1. **Revert Kode ke Commit Sebelumnya**:
   ```bash
   git log --oneline -n 5
   git checkout <COMMIT_HASH_SEBELUMNYA>
   ```

2. **Rollback Database (Jika Diperlukan)**:
   ```bash
   docker compose exec app php artisan migrate:rollback --step=1 --force
   ```

3. **Rebuild & Jalankan Ulang Container**:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

4. **Verifikasi Health Check**:
   ```bash
   docker compose ps
   curl -i http://localhost/api/v1/health
   ```
