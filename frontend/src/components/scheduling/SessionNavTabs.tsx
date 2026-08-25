import { motion } from 'motion/react';
import type { Session, Assignment, CommunityAssignment, RoleConfig } from '../../types';

interface SessionNavTabsProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  assignments: Assignment[];
  communityAssignments: CommunityAssignment[];
  roles: RoleConfig[];
  isEditable?: boolean;
  onAddSession?: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export default function SessionNavTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  assignments,
  communityAssignments,
  roles,
  isEditable = true,
  onAddSession,
  onDeleteSession,
}: SessionNavTabsProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          Rangkaian Misa
        </span>
        <span className="text-[11px] text-ink-soft font-mono">
          {sessions.length} Sesi
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {sessions.map((session, idx) => {
          const isActive = session.session_id === activeSessionId;

          // Count individual filled roles
          const filledCount = roles.filter((r) => {
            const count = assignments.filter(
              (a) => a.session_id === session.session_id && a.role_id === r.role_id && a.status !== 'REMOVED'
            ).length;
            return count >= r.jumlah_dibutuhkan;
          }).length;

          // Check if choir is assigned
          const hasChoir = communityAssignments.some(
            (c) => c.session_id === session.session_id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED'
          );

          const totalNeeded = roles.length;
          const isAllComplete = filledCount >= totalNeeded && hasChoir;

          const sessionName =
            session.nama_khusus ||
            (session.jenis_sesi === 'SABTU_SORE'
              ? 'Sabtu Sore'
              : session.jenis_sesi === 'MINGGU_PAGI'
              ? 'Minggu Pagi'
              : session.jenis_sesi === 'MINGGU_SORE'
              ? 'Minggu Sore'
              : 'Sesi Khusus');

          const sessionTime =
            session.jenis_sesi === 'MINGGU_PAGI'
              ? '07.00 WIB'
              : session.jenis_sesi === 'SABTU_SORE' || session.jenis_sesi === 'MINGGU_SORE'
              ? '17.00 WIB'
              : session.tanggal_sesi
              ? `${new Date(session.tanggal_sesi).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')} WIB`
              : 'Waktu Khusus';

          return (
            <motion.button
              key={session.session_id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectSession(session.session_id)}
              className={`w-full p-4 rounded-2xl text-left cursor-pointer text-sm relative overflow-hidden backdrop-blur-xl group select-none transition-colors ${
                isActive
                  ? 'text-ink font-bold shadow-lg shadow-accent/25 border border-white/90'
                  : 'bg-white/65 hover:bg-white/90 text-ink border border-white/70 shadow-[0_4px_16px_0_rgba(0,0,0,0.03)] hover:shadow-md hover:border-ink/20'
              }`}
            >
              {/* Luminous Active Morphing Layer */}
              {isActive && (
                <motion.div
                  layoutId="active-session-bg"
                  className="absolute inset-0 bg-gradient-to-r from-[#D8EB73] via-[#E4F28D] to-[#EBF6A4] -z-10 rounded-2xl"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              {/* Active Glow indicator on left border */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-ink rounded-r-full" />
              )}

              <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold ${isActive ? 'text-ink' : 'text-ink-soft'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display font-bold text-base block">{sessionName}</span>
                </div>

                {isAllComplete ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-950 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Lengkap
                  </span>
                ) : (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-black/10 text-ink' : 'bg-black/5 text-ink-soft'}`}>
                    {filledCount}/{totalNeeded} peran
                  </span>
                )}
              </div>

              {sessionTime && (
                <div className={`text-xs font-medium flex items-center justify-between pl-6 ${isActive ? 'text-ink/80' : 'text-ink-soft'}`}>
                  <div className="flex items-center gap-1.5">
                    <span>🕒</span>
                    <span>{sessionTime}</span>
                  </div>
                  {isEditable && onDeleteSession && sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Apakah Anda yakin ingin menghapus sesi ${sessionName}?`)) {
                          onDeleteSession(session.session_id);
                        }
                      }}
                      className="text-[10px] text-danger hover:underline px-1 py-0.5 rounded cursor-pointer opacity-70 hover:opacity-100"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}

        {isEditable && onAddSession && (
          <button
            type="button"
            onClick={onAddSession}
            className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-surface-muted hover:border-ink/40 bg-surface/40 hover:bg-surface text-ink text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer spring-press"
          >
            <span>+</span>
            <span>Tambah Sesi Misa</span>
          </button>
        )}
      </div>
    </div>
  );
}