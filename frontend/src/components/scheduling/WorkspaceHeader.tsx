import { Button, Badge } from '../ui';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';

export interface Weekend {
  id: string;
  date: string;
  title: string;
  status: 'Draft' | 'Final';
  revision: number;
}

export interface Session {
  id: string;
  name: string;
  time: string;
}

interface WorkspaceHeaderProps {
  weekend: Weekend | null;
  sessions: Session[];
  userRole: string;
  onOpenWeekend: () => void;
  onOpenCalendar?: () => void;
  onNavigatePrevWeekend?: () => void;
  onNavigateNextWeekend?: () => void;
  onDeleteDraft?: () => void;
  onAutoAssign?: () => void;
  onSaveDraft?: () => void;
  saveStatus?: 'IDLE' | 'SAVING' | 'SAVED';
  onFinalize: () => void;
  onPrint: () => void;
  isRevisionUnlocked?: boolean;
  onUnlockRevision?: () => void;
}

export default function WorkspaceHeader({
  weekend,
  sessions,
  userRole,
  onOpenWeekend,
  onOpenCalendar,
  onNavigatePrevWeekend,
  onNavigateNextWeekend,
  onDeleteDraft,
  onAutoAssign,
  onSaveDraft,
  saveStatus = 'IDLE',
  onFinalize,
  onPrint,
  isRevisionUnlocked = false,
  onUnlockRevision,
}: WorkspaceHeaderProps) {
  if (!weekend) {
    return (
      <div className="flex flex-col items-center justify-center py-12 backdrop-blur-2xl bg-white/70 rounded-3xl border border-white/80 shadow-sm text-center">
        <h2 className="text-2xl font-display font-bold text-ink mb-2">Belum Ada Jadwal Terpilih</h2>
        <p className="text-sm text-ink-soft mb-5">Pilih jadwal akhir pekan dari kalender atau buat jadwal baru.</p>
        <div className="flex gap-2">
          {onOpenCalendar && (
            <Button variant="secondary" onClick={onOpenCalendar}>📅 Buka Kalender</Button>
          )}
          <Button variant="primary" onClick={onOpenWeekend}>+ Buat Jadwal Baru</Button>
        </div>
      </div>
    );
  }

  const isDraft = (weekend.status as string) === 'Draft' || (weekend.status as string) === 'DRAFT';
  const canEdit = userRole !== 'VIEWER' && (isDraft || isRevisionUnlocked);
  const dateStr = weekend.date || (weekend as any).tanggal_acuan || (weekend.id ? weekend.id.replace('w-', '') : '');
  const litInfo = getLiturgicalInfo(dateStr);

  return (
    <div className="backdrop-blur-2xl bg-white/60 p-5 md:p-6 rounded-3xl border border-white/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.9)] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      {/* Title & Quick Date Switcher */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs uppercase font-bold tracking-wider text-ink-soft">
            Jadwal Terpilih
          </span>

          {/* Liturgical Season Pill Badge */}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/80 border border-white shadow-2xs">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: litInfo.colorHex }}
            />
            <span>{litInfo.seasonName} • Warna {litInfo.color}</span>
          </span>

          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="text-[11px] font-bold text-ink hover:text-ink-soft bg-white/80 hover:bg-white px-2.5 py-0.5 rounded-full border border-white transition-colors cursor-pointer"
            >
              📅 Buka Kalender
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigatePrevWeekend && (
            <button
              onClick={onNavigatePrevWeekend}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-white flex items-center justify-center font-bold text-sm text-ink cursor-pointer shadow-2xs transition-transform active:scale-95"
              title="Minggu Sebelumnya"
            >
              ◀
            </button>
          )}

          <h1 className="text-2xl md:text-3xl font-display font-bold text-ink flex items-center gap-2.5">
            {weekend.title}
          </h1>

          {onNavigateNextWeekend && (
            <button
              onClick={onNavigateNextWeekend}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-white flex items-center justify-center font-bold text-sm text-ink cursor-pointer shadow-2xs transition-transform active:scale-95"
              title="Minggu Berikutnya"
            >
              ▶
            </button>
          )}

          <Badge variant={(weekend.status as string) === 'Final' || (weekend.status as string) === 'FINAL' ? 'complete' : 'draft'}>
            {(weekend.status as string) === 'Final' || (weekend.status as string) === 'FINAL' ? '✓ Resmi (Final)' : 'Draft'}
          </Badge>

          <span className="text-xs text-ink-soft font-mono bg-white/70 px-2 py-0.5 rounded-md border border-white">
            Revisi {weekend.revision}
          </span>
        </div>

        <p className="text-xs text-ink-soft mt-1.5 flex items-center gap-2 flex-wrap">
          <span>{sessions.length} Sesi Misa Terdaftar</span>
          <span className="text-surface-muted font-mono">•</span>
          {canEdit ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-900 font-semibold bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-300/60 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Tersimpan Otomatis</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft font-semibold bg-surface px-2.5 py-0.5 rounded-full border border-surface-muted">
              <span>🔒 Terkunci (Mode Baca Saja)</span>
            </span>
          )}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenWeekend}>
          Buka Jadwal Lain
        </Button>
        <Button variant="secondary" size="sm" onClick={onPrint}>
          🖨️ Cetak Warta
        </Button>

        {/* Locked Schedule: Unlock for Revision Button (Admins/Schedulers) */}
        {!isDraft && !isRevisionUnlocked && userRole !== 'VIEWER' && onUnlockRevision && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onUnlockRevision}
            className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300/80 rounded-xl font-bold shadow-xs flex items-center gap-1.5"
          >
            <span>🔓</span>
            <span>Buka Kunci untuk Revisi</span>
          </Button>
        )}

        {/* Active Revision Indicator */}
        {!isDraft && isRevisionUnlocked && (
          <span className="text-xs font-bold text-amber-950 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1.5 shadow-2xs">
            <span>🔓</span>
            <span>Mode Revisi Terbuka</span>
          </span>
        )}

        {/* Save Draft Progress Button */}
        {canEdit && onSaveDraft && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSaveDraft}
            disabled={saveStatus === 'SAVING'}
            className={`rounded-xl font-bold shadow-xs spring-press transition-all flex items-center gap-1.5 ${
              saveStatus === 'SAVED'
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-white hover:bg-surface text-ink border-surface-muted'
            }`}
          >
            <span>{saveStatus === 'SAVING' ? '⏳' : saveStatus === 'SAVED' ? '✓' : '💾'}</span>
            <span>
              {saveStatus === 'SAVING'
                ? 'Menyimpan...'
                : saveStatus === 'SAVED'
                ? 'Draft Tersimpan!'
                : isRevisionUnlocked
                ? 'Simpan Revisi'
                : 'Simpan Draft'}
            </span>
          </Button>
        )}

        {/* Auto Assign Button */}
        {canEdit && onAutoAssign && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAutoAssign}
            className="bg-[#022C12] text-white hover:bg-emerald-950 border border-[#D4AF37]/50 shadow-md font-bold spring-press"
          >
            ⚡ Isi Otomatis
          </Button>
        )}

        {/* Delete Draft Button */}
        {isDraft && userRole !== 'VIEWER' && onDeleteDraft && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteDraft}
            className="text-danger hover:bg-danger/10 border border-danger/20 font-bold"
          >
            🗑️ Hapus Draft
          </Button>
        )}

        {/* Finalize Button (ADMIN only) */}
        {userRole === 'ADMIN' && (isDraft || isRevisionUnlocked) && (
          <Button
            variant="primary"
            size="sm"
            onClick={onFinalize}
            className="bg-ink text-white hover:bg-ink-soft shadow-md font-bold"
          >
            ✓ {isRevisionUnlocked ? 'Finalisasi Revisi' : 'Finalisasi'}
          </Button>
        )}

        {userRole === 'VIEWER' && (
          <span className="text-xs font-bold text-ink-soft bg-surface px-3 py-1.5 rounded-xl border border-surface-muted flex items-center gap-1.5">
            <span>👁️</span>
            <span>Mode Baca Saja (Pelihat)</span>
          </span>
        )}
      </div>
    </div>
  );
}