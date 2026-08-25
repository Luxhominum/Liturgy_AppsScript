import {
  BUSINESS_RULES,
  COMMUNITY_ASSIGNMENT_TYPE,
  ROLE_IDS,
  ASSIGNMENT_STATUS
} from '../config/constants';
import {
  AssignmentDoc,
  CommunityAssignmentDoc,
  PersonDoc,
  PersonRoleDoc,
  RoleConfigDoc,
  RuleConfigDoc,
  ValidationResult,
  RuleViolation
} from '../types';

export interface ValidationSnapshot {
  targetWeekendId: string;
  targetPerson: PersonDoc & { wilayah_id?: string };
  targetRole: RoleConfigDoc;
  activeRules: Map<string, RuleConfigDoc>;
  personRoles: PersonRoleDoc[];
  currentWeekendAssignments: AssignmentDoc[];
  currentWeekendCommunity: CommunityAssignmentDoc[];
  adjacentWeekendAssignments: AssignmentDoc[];
  adjacentWeekendCommunity: CommunityAssignmentDoc[];
}

export class ConflictEngine {
  private static isRuleActive(snapshot: ValidationSnapshot, ruleId: string): boolean {
    const rule = snapshot.activeRules.get(ruleId);
    return !rule || rule.aktif !== false;
  }

  public static validateIndividualAssignment(
    context: {
      weekendId: string;
      sessionId: string;
      personId: string;
      roleId: string;
    },
    snapshot: ValidationSnapshot
  ): ValidationResult {
    const blokir: RuleViolation[] = [];
    const peringatan: RuleViolation[] = [];
    const namaOrang = snapshot.targetPerson.nama || context.personId;

    // BR-020: Kelayakan Peran
    if (this.isRuleActive(snapshot, BUSINESS_RULES.BR_020_KELAYAKAN_PERAN)) {
      const hasRole = snapshot.personRoles.some(
        (pr) => pr.person_id === context.personId && pr.role_id === context.roleId && pr.aktif === true
      );
      if (!hasRole) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_020_KELAYAKAN_PERAN,
          personId: context.personId,
          pesan: `${namaOrang}: tidak memiliki peran ${snapshot.targetRole.nama_peran || context.roleId}.`
        });
      }
    }

    // BR-026: Kuota Kapasitas Peran per Sesi
    if (this.isRuleActive(snapshot, BUSINESS_RULES.BR_026_KAPASITAS_KUOTA)) {
      const currentInSession = snapshot.currentWeekendAssignments.filter(
        (a) => a.session_id === context.sessionId && a.role_id === context.roleId && a.status === ASSIGNMENT_STATUS.ACTIVE
      ).length;
      if (currentInSession >= snapshot.targetRole.jumlah_maksimal) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_026_KAPASITAS_KUOTA,
          personId: context.personId,
          pesan: `Kuota ${snapshot.targetRole.nama_peran} untuk sesi ini sudah penuh (maksimal ${snapshot.targetRole.jumlah_maksimal}).`
        });
      }
    }

    // BR-030 & BR-031: Larangan tugas ganda dalam 1 akhir pekan (Kecuali Organis)
    const isOrganis = context.roleId === ROLE_IDS.ORGANIS;
    if (this.isRuleActive(snapshot, BUSINESS_RULES.BR_031_TUGAS_GANDA_AKHIR_PEKAN)) {
      const alreadyAssignedThisWeekend = snapshot.currentWeekendAssignments.some(
        (a) => a.person_id === context.personId && a.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (alreadyAssignedThisWeekend && !isOrganis) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_031_TUGAS_GANDA_AKHIR_PEKAN,
          personId: context.personId,
          pesan: `${namaOrang}: sudah bertugas pada sesi lain di akhir pekan ini (hanya Organis yang boleh bertugas >1x seminggu).`
        });
      }
    }

    // BR-032: Larangan bertugas berturut-turut antar akhir pekan
    if (this.isRuleActive(snapshot, BUSINESS_RULES.BR_032_LAYANAN_BERTURUT)) {
      const assignedAdjacent = snapshot.adjacentWeekendAssignments.some(
        (a) => a.person_id === context.personId && a.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (assignedAdjacent) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_032_LAYANAN_BERTURUT,
          personId: context.personId,
          pesan: `${namaOrang}: bertugas di akhir pekan sebelum atau sesudahnya (tidak boleh berturut-turut).`
        });
      }
    }

    // BR-013: Keadilan Wilayah Koor Paduan Suara
    if (this.isRuleActive(snapshot, BUSINESS_RULES.BR_013_BLACKLIST_PADUAN_SUARA) && !isOrganis) {
      const choirWilayahList = snapshot.currentWeekendCommunity
        .filter((c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA && c.status === ASSIGNMENT_STATUS.ACTIVE)
        .map((c) => c.wilayah_id);

      if (snapshot.targetPerson.wilayah_id && choirWilayahList.includes(snapshot.targetPerson.wilayah_id)) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_013_BLACKLIST_PADUAN_SUARA,
          personId: context.personId,
          pesan: `${namaOrang}: berasal dari Wilayah yang sedang bertugas Paduan Suara akhir pekan ini.`
        });
      }
    }

    return { blokir, peringatan };
  }

  public static validateCommunityAssignment(
    context: {
      weekendId: string;
      sessionId?: string;
      jenis: string;
      wilayahId?: string;
      lingkunganId?: string;
    },
    snapshot: {
      activeRules: Map<string, RuleConfigDoc>;
      currentWeekendCommunity: CommunityAssignmentDoc[];
      adjacentWeekendCommunity: CommunityAssignmentDoc[];
    }
  ): ValidationResult {
    const blokir: RuleViolation[] = [];
    const peringatan: RuleViolation[] = [];

    if (context.jenis === COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA && context.wilayahId) {
      const isDuplicateWeekend = snapshot.currentWeekendCommunity.some(
        (c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA && c.wilayah_id === context.wilayahId && c.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (isDuplicateWeekend) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_013_BLACKLIST_PADUAN_SUARA,
          pesan: 'Wilayah ini sudah bertugas Paduan Suara pada sesi lain di akhir pekan ini.'
        });
      }

      const isConsecutive = snapshot.adjacentWeekendCommunity.some(
        (c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA && c.wilayah_id === context.wilayahId && c.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (isConsecutive) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_013_BLACKLIST_PADUAN_SUARA,
          pesan: 'Wilayah ini bertugas Paduan Suara di akhir pekan sebelum/sesudahnya (tidak boleh berturut-turut).'
        });
      }
    }

    if (context.jenis === COMMUNITY_ASSIGNMENT_TYPE.TATIB && context.lingkunganId) {
      const isDuplicateTatib = snapshot.currentWeekendCommunity.some(
        (c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.TATIB && c.lingkungan_id === context.lingkunganId && c.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (isDuplicateTatib) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_041_KONFLIK_TATIB,
          pesan: 'Lingkungan ini sudah bertugas Tatib pada sesi lain di akhir pekan ini.'
        });
      }

      const isConsecutiveTatib = snapshot.adjacentWeekendCommunity.some(
        (c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.TATIB && c.lingkungan_id === context.lingkunganId && c.status === ASSIGNMENT_STATUS.ACTIVE
      );
      if (isConsecutiveTatib) {
        blokir.push({
          ruleId: BUSINESS_RULES.BR_041_KONFLIK_TATIB,
          pesan: 'Lingkungan ini bertugas Tatib di akhir pekan sebelum/sesudahnya (tidak boleh berturut-turut).'
        });
      }
    }

    if (context.jenis === COMMUNITY_ASSIGNMENT_TYPE.HIAS_ALTAR && context.wilayahId) {
      const choirWilayahList = snapshot.currentWeekendCommunity
        .filter((c) => c.jenis_penugasan === COMMUNITY_ASSIGNMENT_TYPE.PADUAN_SUARA && c.status === ASSIGNMENT_STATUS.ACTIVE)
        .map((c) => c.wilayah_id);

      if (choirWilayahList.includes(context.wilayahId)) {
        peringatan.push({
          ruleId: BUSINESS_RULES.BR_052_TUMPANG_TINDIH_PS_HIAS_ALTAR,
          pesan: 'Wilayah ini sudah bertugas Paduan Suara di akhir pekan ini.'
        });
      }
    }

    return { blokir, peringatan };
  }

  public static rankCandidatesByLru(
    candidates: PersonDoc[],
    lastAssignedMap: Map<string, number>
  ): PersonDoc[] {
    return [...candidates].sort((a, b) => {
      const timeA = lastAssignedMap.get(a.person_id) || 0;
      const timeB = lastAssignedMap.get(b.person_id) || 0;
      return timeA - timeB;
    });
  }
}
