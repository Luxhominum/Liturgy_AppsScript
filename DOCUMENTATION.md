# Dokumentasi Teknis Sistem Penjadwalan Petugas Liturgi

**Repositori:** Liturgy AppsScript & React Web App  
**Aplikasi Produksi:** [https://jadwal-liturgi.web.app](https://jadwal-liturgi.web.app)  
**Paroki:** Gereja Katolik Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali — Keuskupan Agung Semarang (KAS)

---

## 1. Arsitektur Proyek & Stack Teknologi

Aplikasi dibangun dengan arsitektur modern berbasis Single Page Application (SPA) yang terintegrasi dengan Firebase Cloud:

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND CLIENT (Vite + React 19)        │
│  • Routing: Hash-based Router (/#/jadwal, /#/cetak, dll)    │
│  • Styling: Tailwind CSS + Editorial Liturgical Palette     │
│  • Animations: Framer Motion Hardware Accelerated Micro-UI  │
│  • State: Real-Time Snapshot Sync with Firestore            │
└──────────────────────────────┬──────────────────────────────┘
                               │ (WebSockets & REST API)
┌──────────────────────────────▼──────────────────────────────┐
│                  FIREBASE CLOUD INFRASTRUCTURE              │
│  • Firebase Firestore: Real-Time NoSQL Database             │
│  • Firebase Hosting: Global CDN Edge Distribution           │
│  • Cloud Functions (Node.js): Background API & Sync Tasks   │
└─────────────────────────────────────────────────────────────┘
```

### Komponen Utama Stack:
* **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS, Lucide Icons, Framer Motion.
* **Database:** Google Cloud Firestore (NoSQL, realtime listeners via `onSnapshot`).
* **Hosting:** Firebase Hosting dengan SSL otomatis dan caching CDN.

---

## 2. Struktur Direktori Proyek

```
Liturgy_AppsScript/
├── PRD.md                         # Dokumen Kebutuhan Produk (PRD v2.0)
├── DOCUMENTATION.md               # Dokumentasi Teknis & Panduan Pengembang
├── AGENTS.md                      # Pedoman & Aturan Desain Anti-Slop
├── DESIGN.md                      # Desain Sistem Semantik & Tipografi
├── firebase.json                  # Konfigurasi Firebase Hosting & Firestore
├── firestore.rules                # Aturan Keamanan Database Firestore
├── package.json                   # Root package & deployment scripts
│
└── frontend/                      # Source Code Aplikasi Frontend
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── App.tsx                # Root App Shell & 2-Tier Route Guards
    │   ├── main.tsx               # Entry Point
    │   │
    │   ├── config/
    │   │   └── firebase.ts        # Inisialisasi Firebase SDK & Firestore
    │   │
    │   ├── data/
    │   │   ├── realOfficers.ts    # Master Data 172 Petugas Liturgi
    │   │   └── lingkunganWilayahMap.ts # Pemetaan 35 Lingkungan ke 12 Wilayah
    │   │
    │   ├── types/
    │   │   └── index.ts           # Definisi Tipe TypeScript Lengkap
    │   │
    │   ├── utils/
    │   │   ├── ruleValidator.ts   # Mesin Validasi Aturan Liturgi (BR-xxx)
    │   │   ├── autoAssignEngine.ts# Mesin Algoritma Auto-Assign 3-Gelombang
    │   │   └── liturgicalCalendar.ts # Kalender Penanggalan Liturgi & Warna Misa
    │   │
    │   ├── services/
    │   │   └── api.ts             # Direct Firestore Mutations & API Layer
    │   │
    │   └── components/
    │       ├── layout/            # Header, AppShell, UserProfilePopover
    │       ├── home/              # PublicLandingPage (Hero, Cek Tugas Mandiri)
    │       ├── calendar/          # CalendarView, PrintScheduleView
    │       ├── scheduling/        # SessionCard, StatusPanel, SelectOfficerModal
    │       ├── admin/             # AdminMonitoringTab, FairShareAnalyticsTab,
    │       │                      # ManageOfficersTab, RuleSettingsTab
    │       └── ui/                # Button, Card, Badge, Chip, Dialog, Input
```

---

## 3. Alur Logika Aturan Bisnis Liturgi (BR-Engine)

### A. Aturan Mutlak Koor (BR-013)
* **Pre-Filtering:** Saat Koor dari suatu Wilayah dipilih pada sesi manapun di akhir pekan tersebut, seluruh petugas (Lektor, Misdinar, Pemazmur, Prodiakon) yang berasal dari Wilayah tersebut otomatis dikeluarkan dari daftar kandidat yang dapat dipilih di `SelectOfficerModal.tsx`.
* **Instant Auto-Purge:** Jika Koor dipilih setelah petugas perorangan terpasang, fungsi `handleAssignCommunity` di `CalendarView.tsx` langsung mendeteksi petugas yang berasal dari Wilayah Koor tersebut dan melepaskannya (*auto-purge*) secara otomatis dari Firestore dengan pemberitahuan ringkas.
* **Dispensasi Organis:** Peran Organis dikecualikan dari larangan ini karena memerlukan keahlian musik khusus.

### B. Validasi Kualifikasi & Kuota (BR-020 & BR-026)
* Mengacu pada array `peranList` atau boolean flag di `REAL_OFFICERS_DATA`.
* Kuota standar per sesi:
  * Organis: 1
  * Pemazmur: 2
  * Lektor: 3
  * Misdinar: 6
  * Prodiakon: 6

### C. Jeda Penugasan (BR-031 & BR-032)
* **BR-031**: Petugas tidak boleh bertugas di lebih dari 1 sesi dalam 1 akhir pekan yang sama (kecuali Organis).
* **BR-032**: Petugas tidak boleh bertugas di akhir pekan berturut-turut ($N-7$ atau $N+7$).

---

## 4. Siklus Hidup Penjadwalan & Penguncian Revisi

```
[ Tanggal Diklik di Kalender ]
               │
               ▼
   [ Inisialisasi DRAFT (Revisi 1) ] ◄──────────────┐
               │                                    │
               ▼                                    │
 [ Pengisian Petugas (Manual / Auto-Assign) ]       │
               │                                    │
               ▼                                    │
    [ Validasi 100% Terpenuhi ]                     │
               │                                    │
               ▼                                    │
   [ Tombol Finalisasi Diklik ]                     │
               │                                    │
               ▼                                    │
   [ Simpan Status: 'FINAL' ]                       │
               │                                    │
               ▼                                    │
   [ 🔒 Mode Terkunci (Read-Only) ]                 │
               │                                    │
               └────► [ 🔓 Buka Kunci untuk Revisi ] (Revisi + 1)
```

---

## 5. Dasbor Analisis Pemerataan (Fair-Share Analytics)

Ditempatkan secara terisolasi di menu Admin (`FairShareAnalyticsTab.tsx`):
1. **Analisis Komunitas**: Menghitung frekuensi tugas Koor per Wilayah, Hias Altar per Wilayah, dan Tata Tertib per 35 Lingkungan.
2. **Analisis Beban Petugas**: Mengelompokkan 172 petugas ke dalam kategori *Beban Tinggi ($\ge 3x$)*, *Proporsional ($1-2x$)*, dan *Tersedia / Belum Bertugas ($0x$)*.
3. **Keamanan 2-Tier**: Rute dilindungi di `Header.tsx` dan `App.tsx`, hanya dapat dibuka oleh pengguna dengan role `ADMIN`.

---

## 6. Panduan Menjalankan & Membangun Proyek (Local Dev & Deploy)

### Menjalankan di Lingkungan Lokal:
```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Install dependensi
npm install

# 3. Jalankan server pengembangan lokal (Vite)
npm run dev
# Buka di browser: http://localhost:5173
```

### Membangun Versi Produksi & Deploy ke Firebase:
```bash
# 1. Build aset frontend (TypeScript check & Vite bundling)
npm run build

# 2. Deploy ke Firebase Hosting
npx firebase-tools deploy --only hosting
```

---

## 7. Pemeliharaan & Data Master

* **Menambah/Mengubah Petugas:** Edit berkas `frontend/src/data/realOfficers.ts`.
* **Menambah/Mengubah Pemetaan Lingkungan:** Edit berkas `frontend/src/data/lingkunganWilayahMap.ts`.
* **Mengubah Aturan Liturgi:** Edit berkas `frontend/src/utils/ruleValidator.ts`.
