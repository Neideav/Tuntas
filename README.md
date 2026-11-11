# ⚡ Tuntas (SysTask) - Futuristic To-Do App

<p align="center">
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PHP-8.2%2B-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP 8.2+" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

**Tuntas (SysTask)** adalah aplikasi manajemen tugas (*To-Do List*) modern berbasis **Laravel 12** dengan antarmuka futuristik bertema *dark cyber neon* yang dibangun menggunakan **Tailwind CSS**. Aplikasi ini dirancang untuk membantu pengguna mengelola daftar pekerjaan harian dengan cepat, aman, dan efisien.

---

## ✨ Fitur Utama

- 🔐 **Autentikasi Pengguna**: Sistem pendaftaran (*register*), masuk (*login*), dan keluar (*logout*) yang aman.
- 👤 **Multi-User Isolation**: Setiap pengguna hanya dapat melihat dan mengelola tugas miliknya sendiri.
- ⚡ **Manajemen Tugas Lengkap (CRUD)**:
  - Tambah tugas baru secara instan.
  - Ubah judul tugas dan perbarui status pengerjaan.
  - Hapus tugas yang sudah tidak diperlukan.
- 🔒 **Proteksi Tugas Selesai**: Tugas yang telah bertanda `selesai` terkunci secara otomatis agar riwayat pekerjaan tidak sengaja terubah.
- 🔍 **Pencarian & Filter Cepat**:
  - Filter berdasarkan status: **Semua**, **Proses**, atau **Selesai**.
  - Pencarian tugas secara *real-time* berdasarkan kata kunci judul.
- 🌌 **Desain Futuristik**: Antarmuka gelap (*dark mode*) yang elegan dengan efek *neon glow* berbasis Tailwind CSS.

---

## 🛠️ Tech Stack

- **Backend**: [Laravel 12](https://laravel.com) (PHP 8.2+)
- **Frontend**: Blade Templating, Tailwind CSS, Vite
- **Database**: MySQL / SQLite / PostgreSQL (Didukung penuh via Eloquent ORM)

---

## 🚀 Panduan Instalasi Lokal

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di lingkungan lokal Anda:

### 1. Clone Repository
```bash
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas
```

### 2. Instal Dependensi PHP & JavaScript
```bash
# Instal dependensi Composer (PHP)
composer install

# Instal dependensi NPM (Node.js)
npm install
```

### 3. Konfigurasi Environment
Salin file konfigurasi `.env.example` ke `.env`:
```bash
cp .env.example .env
```

Buat application key:
```bash
php artisan key:generate
```

Sesuaikan konfigurasi database pada file `.env` (misalnya menggunakan MySQL atau SQLite):
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=tuntas_db
DB_USERNAME=root
DB_PASSWORD=
```

### 4. Jalankan Migrasi & Seeder Database
```bash
php artisan migrate
```
*(Opsional) Jalankan seeder jika ingin mengisi data pengujian:*
```bash
php artisan db:seed
```

### 5. Jalankan Server Pengembangan
Buka dua terminal terpisah:

**Terminal 1 (Backend Laravel):**
```bash
php artisan serve
```

**Terminal 2 (Frontend Vite):**
```bash
npm run dev
```

Buka peramban (*browser*) Anda di `http://127.0.0.1:8000`.

---

## 📂 Struktur Database

- **users**: Menyimpan data akun pengguna (`name`, `email`, `password`).
- **todos**: Menyimpan entitas tugas yang berelasi dengan tabel `users`:
  - `id`: Primary key
  - `user_id`: Foreign key ke `users.id`
  - `title`: Judul atau deskripsi singkat tugas
  - `status`: Enum (`proses`, `selesai`)
  - `timestamps`: Waktu pembuatan dan pembaruan

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi [MIT License](LICENSE).
