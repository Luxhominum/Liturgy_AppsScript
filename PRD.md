# PRD — Sistem Penjadwalan Petugas Liturgi

**Status:** Sudah dipakai (in production), masih dalam pengembangan aktif
**Platform:** Google Apps Script (backend) + Google Sheets (database) + HTML Service (frontend)
**Bahasa aplikasi:** Bahasa Indonesia (semua UI, komentar kode, dan pesan error — TIDAK ada Bahasa Inggris di dalam produk)
**Dokumen ini untuk:** AI/developer lain yang melanjutkan proyek ini. Baca dokumen ini SEBELUM mengubah kode apapun.

---

## 1. Apa proyek ini

Aplikasi web internal untuk sebuah paroki Katolik di Indonesia, dipakai mengatur jadwal **petugas liturgi** (Organis, Pemazmur, Lektor, Misdinar, Prodiakon, Paduan Suara, Tatib, Hias Altar) untuk misa Sabtu Sore / Minggu Pagi / Minggu Sore, plus misa khusus (Paskah, Natal, dll).

Ini **menggantikan sebuah file Excel/VBA lama** (`Master_Jadwal_Petugas_Liturgi_THE_HOLY_GRAIL_-_Lingkungan.xlsm`) yang sebelumnya dipakai manual oleh paroki selama bertahun-tahun. File itu berisi data 172 petugas asli dan logika validasi VBA yang sudah teruji di lapangan — **aturan bisnis aplikasi ini sengaja disamakan persis dengan logika VBA tersebut**, bukan ditebak dari spesifikasi tertulis saja. Ini penting dipahami: kalau ada keraguan soal "aturan mana yang benar", VBA lama adalah sumber kebenaran, bukan dokumen spesifikasi awal (`Liturgy_Scheduling_System_Spec_v1_0`, lihat bagian 9).

### 1.1 Kenapa Google Apps Script + Sheets (bukan stack lain)

Keputusan ini dibuat di awal proyek, bukan oleh penulis PRD ini:
- Paroki sudah biasa pakai Google Workspace, tidak perlu hosting/server terpisah.
- Google Sheets dipakai sebagai database — bisa dilihat/diaudit langsung oleh pengurus non-teknis kalau perlu.
- Deploy sebagai Web App dari Apps Script Editor, tidak perlu domain/SSL/server sendiri.

**Konsekuensi penting bagi siapapun yang melanjutkan:** Apps Script punya batas eksekusi 6 menit dan setiap panggilan `SpreadsheetApp` (baca/tulis sel) adalah satu request jaringan sungguhan (bukan operasi lokal) — jadi **jumlah panggilan API Sheets adalah faktor performa nomor satu**, bukan kompleksitas algoritma. Ini sudah beberapa kali jadi sumber bug performa serius di proyek ini (lihat bagian 10).

---

## 2. Pengguna & Peran (Permissions)

Tiga peran, disimpan per-email di sheet `Config` (lihat catatan spec-gap di bagian 9):

| Peran | Bisa apa |
|---|---|
| **ADMIN** | Semua akses: kelola petugas, kelola aturan, finalisasi/buka-kembali akhir pekan, override peringatan, atur peran pengguna lain, lihat audit |
| **SCHEDULER** (Penjadwal) | Susun jadwal Draft: tugaskan/hapus petugas individu & komunitas, tidak bisa override peringatan, tidak bisa ubah akhir pekan yang sudah FINAL |
| **VIEWER** (Pelihat) | Hanya lihat, tidak bisa ubah apapun |

Pengguna baru default jadi VIEWER (fail-closed) sampai di-set manual oleh Admin lewat tab "Pengguna". Admin pertama dibuat lewat fungsi `aturDiriSayaSebagaiAdmin()` yang dijalankan manual dari Apps Script Editor (bukan lewat web), sekali saja saat setup awal.

---

## 3. Istilah Kunci (Glosarium)

Proyek ini pakai istilah paroki asli, bukan istilah generik. Siapapun yang melanjutkan HARUS pakai istilah yang sama persis di kode/dokumentasi — jangan diterjemahkan ke "region"/"district"/dsb.

| Istilah | Arti |
|---|---|
| **Wilayah** | Pembagian teritorial besar di paroki (contoh: Maria Ratu, Maria Carmel) — 12 wilayah geografis + 4 nilai spesial (GRASIA, LUAR PAROKI, LAIN LAIN, BECANBO) untuk kelompok Paduan Suara di luar struktur wilayah biasa |
| **Lingkungan** | Sub-komunitas di dalam satu Wilayah (contoh: Wilayah "Maria Ratu" punya Lingkungan Timotius, Titus, Yohanes) — total 34 di data legacy |
| **Petugas** | Orang yang bertugas dalam misa |
| **Akhir Pekan (Weekend)** | Satu unit penjadwalan = satu akhir pekan Sabtu-Minggu, punya beberapa Sesi |
| **Sesi (Session)** | Satu misa spesifik: Sabtu Sore / Minggu Pagi / Minggu Sore, atau "sesi khusus" (misa tidak baku, misal Misa Paskah) |
| **Peran individu** | Organis (kuota 1), Pemazmur (2), Lektor (3), Misdinar (6), Prodiakon (6) — ditugaskan ke ORANG tertentu per sesi |
| **Penugasan komunitas** | Paduan Suara & Hias Altar (tingkat Wilayah), Tatib (tingkat Lingkungan) — ditugaskan ke WILAYAH/LINGKUNGAN, bukan ke orang tertentu |
| **Jadwal** | Sheet output/laporan format cetak, meniru persis layout Excel lama |

---

## 4. Model Data (13 Sheet)

Semua didefinisikan di `Code.gs` → `KONFIG.SKEMA`. Kolom dibaca **berdasarkan nama header**, bukan posisi — jadi kolom baru bisa ditambah di akhir tanpa merusak data lama (lihat `pastikanSheetDenganHeader_` — migrasi skema aditif otomatis).

| Sheet | Kolom | Catatan |
|---|---|---|
| `People` | person_id, nama, lingkungan_id, aktif, dibuat_pada, diubah_pada, dibuat_oleh, diubah_oleh | Soft-delete only (nonaktifkan, tidak pernah dihapus) |
| `Wilayah` | wilayah_id, nama, aktif | |
| `Lingkungan` | lingkungan_id, nama, wilayah_id, aktif | |
| `Person_Roles` | person_role_id, person_id, role_id, aktif | Kelayakan peran per orang (many-to-many) |
| `Role_Config` | role_id, nama_peran, jumlah_dibutuhkan, jumlah_maksimal, aktif, urutan | Default: Organis(1), Pemazmur(2), Lektor(3), Misdinar(6), Prodiakon(6) |
| `Weekends` | weekend_id, tanggal_acuan, status, **revisi**, dibuat_pada, diubah_pada, difinalkan_pada, difinalkan_oleh | `revisi` = kunci optimistic-concurrency, WAJIB dicek di setiap tulis |
| `Sessions` | session_id, weekend_id, jenis_sesi, tanggal_sesi, status, nama_khusus | jenis_sesi: SABTU_SORE/MINGGU_PAGI/MINGGU_SORE/KHUSUS |
| `Assignments` | assignment_id, weekend_id, session_id, person_id, role_id, status, dibuat_pada, dibuat_oleh, diubah_pada, diubah_oleh | Penugasan individu. status: ACTIVE/REMOVED (soft-delete) |
| `Community_Assignments` | community_assignment_id, weekend_id, session_id, jenis_penugasan, wilayah_id, lingkungan_id, alasan_override, dibuat_pada, dibuat_oleh, **status** | Penugasan Koor/Tatib/Hias Altar. Kolom `status` ditambahkan belakangan (migrasi aditif) |
| `Rule_Config` | rule_id, nama_aturan, aktif, tingkat, konfigurasi_json, versi_kebijakan, diubah_pada, diubah_oleh | Aturan BLOCK tidak bisa dimatikan (dicek di `RepoKonfigAturan.perbaruiKonfigAturan`) |
| `Audit_Log` | audit_id, waktu, pelaku_id, aksi, jenis_entitas, entitas_id, nilai_lama_json, nilai_baru_json, rule_id, alasan_override, versi_kebijakan | Append-only, tidak ada update/delete |
| `Jadwal` | Tanggal, Misa, Koor, Hias Altar, Tatib, Tugas, Petugas, Asal wilayah, Informasi | Layout PERSIS meniru Excel lama. Header di baris 4, data mulai baris 5 |
| `Config` | kunci, nilai | Key-value umum: `versi_kebijakan` (global), `peran_pengguna:<email>` (role assignment stopgap) |

ID stabil dipakai di semua tabel (`PER-`, `WIL-`, `LKG-`, `PRL-`, `ROL-`, `WKD-`, `SES-`, `ASG-`, `CAS-`, `RUL-`, `AUD-` + timestamp + angka acak) — **nama orang/wilayah TIDAK PERNAH dipakai sebagai kunci relasi**, hanya untuk tampilan.

---

## 5. Aturan Bisnis (Business Rules)

**PENTING:** Aturan-aturan di bawah ini sudah dikonfirmasi PERSIS SAMA dengan logika VBA di file Excel lama (fungsi `CekBlacklist`, `CekWarningKoor`, `CekWarningHiasAltar` di form `frmInputJadwal`), bukan tebakan dari dokumen spesifikasi. Kalau mau mengubah salah satu aturan ini, konfirmasi dulu ke pemilik proses paroki — jangan asal ubah berdasarkan logika "yang lebih masuk akal".

### Tingkat WAJIB (BLOCK — tidak bisa dimatikan lewat Pengaturan Aturan)

| Kode | Aturan |
|---|---|
| BR-020 | Orang harus punya peran itu (`Person_Roles`) sebelum bisa ditugaskan |
| BR-026 | Kuota peran per sesi tidak boleh dilewati (`jumlah_maksimal` di `Role_Config`) |
| BR-030/031 | Orang yang sama tidak boleh bertugas 2x dalam satu akhir pekan (sesi manapun) — **KECUALI Organis**, yang boleh bertugas di lebih dari satu sesi dalam akhir pekan yang sama |
| BR-032 | Tidak boleh bertugas 2 akhir pekan berturut-turut — berlaku untuk SEMUA orang termasuk Organis (tidak ada pengecualian di sini) |
| BR-013 | Wilayah Koor Paduan Suara: tidak boleh dipakai 2x dalam satu akhir pekan (lintas sesi), dan tidak boleh dipakai di akhir pekan berturut-turut. **Aturan keadilan tambahan**: orang dari Wilayah yang sedang jadi Koor tidak bisa mengisi peran individu lain di akhir pekan yang sama (kecuali Organis) |
| BR-041 | Tatib (berbasis Lingkungan): tidak boleh dipakai 2x dalam satu akhir pekan, tidak boleh berturut-turut antar akhir pekan, dan Wilayah dari Lingkungan itu tidak boleh sedang jadi Koor Paduan Suara di akhir pekan yang sama |

### Tingkat PERINGATAN (WARNING — bisa dilanjutkan, wajib isi alasan override, hanya Admin yang boleh override)

| Kode | Aturan |
|---|---|
| BR-052 | Wilayah yang sama tidak boleh jadi Koor Paduan Suara DAN Hias Altar di akhir pekan yang sama (peringatan dua arah) |

### Tingkat OTOMATIS (AUTO — tidak memblokir, hanya bantu tampilan/saran)

| Kode | Aturan |
|---|---|
| BR-034 | "Terakhir bertugas" dihitung LIVE dari riwayat `Assignments`, TIDAK disimpan sebagai kolom statis (beda dari Excel lama yang punya kolom ini tapi kosong semua) |
| BR-027 | Saran petugas berdasarkan siapa yang paling lama/jarang bertugas (Least Recently Used) |
| BR-051 | Hias Altar diisi SEKALI per akhir pekan (biasanya di form Sabtu Sore), otomatis berlaku untuk semua sesi di akhir pekan itu — TIDAK per-sesi seperti Koor/Tatib |
| BR-062 | Status progres per peran per sesi (terisi/dibutuhkan → TERPENUHI atau BELUM_LENGKAP) |

### Catatan penting soal cakupan pengecekan

Semua pengecekan "dobel/berturut-turut" di atas beroperasi pada **cakupan satu akhir pekan penuh** (lintas 3 sesi baku + sesi khusus), BUKAN per-sesi saja. Ini pernah salah diimplementasikan sempit (per-sesi) di versi awal proyek dan sudah diperbaiki — lihat bagian 10.

---

## 6. Fitur (per tab di aplikasi)

### 6.1 Kalender
- Buka/buat akhir pekan: pilih tanggal Minggu, **centang sesi mana saja yang ada** (Sabtu Sore/Minggu Pagi/Minggu Sore — tidak dipaksa selalu 3), tambah sesi khusus kapan saja (nama + tanggal bebas, bisa diedit/dihapus selama belum ada penugasan)
- Lihat kalender bulan berjalan, status tiap akhir pekan (Draft/Lengkap/Final)
- Detail akhir pekan: isi/hapus petugas individu per peran per sesi, isi/batalkan Koor & Tatib per sesi, isi/batalkan Hias Altar (tingkat akhir pekan)
- Finalisasi (Admin only) — mengunci akhir pekan dari perubahan oleh Scheduler; Buka Kembali membatalkan finalisasi
- Cetak Jadwal (langsung dari browser) dan Ekspor ke Sheet Jadwal (format Excel lama, idempotent — aman diekspor ulang)

### 6.2 Kelola Petugas
- Tambah/nonaktifkan Wilayah & Lingkungan
- Tambah petugas baru, cari/filter, kelola peran per orang (lihat status "sudah dimiliki" vs belum, bisa cabut)
- Nonaktifkan petugas (riwayat penugasan lama tetap tersimpan)

### 6.3 Pengaturan Aturan (Admin only)
- Lihat semua aturan (BR-xxx), aktifkan/nonaktifkan yang bertingkat WARNING/AUTO (BLOCK tidak bisa dimatikan)

### 6.4 Riwayat Audit (Admin only)
- Lihat semua aksi tercatat: siapa, kapan, apa, alasan override kalau ada

### 6.5 Pengguna (Admin only)
- Atur peran (ADMIN/SCHEDULER/VIEWER) per alamat email

---

## 7. Arsitektur Teknis

### 7.1 Struktur file (SENGAJA hanya 3 file, bisa tempel-langsung)

| File | Isi |
|---|---|
| `Code.gs` | SATU file server: Konfigurasi → Utilitas → Setup Awal → Repository (akses sheet mentah) → Layanan (aturan bisnis + transaksi) → Web App & API (`doGet` + fungsi `api_*` yang dipanggil dari HTML) |
| `index.html` | SATU file frontend: HTML + CSS + JS (semua tab, semua modal) |
| `ImporDataLegacy.gs` | Skrip migrasi sekali-jalan dari data Excel lama — boleh dihapus setelah dipakai |

**Kenapa satu file besar, bukan modular:** permintaan eksplisit pemilik proyek supaya gampang tempel-copy ke Apps Script Editor tanpa perlu setup build tool. Kalau melanjutkan proyek ini, JANGAN pecah jadi banyak file kecil kecuali diminta ulang — itu mengubah cara deploy yang sudah disepakati.

### 7.2 Lapisan kode di `Code.gs` (urutan dari bawah ke atas)

1. **Repository** (`Repo*`) — HANYA lapisan ini yang boleh sentuh `SpreadsheetApp` langsung. Semua akses kolom pakai nama header (`UtilSheet.ambilPetaHeader`), bukan posisi.
2. **Layanan** (`Layanan*`) — aturan bisnis, izin akses, transaksi. `LayananPenjadwalan` (ScheduleService) adalah SATU-SATUNYA tempat yang boleh mengubah `Weekends`/`Sessions`/`Assignments`/`Community_Assignments`.
3. **Web App & API** (`api_*` + `doGet`) — dipanggil dari `index.html` lewat `google.script.run`. Setiap fungsi `api_*` mengambil identitas pelaku dari `Session.getEffectiveUser()` di server (TIDAK PERNAH dari data yang dikirim client) — supaya tidak bisa dipalsukan.

### 7.3 Kontrak transaksi (WAJIB diikuti untuk semua penulisan data Weekend/Session/Assignment)

```
1. Ambil LockService.getScriptLock()  →  UtilKunci.denganKunciSkrip(fn)
2. Muat ulang data terbaru dari sheet
3. Cek nomor revisi (field `revisi` di Weekends) — kalau beda dari yang dikirim client, TOLAK (STALE_REVISION), jangan pernah menimpa
4. Jalankan ulang semua aturan WAJIB (BLOCK)
5. Kalau ada PERINGATAN (WARNING): hanya Admin yang boleh lanjut, wajib isi alasan override
6. Commit (tulis ke sheet) + naikkan nomor revisi
7. Catat ke Audit_Log
8. Lepas kunci (otomatis oleh UtilKunci)
```

Lihat `LayananPenjadwalan.tugaskanIndividu` sebagai contoh referensi paling lengkap.

### 7.4 Prinsip performa (WAJIB dipatuhi — sumber bug paling sering di proyek ini)

- **Baca tiap sheet SEKALI per request**, lalu bangun `Map`/filter di memori — JANGAN baca ulang sheet yang sama di dalam loop.
- Hindari pola "tulis lalu baca ulang untuk konfirmasi" (`buatRepoDasar_.buat()`/`.perbarui()` sudah diperbaiki untuk langsung mengembalikan objek yang baru ditulis, tanpa baca ulang — JANGAN kembalikan ke pola lama).
- Untuk operasi massal (>20 baris), SELALU bangun array di memori dan tulis sekali lewat `sheet.getRange(...).setValues(array)` — JANGAN `appendRow()` di dalam loop. Contoh referensi: `jalankanImporDataLegacy()`.
- Kalau menambah fitur baru yang menampilkan banyak data (daftar, laporan), audit dulu: apakah ada `ambilById`/`daftarBy*` yang dipanggil di dalam `.map()`/`.forEach()`? Kalau ya, ubah jadi bulk-read + lookup map.

### 7.5 Migrasi skema aditif

`pastikanSheetDenganHeader_` di `Code.gs` mendukung penambahan kolom baru ke sheet yang SUDAH ADA datanya: kalau header sheet saat ini adalah PREFIX dari skema baru (kolom lama semua cocok, cuma kurang di akhir), kolom baru otomatis ditambahkan tanpa menyentuh data lama. Kalau mau nambah kolom baru ke skema manapun, cukup tambahkan di akhir array `KONFIG.SKEMA.<NamaSheet>`, jalankan `jalankanSetupAwal()` lagi — aman, tidak menghapus apapun.

---

## 8. Data Referensi Legacy (untuk konteks, bukan untuk diubah sembarangan)

- **12 Wilayah geografis**: BRAYAT MINULYA, MARIA ASSUMPTA, MARIA BUNDA ALLAH, MARIA CARMEL, MARIA CORDIS, MARIA IMMACULATA, MARIA LOURDES, MARIA MATER DEI, MARIA MATER DOLOROSA, MARIA RATU, MARIA RATU ROSARI, MARIA TAK BERNODA
- **4 Wilayah spesial** (bukan geografis, untuk kelompok Paduan Suara luar): GRASIA, LUAR PAROKI, LAIN LAIN, BECANBO
- **34 Lingkungan** tersebar di 12 Wilayah geografis (lihat `DATA_STRUKTUR_WILAYAH_` di `ImporDataLegacy.gs` untuk pemetaan lengkap)
- **172 petugas** diimpor dari data legacy, semua field "terakhir bertugas" kosong di data asli (karena itu dihitung live sekarang, bukan disimpan statis)
- Ejaan Wilayah/Lingkungan di data asli TIDAK KONSISTEN (typo bertahun-tahun) — sudah dirapikan pakai aturan "ejaan yang paling banyak dipakai menang", didokumentasikan di `Usulan_Ejaan_Wilayah_Lingkungan.md`

---

## 9. Keputusan Terbuka & Celah Spesifikasi (WAJIB dibaca sebelum ubah aturan)

Dokumen spesifikasi awal (`Liturgy_Scheduling_System_Spec_v1_0`, 10 file markdown + 3 skema JSON) adalah rancangan arsitektur yang di-*approve* di awal proyek SEBELUM file Excel legacy diperiksa. Beberapa bagiannya sudah TIDAK dipakai lagi setelah VBA asli diperiksa:

- **BR-012** ("Paduan Suara lintas Wilayah", awalnya level WARNING) — dihapus total. Tidak ada bukti aturan ini di VBA asli; yang benar adalah BR-013 (BLOCK, bukan WARNING).
- Spesifikasi awal tidak punya entitas "Users" untuk permission — solusinya (stopgap, bukan solusi ideal) role disimpan sebagai baris `peran_pengguna:<email>` di sheet `Config` generik. Kalau proyek berkembang butuh manajemen user lebih serius, ini layak diganti dengan entitas Users sungguhan.
- Layout sheet `Jadwal` awalnya "belum diperiksa" — SUDAH diperiksa dan diimplementasikan persis (lihat bagian 4 & 6.1).

**Prinsip untuk siapapun yang melanjutkan:** kalau spesifikasi awal dan VBA/perilaku legacy bertentangan, **VBA/perilaku legacy menang**, kecuali pemilik proses paroki bilang lain secara eksplisit.

---

## 10. Riwayat Bug Signifikan (supaya tidak terulang)

| Bug | Akar masalah | Pelajaran |
|---|---|---|
| Impor 172 orang timeout/error | Satu panggilan Sheets API per orang per peran (~ribuan panggilan), kena batas 6 menit Apps Script | Selalu bulk-write untuk operasi massal |
| Tampilan daftar petugas/jadwal lambat | Fungsi baca (`api_daftarOrang`, dll) baca ulang sheet Wilayah/Lingkungan/Person_Roles per baris/orang, bukan sekali per request | Bulk-read + lookup map, bukan N+1 query |
| Tombol "Pilih" kadang tidak merespon / macet total | Jalur simpan (cek aturan bisnis) masih baca ulang sheet yang sama berkali-kali dalam satu pengecekan; ditambah pola "tulis lalu baca ulang" di level repository dasar | Konsolidasi pembacaan sheet per pengecekan; hapus pola baca-ulang-setelah-tulis |
| Sesi "Minggu Pagi" tercatat dobel | Fungsi buka/buat akhir pekan tidak dikunci (`LockService`) — klik dobel/cepat memicu race condition | SEMUA fungsi cek-lalu-buat pada data bersama WAJIB dikunci, tanpa kecuali |
| Modal "Kelola Peran" klik "berikan" tidak ada efek | Modal selalu tampilkan tombol "+berikan" tanpa cek status sebenarnya; backend diam-diam no-op kalau peran sudah ada | UI harus mencerminkan state sebenarnya, bukan asumsi; hindari silent no-op tanpa feedback |

---

## 11. Berkas Terkait

| Berkas | Keterangan |
|---|---|
| `Code.gs` | Server utama — tempel ke Apps Script Editor |
| `index.html` | Frontend — buat file HTML baru bernama persis `index`, tempel isinya |
| `ImporDataLegacy.gs` | Migrasi sekali-jalan, boleh dihapus setelah dipakai |
| `DESIGN.md` | Sistem desain visual (warna, tipografi, komponen) — baca sebelum ubah tampilan |
| `Usulan_Ejaan_Wilayah_Lingkungan.md` | Riwayat keputusan penamaan Wilayah/Lingkungan |
| `Master_Jadwal_Petugas_Liturgi_THE_HOLY_GRAIL_-_Lingkungan.xlsm` | File Excel/VBA asli (sumber kebenaran aturan bisnis) — SIMPAN, jangan hilang, jadi rujukan kalau ada keraguan aturan |
| `Liturgy_Scheduling_System_Spec_v1_0/` | Spesifikasi arsitektur awal (10 md + 3 json) — berguna untuk konteks desain data model, TAPI kalah prioritas dari VBA asli kalau bertentangan (lihat bagian 9) |

---

## 12. Cara Deploy (untuk developer baru)

1. Buka Google Sheets kosong → Extensions → Apps Script
2. Hapus isi `Code.gs` bawaan, tempel isi `Code.gs` dari proyek ini
3. Buat file HTML baru (ikon `+` di samping Files), beri nama **persis** `index`, tempel isi `index.html`
4. Di dropdown fungsi (atas editor), pilih `aturDiriSayaSebagaiAdmin` → Jalankan (Run) — sekali saja, ini membuat semua sheet + menjadikan diri sendiri Admin pertama
5. (Opsional, sekali saja) Tempel `ImporDataLegacy.gs` sebagai file baru, jalankan `jalankanImporDataLegacy` untuk isi data 172 petugas dari legacy
6. Deploy → New deployment → Web app → Execute as "Me", Who has access sesuai kebutuhan paroki
7. **PENTING**: pakai URL yang berakhiran `/exec` untuk pemakaian sehari-hari, BUKAN `/dev` (URL `/dev` adalah mode preview/pengembangan dan pernah jadi sumber kebingungan "aplikasi macet total")
8. Setiap kali `Code.gs`/`index.html` diubah, harus **Deploy → Manage deployments → edit → New version** supaya perubahan kepakai di URL `/exec`

---

## 13. Rencana Selanjutnya (belum dikerjakan, bukan bug)

- **Notifikasi email** — kirim email ke petugas saat dijadwalkan / pengingat H-1. Belum ada sama sekali.
- **Isi otomatis (auto-suggest banyak slot sekaligus)** — saat ini baru ada saran satu peran satu waktu (`LayananKonflik.saranLru`); belum ada tombol "isi otomatis satu akhir pekan penuh".
- Pertimbangkan entitas Users sungguhan kalau jumlah pengguna/kompleksitas izin bertambah (lihat catatan bagian 9).
