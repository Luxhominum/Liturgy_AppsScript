/**
 * ImporDataLegacy.gs
 *
 * Skrip impor SEKALI JALAN untuk memindahkan data dari file Excel lama
 * (Master_Jadwal_Petugas_Liturgi_THE_HOLY_GRAIL_-_Lingkungan.xlsm) ke sistem
 * baru. Berisi 12 Wilayah, 34 Lingkungan, dan 172 petugas.
 *
 * Ejaan Wilayah/Lingkungan sudah dirapikan (dipilih ejaan yang paling
 * banyak dipakai di data asli, sesuai arahan Anda). Nama 172 petugas TIDAK
 * diubah sama sekali dari data asli.
 *
 * PERFORMA: data ditulis sekaligus (bulk write), bukan satu-satu, supaya
 * tidak kena batas waktu 6 menit Apps Script. Untuk 172 orang biasanya
 * selesai dalam hitungan detik.
 *
 * CARA PAKAI:
 *  1. Pastikan Code.gs dan index.html sudah terpasang, dan
 *     'aturDiriSayaSebagaiAdmin' sudah pernah dijalankan.
 *  2. Tempel file ini sebagai file .gs baru (nama bebas, misal ImporDataLegacy).
 *  3. Jalankan fungsi 'jalankanImporDataLegacy' SATU KALI dari editor.
 *  4. Setelah sukses dan sudah dicek datanya benar, file ini BOLEH DIHAPUS
 *     (data yang sudah masuk ke sheet tidak akan ikut terhapus).
 *
 * Aman dijalankan berkali-kali: Wilayah/Lingkungan/Orang yang namanya sudah
 * ada tidak akan dibuat dobel.
 */

var DATA_STRUKTUR_WILAYAH_ = {
  'BRAYAT MINULYA': ['AGNES', 'MATEUS', 'THOMAS AQUINO'],
  'MARIA ASSUMPTA': ['AGATHA', 'AGUSTINUS', 'PETRUS'],
  'MARIA BUNDA ALLAH': ['BONAVENTURA', 'CYRILUS'],
  'MARIA CARMEL': ['BERNADETA', 'FRANSISKUS', 'YUSUP'],
  'MARIA CORDIS': ['ANTONIUS', 'LAURENTIUS'],
  'MARIA IMMACULATA': ['ANDREAS', 'FRANSISCUS XAVERIUS', 'YAKOBUS'],
  'MARIA LOURDES': ['IGNATIUS', 'NASARETH', 'THERESIA'],
  'MARIA MATER DEI': ['CAECILIA', 'MARTINUS'],
  'MARIA MATER DOLOROSA': ['BLASIUS', 'MARKUS', 'PAULUS'],
  'MARIA RATU': ['TIMOTIUS', 'TITUS', 'YOHANES'],
  'MARIA RATU ROSARI': ['DIDIMUS', 'LUKAS', 'STEFANUS'],
  'MARIA TAK BERNODA': ['BARNABAS', 'FLORENTINUS', 'HYPOLITUS', 'YUSTINUS'],
  // Wilayah spesial (bukan wilayah geografis) untuk kelompok Paduan Suara
  // dari luar susunan Wilayah biasa -- tidak punya Lingkungan.
  'GRASIA': [],
  'LUAR PAROKI': [],
  'LAIN LAIN': [],
  'BECANBO': [],
};

var DATA_PETUGAS_LEGACY_ = [
  { nama: 'Adrianus Justine Widisamula', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Agatha Anjani Kinasih Rastri', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'PAULUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Agatha Efa Adelia', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Agnes Christianawati', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Agustina Nunik Rumiyati', wilayah: 'MARIA BUNDA ALLAH', lingkungan: 'BONAVENTURA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Agustinus Ali Murtapa', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Albertus Sutrisno Adi', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Alfonsius Hega', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Aloysius Gonzaga Markus Parna Suwito', wilayah: 'MARIA IMMACULATA', lingkungan: 'ANDREAS', misdinar: false, prodiakon: true, lektor: false, mazmur: true, organis: false },
  { nama: 'Amelia Pramono', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'MARKUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Andita Ayu Putri', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGATHA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Andrea Ni Made', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Angela Ayu Ditiani', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Angela Dinda Permatasari', wilayah: 'MARIA CARMEL', lingkungan: 'FRANSISKUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Anindita Kirana Danarto', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Antonia Cheryl Setya Wijaya', wilayah: 'MARIA ASSUMPTA', lingkungan: 'PETRUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Areetha Christabel', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Artalita Permata Kumala Dewi', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Atanasius Davin', wilayah: 'MARIA RATU', lingkungan: 'YOHANES', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Aurea Anindya Hayu', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Aurelia Sri Subekti', wilayah: 'MARIA IMMACULATA', lingkungan: 'YAKOBUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Aurellia Vania Cantika', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'B.Prasanna Yefta Muliaari', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Benedictus Octavio Nugroho Putra', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Benedictus Rendra Kristyatama', wilayah: 'MARIA LOURDES', lingkungan: 'THERESIA', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Bernadeta Devika Aruna Kalyani', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Bernadette Calya Ashadewi Krisdianto', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Boni Fasio Bhre', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'PAULUS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Bonifasius Esa Mahesa', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Bony Facio Bandung', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Brigita Arum Kinanti', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Brigitta Ivana Bellvania Ayundira Breezceani', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Brigitta Mawar Suci Airy', wilayah: 'MARIA MATER DEI', lingkungan: 'MARTINUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Cantika Arashel Yovela', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Carolina Kusuma Jati', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Carolina Yuliastri Chintya Lisa Wijayanti', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Caroline Devina', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Caroline Devina Setyomega', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Carolus Titan', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Cecilia Nadine Irsa Safira', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Chatarina Retnasari Setyaningrum', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Chatarina Sri Rejeki', wilayah: 'MARIA RATU', lingkungan: 'YOHANES', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Chrispina Bimasthi Tunjung Widiarthi', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Christina Tri Restuti', wilayah: 'MARIA BUNDA ALLAH', lingkungan: 'CYRILUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Cisilia Sri Handayani', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Clairine Darma Atmaja', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Clara Aprilya Arsita', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Cornelia Palmasari Ariesta Putri', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Cristina Sri Pujiati', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Dominicus Heri Sukamto', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Elisabet Putri Purnama Sari', wilayah: 'MARIA MATER DEI', lingkungan: 'MARTINUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Elisabeth Nathania Audrey Mintarso', wilayah: 'MARIA LOURDES', lingkungan: 'THERESIA', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Elizabeth Julietta', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Elizabeth Nunuk Yusmiyanti', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Evy Fenny Veronica', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Faustina Angelina Callysta', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Faustina Nindita Kumalasrani', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Fellicia Christabel', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Fidelis Christa Florin Darmawan', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Florentina Dwi Heni Kusni Rahayu', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Fransisca Evangelista Pradanti Sudibyo', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Fransisca Fajar Suryatiningsih', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'PAULUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Fransisca Hayu Probohastuti', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Fransisca Imanuela Putri Cristiani', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Fransisca Metta', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Fransiscus Jati Prasetyo', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Fransiska Cinta Prasandriastuti', wilayah: 'MARIA TAK BERNODA', lingkungan: 'BARNABAS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Fransiska Daryanti', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Fransiska Novi Wulandari', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Fx. Krisna Catur Wibowo', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Fx.Widoyono', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Gabriella Dira Alvina', wilayah: 'MARIA LOURDES', lingkungan: 'NASARETH', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Galih Widya', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Gaudentia Sophie Adiratna Kusumo', wilayah: 'MARIA ASSUMPTA', lingkungan: 'PETRUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Gemma Gayatri Hayuningthyas', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Genoveva Anindya Putri Purnomo', wilayah: 'BRAYAT MINULYA', lingkungan: 'AGNES', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Genoveva Calista', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Georgius Sri Mulyono', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Geradus Budi Santosa', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Gerard Athurdino', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Gisela Aninda', wilayah: 'MARIA CARMEL', lingkungan: 'FRANSISKUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Grahita Intan', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Gregorie De Gracela', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Gregorius Pasca Laksono', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Helena Almaira Paskah Ayu Nugraheni', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Hellen Lunar Wicaksana', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Henrico Fajar Kristiarji Wibowo', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Hilarius Haryo Tutuko', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Ignatius Tris Santosa', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Imanuel Moses', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'MARKUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Irine Prasasti Umboro', wilayah: 'MARIA TAK BERNODA', lingkungan: 'BARNABAS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Irwanda Wahyu Untari', wilayah: 'MARIA TAK BERNODA', lingkungan: 'HYPOLITUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Istiani Valencia', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Jecinta Mayang Mulia S', wilayah: 'MARIA TAK BERNODA', lingkungan: 'YUSTINUS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Karina Isti Juita Purnamasari', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Katharina Calista', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Kerensa Sotya', wilayah: 'MARIA IMMACULATA', lingkungan: 'FRANSISCUS XAVERIUS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Kerensa Sotya Belinda', wilayah: 'MARIA IMMACULATA', lingkungan: 'FRANSISCUS XAVERIUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Kiara Kita Maria', wilayah: 'MARIA MATER DEI', lingkungan: 'MARTINUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Kiara Lizzie Kalika Padmono', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: true },
  { nama: 'Kristian Aji', wilayah: 'MARIA IMMACULATA', lingkungan: 'ANDREAS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Kristiana Sekar Trihapsari', wilayah: 'MARIA RATU', lingkungan: 'YOHANES', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Leonardus Adi Purnomo', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Lorensius Atang Sudibyo', wilayah: 'MARIA MATER DEI', lingkungan: 'MARTINUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Lucia Dewi Sulistyorini', wilayah: 'MARIA IMMACULATA', lingkungan: 'YAKOBUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Lusia Etik Ena Marsuti', wilayah: 'MARIA ASSUMPTA', lingkungan: 'PETRUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Marcelinus Kalyana Rafael', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Marcellina Natharasmi Christabel', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Margaretha Geovanny Garnierita Putri Yudha', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Maria Agni Cahya Wulan', wilayah: 'MARIA LOURDES', lingkungan: 'NASARETH', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Maria Benedikta Wahyu Ariyanti', wilayah: 'MARIA IMMACULATA', lingkungan: 'ANDREAS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Maria Christabella Aluma Nugroho', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Maria Emanuela Puspitasari Dian Nagari', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGUSTINUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Maria Imaculata Puspitasrani', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Maria Magdalena Sri Puji Lestari', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Maria Theresia Laksmita Oktaviani', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'PAULUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Maria Widya Wardhani', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGATHA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Martha Calista Nirmalasrani', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Martinus Suko Widhiasto', wilayah: 'MARIA MATER DEI', lingkungan: 'MARTINUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Mathilda Arsenia Tiaruli Boru Simarmata', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Maura Duniastuti', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Mikael Sukirno', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Nadia Talitha Wibowo', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Paskalia Dwi Astuti', wilayah: 'MARIA CARMEL', lingkungan: 'BERNADETA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Patricia Kurnia Damayanti', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Paulus Mudadi', wilayah: 'MARIA CORDIS', lingkungan: 'ANTONIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Pertus Novi Setiarto', wilayah: 'MARIA ASSUMPTA', lingkungan: 'PETRUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Petrus Sujud Sularso', wilayah: 'MARIA CORDIS', lingkungan: 'ANTONIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Pratama Putra', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Radite Hanung Putra Erisandi', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGATHA', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Raditya Ananta Nugraha', wilayah: 'MARIA RATU', lingkungan: 'TITUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Rafael Widayat Darmojo', wilayah: 'MARIA CORDIS', lingkungan: 'LAURENTIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Rafel Prameyarta', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Raina Ani Pusparani', wilayah: 'BRAYAT MINULYA', lingkungan: 'AGNES', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Renatta Putri Kusuma', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Retnaningsih', wilayah: 'MARIA BUNDA ALLAH', lingkungan: 'BONAVENTURA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Scholastica Sitha Wardhani', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Sesilia Kartika Purwaningrum', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Sheila Anggraini', wilayah: 'MARIA MATER DOLOROSA', lingkungan: 'BLASIUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Shifa Early', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Sisilia Calista Natania', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Sisilia Mary Nuriko Tresia Sucipto', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Sixsiati Dewi Sri Wahyuni', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Skolastika Febriana Anggraini', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Skolastika Satya Rani', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Skolastika Satya Rini', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: true, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Stevanus Partono Slamet Widodo', wilayah: 'MARIA RATU', lingkungan: 'YOHANES', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Teresa Arini Agastya Puteri', wilayah: 'MARIA MATER DEI', lingkungan: 'CAECILIA', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Teresia Amanda Yektiadi', wilayah: 'MARIA ASSUMPTA', lingkungan: 'AGATHA', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Theodorustiro Jati Pamungkas', wilayah: 'MARIA TAK BERNODA', lingkungan: 'HYPOLITUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Theresia Paramitha Nugroho', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Valerie Queen De Chrissine', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Varrel Cahya', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Veronika Argadei Amelia Putri', wilayah: 'MARIA RATU ROSARI', lingkungan: 'DIDIMUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Veronika Hartanti', wilayah: 'MARIA TAK BERNODA', lingkungan: 'HYPOLITUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Veronika Puspa Dewi', wilayah: 'MARIA RATU', lingkungan: 'YOHANES', misdinar: true, prodiakon: false, lektor: true, mazmur: true, organis: true },
  { nama: 'Vincent Cahya Buana', wilayah: 'MARIA RATU', lingkungan: 'TIMOTIUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Vincentius Joshua', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Vincentius Nathaniko Ardani Yudhapaska', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Vinsensia Ira Ana Restuni', wilayah: 'MARIA LOURDES', lingkungan: 'NASARETH', misdinar: false, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Virgilius Omega', wilayah: 'MARIA RATU ROSARI', lingkungan: 'STEFANUS', misdinar: true, prodiakon: false, lektor: false, mazmur: false, organis: false },
  { nama: 'Wellyanto Adi Nugroho', wilayah: 'MARIA RATU ROSARI', lingkungan: 'LUKAS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Wilhelimina Angela', wilayah: 'MARIA TAK BERNODA', lingkungan: 'FLORENTINUS', misdinar: true, prodiakon: false, lektor: true, mazmur: false, organis: false },
  { nama: 'Y. Antosa Dwi Budiaryo Kristianto', wilayah: 'MARIA RATU ROSARI', lingkungan: 'DIDIMUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Y. Aris Setyawan', wilayah: 'MARIA IMMACULATA', lingkungan: 'ANDREAS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: true },
  { nama: 'Yohanes Bayu Widhi Saputro', wilayah: 'MARIA TAK BERNODA', lingkungan: 'HYPOLITUS', misdinar: false, prodiakon: false, lektor: true, mazmur: true, organis: false },
  { nama: 'Yohanes Eka Lasda Yunawan', wilayah: 'MARIA RATU ROSARI', lingkungan: 'DIDIMUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Yohanes Sigit Tri Cahyadi', wilayah: 'MARIA IMMACULATA', lingkungan: 'ANDREAS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Yulita Kristiani', wilayah: 'BRAYAT MINULYA', lingkungan: 'THOMAS AQUINO', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Yulius Bangkit', wilayah: 'BRAYAT MINULYA', lingkungan: 'MATEUS', misdinar: false, prodiakon: false, lektor: false, mazmur: true, organis: false },
  { nama: 'Yustina Nugraheti', wilayah: 'MARIA CARMEL', lingkungan: 'YUSUP', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
  { nama: 'Yustinus Aris Setyawan', wilayah: 'MARIA IMMACULATA', lingkungan: 'YAKOBUS', misdinar: false, prodiakon: true, lektor: false, mazmur: false, organis: false },
];


function jalankanImporDataLegacy() {
  var waktuMulai = new Date().getTime();
  var pelakuId = Session.getEffectiveUser().getEmail();
  LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]); // dicek SEKALI saja di awal, bukan berulang per orang

  var ringkasan = { wilayahDibuat: 0, lingkunganDibuat: 0, orangDibuat: 0, orangDilewati: 0, peranDiberikan: 0 };

  // --- 1. Wilayah & Lingkungan: sama seperti Petugas di bawah, dibangun
  //     dulu di memori lalu ditulis sekaligus (bulk write) -- bukan satu
  //     per satu -- supaya total waktu tidak membengkak.
  var petaWilayahId = {};
  var petaLingkunganId = {};

  var wilayahSekarang = RepoWilayah.daftar(true);
  wilayahSekarang.forEach(function (w) { petaWilayahId[w.nama] = w.wilayah_id; });
  var lingkunganSekarang = RepoLingkungan.daftar(true);
  lingkunganSekarang.forEach(function (l) {
    var namaWilayahnya = wilayahSekarang.filter(function (w) { return w.wilayah_id === l.wilayah_id; })[0];
    if (namaWilayahnya) petaLingkunganId[namaWilayahnya.nama + '::' + l.nama] = l.lingkungan_id;
  });

  var barisWilayahBaru = []; // urutan kolom: wilayah_id, nama, aktif
  var barisLingkunganBaru = []; // urutan kolom: lingkungan_id, nama, wilayah_id, aktif

  Object.keys(DATA_STRUKTUR_WILAYAH_).forEach(function (namaWilayah) {
    var wilayahId = petaWilayahId[namaWilayah];
    if (!wilayahId) {
      wilayahId = UtilId.idBaru('wilayah_id');
      barisWilayahBaru.push([wilayahId, namaWilayah, true]);
      petaWilayahId[namaWilayah] = wilayahId;
      ringkasan.wilayahDibuat++;
    }

    DATA_STRUKTUR_WILAYAH_[namaWilayah].forEach(function (namaLingkungan) {
      var kunci = namaWilayah + '::' + namaLingkungan;
      if (!petaLingkunganId[kunci]) {
        var lingkunganId = UtilId.idBaru('lingkungan_id');
        barisLingkunganBaru.push([lingkunganId, namaLingkungan, wilayahId, true]);
        petaLingkunganId[kunci] = lingkunganId;
        ringkasan.lingkunganDibuat++;
      }
    });
  });

  if (barisWilayahBaru.length > 0) {
    var sheetWilayah = UtilSheet.ambilSheet(KONFIG.NAMA_SHEET.WILAYAH);
    sheetWilayah.getRange(sheetWilayah.getLastRow() + 1, 1, barisWilayahBaru.length, barisWilayahBaru[0].length).setValues(barisWilayahBaru);
  }
  if (barisLingkunganBaru.length > 0) {
    var sheetLingkungan = UtilSheet.ambilSheet(KONFIG.NAMA_SHEET.LINGKUNGAN);
    sheetLingkungan.getRange(sheetLingkungan.getLastRow() + 1, 1, barisLingkunganBaru.length, barisLingkunganBaru[0].length).setValues(barisLingkunganBaru);
  }

  // --- 2. Peran (role_id Organis/Pemazmur/Lektor/Misdinar/Prodiakon dari setup awal) ---
  var peranOrganis = RepoKonfigPeran.ambilByNama('Organis');
  var peranPemazmur = RepoKonfigPeran.ambilByNama('Pemazmur');
  var peranLektor = RepoKonfigPeran.ambilByNama('Lektor');
  var peranMisdinar = RepoKonfigPeran.ambilByNama('Misdinar');
  var peranProdiakon = RepoKonfigPeran.ambilByNama('Prodiakon');

  // --- 3. Petugas: SEMUA baris disusun dulu di memori, BARU ditulis sekali
  //     lewat satu perintah setValues() per sheet -- bukan satu-satu.
  //     Cara lama (satu appendRow + satu cek izin + satu catatan audit
  //     PER orang PER peran) butuh ribuan kali bolak-balik ke Google
  //     Sheets untuk 172 orang, sampai kena batas waktu 6 menit Apps
  //     Script. Cara ini hanya butuh sekitar 2 kali tulis total.
  var orangSudahAda = {};
  RepoOrang.daftar(true).forEach(function (o) { orangSudahAda[o.nama] = true; });

  var sekarang = new Date();
  var barisOrangBaru = [];  // urutan kolom: person_id, nama, lingkungan_id, aktif, dibuat_pada, diubah_pada, dibuat_oleh, diubah_oleh
  var barisPeranBaru = [];  // urutan kolom: person_role_id, person_id, role_id, aktif

  function tambahPeranJikaYa(personId, adaPeran, peran) {
    if (adaPeran && peran) {
      barisPeranBaru.push([UtilId.idBaru('person_role_id'), personId, peran.role_id, true]);
      ringkasan.peranDiberikan++;
    }
  }

  DATA_PETUGAS_LEGACY_.forEach(function (data) {
    if (orangSudahAda[data.nama]) { ringkasan.orangDilewati++; return; }

    var lingkunganId = petaLingkunganId[data.wilayah + '::' + data.lingkungan];
    if (!lingkunganId) {
      Logger.log('LEWATI (Wilayah/Lingkungan tidak ditemukan): ' + data.nama + ' -- ' + data.wilayah + ' / ' + data.lingkungan);
      ringkasan.orangDilewati++;
      return;
    }

    var personId = UtilId.idBaru('person_id');
    barisOrangBaru.push([personId, data.nama, lingkunganId, true, sekarang, sekarang, pelakuId, pelakuId]);
    ringkasan.orangDibuat++;

    tambahPeranJikaYa(personId, data.organis, peranOrganis);
    tambahPeranJikaYa(personId, data.mazmur, peranPemazmur);
    tambahPeranJikaYa(personId, data.lektor, peranLektor);
    tambahPeranJikaYa(personId, data.misdinar, peranMisdinar);
    tambahPeranJikaYa(personId, data.prodiakon, peranProdiakon);
  });

  // --- 4. Tulis sekaligus (bulk write) ---
  if (barisOrangBaru.length > 0) {
    var sheetOrang = UtilSheet.ambilSheet(KONFIG.NAMA_SHEET.ORANG);
    sheetOrang.getRange(sheetOrang.getLastRow() + 1, 1, barisOrangBaru.length, barisOrangBaru[0].length).setValues(barisOrangBaru);
  }
  if (barisPeranBaru.length > 0) {
    var sheetPeran = UtilSheet.ambilSheet(KONFIG.NAMA_SHEET.PERAN_ORANG);
    sheetPeran.getRange(sheetPeran.getLastRow() + 1, 1, barisPeranBaru.length, barisPeranBaru[0].length).setValues(barisPeranBaru);
  }

  // Satu catatan audit ringkasan (bukan satu-satu per orang, supaya cepat).
  RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'IMPOR_DATA_LEGACY', jenisEntitas: 'Person', entitasId: '(massal)', nilaiBaru: ringkasan });

  var durasiDetik = Math.round((new Date().getTime() - waktuMulai) / 1000);
  Logger.log('SELESAI IMPOR dalam ' + durasiDetik + ' detik: ' + JSON.stringify(ringkasan));
  return ringkasan;
}