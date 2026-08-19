/**
 * ====================================================================
 * SISTEM PENJADWALAN PETUGAS LITURGI — Code.gs
 * ====================================================================
 * Ini adalah SATU-SATUNYA file kode server. Cukup salin (copy-paste)
 * seluruh isi file ini ke dalam Apps Script Editor (Code.gs bawaan),
 * lalu buat file HTML bernama "index" dan salin isi index.html ke
 * sana. Setelah itu jalankan fungsi "aturDiriSayaSebagaiAdmin" satu
 * kali dari editor (pilih fungsi ini di dropdown, lalu klik Jalankan),
 * kemudian jalankan "jalankanSetupAwal" satu kali untuk membuat semua
 * sheet yang dibutuhkan. Setelah itu, publish sebagai Web App (Deploy
 * > New deployment > Web app) untuk mendapatkan tautan aplikasinya.
 *
 * Struktur file ini (dari atas ke bawah):
 *   1. KONFIGURASI      — nama-nama sheet, kolom, dan konstanta
 *   2. UTILITAS         — pembuat ID, akses sheet, dan pengunci (lock)
 *   3. SETUP AWAL       — membuat sheet backend otomatis
 *   4. REPOSITORY       — lapisan baca/tulis data mentah per entitas
 *   5. LAYANAN (SERVICE)— aturan bisnis, izin akses, dan transaksi
 *   6. WEB APP & API    — jembatan antara halaman web dan server
 * ====================================================================
 */


/* ====================================================================
 * 1. KONFIGURASI
 * Semua nama sheet dan susunan kolom didefinisikan di sini saja, agar
 * tidak ada bagian lain yang menebak-nebak posisi kolom secara manual.
 * ==================================================================== */

var KONFIG = {

  NAMA_SHEET: {
    ORANG: 'People',
    WILAYAH: 'Wilayah',
    LINGKUNGAN: 'Lingkungan',
    PERAN_ORANG: 'Person_Roles',
    KONFIG_PERAN: 'Role_Config',
    AKHIR_PEKAN: 'Weekends',
    SESI: 'Sessions',
    PENUGASAN: 'Assignments',
    PENUGASAN_KOMUNITAS: 'Community_Assignments',
    STATISTIK_ORANG: 'Person_Stats',
    RINGKASAN_SESI: 'Session_Summary',
    KONFIG_ATURAN: 'Rule_Config',
    LOG_AUDIT: 'Audit_Log',
    JADWAL: 'Jadwal',
    PENGATURAN_SISTEM: 'Config'
  },

  // Susunan kolom tiap sheet, sesuai urutan saat sheet pertama kali
  // dibuat. Pembacaan data SELALU berdasarkan nama kolom (header),
  // bukan posisi/urutan kolom — jadi aman walau kolom dipindah manual.
  SKEMA: {
    People: ['person_id', 'nama', 'lingkungan_id', 'aktif', 'dibuat_pada', 'diubah_pada', 'dibuat_oleh', 'diubah_oleh'],
    Wilayah: ['wilayah_id', 'nama', 'aktif'],
    Lingkungan: ['lingkungan_id', 'nama', 'wilayah_id', 'aktif'],
    Person_Roles: ['person_role_id', 'person_id', 'role_id', 'aktif'],
    Role_Config: ['role_id', 'nama_peran', 'jumlah_dibutuhkan', 'jumlah_maksimal', 'aktif', 'urutan'],
    Weekends: ['weekend_id', 'tanggal_acuan', 'status', 'revisi', 'dibuat_pada', 'diubah_pada', 'difinalkan_pada', 'difinalkan_oleh'],
    Sessions: ['session_id', 'weekend_id', 'jenis_sesi', 'tanggal_sesi', 'status', 'nama_khusus'],
    Assignments: ['assignment_id', 'weekend_id', 'session_id', 'person_id', 'role_id', 'status', 'dibuat_pada', 'dibuat_oleh', 'diubah_pada', 'diubah_oleh'],
    Community_Assignments: ['community_assignment_id', 'weekend_id', 'session_id', 'jenis_penugasan', 'wilayah_id', 'lingkungan_id', 'alasan_override', 'dibuat_pada', 'dibuat_oleh', 'status'],
    Person_Stats: ['person_id', 'last_assigned_at', 'assignment_count', 'updated_at'],
    Session_Summary: ['summary_id', 'weekend_id', 'session_id', 'filled_count', 'required_count', 'all_complete', 'updated_at'],
    Rule_Config: ['rule_id', 'nama_aturan', 'aktif', 'tingkat', 'konfigurasi_json', 'versi_kebijakan', 'diubah_pada', 'diubah_oleh'],
    Audit_Log: ['audit_id', 'waktu', 'pelaku_id', 'aksi', 'jenis_entitas', 'entitas_id', 'nilai_lama_json', 'nilai_baru_json', 'rule_id', 'alasan_override', 'versi_kebijakan'],
    Jadwal: null, // sheet laporan, layout aslinya belum diperiksa — lihat catatan di ReportService di bawah
    Config: ['kunci', 'nilai']
  },

  JENIS_SESI: { SABTU_SORE: 'SABTU_SORE', MINGGU_PAGI: 'MINGGU_PAGI', MINGGU_SORE: 'MINGGU_SORE', KHUSUS: 'KHUSUS' },
  LABEL_SESI: { SABTU_SORE: 'Sabtu Sore', MINGGU_PAGI: 'Minggu Pagi', MINGGU_SORE: 'Minggu Sore' },

  JENIS_PENUGASAN_KOMUNITAS: { PADUAN_SUARA: 'CHOIR', TATIB: 'TATIB', HIAS_ALTAR: 'HIAS_ALTAR' },
  LABEL_PENUGASAN_KOMUNITAS: { CHOIR: 'Paduan Suara', TATIB: 'Tatib', HIAS_ALTAR: 'Hias Altar' },

  STATUS_AKHIR_PEKAN: { DRAFT: 'DRAFT', LENGKAP: 'COMPLETE', FINAL: 'FINAL' },
  STATUS_PENUGASAN: { AKTIF: 'ACTIVE', DIHAPUS: 'REMOVED' },
  TINGKAT_ATURAN: { WAJIB: 'BLOCK', PERINGATAN: 'WARNING', OTOMATIS: 'AUTO' },

  PERAN_DEFAULT: { Organis: 1, Pemazmur: 2, Lektor: 3, Misdinar: 6, Prodiakon: 6 },

  IZIN: { ADMIN: 'ADMIN', PENJADWAL: 'SCHEDULER', PELIHAT: 'VIEWER' },

  ATURAN_BISNIS: {
    BR_020_KELAYAKAN_PERAN: 'BR-020',
    BR_026_KAPASITAS_KUOTA: 'BR-026',
    BR_030_DUPLIKAT_SESI: 'BR-030',
    BR_031_DUPLIKAT_AKHIR_PEKAN: 'BR-031',
    BR_032_LAYANAN_BERTURUT: 'BR-032',
    BR_013_BLACKLIST_PADUAN_SUARA: 'BR-013',
    BR_041_KONFLIK_TATIB: 'BR-041',
    BR_052_TUMPANG_TINDIH_PS_HIAS_ALTAR: 'BR-052',
    BR_034_TERAKHIR_BERTUGAS: 'BR-034',
    BR_027_SARAN_ORGANIS_LRU: 'BR-027',
    BR_051_HIAS_ALTAR_TINGKAT_AKHIR_PEKAN: 'BR-051',
    BR_062_STATUS_PROGRES: 'BR-062'
  },

  AWALAN_ID: {
    person_id: 'PER', wilayah_id: 'WIL', lingkungan_id: 'LKG', person_role_id: 'PRL',
    role_id: 'ROL', weekend_id: 'WKD', session_id: 'SES', assignment_id: 'ASG',
    community_assignment_id: 'CAS', summary_id: 'SUM', rule_id: 'RUL', audit_id: 'AUD'
  }
};


/* ====================================================================
 * 2. UTILITAS
 * ==================================================================== */

// --- Pembuat ID unik dan stabil (nama orang TIDAK PERNAH dipakai sebagai kunci data) ---
var UtilId = (function () {
  function idBaru(namaKolomId) {
    var awalan = KONFIG.AWALAN_ID[namaKolomId];
    if (!awalan) throw new Error('UtilId: tidak ada awalan ID untuk "' + namaKolomId + '"');
    var waktu = new Date().getTime();
    var acak = Math.floor(Math.random() * 9000) + 1000;
    return awalan + '-' + waktu + '-' + acak;
  }
  return { idBaru: idBaru };
})();

// --- Telemetri ringan ke Cloud Logging (tidak menambah write ke Spreadsheet) ---
var UtilPerforma = (function () {
  var konteks_ = null;

  function mulai(nama) {
    konteks_ = { nama: nama || 'api', mulai: Date.now(), langkah: [] };
    return konteks_;
  }

  function catat(nama, mulaiMs, metadata) {
    var entri = Object.assign({ nama: nama, durasiMs: Date.now() - mulaiMs }, metadata || {});
    if (konteks_) konteks_.langkah.push(entri);
    console.log('[PERF_STEP] ' + JSON.stringify(entri));
    return entri.durasiMs;
  }

  function selesai(metadata) {
    if (!konteks_) return;
    var hasil = Object.assign({
      nama: konteks_.nama,
      durasiTotalMs: Date.now() - konteks_.mulai,
      langkah: konteks_.langkah
    }, metadata || {});
    console.log('[PERF_API] ' + JSON.stringify(hasil));
    konteks_ = null;
  }

  return { mulai: mulai, catat: catat, selesai: selesai };
})();

// --- Cache lintas eksekusi untuk snapshot baca yang aman diulang ---
var UtilCache = (function () {
  var TTL_DEFAULT_DETIK = 600;
  // Potongan 25 ribu karakter tetap aman di bawah batas 100 KB/key,
  // termasuk bila nama mengandung karakter Unicode multi-byte.
  var UKURAN_POTONGAN = 25000;
  var AWALAN = 'liturgy:v1:';
  var versiPending_ = {};
  var readModelKotorPending_ = false;

  function properti_() { return PropertiesService.getScriptProperties(); }
  function cache_() { return CacheService.getScriptCache(); }

  function versi(grup) {
    if (versiPending_[grup]) return versiPending_[grup];
    return properti_().getProperty('cache_version:' + grup) || '1';
  }

  function invalidasi(grup) {
    versiPending_[grup] = String(Date.now()) + '-' + Math.floor(Math.random() * 100000);
  }

  function tandaiReadModelKotor() { readModelKotorPending_ = true; }
  function bersihkanReadModelKotor() { readModelKotorPending_ = false; }

  /** Seluruh invalidasi dalam satu API dikirim sebagai satu Properties call. */
  function flushInvalidasi() {
    var grupList = Object.keys(versiPending_);
    if (grupList.length === 0 && !readModelKotorPending_) return;
    var perubahan = {};
    grupList.forEach(function (grup) { perubahan['cache_version:' + grup] = versiPending_[grup]; });
    if (readModelKotorPending_) perubahan.performance_read_models_dirty = '1';
    properti_().setProperties(perubahan, false);
    versiPending_ = {};
    readModelKotorPending_ = false;
  }

  function kunci_(grup, identitas) {
    return AWALAN + grup + ':' + versi(grup) + ':' + String(identitas || 'default');
  }

  function ambilJson_(kunci) {
    var c = cache_();
    var metaMentah = c.get(kunci + ':meta');
    if (!metaMentah) return null;
    var meta;
    try { meta = JSON.parse(metaMentah); } catch (e) { return null; }
    if (!meta || !meta.jumlahPotongan) return null;
    var daftarKunci = [];
    for (var i = 0; i < meta.jumlahPotongan; i++) daftarKunci.push(kunci + ':p' + i);
    var potongan = c.getAll(daftarKunci);
    var json = '';
    for (var p = 0; p < daftarKunci.length; p++) {
      if (!Object.prototype.hasOwnProperty.call(potongan, daftarKunci[p])) return null;
      json += potongan[daftarKunci[p]];
    }
    try { return JSON.parse(json); } catch (e2) { return null; }
  }

  function simpanJson_(kunci, nilai, ttlDetik) {
    var json = JSON.stringify(buatAmanUntukClient_(nilai));
    var jumlah = Math.max(1, Math.ceil(json.length / UKURAN_POTONGAN));
    var semua = {};
    semua[kunci + ':meta'] = JSON.stringify({ jumlahPotongan: jumlah });
    for (var i = 0; i < jumlah; i++) semua[kunci + ':p' + i] = json.slice(i * UKURAN_POTONGAN, (i + 1) * UKURAN_POTONGAN);
    cache_().putAll(semua, ttlDetik || TTL_DEFAULT_DETIK);
  }

  function ambilAtauHitung(grup, identitas, hitung, ttlDetik) {
    var mulai = Date.now();
    var kunci = kunci_(grup, identitas);
    var cached = ambilJson_(kunci);
    if (cached !== null) {
      UtilPerforma.catat('cache_hit', mulai, { grup: grup, identitas: identitas });
      return cached;
    }
    var hasil = hitung();
    try { simpanJson_(kunci, hasil, ttlDetik); }
    catch (e) { console.warn('[CACHE] gagal menyimpan ' + grup + '/' + identitas + ': ' + e.message); }
    UtilPerforma.catat('cache_miss', mulai, { grup: grup, identitas: identitas });
    return hasil;
  }

  function invalidasiUntukSheet(namaSheet) {
    var master = [KONFIG.NAMA_SHEET.ORANG, KONFIG.NAMA_SHEET.WILAYAH, KONFIG.NAMA_SHEET.LINGKUNGAN, KONFIG.NAMA_SHEET.PERAN_ORANG, KONFIG.NAMA_SHEET.KONFIG_PERAN];
    if (master.indexOf(namaSheet) !== -1) {
      invalidasi('master');
      invalidasi('candidates');
    }
    if ([KONFIG.NAMA_SHEET.PENUGASAN, KONFIG.NAMA_SHEET.SESI, KONFIG.NAMA_SHEET.KONFIG_PERAN].indexOf(namaSheet) !== -1) {
      tandaiReadModelKotor();
    }
    if (namaSheet === KONFIG.NAMA_SHEET.PENUGASAN) {
      invalidasi('schedule');
      invalidasi('candidates');
    }
    if ([KONFIG.NAMA_SHEET.PENUGASAN_KOMUNITAS, KONFIG.NAMA_SHEET.AKHIR_PEKAN, KONFIG.NAMA_SHEET.SESI].indexOf(namaSheet) !== -1) {
      invalidasi('schedule');
    }
    if (namaSheet === KONFIG.NAMA_SHEET.KONFIG_PERAN) invalidasi('schedule');
    if (namaSheet === KONFIG.NAMA_SHEET.KONFIG_ATURAN) invalidasi('policy');
  }

  return {
    versi: versi, invalidasi: invalidasi, flushInvalidasi: flushInvalidasi,
    tandaiReadModelKotor: tandaiReadModelKotor, bersihkanReadModelKotor: bersihkanReadModelKotor,
    invalidasiUntukSheet: invalidasiUntukSheet, ambilAtauHitung: ambilAtauHitung
  };
})();

// --- Akses sheet berbasis NAMA KOLOM (bukan posisi kolom), supaya aman walau kolom dipindah manual ---
var UtilSheet = (function () {
  // Cache hanya hidup selama SATU eksekusi Apps Script. Ini aman untuk
  // konsistensi transaksi, tetapi mencegah sheet yang sama dibaca berulang
  // kali oleh beberapa repository/service dalam satu panggilan API.
  var cacheBarisEksekusi_ = {};
  var cacheSheetEksekusi_ = {};
  var spreadsheetEksekusi_ = null;

  function ambilSpreadsheet() {
    if (!spreadsheetEksekusi_) spreadsheetEksekusi_ = SpreadsheetApp.getActiveSpreadsheet();
    return spreadsheetEksekusi_;
  }

  function invalidasiCacheSheet_(namaSheet) {
    delete cacheBarisEksekusi_[namaSheet];
    UtilCache.invalidasiUntukSheet(namaSheet);
  }

  function ambilSheet(namaSheet) {
    if (cacheSheetEksekusi_[namaSheet]) return cacheSheetEksekusi_[namaSheet];
    var sheet = ambilSpreadsheet().getSheetByName(namaSheet);
    if (!sheet) throw new Error('UtilSheet: sheet "' + namaSheet + '" belum ada. Jalankan setup awal dulu.');
    cacheSheetEksekusi_[namaSheet] = sheet;
    return sheet;
  }

  function ambilPetaHeader(sheet) {
    var kolomTerakhir = sheet.getLastColumn();
    if (kolomTerakhir === 0) return {};
    var baris = sheet.getRange(1, 1, 1, kolomTerakhir).getValues()[0];
    var peta = {};
    for (var i = 0; i < baris.length; i++) { if (baris[i]) peta[baris[i]] = i + 1; }
    return peta;
  }

  function ambilSemuaBaris(namaSheet) {
    if (Object.prototype.hasOwnProperty.call(cacheBarisEksekusi_, namaSheet)) {
      return cacheBarisEksekusi_[namaSheet];
    }

    var sheet = ambilSheet(namaSheet);
    var barisTerakhir = sheet.getLastRow();
    var kolomTerakhir = sheet.getLastColumn();

    if (barisTerakhir < 2 || kolomTerakhir === 0) {
      cacheBarisEksekusi_[namaSheet] = [];
      return cacheBarisEksekusi_[namaSheet];
    }

    // Optimasi: baca header + seluruh data dalam SATU panggilan getRange/getValues.
    // Sebelumnya header dan data dibaca terpisah, sehingga setiap pemanggilan
    // ambilSemuaBaris() membutuhkan lebih banyak round-trip ke Google Sheets.
    var mulaiBaca = Date.now();
    var semuaNilai = sheet.getRange(1, 1, barisTerakhir, kolomTerakhir).getValues();
    UtilPerforma.catat('sheet_read', mulaiBaca, { sheet: namaSheet, jumlahBaris: barisTerakhir - 1 });
    var hasil = ubahNilaiMenjadiBaris_(semuaNilai[0], semuaNilai.slice(1), 2);
    cacheBarisEksekusi_[namaSheet] = hasil;
    return hasil;
  }

  /** Mengubah matriks nilai menjadi object berbasis nama header. */
  function ubahNilaiMenjadiBaris_(header, daftarNilai, nomorBarisAwal) {

    var peta = {};
    for (var i = 0; i < header.length; i++) {
      if (header[i]) peta[header[i]] = i;
    }

    var headerList = Object.keys(peta);
    var hasil = [];

    for (var r = 0; r < daftarNilai.length; r++) {
      var baris = daftarNilai[r];
      var kosong = baris.every(function (sel) { return sel === '' || sel === null; });
      if (kosong) continue;

      var obj = {};
      for (var h = 0; h < headerList.length; h++) {
        var nama = headerList[h];
        obj[nama] = baris[peta[nama]];
      }

      obj.__baris = nomorBarisAwal + r;
      hasil.push(obj);
    }

    return hasil;
  }

  /**
   * Membaca maksimal N baris data TERAKHIR tanpa mengambil seluruh sheet.
   * Cocok untuk log append-only seperti Audit_Log.
   */
  function ambilBarisTerakhir(namaSheet, jumlahMaksimum) {
    var maksimum = Math.max(0, Number(jumlahMaksimum) || 0);
    if (maksimum === 0) return [];

    if (Object.prototype.hasOwnProperty.call(cacheBarisEksekusi_, namaSheet)) {
      return cacheBarisEksekusi_[namaSheet].slice(-maksimum);
    }

    var sheet = ambilSheet(namaSheet);
    var barisTerakhir = sheet.getLastRow();
    var kolomTerakhir = sheet.getLastColumn();
    if (barisTerakhir < 2 || kolomTerakhir === 0) return [];

    var jumlah = Math.min(maksimum, barisTerakhir - 1);
    var barisMulai = barisTerakhir - jumlah + 1;
    var mulaiBaca = Date.now();
    var header = sheet.getRange(1, 1, 1, kolomTerakhir).getValues()[0];
    var nilai = sheet.getRange(barisMulai, 1, jumlah, kolomTerakhir).getValues();
    console.log('[PERF] baca terbaru ' + namaSheet + ': ' + (Date.now() - mulaiBaca) + ' ms; ' + jumlah + ' baris');
    return ubahNilaiMenjadiBaris_(header, nilai, barisMulai);
  }

  /**
   * Membaca satu halaman dari bagian TERBARU sebuah sheet append-only.
   * offset=0 berarti halaman terbaru; offset berikutnya bergerak mundur
   * tanpa perlu mengirim seluruh isi sheet ke browser.
   */
  function ambilHalamanDariAkhir(namaSheet, jumlahMaksimum, offset) {
    var jumlahDiminta = Math.max(1, Number(jumlahMaksimum) || 50);
    var jumlahLewati = Math.max(0, Number(offset) || 0);

    if (Object.prototype.hasOwnProperty.call(cacheBarisEksekusi_, namaSheet)) {
      var cache = cacheBarisEksekusi_[namaSheet];
      var akhirCache = Math.max(0, cache.length - jumlahLewati);
      var awalCache = Math.max(0, akhirCache - jumlahDiminta);
      var halamanCache = cache.slice(awalCache, akhirCache);
      return {
        baris: halamanCache,
        total: cache.length,
        adaLebih: awalCache > 0,
        offsetBerikutnya: jumlahLewati + halamanCache.length
      };
    }

    var sheet = ambilSheet(namaSheet);
    var barisTerakhir = sheet.getLastRow();
    var kolomTerakhir = sheet.getLastColumn();
    var total = Math.max(0, barisTerakhir - 1);
    if (total === 0 || kolomTerakhir === 0 || jumlahLewati >= total) {
      return { baris: [], total: total, adaLebih: false, offsetBerikutnya: jumlahLewati };
    }

    var jumlah = Math.min(jumlahDiminta, total - jumlahLewati);
    var barisAkhir = barisTerakhir - jumlahLewati;
    var barisMulai = barisAkhir - jumlah + 1;
    var mulaiBaca = Date.now();
    var header = sheet.getRange(1, 1, 1, kolomTerakhir).getValues()[0];
    var nilai = sheet.getRange(barisMulai, 1, jumlah, kolomTerakhir).getValues();
    console.log('[PERF] baca halaman ' + namaSheet + ': ' + (Date.now() - mulaiBaca) + ' ms; ' + jumlah + ' baris; offset ' + jumlahLewati);
    return {
      baris: ubahNilaiMenjadiBaris_(header, nilai, barisMulai),
      total: total,
      adaLebih: jumlahLewati + jumlah < total,
      offsetBerikutnya: jumlahLewati + jumlah
    };
  }

  function cariBarisById(namaSheet, namaKolomId, nilaiId) {
    var semua = ambilSemuaBaris(namaSheet);
    for (var i = 0; i < semua.length; i++) { if (semua[i][namaKolomId] === nilaiId) return semua[i]; }
    return null;
  }

  function tambahBaris(namaSheet, objekBaris) {
    var sheet = ambilSheet(namaSheet);
    var skema = KONFIG.SKEMA[namaSheet];
    if (!skema) throw new Error('UtilSheet.tambahBaris: tidak ada skema untuk "' + namaSheet + '"');
    var nilai = skema.map(function (kolom) {
      return Object.prototype.hasOwnProperty.call(objekBaris, kolom) ? objekBaris[kolom] : '';
    });
    var mulaiTulis = Date.now();
    sheet.appendRow(nilai);
    UtilPerforma.catat('sheet_append', mulaiTulis, { sheet: namaSheet, jumlahBaris: 1 });
    invalidasiCacheSheet_(namaSheet);
    return objekBaris;
  }

  /** Menambah banyak baris dalam SATU operasi setValues. */
  function tambahBanyakBaris(namaSheet, daftarObjekBaris) {
    var daftar = daftarObjekBaris || [];
    if (daftar.length === 0) return [];
    var sheet = ambilSheet(namaSheet);
    var skema = KONFIG.SKEMA[namaSheet];
    if (!skema) throw new Error('UtilSheet.tambahBanyakBaris: tidak ada skema untuk "' + namaSheet + '"');
    var nilai = daftar.map(function (objekBaris) {
      return skema.map(function (kolom) {
        return Object.prototype.hasOwnProperty.call(objekBaris, kolom) ? objekBaris[kolom] : '';
      });
    });
    var mulaiTulis = Date.now();
    sheet.getRange(sheet.getLastRow() + 1, 1, nilai.length, skema.length).setValues(nilai);
    UtilPerforma.catat('sheet_batch_append', mulaiTulis, { sheet: namaSheet, jumlahBaris: nilai.length });
    invalidasiCacheSheet_(namaSheet);
    return daftar;
  }

  function perbaruiBarisById(namaSheet, namaKolomId, nilaiId, perubahan) {
    var sheet = ambilSheet(namaSheet);
    var peta = ambilPetaHeader(sheet);
    var existing = cariBarisById(namaSheet, namaKolomId, nilaiId);
    if (!existing) throw new Error('UtilSheet.perbaruiBarisById: baris tidak ditemukan di "' + namaSheet + '" untuk ' + namaKolomId + ' = ' + nilaiId);
    return perbaruiBarisPadaNomor_(sheet, peta, existing.__baris, perubahan, namaSheet);
  }

  /**
   * Sama seperti perbaruiBarisById, tapi dipakai saat nomor barisnya SUDAH
   * diketahui (misalnya dari hasil ambilById sebelumnya) -- supaya tidak
   * baca ulang seluruh sheet cuma untuk mencari baris yang sebenarnya
   * sudah ketemu. Dipakai buatRepoDasar_.perbarui() di bawah.
   */
  function perbaruiBarisPadaNomor(namaSheet, nomorBaris, perubahan) {
    var sheet = ambilSheet(namaSheet);
    var peta = ambilPetaHeader(sheet);
    return perbaruiBarisPadaNomor_(sheet, peta, nomorBaris, perubahan, namaSheet);
  }

  function perbaruiBarisPadaNomor_(sheet, peta, nomorBaris, perubahan, namaSheet) {
    var kunci = Object.keys(perubahan);
    var indeks = [];
    for (var i = 0; i < kunci.length; i++) {
      var kolom = kunci[i];
      var indeksKolom = peta[kolom];
      if (!indeksKolom) throw new Error('UtilSheet: kolom "' + kolom + '" tidak dikenal di "' + namaSheet + '"');
      indeks.push(indeksKolom);
    }

    // Sheet aplikasi adalah tabel data terkontrol (tanpa formula pada
    // kolom skema). Kalau barisnya sudah ada di cache eksekusi, tulis
    // seluruh rentang perubahan dalam SATU setValues. Sebelumnya setiap
    // kolom memakai setValue sendiri; update revisi + waktu saja sudah
    // membutuhkan beberapa round-trip ke Google Sheets.
    var cache = cacheBarisEksekusi_[namaSheet];
    var existing = null;
    if (cache) {
      for (var c = 0; c < cache.length; c++) {
        if (cache[c].__baris === nomorBaris) { existing = cache[c]; break; }
      }
    }
    var skema = KONFIG.SKEMA[namaSheet];
    var bisaBatch = !!existing && !!skema && indeks.length > 0;
    var indeksAwal = bisaBatch ? Math.min.apply(null, indeks) : 0;
    var indeksAkhir = bisaBatch ? Math.max.apply(null, indeks) : 0;
    var headerPerIndeks = {};
    Object.keys(peta).forEach(function (namaHeader) { headerPerIndeks[peta[namaHeader]] = namaHeader; });
    var nilaiRentang = [];
    if (bisaBatch) {
      for (var j = indeksAwal; j <= indeksAkhir; j++) {
        var header = headerPerIndeks[j];
        if (!header || skema.indexOf(header) === -1 || !Object.prototype.hasOwnProperty.call(existing, header)) {
          bisaBatch = false;
          break;
        }
        nilaiRentang.push(Object.prototype.hasOwnProperty.call(perubahan, header) ? perubahan[header] : existing[header]);
      }
    }

    if (bisaBatch) {
      var mulaiTulis = Date.now();
      sheet.getRange(nomorBaris, indeksAwal, 1, nilaiRentang.length).setValues([nilaiRentang]);
      UtilPerforma.catat('sheet_update', mulaiTulis, { sheet: namaSheet, jumlahKolom: nilaiRentang.length });
    } else {
      var mulaiTulisFallback = Date.now();
      for (var k = 0; k < kunci.length; k++) {
        var namaKolom = kunci[k];
        sheet.getRange(nomorBaris, peta[namaKolom]).setValue(perubahan[namaKolom]);
      }
      UtilPerforma.catat('sheet_update_fallback', mulaiTulisFallback, { sheet: namaSheet, jumlahKolom: kunci.length });
    }
    invalidasiCacheSheet_(namaSheet);
    return true;
  }

  /**
   * Menghapus baris SUNGGUHAN dari sheet (bukan soft-delete/status).
   * HANYA dipakai untuk data yang belum pernah "terjadi" secara nyata
   * (misalnya sesi khusus yang baru dibuat lalu batal dipakai, belum ada
   * satupun penugasan di dalamnya) -- untuk data yang sudah dipakai,
   * selalu pakai status DIHAPUS supaya riwayat/audit tetap utuh.
   */
  function hapusBarisById(namaSheet, namaKolomId, nilaiId) {
    var existing = cariBarisById(namaSheet, namaKolomId, nilaiId);
    if (!existing) return false;
    ambilSheet(namaSheet).deleteRow(existing.__baris);
    invalidasiCacheSheet_(namaSheet);
    return true;
  }

  /** Mengganti isi sheet turunan dalam satu operasi batch utama. */
  function gantiSemuaBaris(namaSheet, daftarObjekBaris) {
    var sheet = ambilSheet(namaSheet);
    var skema = KONFIG.SKEMA[namaSheet];
    if (!skema) throw new Error('UtilSheet.gantiSemuaBaris: tidak ada skema untuk "' + namaSheet + '"');
    var daftar = daftarObjekBaris || [];
    var mulaiTulis = Date.now();
    var barisTerakhir = sheet.getLastRow();
    if (daftar.length > 0) {
      var nilai = daftar.map(function (objekBaris) {
        return skema.map(function (kolom) {
          return Object.prototype.hasOwnProperty.call(objekBaris, kolom) ? objekBaris[kolom] : '';
        });
      });
      sheet.getRange(2, 1, nilai.length, skema.length).setValues(nilai);
    }
    var jumlahLama = Math.max(0, barisTerakhir - 1);
    if (jumlahLama > daftar.length) {
      sheet.getRange(2 + daftar.length, 1, jumlahLama - daftar.length, Math.max(sheet.getLastColumn(), skema.length)).clearContent();
    }
    UtilPerforma.catat('sheet_replace_all', mulaiTulis, { sheet: namaSheet, jumlahBaris: daftar.length });
    invalidasiCacheSheet_(namaSheet);
    return daftar;
  }

  return {
    ambilSpreadsheet: ambilSpreadsheet, ambilSheet: ambilSheet, ambilPetaHeader: ambilPetaHeader,
    ambilSemuaBaris: ambilSemuaBaris, ambilBarisTerakhir: ambilBarisTerakhir, ambilHalamanDariAkhir: ambilHalamanDariAkhir,
    cariBarisById: cariBarisById, tambahBaris: tambahBaris, tambahBanyakBaris: tambahBanyakBaris,
    perbaruiBarisById: perbaruiBarisById, perbaruiBarisPadaNomor: perbaruiBarisPadaNomor,
    hapusBarisById: hapusBarisById, gantiSemuaBaris: gantiSemuaBaris
  };
})();

// --- Pengunci (lock), supaya dua orang tidak menyimpan jadwal secara bersamaan dan saling menimpa ---
var UtilKunci = (function () {
  var BATAS_WAKTU_MS = 10000;
  function denganKunciSkrip(fn, batasWaktuMs) {
    var lock = LockService.getScriptLock();
    var mulaiTunggu = Date.now();
    var berhasil = lock.tryLock(batasWaktuMs || BATAS_WAKTU_MS);
    UtilPerforma.catat('lock_wait', mulaiTunggu, { berhasil: berhasil });
    if (!berhasil) throw new Error('UtilKunci: gagal mendapatkan kunci — ada proses simpan lain yang sedang berjalan. Silakan coba lagi.');
    var mulaiKunci = Date.now();
    try { return fn(); }
    finally {
      UtilPerforma.catat('lock_hold', mulaiKunci);
      lock.releaseLock();
    }
  }
  return { denganKunciSkrip: denganKunciSkrip };
})();


/* ====================================================================
 * 3. SETUP AWAL
 * Jalankan "jalankanSetupAwal" SATU KALI dari editor Apps Script untuk
 * membuat semua sheet yang dibutuhkan beserta judul kolomnya. Fungsi
 * ini aman dijalankan berkali-kali (tidak akan membuat data ganda).
 *
 * CATATAN PENTING: fungsi ini SENGAJA TIDAK mengisi data Wilayah,
 * Lingkungan, atau People — karena data itu harus berasal dari data
 * asli/lama milik paroki, bukan ditebak oleh sistem ini. Silakan input
 * manual lewat menu "Kelola Petugas" di halaman web setelah setup.
 * ==================================================================== */

function jalankanSetupAwal() {
  var ss = UtilSheet.ambilSpreadsheet();
  Object.keys(KONFIG.NAMA_SHEET).forEach(function (kunci) {
    pastikanSheetDenganHeader_(ss, KONFIG.NAMA_SHEET[kunci]);
  });
  isiPeranDefault_();
  isiAturanBawaan_();
  isiPengaturanSistemDefault_();
  UtilCache.flushInvalidasi();
  Logger.log('Setup awal selesai.');
}

function pastikanSheetDenganHeader_(ss, namaSheet) {
  var sheet = ss.getSheetByName(namaSheet);
  if (!sheet) sheet = ss.insertSheet(namaSheet);

  if (namaSheet === KONFIG.NAMA_SHEET.JADWAL) { pastikanHeaderJadwal_(sheet); return; }

  var skema = KONFIG.SKEMA[namaSheet];
  if (!skema) return;

  var headerSekarang = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];

  if (headerSekarang.length === 0) {
    sheet.getRange(1, 1, 1, skema.length).setValues([skema]);
    sheet.setFrozenRows(1);
    return;
  }

  var cocokSejauhIni = headerSekarang.every(function (kolom, i) { return skema[i] === kolom; });
  if (!cocokSejauhIni) {
    throw new Error('Setup awal: sheet "' + namaSheet + '" sudah punya judul kolom yang berbeda dari yang seharusnya. Mohon disesuaikan manual dulu.');
  }
  if (headerSekarang.length < skema.length) {
    // Skema baru punya kolom tambahan di akhir (misalnya setelah update) --
    // cukup tambahkan judul kolomnya, data lama yang sudah ada tidak disentuh.
    var kolomBaru = skema.slice(headerSekarang.length);
    sheet.getRange(1, headerSekarang.length + 1, 1, kolomBaru.length).setValues([kolomBaru]);
  }
}

/**
 * Sheet "Jadwal" meniru persis layout file Excel lama: baris 1-3
 * cadangan judul, baris 4 = judul kolom, data mulai baris 5. Kolom
 * cetak asli cuma A:H; kolom I ("Informasi") berisi teks "Minggu
 * ke-N" untuk bantu baca, tidak ikut dicetak.
 */
function pastikanHeaderJadwal_(sheet) {
  if (sheet.getLastRow() > 0) return; // sudah ada isi, jangan ditimpa
  var header = ['Tanggal', 'Misa', 'Koor', 'Hias Altar', 'Tatib', 'Tugas', 'Petugas', 'Asal wilayah', 'Informasi'];
  sheet.getRange(4, 1, 1, header.length).setValues([header]);
  sheet.setFrozenRows(4);
}

function isiPeranDefault_() {
  if (UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.KONFIG_PERAN).length > 0) return;
  var urutan = 1;
  Object.keys(KONFIG.PERAN_DEFAULT).forEach(function (namaPeran) {
    UtilSheet.tambahBaris(KONFIG.NAMA_SHEET.KONFIG_PERAN, {
      role_id: UtilId.idBaru('role_id'), nama_peran: namaPeran,
      jumlah_dibutuhkan: KONFIG.PERAN_DEFAULT[namaPeran], jumlah_maksimal: KONFIG.PERAN_DEFAULT[namaPeran],
      aktif: true, urutan: urutan++
    });
  });
}

function isiAturanBawaan_() {
  if (UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.KONFIG_ATURAN).length > 0) return;
  var daftarAturan = [
    ['BR-020', 'BLOCK', 'Kelayakan peran'],
    ['BR-026', 'BLOCK', 'Kapasitas kuota peran'],
    ['BR-030', 'BLOCK', 'Rangkap peran di sesi yang sama'],
    ['BR-031', 'BLOCK', 'Rangkap peran di akhir pekan yang sama'],
    ['BR-032', 'BLOCK', 'Bertugas dua akhir pekan berturut-turut'],
    ['BR-013', 'BLOCK', 'Wilayah Paduan Suara: tidak boleh dobel/berturut-turut'],
    ['BR-041', 'BLOCK', 'Konflik Tatib (dobel/berturut-turut/bentrok Koor)'],
    ['BR-052', 'WARNING', 'Tumpang tindih Paduan Suara & Hias Altar'],
    ['BR-027', 'AUTO', 'Saran Organis berbasis jarang bertugas (LRU)'],
    ['BR-051', 'AUTO', 'Hias Altar tingkat akhir pekan']
  ];
  var sekarang = new Date();
  daftarAturan.forEach(function (a) {
    UtilSheet.tambahBaris(KONFIG.NAMA_SHEET.KONFIG_ATURAN, {
      rule_id: a[0], nama_aturan: a[2], aktif: true, tingkat: a[1],
      konfigurasi_json: '{}', versi_kebijakan: 1, diubah_pada: sekarang, diubah_oleh: 'sistem:setup'
    });
  });
}

function isiPengaturanSistemDefault_() {
  var existing = UtilSheet.cariBarisById(KONFIG.NAMA_SHEET.PENGATURAN_SISTEM, 'kunci', 'versi_kebijakan');
  if (existing) return;
  UtilSheet.tambahBaris(KONFIG.NAMA_SHEET.PENGATURAN_SISTEM, { kunci: 'versi_kebijakan', nilai: 1 });
}

/**
 * Jalankan fungsi ini SATU KALI dari editor Apps Script (bukan dari
 * halaman web) untuk menjadikan diri Anda Admin pertama. Setelah itu,
 * Admin bisa menambah pengguna lain lewat halaman web.
 */
function aturDiriSayaSebagaiAdmin() {
  jalankanSetupAwal();
  var email = Session.getEffectiveUser().getEmail();
  RepoPengaturanSistem.set('peran_pengguna:' + email, KONFIG.IZIN.ADMIN);
  Logger.log('Selesai. "' + email + '" sekarang menjadi Admin.');
}
/* ====================================================================
 * 4. REPOSITORY
 * Lapisan ini satu-satunya yang boleh membaca/menulis sheet secara
 * langsung. Bagian Layanan (di bawah) tidak boleh menyentuh sheet
 * kecuali lewat fungsi-fungsi di sini.
 * ==================================================================== */

// --- Pola dasar yang dipakai ulang oleh sebagian besar entitas ---
function buatRepoDasar_(namaSheet, namaKolomId) {

  function daftar(sertakanTidakAktif) {
    var semua = UtilSheet.ambilSemuaBaris(namaSheet);
    if (sertakanTidakAktif) return semua;
    return semua.filter(function (baris) { return baris.aktif === true; });
  }

  function ambilById(id) {
    if (!id) return null;
    return UtilSheet.cariBarisById(namaSheet, namaKolomId, id);
  }

  /**
   * Dulu selalu baca ulang sheet setelah menulis (ambilById(id)) cuma
   * untuk mengembalikan data yang SUDAH diketahui persis isinya --
   * dikalikan berapa kali fungsi ini dipanggil dalam satu proses
   * (tugaskan orang, dsb.), ini salah satu penyebab jalur simpan lambat.
   * Sekarang langsung kembalikan objek yang baru saja ditulis.
   */
  function buat(data, pelakuId) {
    var id = UtilId.idBaru(namaKolomId);
    var sekarang = new Date();
    var baris = Object.assign({}, data);
    baris[namaKolomId] = id;
    if (!Object.prototype.hasOwnProperty.call(data, 'aktif')) baris.aktif = true;
    if (adaKolom_('dibuat_pada')) baris.dibuat_pada = sekarang;
    if (adaKolom_('diubah_pada')) baris.diubah_pada = sekarang;
    if (pelakuId) {
      if (adaKolom_('dibuat_oleh')) baris.dibuat_oleh = pelakuId;
      if (adaKolom_('diubah_oleh')) baris.diubah_oleh = pelakuId;
    }
    UtilSheet.tambahBaris(namaSheet, baris);
    return baris;
  }

  function perbarui(id, perubahan, pelakuId) {
    var existing = ambilById(id);
    if (!existing) throw new Error(namaSheet + ': data dengan ' + namaKolomId + ' = ' + id + ' tidak ditemukan.');
    var aman = Object.assign({}, perubahan);
    delete aman[namaKolomId]; // ID tidak boleh diubah
    if (adaKolom_('diubah_pada')) aman.diubah_pada = new Date();
    if (pelakuId && adaKolom_('diubah_oleh')) aman.diubah_oleh = pelakuId;
    // existing.__baris sudah diketahui dari ambilById di atas -- langsung
    // pakai itu, tidak perlu UtilSheet mencari ulang baris yang sama.
    UtilSheet.perbaruiBarisPadaNomor(namaSheet, existing.__baris, aman);
    return Object.assign({}, existing, aman);
  }

  function nonaktifkan(id, pelakuId) { return perbarui(id, { aktif: false }, pelakuId); }

  function adaKolom_(namaKolom) {
    var skema = KONFIG.SKEMA[namaSheet];
    return !!skema && skema.indexOf(namaKolom) !== -1;
  }

  return { daftar: daftar, ambilById: ambilById, buat: buat, perbarui: perbarui, nonaktifkan: nonaktifkan };
}

// --- Wilayah ---
var RepoWilayah = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.WILAYAH, 'wilayah_id');
  function ambilByNama(nama) {
    var semua = dasar.daftar(true);
    for (var i = 0; i < semua.length; i++) { if (semua[i].nama === nama) return semua[i]; }
    return null;
  }
  return { daftar: dasar.daftar, ambilById: dasar.ambilById, ambilByNama: ambilByNama, buat: dasar.buat, perbarui: dasar.perbarui, nonaktifkan: dasar.nonaktifkan };
})();

// --- Lingkungan (wajib merujuk ke Wilayah yang valid & aktif) ---
var RepoLingkungan = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.LINGKUNGAN, 'lingkungan_id');

  function pastikanWilayahValid_(wilayahId) {
    var wilayah = RepoWilayah.ambilById(wilayahId);
    if (!wilayah) throw new Error('Wilayah dengan id "' + wilayahId + '" tidak ditemukan.');
    if (wilayah.aktif !== true) throw new Error('Wilayah "' + wilayahId + '" sudah tidak aktif.');
  }

  function buat(data, pelakuId) { pastikanWilayahValid_(data.wilayah_id); return dasar.buat(data, pelakuId); }
  function perbarui(id, perubahan, pelakuId) {
    if (perubahan.wilayah_id) pastikanWilayahValid_(perubahan.wilayah_id);
    return dasar.perbarui(id, perubahan, pelakuId);
  }
  function daftarByWilayah(wilayahId, sertakanTidakAktif) {
    return dasar.daftar(sertakanTidakAktif).filter(function (b) { return b.wilayah_id === wilayahId; });
  }
  function cariWilayahId(lingkunganId) {
    var l = dasar.ambilById(lingkunganId);
    if (!l) throw new Error('Lingkungan dengan id "' + lingkunganId + '" tidak ditemukan.');
    return l.wilayah_id;
  }

  return { daftar: dasar.daftar, ambilById: dasar.ambilById, daftarByWilayah: daftarByWilayah, cariWilayahId: cariWilayahId, buat: buat, perbarui: perbarui, nonaktifkan: dasar.nonaktifkan };
})();

// --- Orang / People (wajib punya Lingkungan valid; Wilayah selalu diturunkan otomatis, tidak disimpan ganda) ---
var RepoOrang = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.ORANG, 'person_id');

  function pastikanLingkunganValid_(lingkunganId) {
    var l = RepoLingkungan.ambilById(lingkunganId);
    if (!l) throw new Error('Lingkungan dengan id "' + lingkunganId + '" tidak ditemukan.');
    if (l.aktif !== true) throw new Error('Lingkungan "' + lingkunganId + '" sudah tidak aktif.');
  }

  function buat(data, pelakuId) { pastikanLingkunganValid_(data.lingkungan_id); return dasar.buat(data, pelakuId); }
  function perbarui(id, perubahan, pelakuId) {
    if (perubahan.lingkungan_id) pastikanLingkunganValid_(perubahan.lingkungan_id);
    return dasar.perbarui(id, perubahan, pelakuId);
  }
  function ambilWilayahId(personId) {
    var orang = dasar.ambilById(personId);
    if (!orang) return null;
    return RepoLingkungan.cariWilayahId(orang.lingkungan_id);
  }
  function cari(kataKunci, sertakanTidakAktif) {
    var q = (kataKunci || '').toString().toLowerCase();
    return dasar.daftar(sertakanTidakAktif).filter(function (p) {
      return p.nama && p.nama.toString().toLowerCase().indexOf(q) !== -1;
    });
  }

  return { daftar: dasar.daftar, ambilById: dasar.ambilById, cari: cari, ambilWilayahId: ambilWilayahId, buat: buat, perbarui: perbarui, nonaktifkan: dasar.nonaktifkan };
})();

// --- Peran per orang (kelayakan seseorang untuk suatu peran) ---
var RepoPeranOrang = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.PERAN_ORANG, 'person_role_id');

  function daftarByOrang(personId, sertakanTidakAktif) {
    return dasar.daftar(sertakanTidakAktif).filter(function (b) { return b.person_id === personId; });
  }
  function daftarByPeran(roleId, sertakanTidakAktif) {
    return dasar.daftar(sertakanTidakAktif).filter(function (b) { return b.role_id === roleId; });
  }
  function apakahLayak(personId, roleId) {
    return daftarByOrang(personId, false).some(function (b) { return b.role_id === roleId; });
  }
  function berikan(personId, roleId, pelakuId) {
    var sudahAda = daftarByOrang(personId, false).some(function (b) { return b.role_id === roleId; });
    if (sudahAda) return null;
    return dasar.buat({ person_id: personId, role_id: roleId, aktif: true }, pelakuId);
  }
  function cabut(personRoleId, pelakuId) { return dasar.nonaktifkan(personRoleId, pelakuId); }

  return { daftarByOrang: daftarByOrang, daftarByPeran: daftarByPeran, apakahLayak: apakahLayak, berikan: berikan, cabut: cabut, ambilById: dasar.ambilById };
})();

// --- Konfigurasi Peran (jumlah dibutuhkan/maksimal per peran) ---
var RepoKonfigPeran = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.KONFIG_PERAN, 'role_id');
  function ambilByNama(namaPeran, sertakanTidakAktif) {
    var semua = dasar.daftar(sertakanTidakAktif);
    for (var i = 0; i < semua.length; i++) { if (semua[i].nama_peran === namaPeran) return semua[i]; }
    return null;
  }
  function daftarUrut(sertakanTidakAktif) {
    return dasar.daftar(sertakanTidakAktif).sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });
  }
  return { daftar: dasar.daftar, daftarUrut: daftarUrut, ambilById: dasar.ambilById, ambilByNama: ambilByNama, buat: dasar.buat, perbarui: dasar.perbarui, nonaktifkan: dasar.nonaktifkan };
})();

// --- Pengaturan Sistem (kunci-nilai umum, misalnya versi kebijakan & peran pengguna) ---
var RepoPengaturanSistem = (function () {
  var SHEET = KONFIG.NAMA_SHEET.PENGATURAN_SISTEM;
  function get(kunci, nilaiDefault) {
    var baris = UtilSheet.cariBarisById(SHEET, 'kunci', kunci);
    return baris ? baris.nilai : nilaiDefault;
  }
  function set(kunci, nilai) {
    var existing = UtilSheet.cariBarisById(SHEET, 'kunci', kunci);
    if (existing) UtilSheet.perbaruiBarisById(SHEET, 'kunci', kunci, { nilai: nilai });
    else UtilSheet.tambahBaris(SHEET, { kunci: kunci, nilai: nilai });
    return nilai;
  }
  function ambilVersiKebijakan() { return Number(get('versi_kebijakan', 1)) || 1; }
  function naikkanVersiKebijakan() { var v = ambilVersiKebijakan() + 1; set('versi_kebijakan', v); return v; }
  return { get: get, set: set, ambilVersiKebijakan: ambilVersiKebijakan, naikkanVersiKebijakan: naikkanVersiKebijakan };
})();

// --- Konfigurasi Aturan (aturan WAJIB tidak boleh dimatikan) ---
var RepoKonfigAturan = (function () {
  var SHEET = KONFIG.NAMA_SHEET.KONFIG_ATURAN;
  function daftar() { return UtilSheet.ambilSemuaBaris(SHEET); }
  function ambilById(ruleId) { return UtilSheet.cariBarisById(SHEET, 'rule_id', ruleId); }

  function perbaruiKonfigAturan(ruleId, perubahan, pelakuId) {
    var current = ambilById(ruleId);
    if (!current) throw new Error('Aturan "' + ruleId + '" tidak ditemukan.');
    if (current.tingkat === KONFIG.TINGKAT_ATURAN.WAJIB &&
        Object.prototype.hasOwnProperty.call(perubahan, 'aktif') && perubahan.aktif === false) {
      throw new Error('Aturan "' + ruleId + '" bertingkat WAJIB (menjaga keutuhan data) dan tidak boleh dimatikan.');
    }
    var versiBaru = RepoPengaturanSistem.naikkanVersiKebijakan();
    var aman = Object.assign({}, perubahan, { versi_kebijakan: versiBaru, diubah_pada: new Date(), diubah_oleh: pelakuId });
    UtilSheet.perbaruiBarisById(SHEET, 'rule_id', ruleId, aman);
    return ambilById(ruleId);
  }

  return { daftar: daftar, ambilById: ambilById, perbaruiKonfigAturan: perbaruiKonfigAturan };
})();

// --- Akhir Pekan (Weekends) — pemilik nomor revisi untuk mencegah tabrakan simpan ---
var RepoAkhirPekan = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.AKHIR_PEKAN, 'weekend_id');

  function normalisasiTanggal_(t) {
    var d = new Date(t);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function ambilByTanggalAcuan(tanggalAcuan) {
    var kunci = normalisasiTanggal_(tanggalAcuan);
    var semua = dasar.daftar(true);
    for (var i = 0; i < semua.length; i++) { if (normalisasiTanggal_(semua[i].tanggal_acuan) === kunci) return semua[i]; }
    return null;
  }

  function ambilAtauBuatUntukTanggal(tanggalAcuan, pelakuId) {
    var existing = ambilByTanggalAcuan(tanggalAcuan);
    if (existing) return existing;
    return dasar.buat({ tanggal_acuan: tanggalAcuan, status: KONFIG.STATUS_AKHIR_PEKAN.DRAFT, revisi: 1 }, pelakuId);
  }

  /** Mencari akhir pekan sebelum/sesudah, dipakai untuk cek layanan berturut-turut. */
  function ambilTetangga(weekendId) {
    var target = dasar.ambilById(weekendId);
    if (!target) return { sebelum: null, sesudah: null };
    var semua = dasar.daftar(true).slice().sort(function (a, b) { return new Date(a.tanggal_acuan) - new Date(b.tanggal_acuan); });
    var idx = semua.findIndex(function (w) { return w.weekend_id === weekendId; });
    if (idx === -1) return { sebelum: null, sesudah: null };
    return { sebelum: idx > 0 ? semua[idx - 1] : null, sesudah: idx < semua.length - 1 ? semua[idx + 1] : null };
  }

  function daftarDalamRentang(tglAwal, tglAkhir) {
    var awal = new Date(tglAwal).getTime();
    var akhir = new Date(tglAkhir).getTime();
    return dasar.daftar(true).filter(function (w) {
      var t = new Date(w.tanggal_acuan).getTime();
      return t >= awal && t <= akhir;
    });
  }

  /**
   * Inti mekanisme anti-tabrakan: hanya berhasil menyimpan jika nomor
   * revisi yang dikirim client masih sama dengan yang tersimpan di
   * server. Kalau sudah berbeda (artinya ada orang lain yang menyimpan
   * duluan), permintaan ini DITOLAK — data yang lebih baru TIDAK PERNAH
   * ditimpa begitu saja.
   */
  function perbaruiDenganCekRevisi(weekendId, revisiYangDiharapkan, perubahan, pelakuId) {
    var current = dasar.ambilById(weekendId);
    if (!current) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN', current: null };
    if (Number(current.revisi) !== Number(revisiYangDiharapkan)) {
      return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: current };
    }
    var aman = Object.assign({}, perubahan);
    delete aman.weekend_id; delete aman.revisi;
    aman.revisi = Number(current.revisi) + 1;
    var diperbarui = dasar.perbarui(weekendId, aman, pelakuId);
    return { berhasil: true, akhirPekan: diperbarui };
  }

  function finalkan(weekendId, revisiYangDiharapkan, pelakuId) {
    return perbaruiDenganCekRevisi(weekendId, revisiYangDiharapkan, {
      status: KONFIG.STATUS_AKHIR_PEKAN.FINAL, difinalkan_pada: new Date(), difinalkan_oleh: pelakuId
    }, pelakuId);
  }
  function bukaKembali(weekendId, revisiYangDiharapkan, pelakuId) {
    return perbaruiDenganCekRevisi(weekendId, revisiYangDiharapkan, {
      status: KONFIG.STATUS_AKHIR_PEKAN.DRAFT, difinalkan_pada: '', difinalkan_oleh: ''
    }, pelakuId);
  }

  /** Menghapus wadah jadwal yang masih Draft dan sudah tidak memiliki sesi. */
  function hapusDraftKosong(weekendId) {
    var akhirPekan = dasar.ambilById(weekendId);
    if (!akhirPekan) return false;
    if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL) {
      throw new Error('Jadwal final tidak boleh dihapus. Buka kunci jadwal lebih dulu.');
    }
    if (RepoSesi.daftarByAkhirPekan(weekendId).length > 0) {
      throw new Error('Wadah jadwal masih memiliki sesi.');
    }
    return UtilSheet.hapusBarisById(KONFIG.NAMA_SHEET.AKHIR_PEKAN, 'weekend_id', weekendId);
  }

  return {
    daftar: dasar.daftar, ambilById: dasar.ambilById, ambilByTanggalAcuan: ambilByTanggalAcuan,
    ambilAtauBuatUntukTanggal: ambilAtauBuatUntukTanggal, ambilTetangga: ambilTetangga,
    daftarDalamRentang: daftarDalamRentang, perbaruiDenganCekRevisi: perbaruiDenganCekRevisi,
    finalkan: finalkan, bukaKembali: bukaKembali, hapusDraftKosong: hapusDraftKosong
  };
})();

// --- Sesi (Sabtu Sore / Minggu Pagi / Minggu Sore) di dalam satu Akhir Pekan ---
var RepoSesi = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.SESI, 'session_id');

  function daftarByAkhirPekan(weekendId) {
    return dasar.daftar(true).filter(function (s) { return s.weekend_id === weekendId; });
  }
  function ambilAtauBuat(weekendId, jenisSesi, tanggalSesi, pelakuId) {
    var existing = daftarByAkhirPekan(weekendId).filter(function (s) { return s.jenis_sesi === jenisSesi; })[0];
    if (existing) return existing;
    return dasar.buat({ weekend_id: weekendId, jenis_sesi: jenisSesi, tanggal_sesi: tanggalSesi, status: KONFIG.STATUS_AKHIR_PEKAN.DRAFT, nama_khusus: '' }, pelakuId);
  }

  /**
   * Menyiapkan beberapa sesi baku dengan satu kali baca dan maksimal satu
   * kali tulis. Ini dipakai saat membuka jadwal baru agar tiga pilihan sesi
   * tidak memicu rangkaian baca -> appendRow -> baca ulang secara berulang.
   */
  function ambilAtauBuatBanyak(weekendId, daftarSesi, pelakuId) {
    var sesiSebelumnya = daftarByAkhirPekan(weekendId);
    var petaJenis = {};
    sesiSebelumnya.forEach(function (sesi) { petaJenis[sesi.jenis_sesi] = sesi; });

    var sesiBaru = [];
    var sesiList = [];
    (daftarSesi || []).forEach(function (data) {
      if (!data || !data.jenisSesi || !data.tanggalSesi) return;
      var existing = petaJenis[data.jenisSesi];
      if (existing) {
        sesiList.push(existing);
        return;
      }
      var baris = {
        session_id: UtilId.idBaru('session_id'),
        weekend_id: weekendId,
        jenis_sesi: data.jenisSesi,
        tanggal_sesi: data.tanggalSesi,
        status: KONFIG.STATUS_AKHIR_PEKAN.DRAFT,
        nama_khusus: ''
      };
      petaJenis[data.jenisSesi] = baris;
      sesiBaru.push(baris);
      sesiList.push(baris);
    });
    if (sesiBaru.length > 0) UtilSheet.tambahBanyakBaris(KONFIG.NAMA_SHEET.SESI, sesiBaru);
    return { sesiList: sesiList, sesiBaru: sesiBaru, sesiSebelumnya: sesiSebelumnya };
  }
  /** Sesi tambahan/tidak baku (misalnya "Misa Paskah") -- boleh lebih dari satu dalam satu akhir pekan. */
  function buatSesiKhusus(weekendId, namaKhusus, tanggalSesi, pelakuId) {
    return dasar.buat({ weekend_id: weekendId, jenis_sesi: KONFIG.JENIS_SESI.KHUSUS, tanggal_sesi: tanggalSesi, status: KONFIG.STATUS_AKHIR_PEKAN.DRAFT, nama_khusus: namaKhusus }, pelakuId);
  }
  /** Mengubah nama/tanggal sesi khusus. Sesi baku (Sabtu Sore dsb.) tidak boleh diubah lewat sini. */
  function perbaruiSesiKhusus(sessionId, perubahan, pelakuId) {
    var sesi = dasar.ambilById(sessionId);
    if (!sesi) throw new Error('Sesi tidak ditemukan.');
    if (sesi.jenis_sesi !== KONFIG.JENIS_SESI.KHUSUS) throw new Error('Hanya sesi khusus yang bisa diubah lewat sini.');
    return dasar.perbarui(sessionId, perubahan, pelakuId);
  }
  /**
   * Menghapus sesi khusus SUNGGUHAN dari sheet -- hanya diperbolehkan
   * kalau sesi itu jenisnya KHUSUS dan belum ada satupun penugasan
   * (individu atau komunitas) yang menempel padanya, supaya tidak
   * menghapus riwayat yang sudah nyata terjadi.
   */
  function hapusSesiKhusus(sessionId) {
    var sesi = dasar.ambilById(sessionId);
    if (!sesi) return false;
    if (sesi.jenis_sesi !== KONFIG.JENIS_SESI.KHUSUS) throw new Error('Hanya sesi khusus yang bisa dihapus lewat sini.');
    var adaPenugasanIndividu = RepoPenugasan.daftarBySesi(sessionId).length > 0;
    var adaPenugasanKomunitas = RepoPenugasanKomunitas.daftarBySesi(sessionId).length > 0;
    if (adaPenugasanIndividu || adaPenugasanKomunitas) {
      throw new Error('Sesi ini sudah punya penugasan -- hapus dulu semua penugasannya sebelum menghapus sesinya.');
    }
    return UtilSheet.hapusBarisById(KONFIG.NAMA_SHEET.SESI, 'session_id', sessionId);
  }

  /** Penghapusan sesi Draft generik. Penugasan terkait ditangani service sebelum fungsi ini dipanggil. */
  function hapusSesiDraft(sessionId) {
    var sesi = dasar.ambilById(sessionId);
    if (!sesi) return false;
    return UtilSheet.hapusBarisById(KONFIG.NAMA_SHEET.SESI, 'session_id', sessionId);
  }

  return { daftar: dasar.daftar, ambilById: dasar.ambilById, daftarByAkhirPekan: daftarByAkhirPekan, ambilAtauBuat: ambilAtauBuat, ambilAtauBuatBanyak: ambilAtauBuatBanyak, buatSesiKhusus: buatSesiKhusus, perbaruiSesiKhusus: perbaruiSesiKhusus, hapusSesiKhusus: hapusSesiKhusus, hapusSesiDraft: hapusSesiDraft, perbarui: dasar.perbarui };
})();

// --- Penugasan individu (Organis, Pemazmur, Lektor, Misdinar, Prodiakon) per sesi ---
var RepoPenugasan = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.PENUGASAN, 'assignment_id');

  function aktifSaja_(a) { return a.status === KONFIG.STATUS_PENUGASAN.AKTIF; }

  function daftarBySesi(sessionId, aktifSaja) {
    var semua = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN).filter(function (a) { return a.session_id === sessionId; });
    return aktifSaja === false ? semua : semua.filter(aktifSaja_);
  }
  function daftarByAkhirPekan(weekendId, aktifSaja) {
    var semua = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN).filter(function (a) { return a.weekend_id === weekendId; });
    return aktifSaja === false ? semua : semua.filter(aktifSaja_);
  }
  function daftarByOrang(personId, aktifSaja) {
    var semua = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN).filter(function (a) { return a.person_id === personId; });
    var hasil = aktifSaja === false ? semua : semua.filter(aktifSaja_);
    return hasil.sort(function (a, b) { return new Date(b.dibuat_pada) - new Date(a.dibuat_pada); });
  }
  function daftarByPeran(roleId, sessionId, aktifSaja) {
    return daftarBySesi(sessionId, aktifSaja).filter(function (a) { return a.role_id === roleId; });
  }
  function buat(data, pelakuId) {
    var baris = Object.assign({ status: KONFIG.STATUS_PENUGASAN.AKTIF }, data);
    return dasar.buat(baris, pelakuId);
  }
  function buatBanyak(daftarData, pelakuId) {
    var sekarang = new Date();
    var daftarBaris = (daftarData || []).map(function (data) {
      return Object.assign({
        assignment_id: UtilId.idBaru('assignment_id'),
        status: KONFIG.STATUS_PENUGASAN.AKTIF,
        dibuat_pada: sekarang,
        dibuat_oleh: pelakuId,
        diubah_pada: sekarang,
        diubah_oleh: pelakuId
      }, data);
    });
    return UtilSheet.tambahBanyakBaris(KONFIG.NAMA_SHEET.PENUGASAN, daftarBaris);
  }
  function hapus(assignmentId, pelakuId) { return dasar.perbarui(assignmentId, { status: KONFIG.STATUS_PENUGASAN.DIHAPUS }, pelakuId); }

  return { ambilById: dasar.ambilById, daftarBySesi: daftarBySesi, daftarByAkhirPekan: daftarByAkhirPekan, daftarByOrang: daftarByOrang, daftarByPeran: daftarByPeran, buat: buat, buatBanyak: buatBanyak, hapus: hapus };
})();

// --- Penugasan Komunitas (Paduan Suara / Tatib / Hias Altar) — level Wilayah, bukan perorangan ---
var RepoPenugasanKomunitas = (function () {
  var dasar = buatRepoDasar_(KONFIG.NAMA_SHEET.PENUGASAN_KOMUNITAS, 'community_assignment_id');

  // Baris lama (sebelum kolom status ada) tidak punya nilai status -- itu
  // dianggap AKTIF juga, supaya data lama tidak tiba-tiba hilang dari
  // tampilan begitu kolom status ditambahkan.
  function aktifSaja_(c) { return c.status !== KONFIG.STATUS_PENUGASAN.DIHAPUS; }

  function daftarByAkhirPekan(weekendId, aktifSaja) {
    var semua = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN_KOMUNITAS).filter(function (c) { return c.weekend_id === weekendId; });
    return aktifSaja === false ? semua : semua.filter(aktifSaja_);
  }
  function daftarBySesi(sessionId, aktifSaja) {
    var semua = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN_KOMUNITAS).filter(function (c) { return c.session_id === sessionId; });
    return aktifSaja === false ? semua : semua.filter(aktifSaja_);
  }
  function daftarByJenis(weekendId, jenisPenugasan) {
    return daftarByAkhirPekan(weekendId).filter(function (c) { return c.jenis_penugasan === jenisPenugasan; });
  }
  function buat(data, pelakuId) {
    return dasar.buat(Object.assign({ status: KONFIG.STATUS_PENUGASAN.AKTIF }, data), pelakuId);
  }
  /** Dibatalkan, bukan dihapus -- baris tetap ada untuk riwayat/audit. */
  function hapus(communityAssignmentId, pelakuId) {
    return dasar.perbarui(communityAssignmentId, { status: KONFIG.STATUS_PENUGASAN.DIHAPUS }, pelakuId);
  }

  return { ambilById: dasar.ambilById, daftarByAkhirPekan: daftarByAkhirPekan, daftarBySesi: daftarBySesi, daftarByJenis: daftarByJenis, buat: buat, hapus: hapus };
})();

// --- Log Audit — hanya boleh ditambah, tidak pernah diubah/dihapus ---
var RepoLogAudit = (function () {
  var SHEET = KONFIG.NAMA_SHEET.LOG_AUDIT;

  function buatBaris_(entri, waktu) {
    return {
      audit_id: UtilId.idBaru('audit_id'), waktu: waktu || new Date(), pelaku_id: entri.pelakuId,
      aksi: entri.aksi, jenis_entitas: entri.jenisEntitas, entitas_id: entri.entitasId,
      nilai_lama_json: entri.nilaiLama !== undefined ? JSON.stringify(entri.nilaiLama) : '',
      nilai_baru_json: entri.nilaiBaru !== undefined ? JSON.stringify(entri.nilaiBaru) : '',
      rule_id: entri.ruleId || '', alasan_override: entri.alasanOverride || '',
      versi_kebijakan: entri.versiKebijakan !== undefined ? entri.versiKebijakan : RepoPengaturanSistem.ambilVersiKebijakan()
    };
  }
  function catat(entri) {
    var baris = buatBaris_(entri);
    UtilSheet.tambahBaris(SHEET, baris);
    return baris;
  }
  function catatBanyak(daftarEntri) {
    var waktu = new Date();
    var daftarBaris = (daftarEntri || []).map(function (entri) { return buatBaris_(entri, waktu); });
    return UtilSheet.tambahBanyakBaris(SHEET, daftarBaris);
  }
  function daftarByEntitas(jenisEntitas, entitasId) {
    return UtilSheet.ambilSemuaBaris(SHEET).filter(function (r) { return r.jenis_entitas === jenisEntitas && r.entitas_id === entitasId; });
  }
  function daftarSemua() { return UtilSheet.ambilSemuaBaris(SHEET); }
  function daftarTerbaru(jumlahMaksimum) { return UtilSheet.ambilBarisTerakhir(SHEET, jumlahMaksimum); }
  function daftarHalaman(jumlahMaksimum, offset) { return UtilSheet.ambilHalamanDariAkhir(SHEET, jumlahMaksimum, offset); }

  return { catat: catat, catatBanyak: catatBanyak, daftarByEntitas: daftarByEntitas, daftarSemua: daftarSemua, daftarTerbaru: daftarTerbaru, daftarHalaman: daftarHalaman };
})();

// --- Read model ringkas untuk kandidat dan kalender ---
var LayananRingkasan = (function () {
  var VERSI_INFRASTRUKTUR = '2';
  var KUNCI_SIAP = 'performance_read_models_ready';
  var KUNCI_KOTOR = 'performance_read_models_dirty';

  function buatStatistikOrang_(daftarPenugasan) {
    var peta = {};
    (daftarPenugasan || []).forEach(function (a) {
      if (a.status !== KONFIG.STATUS_PENUGASAN.AKTIF) return;
      if (!peta[a.person_id]) peta[a.person_id] = { person_id: a.person_id, last_assigned_at: '', assignment_count: 0, updated_at: new Date() };
      var stat = peta[a.person_id];
      stat.assignment_count++;
      if (!stat.last_assigned_at || new Date(a.dibuat_pada) > new Date(stat.last_assigned_at)) stat.last_assigned_at = a.dibuat_pada;
    });
    return Object.keys(peta).map(function (id) { return peta[id]; });
  }

  function buatRingkasanSesi_(sesi, daftarPenugasan, daftarPeran) {
    var penugasanSesi = (daftarPenugasan || []).filter(function (a) {
      return a.status === KONFIG.STATUS_PENUGASAN.AKTIF && a.session_id === sesi.session_id;
    });
    var progres = LayananKonflik.hitungProgresDariDaftar(penugasanSesi, daftarPeran);
    var jumlahDibutuhkan = progres.reduce(function (jumlah, p) { return jumlah + (Number(p.dibutuhkan) || 0); }, 0);
    return {
      summary_id: 'SUM-' + sesi.session_id,
      weekend_id: sesi.weekend_id,
      session_id: sesi.session_id,
      filled_count: penugasanSesi.length,
      required_count: jumlahDibutuhkan,
      all_complete: progres.length > 0 && progres.every(function (p) { return p.status === 'TERPENUHI'; }),
      updated_at: new Date()
    };
  }

  function bangunUlang_() {
    var mulai = Date.now();
    var semuaPenugasan = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN);
    var semuaSesi = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.SESI);
    var daftarPeran = RepoKonfigPeran.daftarUrut();
    UtilSheet.gantiSemuaBaris(KONFIG.NAMA_SHEET.STATISTIK_ORANG, buatStatistikOrang_(semuaPenugasan));
    UtilSheet.gantiSemuaBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI, semuaSesi.map(function (sesi) {
      return buatRingkasanSesi_(sesi, semuaPenugasan, daftarPeran);
    }));
    PropertiesService.getScriptProperties().setProperty(KUNCI_SIAP, VERSI_INFRASTRUKTUR);
    PropertiesService.getScriptProperties().deleteProperty(KUNCI_KOTOR);
    UtilCache.bersihkanReadModelKotor();
    UtilCache.invalidasi('candidates');
    UtilCache.invalidasi('schedule');
    UtilPerforma.catat('read_models_backfill', mulai, { jumlahSesi: semuaSesi.length, jumlahPenugasan: semuaPenugasan.length });
  }

  function pastikanInfrastruktur() {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(KUNCI_SIAP) === VERSI_INFRASTRUKTUR && props.getProperty(KUNCI_KOTOR) !== '1') return false;
    var ss = UtilSheet.ambilSpreadsheet();
    pastikanSheetDenganHeader_(ss, KONFIG.NAMA_SHEET.STATISTIK_ORANG);
    pastikanSheetDenganHeader_(ss, KONFIG.NAMA_SHEET.RINGKASAN_SESI);
    return UtilKunci.denganKunciSkrip(function () {
      if (props.getProperty(KUNCI_SIAP) === VERSI_INFRASTRUKTUR && props.getProperty(KUNCI_KOTOR) !== '1') return false;
      bangunUlang_();
      return true;
    }, 30000);
  }

  function perbaruiStatistikOrang(personIds, snapshotPenugasanAktif) {
    var target = {};
    (personIds || []).forEach(function (id) { if (id) target[id] = true; });
    if (Object.keys(target).length === 0) return;
    var daftarStat = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.STATISTIK_ORANG).map(function (s) {
      var bersih = Object.assign({}, s); delete bersih.__baris; return bersih;
    });
    var petaIndeks = {};
    daftarStat.forEach(function (s, i) { petaIndeks[s.person_id] = i; });
    Object.keys(target).forEach(function (personId) {
      var aktif = (snapshotPenugasanAktif || []).filter(function (a) {
        return a.status === KONFIG.STATUS_PENUGASAN.AKTIF && a.person_id === personId;
      });
      var terbaru = '';
      aktif.forEach(function (a) { if (!terbaru || new Date(a.dibuat_pada) > new Date(terbaru)) terbaru = a.dibuat_pada; });
      var baris = { person_id: personId, last_assigned_at: terbaru, assignment_count: aktif.length, updated_at: new Date() };
      if (Object.prototype.hasOwnProperty.call(petaIndeks, personId)) daftarStat[petaIndeks[personId]] = baris;
      else daftarStat.push(baris);
    });
    UtilSheet.gantiSemuaBaris(KONFIG.NAMA_SHEET.STATISTIK_ORANG, daftarStat);
    UtilCache.invalidasi('candidates');
  }

  function perbaruiRingkasanSesi(weekendId, sessionId, snapshotPenugasanAktif) {
    var sesi = RepoSesi.ambilById(sessionId);
    if (!sesi || sesi.weekend_id !== weekendId) return;
    var ringkasan = buatRingkasanSesi_(sesi, snapshotPenugasanAktif, RepoKonfigPeran.daftarUrut());
    var existing = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI).filter(function (r) { return r.session_id === sessionId; })[0];
    if (existing) {
      var perubahan = Object.assign({}, ringkasan); delete perubahan.summary_id;
      UtilSheet.perbaruiBarisPadaNomor(KONFIG.NAMA_SHEET.RINGKASAN_SESI, existing.__baris, perubahan);
    } else {
      UtilSheet.tambahBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI, ringkasan);
    }
    UtilCache.invalidasi('schedule');
    return ringkasan;
  }

  function perbaruiBanyakSesi(weekendId, sessionIds, snapshotPenugasanAktif) {
    var target = {};
    (sessionIds || []).forEach(function (id) { if (id) target[id] = true; });
    var ids = Object.keys(target);
    if (ids.length === 0) return [];
    var sesiTarget = RepoSesi.daftarByAkhirPekan(weekendId).filter(function (s) { return target[s.session_id]; });
    var daftarPeran = RepoKonfigPeran.daftarUrut();
    var semuaRingkasan = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI)
      .filter(function (r) { return !target[r.session_id]; })
      .map(function (r) { var bersih = Object.assign({}, r); delete bersih.__baris; return bersih; });
    var baru = sesiTarget.map(function (sesi) { return buatRingkasanSesi_(sesi, snapshotPenugasanAktif, daftarPeran); });
    UtilSheet.gantiSemuaBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI, semuaRingkasan.concat(baru));
    UtilCache.bersihkanReadModelKotor();
    UtilCache.invalidasi('schedule');
    return baru;
  }

  /**
   * Sesi yang baru dibuat pasti belum mempunyai penugasan. Tambahkan
   * ringkasan nol secara append batch tanpa membaca Assignments atau
   * menulis ulang seluruh Session_Summary.
   */
  function tambahRingkasanSesiKosong(sesiList) {
    var daftar = sesiList || [];
    if (daftar.length === 0) return [];
    var daftarPeran = RepoKonfigPeran.daftarUrut();
    var ringkasan = daftar.map(function (sesi) { return buatRingkasanSesi_(sesi, [], daftarPeran); });
    UtilSheet.tambahBanyakBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI, ringkasan);
    UtilCache.invalidasi('schedule');
    return ringkasan;
  }

  function hapusRingkasanSesi(sessionId) {
    UtilSheet.hapusBarisById(KONFIG.NAMA_SHEET.RINGKASAN_SESI, 'summary_id', 'SUM-' + sessionId);
    UtilCache.invalidasi('schedule');
  }

  function petaStatistikOrang() {
    var peta = {};
    UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.STATISTIK_ORANG).forEach(function (s) { peta[s.person_id] = s; });
    return peta;
  }

  /** Kegagalan read model tidak boleh membuat pengguna mengulang core write. */
  function setelahMutasiPenugasan(weekendId, sessionId, personIds, snapshotPenugasanAktif) {
    try {
      perbaruiStatistikOrang(personIds, snapshotPenugasanAktif);
      var ringkasan = perbaruiRingkasanSesi(weekendId, sessionId, snapshotPenugasanAktif);
      UtilCache.bersihkanReadModelKotor();
      return ringkasan;
    } catch (e) {
      UtilCache.tandaiReadModelKotor();
      console.error('[READ_MODEL] akan dibangun ulang saat bootstrap berikutnya: ' + e.message);
      return null;
    }
  }

  function tandaiKotor() {
    UtilCache.tandaiReadModelKotor();
    UtilCache.invalidasi('candidates');
    UtilCache.invalidasi('schedule');
  }

  return {
    pastikanInfrastruktur: pastikanInfrastruktur,
    perbaruiStatistikOrang: perbaruiStatistikOrang,
    perbaruiRingkasanSesi: perbaruiRingkasanSesi,
    perbaruiBanyakSesi: perbaruiBanyakSesi,
    tambahRingkasanSesiKosong: tambahRingkasanSesiKosong,
    setelahMutasiPenugasan: setelahMutasiPenugasan,
    hapusRingkasanSesi: hapusRingkasanSesi,
    petaStatistikOrang: petaStatistikOrang,
    tandaiKotor: tandaiKotor
  };
})();
/* ====================================================================
 * 5. LAYANAN (SERVICE)
 * Lapisan ini yang menegakkan aturan bisnis, izin akses, dan proses
 * simpan yang aman (kunci -> muat ulang -> cek revisi -> cek aturan ->
 * simpan -> catat audit -> lepas kunci).
 * ==================================================================== */

// --- Izin akses: Admin / Penjadwal / Pelihat. Selalu dicek di server, bukan hanya disembunyikan di tampilan. ---
var LayananIzin = (function () {
  function pelakuSaatIni() { return Session.getEffectiveUser().getEmail(); }

  function ambilPeran(pelakuId) {
    var peran = RepoPengaturanSistem.get('peran_pengguna:' + pelakuId, null);
    return peran || KONFIG.IZIN.PELIHAT; // default aman: pengguna tak dikenal = hanya bisa melihat
  }

  function aturPeran(pelakuId, peran, olehPelakuId) {
    wajibkanPeran(olehPelakuId, [KONFIG.IZIN.ADMIN]);
    if (Object.values(KONFIG.IZIN).indexOf(peran) === -1) throw new Error('Peran "' + peran + '" tidak dikenal.');
    RepoPengaturanSistem.set('peran_pengguna:' + pelakuId, peran);
  }

  function wajibkanPeran(pelakuId, daftarPeranBoleh) {
    var peran = ambilPeran(pelakuId);
    if (daftarPeranBoleh.indexOf(peran) === -1) {
      throw new Error('Akses ditolak: "' + pelakuId + '" berperan "' + peran + '", butuh salah satu dari [' + daftarPeranBoleh.join(', ') + ']');
    }
    return peran;
  }

  return { pelakuSaatIni: pelakuSaatIni, ambilPeran: ambilPeran, aturPeran: aturPeran, wajibkanPeran: wajibkanPeran };
})();

// --- Mesin aturan bisnis (BR-xxx). Tidak mengunci, tidak menulis apapun — hanya menghitung/mengecek. ---
var LayananKonflik = (function () {

  function aturanAktif_(ruleId) {
    var r = RepoKonfigAturan.ambilById(ruleId);
    return !r || r.aktif !== false;
  }

  /**
   * Semua logika di bawah ini SUDAH DISAMAKAN PERSIS dengan sistem
   * Excel/VBA lama (fungsi CekBlacklist, CekWarningKoor,
   * CekWarningHiasAltar pada Master_Jadwal_Petugas_Liturgi...xlsm),
   * setelah file itu diperiksa langsung. Ini bukan tebakan lagi.
   */

  /** Wilayah yang jadi Koor Paduan Suara, dari daftar Community_Assignments yang SUDAH diambil (tidak baca sheet lagi). */
  function wilayahKoorDari_(daftarKomunitas) {
    return daftarKomunitas.filter(function (c) { return c.jenis_penugasan === KONFIG.JENIS_PENUGASAN_KOMUNITAS.PADUAN_SUARA; }).map(function (c) { return c.wilayah_id; });
  }
  function lingkunganTatibDari_(daftarKomunitas) {
    return daftarKomunitas.filter(function (c) { return c.jenis_penugasan === KONFIG.JENIS_PENUGASAN_KOMUNITAS.TATIB; }).map(function (c) { return c.lingkungan_id; }).filter(function (x) { return !!x; });
  }

  /**
   * konteks: { weekendId, sessionId, personId, roleId }
   * Hasil: { blokir: [{ruleId, pesan}], peringatan: [{ruleId, pesan}] }
   *
   * Setiap sheet yang dibutuhkan dibaca SEKALI di sini lalu dipakai ulang
   * untuk semua aturan -- dulu tiap aturan baca sheet sendiri-sendiri
   * (kadang tabel yang sama dibaca 3-4 kali), itu penyebab utama tombol
   * "Pilih" terasa lambat/tidak merespon.
   */
  function cekPenugasanIndividu(konteks) {
    var blokir = [];
    var peringatan = [];

    var orang = RepoOrang.ambilById(konteks.personId);
    if (!orang || orang.aktif !== true) {
      blokir.push({ ruleId: 'ORANG_TIDAK_AKTIF', pesan: 'Orang ini sudah tidak aktif atau tidak ditemukan.' });
      return { blokir: blokir, peringatan: peringatan };
    }

    var konfigPeran = RepoKonfigPeran.ambilById(konteks.roleId);
    var iniOrganis = !!konfigPeran && konfigPeran.nama_peran === 'Organis';

    // BR-020: kelayakan peran (baca Person_Roles SEKALI)
    var peranOrangIni = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PERAN_ORANG)
      .filter(function (pr) { return pr.person_id === konteks.personId && pr.aktif === true; });
    var layak = peranOrangIni.some(function (pr) { return pr.role_id === konteks.roleId; });
    if (!layak) {
      blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_020_KELAYAKAN_PERAN, pesan: 'Orang ini belum memiliki peran tersebut.' });
    }

    // Baca Assignments akhir pekan ini SEKALI, dipakai untuk BR-026 & BR-030 sekaligus.
    var penugasanAkhirPekanIni = RepoPenugasan.daftarByAkhirPekan(konteks.weekendId);

    // BR-026: kapasitas kuota (per sesi)
    if (konfigPeran) {
      var jumlahSekarang = penugasanAkhirPekanIni.filter(function (a) { return a.session_id === konteks.sessionId && a.role_id === konteks.roleId; }).length;
      if (jumlahSekarang >= Number(konfigPeran.jumlah_maksimal)) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_026_KAPASITAS_KUOTA, pesan: 'Kuota peran (' + konfigPeran.jumlah_maksimal + ') untuk sesi ini sudah penuh.' });
      }
    }

    // Organis DIKECUALIKAN dari dua aturan di bawah (persis sistem lama:
    // RULE 0 dan RULE 2 pada CekBlacklist hanya berlaku "Not IsOrganis").
    if (!iniOrganis) {
      // BR-030/031: orang yang sama sudah bertugas di akhir pekan ini (sesi manapun)
      var sudahBertugasAkhirPekanIni = penugasanAkhirPekanIni.some(function (a) { return a.person_id === konteks.personId; });
      if (sudahBertugasAkhirPekanIni) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_030_DUPLIKAT_SESI, pesan: 'Orang ini sudah bertugas di akhir pekan ini (tidak boleh dobel, kecuali Organis).' });
      }

      // Aturan keadilan: Wilayah orang ini sedang jadi Koor Paduan Suara akhir pekan ini
      // -> tidak boleh isi peran lain di akhir pekan yang sama (kecuali Organis).
      var wilayahOrang = RepoOrang.ambilWilayahId(konteks.personId);
      var komunitasAkhirPekanIni = RepoPenugasanKomunitas.daftarByAkhirPekan(konteks.weekendId);
      if (wilayahOrang && wilayahKoorDari_(komunitasAkhirPekanIni).indexOf(wilayahOrang) !== -1) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_013_BLACKLIST_PADUAN_SUARA, pesan: 'Wilayah orang ini sedang bertugas Paduan Suara akhir pekan ini, jadi tidak bisa mengisi peran lain (kecuali Organis).' });
      }
    }

    // BR-032: bertugas dua akhir pekan berturut-turut — berlaku untuk SEMUA orang, termasuk Organis.
    if (aturanAktif_(KONFIG.ATURAN_BISNIS.BR_032_LAYANAN_BERTURUT)) {
      var tetangga = RepoAkhirPekan.ambilTetangga(konteks.weekendId);
      var bertugasDiTetangga = [tetangga.sebelum, tetangga.sesudah].some(function (w) {
        if (!w) return false;
        return RepoPenugasan.daftarByAkhirPekan(w.weekend_id).some(function (a) { return a.person_id === konteks.personId; });
      });
      if (bertugasDiTetangga) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_032_LAYANAN_BERTURUT, pesan: 'Orang ini bertugas di akhir pekan sebelum/sesudahnya (tidak boleh berturut-turut).' });
      }
    }

    return { blokir: blokir, peringatan: peringatan };
  }

  /**
   * konteks: { weekendId, sessionId, jenisPenugasan, wilayahId, lingkunganId }
   * Sama seperti di atas: Community_Assignments akhir pekan ini (dan
   * tetangganya) dibaca SEKALI, dipakai ulang untuk semua aturan di bawah.
   */
  function cekPenugasanKomunitas(konteks) {
    var blokir = [];
    var peringatan = [];
    var jenis = konteks.jenisPenugasan;

    var komunitasAkhirPekanIni = RepoPenugasanKomunitas.daftarByAkhirPekan(konteks.weekendId);
    var perluTetangga = (jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.PADUAN_SUARA && aturanAktif_(KONFIG.ATURAN_BISNIS.BR_013_BLACKLIST_PADUAN_SUARA)) ||
      (jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.TATIB && aturanAktif_(KONFIG.ATURAN_BISNIS.BR_041_KONFLIK_TATIB));
    var tetangga = perluTetangga ? RepoAkhirPekan.ambilTetangga(konteks.weekendId) : { sebelum: null, sesudah: null };
    var komunitasSebelum = tetangga.sebelum ? RepoPenugasanKomunitas.daftarByAkhirPekan(tetangga.sebelum.weekend_id) : [];
    var komunitasSesudah = tetangga.sesudah ? RepoPenugasanKomunitas.daftarByAkhirPekan(tetangga.sesudah.weekend_id) : [];

    if (jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.PADUAN_SUARA) {
      // BLOKIR: Wilayah ini sudah jadi Koor di sesi lain akhir pekan yang sama.
      if (wilayahKoorDari_(komunitasAkhirPekanIni).indexOf(konteks.wilayahId) !== -1) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_013_BLACKLIST_PADUAN_SUARA, pesan: 'Wilayah ini sudah bertugas Paduan Suara di sesi lain pada akhir pekan yang sama.' });
      }
      // BLOKIR: Wilayah ini jadi Koor di akhir pekan berturut-turut (sebelum/sesudah).
      var koorBerturut = [komunitasSebelum, komunitasSesudah].some(function (daftar) { return wilayahKoorDari_(daftar).indexOf(konteks.wilayahId) !== -1; });
      if (aturanAktif_(KONFIG.ATURAN_BISNIS.BR_013_BLACKLIST_PADUAN_SUARA) && koorBerturut) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_013_BLACKLIST_PADUAN_SUARA, pesan: 'Wilayah ini bertugas Paduan Suara di akhir pekan sebelum/sesudahnya (tidak boleh berturut-turut).' });
      }
      // PERINGATAN: Wilayah ini juga sedang Hias Altar akhir pekan ini.
      var hiasAltarAkhirPekanIni = komunitasAkhirPekanIni.filter(function (c) { return c.jenis_penugasan === KONFIG.JENIS_PENUGASAN_KOMUNITAS.HIAS_ALTAR; });
      if (hiasAltarAkhirPekanIni.some(function (c) { return c.wilayah_id === konteks.wilayahId; })) {
        peringatan.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_052_TUMPANG_TINDIH_PS_HIAS_ALTAR, pesan: 'Wilayah ini sudah bertugas sebagai Hias Altar akhir pekan ini.' });
      }
    }

    if (jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.TATIB && aturanAktif_(KONFIG.ATURAN_BISNIS.BR_041_KONFLIK_TATIB)) {
      // BLOKIR: Lingkungan ini sudah jadi Tatib di sesi lain akhir pekan yang sama.
      if (konteks.lingkunganId && lingkunganTatibDari_(komunitasAkhirPekanIni).indexOf(konteks.lingkunganId) !== -1) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_041_KONFLIK_TATIB, pesan: 'Lingkungan ini sudah bertugas Tatib di sesi lain pada akhir pekan yang sama.' });
      }
      // BLOKIR: Wilayah dari Lingkungan ini sedang jadi Koor Paduan Suara akhir pekan ini.
      if (wilayahKoorDari_(komunitasAkhirPekanIni).indexOf(konteks.wilayahId) !== -1) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_041_KONFLIK_TATIB, pesan: 'Wilayah dari Lingkungan ini sudah bertugas Paduan Suara akhir pekan ini (bentrok dengan Tatib).' });
      }
      // BLOKIR: Lingkungan ini jadi Tatib di akhir pekan berturut-turut (sebelum/sesudah).
      var tatibBerulang = konteks.lingkunganId && [komunitasSebelum, komunitasSesudah].some(function (daftar) { return lingkunganTatibDari_(daftar).indexOf(konteks.lingkunganId) !== -1; });
      if (tatibBerulang) {
        blokir.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_041_KONFLIK_TATIB, pesan: 'Lingkungan ini bertugas Tatib di akhir pekan sebelum/sesudahnya (tidak boleh berturut-turut).' });
      }
    }

    if (jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.HIAS_ALTAR) {
      // PERINGATAN: Wilayah ini juga sedang Koor Paduan Suara akhir pekan ini.
      if (wilayahKoorDari_(komunitasAkhirPekanIni).indexOf(konteks.wilayahId) !== -1) {
        peringatan.push({ ruleId: KONFIG.ATURAN_BISNIS.BR_052_TUMPANG_TINDIH_PS_HIAS_ALTAR, pesan: 'Wilayah ini sudah bertugas Paduan Suara akhir pekan ini.' });
      }
    }

    return { blokir: blokir, peringatan: peringatan };
  }

  /** BR-034: terakhir bertugas, diambil dari riwayat penugasan. */
  function ambilTerakhirBertugas(personId) {
    var riwayat = RepoPenugasan.daftarByOrang(personId, false);
    return riwayat.length > 0 ? riwayat[0] : null;
  }

  /** BR-027: saran orang yang paling lama/jarang bertugas (Least Recently Used). */
  function saranLru(roleId) {
    var kandidat = RepoPeranOrang.daftarByPeran(roleId, false)
      .map(function (pr) { return RepoOrang.ambilById(pr.person_id); })
      .filter(function (p) { return p && p.aktif === true; });

    kandidat.sort(function (a, b) {
      var terakhirA = ambilTerakhirBertugas(a.person_id);
      var terakhirB = ambilTerakhirBertugas(b.person_id);
      var waktuA = terakhirA ? new Date(terakhirA.dibuat_pada).getTime() : 0; // belum pernah bertugas = paling diutamakan
      var waktuB = terakhirB ? new Date(terakhirB.dibuat_pada).getTime() : 0;
      return waktuA - waktuB;
    });
    return kandidat;
  }

  /** BR-062: status progres, dihitung dari penugasan yang ada vs kebutuhan. Membaca sheet sendiri -- cocok untuk pemakaian sesekali. */
  function hitungProgresSesi(sessionId) {
    return hitungProgresDariDaftar(RepoPenugasan.daftarBySesi(sessionId), RepoKonfigPeran.daftar(true));
  }

  /**
   * Versi hemat baca dari hitungProgresSesi: menghitung progres dari
   * data yang SUDAH diambil sebelumnya (tidak baca sheet lagi). Dipakai
   * saat menampilkan banyak sesi/akhir pekan sekaligus (laporan, tampilan
   * kalender), supaya tidak baca ulang sheet Assignments/Role_Config
   * berkali-kali -- itu penyebab utama tampilan jadi lambat.
   */
  function hitungProgresDariDaftar(daftarPenugasanSesi, daftarPeran) {
    return daftarPeran.map(function (peran) {
      var jumlahTerisi = daftarPenugasanSesi.filter(function (a) { return a.role_id === peran.role_id; }).length;
      var dibutuhkan = Number(peran.jumlah_dibutuhkan);
      return { roleId: peran.role_id, namaPeran: peran.nama_peran, dibutuhkan: dibutuhkan, terisi: jumlahTerisi, status: jumlahTerisi >= dibutuhkan ? 'TERPENUHI' : 'BELUM_LENGKAP' };
    });
  }

  return { cekPenugasanIndividu: cekPenugasanIndividu, cekPenugasanKomunitas: cekPenugasanKomunitas, ambilTerakhirBertugas: ambilTerakhirBertugas, saranLru: saranLru, hitungProgresSesi: hitungProgresSesi, hitungProgresDariDaftar: hitungProgresDariDaftar };
})();

// --- Proses simpan yang aman (satu-satunya jalan mengubah data Akhir Pekan/Sesi/Penugasan) ---
var LayananPenjadwalan = (function () {

  function sesiKhususYangValid_(sessionId, weekendId) {
    var sesi = RepoSesi.ambilById(sessionId);
    return !!sesi && sesi.weekend_id === weekendId && sesi.jenis_sesi === KONFIG.JENIS_SESI.KHUSUS;
  }

  function tugaskanIndividu(params) {
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };

      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var orang = RepoOrang.ambilById(params.personId);
      if (!orang || orang.aktif !== true) return { berhasil: false, alasan: 'ORANG_TIDAK_AKTIF' };

      var sesiKhusus = sesiKhususYangValid_(params.sessionId, params.weekendId);
      var hasilCek = sesiKhusus
        ? { blokir: [], peringatan: [] }
        : LayananKonflik.cekPenugasanIndividu({ weekendId: params.weekendId, sessionId: params.sessionId, personId: params.personId, roleId: params.roleId });
      if (hasilCek.blokir.length > 0) return { berhasil: false, alasan: 'DIBLOKIR', blokir: hasilCek.blokir };

      if (hasilCek.peringatan.length > 0) {
        if (peranPelaku !== KONFIG.IZIN.ADMIN) return { berhasil: false, alasan: 'PERINGATAN', peringatan: hasilCek.peringatan };
        if (!params.konfirmasiPeringatan) return { berhasil: false, alasan: 'PERINGATAN', peringatan: hasilCek.peringatan };
      }

      var penugasanSebelum = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN)
        .filter(function (a) { return a.status === KONFIG.STATUS_PENUGASAN.AKTIF; });

      var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, params.pelakuId);
      if (!hasilRevisi.berhasil) return hasilRevisi;

      var penugasan = RepoPenugasan.buat({ weekend_id: params.weekendId, session_id: params.sessionId, person_id: params.personId, role_id: params.roleId }, params.pelakuId);

      RepoLogAudit.catat({
        pelakuId: params.pelakuId, aksi: 'TAMBAH_PENUGASAN', jenisEntitas: 'Assignment', entitasId: penugasan.assignment_id,
        nilaiBaru: penugasan, alasanOverride: hasilCek.peringatan.length > 0 ? params.alasanOverride : undefined
      });

      var ringkasanSesi = LayananRingkasan.setelahMutasiPenugasan(
        params.weekendId, params.sessionId, [params.personId], penugasanSebelum.concat([penugasan])
      );
      return { berhasil: true, penugasan: penugasan, akhirPekan: hasilRevisi.akhirPekan, ringkasanSesi: ringkasanSesi };
    });
  }

  /**
   * Menyimpan beberapa petugas untuk satu sesi/peran dalam satu kunci,
   * satu pemeriksaan revisi, dan satu batch write. Tidak ada data yang
   * ditulis bila salah satu pilihan diblokir oleh aturan bisnis.
   */
  function tugaskanIndividuBatch(params) {
    var mulaiProses = Date.now();
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);
    var personIds = [];
    var sudahDipilih = {};
    (params.personIds || []).forEach(function (personId) {
      var id = String(personId || '').trim();
      if (id && !sudahDipilih[id]) { sudahDipilih[id] = true; personIds.push(id); }
    });
    if (personIds.length === 0) return { berhasil: false, alasan: 'PILIHAN_KOSONG' };
    if (personIds.length > 20) return { berhasil: false, alasan: 'TERLALU_BANYAK', pesan: 'Maksimal 20 petugas dalam satu penyimpanan.' };

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var sesi = RepoSesi.ambilById(params.sessionId);
      var konfigPeran = RepoKonfigPeran.ambilById(params.roleId);
      if (!sesi || sesi.weekend_id !== params.weekendId || !konfigPeran || konfigPeran.aktif !== true) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Sesi atau peran tidak valid/tidak aktif.' };
      }

      var penugasanAkhirPekan = RepoPenugasan.daftarByAkhirPekan(params.weekendId);
      var semuaPenugasanAktif = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN)
        .filter(function (a) { return a.status === KONFIG.STATUS_PENUGASAN.AKTIF; });
      var sesiKhusus = sesi.jenis_sesi === KONFIG.JENIS_SESI.KHUSUS;
      var jumlahSekarang = penugasanAkhirPekan.filter(function (a) {
        return a.session_id === params.sessionId && a.role_id === params.roleId;
      }).length;
      var kapasitas = Number(konfigPeran.jumlah_maksimal) || 0;
      if (jumlahSekarang + personIds.length > kapasitas) {
        return {
          berhasil: false,
          alasan: 'DIBLOKIR',
          blokir: [{ ruleId: KONFIG.ATURAN_BISNIS.BR_026_KAPASITAS_KUOTA, pesan: 'Pilihan melebihi sisa kuota. Tersedia ' + Math.max(0, kapasitas - jumlahSekarang) + ' tempat.' }]
        };
      }

      var semuaBlokir = [];
      var semuaPeringatan = [];
      personIds.forEach(function (personId) {
        var orang = RepoOrang.ambilById(personId);
        var namaOrang = orang && orang.nama ? orang.nama : personId;
        var duplikatSamaPersis = penugasanAkhirPekan.some(function (a) {
          return a.session_id === params.sessionId && a.role_id === params.roleId && a.person_id === personId;
        });
        if (duplikatSamaPersis) {
          semuaBlokir.push({ ruleId: 'DUPLIKAT_PENUGASAN', personId: personId, pesan: namaOrang + ': sudah terdaftar pada sesi dan peran ini.' });
          return;
        }

        var hasilCek = sesiKhusus ? { blokir: [], peringatan: [] } : LayananKonflik.cekPenugasanIndividu({
          weekendId: params.weekendId,
          sessionId: params.sessionId,
          personId: personId,
          roleId: params.roleId
        });
        hasilCek.blokir.forEach(function (b) {
          semuaBlokir.push({ ruleId: b.ruleId, personId: personId, pesan: namaOrang + ': ' + b.pesan });
        });
        hasilCek.peringatan.forEach(function (p) {
          semuaPeringatan.push({ ruleId: p.ruleId, personId: personId, pesan: namaOrang + ': ' + p.pesan });
        });
      });

      if (semuaBlokir.length > 0) return { berhasil: false, alasan: 'DIBLOKIR', blokir: semuaBlokir };
      if (semuaPeringatan.length > 0 && (peranPelaku !== KONFIG.IZIN.ADMIN || !params.konfirmasiPeringatan)) {
        return { berhasil: false, alasan: 'PERINGATAN', peringatan: semuaPeringatan };
      }

      var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, params.pelakuId);
      if (!hasilRevisi.berhasil) return hasilRevisi;

      var daftarPenugasan = RepoPenugasan.buatBanyak(personIds.map(function (personId) {
        return { weekend_id: params.weekendId, session_id: params.sessionId, person_id: personId, role_id: params.roleId };
      }), params.pelakuId);

      var versiKebijakan = RepoPengaturanSistem.ambilVersiKebijakan();
      RepoLogAudit.catatBanyak(daftarPenugasan.map(function (penugasan) {
        return {
          pelakuId: params.pelakuId,
          aksi: 'TAMBAH_PENUGASAN',
          jenisEntitas: 'Assignment',
          entitasId: penugasan.assignment_id,
          nilaiBaru: penugasan,
          alasanOverride: semuaPeringatan.length > 0 ? params.alasanOverride : undefined,
          versiKebijakan: versiKebijakan
        };
      }));

      var snapshotSetelah = semuaPenugasanAktif.concat(daftarPenugasan);
      var ringkasanSesi = LayananRingkasan.setelahMutasiPenugasan(
        params.weekendId, params.sessionId, personIds, snapshotSetelah
      );

      var durasiMs = Date.now() - mulaiProses;
      console.log('[PERF] simpan batch petugas: ' + durasiMs + ' ms; ' + daftarPenugasan.length + ' orang');
      return {
        berhasil: true,
        jumlahTersimpan: daftarPenugasan.length,
        assignmentIds: daftarPenugasan.map(function (a) { return a.assignment_id; }),
        penugasan: daftarPenugasan.map(function (a) {
          return { assignmentId: a.assignment_id, personId: a.person_id, roleId: a.role_id, sessionId: a.session_id };
        }),
        revisiBaru: hasilRevisi.akhirPekan.revisi,
        ringkasanSesi: ringkasanSesi,
        durasiMs: durasiMs
      };
    });
  }

  function hapusPenugasanIndividu(params) {
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var existing = RepoPenugasan.ambilById(params.assignmentId);
      if (!existing) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      var penugasanSebelum = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENUGASAN)
        .filter(function (a) { return a.status === KONFIG.STATUS_PENUGASAN.AKTIF; });

      var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, params.pelakuId);
      if (!hasilRevisi.berhasil) return hasilRevisi;

      var dihapus = RepoPenugasan.hapus(params.assignmentId, params.pelakuId);
      RepoLogAudit.catat({ pelakuId: params.pelakuId, aksi: 'HAPUS_PENUGASAN', jenisEntitas: 'Assignment', entitasId: params.assignmentId, nilaiLama: existing, nilaiBaru: dihapus });

      var snapshotSetelah = penugasanSebelum.filter(function (a) { return a.assignment_id !== params.assignmentId; });
      var ringkasanSesi = LayananRingkasan.setelahMutasiPenugasan(
        params.weekendId, existing.session_id, [existing.person_id], snapshotSetelah
      );

      return { berhasil: true, penugasan: dihapus, akhirPekan: hasilRevisi.akhirPekan, ringkasanSesi: ringkasanSesi };
    });
  }

  function tugaskanKomunitas(params) {
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var komunitasSama = RepoPenugasanKomunitas.daftarByAkhirPekan(params.weekendId).some(function (c) {
        return (c.session_id || '') === (params.sessionId || '') &&
          c.jenis_penugasan === params.jenisPenugasan &&
          c.wilayah_id === params.wilayahId &&
          (c.lingkungan_id || '') === (params.lingkunganId || '');
      });
      if (komunitasSama) {
        return { berhasil: false, alasan: 'DIBLOKIR', blokir: [{ ruleId: 'DUPLIKAT_PENUGASAN', pesan: 'Penugasan komunitas ini sudah dipilih untuk sesi tersebut.' }] };
      }

      var sesiKhusus = params.sessionId && sesiKhususYangValid_(params.sessionId, params.weekendId);
      var hasilCek = sesiKhusus
        ? { blokir: [], peringatan: [] }
        : LayananKonflik.cekPenugasanKomunitas({ weekendId: params.weekendId, sessionId: params.sessionId, jenisPenugasan: params.jenisPenugasan, wilayahId: params.wilayahId, lingkunganId: params.lingkunganId });
      if (hasilCek.blokir.length > 0) return { berhasil: false, alasan: 'DIBLOKIR', blokir: hasilCek.blokir };

      if (hasilCek.peringatan.length > 0) {
        if (peranPelaku !== KONFIG.IZIN.ADMIN) return { berhasil: false, alasan: 'PERINGATAN', peringatan: hasilCek.peringatan };
        if (!params.konfirmasiPeringatan) return { berhasil: false, alasan: 'PERINGATAN', peringatan: hasilCek.peringatan };
        if (!params.alasanOverride) return { berhasil: false, alasan: 'ALASAN_OVERRIDE_WAJIB', peringatan: hasilCek.peringatan };
      }

      var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, params.pelakuId);
      if (!hasilRevisi.berhasil) return hasilRevisi;

      var penugasanKomunitas = RepoPenugasanKomunitas.buat({
        weekend_id: params.weekendId, session_id: params.sessionId || '', jenis_penugasan: params.jenisPenugasan,
        wilayah_id: params.wilayahId, lingkungan_id: params.lingkunganId || '',
        alasan_override: hasilCek.peringatan.length > 0 ? (params.alasanOverride || '') : ''
      }, params.pelakuId);

      RepoLogAudit.catat({
        pelakuId: params.pelakuId, aksi: 'TAMBAH_PENUGASAN_KOMUNITAS', jenisEntitas: 'Community_Assignment', entitasId: penugasanKomunitas.community_assignment_id,
        nilaiBaru: penugasanKomunitas, alasanOverride: hasilCek.peringatan.length > 0 ? params.alasanOverride : undefined
      });

      return { berhasil: true, penugasanKomunitas: penugasanKomunitas, akhirPekan: hasilRevisi.akhirPekan };
    });
  }

  /** params: { communityAssignmentId, weekendId, revisiYangDiharapkan, pelakuId } */
  function hapusPenugasanKomunitas(params) {
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var existing = RepoPenugasanKomunitas.ambilById(params.communityAssignmentId);
      if (!existing) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };

      var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, params.pelakuId);
      if (!hasilRevisi.berhasil) return hasilRevisi;

      var dihapus = RepoPenugasanKomunitas.hapus(params.communityAssignmentId, params.pelakuId);

      RepoLogAudit.catat({
        pelakuId: params.pelakuId, aksi: 'HAPUS_PENUGASAN_KOMUNITAS', jenisEntitas: 'Community_Assignment',
        entitasId: params.communityAssignmentId, nilaiLama: existing, nilaiBaru: dihapus
      });

      return { berhasil: true, penugasanKomunitas: dihapus, akhirPekan: hasilRevisi.akhirPekan };
    });
  }

  /** params: { sessionId, weekendId, revisiYangDiharapkan, pelakuId } -- hanya untuk sesi jenis KHUSUS, dan hanya kalau belum ada penugasan sama sekali. */
  function hapusSesiKhusus(params) {
    var peranPelaku = LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL && peranPelaku !== KONFIG.IZIN.ADMIN) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Akhir pekan sudah difinalkan; Penjadwal tidak bisa mengubahnya.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      try {
        RepoSesi.hapusSesiKhusus(params.sessionId);
      } catch (e) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: e.message };
      }

      try { LayananRingkasan.hapusRingkasanSesi(params.sessionId); }
      catch (eRingkasan) { LayananRingkasan.tandaiKotor(); }

      RepoLogAudit.catat({ pelakuId: params.pelakuId, aksi: 'HAPUS_SESI_KHUSUS', jenisEntitas: 'Session', entitasId: params.sessionId });

      return { berhasil: true, akhirPekan: akhirPekan };
    });
  }

  /**
   * Menghapus satu sesi yang belum final beserta penugasan aktifnya.
   * Hanya Admin yang boleh melakukan aksi ini. Penugasan di-soft-delete
   * agar riwayat tetap dapat diaudit; baris sesi dan wadah kosong dihapus.
   */
  function hapusSesiDraft(params) {
    var pelakuId = params.pelakuId;
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);

    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: 'Jadwal final tidak boleh dihapus. Buka kunci jadwal lebih dulu.' };
      }
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) {
        return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };
      }

      var sesi = RepoSesi.ambilById(params.sessionId);
      if (!sesi || sesi.weekend_id !== params.weekendId) {
        return { berhasil: false, alasan: 'TIDAK_DITEMUKAN', pesan: 'Sesi tidak ditemukan pada jadwal ini.' };
      }

      var penugasanIndividu = RepoPenugasan.daftarBySesi(params.sessionId).slice();
      var penugasanKomunitas = RepoPenugasanKomunitas.daftarBySesi(params.sessionId).slice();
      penugasanIndividu.forEach(function (a) { RepoPenugasan.hapus(a.assignment_id, pelakuId); });
      penugasanKomunitas.forEach(function (c) { RepoPenugasanKomunitas.hapus(c.community_assignment_id, pelakuId); });
      RepoSesi.hapusSesiDraft(params.sessionId);
      try { LayananRingkasan.hapusRingkasanSesi(params.sessionId); }
      catch (eRingkasan) { console.error('[READ_MODEL] gagal menghapus ringkasan sesi: ' + eRingkasan.message); }
      LayananRingkasan.tandaiKotor();

      var sisaSesi = RepoSesi.daftarByAkhirPekan(params.weekendId);
      // Jangan ikut menghapus penugasan tingkat jadwal (mis. Hias Altar)
      // karena permintaan pengguna hanya mencakup sesi yang dipilih.
      var adaPenugasanTingkatJadwal = RepoPenugasanKomunitas.daftarByAkhirPekan(params.weekendId)
        .some(function (c) { return !c.session_id; });
      var akhirPekanDihapus = sisaSesi.length === 0 && !adaPenugasanTingkatJadwal;
      var akhirPekanBaru = null;
      if (akhirPekanDihapus) {
        RepoAkhirPekan.hapusDraftKosong(params.weekendId);
      } else {
        var hasilRevisi = RepoAkhirPekan.perbaruiDenganCekRevisi(params.weekendId, params.revisiYangDiharapkan, {}, pelakuId);
        if (!hasilRevisi.berhasil) return hasilRevisi;
        akhirPekanBaru = hasilRevisi.akhirPekan;
      }

      RepoLogAudit.catat({
        pelakuId: pelakuId,
        aksi: 'HAPUS_SESI_DRAFT',
        jenisEntitas: 'Session',
        entitasId: params.sessionId,
        nilaiLama: sesi,
        nilaiBaru: {
          weekendId: params.weekendId,
          akhirPekanDihapus: akhirPekanDihapus,
          jumlahPenugasanIndividuDibatalkan: penugasanIndividu.length,
          jumlahPenugasanKomunitasDibatalkan: penugasanKomunitas.length
        }
      });

      return {
        berhasil: true,
        sessionId: params.sessionId,
        akhirPekanDihapus: akhirPekanDihapus,
        akhirPekan: akhirPekanBaru,
        jumlahPenugasanDibatalkan: penugasanIndividu.length + penugasanKomunitas.length
      };
    });
  }

  /** params: { sessionId, weekendId, namaKhusus, tanggalSesi, pelakuId } */
  function perbaruiSesiKhusus(params) {
    LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var sebelum = RepoSesi.ambilById(params.sessionId);
      if (!sebelum) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };

      var perubahan = {};
      if (params.namaKhusus) perubahan.nama_khusus = params.namaKhusus;
      if (params.tanggalSesi) perubahan.tanggal_sesi = params.tanggalSesi;

      var sesudah;
      try {
        sesudah = RepoSesi.perbaruiSesiKhusus(params.sessionId, perubahan, params.pelakuId);
      } catch (e) {
        return { berhasil: false, alasan: 'DITOLAK', pesan: e.message };
      }

      RepoLogAudit.catat({ pelakuId: params.pelakuId, aksi: 'UBAH_SESI_KHUSUS', jenisEntitas: 'Session', entitasId: params.sessionId, nilaiLama: sebelum, nilaiBaru: sesudah });

      return { berhasil: true, sesi: sesudah };
    });
  }

  function finalkanAkhirPekan(params) {
    LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN]);
    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };

      var hasil = RepoAkhirPekan.finalkan(params.weekendId, params.revisiYangDiharapkan, params.pelakuId);
      if (!hasil.berhasil) return hasil;

      RepoLogAudit.catat({ pelakuId: params.pelakuId, aksi: 'FINALKAN_AKHIR_PEKAN', jenisEntitas: 'Weekend', entitasId: params.weekendId, nilaiLama: akhirPekan, nilaiBaru: hasil.akhirPekan });
      return { berhasil: true, akhirPekan: hasil.akhirPekan };
    });
  }

  function bukaKembaliAkhirPekan(params) {
    LayananIzin.wajibkanPeran(params.pelakuId, [KONFIG.IZIN.ADMIN]);
    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilById(params.weekendId);
      if (!akhirPekan) return { berhasil: false, alasan: 'TIDAK_DITEMUKAN' };
      if (Number(akhirPekan.revisi) !== Number(params.revisiYangDiharapkan)) return { berhasil: false, alasan: 'REVISI_KEDALUWARSA', current: akhirPekan };

      var hasil = RepoAkhirPekan.bukaKembali(params.weekendId, params.revisiYangDiharapkan, params.pelakuId);
      if (!hasil.berhasil) return hasil;

      RepoLogAudit.catat({ pelakuId: params.pelakuId, aksi: 'BUKA_KEMBALI_AKHIR_PEKAN', jenisEntitas: 'Weekend', entitasId: params.weekendId, nilaiLama: akhirPekan, nilaiBaru: hasil.akhirPekan });
      return { berhasil: true, akhirPekan: hasil.akhirPekan };
    });
  }

  return {
    tugaskanIndividu: tugaskanIndividu, tugaskanIndividuBatch: tugaskanIndividuBatch, hapusPenugasanIndividu: hapusPenugasanIndividu,
    tugaskanKomunitas: tugaskanKomunitas, hapusPenugasanKomunitas: hapusPenugasanKomunitas,
    hapusSesiKhusus: hapusSesiKhusus, hapusSesiDraft: hapusSesiDraft, perbaruiSesiKhusus: perbaruiSesiKhusus,
    finalkanAkhirPekan: finalkanAkhirPekan, bukaKembaliAkhirPekan: bukaKembaliAkhirPekan
  };
})();

// --- Kelola Petugas (People/Wilayah/Lingkungan) — mengubah data hanya boleh Admin ---
var LayananOrang = (function () {
  /**
   * Kandidat penjadwalan dimuat sebagai SATU snapshot ringkas.
   *
   * Tujuannya: browser cukup menerima People + role eligibility sekali,
   * lalu pencarian nama dan filter peran dilakukan lokal di browser.
   * Server TETAP memvalidasi ulang semua aturan ketika tombol "Pilih"
   * benar-benar disimpan, jadi optimasi ini tidak mengurangi keamanan
   * atau keutuhan aturan bisnis.
   *
   * Semua tanggal diubah menjadi string ISO sebelum dikirim lewat
   * google.script.run. Ini menghindari pengiriman object Date mentah ke
   * browser, yang dapat menyebabkan response gagal diserialisasi.
   */
  function ambilSemuaKandidatRingkas() {
    return UtilCache.ambilAtauHitung('candidates', 'all', function () {
    var daftarOrang = RepoOrang.daftar(false);
    var daftarLingkungan = RepoLingkungan.daftar(true);
    var daftarWilayah = RepoWilayah.daftar(true);
    var petaLingkungan = {};
    var petaWilayah = {};
    daftarLingkungan.forEach(function (l) { petaLingkungan[l.lingkungan_id] = l; });
    daftarWilayah.forEach(function (w) { petaWilayah[w.wilayah_id] = w; });

    var peranPerOrang = {};
    UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PERAN_ORANG).forEach(function (pr) {
      if (pr.aktif !== true) return;
      if (!peranPerOrang[pr.person_id]) peranPerOrang[pr.person_id] = [];
      peranPerOrang[pr.person_id].push(pr.role_id);
    });

    var petaStatistik = LayananRingkasan.petaStatistikOrang();

    function tanggalIsoAman_(nilai) {
      if (!nilai) return null;
      var d = new Date(nilai);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    return daftarOrang.map(function (p) {
      var lingkungan = petaLingkungan[p.lingkungan_id] || null;
      var wilayah = lingkungan ? (petaWilayah[lingkungan.wilayah_id] || null) : null;
      return {
        personId: p.person_id,
        nama: p.nama,
        aktif: p.aktif,
        lingkunganId: lingkungan ? lingkungan.lingkungan_id : '',
        namaLingkungan: lingkungan ? lingkungan.nama : 'Tanpa Lingkungan',
        wilayahId: wilayah ? wilayah.wilayah_id : '',
        namaWilayah: wilayah ? wilayah.nama : 'Tanpa Wilayah',
        roleIds: peranPerOrang[p.person_id] || [],
        terakhirBertugas: tanggalIsoAman_(petaStatistik[p.person_id] && petaStatistik[p.person_id].last_assigned_at)
      };
    });
    });
  }

  /**
   * Endpoint lama tetap dipertahankan untuk kompatibilitas.
   * Sekarang ia memakai snapshot ringkas di atas dan mengembalikan
   * tanggal yang sudah aman untuk dikirim ke browser.
   */
  function cariKandidat(kataKunci, roleId) {
    var q = (kataKunci || '').toString().toLowerCase();

    return ambilSemuaKandidatRingkas().filter(function (p) {
      var cocokNama = !q || (p.nama && p.nama.toString().toLowerCase().indexOf(q) !== -1);
      var cocokPeran = !roleId || p.roleIds.indexOf(roleId) !== -1;
      return cocokNama && cocokPeran;
    });
  }

  function buatOrang(data, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var orang = RepoOrang.buat(data, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'TAMBAH_ORANG', jenisEntitas: 'Person', entitasId: orang.person_id, nilaiBaru: orang });
    return orang;
  }
  function perbaruiOrang(personId, perubahan, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoOrang.ambilById(personId);
    var sesudah = RepoOrang.perbarui(personId, perubahan, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'UBAH_ORANG', jenisEntitas: 'Person', entitasId: personId, nilaiLama: sebelum, nilaiBaru: sesudah });
    return sesudah;
  }
  function nonaktifkanOrang(personId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoOrang.ambilById(personId);
    var sesudah = RepoOrang.nonaktifkan(personId, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'NONAKTIFKAN_ORANG', jenisEntitas: 'Person', entitasId: personId, nilaiLama: sebelum, nilaiBaru: sesudah });
    return sesudah;
  }
  function berikanPeran(personId, roleId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var diberikan = RepoPeranOrang.berikan(personId, roleId, pelakuId);
    if (diberikan) RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'BERIKAN_PERAN', jenisEntitas: 'Person_Role', entitasId: diberikan.person_role_id, nilaiBaru: diberikan });
    return diberikan;
  }
  function cabutPeran(personRoleId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoPeranOrang.ambilById(personRoleId);
    var sesudah = RepoPeranOrang.cabut(personRoleId, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'CABUT_PERAN', jenisEntitas: 'Person_Role', entitasId: personRoleId, nilaiLama: sebelum, nilaiBaru: sesudah });
    return sesudah;
  }
  function buatWilayah(data, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var wilayah = RepoWilayah.buat(data, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'TAMBAH_WILAYAH', jenisEntitas: 'Wilayah', entitasId: wilayah.wilayah_id, nilaiBaru: wilayah });
    return wilayah;
  }
  function buatLingkungan(data, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var lingkungan = RepoLingkungan.buat(data, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'TAMBAH_LINGKUNGAN', jenisEntitas: 'Lingkungan', entitasId: lingkungan.lingkungan_id, nilaiBaru: lingkungan });
    return lingkungan;
  }
  /** Wilayah tetap ada di riwayat (penugasan lama tidak berubah), cuma tidak muncul lagi di pilihan baru. */
  function nonaktifkanWilayah(wilayahId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoWilayah.ambilById(wilayahId);
    var sesudah = RepoWilayah.nonaktifkan(wilayahId, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'NONAKTIFKAN_WILAYAH', jenisEntitas: 'Wilayah', entitasId: wilayahId, nilaiLama: sebelum, nilaiBaru: sesudah });
    return sesudah;
  }
  function nonaktifkanLingkungan(lingkunganId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoLingkungan.ambilById(lingkunganId);
    var sesudah = RepoLingkungan.nonaktifkan(lingkunganId, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'NONAKTIFKAN_LINGKUNGAN', jenisEntitas: 'Lingkungan', entitasId: lingkunganId, nilaiLama: sebelum, nilaiBaru: sesudah });
    return sesudah;
  }

  return {
    cariKandidat: cariKandidat, ambilSemuaKandidatRingkas: ambilSemuaKandidatRingkas,
    buatOrang: buatOrang, perbaruiOrang: perbaruiOrang, nonaktifkanOrang: nonaktifkanOrang,
    berikanPeran: berikanPeran, cabutPeran: cabutPeran, buatWilayah: buatWilayah, buatLingkungan: buatLingkungan,
    nonaktifkanWilayah: nonaktifkanWilayah, nonaktifkanLingkungan: nonaktifkanLingkungan
  };
})();

// --- Pengaturan Aturan — khusus Admin ---
var LayananAturan = (function () {
  function ambilSemuaAturan(pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    return RepoKonfigAturan.daftar();
  }
  function perbaruiAturan(ruleId, perubahan, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    var sebelum = RepoKonfigAturan.ambilById(ruleId);
    var sesudah = RepoKonfigAturan.perbaruiKonfigAturan(ruleId, perubahan, pelakuId);
    RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'UBAH_KONFIG_ATURAN', jenisEntitas: 'Rule_Config', entitasId: ruleId, nilaiLama: sebelum, nilaiBaru: sesudah, ruleId: ruleId, versiKebijakan: sesudah.versi_kebijakan });
    return sesudah;
  }
  return { ambilSemuaAturan: ambilSemuaAturan, perbaruiAturan: perbaruiAturan };
})();

// --- Audit — khusus Admin, hanya membaca ---
var LayananAudit = (function () {
  function daftarSemua(pelakuId) { LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]); return RepoLogAudit.daftarSemua(); }
  function daftarByEntitas(jenisEntitas, entitasId, pelakuId) { LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]); return RepoLogAudit.daftarByEntitas(jenisEntitas, entitasId); }
  function daftarTerbaru(jumlahMaksimum, pelakuId) { LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]); return RepoLogAudit.daftarTerbaru(jumlahMaksimum); }
  function daftarHalaman(jumlahMaksimum, offset, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    return RepoLogAudit.daftarHalaman(jumlahMaksimum, offset);
  }
  return { daftarSemua: daftarSemua, daftarByEntitas: daftarByEntitas, daftarTerbaru: daftarTerbaru, daftarHalaman: daftarHalaman };
})();

// --- Laporan Jadwal — bisa ditampilkan/dicetak di web, dan opsional diekspor ke sheet "Jadwal" (format persis file Excel lama). Tidak pernah mengubah data penugasan. ---
var LayananLaporan = (function () {

  function bentukPeranUntukClient_(peranList) {
    return peranList.map(function (r) {
      return {
        roleId: r.role_id,
        namaPeran: r.nama_peran,
        jumlahDibutuhkan: Number(r.jumlah_dibutuhkan) || 0,
        jumlahMaksimal: Number(r.jumlah_maksimal) || 0
      };
    });
  }

  /** Detail siap-pakai untuk akhir pekan yang sebelumnya belum punya sesi. */
  function buatLaporanKosong(akhirPekan, sesiList, peranList) {
    var daftarPeran = peranList || RepoKonfigPeran.daftarUrut();
    return {
      weekendId: akhirPekan.weekend_id,
      tanggalAcuan: akhirPekan.tanggal_acuan,
      status: akhirPekan.status,
      revisi: akhirPekan.revisi,
      peranList: bentukPeranUntukClient_(daftarPeran),
      sesiList: (sesiList || []).map(function (sesi) {
        return {
          sessionId: sesi.session_id,
          jenisSesi: sesi.jenis_sesi,
          labelSesi: sesi.nama_khusus || KONFIG.LABEL_SESI[sesi.jenis_sesi] || sesi.jenis_sesi,
          tanggalSesi: sesi.tanggal_sesi,
          penugasanIndividu: [],
          penugasanKomunitas: [],
          progres: LayananKonflik.hitungProgresDariDaftar([], daftarPeran)
        };
      })
    };
  }

  /**
   * Dulu fungsi ini baca ulang sheet People/Wilayah/Lingkungan/
   * Role_Config UNTUK SETIAP baris penugasan, dan baca ulang sheet
   * Assignments 5 kali (per peran) UNTUK SETIAP sesi -- kalau satu akhir
   * pekan punya belasan penugasan, itu bisa jadi ratusan pembacaan sheet
   * sekali buka. Sekarang tiap sheet cukup dibaca SEKALI per akhir pekan.
   */
  function buatLaporanAkhirPekan(weekendId) {
    var akhirPekan = RepoAkhirPekan.ambilById(weekendId);
    if (!akhirPekan) throw new Error('Akhir pekan "' + weekendId + '" tidak ditemukan.');

    var sesiList = RepoSesi.daftarByAkhirPekan(weekendId);
    var penugasanKomunitas = RepoPenugasanKomunitas.daftarByAkhirPekan(weekendId);
    var penugasanIndividuSemua = RepoPenugasan.daftarByAkhirPekan(weekendId); // SEKALI baca untuk seluruh akhir pekan
    var peranList = RepoKonfigPeran.daftarUrut();

    var daftarOrang = RepoOrang.daftar(true);
    var daftarWilayah = RepoWilayah.daftar(true);
    var daftarLingkungan = RepoLingkungan.daftar(true);
    var petaOrang = {}; daftarOrang.forEach(function (o) { petaOrang[o.person_id] = o; });
    var petaWilayah = {}; daftarWilayah.forEach(function (w) { petaWilayah[w.wilayah_id] = w; });
    var petaLingkungan = {}; daftarLingkungan.forEach(function (l) { petaLingkungan[l.lingkungan_id] = l; });
    var petaPeran = {}; peranList.forEach(function (r) { petaPeran[r.role_id] = r; });

    var laporanSesi = sesiList.map(function (sesi) {
      var penugasanSesiIni = penugasanIndividuSemua.filter(function (a) { return a.session_id === sesi.session_id; });
      var penugasanIndividu = penugasanSesiIni.map(function (a) {
        var orang = petaOrang[a.person_id];
        var peran = petaPeran[a.role_id];
        var lingkunganOrang = orang ? petaLingkungan[orang.lingkungan_id] : null;
        var wilayahOrang = lingkunganOrang ? petaWilayah[lingkunganOrang.wilayah_id] : null;
        return {
          assignmentId: a.assignment_id,
          roleId: a.role_id, namaPeran: peran ? peran.nama_peran : a.role_id,
          personId: a.person_id, namaOrang: orang ? orang.nama : a.person_id,
          namaWilayahOrang: wilayahOrang ? wilayahOrang.nama : ''
        };
      });
      var komunitasSesiIni = penugasanKomunitas.filter(function (c) {
        return c.session_id === sesi.session_id || (c.jenis_penugasan === KONFIG.JENIS_PENUGASAN_KOMUNITAS.HIAS_ALTAR && !c.session_id);
      });
      return {
        sessionId: sesi.session_id, jenisSesi: sesi.jenis_sesi, labelSesi: sesi.nama_khusus || KONFIG.LABEL_SESI[sesi.jenis_sesi] || sesi.jenis_sesi,
        tanggalSesi: sesi.tanggal_sesi, penugasanIndividu: penugasanIndividu,
        penugasanKomunitas: komunitasSesiIni.map(function (c) {
          var wilayah = petaWilayah[c.wilayah_id];
          var lingkungan = c.lingkungan_id ? petaLingkungan[c.lingkungan_id] : null;
          return {
            communityAssignmentId: c.community_assignment_id,
            jenisPenugasan: c.jenis_penugasan, labelJenis: KONFIG.LABEL_PENUGASAN_KOMUNITAS[c.jenis_penugasan] || c.jenis_penugasan,
            wilayahId: c.wilayah_id, namaWilayah: wilayah ? wilayah.nama : c.wilayah_id,
            namaLingkungan: lingkungan ? lingkungan.nama : '', alasanOverride: c.alasan_override || ''
          };
        }),
        progres: LayananKonflik.hitungProgresDariDaftar(penugasanSesiIni, peranList)
      };
    });

    return {
      weekendId: akhirPekan.weekend_id, tanggalAcuan: akhirPekan.tanggal_acuan, status: akhirPekan.status, revisi: akhirPekan.revisi,
      peranList: bentukPeranUntukClient_(peranList),
      sesiList: laporanSesi
    };
  }

  /** "Minggu ke-N" dalam bulan, dengan aturan minggu ISO (Senin awal minggu) — persis rumus GetWeekDalamBulan di VBA asli. */
  function nomorMingguIso_(tanggal) {
    var d = new Date(Date.UTC(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate()));
    var hari = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - hari);
    var awalTahun = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - awalTahun) / 86400000) + 1) / 7);
  }
  function mingguDalamBulan_(tanggal) {
    var d = new Date(tanggal);
    var tglPertama = new Date(d.getFullYear(), d.getMonth(), 1);
    return nomorMingguIso_(d) - nomorMingguIso_(tglPertama) + 1;
  }

  function cariNamaKomunitas_(daftarKomunitas, jenis) {
    var cocok = daftarKomunitas.filter(function (c) { return c.jenisPenugasan === jenis; });
    if (cocok.length === 0) return '';
    return cocok.map(function (c) { return jenis === KONFIG.JENIS_PENUGASAN_KOMUNITAS.TATIB ? c.namaLingkungan : c.namaWilayah; }).join(', ');
  }

  /**
   * Menulis laporan akhir pekan ke sheet "Jadwal", persis format kolom
   * file Excel lama (A:I, data mulai baris 5). Baris lama untuk
   * tanggal-tanggal akhir pekan ini dihapus dulu supaya aman dijalankan
   * berulang (tidak dobel).
   */
  function tulisKeSheetJadwal(weekendId, pelakuId) {
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);

    return UtilKunci.denganKunciSkrip(function () {
      var laporan = buatLaporanAkhirPekan(weekendId);
      var sheet = UtilSheet.ambilSheet(KONFIG.NAMA_SHEET.JADWAL);

      var baris = [];
      laporan.sesiList.forEach(function (sesi) {
        var namaKoor = cariNamaKomunitas_(sesi.penugasanKomunitas, KONFIG.JENIS_PENUGASAN_KOMUNITAS.PADUAN_SUARA);
        var namaHiasAltar = cariNamaKomunitas_(sesi.penugasanKomunitas, KONFIG.JENIS_PENUGASAN_KOMUNITAS.HIAS_ALTAR);
        var namaTatib = cariNamaKomunitas_(sesi.penugasanKomunitas, KONFIG.JENIS_PENUGASAN_KOMUNITAS.TATIB);
        var informasi = 'Minggu ke-' + mingguDalamBulan_(sesi.tanggalSesi);

        if (sesi.penugasanIndividu.length === 0) {
          baris.push([sesi.tanggalSesi, sesi.labelSesi, namaKoor, namaHiasAltar, namaTatib, '', '', '', informasi]);
        } else {
          sesi.penugasanIndividu.forEach(function (a) {
            baris.push([sesi.tanggalSesi, sesi.labelSesi, namaKoor, namaHiasAltar, namaTatib, a.namaPeran, a.namaOrang, a.namaWilayahOrang, informasi]);
          });
        }
      });

      // Hapus baris lama untuk tanggal-tanggal akhir pekan ini (supaya tidak dobel kalau diekspor ulang).
      var tanggalSesiIni = laporan.sesiList.map(function (s) { return new Date(s.tanggalSesi).toDateString(); });
      var lastRow = sheet.getLastRow();
      if (lastRow >= 5) {
        var nilaiLama = sheet.getRange(5, 1, lastRow - 4, 1).getValues();
        for (var i = nilaiLama.length - 1; i >= 0; i--) {
          var sel = nilaiLama[i][0];
          if (sel && tanggalSesiIni.indexOf(new Date(sel).toDateString()) !== -1) {
            sheet.deleteRow(5 + i);
          }
        }
      }

      // Tambahkan baris baru di akhir data.
      var barisMulai = Math.max(sheet.getLastRow() + 1, 5);
      if (baris.length > 0) {
        sheet.getRange(barisMulai, 1, baris.length, 9).setValues(baris);
      }

      RepoLogAudit.catat({ pelakuId: pelakuId, aksi: 'EKSPOR_JADWAL', jenisEntitas: 'Weekend', entitasId: weekendId, nilaiBaru: { jumlahBaris: baris.length } });

      return { jumlahBaris: baris.length };
    });
  }

  return { buatLaporanAkhirPekan: buatLaporanAkhirPekan, buatLaporanKosong: buatLaporanKosong, tulisKeSheetJadwal: tulisKeSheetJadwal };
})();


/* ====================================================================
 * 6. WEB APP & API
 * Titik masuk halaman web, plus semua fungsi yang dipanggil dari
 * index.html lewat google.script.run. Setiap fungsi di sini SELALU
 * mengambil identitas pelaku dari sesi login Google (bukan dari data
 * yang dikirim tampilan web), supaya tidak bisa dipalsukan.
 * ==================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Penjadwalan Petugas Liturgi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function pelakuSaatIni_() { return LayananIzin.pelakuSaatIni(); }

/**
 * google.script.run tidak dapat mengirim object Date mentah secara aman.
 * Normalisasi dilakukan sekali di batas API agar seluruh endpoint selalu
 * mengembalikan data browser-safe dan metadata internal __baris tidak bocor.
 */
function buatAmanUntukClient_(nilai) {
  if (nilai instanceof Date) return isNaN(nilai.getTime()) ? null : nilai.toISOString();
  if (Array.isArray(nilai)) return nilai.map(buatAmanUntukClient_);
  if (nilai && typeof nilai === 'object') {
    var hasil = {};
    Object.keys(nilai).forEach(function (kunci) {
      if (kunci === '__baris') return;
      var isi = nilai[kunci];
      if (isi === undefined || typeof isi === 'function') return;
      hasil[kunci] = buatAmanUntukClient_(isi);
    });
    return hasil;
  }
  return nilai;
}

/** Membungkus semua pemanggilan API supaya kesalahan tidak membuat halaman web macet, tapi dikirim balik sebagai pesan yang bisa ditampilkan. */
function bungkusApi_(fn, namaApi) {
  UtilPerforma.mulai(namaApi || 'api');
  var berhasil = false;
  try {
    var data = fn();
    var mulaiRespons = Date.now();
    var aman = buatAmanUntukClient_(data);
    UtilPerforma.catat('response_prepare', mulaiRespons, { tipe: Array.isArray(aman) ? 'array' : typeof aman });
    berhasil = true;
    return { ok: true, data: aman };
  }
  catch (e) {
    console.error('[API_ERROR] ' + (namaApi || 'api') + ': ' + e.message);
    return { ok: false, pesan: e.message };
  }
  finally {
    try { UtilCache.flushInvalidasi(); }
    catch (eCache) { console.warn('[CACHE] gagal menyimpan versi invalidasi: ' + eCache.message); }
    UtilPerforma.selesai({ berhasil: berhasil });
  }
}

function api_ambilDataAwal(tglAwal, tglAkhir) {
  return bungkusApi_(function () {
    var dibangunUlang = LayananRingkasan.pastikanInfrastruktur();
    var pelakuId = pelakuSaatIni_();
    var master = UtilCache.ambilAtauHitung('master', 'bootstrap', function () {
      return {
        wilayahList: RepoWilayah.daftar(),
        lingkunganList: RepoLingkungan.daftar(),
        peranList: RepoKonfigPeran.daftarUrut()
      };
    });
    var peranPelaku = LayananIzin.ambilPeran(pelakuId);
    return {
      pelakuId: pelakuId,
      peran: peranPelaku,
      wilayahList: master.wilayahList,
      lingkunganList: master.lingkunganList,
      peranList: master.peranList,
      kandidatList: peranPelaku === KONFIG.IZIN.PELIHAT ? [] : LayananOrang.ambilSemuaKandidatRingkas(),
      persiapan: { ringkasanDibangunUlang: dibangunUlang },
      // Kalender awal digabung ke request bootstrap supaya halaman tidak
      // menunggu dua eksekusi google.script.run secara berurutan.
      akhirPekanList: (tglAwal && tglAkhir) ? ambilAkhirPekanDalamRentang_(tglAwal, tglAkhir) : []
    };
  }, 'api_ambilDataAwal');
}

function api_ambilAkhirPekanDalamRentang(tglAwal, tglAkhir) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    return ambilAkhirPekanDalamRentang_(tglAwal, tglAkhir);
  }, 'api_ambilAkhirPekanDalamRentang');
}

function ambilAkhirPekanDalamRentang_(tglAwal, tglAkhir) {
  return UtilCache.ambilAtauHitung('schedule', 'calendar:' + String(tglAwal) + ':' + String(tglAkhir), function () {
  var daftar = RepoAkhirPekan.daftarDalamRentang(tglAwal, tglAkhir);
  if (daftar.length === 0) return [];

  // Kalender membaca Session_Summary yang ringkas. Riwayat Assignments
  // tidak lagi dipindai setiap kali pengguna berpindah bulan.
  var idAkhirPekanBulanIni = {};
  daftar.forEach(function (w) { idAkhirPekanBulanIni[w.weekend_id] = true; });

  var semuaSesi = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.SESI).filter(function (s) { return idAkhirPekanBulanIni[s.weekend_id]; });
  var semuaRingkasan = UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.RINGKASAN_SESI)
    .filter(function (r) { return idAkhirPekanBulanIni[r.weekend_id]; });
  var ringkasanPerSesi = {};
  semuaRingkasan.forEach(function (r) { ringkasanPerSesi[r.session_id] = r; });

  return daftar.map(function (w) {
    var sesiList = semuaSesi.filter(function (s) { return s.weekend_id === w.weekend_id; });
    var semuaTerpenuhi = sesiList.length > 0 && sesiList.every(function (s) {
      var ringkasan = ringkasanPerSesi[s.session_id];
      return !!ringkasan && ringkasan.all_complete === true;
    });
    return {
      weekendId: w.weekend_id,
      tanggalAcuan: w.tanggal_acuan,
      status: w.status,
      revisi: w.revisi,
      jumlahSesi: sesiList.length,
      semuaTerpenuhi: semuaTerpenuhi,
      // Ringkasan sesi dipakai kalender mingguan. Data ini berasal dari
      // pembacaan Sessions yang memang sudah dilakukan di atas, sehingga
      // tidak menambah round-trip atau pembacaan spreadsheet baru.
      sesiList: sesiList.map(function (s) {
        return {
          sessionId: s.session_id,
          jenisSesi: s.jenis_sesi,
          labelSesi: s.nama_khusus || KONFIG.LABEL_SESI[s.jenis_sesi] || s.jenis_sesi,
          tanggalSesi: s.tanggal_sesi
        };
      })
    };
  });
  });
}

/**
 * sesiDipilih: array berisi { jenisSesi, tanggalSesi } untuk sesi baku
 * (SABTU_SORE/MINGGU_PAGI/MINGGU_SORE) yang dicentang user -- boleh 1, 2,
 * atau 3, sesuai kebutuhan minggu itu. Seluruh proses (cek-lalu-buat)
 * dikunci sekaligus supaya klik dobel/cepat tidak membuat sesi ganda.
 */
function api_ambilAtauBuatAkhirPekan(tanggalAcuan, sesiDipilih) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    var pelakuId = pelakuSaatIni_();
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);
    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilAtauBuatUntukTanggal(tanggalAcuan, pelakuId);
      var hasilSesi = RepoSesi.ambilAtauBuatBanyak(akhirPekan.weekend_id, sesiDipilih || [], pelakuId);
      try {
        LayananRingkasan.tambahRingkasanSesiKosong(hasilSesi.sesiBaru);
      } catch (eRingkasan) { LayananRingkasan.tandaiKotor(); }

      // Bila sebelumnya belum ada sesi, seluruh jadwal pasti masih kosong.
      // Kembalikan detail siap-render tanpa membaca semua master/penugasan.
      if (hasilSesi.sesiSebelumnya.length === 0) {
        return {
          weekendId: akhirPekan.weekend_id,
          tanggalAcuan: akhirPekan.tanggal_acuan,
          detailSiap: LayananLaporan.buatLaporanKosong(akhirPekan, hasilSesi.sesiList, RepoKonfigPeran.daftarUrut())
        };
      }

      // Jadwal lama mungkin sudah berisi penugasan. Respons awal tetap ringan;
      // browser akan membuka workspace dahulu lalu meminta detail lengkap.
      return {
        weekendId: akhirPekan.weekend_id,
        tanggalAcuan: akhirPekan.tanggal_acuan,
        detailSiap: null
      };
    });
  }, 'api_ambilAtauBuatAkhirPekan');
}

/** Menambah satu sesi tidak baku (misalnya "Misa Paskah") ke akhir pekan yang sudah ada. */
function api_tambahSesiKhusus(weekendId, namaKhusus, tanggalSesi) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    var pelakuId = pelakuSaatIni_();
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);
    if (!namaKhusus || !namaKhusus.trim()) throw new Error('Nama sesi khusus wajib diisi.');
    return UtilKunci.denganKunciSkrip(function () {
      var sesi = RepoSesi.buatSesiKhusus(weekendId, namaKhusus.trim(), tanggalSesi, pelakuId);
      try { LayananRingkasan.perbaruiBanyakSesi(weekendId, [sesi.session_id], RepoPenugasan.daftarByAkhirPekan(weekendId)); }
      catch (eRingkasan) { LayananRingkasan.tandaiKotor(); }
      return LayananLaporan.buatLaporanAkhirPekan(weekendId);
    });
  });
}

/** Membuat Misa Khusus langsung dari satu tanggal kosong di kalender bulanan. */
function api_buatMisaKhususPadaTanggal(tanggalSesi, namaKhusus) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    var pelakuId = pelakuSaatIni_();
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN, KONFIG.IZIN.PENJADWAL]);
    if (!namaKhusus || !namaKhusus.trim()) throw new Error('Nama Misa Khusus wajib diisi.');
    return UtilKunci.denganKunciSkrip(function () {
      var akhirPekan = RepoAkhirPekan.ambilAtauBuatUntukTanggal(tanggalSesi, pelakuId);
      if (akhirPekan.status === KONFIG.STATUS_AKHIR_PEKAN.FINAL) {
        throw new Error('Tanggal ini sudah berada dalam jadwal final. Buka kunci jadwal lebih dulu.');
      }
      var sesi = RepoSesi.buatSesiKhusus(akhirPekan.weekend_id, namaKhusus.trim(), tanggalSesi, pelakuId);
      try { LayananRingkasan.perbaruiBanyakSesi(akhirPekan.weekend_id, [sesi.session_id], RepoPenugasan.daftarByAkhirPekan(akhirPekan.weekend_id)); }
      catch (eRingkasan) { LayananRingkasan.tandaiKotor(); }
      RepoLogAudit.catat({
        pelakuId: pelakuId,
        aksi: 'TAMBAH_MISA_KHUSUS_DARI_KALENDER',
        jenisEntitas: 'Session',
        entitasId: sesi.session_id,
        nilaiBaru: sesi,
        alasanOverride: 'Misa Khusus: aturan kelayakan dan keadilan petugas dinonaktifkan.'
      });
      var detail = LayananLaporan.buatLaporanAkhirPekan(akhirPekan.weekend_id);
      detail.sessionIdBaru = sesi.session_id;
      return detail;
    });
  });
}

function api_ambilDetailAkhirPekan(weekendId) {
  return bungkusApi_(function () {
    // buatLaporanAkhirPekan sudah memvalidasi keberadaan akhir pekan.
    // Jangan membaca sheet Weekends sekali lagi sebelum membuat laporan.
    return LayananLaporan.buatLaporanAkhirPekan(weekendId);
  });
}

function api_eksporJadwalKeSheet(weekendId) {
  return bungkusApi_(function () { return LayananLaporan.tulisKeSheetJadwal(weekendId, pelakuSaatIni_()); });
}

function api_cariKandidat(kataKunci, roleId) {
  return bungkusApi_(function () { return LayananOrang.cariKandidat(kataKunci, roleId); });
}

/**
 * Dimuat secara lazy ketika modal kandidat pertama kali dibuka, lalu
 * dipakai ulang dari memori browser. Juga dapat dimuat ulang setelah
 * master People/Person_Roles berubah.
 */
function api_ambilSemuaKandidat() {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    return LayananOrang.ambilSemuaKandidatRingkas();
  }, 'api_ambilSemuaKandidat');
}

function api_tugaskanIndividu(params) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.tugaskanIndividu(params);
  }, 'api_tugaskanIndividu');
}

function api_tugaskanIndividuBatch(params) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.tugaskanIndividuBatch(params);
  }, 'api_tugaskanIndividuBatch');
}

function api_hapusPenugasanIndividu(params) {
  return bungkusApi_(function () {
    LayananRingkasan.pastikanInfrastruktur();
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.hapusPenugasanIndividu(params);
  }, 'api_hapusPenugasanIndividu');
}

function api_tugaskanKomunitas(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.tugaskanKomunitas(params);
  });
}

function api_hapusPenugasanKomunitas(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.hapusPenugasanKomunitas(params);
  });
}

function api_hapusSesiKhusus(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.hapusSesiKhusus(params);
  });
}

function api_hapusSesiDraft(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    var hasil = LayananPenjadwalan.hapusSesiDraft(params);
    if (hasil.berhasil && !hasil.akhirPekanDihapus) {
      hasil.detail = LayananLaporan.buatLaporanAkhirPekan(params.weekendId);
    }
    return hasil;
  });
}

function api_perbaruiSesiKhusus(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.perbaruiSesiKhusus(params);
  });
}

function api_finalkanAkhirPekan(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.finalkanAkhirPekan(params);
  });
}

function api_bukaKembaliAkhirPekan(params) {
  return bungkusApi_(function () {
    params.pelakuId = pelakuSaatIni_();
    return LayananPenjadwalan.bukaKembaliAkhirPekan(params);
  });
}

/** Menyiapkan data tabel petugas dari satu snapshot per sheet. */
function buatDaftarOrangUntukKelola_(sertakanTidakAktif) {
  var daftarWilayah = RepoWilayah.daftar(true);
  var daftarLingkungan = RepoLingkungan.daftar(true);
  var daftarKonfigPeran = RepoKonfigPeran.daftar(true);

  var petaWilayah = {}; daftarWilayah.forEach(function (w) { petaWilayah[w.wilayah_id] = w; });
  var petaLingkungan = {}; daftarLingkungan.forEach(function (l) { petaLingkungan[l.lingkungan_id] = l; });
  var petaKonfigPeran = {}; daftarKonfigPeran.forEach(function (r) { petaKonfigPeran[r.role_id] = r; });

  var peranPerOrang = {};
  UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PERAN_ORANG).forEach(function (pr) {
    if (pr.aktif !== true) return;
    if (!peranPerOrang[pr.person_id]) peranPerOrang[pr.person_id] = [];
    peranPerOrang[pr.person_id].push(pr);
  });

  return RepoOrang.daftar(sertakanTidakAktif).map(function (p) {
    var lingkungan = petaLingkungan[p.lingkungan_id];
    var wilayah = lingkungan ? petaWilayah[lingkungan.wilayah_id] : null;
    var peranDimiliki = (peranPerOrang[p.person_id] || []).map(function (pr) {
      var peran = petaKonfigPeran[pr.role_id];
      return { personRoleId: pr.person_role_id, roleId: pr.role_id, namaPeran: peran ? peran.nama_peran : pr.role_id };
    });
    return { personId: p.person_id, nama: p.nama, aktif: p.aktif, lingkunganId: p.lingkungan_id, namaLingkungan: lingkungan ? lingkungan.nama : '', wilayahId: wilayah ? wilayah.wilayah_id : '', namaWilayah: wilayah ? wilayah.nama : '', peranDimiliki: peranDimiliki };
  });
}

function api_daftarOrang(sertakanTidakAktif) {
  return bungkusApi_(function () { return buatDaftarOrangUntukKelola_(sertakanTidakAktif); });
}

/** Satu endpoint untuk seluruh tab Kelola Petugas, tanpa dua request paralel. */
function api_ambilDataKelolaPetugas() {
  return bungkusApi_(function () {
    return UtilCache.ambilAtauHitung('master', 'manage-people', function () {
      return {
        orang: buatDaftarOrangUntukKelola_(true),
        wilayah: RepoWilayah.daftar(true),
        lingkungan: RepoLingkungan.daftar(true)
      };
    });
  }, 'api_ambilDataKelolaPetugas');
}

function api_buatOrang(data) {
  return bungkusApi_(function () { return LayananOrang.buatOrang(data, pelakuSaatIni_()); });
}
function api_perbaruiOrang(personId, perubahan) {
  return bungkusApi_(function () { return LayananOrang.perbaruiOrang(personId, perubahan, pelakuSaatIni_()); });
}
function api_nonaktifkanOrang(personId) {
  return bungkusApi_(function () { return LayananOrang.nonaktifkanOrang(personId, pelakuSaatIni_()); });
}
function api_berikanPeran(personId, roleId) {
  return bungkusApi_(function () { return LayananOrang.berikanPeran(personId, roleId, pelakuSaatIni_()); });
}
function api_cabutPeran(personRoleId) {
  return bungkusApi_(function () { return LayananOrang.cabutPeran(personRoleId, pelakuSaatIni_()); });
}
function api_buatWilayah(data) {
  return bungkusApi_(function () { return LayananOrang.buatWilayah(data, pelakuSaatIni_()); });
}
function api_buatLingkungan(data) {
  return bungkusApi_(function () { return LayananOrang.buatLingkungan(data, pelakuSaatIni_()); });
}
function api_daftarWilayahLingkungan() {
  return bungkusApi_(function () {
    return { wilayah: RepoWilayah.daftar(true), lingkungan: RepoLingkungan.daftar(true) };
  });
}
function api_nonaktifkanWilayah(wilayahId) {
  return bungkusApi_(function () { return LayananOrang.nonaktifkanWilayah(wilayahId, pelakuSaatIni_()); });
}
function api_nonaktifkanLingkungan(lingkunganId) {
  return bungkusApi_(function () { return LayananOrang.nonaktifkanLingkungan(lingkunganId, pelakuSaatIni_()); });
}

function api_ambilSemuaAturan() {
  return bungkusApi_(function () {
    var pelakuId = pelakuSaatIni_();
    LayananIzin.wajibkanPeran(pelakuId, [KONFIG.IZIN.ADMIN]);
    return UtilCache.ambilAtauHitung('policy', 'rules', function () {
      return RepoKonfigAturan.daftar().map(function (a) {
        return {
          rule_id: a.rule_id,
          nama_aturan: a.nama_aturan,
          aktif: a.aktif,
          tingkat: a.tingkat,
          versi_kebijakan: a.versi_kebijakan
        };
      });
    });
  }, 'api_ambilSemuaAturan');
}
function api_perbaruiAturan(ruleId, perubahan) {
  return bungkusApi_(function () { return LayananAturan.perbaruiAturan(ruleId, perubahan, pelakuSaatIni_()); });
}

function api_ambilLogAudit(jumlahMaksimum, offset) {
  return bungkusApi_(function () {
    var jumlah = Math.min(100, Math.max(1, Number(jumlahMaksimum) || 50));
    var halaman = LayananAudit.daftarHalaman(jumlah, offset, pelakuSaatIni_());
    var item = halaman.baris.slice().reverse().map(function (a) {
      return {
        audit_id: a.audit_id,
        waktu: a.waktu,
        pelaku_id: a.pelaku_id,
        aksi: a.aksi,
        jenis_entitas: a.jenis_entitas,
        alasan_override: a.alasan_override || ''
      };
    });
    return {
      items: item,
      nextOffset: halaman.offsetBerikutnya,
      hasMore: halaman.adaLebih,
      total: halaman.total
    };
  });
}

function api_ambilPenggunaDanPeran() {
  return bungkusApi_(function () {
    LayananIzin.wajibkanPeran(pelakuSaatIni_(), [KONFIG.IZIN.ADMIN]);
    return UtilSheet.ambilSemuaBaris(KONFIG.NAMA_SHEET.PENGATURAN_SISTEM)
      .filter(function (b) { return String(b.kunci).indexOf('peran_pengguna:') === 0; })
      .map(function (b) { return { email: String(b.kunci).replace('peran_pengguna:', ''), peran: b.nilai }; });
  });
}
function api_aturPeranPengguna(email, peran) {
  return bungkusApi_(function () { LayananIzin.aturPeran(email, peran, pelakuSaatIni_()); return true; });
}
