# 07. Design System & Panduan UI/UX (Design System & UI/UX Guidelines)

## 1. Filosofi Desain: Modern Clean SaaS Workspace

Frontend **Tuntas** mengadopsi estetika **Clean Productivity SaaS**:
- **Prinsip Utama**: Kejelasan (*clarity*), kesederhanaan (*simplicity*), konsistensi visual (*visual consistency*), alur kerja efisien (*efficient workflows*), dan hierarki informasi yang tegas (*strong information hierarchy*).
- **Kanvas Bersih**: Latar belakang aplikasi menggunakan `bg-slate-50` (`#f8fafc`) dengan kontainer kartu putih bersih `bg-white` (`#ffffff`) dan pembatas halus `border-slate-200/80` (`#e2e8f0`).
- **Aksen Primer**: Biru profesional dinamis `text-sky-600` / `bg-sky-600` (`#0284c7`) untuk tombol utama, indikator aktif, dan status penting.
- **Tipografi**: Sans-serif bersih (Inter / Modern System Fonts) dengan ketebalan teks hierarkis (*bold 700* untuk judul dan metrik, *semibold 600* untuk subheader dan badge, *regular 400* untuk deskripsi).

---

## 2. Token Warna & Sistem Badge

| Token Desain | Nilai Tailwind / Hex | Penerapan Antarmuka |
| :--- | :--- | :--- |
| **Canvas Background** | `bg-slate-50` (`#f8fafc`) | Latar belakang aplikasi dan viewport kerja utama |
| **Card Surface** | `bg-white` (`#ffffff`) | Kartu tugas, kontainer proyek, modal popup |
| **Border Subtle** | `border-slate-200/80` | Pembatas garis halus antar komponen |
| **Text Primary** | `text-slate-900` (`#0f172a`) | Judul, nama tugas, metrik angka |
| **Text Secondary**| `text-slate-500` (`#64748b`) | Tanggal tenggat, subtitle, keterangan tambahan |
| **Accent Sky** | `bg-sky-600` (`#0284c7`) | Tombol aksi primer, tab aktif, progres bar |
| **Priority High** | `bg-rose-50 text-rose-600` | Badge prioritas tinggi pada kartu tugas |
| **Priority Medium**| `bg-amber-50 text-amber-700`| Badge prioritas sedang |
| **Priority Low** | `bg-sky-50 text-sky-700` | Badge prioritas rendah |
| **Status To-Do** | `bg-slate-100 text-slate-700`| Status tugas belum dimulai |
| **Status Progress**| `bg-sky-50 text-sky-700` | Status sedang dikerjakan |
| **Status Review** | `bg-amber-50 text-amber-700`| Status dalam peninjauan |
| **Status Done** | `bg-emerald-50 text-emerald-700` | Status selesai |

---

## 3. Komponen Inti Bersama (`apps/web/src/components/ui/`)

1. **`Badge.tsx`**:
   - Menghasilkan badge prioritas (`high`, `medium`, `low`, `urgent`) dan status alur kerja (`todo`, `in_progress`, `in_review`, `completed`).
2. **`Button.tsx`**:
   - Mendukung varian `primary`, `secondary`, `outline`, `ghost`, dan `danger` dengan status loading spinner bawaan (`loading={true}`).
3. **`Input.tsx`**:
   - Input field modern dengan dukungan ikon sisi kiri/kanan, label semantik, dan validasi error visual.
4. **`Modal.tsx`**:
   - Dialog interaktif dengan backdrop blur (`backdrop-blur-sm`), animasi zoom-in, header tertutup rapi, dan tombol aksi terintegrasi.
5. **`Card.tsx`**:
   - Wadah modular dengan `CardHeader`, `CardContent`, dan `CardFooter`.
6. **`Tabs.tsx`**:
   - Pengalih tampilan responsif (`Kanban`, `Table`, `List`, `Timelines`) dengan garis sorot aktif di bawah tab.
7. **`AvatarStack.tsx`**:
   - Tumpukan avatar kolaborator dengan inisial nama dan lingkaran ring putih (`DM`, `UL`, `+2`).
8. **`EmptyState.tsx`**:
   - Tampilan ramah pengguna saat data kosong lengkap dengan ikon ilustratif dan tombol panggilan aksi (*Call To Action*).

---

## 4. Pola Tata Letak Aplikasi (Application Shell Layout)

```
+---------------------------------------------------------------------------------------+
|  SIDEBAR (w-64, fixed)       |  MAIN HEADER NAVBAR (sticky top)                       |
|  - Workspace Selector Card   |  - Breadcrumb ("Workspace / Tasks / Kanban")           |
|                              |  - Global Search Input ("Search here...")              |
|  MAIN MENU                   |  - Activity Log & Collaborator Avatars (DM, UL, +2)    |
|  - Home (Dashboard)          |  - Invite People Button                                |
|  - Tasks (Kanban / Table)    |  - User Profile Dropdown Pill                          |
|  - Projects                  +--------------------------------------------------------+
|  - Habits (Streak Engine)    |  PAGE CONTENT VIEWPORT (p-8, max-w-7xl)                 |
|  - Goals (OKRs)              |                                                        |
|  - Learning (LMS)            |  [ Search & Filter Bar ]          [ + New Task / CTA ] |
|  - Examinations              |  [ Kanban | Table | List | Timelines ] Tabs Switcher   |
|  - Calendar                  |                                                        |
|  - Notifications (Badge 10)  |  +------------+ +------------+ +------------+          |
|                              |  | To-Do (1)  | | Prog. (2)  | | Done (1)   |          |
|  DIVISION / CATEGORIES       |  |------------| |------------| |------------|          |
|  - Administrator             |  | [Card 1]   | | [Card 2]   | | [Card 3]   |          |
|  - Computer Science          |  +------------+ +------------+ +------------+          |
|  - + Create New              |                                                        |
|                              |                                                        |
|  HELP CENTER & SETTINGS      |                                                        |
|  - Help & Docs               |                                                        |
|  - Settings                  |                                                        |
|  - User Profile & Log Out    |                                                        |
+---------------------------------------------------------------------------------------+
```

---

## 5. Rincian Antarmuka Layar yang Diimplementasikan

### A. Modul Core
1. **Dashboard** (`/dashboard`): 4 kartu ringkasan metrik, daftar prioritas hari ini, status kebiasaan aktif, dan hitung mundur ujian.
2. **Task Management** (`/tasks`):
   - Papan **Kanban 4 kolom** (`To-Do`, `On Progress`, `In Review`, `Completed`).
   - Kartu tugas dilengkapi:
     - Badge prioritas berpenanda warna.
     - Judul tugas dan ringkasan catatan.
     - Kotak progres subtask (*Sub Task 1/2*) dengan progress bar halus.
     - Tanggal tenggat waktu (*Due Date*).
     - Tumpukan avatar kolaborator, hitungan lampiran klip kertas, dan balon pesan.
   - Pilihan tampilan alternatif: **Tabel Data** dan **Daftar Ringkas**.
   - Modal pembuatan tugas lengkap dengan checklist subtasks dinamis.
   - Modal detail tugas dengan checklist interaktif dan toggle penyelesaian tugas.
3. **Project Management** (`/projects`): Kartu proyek dengan bilah persentase capaian otomatis, tanggal deadline, badge status, dan modal CRUD.
4. **Habit Tracker** (`/habits`): Pelacak rutinitas dengan tombol *Check-in* instan, penghitung hari berturut-turut (*current streak* dan *best streak*), serta pemanfaatan token pelindung (*freeze shield tokens*).
5. **Goal Management (OKRs)** (`/goals`): Penetapan objektif ambisius dengan pengukuran key results berbasis slider nilai kuantitatif.
6. **Kalender & Penjadwalan** (`/calendar`): Tampilan kalender bulanan terpadu yang memetakan deadline tugas, proyek, dan tanggal ujian.

### B. Modul Learning
1. **Learning Hub & Kursus** (`/learning`):
   - Daftar kursus dan silabus belajar.
   - Modul bab dan materi pelajaran yang dapat ditandai selesai secara real-time.
   - Jurnal pencatatan sesi belajar (*Study Sessions Log*) dengan durasi menit dan catatan materi.

### C. Dedicated Examination Subsystem
1. **Examination Hub** (`/examinations`):
   - Tab Jadwal Ujian Operasional (*Scheduled Exams & Checklists*).
   - Tab Blueprint Ujian (*Assessment Engine & Tests*) dengan tombol peluncur ujian.
   - Tab Bank Soal (*Question Banks*) untuk menyusun soal pilihan ganda, benar/salah, dan isian singkat.
2. **Examination Taking Simulator** (`/examinations/take/[id]`):
   - Lingkungan ujian terisolasi dan bebas distraksi.
   - Sinkronisasi timer mundur terotorisasi server (`expires_at`).
   - Sistem anti-curang (*anti-cheat integrity tracker*) yang mendeteksi pergantian tab browser dan hilangnya fokus window.
   - Palet nomor soal dengan indikator status telah dijawab atau belum.
   - Heartbeat auto-save jawaban setiap 30 detik.
3. **Examination Review & Hasil** (`/examinations/review/[id]`):
   - Papan skor komprehensif (persentase nilai, poin total, banner kelulusan).
   - Laporan audit integritas ujian (*tab switch tally*).
   - Analisis butir soal pasca-penyerahan yang menampilkan jawaban siswa, kunci jawaban resmi, dan penjelasan instruktur.

### D. Akun & Pengaturan
1. **Notification Center** (`/notifications`): Notifikasi real-time dengan filter dibaca/belum dibaca dan opsi *Mark All as Read*.
2. **Account Settings** (`/settings`): Pembaruan profil, kata sandi, timezone, dan kanal notifikasi.
3. **Categories & Tags** (`/categories`): Pengaturan divisi dan penanda warna polimorfik.
