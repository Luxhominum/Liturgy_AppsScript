import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ScheduleService } from '../services/scheduleService';
import { COLLECTIONS, ROLES } from '../config/constants';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper to authenticate & get caller role
async function getCallerAuth(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengguna belum terautentikasi.');
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : ROLES.VIEWER;

  return { uid, email, role };
}

/**
 * Assign officers to a session with full transaction & rule checks.
 */
export const assignIndividual = functions.https.onCall(async (data, context) => {
  const auth = await getCallerAuth(context);
  if (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SCHEDULER) {
    throw new functions.https.HttpsError('permission-denied', 'Akses ditolak: Hanya Admin atau Penjadwal yang dapat mengubah jadwal.');
  }

  const { weekendId, sessionId, roleId, personIds, expectedRevision, overrideReason } = data;
  if (!weekendId || !sessionId || !roleId || !Array.isArray(personIds) || expectedRevision === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Parameter penugasan tidak lengkap.');
  }

  try {
    return await ScheduleService.assignIndividual({
      weekendId,
      sessionId,
      roleId,
      personIds,
      expectedRevision,
      actorId: auth.email,
      actorRole: auth.role,
      overrideReason
    });
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message || 'Terjadi kesalahan sistem.');
  }
});

/**
 * Finalize weekend schedule (Admin only).
 */
export const finalizeWeekend = functions.https.onCall(async (data, context) => {
  const auth = await getCallerAuth(context);
  if (auth.role !== ROLES.ADMIN) {
    throw new functions.https.HttpsError('permission-denied', 'Hanya Admin yang dapat memfinalisasi jadwal.');
  }

  const { weekendId, expectedRevision } = data;
  if (!weekendId || expectedRevision === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'Parameter finalisasi tidak lengkap.');
  }

  return await ScheduleService.finalizeWeekend({
    weekendId,
    expectedRevision,
    actorId: auth.email
  });
});
