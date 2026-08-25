import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/constants';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Migration Helper: Converts tabular rows from Google Sheets CSV/JSON into Firestore collections.
 * Preserves legacy stable IDs (PER-*, WIL-*, LKG-*, ROL-*, etc.).
 */
export async function migrateLegacyData(data: {
  wilayah?: Array<{ wilayah_id: string; nama: string; aktif: boolean }>;
  lingkungan?: Array<{ lingkungan_id: string; nama: string; wilayah_id: string; aktif: boolean }>;
  people?: Array<{ person_id: string; nama: string; lingkungan_id: string; aktif: boolean }>;
  role_config?: Array<{ role_id: string; nama_peran: string; jumlah_dibutuhkan: number; jumlah_maksimal: number; aktif: boolean; urutan: number }>;
  person_roles?: Array<{ person_role_id: string; person_id: string; role_id: string; aktif: boolean }>;
  rule_config?: Array<{ rule_id: string; nama_aturan: string; aktif: boolean; tingkat: string; versi_kebijakan: number }>;
}) {
  const batch = db.batch();
  let count = 0;

  // 1. Wilayah
  if (data.wilayah) {
    for (const w of data.wilayah) {
      const ref = db.collection(COLLECTIONS.WILAYAH).doc(w.wilayah_id);
      batch.set(ref, w);
      count++;
    }
  }

  // 2. Lingkungan
  if (data.lingkungan) {
    for (const l of data.lingkungan) {
      const ref = db.collection(COLLECTIONS.LINGKUNGAN).doc(l.lingkungan_id);
      batch.set(ref, l);
      count++;
    }
  }

  // 3. People
  if (data.people) {
    const now = new Date();
    for (const p of data.people) {
      const ref = db.collection(COLLECTIONS.PEOPLE).doc(p.person_id);
      batch.set(ref, {
        ...p,
        dibuat_pada: now,
        diubah_pada: now
      });
      count++;
    }
  }

  // 4. Role Config
  if (data.role_config) {
    for (const r of data.role_config) {
      const ref = db.collection(COLLECTIONS.ROLE_CONFIG).doc(r.role_id);
      batch.set(ref, r);
      count++;
    }
  }

  // 5. Person Roles
  if (data.person_roles) {
    for (const pr of data.person_roles) {
      const ref = db.collection(COLLECTIONS.PERSON_ROLES).doc(pr.person_role_id);
      batch.set(ref, pr);
      count++;
    }
  }

  // 6. Rule Config
  if (data.rule_config) {
    const now = new Date();
    for (const rc of data.rule_config) {
      const ref = db.collection(COLLECTIONS.RULE_CONFIG).doc(rc.rule_id);
      batch.set(ref, {
        ...rc,
        diubah_pada: now
      });
      count++;
    }
  }

  await batch.commit();
  console.log(`[MIGRATION SUCCESS] ${count} documents imported into Firestore.`);
}
