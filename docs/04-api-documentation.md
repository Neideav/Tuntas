# 04. Dokumentasi API (API Documentation)

## 1. Konvensi Global API
- **Base URL**: `/api/v1`
- **Format Pertukaran Data**: JSON (`Content-Type: application/json`, `Accept: application/json`)
- **Skema Autentikasi**: Laravel Sanctum Bearer Token (`Authorization: Bearer <token>`)
- **Format Respons Standar**:
  ```json
  {
    "success": true,
    "message": "Resource created successfully",
    "data": { ... }
  }
  ```
- **Format Error Standar**:
  ```json
  {
    "success": false,
    "message": "Validation failed",
    "errors": {
      "email": ["The email has already been taken."]
    }
  }
  ```

---

## 2. Endpoint Autentikasi & Akun
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Mendaftarkan pengguna baru & mengeluarkan Sanctum Bearer token |
| `POST` | `/api/v1/auth/login` | Autentikasi email/password & mengeluarkan token |
| `POST` | `/api/v1/auth/logout` | Mencabut token aktif saat ini |
| `GET` | `/api/v1/auth/me` | Mengambil data profil pengguna aktif |
| `PUT` | `/api/v1/auth/profile` | Memperbarui nama, email, timezone, avatar |
| `PUT` | `/api/v1/auth/password` | Memperbarui password |

---

## 3. Tasks, Projects & Dashboard
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard` | Mengambil agregasi metrik, ringkasan tugas hari ini, ujian mendatang, dan grafik kecepatan |
| `GET` | `/api/v1/tasks` | Mengambil daftar tugas dengan filter status, prioritas, kategori, dan pencarian |
| `POST` | `/api/v1/tasks` | Membuat tugas baru beserta subtasks |
| `GET` | `/api/v1/tasks/{task}` | Mengambil detail tugas spesifik |
| `PUT` | `/api/v1/tasks/{task}` | Memperbarui tugas |
| `DELETE` | `/api/v1/tasks/{task}` | Menghapus tugas (soft delete) |
| `PATCH` | `/api/v1/tasks/{task}/toggle` | Menandai tugas selesai / belum selesai |
| `POST` | `/api/v1/tasks/{task}/subtasks` | Menambahkan subtask pada task |
| `PATCH` | `/api/v1/subtasks/{subtask}/toggle` | Mengubah status penyelesaian subtask |
| `DELETE` | `/api/v1/subtasks/{subtask}` | Menghapus subtask |
| `GET` | `/api/v1/projects` | Mengambil daftar proyek |
| `POST` | `/api/v1/projects` | Membuat proyek baru |
| `PUT` | `/api/v1/projects/{project}` | Memperbarui proyek |
| `DELETE` | `/api/v1/projects/{project}` | Menghapus proyek |

---

## 4. Habit Tracking (Streak Engine)
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/habits` | Mengambil daftar habit aktif dengan status hari ini dan penghitung streak |
| `POST` | `/api/v1/habits` | Membuat habit baru (frekuensi: `daily`, `weekdays`, `weekly`) |
| `GET` | `/api/v1/habits/{habit}` | Detail kebiasaan beserta 30 riwayat terakhir |
| `PUT` | `/api/v1/habits/{habit}` | Memperbarui kebiasaan |
| `DELETE` | `/api/v1/habits/{habit}` | Menghapus kebiasaan |
| `POST` | `/api/v1/habits/{habit}/toggle` | Menyelesaikan / membatalkan penyelesaian habit untuk tanggal tertentu |
| `POST` | `/api/v1/habits/{habit}/freeze` | Menggunakan freeze token untuk melindungi streak pada hari yang terlewat |
| `GET` | `/api/v1/habits/{habit}/history` | Mengambil riwayat log kebiasaan untuk visualisasi heatmap |

---

## 5. Goals & OKRs
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/goals` | Mengambil daftar target dan progres |
| `POST` | `/api/v1/goals` | Membuat target baru (`start_date`, `target_date`) |
| `GET` | `/api/v1/goals/{goal}` | Detail target beserta daftar milestone |
| `PUT` | `/api/v1/goals/{goal}` | Memperbarui target |
| `DELETE` | `/api/v1/goals/{goal}` | Menghapus target |
| `POST` | `/api/v1/goals/{goal}/milestones` | Menambahkan milestone (key result) dengan auto-recalculate progress |
| `PATCH` | `/api/v1/milestones/{milestone}` | Memperbarui nilai milestone dan status penyelesaian |
| `DELETE` | `/api/v1/milestones/{milestone}` | Menghapus milestone |

---

## 6. Learning Management (LMS)
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/courses` | Mengambil daftar kursus dan progres |
| `POST` | `/api/v1/courses` | Mendaftarkan kursus baru |
| `GET` | `/api/v1/courses/{course}` | Mengambil kursus beserta modul dan pelajaran terurut |
| `PUT` | `/api/v1/courses/{course}` | Memperbarui kursus |
| `DELETE` | `/api/v1/courses/{course}` | Menghapus kursus |
| `POST` | `/api/v1/courses/{course}/modules` | Menambahkan modul/bab pada kursus |
| `DELETE` | `/api/v1/modules/{module}` | Menghapus modul |
| `POST` | `/api/v1/modules/{module}/lessons` | Menambahkan pelajaran |
| `PATCH` | `/api/v1/lessons/{lesson}/toggle` | Menandai pelajaran selesai & auto-recalculate progres kursus |
| `GET` | `/api/v1/learning-sessions` | Mengambil riwayat sesi belajar |
| `POST` | `/api/v1/learning-sessions` | Mencatat sesi belajar pengguna |

---

## 7. Dedicated Examination Subsystem Engine
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/examinations` | Mengambil jadwal ujian operasional & persiapan |
| `POST` | `/api/v1/examinations` | Membuat jadwal ujian baru |
| `POST` | `/api/v1/examinations/{exam}/preparations` | Menambahkan item checklist persiapan ujian |
| `PATCH` | `/api/v1/examinations/preparations/{item}/toggle` | Menandai checklist persiapan |
| `GET` | `/api/v1/question-banks` | Mengambil daftar bank soal |
| `POST` | `/api/v1/question-banks` | Membuat bank soal baru |
| `GET` | `/api/v1/question-banks/{bank}` | Detail bank soal beserta daftar pertanyaan dan opsi |
| `POST` | `/api/v1/question-banks/{bank}/questions` | Menambahkan soal baru (tipe: `multiple_choice_single`, `multiple_choice_multiple`, `true_false`, `short_answer`, `essay`, `code_analysis`) |
| `GET` | `/api/v1/exam-blueprints` | Mengambil daftar konfigurasi ujian terstruktur |
| `POST` | `/api/v1/exam-blueprints` | Membuat blueprint ujian |
| `POST` | `/api/v1/exam-blueprints/{blueprint}/attach-questions` | Menautkan soal ke blueprint |
| `POST` | `/api/v1/exam-blueprints/{blueprint}/start` | **Memulai Sesi Ujian**: Mengembalikan UUID sesi ujian dan snapshot soal teracak (kunci jawaban & penjelasan disanitasi) |
| `POST` | `/api/v1/exam-attempts/{attempt}/sync` | **Auto-Save Jawaban**: Mengirim jawaban berkala. Mengembalikan sisa waktu server |
| `POST` | `/api/v1/exam-attempts/{attempt}/integrity` | **Anti-Cheat Proctoring**: Merekam event integritas (`tab_switch`, `window_blur`, `fullscreen_exit`) |
| `POST` | `/api/v1/exam-attempts/{attempt}/submit` | **Penyerahan & Penilaian Otomatis**: Menghitung skor objektif, persentase nilai, dan status kelulusan |
| `GET` | `/api/v1/exam-attempts/{attempt}/review` | **Telaah Pasca-Ujian**: Menampilkan rincian soal, kunci jawaban yang benar, penjelasan, dan ringkasan integritas (hanya setelah submit) |

---

## 8. Analytics & Reporting Engine
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/analytics/productivity` | Agregasi analitik tugas, rasio penyelesaian, distribusi prioritas, progres proyek, konsistensi habit, dan aktivitas kalender |
| `GET` | `/api/v1/analytics/learning` | Analitik durasi belajar, statistik sesi, progres mata pelajaran, performa ujian (pass rate, rata-rata nilai, distribusi skor) |
| `GET` | `/api/v1/learning-analytics` | Ringkasan analitik pembelajaran terintegrasi dengan hasil ujian terbaru |

---

## 9. Kalender, Notifikasi & Pengaturan
| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/v1/calendar/events` | Mengambil seluruh event gabungan (tugas, proyek, jadwal ujian, habit log) untuk tampilan kalender |
| `GET` | `/api/v1/notifications` | Mengambil daftar notifikasi pengguna dengan filter tipe (`system`, `deadline`, `exam`, `habit`) dan status baca |
| `POST` | `/api/v1/notifications` | Membuat notifikasi baru dengan pencegahan duplikasi |
| `POST` | `/api/v1/notifications/check-reminders` | Memindai tenggat tugas (<24 jam) dan ujian (<48 jam) untuk membuat pengingat otomatis tanpa duplikasi |
| `PATCH` | `/api/v1/notifications/{item}/read` | Menandai satu notifikasi telah dibaca |
| `POST` | `/api/v1/notifications/read-all` | Menandai seluruh notifikasi telah dibaca |
| `DELETE` | `/api/v1/notifications/{item}` | Menghapus notifikasi |
| `GET` | `/api/v1/search?q={query}` | Pencarian terpadu lintas task, proyek, dan ujian |
| `GET` | `/api/v1/settings` | Mengambil konfigurasi pengguna |
| `PUT` | `/api/v1/settings` | Memperbarui tema dan preferensi notifikasi |
