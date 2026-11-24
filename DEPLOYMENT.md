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
# Uji API Health check
curl -i http://localhost/api/v1/health

# Uji Frontend Next.js
curl -i http://localhost:3000
```
Respon sukses:
```json
{"status":"healthy","database":"connected","timestamp":"2026-11-24T12:00:00Z"}
```
