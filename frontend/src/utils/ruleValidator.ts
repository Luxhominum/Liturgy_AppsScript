import { REAL_OFFICERS_DATA } from '../data/realOfficers';
import { LINGKUNGAN_TO_WILAYAH } from '../data/lingkunganWilayahMap';
import type { Session, Assignment, CommunityAssignment, RoleConfig, Person } from '../types';

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  level: 'WAJIB' | 'PERINGATAN';
  sessionId?: string;
  sessionName?: string;
  personId?: string;
  personName?: string;
  assignmentId?: string;
  details: string;
}

export interface ValidationSummary {
  isValid: boolean;
  blockers: RuleViolation[];
  warnings: RuleViolation[];
}

export const ROLE_ID_TO_NAME: Record<string, string> = {
  'ROL-ORGANIS': 'Organis',
  'ROL-PEMAZMUR': 'Pemazmur',
  'ROL-LEKTOR': 'Lektor',
  'ROL-MISDINAR': 'Misdinar',
  'ROL-PRODIAKON': 'Prodiakon',
};

const SPECIAL_WILAYAH = ['GRASIA', 'LUAR PAROKI', 'BECANBO', 'LAIN LAIN'];

/**
 * Normalizes person roles qualification from REAL_OFFICERS_DATA fallback.
 */
export function getPersonQualifications(person: Person & { peranList?: string[] }): string[] {
  if (person.peranList && person.peranList.length > 0) {
    return person.peranList;
  }
  const realOfficer = REAL_OFFICERS_DATA.find(
    (o) => o.nama.trim().toLowerCase() === person.nama.trim().toLowerCase()
  );
  if (!realOfficer) return [];
  const list: string[] = [];
  if (realOfficer.organis) list.push('Organis');
  if (realOfficer.mazmur) list.push('Pemazmur');
  if (realOfficer.lektor) list.push('Lektor');
  if (realOfficer.misdinar) list.push('Misdinar');
  if (realOfficer.prodiakon) list.push('Prodiakon');
  return list;
}

/**
 * Resolves Wilayah for an officer or community assignment.
 */
export function resolveWilayah(lingkunganName?: string, fallbackWilayah?: string): string {
  if (fallbackWilayah && fallbackWilayah.trim()) {
    return fallbackWilayah.trim().toUpperCase();
  }
  if (lingkunganName && lingkunganName.trim()) {
    const mapped = LINGKUNGAN_TO_WILAYAH[lingkunganName.trim().toUpperCase()];
    if (mapped) return mapped.toUpperCase();
    return lingkunganName.trim().toUpperCase();
  }
  return '';
}

/**
 * Returns date strings for adjacent weekends (N-7 days and N+7 days).
 */
export function getAdjacentWeekendDates(referenceDateStr: string): { prevDate: string; nextDate: string } {
  const d = new Date(referenceDateStr + 'T00:00:00');
  const prevD = new Date(d);
  prevD.setDate(prevD.getDate() - 7);
  const nextD = new Date(d);
  nextD.setDate(nextD.getDate() + 7);

  const format = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    prevDate: format(prevD),
    nextDate: format(nextD),
  };
}

/**
 * Validates a weekend schedule against liturgical business rules.
 */
export function validateWeekendSchedule({
  weekendId: _weekendId,
  targetDate = '',
  isSpecialMass = false,
  sessions,
  assignments,
  communityAssignments,
  roles = [],
  people = [],
  adjacentSchedules = [],
}: {
  weekendId?: string;
  targetDate?: string;
  isSpecialMass?: boolean;
  sessions: Session[];
  assignments: Assignment[];
  communityAssignments: CommunityAssignment[];
  roles?: RoleConfig[];
  people?: (Person & { peranList?: string[]; namaLingkungan?: string; namaWilayah?: string })[];
  adjacentSchedules?: {
    weekendId: string;
    tanggalAcuan: string;
    assignments: Assignment[];
    communityAssignments: CommunityAssignment[];
  }[];
}): ValidationSummary {
  const blockers: RuleViolation[] = [];
  const warnings: RuleViolation[] = [];

  if (isSpecialMass) {
    return { isValid: true, blockers: [], warnings: [] };
  }

  const adjacentAssignments: Assignment[] = adjacentSchedules.flatMap((s) => s.assignments || []);
  const activeAssignments = assignments.filter((a) => a.status !== 'REMOVED');
  const activeCommunity = communityAssignments.filter((c) => c.status !== 'REMOVED');

  const getPersonName = (personId: string) => {
    const p = people.find((item) => item.person_id === personId || item.nama === personId);
    return p?.nama || personId;
  };

  const getSessionName = (sessionId: string) => {
    const s = sessions.find((item) => item.session_id === sessionId);
    if (!s) return 'Sesi Misa';
    return (
      s.nama_khusus ||
      (s.jenis_sesi === 'SABTU_SORE'
        ? 'Sabtu Sore (17.00)'
        : s.jenis_sesi === 'MINGGU_PAGI'
        ? 'Minggu Pagi (07.00)'
        : 'Minggu Sore (17.00)')
    );
  };

  // 1. Identify Active Choir Wilayahs for this weekend
  const activeChoirWilayahs = new Set<string>();
  activeCommunity
    .filter((c) => c.jenis_penugasan === 'PADUAN_SUARA')
    .forEach((c) => {
      if (c.wilayah_id && !c.wilayah_id.startsWith('KHUSUS:') && !SPECIAL_WILAYAH.includes(c.wilayah_id.toUpperCase())) {
        activeChoirWilayahs.add(c.wilayah_id.toUpperCase());
      }
      if (c.lingkungan_id) {
        const w = LINGKUNGAN_TO_WILAYAH[c.lingkungan_id.toUpperCase()];
        if (w && !SPECIAL_WILAYAH.includes(w.toUpperCase())) {
          activeChoirWilayahs.add(w.toUpperCase());
        }
      }
    });

  // 2. Map of person assignments within this weekend
  const personAssignmentMap = new Map<string, { sessionId: string; roleId: string; assignmentId: string }[]>();
  activeAssignments.forEach((a) => {
    const list = personAssignmentMap.get(a.person_id) || [];
    list.push({ sessionId: a.session_id, roleId: a.role_id, assignmentId: a.assignment_id });
    personAssignmentMap.set(a.person_id, list);
  });

  // Check BR-030 / BR-031: Double assignment in same weekend (no officer may serve multiple sessions except Organis)
  personAssignmentMap.forEach((assignedList, personId) => {
    const nonOrganis = assignedList.filter(item => item.roleId !== 'ROL-ORGANIS');
    if (nonOrganis.length > 1) {
      const personName = getPersonName(personId);
      const sessionNames = nonOrganis.map((item) => getSessionName(item.sessionId)).join(' & ');
      blockers.push({
        ruleId: 'BR-031',
        ruleName: 'Larangan Tugas Ganda 1 Akhir Pekan',
        level: 'WAJIB',
        personId,
        personName,
        assignmentId: nonOrganis[0]?.assignmentId,
        details: `${personName} ditugaskan pada lebih dari 1 sesi (${sessionNames}) di akhir pekan yang sama.`,
      });
    }
  });

  // 3. Check BR-020 (Kelayakan Peran) & BR-013 (Blacklist Wilayah Koor) & BR-032 (Adjacent Weekends)
  activeAssignments.forEach((a) => {
    const person = people.find((p) => p.person_id === a.person_id || p.nama === a.person_id);
    const personName = person?.nama || a.person_id;
    const sessionName = getSessionName(a.session_id);
    const roleConfig = roles.find((r) => r.role_id === a.role_id);
    const roleName = ROLE_ID_TO_NAME[a.role_id] || roleConfig?.nama_peran || a.role_id;

    if (person) {
      // BR-020: Kelayakan Peran
      const qual = getPersonQualifications(person);
      const isEligible = qual.some((q) => q.toLowerCase().includes(roleName.toLowerCase()));
      if (!isEligible) {
        blockers.push({
          ruleId: 'BR-020',
          ruleName: 'Kelayakan Peran Petugas',
          level: 'WAJIB',
          sessionId: a.session_id,
          sessionName,
          personId: a.person_id,
          personName,
          assignmentId: a.assignment_id,
          details: `${personName} tidak memiliki kualifikasi peran sebagai ${roleName}.`,
        });
      }

      // BR-013: Petugas dari Wilayah yang sedang Koor (kecuali Organis)
      if (a.role_id !== 'ROL-ORGANIS') {
        const personWilayah = resolveWilayah(person.namaLingkungan || person.lingkungan_id, person.namaWilayah);
        if (personWilayah && activeChoirWilayahs.has(personWilayah.toUpperCase())) {
          blockers.push({
            ruleId: 'BR-013',
            ruleName: 'Petugas dari Wilayah Koor',
            level: 'WAJIB',
            sessionId: a.session_id,
            sessionName,
            personId: a.person_id,
            personName,
            assignmentId: a.assignment_id,
            details: `${personName} berasal dari Wilayah ${personWilayah} yang sedang bertugas Paduan Suara di akhir pekan ini.`,
          });
        }
      }

      // BR-032: Larangan Tugas Berturut-turut
      if (a.role_id !== 'ROL-ORGANIS') {
        const inAdjacent = adjacentAssignments.some(
          (adj) => (adj.person_id || '').toLowerCase() === (a.person_id || '').toLowerCase() && adj.status !== 'REMOVED'
        );
        if (inAdjacent) {
          blockers.push({
            ruleId: 'BR-032',
            ruleName: 'Larangan Tugas Berturut-turut',
            level: 'WAJIB',
            sessionId: a.session_id,
            sessionName,
            personId: a.person_id,
            personName,
            assignmentId: a.assignment_id,
            details: `${personName} telah bertugas pada pekan sebelumnya atau sesudahnya.`,
          });
        }
      }
    }
  });

  // 4. Check BR-026: Quota per session
  sessions.forEach((sess) => {
    const sessionName = getSessionName(sess.session_id);
    roles.forEach((role) => {
      const assignedCount = activeAssignments.filter(
        (a) => a.session_id === sess.session_id && a.role_id === role.role_id
      ).length;

      if (assignedCount > role.jumlah_maksimal) {
        blockers.push({
          ruleId: 'BR-026',
          ruleName: 'Kapasitas Kuota Peran',
          level: 'WAJIB',
          sessionId: sess.session_id,
          sessionName,
          details: `Jumlah ${role.nama_peran} pada sesi ${sessionName} (${assignedCount} orang) melebihi batas maksimal (${role.jumlah_maksimal}).`,
        });
      } else if (assignedCount < role.jumlah_dibutuhkan) {
        warnings.push({
          ruleId: 'BR-026',
          ruleName: 'Kelengkapan Kuota',
          level: 'PERINGATAN',
          sessionId: sess.session_id,
          sessionName,
          details: `Peran ${role.nama_peran} pada sesi ${sessionName} belum lengkap (${assignedCount}/${role.jumlah_dibutuhkan} tempat).`,
        });
      }
    });
  });

  // 5. Check BR-032 (Bertugas Berturut-turut Antar Minggu) & BR-013/BR-041 (Koor/Tatib Berturut-turut)
  const { prevDate, nextDate } = getAdjacentWeekendDates(targetDate);
  const adjacentSchedulesList = adjacentSchedules.filter(
    (s) => s.tanggalAcuan === prevDate || s.tanggalAcuan === nextDate
  );

  adjacentSchedulesList.forEach((adj) => {
    const adjLabel = adj.tanggalAcuan === prevDate ? `minggu sebelumnya (${prevDate})` : `minggu berikutnya (${nextDate})`;
    const adjActiveAssignments = (adj.assignments || []).filter((a) => a.status !== 'REMOVED');
    const adjActiveCommunity = (adj.communityAssignments || []).filter((c) => c.status !== 'REMOVED');

    // BR-032: Petugas perorangan berturut-turut
    activeAssignments.forEach((a) => {
      const isAssignedAdj = adjActiveAssignments.some(
        (adjA) => adjA.person_id === a.person_id
      );
      if (isAssignedAdj) {
        const personName = getPersonName(a.person_id);
        blockers.push({
          ruleId: 'BR-032',
          ruleName: 'Larangan Tugas Berturut-turut 2 Minggu',
          level: 'WAJIB',
          personId: a.person_id,
          personName,
          details: `${personName} bertugas di ${adjLabel}. Petugas wajib memiliki jeda minimal 1 minggu antar penugasan.`,
        });
      }
    });

    // BR-013: Koor Wilayah berturut-turut
    activeCommunity
      .filter((c) => c.jenis_penugasan === 'PADUAN_SUARA')
      .forEach((c) => {
        const w = resolveWilayah(c.lingkungan_id, c.wilayah_id);
        if (w && !SPECIAL_WILAYAH.includes(w)) {
          const adjHasSameChoir = adjActiveCommunity.some((adjC) => {
            if (adjC.jenis_penugasan !== 'PADUAN_SUARA') return false;
            const adjW = resolveWilayah(adjC.lingkungan_id, adjC.wilayah_id);
            return adjW === w;
          });
          if (adjHasSameChoir) {
            blockers.push({
              ruleId: 'BR-013',
              ruleName: 'Koor Wilayah Berturut-turut',
              level: 'WAJIB',
              details: `Wilayah ${w} bertugas Paduan Suara di ${adjLabel}. Wilayah tidak boleh bertugas koor di 2 minggu berturut-turut.`,
            });
          }
        }
      });

    // BR-041: Tatib Lingkungan berturut-turut
    activeCommunity
      .filter((c) => c.jenis_penugasan === 'TATIB' && c.lingkungan_id)
      .forEach((c) => {
        const ling = c.lingkungan_id!.toUpperCase();
        const adjHasSameTatib = adjActiveCommunity.some(
          (adjC) => adjC.jenis_penugasan === 'TATIB' && adjC.lingkungan_id?.toUpperCase() === ling
        );
        if (adjHasSameTatib) {
          blockers.push({
            ruleId: 'BR-041',
            ruleName: 'Tatib Lingkungan Berturut-turut',
            level: 'WAJIB',
            details: `Lingkungan ${ling} bertugas Tatib di ${adjLabel}. Lingkungan tidak boleh bertugas tatib di 2 minggu berturut-turut.`,
          });
        }
      });
  });

  return {
    isValid: blockers.length === 0,
    blockers,
    warnings,
  };
}
