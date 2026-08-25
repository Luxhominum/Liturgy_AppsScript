import { motion, AnimatePresence } from 'motion/react';
import { Badge, Chip, Button } from '../ui';
import type { Person } from '../../types';

interface OfficerProfileDrawerProps {
  person: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] }) | null;
  onClose: () => void;
  onToggleActive: (personId: string) => void;
  onOpenEditRoles: (person: any) => void;
  onDeletePerson?: (personId: string) => void;
  isEditable?: boolean;
}

// Sample assignment history simulation
const MOCK_HISTORY = [
  { tanggal: 'Minggu, 18 Ags 2024', sesi: 'Minggu Pagi (07.00)', peran: 'Lektor 1', status: 'Selesai' },
  { tanggal: 'Minggu, 04 Ags 2024', sesi: 'Minggu Sore (17.00)', peran: 'Lektor 2', status: 'Selesai' },
  { tanggal: 'Sabtu, 20 Jul 2024', sesi: 'Sabtu Sore (17.00)', peran: 'Lektor 1', status: 'Selesai' },
];

export default function OfficerProfileDrawer({
  person,
  onClose,
  onToggleActive,
  onOpenEditRoles,
  onDeletePerson,
  isEditable = false,
}: OfficerProfileDrawerProps) {
  if (!person) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl h-full shadow-2xl border-l border-white/80 p-6 flex flex-col justify-between overflow-y-auto text-ink z-10"
        >
          <div className="space-y-6">
            {/* Header with Close */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-muted">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                Profil & Riwayat Petugas
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-ink-soft hover:text-ink hover:bg-surface transition-colors cursor-pointer spring-press"
              >
                ✕
              </button>
            </div>

            {/* Officer Avatar & Identity */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1B382B] to-[#0A1610] text-amber-300 font-bold text-2xl flex items-center justify-center shadow-md border border-amber-400/30 shrink-0">
                {person.nama.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xl font-display font-bold text-ink leading-snug truncate">
                  {person.nama}
                </h2>
                <p className="text-xs text-ink-soft font-medium">
                  Lingkungan {person.namaLingkungan} • Wilayah {person.namaWilayah}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={person.aktif ? 'complete' : 'danger'}>
                    {person.aktif ? 'Status: Aktif' : 'Status: Nonaktif'}
                  </Badge>
                  <span className="text-[10px] font-mono text-ink-soft">
                    ID: {person.person_id}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-surface/70 border border-surface-muted">
                <span className="text-[10px] font-bold uppercase text-ink-soft block">
                  Total Pelayanan
                </span>
                <span className="text-2xl font-display font-bold text-ink">
                  {MOCK_HISTORY.length} Kali
                </span>
                <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">
                  Bulan ini: 1 Kali
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-surface/70 border border-surface-muted">
                <span className="text-[10px] font-bold uppercase text-ink-soft block">
                  Jumlah Peran
                </span>
                <span className="text-2xl font-display font-bold text-ink">
                  {person.peranList?.length || 0} Peran
                </span>
                <span className="text-[10px] text-ink-soft font-medium block mt-0.5">
                  Terdaftar resmi
                </span>
              </div>
            </div>

            {/* Registered Roles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  Kualifikasi Peran Terdaftar
                </span>
                {isEditable && (
                  <button
                    onClick={() => onOpenEditRoles(person)}
                    className="text-xs font-bold text-emerald-900 hover:underline cursor-pointer"
                  >
                    Ubah Peran
                  </button>
                )}
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-surface-muted flex flex-wrap gap-1.5">
                {person.peranList && person.peranList.length > 0 ? (
                  person.peranList.map((r) => (
                    <Chip key={r} label={r} />
                  ))
                ) : (
                  <span className="text-xs text-ink-soft italic">Belum memiliki peran liturgi</span>
                )}
              </div>
            </div>

            {/* Assignment Timeline History */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft block">
                Riwayat Penugasan Terakhir
              </span>
              <div className="space-y-2.5">
                {MOCK_HISTORY.map((hist, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white border border-surface-muted flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-ink">{hist.tanggal}</div>
                      <div className="text-ink-soft text-[11px]">{hist.sesi}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-950 block">{hist.peran}</span>
                      <span className="text-[10px] text-ink-soft">✓ {hist.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 mt-6 border-t border-surface-muted space-y-2">
            {isEditable && (
              <div className="flex gap-2">
                <Button
                  variant={person.aktif ? 'secondary' : 'primary'}
                  onClick={() => onToggleActive(person.person_id)}
                  className="flex-1 rounded-2xl font-bold"
                >
                  {person.aktif ? '🔴 Nonaktifkan' : '🟢 Aktifkan'}
                </Button>
                {onDeletePerson && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Apakah Anda yakin ingin menghapus petugas ${person.nama} secara permanen?`)) {
                        onDeletePerson(person.person_id);
                        onClose();
                      }
                    }}
                    className="rounded-2xl font-bold px-3 text-xs"
                  >
                    🗑️ Hapus
                  </Button>
                )}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={onClose}
              className="w-full rounded-2xl font-bold"
            >
              Tutup
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}