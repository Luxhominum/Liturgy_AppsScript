import type { Session, RoleConfig, Person, Assignment, CommunityAssignment } from '../types';
import { getPersonQualifications, resolveWilayah } from './ruleValidator';

export interface AutoAssignResult {
  assignments: Assignment[];
  communityAssignments: CommunityAssignment[];
  details: {
    sessionId: string;
    sessionName: string;
    rolesFilled: {
      roleName: string;
      officers: { personId: string; name: string; reason: string }[];
    }[];
    choir?: { name: string; reason: string };
  }[];
}

const PARISH_WILAYAHS = [
  'MARIA RATU',
  'MARIA CARMEL',
  'MARIA IMMACULATA',
  'BRAYAT MINULYA',
  'MARIA ASSUMPTA',
  'MARIA BUNDA ALLAH',
  'MARIA CORDIS',
  'MARIA LOURDES',
  'MARIA MATER DEI',
  'MARIA MATER DOLOROSA',
  'MARIA RATU ROSARI',
  'MARIA TAK BERNODA',
];

const SPECIAL_WILAYAH = ['GRASIA', 'LUAR PAROKI', 'BECANBO', 'LAIN LAIN'];

export function runAutoAssignEngine({
  weekendId,
  sessions,
  roles,
  people,
  existingAssignments,
  existingCommunityAssignments,
  adjacentAssignments = [],
}: {
  weekendId: string;
  sessions: Session[];
  roles: RoleConfig[];
  people: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[];
  existingAssignments: Assignment[];
  existingCommunityAssignments: CommunityAssignment[];
  adjacentAssignments?: Assignment[];
}): AutoAssignResult {
  const newAssignments: Assignment[] = [...existingAssignments.filter((a) => a.status !== 'REMOVED')];
  const newCommunityAssignments: CommunityAssignment[] = [...existingCommunityAssignments.filter((c) => c.status !== 'REMOVED')];

  // Set of person IDs assigned anywhere in this weekend
  const assignedPersonIdsInWeekend = new Set<string>(
    newAssignments.map((a) => a.person_id)
  );

  // Set of person IDs assigned in adjacent weekends (N-7 or N+7)
  const assignedInAdjacentSet = new Set<string>(
    adjacentAssignments.map((a) => a.person_id)
  );

  // Active Choir Wilayahs in this weekend
  const assignedWilayahsInWeekend = new Set<string>();
  newCommunityAssignments
    .filter((c) => c.jenis_penugasan === 'PADUAN_SUARA')
    .forEach((c) => {
      const w = resolveWilayah(c.lingkungan_id, c.wilayah_id);
      if (w && !SPECIAL_WILAYAH.includes(w)) {
        assignedWilayahsInWeekend.add(w);
      }
    });

  const details: AutoAssignResult['details'] = [];

  sessions.forEach((session) => {
    const sessionDetail: AutoAssignResult['details'][0] = {
      sessionId: session.session_id,
      sessionName:
        session.nama_khusus ||
        (session.jenis_sesi === 'SABTU_SORE'
          ? 'Sabtu Sore - 17.00 WIB'
          : session.jenis_sesi === 'MINGGU_PAGI'
          ? 'Minggu Pagi - 07.00 WIB'
          : 'Minggu Sore - 17.00 WIB'),
      rolesFilled: [],
    };

    // 1. Auto-assign Choir (Paduan Suara) if not already assigned
    const existingChoir = newCommunityAssignments.find(
      (c) => c.session_id === session.session_id && c.jenis_penugasan === 'PADUAN_SUARA'
    );

    if (!existingChoir) {
      // Pick a Wilayah not yet assigned in this weekend
      const availableWilayahs = PARISH_WILAYAHS.filter(
        (w) => !assignedWilayahsInWeekend.has(w)
      );

      const chosenWilayah =
        availableWilayahs.length > 0
          ? availableWilayahs[Math.floor(Math.random() * availableWilayahs.length)]
          : PARISH_WILAYAHS[0];

      assignedWilayahsInWeekend.add(chosenWilayah);

      const commId = `comm-auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      newCommunityAssignments.push({
        community_assignment_id: commId,
        weekend_id: weekendId,
        session_id: session.session_id,
        jenis_penugasan: 'PADUAN_SUARA',
        wilayah_id: chosenWilayah,
        status: 'ACTIVE',
      });

      sessionDetail.choir = {
        name: chosenWilayah,
        reason: 'Rotasi Wilayah adil (belum bertugas akhir pekan ini)',
      };
    } else {
      sessionDetail.choir = {
        name: existingChoir.wilayah_id || existingChoir.lingkungan_id || 'Sudah Ditugaskan',
        reason: 'Telah ditentukan sebelumnya',
      };
    }

    // 2. Auto-assign Individual Roles (Organis, Pemazmur, Lektor, Misdinar, Prodiakon)
    roles.forEach((role) => {
      const currentRoleAssignments = newAssignments.filter(
        (a) => a.session_id === session.session_id && a.role_id === role.role_id
      );

      const needed = role.jumlah_dibutuhkan - currentRoleAssignments.length;
      const roleFilledEntry = {
        roleName: role.nama_peran,
        officers: currentRoleAssignments.map((a) => ({
          personId: a.person_id,
          name: people.find((p) => p.person_id === a.person_id || p.nama === a.person_id)?.nama || a.person_id,
          reason: 'Sudah ada di jadwal',
        })),
      };

      if (needed > 0) {
        // Filter eligible people for this role
        const eligiblePeople = people.filter((p) => {
          if (!p.aktif) return false;

          // BR-020: Kelayakan Peran
          const qual = getPersonQualifications(p);
          const hasRole = qual.some((q) => q.toLowerCase().includes(role.nama_peran.toLowerCase()));
          if (!hasRole) return false;

          // BR-031: Larangan tugas ganda di akhir pekan yang sama (kecuali Organis)
          const isOrganis = role.role_id === 'ROL-ORGANIS';
          if (!isOrganis && (assignedPersonIdsInWeekend.has(p.person_id) || assignedPersonIdsInWeekend.has(p.nama))) {
            return false;
          }

          // BR-032: Larangan bertugas berturut-turut di 2 minggu berdampingan
          if (assignedInAdjacentSet.has(p.person_id) || assignedInAdjacentSet.has(p.nama)) {
            return false;
          }

          // BR-013: Anggota wilayah Koor tidak boleh ditugaskan peran perorangan (kecuali Organis)
          if (!isOrganis) {
            const pWil = resolveWilayah(p.namaLingkungan || p.lingkungan_id, p.namaWilayah);
            if (pWil && assignedWilayahsInWeekend.has(pWil)) {
              return false;
            }
          }

          return true;
        });

        // Spread fairly
        const shuffled = [...eligiblePeople].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, needed);

        selected.forEach((person, idx) => {
          const asgId = `asg-auto-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
          newAssignments.push({
            assignment_id: asgId,
            weekend_id: weekendId,
            session_id: session.session_id,
            person_id: person.person_id,
            role_id: role.role_id,
            status: 'ACTIVE',
          });

          assignedPersonIdsInWeekend.add(person.person_id);
          assignedPersonIdsInWeekend.add(person.nama);

          roleFilledEntry.officers.push({
            personId: person.person_id,
            name: person.nama,
            reason: `Lingkungan ${person.namaLingkungan || person.lingkungan_id} • Kualifikasi ${role.nama_peran} aktif`,
          });
        });
      }

      sessionDetail.rolesFilled.push(roleFilledEntry);
    });

    details.push(sessionDetail);
  });

  return {
    assignments: newAssignments,
    communityAssignments: newCommunityAssignments,
    details,
  };
}

