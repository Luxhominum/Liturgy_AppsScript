import type { SessionProgress, CommunityAssignment } from '../../types';

export interface StatusPanelConflict {
  ruleId: string;
  ruleName?: string;
  level?: 'WAJIB' | 'PERINGATAN' | 'OTOMATIS';
  personId?: string;
  personName?: string;
  assignmentId?: string;
  sessionId?: string;
  sessionName?: string;
  details: string;
}

interface StatusPanelProps {
  sessions: {
    id: string;
    name: string;
    time: string;
  }[];
  progressMap: Record<string, SessionProgress[]>;
  communityAssignments?: CommunityAssignment[];
  conflicts?: StatusPanelConflict[];
  onRemoveConflicted?: (personIds: string[], assignmentIds: string[]) => void;
}

export default function StatusPanel({
  sessions,
  progressMap,
  communityAssignments = [],
  conflicts = [],
  onRemoveConflicted,
}: StatusPanelProps) {
  let totalSlotsNeeded = 0;
  let totalSlotsFilled = 0;

  // 1. Weekend Level Hias Altar
  totalSlotsNeeded += 1;
  const hiasAltarAssignment = communityAssignments.find(
    (c) => c.jenis_penugasan === 'HIAS_ALTAR' && c.status !== 'REMOVED'
  );
  const hasHiasAltar = Boolean(hiasAltarAssignment);
  if (hasHiasAltar) totalSlotsFilled += 1;

  // 2. Per-Session Roles + Choir + Tatib
  sessions.forEach((s) => {
    const pList = progressMap[s.id] || [];
    pList.forEach((p) => {
      totalSlotsNeeded += p.dibutuhkan;
      totalSlotsFilled += Math.min(p.terisi, p.dibutuhkan);
    });

    // Choir per session
    totalSlotsNeeded += 1;
    const hasChoir = communityAssignments.some(
      (c) => c.session_id === s.id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED'
    );
    if (hasChoir) totalSlotsFilled += 1;

    // Tatib per session
    totalSlotsNeeded += 1;
    const hasTatib = communityAssignments.some(
      (c) => c.session_id === s.id && c.jenis_penugasan === 'TATIB' && c.status !== 'REMOVED'
    );
    if (hasTatib) totalSlotsFilled += 1;
  });

  const overallPercent = totalSlotsNeeded > 0 ? Math.round((totalSlotsFilled / totalSlotsNeeded) * 100) : 0;
  const hasConflicts = conflicts && conflicts.length > 0;

  return (
    <div className="sticky top-20 bg-[#022C12] text-white border border-[#D4AF37]/30 shadow-2xl p-5 md:p-6 rounded-3xl relative overflow-hidden space-y-5">
      {/* Top Specular Gold Edge */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

      {/* Header */}
      <div className="border-b border-white/15 pb-4 space-y-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-display font-bold text-[#E2F56C] text-base tracking-wide flex items-center gap-2">
            <span>📊</span>
            <span>Status Kelengkapan Peran</span>
          </h3>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xs ${
              hasConflicts
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-[#E2F56C] text-[#022C12]'
            }`}
          >
            {hasConflicts ? `⚠️ ${conflicts.length} Konflik` : `${overallPercent}%`}
          </span>
        </div>
        <p className="text-[11px] text-white/80 font-medium">
          Monitoring pemenuhan petugas misa real-time.
        </p>

        {/* Global Progress Bar */}
        <div className="w-full bg-black/30 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 shadow-sm ${
              hasConflicts
                ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                : 'bg-gradient-to-r from-[#D4AF37] to-[#E2F56C]'
            }`}
            style={{ width: `${overallPercent}%` }}
          />
        </div>

        {/* Dynamic Real-Time Conflict Alert Banner inside Header */}
        {hasConflicts && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 shadow-lg space-y-2">
            <div className="flex justify-between items-center pb-1.5 border-b border-rose-500/30">
              <span className="text-xs font-bold font-display text-rose-300 tracking-wide flex items-center gap-1.5">
                <span className="animate-pulse">🚨</span>
                <span>{conflicts.length} Konflik Liturgi Aktif</span>
              </span>
              <span className="text-[9px] font-mono font-bold text-rose-200 bg-rose-900/80 px-2 py-0.5 rounded-md border border-rose-500/40">
                Wajib Dilepas
              </span>
            </div>

            {/* List of conflicts */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className="p-2 rounded-xl bg-black/40 border border-rose-500/20 text-xs flex justify-between items-start gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-200 text-[11px] flex items-center gap-1 flex-wrap">
                      <span>⚠️</span>
                      <span>{c.personName || c.ruleName || c.ruleId}</span>
                      {c.sessionName && (
                        <span className="text-rose-300/80 font-normal text-[10px]">
                          ({c.sessionName})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/80 leading-snug">{c.details}</p>
                  </div>
                  {onRemoveConflicted && (c.personId || c.assignmentId) && (
                    <button
                      onClick={() =>
                        onRemoveConflicted(
                          c.personId ? [c.personId] : [],
                          c.assignmentId ? [c.assignmentId] : []
                        )
                      }
                      className="text-[10px] font-bold text-rose-300 hover:text-white bg-rose-900/60 hover:bg-rose-800 px-1.5 py-0.5 rounded border border-rose-500/40 shrink-0 transition-colors cursor-pointer"
                      title="Lepas petugas ini dari jadwal"
                    >
                      ✕ Lepas
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick 1-Click Clean All Conflicts Button */}
            {onRemoveConflicted && (
              <button
                onClick={() => {
                  const personIds = Array.from(
                    new Set(conflicts.map((c) => c.personId).filter(Boolean))
                  ) as string[];
                  const assignmentIds = Array.from(
                    new Set(conflicts.map((c) => c.assignmentId).filter(Boolean))
                  ) as string[];
                  onRemoveConflicted(personIds, assignmentIds);
                }}
                className="w-full py-1.5 px-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🧹</span>
                <span>Lepas Semua Petugas Konflik ({conflicts.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {/* 1. Weekend Level Hias Altar Card */}
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 space-y-2 shadow-inner">
          <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
            <span className="text-xs font-bold font-display text-emerald-300 tracking-wide flex items-center gap-1.5">
              <span>🌿</span>
              <span>Hias Altar (Akhir Pekan)</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-200 bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-500/20">
              1 Wilayah / Pekan
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    hasHiasAltar
                      ? 'bg-[#E2F56C] text-[#022C12] shadow-xs'
                      : 'border border-white/30 text-transparent bg-white/5'
                  }`}
                >
                  ✓
                </span>
                <span className={hasHiasAltar ? 'text-white font-bold' : 'text-white/75'}>
                  {hasHiasAltar
                    ? `Wilayah ${hiasAltarAssignment?.wilayah_id}`
                    : 'Belum Ditugaskan'}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-white/90">
                {hasHiasAltar ? '1/1' : '0/1'}
              </span>
            </div>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-[#E2F56C] h-full rounded-full transition-all"
                style={{ width: hasHiasAltar ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* 2. Sessions Breakdown */}
        {sessions.length === 0 ? (
          <div className="py-8 px-2 text-center text-xs text-white/70 space-y-2 border border-white/15 rounded-2xl bg-black/20">
            <span className="text-3xl block">⛪</span>
            <p className="font-semibold text-white text-sm font-display">Belum Ada Sesi Misa</p>
            <p className="text-[11px] text-white/70 leading-relaxed max-w-[220px] mx-auto">
              Tambahkan sesi misa di ruang kerja untuk mulai menugaskan peran petugas.
            </p>
          </div>
        ) : (
          sessions.map((sess) => {
            const roles = progressMap[sess.id] || [];
            const hasChoir = communityAssignments.some(
              (c) => c.session_id === sess.id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED'
            );
            const hasTatib = communityAssignments.some(
              (c) => c.session_id === sess.id && c.jenis_penugasan === 'TATIB' && c.status !== 'REMOVED'
            );

            return (
              <div
                key={sess.id}
                className="p-3.5 rounded-2xl bg-black/25 border border-white/15 space-y-2.5 shadow-inner"
              >
                <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
                  <span className="text-xs font-bold font-display text-[#E2F56C] tracking-wide">
                    {sess.name}
                  </span>
                  <span className="text-[10px] font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded-md">
                    {sess.time}
                  </span>
                </div>

                {/* Choir Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          hasChoir
                            ? 'bg-[#E2F56C] text-[#022C12] shadow-xs'
                            : 'border border-white/30 text-transparent bg-white/5'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={hasChoir ? 'text-white font-bold' : 'text-white/75'}>
                        Paduan Suara / Choir
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white/90">
                      {hasChoir ? '1/1' : '0/1'}
                    </span>
                  </div>
                  <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#D4AF37] to-[#E2F56C] h-full rounded-full transition-all"
                      style={{ width: hasChoir ? '100%' : '0%' }}
                    />
                  </div>
                </div>

                {/* Individual Roles */}
                {roles.map((r) => {
                  const isFull = r.terisi >= r.dibutuhkan;
                  const pct = r.dibutuhkan > 0 ? Math.min(100, Math.round((r.terisi / r.dibutuhkan) * 100)) : 0;

                  return (
                    <div key={r.roleId} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              isFull
                                ? 'bg-[#E2F56C] text-[#022C12] shadow-xs'
                                : 'border border-white/30 text-transparent bg-white/5'
                            }`}
                          >
                            ✓
                          </span>
                          <span className={isFull ? 'text-white font-bold' : 'text-white/75'}>
                            {r.namaPeran}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-white/90">
                          {r.terisi}/{r.dibutuhkan}
                        </span>
                      </div>
                      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#D4AF37] to-[#E2F56C] h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Tatib Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          hasTatib
                            ? 'bg-[#E2F56C] text-[#022C12] shadow-xs'
                            : 'border border-white/30 text-transparent bg-white/5'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={hasTatib ? 'text-white font-bold' : 'text-white/75'}>
                        Tata Tertib (Tatib)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white/90">
                      {hasTatib ? '1/1' : '0/1'}
                    </span>
                  </div>
                  <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#D4AF37] to-[#E2F56C] h-full rounded-full transition-all"
                      style={{ width: hasTatib ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
