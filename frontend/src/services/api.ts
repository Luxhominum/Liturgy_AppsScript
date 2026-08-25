import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, functions } from '../config/firebase';
import type { Weekend, Session, Assignment, CommunityAssignment, Person } from '../types';

export interface AssignParams {
  weekendId: string;
  sessionId: string;
  roleId: string;
  personIds: string[];
  expectedRevision: number;
  overrideReason?: string;
}

/**
 * Call the transactional Cloud Function to assign individuals.
 */
export async function assignIndividualApi(params: AssignParams) {
  const assignFn = httpsCallable<AssignParams, { success: boolean; message?: string; assignments?: Assignment[] }>(
    functions,
    'assignIndividual'
  );
  const result = await assignFn(params);
  return result.data;
}

/**
 * Finalize weekend schedule (sets status to FINAL, increments revision).
 */
export async function finalizeWeekendApi(params: { weekendId: string; expectedRevision: number }) {
  try {
    const weekendRef = doc(db, 'weekends', params.weekendId);
    await setDoc(
      weekendRef,
      {
        status: 'FINAL',
        revisi: (params.expectedRevision || 1) + 1,
        finalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Optional Cloud Function invocation (non-blocking)
    try {
      const finalizeFn = httpsCallable<{ weekendId: string; expectedRevision: number }, { success: boolean; message?: string }>(
        functions,
        'finalizeWeekend'
      );
      await finalizeFn(params);
    } catch (cfErr) {
      console.warn('Cloud Function optional finalize call notice:', cfErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Finalize error:', err);
    throw err;
  }
}

/**
 * Real-time listener for Weekend schedule details.
 */
export function subscribeToWeekend(
  weekendId: string,
  onUpdate: (data: {
    weekend: Weekend | null;
    sessions: Session[];
    assignments: Assignment[];
    communityAssignments: CommunityAssignment[];
  }) => void
) {
  const weekendRef = doc(db, 'weekends', weekendId);
  const sessionsQuery = query(collection(db, 'weekends', weekendId, 'sessions'));
  const assignmentsQuery = query(
    collection(db, 'weekends', weekendId, 'assignments'),
    where('status', '==', 'ACTIVE')
  );
  const communityQuery = query(
    collection(db, 'weekends', weekendId, 'community_assignments'),
    where('status', '==', 'ACTIVE')
  );

  let weekendData: Weekend | null = null;
  let sessionsData: Session[] = [];
  let assignmentsData: Assignment[] = [];
  let communityData: CommunityAssignment[] = [];

  const unsubWeekend = onSnapshot(weekendRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      weekendData = { ...data, weekend_id: snap.id } as Weekend;
      if (Array.isArray(data.sessions) && data.sessions.length > 0) {
        sessionsData = data.sessions;
      }
      if (Array.isArray(data.assignments)) {
        assignmentsData = data.assignments.filter((a: any) => a.status !== 'REMOVED');
      }
      if (Array.isArray(data.communityAssignments)) {
        communityData = data.communityAssignments.filter((c: any) => c.status !== 'REMOVED');
      }
    } else {
      weekendData = null;
    }
    onUpdate({
      weekend: weekendData,
      sessions: sessionsData,
      assignments: assignmentsData,
      communityAssignments: communityData
    });
  });

  const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
    if (snap.docs.length > 0) {
      sessionsData = snap.docs.map((d) => ({ ...d.data(), session_id: d.id } as Session));
      onUpdate({ weekend: weekendData, sessions: sessionsData, assignments: assignmentsData, communityAssignments: communityData });
    }
  });

  const unsubAssignments = onSnapshot(assignmentsQuery, (snap) => {
    if (snap.docs.length > 0) {
      const subDocs = snap.docs.map((d) => ({ ...d.data(), assignment_id: d.id } as Assignment));
      const map = new Map<string, Assignment>();
      assignmentsData.forEach((a) => { if (a.status !== 'REMOVED') map.set(a.assignment_id, a); });
      subDocs.forEach((a) => { if (a.status !== 'REMOVED') map.set(a.assignment_id, a); });
      assignmentsData = Array.from(map.values());
      onUpdate({ weekend: weekendData, sessions: sessionsData, assignments: assignmentsData, communityAssignments: communityData });
    }
  });

  const unsubCommunity = onSnapshot(communityQuery, (snap) => {
    if (snap.docs.length > 0) {
      const subDocs = snap.docs.map((d) => ({ ...d.data(), community_assignment_id: d.id } as CommunityAssignment));
      const map = new Map<string, CommunityAssignment>();
      communityData.forEach((c) => { if (c.status !== 'REMOVED') map.set(c.community_assignment_id, c); });
      subDocs.forEach((c) => { if (c.status !== 'REMOVED') map.set(c.community_assignment_id, c); });
      communityData = Array.from(map.values());
      onUpdate({ weekend: weekendData, sessions: sessionsData, assignments: assignmentsData, communityAssignments: communityData });
    }
  });

  return () => {
    unsubWeekend();
    unsubSessions();
    unsubAssignments();
    unsubCommunity();
  };
}

/**
 * Real-time listener for the active officers list.
 */
export function subscribeToPeople(onUpdate: (people: Person[]) => void) {
  const peopleQuery = query(collection(db, 'people'), where('aktif', '==', true), orderBy('nama', 'asc'));
  return onSnapshot(peopleQuery, (snap) => {
    const people = snap.docs.map((d) => ({ ...d.data(), person_id: d.id } as Person));
    onUpdate(people);
  });
}
