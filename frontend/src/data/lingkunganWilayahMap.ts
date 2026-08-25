/**
 * Master Relasi Lingkungan ke Wilayah Induk Resmi
 * Berdasarkan Data Historis & Buku Induk Paroki HTB SPM Boyolali
 * (Master_Jadwal_Petugas_Liturgi_THE_HOLY_GRAIL_-_Lingkungan.xlsm)
 */
export const LINGKUNGAN_TO_WILAYAH: Record<string, string> = {
  // 1. BRAYAT MINULYA
  'AGNES': 'BRAYAT MINULYA',
  'MATEUS': 'BRAYAT MINULYA',
  'THOMAS AQUINO': 'BRAYAT MINULYA',

  // 2. MARIA ASSUMPTA
  'AGATHA': 'MARIA ASSUMPTA',
  'AGUSTINUS': 'MARIA ASSUMPTA',
  'PETRUS': 'MARIA ASSUMPTA',

  // 3. MARIA BUNDA ALLAH
  'BONAVENTURA': 'MARIA BUNDA ALLAH',
  'CYRILUS': 'MARIA BUNDA ALLAH',

  // 4. MARIA CARMEL
  'BERNADETA': 'MARIA CARMEL',
  'FRANSISKUS': 'MARIA CARMEL',
  'YUSUP': 'MARIA CARMEL',

  // 5. MARIA CORDIS
  'ANTONIUS': 'MARIA CORDIS',
  'LAURENTIUS': 'MARIA CORDIS',

  // 6. MARIA IMMACULATA
  'ANDREAS': 'MARIA IMMACULATA',
  'FRANSISCUS XAVERIUS': 'MARIA IMMACULATA',
  'YAKOBUS': 'MARIA IMMACULATA',

  // 7. MARIA LOURDES
  'IGNATIUS': 'MARIA LOURDES',
  'NASARETH': 'MARIA LOURDES',
  'THERESIA': 'MARIA LOURDES',

  // 8. MARIA MATER DEI
  'CAECILIA': 'MARIA MATER DEI',
  'MARTINUS': 'MARIA MATER DEI',

  // 9. MARIA MATER DOLOROSA
  'BLASIUS': 'MARIA MATER DOLOROSA',
  'MARKUS': 'MARIA MATER DOLOROSA',
  'PAULUS': 'MARIA MATER DOLOROSA',

  // 10. MARIA RATU
  'TIMOTIUS': 'MARIA RATU',
  'TITUS': 'MARIA RATU',
  'YOHANES': 'MARIA RATU',

  // 11. MARIA RATU ROSARI
  'DIDIMUS': 'MARIA RATU ROSARI',
  'LUKAS': 'MARIA RATU ROSARI',
  'STEFANUS': 'MARIA RATU ROSARI',

  // 12. MARIA TAK BERNODA
  'BARNABAS': 'MARIA TAK BERNODA',
  'FLORENTINUS': 'MARIA TAK BERNODA',
  'HYPOLITUS': 'MARIA TAK BERNODA',
  'YUSTINUS': 'MARIA TAK BERNODA',
};

export const WILAYAH_LIST = [
  'BRAYAT MINULYA',
  'MARIA ASSUMPTA',
  'MARIA BUNDA ALLAH',
  'MARIA CARMEL',
  'MARIA CORDIS',
  'MARIA IMMACULATA',
  'MARIA LOURDES',
  'MARIA MATER DEI',
  'MARIA MATER DOLOROSA',
  'MARIA RATU',
  'MARIA RATU ROSARI',
  'MARIA TAK BERNODA',
];

export const SPECIAL_CHOIR_GROUPS = [
  { id: 'GRASIA', label: 'Koor GRASIA' },
  { id: 'BECANBO', label: 'Koor BECANBO' },
  { id: 'LUAR PAROKI', label: 'Paduan Suara Luar Paroki' },
  { id: 'LAIN LAIN', label: 'Koor Lain-lain / Kategorial' },
];

export const formatChoirDisplayName = (choirAss: any): string => {
  if (!choirAss) return '(Belum Ditugaskan)';
  if (choirAss.lingkungan_id) {
    return `Lingkungan ${choirAss.lingkungan_id}`;
  }
  const wil = choirAss.wilayah_id || '';
  if (!wil) return '(Belum Ditugaskan)';
  if (wil.startsWith('KHUSUS:')) {
    return wil.replace('KHUSUS:', '').trim();
  }
  const upper = wil.toUpperCase().trim();
  const matchedSpecial = SPECIAL_CHOIR_GROUPS.find((s) => s.id === upper);
  if (matchedSpecial) {
    return matchedSpecial.label;
  }
  return `Wilayah ${wil}`;
};