import * as admin from 'firebase-admin';
import { COLLECTIONS, RULE_LEVELS, ROLE_IDS } from '../config/constants';
import { REAL_OFFICERS_DATA } from '../data/realOfficers';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const DATA_STRUKTUR_WILAYAH: Record<string, string[]> = {
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
  'GRASIA': [],
  'LUAR PAROKI': [],
  'LAIN LAIN': [],
  'BECANBO': [],
};

export const INITIAL_ROLE_CONFIG = [
  { role_id: 'ROL-ORGANIS', nama_peran: 'Organis', jumlah_dibutuhkan: 1, jumlah_maksimal: 1, aktif: true, urutan: 1 },
  { role_id: 'ROL-PEMAZMUR', nama_peran: 'Pemazmur', jumlah_dibutuhkan: 2, jumlah_maksimal: 2, aktif: true, urutan: 2 },
  { role_id: 'ROL-LEKTOR', nama_peran: 'Lektor', jumlah_dibutuhkan: 3, jumlah_maksimal: 3, aktif: true, urutan: 3 },
  { role_id: 'ROL-MISDINAR', nama_peran: 'Misdinar', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 4 },
  { role_id: 'ROL-PRODIAKON', nama_peran: 'Prodiakon', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 5 },
];

export const INITIAL_RULE_CONFIG = [
  { rule_id: 'BR-020', nama_aturan: 'Kelayakan Peran', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-026', nama_aturan: 'Kapasitas Kuota Per Sesi', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-031', nama_aturan: 'Larangan Tugas Ganda Akhir Pekan', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-032', nama_aturan: 'Larangan Bertugas Berturut-turut', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-013', nama_aturan: 'Keadilan Koor Paduan Suara', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-041', nama_aturan: 'Keadilan Tatib Lingkungan', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-052', nama_aturan: 'Peringatan Koor & Hias Altar', tingkat: RULE_LEVELS.PERINGATAN, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-027', nama_aturan: 'Saran Petugas Terlama (LRU)', tingkat: RULE_LEVELS.OTOMATIS, aktif: true, versi_kebijakan: 1 },
];

export async function seedDatabase() {
  console.log('[SEED] Memulai inisialisasi data master Firestore...');
  const batch = db.batch();

  // 1. Roles
  for (const role of INITIAL_ROLE_CONFIG) {
    const ref = db.collection(COLLECTIONS.ROLE_CONFIG).doc(role.role_id);
    batch.set(ref, role);
  }

  // 2. Rules
  const now = new Date();
  for (const rule of INITIAL_RULE_CONFIG) {
    const ref = db.collection(COLLECTIONS.RULE_CONFIG).doc(rule.rule_id);
    batch.set(ref, { ...rule, diubah_pada: now });
  }

  // 3. Wilayah & Lingkungan
  let wilayahIdx = 1;
  let lingkunganIdx = 1;
  const petaLingkunganId: Record<string, string> = {};

  for (const [namaWilayah, daftarLingkungan] of Object.entries(DATA_STRUKTUR_WILAYAH)) {
    const wilayahId = `WIL-${String(wilayahIdx++).padStart(2, '0')}`;
    const wilRef = db.collection(COLLECTIONS.WILAYAH).doc(wilayahId);
    batch.set(wilRef, {
      wilayah_id: wilayahId,
      nama: namaWilayah,
      aktif: true
    });

    for (const namaLingkungan of daftarLingkungan) {
      const lingkunganId = `LKG-${String(lingkunganIdx++).padStart(2, '0')}`;
      const lkgRef = db.collection(COLLECTIONS.LINGKUNGAN).doc(lingkunganId);
      batch.set(lkgRef, {
        lingkungan_id: lingkunganId,
        nama: namaLingkungan,
        wilayah_id: wilayahId,
        aktif: true
      });
      petaLingkunganId[`${namaWilayah}::${namaLingkungan}`] = lingkunganId;
    }
  }

  // 4. Seed All 172 Real Officers & Person_Roles
  let personIdx = 1;
  let personRoleIdx = 1;

  for (const officer of REAL_OFFICERS_DATA) {
    const personId = `PER-${String(personIdx++).padStart(3, '0')}`;
    const lingkunganId = petaLingkunganId[`${officer.wilayah}::${officer.lingkungan}`] || 'LKG-01';

    const personRef = db.collection(COLLECTIONS.PEOPLE).doc(personId);
    batch.set(personRef, {
      person_id: personId,
      nama: officer.nama,
      lingkungan_id: lingkunganId,
      aktif: true,
      dibuat_pada: now,
      diubah_pada: now
    });

    // Helper to add person_role doc
    const addRoleIfEligible = (isEligible: boolean, roleId: string) => {
      if (!isEligible) return;
      const prId = `PRL-${String(personRoleIdx++).padStart(4, '0')}`;
      const prRef = db.collection(COLLECTIONS.PERSON_ROLES).doc(prId);
      batch.set(prRef, {
        person_role_id: prId,
        person_id: personId,
        role_id: roleId,
        aktif: true
      });
    };

    addRoleIfEligible(officer.organis, ROLE_IDS.ORGANIS);
    addRoleIfEligible(officer.mazmur, ROLE_IDS.PEMAZMUR);
    addRoleIfEligible(officer.lektor, ROLE_IDS.LEKTOR);
    addRoleIfEligible(officer.misdinar, ROLE_IDS.MISDINAR);
    addRoleIfEligible(officer.prodiakon, ROLE_IDS.PRODIAKON);
  }

  await batch.commit();
  console.log(`[SEED SELESAI] Sukses import ${personIdx - 1} Petugas Riil, ${personRoleIdx - 1} Peran Petugas, ${wilayahIdx - 1} Wilayah, dan ${lingkunganIdx - 1} Lingkungan!`);
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}