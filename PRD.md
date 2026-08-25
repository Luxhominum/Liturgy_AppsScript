# Product Requirement Document (PRD) — Sistem Penjadwalan Petugas Liturgi

**Versi:** 2.0 (Modern Cloud & Web Production)  
**Status:** In Production (Live di Firebase Hosting: [https://jadwal-liturgi.web.app](https://jadwal-liturgi.web.app))  
**Target Paroki:** Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali — Keuskupan Agung Semarang (KAS)  
**Stack Teknologi:** React 19 + TypeScript + Vite + Tailwind CSS + Firebase Firestore + Firebase Hosting  
**Bahasa Aplikasi:** Bahasa Indonesia (Resmi Liturgis Katolik)

---

## 1. Latar Belakang & Tujuan Proyek

Aplikasi Web Penjadwalan Petugas Liturgi dirancang untuk menggantikan pengelolaan manual berbasis spreadsheet dan VBA Excel lama (`Master_Jadwal_Petugas_Liturgi_THE_HOLY_GRAIL_-_Lingkungan.xlsm`). Sistem ini berfungsi sebagai **Pusat Kerja Kolaboratif Digital bagi Tim Liturgi Paroki** untuk menyusun, memvalidasi aturan liturgi, memantau rotasi pemerataan pelayanan, serta mendistribusikan warta jadwal resmi kepada seluruh umat dan pengurus lingkungan.

### 1.1 Masalah Utama yang Diselesaikan:
1. **Pencegahan Konflik Jadwal Otomatis**: Menghilangkan bentrok ganda antar sesi misa, bentrok wilayah Koor vs petugas perorangan, dan kelelahan petugas akibat bertugas berturut-turut.
2. **Pemerataan Pelayanan (Fair-Share Distribution)**: Memastikan seluruh 35 Lingkungan dan 172 Petugas Liturgi terdaftar mendapatkan giliran tugas secara proporsional.
3. **Standarisasi Dokumen & Komunikasi Cepat**: Menghasilkan lembar warta A4 resmi, poster grafis mading, format pesan WhatsApp 1-klik, dan ekspor data CSV.
4. **Integritas Data & Penguncian Resmi**: Mencegah perubahan tidak sengaja pada jadwal yang sudah diterbitkan (`FINAL`) melalui sistem kunci baca-saja dan pembukaan revisi tercatat.

---

## 2. Struktur Hak Akses & Peran Pengguna (2-Tier Auth Guard)

Sistem menerapkan pengamanan berlapis pada tingkat antarmuka dan rute URL:

| Peran (Role) | Hak Akses & Fitur | Keterangan |
|---|---|---|
| **ADMIN** | • Seluruh akses penuh: Studio Penjadwalan, Finalisasi, Buka Kunci Revisi.<br>• Kelola Master Data Petugas & Aturan Liturgi.<br>• **Eksklusif**: Dasbor Monitoring & Analisis Pemerataan Pelayanan. | Akun Tim Inti & Koordinator Liturgi Paroki |
| **SCHEDULER** | • Membuka kalender dan menyusun jadwal draf akhir pekan.<br>• Menugaskan dan melepas petugas (manual & auto-assign).<br>• Tidak dapat mengubah jadwal yang berstatus `FINAL` tanpa izin revisi. | Tim Penjadwal Bidang Liturgi |
| **VIEWER** | • Mode Baca-Saja (Read-Only): Beranda, Kalender Misa, Cek Tugas Mandiri.<br>• Mencetak lembar warta A4 dan menyalin teks WhatsApp.<br>• Dibatasi dari menu internal dan ditolak saat mencoba membuka URL monitoring. | Umat Paroki & Petugas Liturgi Umum |

---

## 3. Glosarium Entitas Liturgi

* **Wilayah**: 12 Wilayah Teritorial (Maria Assumpta, Maria Bunda Allah, Maria Carmel, Maria Cordis, Maria Immaculata, Maria Lourdes, Maria Mater Dei, Maria Mater Dolorosa, Maria Ratu, Maria Ratu Rosari, Maria Tak Bernoda, Brayat Minulya) + Wilayah Khusus.
* **Lingkungan**: 35 Komunitas Lingkungan di bawah naungan 12 Wilayah.
* **Petugas**: 172 Petugas Liturgi terverifikasi dengan kualifikasi peran masing-masing.
* **Akhir Pekan (Weekend)**: Unit penjadwalan liturgi (Sabtu Sore s.d. Minggu Sore).
* **Sesi Misa (Session)**:
  * **Sabtu Sore**: 17.00 WIB (1 Sesi)
  * **Minggu Pagi**: 07.00 WIB (1 Sesi)
  * **Minggu Sore / Misa Khusus**: 17.00 WIB
* **Peran Individu**: Organis (Kuota 1), Pemazmur (2), Lektor (3), Misdinar (6), Prodiakon (6).
* **Penugasan Komunitas**:
  * **Paduan Suara (Koor)**: 1 Wilayah / Lingkungan per sesi.
  * **Tata Tertib (Tatib)**: 1 Lingkungan per sesi misa.
  * **Hias Altar**: 1 Wilayah per 1 Akhir Pekan penuh.

---

## 4. Mesin Aturan Bisnis Liturgi (Liturgical Business Rules)

Sistem menerapkan validasi *pre-filtering* (penyaringan sebelum dipilih) dan *live conflict detection* (deteksi konflik real-time):

### Aturan Tingkat Mutlak (BLOCK & Auto-Purge):
* **BR-013 (Aturan Mutlak Koor)**:
  * Anggota dari Wilayah yang sedang bertugas Koor **otomatis dihilangkan total** dari daftar pilihan Lektor, Pemazmur, Misdinar, dan Prodiakon di seluruh sesi akhir pekan tersebut.
  * Jika Koor dipilih setelah petugas perorangan terpasang, sistem langsung melakukan **Instant Auto-Purge** (melepaskan petugas bentrok seketika dengan notifikasi transparan).
  * *Pengecualian*: Organis tetap diizinkan bertugas karena dispensasi keahlian khusus.
* **BR-020 (Kelayakan Kualifikasi)**: Petugas hanya dapat ditugaskan pada peran yang tercatat dalam data kualifikasinya.
* **BR-026 (Batas Kuota Peran)**: Jumlah petugas tidak boleh melebihi kuota maksimal per sesi.
* **BR-030 / BR-031 (Larangan Tugas Ganda Akhir Pekan)**: Petugas hanya boleh bertugas 1 kali dalam 1 akhir pekan (kecuali Organis).
* **BR-032 (Jeda 2 Pekan Berturut-turut)**: Petugas dilarang bertugas di 2 akhir pekan berturut-turut ($N-7$ atau $N+7$).
* **BR-041 (Aturan Tata Tertib)**: Lingkungan Tatib tidak boleh bentrok antar sesi dan wilayahnya tidak boleh sedang bertugas Koor di pekan yang sama.
* **BR-052 (Aturan Hias Altar)**: Hias Altar berlaku untuk 1 Wilayah per akhir pekan, mandiri dari sesi misa perorangan.

---

## 5. Fitur Utama Sistem

### 5.1 Studio Penjadwalan & Auto-Assign
* **Penyusunan 3-Gelombang**:
  1. *Gelombang 1*: Koor & Musik (Paduan Suara, Organis, Pemazmur).
  2. *Gelombang 2*: Sabda & Pelayan Altar (Lektor, Misdinar, Prodiakon).
  3. *Gelombang 3*: Komunitas (Tata Tertib per Sesi & Hias Altar per Pekan).
* **Auto-Assign Cerdas 1-Klik**: Mengisi otomatis seluruh formasi liturgi dengan menerapkan seluruh aturan rotasi dan riwayat penugasan terakhir (*Least Recently Used - LRU*).
* **Panel Notifikasi Dinamis Real-Time**: Menampilkan banner peringatan bentrok merah `🚨 N Konflik Liturgi Aktif` dengan tombol 1-klik `[🧹 Lepas Semua Petugas Konflik]`.
* **Inisialisasi Tanpa Modal (Zero-Modal Creation)**: Klik tanggal kalender mana saja untuk langsung membuat draf jadwal baru tanpa kendala popup otorisasi.

### 5.2 Siklus Hidup Jadwal & Penguncian Revisi
* **Alur Status**: `DRAFT (Revisi 1)` $\rightarrow$ Terisi 100% $\rightarrow$ **`FINAL` (Terkunci Read-Only)**.
* **Mode Revisi Aman**: Jadwal `FINAL` otomatis terkunci dari pengeditan. Admin dapat membuka kunci melalui tombol `[🔓 Buka Kunci untuk Revisi]` yang akan menaikkan nomor revisi resmi secara tercatat.

### 5.3 Modul Output Resmi & Komunikasi
* **Cetak Lembar Warta A4**: Format tabel resmi standar gereja dengan pemisahan tegas antara Banner Hias Altar Akhir Pekan dan kolom Tata Tertib per sesi.
* **Generator Pesan WhatsApp 1-Klik**: Format teks pengumuman rapi ber-emoji untuk dibagikan ke grup Tim Liturgi dan Pengurus Lingkungan.
* **Poster Grafis Mading**: Tampilan kartu visual modern berlatar gradien liturgis untuk mading digital / media sosial paroki.
* **Ekspor Data CSV**: Berkas data terstruktur untuk pencatatan arsip sekretariat paroki.

### 5.4 Dasbor Analisis Pemerataan Pelayanan (Fair-Share Analytics - Khusus Admin)
* **Rotasi Koor & Hias Altar (Wilayah)**: Visualisasi grafik batang frekuensi tugas per wilayah dan status keaktifan.
* **Matriks Tata Tertib (35 Lingkungan)**: Pemantauan giliran lingkungan untuk mendeteksi lingkungan yang belum bertugas (`0x`).
* **Beban Pelayanan 172 Petugas**: Tabel beban tugas perorangan (*Proporsional, Beban Tinggi $\ge 3x$, Tersedia/0x*) dengan filter peran dan pencarian instan.

### 5.5 Layanan Mandiri Umat (Cek Tugas Saya)
* Pencarian cepat nama petugas atau lingkungan dengan tata letak 2 kolom seimbang (*balanced negative space*).
* Dilengkapi *chip tag* pencarian instan dan kartu direktori statistik pelayanan altar paroki.

---

## 6. Model Data Firestore (NoSQL Schema)

Sistem menggunakan koleksi Firestore dengan pembaruan real-time:

### Koleksi `weekends`:
* `id` (`string`): Format `w-YYYY-MM-DD` (contoh: `w-2026-08-02`).
* `tanggal_acuan` (`string`): Tanggal acuan hari Minggu.
* `status` (`'DRAFT' | 'FINAL'`): Status publikasi.
* `revisi` (`number`): Nomor iterasi revisi resmi.
* `nama_kegiatan` (`string`): Judul hari minggu liturgi / nama misa khusus.
* `is_special` (`boolean`): Penanda misa khusus hari biasa.
* `sessions` (`Array<Session>`): Daftar sesi misa (Sabtu Sore, Minggu Pagi, dll).
* `assignments` (`Array<Assignment>`): Penugasan individu (`person_id`, `role_id`, `status`).
* `communityAssignments` (`Array<CommunityAssignment>`): Penugasan kelompok (`PADUAN_SUARA`, `TATIB`, `HIAS_ALTAR`).
* `createdAt` / `updatedAt` (`string`): Timestamp ISO.
