import { ConflictEngine, ValidationSnapshot } from '../rules/conflictEngine';
import {
  BUSINESS_RULES,
  ROLE_IDS,
  ASSIGNMENT_STATUS,
  COMMUNITY_ASSIGNMENT_TYPE,
  RULE_LEVELS
} from '../config/constants';
import {
  PersonDoc,
  RoleConfigDoc,
  RuleConfigDoc,
  AssignmentDoc,
  CommunityAssignmentDoc
} from '../types';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Detail: ${details}`);
    failed++;
  }
}

// Mock active rules map
const mockRules = new Map<string, RuleConfigDoc>();
[
  { rule_id: 'BR-020', nama_aturan: 'Kelayakan Peran', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-026', nama_aturan: 'Kapasitas Kuota', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-031', nama_aturan: 'Tugas Ganda Akhir Pekan', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-032', nama_aturan: 'Layanan Berturut', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-013', nama_aturan: 'Blacklist Paduan Suara', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-041', nama_aturan: 'Konflik Tatib', tingkat: RULE_LEVELS.WAJIB, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-052', nama_aturan: 'Tumpang Tindih PS & Hias Altar', tingkat: RULE_LEVELS.PERINGATAN, aktif: true, versi_kebijakan: 1 },
  { rule_id: 'BR-027', nama_aturan: 'Saran LRU', tingkat: RULE_LEVELS.OTOMATIS, aktif: true, versi_kebijakan: 1 },
].forEach((r) => mockRules.set(r.rule_id, r as RuleConfigDoc));

// Common mock data
const personBudi: PersonDoc & { wilayah_id?: string } = {
  person_id: 'PER-001',
  nama: 'Ignatius Budi',
  lingkungan_id: 'LKG-TIMOTIUS',
  wilayah_id: 'WIL-MARIA-RATU',
  aktif: true,
  dibuat_pada: new Date(),
  diubah_pada: new Date()
};

const roleLektor: RoleConfigDoc = {
  role_id: ROLE_IDS.LEKTOR,
  nama_peran: 'Lektor',
  jumlah_dibutuhkan: 3,
  jumlah_maksimal: 3,
  aktif: true,
  urutan: 3
};

const roleOrganis: RoleConfigDoc = {
  role_id: ROLE_IDS.ORGANIS,
  nama_peran: 'Organis',
  jumlah_dibutuhkan: 1,
  jumlah_maksimal: 1,
  aktif: true,
  urutan: 1
};

export function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING LITURGY BUSINESS RULES (BR-xxx) TEST SUITE');
  console.log('======================================================\n');

  // --- TEST 1: BR-020 Role Qualification ---
  console.log('🔹 Testing BR-020: Kelayakan Peran (Person Roles)');
  {
    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleLektor,
      activeRules: mockRules,
      personRoles: [], // Budi has NO roles
      currentWeekendAssignments: [],
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: [],
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-sabtu', personId: 'PER-001', roleId: ROLE_IDS.LEKTOR },
      snapshot
    );
    assert('Blocks assignment if person does NOT have the role', res.blokir.some((b) => b.ruleId === BUSINESS_RULES.BR_020_KELAYAKAN_PERAN));
  }

  {
    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleLektor,
      activeRules: mockRules,
      personRoles: [{ person_role_id: 'pr-1', person_id: 'PER-001', role_id: ROLE_IDS.LEKTOR, aktif: true }],
      currentWeekendAssignments: [],
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: [],
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-sabtu', personId: 'PER-001', roleId: ROLE_IDS.LEKTOR },
      snapshot
    );
    assert('Allows assignment if person HAS active role', res.blokir.length === 0);
  }

  // --- TEST 2: BR-026 Capacity Quota ---
  console.log('\n🔹 Testing BR-026: Kapasitas Kuota Per Sesi');
  {
    const existingLektors: AssignmentDoc[] = [
      { assignment_id: 'a1', weekend_id: 'wkd-01', session_id: 'ses-sabtu', person_id: 'PER-002', role_id: ROLE_IDS.LEKTOR, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' },
      { assignment_id: 'a2', weekend_id: 'wkd-01', session_id: 'ses-sabtu', person_id: 'PER-003', role_id: ROLE_IDS.LEKTOR, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' },
      { assignment_id: 'a3', weekend_id: 'wkd-01', session_id: 'ses-sabtu', person_id: 'PER-004', role_id: ROLE_IDS.LEKTOR, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' }
    ]; // Already 3 lektors in session

    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleLektor,
      activeRules: mockRules,
      personRoles: [{ person_role_id: 'pr-1', person_id: 'PER-001', role_id: ROLE_IDS.LEKTOR, aktif: true }],
      currentWeekendAssignments: existingLektors,
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: [],
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-sabtu', personId: 'PER-001', roleId: ROLE_IDS.LEKTOR },
      snapshot
    );
    assert('Blocks assignment if role quota is already full (3/3)', res.blokir.some((b) => b.ruleId === BUSINESS_RULES.BR_026_KAPASITAS_KUOTA));
  }

  // --- TEST 3: BR-030/031 Double Duty & Organist Exception ---
  console.log('\n🔹 Testing BR-030/031: Larangan Tugas Ganda (Organist Exception)');
  {
    // Case A: Lektor assigned on Sunday morning, trying to serve Saturday evening
    const existingLektorSunday: AssignmentDoc[] = [
      { assignment_id: 'a1', weekend_id: 'wkd-01', session_id: 'ses-minggu-pagi', person_id: 'PER-001', role_id: ROLE_IDS.LEKTOR, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' }
    ];

    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleLektor,
      activeRules: mockRules,
      personRoles: [{ person_role_id: 'pr-1', person_id: 'PER-001', role_id: ROLE_IDS.LEKTOR, aktif: true }],
      currentWeekendAssignments: existingLektorSunday,
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: [],
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-sabtu-sore', personId: 'PER-001', roleId: ROLE_IDS.LEKTOR },
      snapshot
    );
    assert('Blocks regular officer from serving 2x in same weekend', res.blokir.some((b) => b.ruleId === BUSINESS_RULES.BR_031_TUGAS_GANDA_AKHIR_PEKAN));
  }

  {
    // Case B: Organist assigned on Sunday morning, trying to serve Saturday evening -> MUST PASS!
    const existingOrganisSunday: AssignmentDoc[] = [
      { assignment_id: 'a1', weekend_id: 'wkd-01', session_id: 'ses-minggu-pagi', person_id: 'PER-001', role_id: ROLE_IDS.ORGANIS, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' }
    ];

    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleOrganis,
      activeRules: mockRules,
      personRoles: [{ person_role_id: 'pr-2', person_id: 'PER-001', role_id: ROLE_IDS.ORGANIS, aktif: true }],
      currentWeekendAssignments: existingOrganisSunday,
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: [],
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-sabtu-sore', personId: 'PER-001', roleId: ROLE_IDS.ORGANIS },
      snapshot
    );
    assert('Allows ORGANIST to serve 2x in same weekend (VBA exception rule)', res.blokir.length === 0);
  }

  // --- TEST 4: BR-032 Consecutive Weekends (No Organist Exception) ---
  console.log('\n🔹 Testing BR-032: Larangan Bertugas Berturut-turut');
  {
    // Organist served last weekend (wkd-prior) -> trying to serve this weekend (wkd-01) -> MUST BLOCK!
    const priorWeekendAssignment: AssignmentDoc[] = [
      { assignment_id: 'a0', weekend_id: 'wkd-prior', session_id: 'ses-minggu-pagi', person_id: 'PER-001', role_id: ROLE_IDS.ORGANIS, status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin', diubah_pada: new Date(), diubah_oleh: 'admin' }
    ];

    const snapshot: ValidationSnapshot = {
      targetWeekendId: 'wkd-01',
      targetPerson: personBudi,
      targetRole: roleOrganis,
      activeRules: mockRules,
      personRoles: [{ person_role_id: 'pr-2', person_id: 'PER-001', role_id: ROLE_IDS.ORGANIS, aktif: true }],
      currentWeekendAssignments: [],
      currentWeekendCommunity: [],
      adjacentWeekendAssignments: priorWeekendAssignment,
      adjacentWeekendCommunity: []
    };

    const res = ConflictEngine.validateIndividualAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-minggu-pagi', personId: 'PER-001', roleId: ROLE_IDS.ORGANIS },
      snapshot
    );
    assert('Blocks ORGANIST on consecutive weekends (BR-032 has NO exceptions)', res.blokir.some((b) => b.ruleId === BUSINESS_RULES.BR_032_LAYANAN_BERTURUT));
  }

  // --- TEST 5: BR-013 & BR-041 Community Rules ---
  console.log('\n🔹 Testing BR-013 & BR-041: Paduan Suara & Tatib');
  {
    const currentCommunity: CommunityAssignmentDoc[] = [
      { community_assignment_id: 'c1', weekend_id: 'wkd-01', session_id: 'ses-sabtu', jenis_penugasan: COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA, wilayah_id: 'WIL-MARIA-RATU', status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin' }
    ];

    const resDuplicateChoir = ConflictEngine.validateCommunityAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-minggu-pagi', jenis: COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA, wilayahId: 'WIL-MARIA-RATU' },
      { activeRules: mockRules, currentWeekendCommunity: currentCommunity, adjacentWeekendCommunity: [] }
    );
    assert('Blocks Choir Wilayah from serving 2x in same weekend (BR-013)', resDuplicateChoir.blokir.some((b) => b.ruleId === BUSINESS_RULES.BR_013_BLACKLIST_PADUAN_SUARA));

    const resTatib = ConflictEngine.validateCommunityAssignment(
      { weekendId: 'wkd-01', sessionId: 'ses-minggu-pagi', jenis: COMMUNITY_ASSIGNMENT_TYPE.TATIB, lingkunganId: 'LKG-TIMOTIUS' },
      { activeRules: mockRules, currentWeekendCommunity: currentCommunity, adjacentWeekendCommunity: [] }
    );
    assert('Allows Tatib when not conflicting', resTatib.blokir.length === 0);
  }

  // --- TEST 6: BR-052 Choir & Altar Decoration Warning ---
  console.log('\n🔹 Testing BR-052: Peringatan Koor & Hias Altar');
  {
    const currentCommunity: CommunityAssignmentDoc[] = [
      { community_assignment_id: 'c1', weekend_id: 'wkd-01', session_id: 'ses-sabtu', jenis_penugasan: COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA, wilayah_id: 'WIL-MARIA-RATU', status: ASSIGNMENT_STATUS.ACTIVE, dibuat_pada: new Date(), dibuat_oleh: 'admin' }
    ];

    const res = ConflictEngine.validateCommunityAssignment(
      { weekendId: 'wkd-01', jenis: COMMUNITY_ASSIGNMENT_TYPE.HIAS_ALTAR, wilayahId: 'WIL-MARIA-RATU' },
      { activeRules: mockRules, currentWeekendCommunity: currentCommunity, adjacentWeekendCommunity: [] }
    );
    assert('Generates WARNING (not block) when Choir & Altar Decoration share Wilayah (BR-052)', res.peringatan.some((p) => p.ruleId === BUSINESS_RULES.BR_052_TUMPANG_TINDIH_PS_HIAS_ALTAR));
  }

  // --- TEST 7: BR-027 LRU Ranking ---
  console.log('\n🔹 Testing BR-027: Saran Petugas Terlama (LRU)');
  {
    const candidateA: PersonDoc = { person_id: 'P-A', nama: 'Petugas A (Baru saja)', lingkungan_id: 'L1', aktif: true, dibuat_pada: new Date(), diubah_pada: new Date() };
    const candidateB: PersonDoc = { person_id: 'P-B', nama: 'Petugas B (Belum pernah)', lingkungan_id: 'L1', aktif: true, dibuat_pada: new Date(), diubah_pada: new Date() };
    const candidateC: PersonDoc = { person_id: 'P-C', nama: 'Petugas C (2 bulan lalu)', lingkungan_id: 'L1', aktif: true, dibuat_pada: new Date(), diubah_pada: new Date() };

    const lastAssignedMap = new Map<string, number>();
    lastAssignedMap.set('P-A', new Date('2024-08-01').getTime()); // recent
    lastAssignedMap.set('P-C', new Date('2024-06-01').getTime()); // 2 months ago
    // P-B has 0 / undefined (never served)

    const ranked = ConflictEngine.rankCandidatesByLru([candidateA, candidateB, candidateC], lastAssignedMap);
    assert('Ranks candidate with no history first (highest priority)', ranked[0].person_id === 'P-B');
    assert('Ranks candidate with oldest assignment second', ranked[1].person_id === 'P-C');
    assert('Ranks most recent candidate last', ranked[2].person_id === 'P-A');
  }

  console.log('\n======================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}