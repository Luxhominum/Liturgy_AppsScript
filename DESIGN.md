# DESIGN.md — Sistem Desain Visual

Dokumen ini menjelaskan bahasa visual `index.html`. Baca dulu sebelum mengubah tampilan apapun — tujuannya supaya perubahan berikutnya tetap konsisten, bukan mengumpulkan gaya yang berbeda-beda tiap kali disentuh.

**Prinsip nomor satu: jangan sentuh JS.** Semua `id="..."` dan class yang dipakai `getElementById`/`classList`/`querySelectorAll` di dalam `<script>` harus tetap ada persis sama. Redesain sejauh ini SELALU dikerjakan sebagai perubahan `<style>` + struktur HTML statis saja (header, nav, wrapper section) — logika JS yang membangun konten dinamis (kartu sesi, modal, tabel) tidak pernah diubah. Kalau mau redesain ulang, pertahankan disiplin ini.

---

## 1. Konsep

**Hangat & personal, cocok komunitas gereja** — bukan aplikasi kantor generik. Tapi ini tools kerja harian (dipakai berulang oleh relawan, sering di HP), jadi kejelasan/kecepatan baca tetap prioritas di atas dekorasi.

Sumber inspirasi: dunia liturgi itu sendiri — kertas misa/buletin paroki, kayu mimbar, warna liturgi (hijau = masa biasa, paling sering dipakai sepanjang tahun; merah/marun = liturgi merah), kuningan lilin altar. **Sengaja dihindari**: kombinasi krem+terracotta generik yang jadi default banyak AI design tool.

**Elemen ciri khas (dipakai secukupnya, TIDAK di semua tempat):**
- Sel kalender (`.sel-kalender`) berbentuk lengkung di bagian atas — meniru jendela/pintu gereja (`border-radius: 40px 40px 10px 10px`)
- Garis emas tipis di bawah header (masthead), seperti garis pembatas di buletin paroki cetak
- Ikon kecil (emoji Unicode, bukan icon font/SVG library) di depan tiap tab navigasi, lewat CSS `::before` — BUKAN elemen HTML nested (lihat bagian 4 kenapa ini penting)

Kartu (`.kartu`, `.kartu-sesi`), tabel, modal, form — SEMUA tetap bentuk persegi/rounded-rectangle biasa. Jangan tambah lengkungan/dekorasi di situ; boldness cukup di satu-dua tempat saja (kalender + header), sisanya tenang dan fungsional.

---

## 2. Token Warna

Semua didefinisikan sebagai CSS custom properties di `:root`. JANGAN pakai hex code langsung di aturan baru — selalu lewat `var(--nama-token)`.

| Token | Hex | Dipakai untuk |
|---|---|---|
| `--kertas` | `#F5EEDD` | Latar halaman (body) |
| `--kertas-kartu` | `#FCF8EE` | Latar kartu — sedikit lebih terang dari halaman |
| `--kayu` | `#3A2A1D` | Judul (h1/h2/h3), teks utama, latar header |
| `--tinta` | `#4A3B2E` | Teks isi/body |
| `--hijau` | `#4F6B49` | Aksen utama — tombol primer, tab aktif, badge "terpenuhi/final" |
| `--hijau-tua` | `#3B5236` | Hover/tekan untuk elemen hijau |
| `--emas` | `#B07E2E` | Aksen kedua — link/tautan, fokus input, badge "draft" |
| `--emas-terang` | `#D9A94A` | Highlight lebih terang (garis masthead, ring fokus) |
| `--marun` | `#8A3A34` | Bahaya/hapus, badge "belum lengkap", pesan error |
| `--marun-muda` | `#F3E3E0` | Latar untuk badge/pesan bertema marun |
| `--garis` | `#E2D3B3` | Border input, kartu, pembatas umum |
| `--garis-lembut` | `#EEE3CB` | Border lebih halus (dalam kartu, antar baris tabel) |
| `--abu-hangat` | `#8A7A65` | Teks sekunder/keterangan kecil |

**Jangan** tambah warna baru di luar palet ini tanpa alasan kuat. Kalau butuh varian baru (misal badge status baru), turunkan dari salah satu token di atas (versi lebih muda/tua), jangan pilih hex baru sembarangan.

---

## 3. Tipografi

Dimuat dari Google Fonts (`<link>` di `<head>`, sudah ada fallback sistem kalau offline):

- **Judul** (`h1, h2, h3`): `"Lora", Georgia, serif` — serif hangat, nuansa buku misa/undangan, dipakai untuk semua heading termasuk judul kartu dan judul modal
- **Isi/UI** (`body` default): `"Source Sans 3", -apple-system, "Segoe UI", Roboto, Arial, sans-serif` — sans humanis, jelas dibaca di layar kecil, dukungan diakritik Indonesia bagus

Jangan tambah font ketiga. Kalau butuh varian berat (bold/italic), pakai `font-weight`/`font-style` dari dua keluarga ini saja.

---

## 4. Komponen

### Tombol
- Default (`button` tanpa class tambahan): latar `--hijau`, teks putih — aksi utama (Simpan, Pilih, Buka Akhir Pekan)
- `.sekunder`: transparan, border `--garis`, teks `--kayu` — aksi kedua (Tutup, navigasi bulan)
- `.bahaya`: latar `--marun` — aksi merusak (Buka Kembali dari Final)
- `.tautan`: tanpa latar, teks `--emas`, jadi `--marun` saat di-hover — aksi ringan inline (+ tambah, hapus ×, kelola peran)
- Semua tombol minimal tinggi 40px (target sentuh nyaman di HP); di dalam `.baris-peran`/sel tabel, tombol dibuat lebih ringkas (32px) lewat aturan `.baris-peran button, td button`

### Badge status (`.lencana`)
Warna badge dipilih bermakna, bukan sekadar warna beda-beda: `draft` = emas pudar (lilin belum menyala), `final`/`terpenuhi` = hijau (mantap, selesai), `belum` = marun (butuh perhatian).

### Navigasi (`nav`)
Gaya underline-tab (garis bawah saat aktif), BUKAN tombol berisi warna. Ikon di depan tiap label lewat CSS `::before` per `data-tab`, contoh:
```css
nav button[data-tab="kalender"]::before { content: "\1F4C6"; }
```
**Kenapa `::before`, bukan `<span>` icon di dalam HTML:** klik handler JS (`document.getElementById('navigasi').addEventListener('click', ...)`) mengecek `e.target.tagName !== 'BUTTON'`. Kalau ikon berupa elemen anak (`<span>`), klik tepat di ikon akan membuat `e.target` jadi `<span>` itu, bukan `<button>`, dan tab switch GAGAL diam-diam. Pseudo-element aman karena tidak punya event target sendiri, klik selalu dianggap mengenai elemen induknya.

### Kartu (`.kartu`, `.kartu-sesi`)
Rounded-rectangle biasa (`border-radius: 12px`/`10px`), latar `--kertas-kartu`, shadow halus (`--bayang`). Tidak ada lengkungan khusus di sini — lihat bagian 1.

### Modal (`.modal-latar`, `.modal-kotak`)
Latar gelap semi-transparan pakai `--kayu` (bukan hitam polos, supaya tetap hangat), kotak modal shadow lebih tegas (`--bayang-modal`).

### Form (`input`, `select`, `textarea`)
Border `--garis`, fokus jadi ring `--emas-terang` + border `--emas`. Checkbox/radio pakai `accent-color: var(--hijau)` supaya tidak nongol biru default browser.

---

## 5. Responsif

Satu breakpoint: `@media (max-width: 600px)`.

- Padding kartu & main dikurangi
- Baris navigasi bulan (`.nav-bulan`) dipaksa tetap satu baris (`flex-wrap: nowrap`) dengan label tombol dipendekkan lewat `.teks-nav-bulan { display: none; }` — di desktop tulisan lengkap "« Bulan Sebelumnya", di HP jadi "« Sebelumnya" saja
- Nav tab bisa di-scroll horizontal (`overflow-x: auto`) kalau tidak muat, scrollbar disembunyikan tapi tetap bisa discroll (swipe di HP)

**Kalau nambah komponen baru yang berpotensi sempit di HP:** selalu cek dulu di lebar 390px (ukuran HP umum) sebelum dianggap selesai, bukan cuma di desktop.

---

## 6. Cara Uji Visual (kalau environment mendukung)

Proyek ini pernah diuji visual pakai **Playwright** (headless browser) dengan cara:
1. Salin `index.html`, sisipkan `<script>` mock yang meniru `google.script.run` (karena `google.script.run` asli cuma jalan di dalam Apps Script, tidak bisa dibuka langsung sebagai file HTML biasa) dan isi data contoh untuk tiap fungsi `api_*`
2. Render pakai Playwright di viewport desktop (1200×900) dan mobile (390×844)
3. Screenshot tiap tab + minimal satu modal, periksa manual

Cara ini berhasil menemukan 2 bug nyata sebelum dikirim ke pengguna (teks tombol nav hilang saat hover karena warna teks = warna latar hover; baris navigasi bulan pecah 3 baris di HP). **Sangat disarankan diulang setiap kali ada perubahan `<style>` yang cukup besar** — jangan asumsi CSS benar hanya dari membaca kode.

---

## 7. Yang TIDAK boleh dilakukan tanpa diskusi ulang

- Jangan ganti struktur "satu file `index.html`" jadi multi-file/framework (React, dll) — ini keputusan sadar demi kemudahan deploy tempel-langsung di Apps Script (lihat `PRD.md` bagian 7.1)
- Jangan hapus/ganti nama `id`/class yang dipakai JS tanpa update semua pemanggilnya di `<script>` sekaligus
- Jangan tambah dependency eksternal baru (icon library, CSS framework) — palet warna & tipografi saat ini sudah cukup, dan setiap dependency baru menambah risiko gagal-muat kalau offline/koneksi lambat (relawan paroki, bukan tim IT, jadi harus tahan-banting)
