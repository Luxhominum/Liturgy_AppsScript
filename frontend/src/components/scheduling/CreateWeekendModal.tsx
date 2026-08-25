import { useState, useEffect } from 'react';
import { Dialog, Button, Input } from '../ui';
import { getLiturgicalInfo, type LiturgicalDay } from '../../utils/liturgicalCalendar';
import type { SessionType } from '../../types';

interface CreateWeekendModalProps {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  onSubmit: (data: {
    tanggalAcuan: string;
    isSpecialMass?: boolean;
    namaKhusus?: string;
    sessions: { jenis_sesi: SessionType; nama_khusus?: string; tanggal_sesi: string }[];
  }) => Promise<void>;
}

export default function CreateWeekendModal({
  open,
  onClose,
  initialDate,
  onSubmit,
}: CreateWeekendModalProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate || '');
  const [isSpecialMode, setIsSpecialMode] = useState(false);
  const [specialMassTitle, setSpecialMassTitle] = useState('');
  const [specialMassTime, setSpecialMassTime] = useState('18:00');
  const [liturgicalInfo, setLiturgicalInfo] = useState<LiturgicalDay | null>(null);

  // Weekend regular sessions checkboxes
  const [includeSabtuSore, setIncludeSabtuSore] = useState(true);
  const [includeMingguPagi, setIncludeMingguPagi] = useState(true);
  const [includeMingguSore, setIncludeMingguSore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      const d = new Date(initialDate + 'T00:00:00');
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      setIsSpecialMode(!isWeekend);
    }
  }, [initialDate]);

  // Compute liturgical info whenever selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const info = getLiturgicalInfo(selectedDate);
      setLiturgicalInfo(info);
      if (!specialMassTitle || specialMassTitle === 'Misa Khusus') {
        setSpecialMassTitle(info.title);
      }
    } else {
      setLiturgicalInfo(null);
    }
  }, [selectedDate]);

  const handleSubmit = async () => {
    if (!selectedDate) return;

    const sessions: { jenis_sesi: SessionType; nama_khusus?: string; tanggal_sesi: string }[] = [];
    const chosenTitle = specialMassTitle || liturgicalInfo?.title || 'Misa';

    if (isSpecialMode) {
      sessions.push({
        jenis_sesi: 'KHUSUS',
        nama_khusus: `${chosenTitle} (${specialMassTime} WIB)`,
        tanggal_sesi: `${selectedDate}T${specialMassTime}:00Z`,
      });
    } else {
      const sundayDate = new Date(selectedDate + 'T00:00:00');
      const saturdayDate = new Date(sundayDate);
      saturdayDate.setDate(sundayDate.getDate() - 1);

      if (includeSabtuSore) {
        sessions.push({
          jenis_sesi: 'SABTU_SORE',
          tanggal_sesi: saturdayDate.toISOString(),
        });
      }
      if (includeMingguPagi) {
        sessions.push({
          jenis_sesi: 'MINGGU_PAGI',
          tanggal_sesi: sundayDate.toISOString(),
        });
      }
      if (includeMingguSore) {
        sessions.push({
          jenis_sesi: 'MINGGU_SORE',
          tanggal_sesi: sundayDate.toISOString(),
        });
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        tanggalAcuan: selectedDate,
        isSpecialMass: isSpecialMode,
        namaKhusus: chosenTitle,
        sessions,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create schedule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isSpecialMode ? 'Buat Jadwal Misa Khusus / Hari Raya' : 'Buka / Buat Jadwal Akhir Pekan'}
    >
      <div className="space-y-5">
        {/* Schedule Type Selector */}
        <div className="flex bg-surface p-1 rounded-2xl border border-surface-muted">
          <button
            type="button"
            onClick={() => setIsSpecialMode(false)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isSpecialMode ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Misa Akhir Pekan (Sabtu/Minggu)
          </button>
          <button
            type="button"
            onClick={() => setIsSpecialMode(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isSpecialMode ? 'bg-accent text-ink shadow-xs font-bold' : 'text-ink-soft hover:text-ink'
            }`}
          >
            ★ Misa Khusus / Hari Raya
          </button>
        </div>

        <Input
          type="date"
          label={isSpecialMode ? 'Tanggal Kegiatan / Misa' : 'Pilih Tanggal Hari Minggu'}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        {/* Liturgical Auto-Calculation Banner */}
        {liturgicalInfo && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-white/90 to-surface/80 border border-white/90 shadow-2xs space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Kalender Liturgi Resmi
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs ${liturgicalInfo.colorClass}`}>
                {liturgicalInfo.color === 'HIJAU' ? '🟢 Hijau' : liturgicalInfo.color === 'UNGU' ? '🟣 Ungu' : liturgicalInfo.color === 'MERAH' ? '🔴 Merah' : liturgicalInfo.color === 'MERAH_MUDA' ? '🌸 Merah Muda' : '⚪ Putih'}
              </span>
            </div>
            <div className="font-display font-bold text-ink text-sm">
              {liturgicalInfo.title}
            </div>
            <div className="text-[11px] text-ink-soft">
              {liturgicalInfo.seasonName} • {liturgicalInfo.rank}
            </div>
          </div>
        )}

        {isSpecialMode ? (
          <div className="space-y-3 bg-surface/60 p-4 rounded-2xl border border-surface-muted">
            <Input
              label="Nama Perayaan / Kegiatan"
              placeholder="Contoh: Misa Rabu Abu, Kamis Putih, Misa Hari Raya..."
              value={specialMassTitle}
              onChange={(e) => setSpecialMassTitle(e.target.value)}
            />
            <Input
              type="time"
              label="Jam Pelaksanaan Misa"
              value={specialMassTime}
              onChange={(e) => setSpecialMassTime(e.target.value)}
            />
            <div className="p-2.5 bg-blue-soft/30 rounded-xl text-xs text-ink">
              💡 <strong>Bebas Batasan:</strong> Petugas untuk Misa Khusus dapat ditugaskan secara bebas tanpa batasan aturan konflik / kuota.
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold uppercase text-ink-soft mb-2">
              Centang Sesi Misa yang Diadakan
            </label>
            <div className="space-y-2 bg-surface/60 p-3.5 rounded-2xl border border-surface-muted">
              <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSabtuSore}
                  onChange={(e) => setIncludeSabtuSore(e.target.checked)}
                  className="w-4 h-4 rounded text-ink accent-ink"
                />
                Sabtu Sore (17.00 WIB)
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMingguPagi}
                  onChange={(e) => setIncludeMingguPagi(e.target.checked)}
                  className="w-4 h-4 rounded text-ink accent-ink"
                />
                Minggu Pagi (07.00 WIB)
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMingguSore}
                  onChange={(e) => setIncludeMingguSore(e.target.checked)}
                  className="w-4 h-4 rounded text-ink accent-ink"
                />
                Minggu Sore (17.00 WIB)
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedDate || isSubmitting}
          >
            {isSubmitting ? 'Memproses...' : 'Buka / Buat Jadwal'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}