import * as admin from 'firebase-admin';
import {
  COLLECTIONS,
  ASSIGNMENT_STATUS,
  WEEKEND_STATUS
} from '../config/constants';
import {
  AssignmentDoc,
  CommunityAssignmentDoc,
  PersonDoc,
  PersonRoleDoc,
  RoleConfigDoc,
  RuleConfigDoc,
  WeekendDoc,
  LingkunganDoc,
  AuditLogDoc
} from '../types';
import { ConflictEngine, ValidationSnapshot } from '../rules/conflictEngine';

const db = admin.firestore();

export class ScheduleService {
  public static async assignIndividual(params: {
    weekendId: string;
    sessionId: string;
    roleId: string;
    personIds: string[];
    expectedRevision: number;
    actorId: string;
    actorRole: string;
    overrideReason?: string;
  }): Promise<{ success: boolean; message?: string; assignments?: AssignmentDoc[]; violations?: any }> {
    const weekendRef = db.collection(COLLECTIONS.WEEKENDS).doc(params.weekendId);
    const sessionRef = weekendRef.collection(COLLECTIONS.SESSIONS).doc(params.sessionId);

    return db.runTransaction(async (transaction) => {
      const weekendSnap = await transaction.get(weekendRef);
      if (!weekendSnap.exists) {
        throw new Error('Akhir Pekan tidak ditemukan.');
      }
      const weekendData = weekendSnap.data() as WeekendDoc;

      if (weekendData.status === WEEKEND_STATUS.FINAL) {
        throw new Error('Jadwal sudah Final dan terkunci dari perubahan.');
      }

      if (weekendData.revisi !== params.expectedRevision) {
        return {
          success: false,
          message: 'REVISI_KEDALUWARSA: Jadwal baru saja diubah oleh pengguna lain. Silakan muat ulang.'
        };
      }

      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new Error('Sesi tidak ditemukan.');
      }

      const roleSnap = await transaction.get(db.collection(COLLECTIONS.ROLE_CONFIG).doc(params.roleId));
      if (!roleSnap.exists) {
        throw new Error('Konfigurasi peran tidak ditemukan.');
      }
      const roleData = roleSnap.data() as RoleConfigDoc;

      const rulesSnap = await transaction.get(db.collection(COLLECTIONS.RULE_CONFIG));
      const activeRules = new Map<string, RuleConfigDoc>();
      rulesSnap.docs.forEach((d) => activeRules.set(d.id, d.data() as RuleConfigDoc));

      const currentAssignmentsSnap = await transaction.get(
        weekendRef.collection(COLLECTIONS.ASSIGNMENTS).where('status', '==', ASSIGNMENT_STATUS.ACTIVE)
      );
      const currentWeekendAssignments = currentAssignmentsSnap.docs.map((d) => d.data() as AssignmentDoc);

      const currentCommunitySnap = await transaction.get(
        weekendRef.collection(COLLECTIONS.COMMUNITY_ASSIGNMENTS).where('status', '==', ASSIGNMENT_STATUS.ACTIVE)
      );
      const currentWeekendCommunity = currentCommunitySnap.docs.map((d) => d.data() as CommunityAssignmentDoc);

      const allWeekendsSnap = await transaction.get(
        db.collection(COLLECTIONS.WEEKENDS).orderBy('tanggal_acuan', 'asc')
      );
      const allWeekends = allWeekendsSnap.docs.map((d) => d.data() as WeekendDoc);
      const currentIndex = allWeekends.findIndex((w) => w.weekend_id === params.weekendId);

      const adjacentWeekendIds: string[] = [];
      if (currentIndex > 0) adjacentWeekendIds.push(allWeekends[currentIndex - 1].weekend_id);
      if (currentIndex >= 0 && currentIndex < allWeekends.length - 1) {
        adjacentWeekendIds.push(allWeekends[currentIndex + 1].weekend_id);
      }

      let adjacentWeekendAssignments: AssignmentDoc[] = [];
      let adjacentWeekendCommunity: CommunityAssignmentDoc[] = [];

      for (const adjId of adjacentWeekendIds) {
        const adjAssignSnap = await transaction.get(
          db.collection(COLLECTIONS.WEEKENDS).doc(adjId).collection(COLLECTIONS.ASSIGNMENTS)
            .where('status', '==', ASSIGNMENT_STATUS.ACTIVE)
        );
        adjacentWeekendAssignments.push(...adjAssignSnap.docs.map((d) => d.data() as AssignmentDoc));

        const adjCommSnap = await transaction.get(
          db.collection(COLLECTIONS.WEEKENDS).doc(adjId).collection(COLLECTIONS.COMMUNITY_ASSIGNMENTS)
            .where('status', '==', ASSIGNMENT_STATUS.ACTIVE)
        );
        adjacentWeekendCommunity.push(...adjCommSnap.docs.map((d) => d.data() as CommunityAssignmentDoc));
      }

      const allBlokir: any[] = [];
      const allPeringatan: any[] = [];

      for (const personId of params.personIds) {
        const personSnap = await transaction.get(db.collection(COLLECTIONS.PEOPLE).doc(personId));
        if (!personSnap.exists) {
          throw new Error(`Data petugas dengan ID ${personId} tidak ditemukan.`);
        }
        const personData = personSnap.data() as PersonDoc;

        // Resolve person's Wilayah via Lingkungan
        let wilayahId: string | undefined = undefined;
        if (personData.lingkungan_id) {
          const lkgSnap = await transaction.get(db.collection(COLLECTIONS.LINGKUNGAN).doc(personData.lingkungan_id));
          if (lkgSnap.exists) {
            wilayahId = (lkgSnap.data() as LingkunganDoc).wilayah_id;
          }
        }

        const personRolesSnap = await transaction.get(
          db.collection(COLLECTIONS.PERSON_ROLES).where('person_id', '==', personId).where('aktif', '==', true)
        );
        const personRoles = personRolesSnap.docs.map((d) => d.data() as PersonRoleDoc);

        const snapshot: ValidationSnapshot = {
          targetWeekendId: params.weekendId,
          targetPerson: { ...personData, wilayah_id: wilayahId },
          targetRole: roleData,
          activeRules,
          personRoles,
          currentWeekendAssignments,
          currentWeekendCommunity,
          adjacentWeekendAssignments,
          adjacentWeekendCommunity
        };

        const validation = ConflictEngine.validateIndividualAssignment(
          {
            weekendId: params.weekendId,
            sessionId: params.sessionId,
            personId,
            roleId: params.roleId
          },
          snapshot
        );

        allBlokir.push(...validation.blokir);
        allPeringatan.push(...validation.peringatan);
      }

      if (allBlokir.length > 0) {
        return {
          success: false,
          message: 'DIBLOKIR: Pelanggaran aturan bisnis.',
          violations: { blokir: allBlokir, peringatan: allPeringatan }
        };
      }

      if (allPeringatan.length > 0 && (params.actorRole !== 'ADMIN' || !params.overrideReason)) {
        return {
          success: false,
          message: 'PERINGATAN: Membutuhkan konfirmasi alasan override oleh Admin.',
          violations: { blokir: [], peringatan: allPeringatan }
        };
      }

      const now = new Date();
      const newAssignments: AssignmentDoc[] = [];

      for (const personId of params.personIds) {
        const newAssignRef = weekendRef.collection(COLLECTIONS.ASSIGNMENTS).doc();
        const assignmentDoc: AssignmentDoc = {
          assignment_id: newAssignRef.id,
          weekend_id: params.weekendId,
          session_id: params.sessionId,
          person_id: personId,
          role_id: params.roleId,
          status: ASSIGNMENT_STATUS.ACTIVE,
          dibuat_pada: now,
          dibuat_oleh: params.actorId,
          diubah_pada: now,
          diubah_oleh: params.actorId
        };
        transaction.set(newAssignRef, assignmentDoc);
        newAssignments.push(assignmentDoc);

        const auditRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
        const auditDoc: AuditLogDoc = {
          audit_id: auditRef.id,
          waktu: now,
          pelaku_id: params.actorId,
          aksi: 'TUGASKAN_PETUGAS',
          jenis_entitas: 'Assignment',
          entitas_id: newAssignRef.id,
          nilai_baru_json: JSON.stringify(assignmentDoc),
          alasan_override: params.overrideReason
        };
        transaction.set(auditRef, auditDoc);
      }

      transaction.update(weekendRef, {
        revisi: weekendData.revisi + 1,
        diubah_pada: now
      });

      return {
        success: true,
        assignments: newAssignments
      };
    });
  }

  public static async finalizeWeekend(params: {
    weekendId: string;
    expectedRevision: number;
    actorId: string;
  }): Promise<{ success: boolean; message?: string }> {
    const weekendRef = db.collection(COLLECTIONS.WEEKENDS).doc(params.weekendId);

    return db.runTransaction(async (transaction) => {
      const weekendSnap = await transaction.get(weekendRef);
      if (!weekendSnap.exists) throw new Error('Akhir Pekan tidak ditemukan.');
      const data = weekendSnap.data() as WeekendDoc;

      if (data.revisi !== params.expectedRevision) {
        return { success: false, message: 'REVISI_KEDALUWARSA: Jadwal baru saja diubah.' };
      }

      const now = new Date();
      transaction.update(weekendRef, {
        status: WEEKEND_STATUS.FINAL,
        difinalkan_pada: now,
        difinalkan_oleh: params.actorId,
        revisi: data.revisi + 1,
        diubah_pada: now
      });

      const auditRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
      transaction.set(auditRef, {
        audit_id: auditRef.id,
        waktu: now,
        pelaku_id: params.actorId,
        aksi: 'FINALKAN_JADWAL',
        jenis_entitas: 'Weekend',
        entitas_id: params.weekendId
      });

      return { success: true };
    });
  }
}
