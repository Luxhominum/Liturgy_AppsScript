import { Dialog, Button, Badge } from '../ui';
import type { ValidationSummary } from '../../utils/ruleValidator';

interface RuleValidationModalProps {
  open: boolean;
  onClose: () => void;
  summary: ValidationSummary | null;
  onConfirmFinalize?: () => void;
  onRemoveConflicted?: (conflictedPersonIds: string[], conflictedAssignmentIds: string[]) => void;
  weekendTitle: string;
}

export default function RuleValidationModal({
  open,
  onClose,
  summary,
  onConfirmFinalize,
  onRemoveConflicted,
  weekendTitle,
}: RuleValidationModalProps) {
  if (!open || !summary) return null;

  const hasBlockers = summary.blockers.length > 0;
  const hasWarnings = summary.warnings.length > 0;

  const conflictedPersonIds = Array.from(
    new Set(summary.blockers.map((b) => b.personId).filter(Boolean) as string[])
  );
  const conflictedAssignmentIds = Array.from(
    new Set(summary.blockers.map((b) => b.assignmentId).filter(Boolean) as string[])
  );

  const handleRemoveAllConflicted = () => {
    if (onRemoveConflicted) {
      onRemoveConflicted(conflictedPersonIds, conflictedAssignmentIds);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={hasBlockers ? '⚠️ Pelanggaran Aturan Liturgi Wajib' : '✓ Hasil Pemeriksaan Aturan Liturgi'}
    >
      <div className="space-y-4 pt-1">
        {/* Status Banner */}
        {hasBlockers ? (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-danger font-bold text-sm">
              <span>⛔</span>
              <span>Ditemukan {summary.blockers.length} Pelanggaran Aturan Wajib</span>
            </div>
            <p className="text-xs text-danger/90 leading-relaxed">
              Jadwal pada <strong>{weekendTitle}</strong> belum dapat difinalisasi karena masih melanggar aturan baku liturgi paroki. Silakan perbaiki konflik di bawah ini atau gunakan tombol lepas otomatis:
            </p>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <span>✓</span>
              <span>Seluruh Aturan Wajib Telah Terpenuhi!</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Tidak ada konflik peran, tugas berturut-turut, atau pelanggaran wilayah pada jadwal <strong>{weekendTitle}</strong>.
            </p>
          </div>
        )}

        {/* Blocker Violations List */}
        {hasBlockers && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-danger block">
              Daftar Konflik Wajib (Harus Diperbaiki):
            </span>
            <div className="max-h-[36vh] overflow-y-auto space-y-2 pr-1" data-lenis-prevent="true">
              {summary.blockers.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white rounded-xl border border-danger/25 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-ink">{v.ruleName}</span>
                    <Badge variant="danger">{v.ruleId}</Badge>
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">{v.details}</p>

                  {v.personId && onRemoveConflicted && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onRemoveConflicted([v.personId!], v.assignmentId ? [v.assignmentId] : [])}
                        className="text-[11px] font-bold text-danger hover:text-danger/80 hover:underline flex items-center gap-1 cursor-pointer bg-danger/5 hover:bg-danger/10 px-2.5 py-1 rounded-lg border border-danger/20 transition-all"
                      >
                        <span>✕</span>
                        <span>Lepas Petugas Ini</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings List */}
        {hasWarnings && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
              Peringatan Kuota / Kelengkapan (Opsional):
            </span>
            <div className="max-h-[20vh] overflow-y-auto space-y-1.5 pr-1" data-lenis-prevent="true">
              {summary.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-950 flex items-start gap-2"
                >
                  <span className="shrink-0 mt-0.5">ℹ️</span>
                  <span>{w.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-surface-muted">
          {hasBlockers && onRemoveConflicted && (conflictedPersonIds.length > 0 || conflictedAssignmentIds.length > 0) ? (
            <Button
              variant="danger"
              onClick={handleRemoveAllConflicted}
              className="w-full sm:w-auto bg-danger text-white hover:bg-danger/90 flex items-center justify-center gap-1.5 font-bold shadow-sm"
            >
              <span>🧹</span>
              <span>Lepas Semua Petugas Konflik ({conflictedPersonIds.length})</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              {hasBlockers ? 'Tutup & Perbaiki Manual' : 'Batal'}
            </Button>
            {!hasBlockers && onConfirmFinalize && (
              <Button
                variant="primary"
                onClick={() => {
                  onConfirmFinalize();
                  onClose();
                }}
                className="w-full sm:w-auto bg-emerald-800 text-white hover:bg-emerald-900"
              >
                ✓ Lanjutkan Finalisasi Jadwal
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
