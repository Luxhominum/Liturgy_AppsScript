import { Dialog, Button } from '../ui';
import type { AutoAssignResult } from '../../utils/autoAssignEngine';

interface AutoAssignPreviewModalProps {
  open: boolean;
  onClose: () => void;
  result: AutoAssignResult | null;
  onApply: () => Promise<void>;
  isLoading?: boolean;
}

export default function AutoAssignPreviewModal({
  open,
  onClose,
  result,
  onApply,
  isLoading = false,
}: AutoAssignPreviewModalProps) {
  if (!result) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="⚡ Simulasi Penjadwalan Otomatis (Auto-Assign)"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Intro banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 text-xs space-y-1">
          <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
            <span>✨</span>
            <span>Algoritma Keadilan & Rotasi Liturgi Aktif</span>
          </div>
          <p className="text-emerald-900/80 leading-relaxed">
            Petugas dipilih berdasarkan kualifikasi peran aktif, masa istirahat (cooldown), pemerataan lingkungan, dan jaminan <strong>tanpa bentrok tugas</strong> di akhir pekan yang sama.
          </p>
        </div>

        {/* Sessions Breakdown */}
        <div className="space-y-5">
          {result.details.map((sess, idx) => (
            <div
              key={sess.sessionId}
              className="p-4 rounded-2xl bg-surface/70 border border-surface-muted space-y-3"
            >
              <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
                <span className="font-display font-bold text-sm text-ink flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-ink text-white text-[10px] flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span>{sess.sessionName}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  ✓ Slot Terpenuhi
                </span>
              </div>

              {/* Choir */}
              {sess.choir && (
                <div className="flex items-start justify-between text-xs p-2 rounded-xl bg-white border border-surface-muted/60">
                  <div className="flex items-center gap-2">
                    <span>🎵</span>
                    <span className="font-bold text-ink">Paduan Suara (Koor):</span>
                    <span className="font-medium text-emerald-900">{sess.choir.name}</span>
                  </div>
                  <span className="text-[10px] text-ink-soft italic">
                    {sess.choir.reason}
                  </span>
                </div>
              )}

              {/* Roles */}
              <div className="space-y-2">
                {sess.rolesFilled.map((rf) => (
                  <div key={rf.roleName} className="text-xs space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-ink-soft block">
                      {rf.roleName} ({rf.officers.length} Petugas)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {rf.officers.map((o, oIdx) => (
                        <div
                          key={oIdx}
                          className="px-2.5 py-1 rounded-lg bg-white border border-surface-muted shadow-2xs flex items-center gap-1.5"
                          title={o.reason}
                        >
                          <span className="font-bold text-ink">{o.name}</span>
                          <span className="text-[9px] opacity-60">✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-surface-muted">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>

          <Button
            variant="primary"
            onClick={onApply}
            disabled={isLoading}
            className="bg-[#022C12] text-white hover:bg-emerald-950 font-bold px-6 shadow-lg border border-[#D4AF37]/50 spring-press"
          >
            {isLoading ? 'Menerapkan...' : '✓ Terapkan ke Jadwal Liturgi'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
