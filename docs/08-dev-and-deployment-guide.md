# 08. Panduan Instalasi, Pengembangan & Deployment

## 1. Prasyarat Sistem
- **Node.js**: v20.x atau v22.x LTS
- **Package Manager**: pnpm (v9+ atau v12+)
- **PHP**: v8.2+ dengan ekstensi `pdo_sqlite` (atau `pdo_mysql`), `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `curl`
- **Composer**: v2.x

## 2. Langkah Instalasi Cepat

### Langkah 1: Kloning Repositori
```bash
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas
```

### Langkah 2: Instal Dependensi Frontend & Monorepo
```bash
pnpm install
```

### Langkah 3: Konfigurasi & Dependensi Backend (Laravel)
```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

## 3. Menjalankan Server Pengembangan

Di monorepo root:
```bash
# Menjalankan frontend (Next.js) dan backend (Laravel) secara bersamaan:
pnpm run dev
```
Atau di dua terminal terpisah:
- **Terminal 1 (Backend API)**:
  ```bash
  pnpm run dev:api
  # Berjalan di http://127.0.0.1:8000
  ```
- **Terminal 2 (Frontend Web)**:
  ```bash
  pnpm run dev:web
  # Berjalan di http://localhost:3000
  ```

Buka peramban di `http://localhost:3000`.

## 4. Pengujian Otomatis (Testing)
Untuk menjalankan suite pengujian backend:
```bash
# Dari root monorepo:
pnpm run test

# Atau langsung di apps/api:
cd apps/api
php artisan test
```

Untuk memvalidasi TypeScript di seluruh workspace:
```bash
pnpm run typecheck
```

Untuk membangun bundle produksi:
```bash
pnpm run build
```

## 5. Panduan Keamanan (Security Guidelines)
1. **Penyimpanan Kredensial**: Jangan pernah mengunggah file `.env` atau dump basis data `.sql` ke version control. Repositori telah dibersihkan dari file sensitif `users.sql`.
2. **Autentikasi Token**: Token API diterbitkan secara acak dan aman melalui Laravel Sanctum serta disimpan pada `localStorage` di sisi klien.
3. **Validasi Input**: Setiap request divalidasi ketat oleh Form Request / Validator Laravel sebelum masuk ke lapisan query Eloquent untuk mencegah SQL Injection.
4. **CORS**: Dikonfigurasi secara eksplisit di `apps/api/config/cors.php` agar hanya mengizinkan origin terpercaya (`http://localhost:3000`).

## 6. Troubleshooting
- **Masalah CORS**: Pastikan `apps/api/config/cors.php` memuat URL port frontend Next.js yang aktif.
- **Basis Data Terkunci (SQLite Lock)**: Pastikan folder `apps/api/database` memiliki izin tulis oleh pengguna sistem web.

## 7. Changelog
- **v2.0.0 (Transformasi Penuh)**:
  - Migrasi repositori ke arsitektur Monorepo (`apps/web`, `apps/api`, `packages/`, `docs/`).
  - Frontend sepenuhnya dibangun ulang menggunakan **Next.js 15, React 19, TypeScript, Tailwind CSS, dan Lucide Icons**.
  - Backend Laravel diperluas menjadi headless RESTful API dengan Laravel Sanctum.
  - Implementasi **Dedicated Examination Subsystem** lengkap dengan persiapan belajar.
  - Penambahan modul Project Management, Task Subtasks, Calendar Aggregator, Notifications, dan Categories.
  - Penghapusan dump sensitif `database/users.sql` dan penambahan 10 skenario feature testing otomatis.

