import { useState, type ChangeEvent } from 'react';
import { Card, Chip, Select, Dialog, Button } from '../ui';
import { LINGKUNGAN_TO_WILAYAH, formatChoirDisplayName } from '../../data/lingkunganWilayahMap';
import type { Session, Assignment, CommunityAssignment, RoleConfig, Person } from '../../types';

interface SessionCardProps {
  session: Session;
  assignments: Assignment[];
  communityAssignments: CommunityAssignment[];
  roles: RoleConfig[];
  wilayahList: { wilayah_id: string; nama: string }[];
  lingkunganList: { lingkungan_id: string; nama: string; wilayah_id: string }[];
  people?: (Person & { namaLingkungan?: string; namaWilayah?: string })[];
  isEditable?: boolean;
  conflictedPersonIds?: Set<string>;
  conflictedAssignmentIds?: Set<string>;
  conflictDetailsMap?: Map<string, string>;
  onOpenSelectModal: (sessionId: string, sessionName: string, role: RoleConfig) => void;
  onAssignCommunity: (sessionId: string, type: 'PADUAN_SUARA' | 'TATIB', value: string, isLingkungan: boolean) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

const ROLE_THEMES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'ROL-ORGANIS': { bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-900', border: 'border-amber-500/20', icon: '🎹' },
  'ROL-PEMAZMUR': { bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-900', border: 'border-amber-500/20', icon: '🎤' },
  'ROL-LEKTOR': { bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-900', border: 'border-blue-500/20', icon: '📖' },
  'ROL-MISDINAR': { bg: 'from-rose-500/10 to-rose-500/5', text: 'text-rose-900', border: 'border-rose-500/20', icon: '🕯️' },
  'ROL-PRODIAKON': { bg: 'from-purple-500/10 to-purple-500/5', text: 'text-purple-900', border: 'border-purple-500/20', icon: '🍷' },
};

const DEFAULT_SPECIAL_CHOIR_GROUPS = [
  'BECANBO',
  'GRASIA CHOIR',
  'KOOR OMK',
  'KOOR WKRI',
  'KOOR LANSIA (SIMEON HANNA)',
  'KOOR BINA IMAN / ANAK',
  'KOOR REMAJA / MISDINAR',
  'KOOR MAHASISWA',
  'LUAR PAROKI / TAMU UNDANGAN'
];

const DEFAULT_SPECIAL_TATIB_GROUPS = [
  'BECANBO',
  'OMK (ORANG MUDA KATOLIK)',
  'LEGIO MARIAE',
  'THS-THM (TUNGGAL HATI SEMINARI)',
  'PRAMUKA KATOLIK',
  'REMAJA & MISDINAR',
  'PANITIA HARI RAYA',
  'LUAR PAROKI / TAMU'
];

export default function SessionCard({
  session,
  assignments,
  communityAssignments,
  roles,
  wilayahList,
  lingkunganList,
  people,
  isEditable = true,
  conflictedPersonIds,
  conflictedAssignmentIds,
  conflictDetailsMap,
  onOpenSelectModal,
  onAssignCommunity,
  onRemoveAssignment,
}: SessionCardProps) {
  const [choirType, setChoirType] = useState<'LINGKUNGAN' | 'WILAYAH' | 'KHUSUS'>('LINGKUNGAN');
  const [tatibType, setTatibType] = useState<'LINGKUNGAN' | 'KHUSUS'>('LINGKUNGAN');
  
  const [customChoirInput, setCustomChoirInput] = useState('');
  const [customTatibInput, setCustomTatibInput] = useState('');

  const [pendingChoirPrompt, setPendingChoirPrompt] = useState<{
    value: string;
    isLingkungan: boolean;
    targetWilayah: string;
    existingWilayahs: string[];
  } | null>(null);

  const displayName = session.nama_khusus || (
    session.jenis_sesi === 'SABTU_SORE'
      ? 'Sabtu Sore - 17.00 WIB'
      : session.jenis_sesi === 'MINGGU_PAGI'
      ? 'Minggu Pagi - 07.00 WIB'
      : session.jenis_sesi === 'MINGGU_SORE'
      ? 'Minggu Sore - 17.00 WIB'
      : 'Misa'
  );

  const isSpecialMass = session.jenis_sesi === 'KHUSUS';

  const sessionAssignments = assignments.filter((a) => a.session_id === session.session_id);
  const sessionChoirList = communityAssignments.filter(
    (c) => c.session_id === session.session_id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED'
  );
  const sessionTatibList = communityAssignments.filter(
    (c) => c.session_id === session.session_id && c.jenis_penugasan === 'TATIB' && c.status !== 'REMOVED'
  );

  const getAssignments = (roleId: string) =>
    sessionAssignments.filter((a) => a.role_id === roleId && a.status !== 'REMOVED');

  const existingChoirWilayahs = Array.from(
    new Set(
      sessionChoirList.map((c) => {
        if (c.wilayah_id) return c.wilayah_id;
        if (c.lingkungan_id) {
          const w = LINGKUNGAN_TO_WILAYAH[c.lingkungan_id.toUpperCase()];
          return w || c.lingkungan_id;
        }
        return 'LAINNYA';
      })
    )
  );

  const handleSelectChoirWithWarning = (value: string, isLingkungan: boolean) => {
    if (!value) return;

    if (isLingkungan && sessionChoirList.length > 0) {
      const targetWilayah = LINGKUNGAN_TO_WILAYAH[value.toUpperCase()] || value;
      const isCrossWilayah = existingChoirWilayahs.length > 0 && !existingChoirWilayahs.includes(targetWilayah);

      if (isCrossWilayah) {
        setPendingChoirPrompt({
          value,
          isLingkungan: true,
          targetWilayah,
          existingWilayahs: existingChoirWilayahs
        });
        return;
      }
    }

    onAssignCommunity(session.session_id, 'PADUAN_SUARA', value, isLingkungan);
  };

  const confirmPendingChoir = () => {
    if (!pendingChoirPrompt) return;
    onAssignCommunity(session.session_id, 'PADUAN_SUARA', pendingChoirPrompt.value, pendingChoirPrompt.isLingkungan);
    setPendingChoirPrompt(null);
  };

  const handleAddCustomChoir = () => {
    const val = customChoirInput.trim().toUpperCase();
    if (!val) return;
    onAssignCommunity(session.session_id, 'PADUAN_SUARA', `KHUSUS: ${val}`, false);
    setCustomChoirInput('');
  };

  const handleAddCustomTatib = () => {
    const val = customTatibInput.trim().toUpperCase();
    if (!val) return;
    onAssignCommunity(session.session_id, 'TATIB', `KHUSUS: ${val}`, false);
    setCustomTatibInput('');
  };

  const formatTitleCase = (str: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const rawChoirLingkunganOptions = lingkunganList.map((l) => {
    const rawWilName = LINGKUNGAN_TO_WILAYAH[l.nama.toUpperCase()] || (l.wilayah_id !== 'W-DEFAULT' ? l.wilayah_id : '') || '';
    const lingName = formatTitleCase(l.nama);
    const wilLabel = rawWilName ? ` — Wil. ${formatTitleCase(rawWilName)}` : '';
    return {
      value: l.nama,
      label: `${lingName}${wilLabel}`
    };
  });

  const filteredChoirLingkunganOptions = rawChoirLingkunganOptions.map((opt) => {
    const isAlreadyInThisSession = sessionChoirList.some((c) => c.lingkungan_id === opt.value);
    const isConflict = !isSpecialMass && communityAssignments.some(
      (c) =>
        c.jenis_penugasan === 'PADUAN_SUARA' &&
        c.session_id !== session.session_id &&
        c.status !== 'REMOVED' &&
        c.lingkungan_id === opt.value
    );

    return {
      value: opt.value,
      label: isAlreadyInThisSession
        ? `✓ [Ditugaskan di Sesi Ini] ${opt.label}`
        : isConflict
        ? `⛔ [Bertugas di Sesi Lain] ${opt.label}`
        : opt.label,
      disabled: isConflict || isAlreadyInThisSession
    };
  });

  const rawChoirWilayahOptions = wilayahList.map((w) => ({
    value: w.nama,
    label: `Wilayah ${formatTitleCase(w.nama)}`
  }));

  const filteredChoirWilayahOptions = rawChoirWilayahOptions.map((opt) => {
    const isAlreadyInThisSession = sessionChoirList.some((c) => c.wilayah_id === opt.value);
    const isConflict = !isSpecialMass && communityAssignments.some(
      (c) =>
        c.jenis_penugasan === 'PADUAN_SUARA' &&
        c.session_id !== session.session_id &&
        c.status !== 'REMOVED' &&
        c.wilayah_id === opt.value
    );

    return {
      value: opt.value,
      label: isAlreadyInThisSession
        ? `✓ [Ditugaskan di Sesi Ini] ${opt.label}`
        : isConflict
        ? `⛔ [Bertugas di Sesi Lain] ${opt.label}`
        : opt.label,
      disabled: isConflict || isAlreadyInThisSession
    };
  });

  const specialChoirOptions = DEFAULT_SPECIAL_CHOIR_GROUPS.map((g) => ({
    value: `KHUSUS: ${g}`,
    label: `⭐ ${g}`
  }));

  const rawTatibOptions = lingkunganList.map((l) => {
    const rawWilName = LINGKUNGAN_TO_WILAYAH[l.nama.toUpperCase()] || (l.wilayah_id !== 'W-DEFAULT' ? l.wilayah_id : '') || '';
    const lingName = formatTitleCase(l.nama);
    const wilLabel = rawWilName ? ` — Wil. ${formatTitleCase(rawWilName)}` : '';
    return {
      value: l.nama,
      label: `${lingName}${wilLabel}`
    };
  });

  const filteredTatibOptions = rawTatibOptions.map((opt) => {
    const isAlreadyInThisSession = sessionTatibList.some((c) => c.lingkungan_id === opt.value);
    const isConflict = !isSpecialMass && communityAssignments.some(
      (c) =>
        c.jenis_penugasan === 'TATIB' &&
        c.session_id !== session.session_id &&
        c.status !== 'REMOVED' &&
        c.lingkungan_id === opt.value
    );

    return {
      value: opt.value,
      label: isAlreadyInThisSession
        ? `✓ [Ditugaskan di Sesi Ini] ${opt.label}`
        : isConflict
        ? `⛔ [Bertugas di Sesi Lain] ${opt.label}`
        : opt.label,
      disabled: isConflict || isAlreadyInThisSession
    };
  });

  const specialTatibOptions = DEFAULT_SPECIAL_TATIB_GROUPS.map((g) => ({
    value: `KHUSUS: ${g}`,
    label: `⭐ ${g}`
  }));

  // Spacious Full-Width Horizontal Role Row
  const renderHorizontalRoleRow = (roleId: string) => {
    const role = roles.find((r) => r.role_id === roleId) || {
      role_id: roleId,
      nama_peran: roleId,
      jumlah_dibutuhkan: 1,
      jumlah_maksimal: 1,
      aktif: true,
      urutan: 0
    };

    const currentList = getAssignments(roleId);
    const count = currentList.length;
    const isFull = count >= role.jumlah_maksimal;
    const theme = ROLE_THEMES[roleId] || { bg: 'from-gray-500/10 to-gray-500/5', text: 'text-ink', border: 'border-gray-300', icon: '👤' };
    const emptySlots = Math.max(0, role.jumlah_dibutuhkan - count);

    return (
      <div
        key={roleId}
        className={`p-4 md:p-5 rounded-2xl bg-gradient-to-r ${theme.bg} backdrop-blur-md border ${theme.border} shadow-[0_4px_20px_0_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:shadow-md transition-all space-y-3`}
      >
        {/* Header Row */}
        <div className="flex justify-between items-center">
          <span className={`font-bold ${theme.text} text-sm flex items-center gap-2`}>
            <span className="text-base">{theme.icon}</span>
            <span>{role.nama_peran}</span>
          </span>
          <span
            className={`text-xs px-3 py-0.5 rounded-full font-bold shadow-2xs ${
              count >= role.jumlah_dibutuhkan
                ? 'bg-emerald-500/20 text-emerald-950 border border-emerald-500/30'
                : 'bg-white/80 text-ink-soft border border-white'
            }`}
          >
            {count}/{role.jumlah_dibutuhkan} Terisi
          </span>
        </div>

        {/* Assigned Chips & Ghost Slots */}
        <div className="flex flex-wrap items-center gap-2">
          {currentList.map((a) => {
            const personObj = (people || []).find((p) => p.person_id === a.person_id || p.nama === a.person_id);
            const personName = personObj?.nama || a.person_id;
            const initials = String(personName)
              .split(' ')
              .slice(0, 2)
              .map((n: string) => n.charAt(0))
              .join('')
              .toUpperCase();

            const isConflicted = Boolean(
              (conflictedPersonIds && conflictedPersonIds.has(a.person_id)) ||
              (conflictedAssignmentIds && conflictedAssignmentIds.has(a.assignment_id))
            );
            const conflictNote = conflictDetailsMap?.get(a.person_id) || conflictDetailsMap?.get(a.assignment_id);

            return (
              <div
                key={a.assignment_id}
                title={isConflicted ? `⚠️ Konflik: ${conflictNote || 'Petugas ini melanggar aturan liturgi'}` : undefined}
                className={`flex items-center gap-2 backdrop-blur-sm px-3 py-1.5 rounded-xl transition-all shadow-2xs group ${
                  isConflicted
                    ? 'bg-rose-50 border-2 border-rose-400 text-rose-950 ring-2 ring-rose-400/30'
                    : 'bg-white/95 border border-white hover:bg-white text-ink'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isConflicted ? 'bg-rose-600 text-white' : 'bg-ink text-accent'
                  }`}
                >
                  {isConflicted ? '!' : initials}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold whitespace-nowrap">
                    {personName}
                  </span>
                  {isConflicted && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded-md">
                      ⚠️ Bentrok
                    </span>
                  )}
                </div>

                {isEditable && (
                  <button
                    onClick={() => onRemoveAssignment(a.assignment_id)}
                    className={`text-xs font-bold p-0.5 ml-1 rounded-md transition-colors cursor-pointer ${
                      isConflicted
                        ? 'text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-200/60'
                        : 'text-ink-soft hover:text-danger hover:bg-danger/10'
                    }`}
                    title={isConflicted ? 'Lepas Petugas Konflik Ini' : 'Hapus Penugasan'}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* If read-only and empty, show clean badge */}
          {!isEditable && count === 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-black/5 text-ink-soft text-xs italic">
              Belum ada petugas ditugaskan
            </span>
          )}

          {/* Empty Ghost Slots */}
          {isEditable && Array.from({ length: emptySlots }).map((_, i) => (
            <button
              key={`empty-${i}`}
              onClick={() => onOpenSelectModal(session.session_id, displayName, role)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-ink/20 text-ink-soft hover:border-ink/60 hover:text-ink hover:bg-white/60 transition-all text-xs font-medium cursor-pointer shadow-2xs group"
            >
              <span className="w-5 h-5 rounded-full border border-dashed border-ink/30 flex items-center justify-center text-[11px] font-bold group-hover:bg-ink group-hover:text-white transition-colors">
                +
              </span>
              <span>Pilih {role.nama_peran}</span>
            </button>
          ))}

          {/* Extra Add Button if full but allowed */}
          {isEditable && isFull && !isSpecialMass && count < role.jumlah_maksimal && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenSelectModal(session.session_id, displayName, role)}
              className="h-8 text-xs font-bold rounded-xl"
            >
              + Tambah Petugas Cadangan
            </Button>
          )}

          {isEditable && isSpecialMass && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenSelectModal(session.session_id, displayName, role)}
              className="h-8 text-xs font-bold rounded-xl bg-white shadow-2xs"
            >
              + Tambah {role.nama_peran}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="backdrop-blur-3xl bg-white/75 rounded-3xl border border-white/90 shadow-xl overflow-hidden p-0">
      {/* Session Card Banner Header */}
      <div className="bg-gradient-to-r from-ink to-ink-soft p-5 text-white flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#D8EB73] block mb-0.5">
            Sesi Misa Terpilih
          </span>
          <h2 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
            {displayName}
          </h2>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-white/80 bg-white/10 px-3 py-1 rounded-full border border-white/10">
            {sessionAssignments.length} Petugas Terdaftar
          </span>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {/* BAGIAN 1: MUSIK & LITURGI SABDA AWAL */}
        <div className="p-5 rounded-2xl bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_24px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-muted pb-2.5">
            <span className="text-xl">🎶</span>
            <h3 className="font-display font-bold text-ink text-base">Musik & Nyanyian Liturgi</h3>
          </div>

          {/* Paduan Suara (Choir) Selector */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-ink-soft">
                Paduan Suara / Koor ({sessionChoirList.length} Grup Terpilih)
              </label>

              {/* 3-Way Selector Toggle: Lingkungan vs Wilayah vs Kelompok Khusus */}
              {isEditable && (
                <div className="flex text-xs font-bold bg-surface p-1 rounded-lg border border-surface-muted">
                  <button
                    type="button"
                    onClick={() => setChoirType('LINGKUNGAN')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      choirType === 'LINGKUNGAN' ? 'bg-accent text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    Lingkungan
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoirType('WILAYAH')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      choirType === 'WILAYAH' ? 'bg-accent text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    Wilayah
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoirType('KHUSUS')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      choirType === 'KHUSUS' ? 'bg-accent text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    ⭐ Grup Khusus (Becanbo, dll)
                  </button>
                </div>
              )}
            </div>

            {/* Assigned Choir Chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2.5 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-2xs">
              {sessionChoirList.length === 0 ? (
                <span className="text-xs text-ink-soft italic">Belum ada Koor yang ditugaskan di sesi ini.</span>
              ) : (
                sessionChoirList.map((c) => {
                  const chipLabel = formatChoirDisplayName(c);

                  return (
                    <Chip
                      key={c.community_assignment_id}
                      label={chipLabel}
                      onRemove={isEditable ? () => onRemoveAssignment(c.community_assignment_id) : undefined}
                    />
                  );
                })
              )}
            </div>

            {/* Selector Component Based on Selected Tab (Editor Only) */}
            {isEditable && choirType === 'LINGKUNGAN' && (
              <Select
                options={filteredChoirLingkunganOptions}
                placeholder="-- Pilih Lingkungan Koor --"
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const val = e.target.value;
                  if (!val) return;
                  handleSelectChoirWithWarning(val, true);
                  e.target.value = '';
                }}
              />
            )}

            {isEditable && choirType === 'WILAYAH' && (
              <Select
                options={filteredChoirWilayahOptions}
                placeholder="-- Pilih Wilayah Koor --"
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const val = e.target.value;
                  if (!val) return;
                  handleSelectChoirWithWarning(val, false);
                  e.target.value = '';
                }}
              />
            )}

            {isEditable && choirType === 'KHUSUS' && (
              <div className="space-y-2 pt-1">
                <Select
                  options={specialChoirOptions}
                  placeholder="-- Pilih Grup Kategorial (Becanbo, Grasia, OMK, WKRI, dll) --"
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const val = e.target.value;
                    if (!val) return;
                    onAssignCommunity(session.session_id, 'PADUAN_SUARA', val, false);
                    e.target.value = '';
                  }}
                />
                {/* Instant Free Text Custom Group Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Atau ketik nama grup koor khusus lainnya..."
                    value={customChoirInput}
                    onChange={(e) => setCustomChoirInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomChoir()}
                    className="flex-1 h-9 rounded-xl border border-surface-muted bg-white px-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddCustomChoir}
                    disabled={!customChoirInput.trim()}
                    className="h-9 px-3 text-xs font-bold"
                  >
                    + Tugaskan
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* If Choir is assigned, show Organis & Pemazmur inside Bagian 1 */}
          {sessionChoirList.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-surface-muted/60">
              {renderHorizontalRoleRow('ROL-ORGANIS')}
              {renderHorizontalRoleRow('ROL-PEMAZMUR')}
            </div>
          )}
        </div>

        {/* Conditional rendering: if NO choir is assigned, show mandatory lock banner and hide other cards */}
        {sessionChoirList.length === 0 ? (
          <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 text-amber-950 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-950 flex items-center justify-center text-2xl mx-auto shadow-2xs">
              🔒
            </div>
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base md:text-lg text-amber-950">
                Wajib Menugaskan Paduan Suara (Koor) Terlebih Dahulu
              </h4>
              <p className="text-xs text-amber-900/80 max-w-md mx-auto leading-relaxed">
                Sesuai aturan liturgi paroki, penugasan <strong>Paduan Suara (Lingkungan / Wilayah / Grup Khusus)</strong> harus dipilih terlebih dahulu untuk membuka slot petugas lainnya (Organis, Pemazmur, Lektor, Misdinar, Prodiakon, & Tatib).
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* BAGIAN 2: PELAYAN SABDA & ALTAR (Spacious Full-Width Rows) */}
            <div className="p-5 rounded-2xl bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_24px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-muted pb-2.5">
                <span className="text-xl">📖</span>
                <h3 className="font-display font-bold text-ink text-base">Pelayan Sabda & Altar</h3>
              </div>

              <div className="space-y-3">
                {renderHorizontalRoleRow('ROL-LEKTOR')}
                {renderHorizontalRoleRow('ROL-MISDINAR')}
                {renderHorizontalRoleRow('ROL-PRODIAKON')}
              </div>
            </div>

            {/* BAGIAN 3: TATA TERTIB MISA (Per Sesi) */}
            <div className="p-5 rounded-2xl bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_24px_0_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.85)] space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-muted pb-2.5">
                <span className="text-xl">🕯️</span>
                <h3 className="font-display font-bold text-ink text-base">Tata Tertib Misa (Tatib)</h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-ink-soft">
                    Petugas Tata Tertib Sesi Ini ({sessionTatibList.length} Lingkungan/Grup Ditugaskan)
                  </label>

                  {/* 2-Way Selector Toggle: Lingkungan vs Kelompok Khusus */}
                  {isEditable && (
                    <div className="flex text-xs font-bold bg-surface p-1 rounded-lg border border-surface-muted">
                      <button
                        type="button"
                        onClick={() => setTatibType('LINGKUNGAN')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          tatibType === 'LINGKUNGAN' ? 'bg-accent text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        Lingkungan
                      </button>
                      <button
                        type="button"
                        onClick={() => setTatibType('KHUSUS')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          tatibType === 'KHUSUS' ? 'bg-accent text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        ⭐ Grup Khusus (Becanbo, dll)
                      </button>
                    </div>
                  )}
                </div>

                {/* Assigned Tatib Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2.5 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-2xs">
                  {sessionTatibList.length === 0 ? (
                    <span className="text-xs text-ink-soft italic">Belum ada Tatib yang ditugaskan di sesi ini.</span>
                  ) : (
                    sessionTatibList.map((c) => {
                      const chipLabel = c.lingkungan_id
                        ? `Lingkungan ${c.lingkungan_id}`
                        : c.wilayah_id?.startsWith('KHUSUS:')
                        ? `⭐ ${c.wilayah_id.replace('KHUSUS:', '').trim()}`
                        : `Grup ${c.wilayah_id}`;

                      return (
                        <Chip
                          key={c.community_assignment_id}
                          label={chipLabel}
                          onRemove={isEditable ? () => onRemoveAssignment(c.community_assignment_id) : undefined}
                        />
                      );
                    })
                  )}
                </div>

                {isEditable && tatibType === 'LINGKUNGAN' && (
                  <Select
                    options={filteredTatibOptions}
                    placeholder="-- Pilih Lingkungan Tatib --"
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const val = e.target.value;
                      if (!val) return;
                      onAssignCommunity(session.session_id, 'TATIB', val, true);
                      e.target.value = '';
                    }}
                  />
                )}

                {isEditable && tatibType === 'KHUSUS' && (
                  <div className="space-y-2 pt-1">
                    <Select
                      options={specialTatibOptions}
                      placeholder="-- Pilih Grup Tatib Khusus (Becanbo, OMK, THS-THM, dll) --"
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        const val = e.target.value;
                        if (!val) return;
                        onAssignCommunity(session.session_id, 'TATIB', val, false);
                        e.target.value = '';
                      }}
                    />
                    {/* Instant Free Text Custom Tatib Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Atau ketik nama grup tatib khusus lainnya..."
                        value={customTatibInput}
                        onChange={(e) => setCustomTatibInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTatib()}
                        className="flex-1 h-9 rounded-xl border border-surface-muted bg-white px-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddCustomTatib}
                        disabled={!customTatibInput.trim()}
                        className="h-9 px-3 text-xs font-bold"
                      >
                        + Tugaskan
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-ink-soft italic bg-white/50 backdrop-blur-md p-3 rounded-xl border border-white/80">
                💡 <strong>Hias Altar:</strong> Ditugaskan di tingkat akhir pekan penuh untuk memperindah seluruh rangkaian misa.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal Popup for Cross-Wilayah Choir */}
      {pendingChoirPrompt && (
        <Dialog
          open={!!pendingChoirPrompt}
          onClose={() => setPendingChoirPrompt(null)}
          title="⚠️ Peringatan Koor Lintas Wilayah"
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs text-amber-950 space-y-2">
              <p className="leading-relaxed">
                Lingkungan <strong>{pendingChoirPrompt.value}</strong> berasal dari <strong>Wilayah {pendingChoirPrompt.targetWilayah}</strong>, sedangkan pada sesi misa ini sudah ditugaskan koor dari <strong>Wilayah {pendingChoirPrompt.existingWilayahs.join(', ')}</strong>.
              </p>
              <p className="font-medium">
                Apakah Anda yakin ingin menugaskan koor gabungan lintas wilayah ini?
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
              <Button
                variant="secondary"
                onClick={() => setPendingChoirPrompt(null)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={confirmPendingChoir}
                className="bg-ink text-white hover:bg-ink-soft"
              >
                Ya, Tugaskan Koor Gabungan
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
