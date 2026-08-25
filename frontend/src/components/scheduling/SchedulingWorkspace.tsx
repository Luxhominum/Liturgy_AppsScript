import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  WorkspaceHeader,
  SessionNavTabs,
  SessionCard,
  StatusPanel,
  SelectOfficerModal,
  CreateWeekendModal
} from './index';
import { Dialog, Input, Button } from '../ui';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';
import type {
  Weekend,
  Session,
  Assignment,
  CommunityAssignment,
  Person,
  RoleConfig,
  SessionProgress,
  UserRole
} from '../../types';
import { assignIndividualApi, finalizeWeekendApi, subscribeToWeekend, subscribeToPeople } from '../../services/api';

interface SchedulingWorkspaceProps {
  userRole: UserRole;
  initialWeekendId?: string;
  isSpecialMode?: boolean;
  onOpenCalendar?: () => void;
}

const DEFAULT_ROLES: RoleConfig[] = [
  { role_id: 'ROL-ORGANIS', nama_peran: 'Organis', jumlah_dibutuhkan: 1, jumlah_maksimal: 1, aktif: true, urutan: 1 },
  { role_id: 'ROL-PEMAZMUR', nama_peran: 'Pemazmur', jumlah_dibutuhkan: 2, jumlah_maksimal: 2, aktif: true, urutan: 2 },
  { role_id: 'ROL-LEKTOR', nama_peran: 'Lektor', jumlah_dibutuhkan: 3, jumlah_maksimal: 3, aktif: true, urutan: 3 },
  { role_id: 'ROL-MISDINAR', nama_peran: 'Misdinar', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 4 },
  { role_id: 'ROL-PRODIAKON', nama_peran: 'Prodiakon', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 5 },
];

const SPECIAL_WILAYAH = ['Grasia', 'Luar Paroki', 'Becanbo', 'Lain Lain'];

const INITIAL_REAL_PEOPLE: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[] = REAL_OFFICERS_DATA.map((o, idx) => {
  const peranList: string[] = [];
  if (o.organis) peranList.push('Organis');
  if (o.mazmur) peranList.push('Pemazmur');
  if (o.lektor) peranList.push('Lektor');
  if (o.misdinar) peranList.push('Misdinar');
  if (o.prodiakon) peranList.push('Prodiakon');

  return {
    person_id: `PER-${String(idx + 1).padStart(3, '0')}`,
    nama: o.nama,
    lingkungan_id: o.lingkungan,
    namaLingkungan: o.lingkungan,
    namaWilayah: o.wilayah,
    aktif: true,
    peranList
  };
});

import { LINGKUNGAN_TO_WILAYAH } from '../../data/lingkunganWilayahMap';

const PARISH_WILAYAH_LIST = [
  { wilayah_id: 'WIL-001', nama: 'MARIA RATU' },
  { wilayah_id: 'WIL-002', nama: 'MARIA CARMEL' },
  { wilayah_id: 'WIL-003', nama: 'MARIA IMMACULATA' },
  { wilayah_id: 'WIL-004', nama: 'BRAYAT MINULYA' },
  { wilayah_id: 'WIL-005', nama: 'MARIA ASSUMPTA' },
  { wilayah_id: 'WIL-006', nama: 'MARIA BUNDA ALLAH' },
  { wilayah_id: 'WIL-007', nama: 'MARIA CORDIS' },
  { wilayah_id: 'WIL-008', nama: 'MARIA LOURDES' },
  { wilayah_id: 'WIL-009', nama: 'MARIA MATER DEI' },
  { wilayah_id: 'WIL-010', nama: 'MARIA MATER DOLOROSA' },
  { wilayah_id: 'WIL-011', nama: 'MARIA RATU ROSARI' },
  { wilayah_id: 'WIL-012', nama: 'MARIA TAK BERNODA' },
];

const PARISH_LINGKUNGAN_LIST: { lingkungan_id: string; nama: string; wilayah_id: string }[] = Object.entries(LINGKUNGAN_TO_WILAYAH).map(([ling, wil], idx) => ({
  lingkungan_id: `LING-${String(idx + 1).padStart(3, '0')}`,
  nama: ling,
  wilayah_id: String(wil)
}));

export default function SchedulingWorkspace({
  userRole,
  initialWeekendId,
  isSpecialMode = false,
  onOpenCalendar,
}: SchedulingWorkspaceProps) {
  const [allWeekends, setAllWeekends] = useState<any[]>([]);
  const [selectedWeekendId, setSelectedWeekendId] = useState<string>(initialWeekendId || 'w-demo-2024-08-18');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('17.00 WIB');

  const [selectModalState, setSelectModalState] = useState<{
    open: boolean;
    sessionId: string;
    sessionName: string;
    role: RoleConfig | null;
  }>({
    open: false,
    sessionId: '',
    sessionName: '',
    role: null
  });

  const [weekend, setWeekend] = useState<Weekend | null>({
    weekend_id: selectedWeekendId,
    tanggal_acuan: selectedWeekendId.replace('w-', ''),
    status: 'DRAFT',
    revisi: 1
  });

  // Dynamic sessions
  const [sessions, setSessions] = useState<Session[]>([
    { session_id: 'ses-1', weekend_id: selectedWeekendId, jenis_sesi: 'SABTU_SORE', tanggal_sesi: '2024-08-17T17:00:00Z', status: 'DRAFT' },
    { session_id: 'ses-2', weekend_id: selectedWeekendId, jenis_sesi: 'MINGGU_PAGI', tanggal_sesi: '2024-08-18T08:00:00Z', status: 'DRAFT' },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>('ses-1');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [communityAssignments, setCommunityAssignments] = useState<CommunityAssignment[]>([]);
  const [people, setPeople] = useState(INITIAL_REAL_PEOPLE);

  // Subscribe to all weekends from Firestore for left panel
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'weekends'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllWeekends(list);
      if (list.length > 0 && !selectedWeekendId) {
        setSelectedWeekendId(list[0].id);
      }
    });
    return () => unsub();
  }, []);

  // Update selected weekend
  useEffect(() => {
    if (selectedWeekendId) {
      setWeekend({
        weekend_id: selectedWeekendId,
        tanggal_acuan: selectedWeekendId.replace('w-', ''),
        status: 'DRAFT',
        revisi: 1
      });
    }
  }, [selectedWeekendId]);

  // Subscribe to active weekend details
  useEffect(() => {
    if (!weekend?.weekend_id) return;
    const unsubWeekend = subscribeToWeekend(weekend.weekend_id, (data) => {
      if (data.weekend) setWeekend(data.weekend);
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
      }
      setAssignments(data.assignments);
      setCommunityAssignments(data.communityAssignments);
    });

    const unsubPeople = subscribeToPeople((livePeople) => {
      if (livePeople.length > 0) {
        setPeople((prev) =>
          livePeople.map((lp) => {
            const existing = prev.find((p) => p.person_id === lp.person_id);
            return {
              ...lp,
              namaLingkungan: existing?.namaLingkungan,
              namaWilayah: existing?.namaWilayah,
              peranList: existing?.peranList || []
            };
          })
        );
      }
    });

    return () => {
      unsubWeekend();
      unsubPeople();
    };
  }, [weekend?.weekend_id]);

  useEffect(() => {
    if (sessions.length > 0 && !sessions.some((s) => s.session_id === activeSessionId)) {
      setActiveSessionId(sessions[0].session_id);
    }
  }, [sessions, activeSessionId]);

  const progressMap: Record<string, SessionProgress[]> = {};
  sessions.forEach((s) => {
    progressMap[s.session_id] = DEFAULT_ROLES.map((role) => {
      const filled = assignments.filter((a) => a.session_id === s.session_id && a.role_id === role.role_id && a.status !== 'REMOVED').length;
      return {
        roleId: role.role_id,
        namaPeran: role.nama_peran,
        dibutuhkan: role.jumlah_dibutuhkan,
        terisi: filled,
        status: filled >= role.jumlah_dibutuhkan ? 'TERPENUHI' : 'BELUM_LENGKAP'
      };
    });
  });

  const handleOpenSelectModal = (sessionId: string, sessionName: string, role: RoleConfig) => {
    setSelectModalState({
      open: true,
      sessionId,
      sessionName,
      role
    });
  };

  const handleAssignOfficers = async (personIds: string[], overrideReason?: string) => {
    if (!weekend || !selectModalState.role) return;

    try {
      const newAssignments: Assignment[] = personIds.map((pId) => ({
        assignment_id: 'asg-temp-' + Math.random(),
        weekend_id: weekend.weekend_id,
        session_id: selectModalState.sessionId,
        person_id: people.find((p) => p.person_id === pId)?.nama || pId,
        role_id: selectModalState.role!.role_id,
        status: 'ACTIVE'
      }));
      setAssignments((prev) => [...prev, ...newAssignments]);

      await assignIndividualApi({
        weekendId: weekend.weekend_id,
        sessionId: selectModalState.sessionId,
        roleId: selectModalState.role.role_id,
        personIds,
        expectedRevision: weekend.revisi,
        overrideReason
      });
    } catch (error) {
      console.error('Assign API failed:', error);
    }
  };

  const handleAssignCommunity = (
    sessionId: string,
    type: 'PADUAN_SUARA' | 'TATIB',
    value: string,
    isLingkungan: boolean = false
  ) => {
    if (!value || !weekend) return;

    if (!isSpecialMode && type === 'PADUAN_SUARA' && !isLingkungan && !SPECIAL_WILAYAH.includes(value)) {
      const isAlreadyInOtherSession = communityAssignments.some(
        (c) =>
          c.jenis_penugasan === 'PADUAN_SUARA' &&
          c.session_id !== sessionId &&
          c.status !== 'REMOVED' &&
          c.wilayah_id === value
      );

      if (isAlreadyInOtherSession) {
        alert(`⛔ [Aturan BR-013: Keadilan Koor Wilayah]\nWilayah "${value}" sudah ditugaskan sebagai Paduan Suara pada sesi lain di akhir pekan ini.`);
        return;
      }
    }

    if (!isSpecialMode && type === 'TATIB') {
      const isAlreadyInOtherSession = communityAssignments.some(
        (c) =>
          c.jenis_penugasan === 'TATIB' &&
          c.session_id !== sessionId &&
          c.status !== 'REMOVED' &&
          c.lingkungan_id === value
      );

      if (isAlreadyInOtherSession) {
        alert(`⛔ [Aturan BR-041: Keadilan Tatib Lingkungan]\nLingkungan "${value}" sudah ditugaskan sebagai Tatib pada sesi lain di akhir pekan ini.`);
        return;
      }
    }

    const updated = communityAssignments.filter(
      (c) => !(c.session_id === sessionId && c.jenis_penugasan === type)
    );

    updated.push({
      community_assignment_id: 'comm-temp-' + Math.random(),
      weekend_id: weekend.weekend_id,
      session_id: sessionId,
      jenis_penugasan: type,
      wilayah_id: isLingkungan ? undefined : value,
      lingkungan_id: isLingkungan ? value : undefined,
      status: 'ACTIVE'
    });

    setCommunityAssignments(updated);
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    setAssignments((prev) => prev.filter((a) => a.assignment_id !== assignmentId));
  };

  const handleFinalize = async () => {
    if (!weekend) return;
    if (confirm('Apakah Anda yakin ingin memfinalisasi jadwal ini? Jadwal akan berstatus resmi untuk warta umat.')) {
      try {
        await finalizeWeekendApi({
          weekendId: weekend.weekend_id,
          expectedRevision: weekend.revisi
        });
        setWeekend((prev) => (prev ? { ...prev, status: 'FINAL' } : null));
        alert('✓ Jadwal berhasil difinalisasi!');
      } catch (error) {
        console.error('Finalize failed:', error);
      }
    }
  };

  // Dynamic Add Session
  const handleAddNewSession = async () => {
    if (!newSessionName || !weekend) return;
    const newSess: Session = {
      session_id: `ses-${Date.now()}`,
      weekend_id: weekend.weekend_id,
      jenis_sesi: 'KHUSUS',
      nama_khusus: newSessionName,
      tanggal_sesi: `${weekend.tanggal_acuan}T${newSessionTime.includes('08') ? '08:00:00' : '17:00:00'}Z`,
      status: 'DRAFT'
    };

    const updated = [...sessions, newSess];
    setSessions(updated);
    setActiveSessionId(newSess.session_id);
    setIsAddSessionModalOpen(false);
    setNewSessionName('');

    try {
      await setDoc(doc(db, 'weekends', weekend.weekend_id), { sessions: updated }, { merge: true });
    } catch (e) {
      console.warn('Sync new session error:', e);
    }
  };

  // Dynamic Delete Session
  const handleDeleteSession = async (sessId: string) => {
    if (!weekend) return;
    const updated = sessions.filter((s) => s.session_id !== sessId);
    setSessions(updated);
    if (activeSessionId === sessId && updated.length > 0) {
      setActiveSessionId(updated[0].session_id);
    }
    try {
      await setDoc(doc(db, 'weekends', weekend.weekend_id), { sessions: updated }, { merge: true });
    } catch (e) {
      console.warn('Delete session error:', e);
    }
  };

  const activeSession = sessions.find((s) => s.session_id === activeSessionId) || sessions[0];

  const formattedHeaderWeekend = weekend
    ? {
        id: weekend.weekend_id,
        date: weekend.tanggal_acuan,
        title: (weekend as any).nama_kegiatan || `Jadwal Liturgi ${weekend.tanggal_acuan}`,
        status: (weekend.status === 'FINAL' ? 'Final' : 'Draft') as 'Draft' | 'Final',
        revision: weekend.revisi || 1,
      }
    : null;

  const formattedHeaderSessions = sessions.map((s) => ({
    id: s.session_id,
    name:
      s.nama_khusus ||
      (s.jenis_sesi === 'SABTU_SORE'
        ? 'Sabtu Sore'
        : s.jenis_sesi === 'MINGGU_PAGI'
        ? 'Minggu Pagi'
        : 'Minggu Sore'),
    time: s.jenis_sesi === 'MINGGU_PAGI' ? '08.00 WIB' : '17.00 WIB',
  }));

  return (
    <div className="space-y-6 max-w-[94rem] mx-auto">
      {/* Workspace Header */}
      <WorkspaceHeader
        weekend={formattedHeaderWeekend}
        sessions={formattedHeaderSessions}
        userRole={userRole}
        onOpenWeekend={() => setIsCreateModalOpen(true)}
        onFinalize={handleFinalize}
        onPrint={onOpenCalendar || (() => {})}
      />

      {/* Unified 3-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Weekend Selector & Session Stepper (col-span-3) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Quick Weekend Switcher */}
          <div className="p-4 rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/90 shadow-lg space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Pilih Akhir Pekan
              </span>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs font-bold text-emerald-900 hover:underline cursor-pointer"
              >
                + Buat Baru
              </button>
            </div>

            {allWeekends.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allWeekends.map((w) => {
                  const isCur = w.id === selectedWeekendId;
                  const dateObj = new Date(w.tanggal_acuan || w.id.replace('w-', ''));
                  const lit = getLiturgicalInfo(dateObj);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWeekendId(w.id)}
                      className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer spring-press ${
                        isCur
                          ? 'bg-ink text-white font-bold shadow-xs'
                          : 'bg-surface/60 hover:bg-white text-ink border border-surface-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              lit.color === 'HIJAU'
                                ? '#2E7D32'
                                : lit.color === 'UNGU'
                                ? '#6A1B9A'
                                : lit.color === 'MERAH'
                                ? '#C62828'
                                : lit.color === 'MERAH_MUDA'
                                ? '#E91E63'
                                : '#D4AF37'
                          }}
                        />
                        <span className="truncate">{w.nama_kegiatan || w.tanggal_acuan}</span>
                      </div>
                      <span className="text-[10px] opacity-75 shrink-0 ml-1">
                        {w.status === 'FINAL' ? '✓' : '•'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-ink-soft">
                Belum ada jadwal lain.
              </div>
            )}
          </div>

          {/* Dynamic Session Stepper */}
          <div className="p-4 rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/90 shadow-lg">
            <SessionNavTabs
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              assignments={assignments}
              communityAssignments={communityAssignments}
              roles={DEFAULT_ROLES}
              onAddSession={() => setIsAddSessionModalOpen(true)}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        </div>

        {/* Center Column: Active Mass Assignment Canvas (col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
          {activeSession && (
            <SessionCard
              key={activeSession.session_id}
              session={activeSession}
              assignments={assignments.filter((a) => a.session_id === activeSession.session_id)}
              communityAssignments={communityAssignments.filter(
                (c) => c.session_id === activeSession.session_id
              )}
              roles={DEFAULT_ROLES}
              onOpenSelectModal={handleOpenSelectModal}
              onAssignCommunity={handleAssignCommunity}
              onRemoveAssignment={handleRemoveAssignment}
              wilayahList={PARISH_WILAYAH_LIST}
              lingkunganList={PARISH_LINGKUNGAN_LIST}
            />
          )}
        </div>

        {/* Right Column: Live Completion Checklist (col-span-3) */}
        <div className="lg:col-span-3">
          <div className="sticky top-20">
            <StatusPanel
              sessions={formattedHeaderSessions}
              progressMap={progressMap}
              communityAssignments={communityAssignments}
            />
          </div>
        </div>
      </div>

      {/* Select Officer Modal */}
      <SelectOfficerModal
        open={selectModalState.open}
        onClose={() => setSelectModalState((prev) => ({ ...prev, open: false }))}
        sessionName={selectModalState.sessionName}
        role={selectModalState.role}
        availablePeople={people}
        currentAssignments={assignments.filter(
          (a) =>
            a.session_id === selectModalState.sessionId &&
            a.role_id === selectModalState.role?.role_id &&
            a.status !== 'REMOVED'
        )}
        allWeekendAssignments={assignments}
        allWeekendCommunity={communityAssignments}
        onSave={handleAssignOfficers}
        isAdmin={userRole === 'ADMIN'}
      />

      {/* Create Weekend Modal */}
      <CreateWeekendModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          const weekendId = `w-${data.tanggalAcuan}`;
          const formattedSessions: Session[] = data.sessions.map((s, idx) => ({
            session_id: `ses-${idx + 1}`,
            weekend_id: weekendId,
            jenis_sesi: s.jenis_sesi,
            nama_khusus: s.nama_khusus,
            tanggal_sesi: s.tanggal_sesi,
            status: 'DRAFT'
          }));

          const weekendDoc = {
            id: weekendId,
            tanggal_acuan: data.tanggalAcuan,
            is_special: !!data.isSpecialMass,
            nama_kegiatan: data.namaKhusus || `Jadwal Liturgi ${data.tanggalAcuan}`,
            status: 'DRAFT',
            revisi: 1,
            sessions: formattedSessions,
            createdAt: new Date().toISOString()
          };

          try {
            await setDoc(doc(db, 'weekends', weekendId), weekendDoc);
            setSelectedWeekendId(weekendId);
            setWeekend(weekendDoc as any);
            setSessions(formattedSessions);
            setIsCreateModalOpen(false);
          } catch (err) {
            console.error('Create weekend error:', err);
          }
        }}
      />

      {/* Add Custom Mass Session Modal */}
      <Dialog
        open={isAddSessionModalOpen}
        onClose={() => setIsAddSessionModalOpen(false)}
        title="+ Tambah Sesi Misa Baru"
      >
        <div className="space-y-4">
          <Input
            label="Nama Perayaan Misa"
            placeholder="Contoh: Misa Krisma, Misa Lansia, Misa Wilayah..."
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
          />
          <Input
            label="Waktu / Jam Misa"
            placeholder="Contoh: 17.00 WIB atau 10.00 WIB..."
            value={newSessionTime}
            onChange={(e) => setNewSessionTime(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsAddSessionModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleAddNewSession}
              disabled={!newSessionName}
              className="font-bold"
            >
              Simpan Sesi Misa
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}