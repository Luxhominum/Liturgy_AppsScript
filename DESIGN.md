# DESIGN.md — Sistem Desain Aplikasi

Dokumen ini adalah pedoman visual dan interaksi untuk `index.html`. Bahasa desainnya mengadaptasi sistem warm editorial SaaS yang diberikan pemilik proyek ke kebutuhan aplikasi operasional paroki. Ini bukan landing page pemasaran: kejelasan jadwal, status, izin, dan kecepatan kerja tetap menjadi prioritas.

## 1. Arah desain

- **Hangat dan manusiawi:** permukaan krem hangat, bahasa Indonesia yang langsung, dan bentuk yang bersahabat.
- **Tegas tetapi tenang:** tinta hijau gelap menjadi warna utama; lime hanya menandai pilihan atau fokus penting.
- **Berguna, bukan dekoratif:** setiap panel membantu memilih minggu, mengisi petugas, memeriksa kelengkapan, atau mengambil tindakan.
- **Karakter editorial:** judul memakai sans-serif condensed; isi dan kontrol memakai Inter.
- **Satu aksi dominan:** tombol utama berwarna tinta hijau. Aksi sekunder transparan. Aksi berbahaya merah.

Jangan menyalin logo, aset, foto, atau copy milik situs referensi. Aplikasi ini memakai identitas dan istilah paroki sendiri.

## 2. Token utama

Token sumber didefinisikan di `#refactor-design-system` pada `index.html`.

| Token | Nilai | Fungsi |
|---|---:|---|
| `--color-ink` | `#022C12` | teks utama, tombol primer, panel status |
| `--color-ink-soft` | `#6F8371` | teks sekunder |
| `--color-surface` | `#F6F4E8` | latar halaman |
| `--color-surface-muted` | `#EAE8DD` | pemisah/panel sekunder |
| `--color-accent` | `#F1F97E` | tab aktif, fokus, status pilihan |
| `--color-white` | `#FFFFFF` | kartu dan input |
| `--color-blue-soft` | `#CFE8FF` | status terpenuhi/sukses |
| `--color-lilac-soft` | `#CBB7DB` | status lengkap/sesi khusus |
| `--color-danger` | `#963F3A` | hapus, error, Sabtu Sore |

Alias lama seperti `--kertas`, `--hijau`, dan `--garis` tetap tersedia karena beberapa HTML yang dirender oleh JavaScript masih memakainya. Komponen baru harus memakai token `--color-*`, `--space-*`, dan `--radius-*`.

## 3. Tipografi

- Display: `Roboto Condensed`, weight 600–700.
- Body/UI: `Inter`, weight 400–700.
- Judul memakai line-height rapat (`1.05`) dan sentence case.
- Label form memakai ukuran kecil, weight 700, dan uppercase.
- Teks isi memakai line-height sekitar `1.55`.

Jangan menambah keluarga font ketiga.

## 4. Shell aplikasi

- Header sticky berada dalam container maksimum `76rem`.
- Brand di kiri, navigasi di tengah, identitas pengguna di kanan pada desktop.
- Di bawah `900px`, navigasi menjadi menu yang dibuka tombol **Menu**.
- Navigasi aktif memakai latar lime berbentuk pill, bukan underline.
- `main` memakai gutter responsif `clamp(1rem, 4vw, 3rem)`.
- Skip link harus menjadi elemen fokus pertama.

## 5. Workspace penjadwalan

Landing page default tetap **Input Jadwal**.

- Header workspace: eyebrow, judul, status revisi, tanggal Minggu, sesi, dan aksi Buka/Buat Jadwal.
- Tiga tahap kategori memakai pola tab yang sama dengan sistem referensi: jelas, ringkas, dapat dioperasikan dengan panah keyboard.
- Desktop `>=1024px`: kategori kiri, area kerja tengah, checklist status kanan.
- Mobile: kategori menjadi baris scroll horizontal; area kerja dan status ditumpuk.
- Panel status memakai latar hijau gelap agar kelengkapan mudah dipindai.
- Nama petugas tampil sebagai chip netral. Lime tidak dipakai untuk semua chip.

Kalender tetap tampilan sekunder. Mingguan memakai agenda pada layar kecil dan grid waktu pada desktop. Kalender bulanan tetap dapat di-scroll pada mobile, tidak boleh hilang/blank.

## 6. Komponen

### Tombol

- Tinggi minimum `44px`.
- Primer: hijau gelap, teks putih.
- Sekunder: transparan, border halus.
- Bahaya: merah.
- Hover mengangkat tombol `1px`; active kembali ke posisi awal.
- Focus memakai outline lime 2px dengan offset 3px.

### Form

- Semua input wajib memiliki label nyata; placeholder hanya contoh.
- Tinggi minimum `44px`, radius sekitar `10px`.
- Focus menampilkan border hijau dan ring lime.
- Error tampil dekat konteksnya dan diumumkan melalui `aria-live`.

### Kartu dan tabel

- Kartu: putih, border tipis, radius `16px`, tanpa shadow berat.
- Shadow mengambang hanya untuk menu mobile dan dialog.
- Tabel pada layar kecil boleh scroll horizontal di dalam kartu.

### Dialog

- Memakai `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, dan `aria-hidden` yang sinkron.
- Fokus berpindah ke kontrol pertama saat dibuka dan kembali ke pemicu saat ditutup.
- Tombol Escape menutup dialog aktif.

## 7. Responsif

Pendekatan mobile-first:

- `640px`: form workspace mulai memakai beberapa kolom.
- `768px`: padding bertambah dan toolbar kalender lebih lapang.
- `900px`: header desktop dan navigasi horizontal.
- `1024px`: workspace tiga kolom dan kalender grid penuh.

Semua target sentuh minimal `44 × 44px`. Jangan mengecilkan panel desktop sampai tidak terbaca; tumpuk atau jadikan scroll horizontal.

## 8. Aksesibilitas dan motion

- Satu `h1` per halaman.
- Gunakan landmark `header`, `nav`, `main`, `section`, dan dialog semantik.
- Tab mode dan kategori harus menyinkronkan `aria-selected`, `tabindex`, dan panel yang terlihat.
- Navigasi tab mendukung Arrow Left/Right, Home, dan End.
- Warna bukan satu-satunya sinyal; status juga menampilkan teks/angka/simbol.
- Hormati `prefers-reduced-motion`.
- Animasi hanya fade-and-rise singkat pada panel utama.

## 9. Kontrak implementasi

- Jangan ganti atau hapus `id` yang dipakai JavaScript tanpa memperbarui seluruh pemanggil dan pengujian.
- Jangan pecah frontend satu-file menjadi framework/multi-file tanpa persetujuan baru.
- Jangan menambah library UI/icon eksternal.
- Jangan mengubah logika aturan bisnis, izin, revision check, atau API ketika mengerjakan visual.
- Setiap refactor besar wajib diuji: syntax client/server, ID unik, inline handler, permission matrix, workspace Wave 1/2/3, kalender minggu/bulan, keyboard, dialog, dan browser live.
