import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Button, ParishLogo } from '../ui';
import { exportScheduleCsv } from '../../utils/exportUtils';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';
import type { Session, Assignment, CommunityAssignment } from '../../types';

interface PrintScheduleViewProps {
  initialWeekendId?: string | null;
  onBack: () => void;
}

function getOfficerInfo(personIdOrName: string) {
  if (!personIdOrName) return '-';
  if (personIdOrName.startsWith('PER-')) {
    const idx = parseInt(personIdOrName.replace('PER-', ''), 10) - 1;
    if (idx >= 0 && idx < REAL_OFFICERS_DATA.length) {
      const o = REAL_OFFICERS_DATA[idx];
      return `${o.nama} (${o.lingkungan})`;
    }
  }
  const found = REAL_OFFICERS_DATA.find((o) => o.nama.toLowerCase() === personIdOrName.toLowerCase());
  if (found) {
    return `${found.nama} (${found.lingkungan})`;
  }
  return personIdOrName;
}

export default function PrintScheduleView({ initialWeekendId, onBack }: PrintScheduleViewProps) {
  const [activeTab, setActiveTab] = useState<'a4' | 'poster' | 'whatsapp'>('a4');
  const [copied, setCopied] = useState(false);
  const [firestoreWeekends, setFirestoreWeekends] = useState<any[]>([]);
  const [startWeekendKey, setStartWeekendKey] = useState<string>(initialWeekendId || '');
  const [endWeekendKey, setEndWeekendKey] = useState<string>(initialWeekendId || '');

  // Subscribe in real-time to Firestore weekends
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'weekends'), (snap) => {
      const wList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFirestoreWeekends(wList);
    });
    return () => unsub();
  }, []);

  // Compute all selectable weekend options (Firestore + upcoming Sundays)
  const availableWeekendOptions = useMemo(() => {
    const today = new Date();
    const optionsMap = new Map<string, { id: string; dateIso: string; label: string; dateObj: Date; data?: any }>();

    // 1. Add from Firestore
    firestoreWeekends.forEach((w) => {
      const dateIso = w.tanggal_acuan || w.id.replace('w-', '');
      const dObj = new Date(dateIso + 'T00:00:00');
      const lit = getLiturgicalInfo(dObj);
      const formatted = dObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const title = w.nama_kegiatan || lit.title;
      optionsMap.set(w.id, {
        id: w.id,
        dateIso,
        label: `${title} (${formatted}) ${w.status === 'FINAL' ? '✓ Resmi' : '• Draft'}`,
        dateObj: dObj,
        data: w,
      });
    });

    // 2. Add upcoming Sundays from 2026 liturgical calendar
    for (let i = -2; i <= 16; i++) {
      const d = new Date(today);
      const dayOfWeek = d.getDay();
      const diffToSunday = (7 - dayOfWeek) % 7 + (i * 7);
      d.setDate(d.getDate() + diffToSunday);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      const dateIso = `${y}-${m}-${dateNum}`;
      const id = `w-${dateIso}`;

      if (!optionsMap.has(id)) {
        const lit = getLiturgicalInfo(d);
        const formatted = d.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        optionsMap.set(id, {
          id,
          dateIso,
          label: `${lit.title} (${formatted})`,
          dateObj: d,
        });
      }
    }

    return Array.from(optionsMap.values()).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }, [firestoreWeekends]);

  // Set default start and end keys
  useEffect(() => {
    if (initialWeekendId) {
      setStartWeekendKey(initialWeekendId);
      setEndWeekendKey(initialWeekendId);
    } else if (!startWeekendKey && availableWeekendOptions.length > 0) {
      const todayIso = new Date().toISOString().split('T')[0];
      const upcoming = availableWeekendOptions.find((opt) => opt.dateIso >= todayIso) || availableWeekendOptions[0];
      setStartWeekendKey(upcoming.id);
      setEndWeekendKey(upcoming.id);
    }
  }, [initialWeekendId, availableWeekendOptions, startWeekendKey]);

  // Quick Preset Handlers
  const handleApplyPreset = (countWeeks: number) => {
    const startIdx = availableWeekendOptions.findIndex((opt) => opt.id === startWeekendKey);
    const validStartIdx = startIdx >= 0 ? startIdx : 0;
    const targetEndIdx = Math.min(validStartIdx + countWeeks - 1, availableWeekendOptions.length - 1);
    setEndWeekendKey(availableWeekendOptions[targetEndIdx].id);
  };

  // Resolve All Schedules within Selected Date Range
  const selectedSchedules = useMemo(() => {
    if (availableWeekendOptions.length === 0) return [];

    const startOpt = availableWeekendOptions.find((opt) => opt.id === startWeekendKey) || availableWeekendOptions[0];
    const endOpt = availableWeekendOptions.find((opt) => opt.id === endWeekendKey) || startOpt;

    let startDateIso = startOpt.dateIso;
    let endDateIso = endOpt.dateIso;
    if (startDateIso > endDateIso) {
      const temp = startDateIso;
      startDateIso = endDateIso;
      endDateIso = temp;
    }

    const matchedOptions = availableWeekendOptions.filter(
      (opt) => opt.dateIso >= startDateIso && opt.dateIso <= endDateIso
    );

    return matchedOptions.map((opt) => {
      const dateObj = opt.dateObj;
      const lit = getLiturgicalInfo(dateObj);
      const dateIso = opt.dateIso;
      const wData = opt.data;

      const satDate = new Date(dateObj);
      satDate.setDate(dateObj.getDate() - 1);
      const satFormatted = satDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const sunFormatted = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      const periodeStr = `${satFormatted.split(' ')[0]} & ${sunFormatted}`;

      const sessionsRaw: Session[] =
        wData?.sessions && wData.sessions.length > 0
          ? wData.sessions.filter((s: any) => {
              // Hide unassigned Sunday afternoon if not explicitly a special mass
              if (s.jenis_sesi === 'MINGGU_SORE' && !wData.is_special && !wData.isSpecialMass) {
                const hasAssignments = (wData.assignments || []).some(
                  (a: any) => a.session_id === s.session_id && a.status !== 'REMOVED'
                );
                const hasComm = (wData.communityAssignments || []).some(
                  (c: any) => c.session_id === s.session_id && c.status !== 'REMOVED'
                );
                return hasAssignments || hasComm;
              }
              return true;
            })
          : [
              {
                session_id: 'ses-1',
                weekend_id: opt.id,
                jenis_sesi: 'SABTU_SORE',
                tanggal_sesi: `${dateIso}T17:00:00Z`,
                status: 'DRAFT',
                nama_khusus: 'Misa Sabtu Sore',
              },
              {
                session_id: 'ses-2',
                weekend_id: opt.id,
                jenis_sesi: 'MINGGU_PAGI',
                tanggal_sesi: `${dateIso}T07:00:00Z`,
                status: 'DRAFT',
                nama_khusus: 'Misa Minggu Pagi',
              },
            ];

      const assignmentsRaw: Assignment[] = wData?.assignments || [];
      const communityRaw: CommunityAssignment[] = wData?.communityAssignments || [];

      // Weekend-level Hias Altar (1 Wilayah per Pekan, NO hardcoded fallback)
      const altarAss = communityRaw.find((c) => c.jenis_penugasan === 'HIAS_ALTAR' && c.status !== 'REMOVED');
      const hiasAltarWeekendStr = altarAss
        ? (altarAss.wilayah_id ? `Wilayah ${altarAss.wilayah_id}` : (altarAss.lingkungan_id ? `Lingkungan ${altarAss.lingkungan_id}` : '— (Belum Ditugaskan)'))
        : '— (Belum Ditugaskan)';

      const formattedSessions = sessionsRaw.map((s) => {
        const choirAss = communityRaw.find((c) => c.session_id === s.session_id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED');
        const tatibAss = communityRaw.find((c) => c.session_id === s.session_id && c.jenis_penugasan === 'TATIB' && c.status !== 'REMOVED');

        const koorStr = choirAss ? (choirAss.wilayah_id ? `Wilayah ${choirAss.wilayah_id}` : (choirAss.lingkungan_id ? `Lingkungan ${choirAss.lingkungan_id}` : '-')) : '(Belum Ditugaskan)';
        const tatibStr = tatibAss ? (tatibAss.lingkungan_id ? `Lingkungan ${tatibAss.lingkungan_id}` : (tatibAss.wilayah_id ? `Grup ${tatibAss.wilayah_id}` : '-')) : '(Belum Ditugaskan)';

        const organists = assignmentsRaw.filter((a) => a.session_id === s.session_id && a.role_id === 'ROL-ORGANIS' && a.status !== 'REMOVED').map((a) => getOfficerInfo(a.person_id));
        const psalms = assignmentsRaw.filter((a) => a.session_id === s.session_id && a.role_id === 'ROL-PEMAZMUR' && a.status !== 'REMOVED').map((a) => getOfficerInfo(a.person_id));
        const lectors = assignmentsRaw.filter((a) => a.session_id === s.session_id && a.role_id === 'ROL-LEKTOR' && a.status !== 'REMOVED').map((a) => getOfficerInfo(a.person_id));
        const altarServers = assignmentsRaw.filter((a) => a.session_id === s.session_id && a.role_id === 'ROL-MISDINAR' && a.status !== 'REMOVED').map((a) => getOfficerInfo(a.person_id));
        const eucharisticMinisters = assignmentsRaw.filter((a) => a.session_id === s.session_id && a.role_id === 'ROL-PRODIAKON' && a.status !== 'REMOVED').map((a) => getOfficerInfo(a.person_id));

        let defaultTime = '17.00 WIB';
        if (s.jenis_sesi === 'MINGGU_PAGI') defaultTime = '07.00 WIB';
        if (s.jenis_sesi === 'MINGGU_SORE') defaultTime = '17.00 WIB';
        if (s.jenis_sesi === 'SABTU_SORE') defaultTime = '17.00 WIB';

        const sessionName = s.nama_khusus || (s.jenis_sesi === 'SABTU_SORE' ? 'Misa Sabtu Sore' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Misa Minggu Pagi' : s.jenis_sesi === 'MINGGU_SORE' ? 'Misa Minggu Sore' : 'Misa Khusus');
        const isSaturday = s.jenis_sesi === 'SABTU_SORE';
        const sessionDateStr = isSaturday ? `Sabtu, ${satFormatted}` : `Minggu, ${sunFormatted}`;

        return {
          nama: sessionName,
          waktu: `${sessionDateStr} — ${defaultTime}`,
          koor: koorStr,
          organis: organists.length > 0 ? organists.join(', ') : '(Belum Ditugaskan)',
          pemazmur: psalms.length > 0 ? psalms : ['(Belum Ditugaskan)'],
          lektor: lectors.length > 0 ? lectors : ['(Belum Ditugaskan)'],
          misdinar: altarServers.length > 0 ? altarServers : ['(Belum Ditugaskan)'],
          prodiakon: eucharisticMinisters.length > 0 ? eucharisticMinisters : ['(Belum Ditugaskan)'],
          tatib: tatibStr,
        };
      });

      return {
        id: opt.id,
        paroki: 'Gereja Katolik Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali',
        keuskupan: 'Keuskupan Agung Semarang',
        judul: 'JADWAL PETUGAS EKARISTI AKHIR PEKAN',
        perayaan: wData?.nama_kegiatan || lit.title.toUpperCase(),
        periode: `${(wData?.nama_kegiatan || lit.title).toUpperCase()} — ${periodeStr.toUpperCase()}`,
        warnaLiturgi: lit.color,
        warnaHex: lit.colorHex,
        hiasAltar: hiasAltarWeekendStr,
        status: wData?.status || 'DRAFT',
        sessions: formattedSessions,
      };
    });
  }, [availableWeekendOptions, startWeekendKey, endWeekendKey]);

  const generateWhatsAppText = () => {
    if (selectedSchedules.length === 0) return '';
    let text = `✝️ *JADWAL PELAYANAN LITURGI GEREJA KATOLIK*\n`;
    text += `🏛️ *Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali*\n`;
    text += `📋 Total: ${selectedSchedules.length} Pekan Pelayanan\n\n`;

    selectedSchedules.forEach((sch, wIdx) => {
      text += `═════════════════════\n`;
      text += `📅 *PEKAN ${wIdx + 1}: ${sch.perayaan}*\n`;
      text += `🗓️ ${sch.periode}\n`;
      text += `🎨 Warna Liturgi: ${sch.warnaLiturgi}\n`;
      if (sch.hiasAltar && sch.hiasAltar !== '— (Belum Ditugaskan)') {
        text += `🌿 *Hias Altar (Akhir Pekan):* ${sch.hiasAltar}\n`;
      }
      text += `═════════════════════\n\n`;

      sch.sessions.forEach((s) => {
        text += `*${s.nama.toUpperCase()}*\n`;
        text += `⏰ ${s.waktu}\n`;
        text += `🎵 *Koor:* ${s.koor}\n`;
        text += `🎹 *Organis:* ${s.organis}\n`;
        text += `🎤 *Pemazmur:* ${s.pemazmur.join(', ')}\n`;
        text += `📖 *Lektor:* ${s.lektor.join(', ')}\n`;
        text += `🕯️ *Misdinar:* ${s.misdinar.join(', ')}\n`;
        text += `🍞 *Prodiakon:* ${s.prodiakon.join(', ')}\n`;
        text += `🛡️ *Tatib:* ${s.tatib}\n\n`;
      });
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Mohon hadir 30 menit sebelum perayaan Ekaristi dimulai. Berkah Dalem._ 🙏`;
    return text;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportCsv = () => {
    if (selectedSchedules.length === 0) return;
    const flatRows: any[] = [];
    selectedSchedules.forEach((sch) => {
      sch.sessions.forEach((s) => {
        flatRows.push({
          tanggal: s.waktu,
          misa: `${sch.perayaan} - ${s.nama}`,
          koor: s.koor,
          altar: sch.hiasAltar,
          tatib: s.tatib,
          tugas: 'Organis',
          nama: s.organis,
          wilayah: s.koor,
        });
        s.pemazmur.forEach((p) => {
          flatRows.push({
            tanggal: s.waktu,
            misa: `${sch.perayaan} - ${s.nama}`,
            koor: s.koor,
            altar: sch.hiasAltar,
            tatib: s.tatib,
            tugas: 'Pemazmur',
            nama: p,
            wilayah: s.koor,
          });
        });
        s.lektor.forEach((l) => {
          flatRows.push({
            tanggal: s.waktu,
            misa: `${sch.perayaan} - ${s.nama}`,
            koor: s.koor,
            altar: sch.hiasAltar,
            tatib: s.tatib,
            tugas: 'Lektor',
            nama: l,
            wilayah: s.koor,
          });
        });
        s.misdinar.forEach((m) => {
          flatRows.push({
            tanggal: s.waktu,
            misa: `${sch.perayaan} - ${s.nama}`,
            koor: s.koor,
            altar: sch.hiasAltar,
            tatib: s.tatib,
            tugas: 'Misdinar',
            nama: m,
            wilayah: '-',
          });
        });
        s.prodiakon.forEach((pr) => {
          flatRows.push({
            tanggal: s.waktu,
            misa: `${sch.perayaan} - ${s.nama}`,
            koor: s.koor,
            altar: sch.hiasAltar,
            tatib: s.tatib,
            tugas: 'Prodiakon',
            nama: pr,
            wilayah: '-',
          });
        });
      });
    });

    const rangeTitle = selectedSchedules.length === 1
      ? selectedSchedules[0].perayaan
      : `${selectedSchedules[0].perayaan}_sd_${selectedSchedules[selectedSchedules.length - 1].perayaan}`;

    exportScheduleCsv(rangeTitle, flatRows);
  };

  if (selectedSchedules.length === 0) {
    return (
      <div className="p-12 text-center text-ink-soft">
        Memuat data jadwal warta...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Controls & Date Range Picker (Hidden on Print) */}
      <div className="bg-white/85 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-white/90 shadow-sm print:hidden space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink">
                Generator Warta & Cetak Multi-Format
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                {selectedSchedules.length} Pekan Dipilih
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Pilih rentang pekan untuk mencetak dokumen A4 (1 halaman per pekan), poster mading, atau format WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" onClick={onBack} className="rounded-2xl font-bold">
              ← Kembali
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              className="rounded-2xl font-bold"
            >
              📥 Ekspor CSV ({selectedSchedules.length} Pekan)
            </Button>
            {activeTab === 'a4' && (
              <Button variant="primary" onClick={() => window.print()} className="rounded-2xl font-bold shadow-md bg-[#022C12] text-white hover:bg-emerald-950">
                🖨️ Cetak {selectedSchedules.length} Halaman A4
              </Button>
            )}
            {activeTab === 'whatsapp' && (
              <Button variant="primary" onClick={handleCopyWhatsApp} className="rounded-2xl font-bold shadow-md bg-[#022C12] text-white hover:bg-emerald-950">
                {copied ? '✓ Berhasil Disalin!' : '📋 Salin Teks WhatsApp'}
              </Button>
            )}
          </div>
        </div>

        {/* Range Selector Controls */}
        <div className="pt-3 border-t border-surface-muted/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto flex-1 max-w-2xl">
            {/* Start Week */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1 block">
                🗓️ Dari Pekan:
              </label>
              <select
                value={startWeekendKey}
                onChange={(e) => setStartWeekendKey(e.target.value)}
                className="w-full h-10 rounded-xl border border-surface-muted bg-surface px-3 text-xs font-bold text-ink focus:ring-2 focus:ring-accent cursor-pointer"
              >
                {availableWeekendOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* End Week */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1 block">
                🗓️ Sampai Pekan:
              </label>
              <select
                value={endWeekendKey}
                onChange={(e) => setEndWeekendKey(e.target.value)}
                className="w-full h-10 rounded-xl border border-surface-muted bg-surface px-3 text-xs font-bold text-ink focus:ring-2 focus:ring-accent cursor-pointer"
              >
                {availableWeekendOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-ink-soft mr-1">Preset Cepat:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset(1)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-surface-muted text-xs font-semibold text-ink hover:bg-surface-muted/50 transition-colors"
            >
              1 Pekan
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(2)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-surface-muted text-xs font-semibold text-ink hover:bg-surface-muted/50 transition-colors"
            >
              2 Pekan
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(4)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-surface-muted text-xs font-semibold text-ink hover:bg-surface-muted/50 transition-colors"
            >
              1 Bulan (4 Pekan)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(8)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-surface-muted text-xs font-semibold text-ink hover:bg-surface-muted/50 transition-colors"
            >
              2 Bulan (8 Pekan)
            </button>
          </div>
        </div>
      </div>

      {/* Format Switcher Tabs (Hidden on Print) */}
      <div className="flex bg-surface p-1.5 rounded-2xl border border-surface-muted print:hidden max-w-xl">
        <button
          type="button"
          onClick={() => setActiveTab('a4')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'a4' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
          }`}
        >
          📄 1. Dokumen A4 Resmi ({selectedSchedules.length} Halaman)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('poster')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'poster' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
          }`}
        >
          🎨 2. Poster Grafis Mading
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'whatsapp' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
          }`}
        >
          📱 3. Format WhatsApp
        </button>
      </div>

      {/* MODE 1: A4 Official Print Layout (1 Page Per Week with Automatic Page Breaks) */}
      {activeTab === 'a4' && (
        <div className="space-y-8 print:space-y-0">
          {selectedSchedules.map((schedule, wIdx) => (
            <div key={schedule.id || wIdx} className="print:break-after-page print:page-break-after-always">
              <Card className="print:shadow-none print:border-0 print:p-0 bg-white p-8 rounded-3xl border border-surface-muted shadow-lg">
                {/* Parish Letterhead */}
                <div className="flex items-center justify-center gap-4 pb-6 border-b-2 border-black mb-6 text-center">
                  <ParishLogo className="w-16 h-16 object-contain shrink-0" />
                  <div>
                    <div className="text-sm font-bold uppercase tracking-widest text-black/70">
                      {schedule.keuskupan}
                    </div>
                    <h2 className="text-2xl font-bold font-display uppercase tracking-wide text-black mt-0.5">
                      {schedule.paroki}
                    </h2>
                    <div className="text-base font-bold text-black mt-0.5">
                      {schedule.judul}
                    </div>
                    <div className="text-xs font-medium text-black/80 mt-0.5">
                      {schedule.periode} • Warna Liturgi: {schedule.warnaLiturgi}
                    </div>
                  </div>
                  <ParishLogo className="w-16 h-16 object-contain shrink-0" />
                </div>

                {/* Weekend-Level Dedicated Hias Altar Banner */}
                <div className="mb-4 p-3 bg-black/5 border-2 border-black rounded-xl flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌿</span>
                    <span className="font-bold uppercase tracking-wide">HIAS ALTAR (AKHIR PEKAN):</span>
                    <span className="font-semibold text-black">
                      {schedule.hiasAltar && schedule.hiasAltar !== '— (Belum Ditugaskan)' ? schedule.hiasAltar : '— (Belum Ditugaskan)'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-black/70 uppercase">
                    1 Wilayah / Pekan
                  </span>
                </div>

                {/* Mass Sessions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-black/5 border-b border-black font-bold uppercase text-black">
                        <th className="p-2.5 border-r border-black w-44">Perayaan Misa</th>
                        <th className="p-2.5 border-r border-black">Koor & Organis</th>
                        <th className="p-2.5 border-r border-black">Pemazmur & Lektor</th>
                        <th className="p-2.5 border-r border-black">Misdinar</th>
                        <th className="p-2.5 border-r border-black">Prodiakon</th>
                        <th className="p-2.5">Tata Tertib (Tatib)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/40">
                      {schedule.sessions.map((sess, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="p-2.5 border-r border-black font-bold bg-black/2">
                            <div className="text-sm font-display">{sess.nama}</div>
                            <div className="text-[10px] font-normal text-black/70 mt-0.5">{sess.waktu}</div>
                          </td>
                          <td className="p-2.5 border-r border-black">
                            <div className="font-bold">{sess.koor}</div>
                            <div className="text-[11px] text-black/80 mt-1">🎹 Org: {sess.organis}</div>
                          </td>
                          <td className="p-2.5 border-r border-black">
                            <div className="font-semibold">🎤 Mazmur:</div>
                            <div className="text-[11px] mb-1.5">{sess.pemazmur.join(', ')}</div>
                            <div className="font-semibold">📖 Lektor:</div>
                            <div className="text-[11px]">{sess.lektor.join(', ')}</div>
                          </td>
                          <td className="p-2.5 border-r border-black text-[11px]">
                            {sess.misdinar.join(' • ')}
                          </td>
                          <td className="p-2.5 border-r border-black text-[11px]">
                            {sess.prodiakon.join(' • ')}
                          </td>
                          <td className="p-2.5 text-[11px]">
                            <div>🕯️ {sess.tatib}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 pt-4 border-t border-black/20 flex justify-between text-xs text-black/70">
                  <div>Warta Resmi Seksi Liturgi Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali</div>
                  <div>Dokumen Resmi Halaman {wIdx + 1} dari {selectedSchedules.length}</div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* MODE 2: Graphic Social Media & Bulletin Poster Cards */}
      {activeTab === 'poster' && (
        <div className="space-y-8">
          {selectedSchedules.map((schedule, wIdx) => (
            <div
              key={schedule.id || wIdx}
              className="backdrop-blur-3xl bg-gradient-to-br from-[#10241A] via-[#0A1811] to-[#040C08] p-8 md:p-10 rounded-3xl text-white shadow-2xl border border-amber-400/30 space-y-8 relative overflow-hidden"
            >
              {/* Ambient Liturgical Glow Orbs */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

              {/* Poster Header */}
              <div className="text-center space-y-3 relative z-10">
                <div className="w-16 h-16 rounded-full mx-auto shadow-lg shadow-amber-400/20 border border-amber-300 p-1 flex items-center justify-center bg-black">
                  <ParishLogo className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/90 block">
                  {schedule.paroki}
                </span>
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                  {schedule.judul}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-white">
                  <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                    {schedule.periode}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                    <span>🌿 Hias Altar:</span>
                    <span className="text-white font-semibold">{schedule.hiasAltar && schedule.hiasAltar !== '— (Belum Ditugaskan)' ? schedule.hiasAltar : 'Belum Ditugaskan'}</span>
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    🟢 Warna: {schedule.warnaLiturgi}
                  </span>
                </div>
              </div>

              {/* 3 Mass Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
                {schedule.sessions.map((sess, idx) => (
                  <div
                    key={idx}
                    className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/15 space-y-4 hover:border-amber-400/50 transition-colors"
                  >
                    <div className="border-b border-white/15 pb-3">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                        {sess.nama}
                      </span>
                      <div className="text-sm font-bold text-white mt-0.5">{sess.waktu}</div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-amber-300 font-bold uppercase block">
                          🎵 Paduan Suara & Musik
                        </span>
                        <div className="font-bold text-white mt-0.5">{sess.koor}</div>
                        <div className="text-[11px] text-white/80 mt-0.5">Org: {sess.organis}</div>
                      </div>

                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-amber-300 font-bold uppercase block">
                          📖 Lektor & Mazmur
                        </span>
                        <div className="font-medium text-white">{sess.lektor.join(', ')}</div>
                        <div className="text-[11px] text-white/80 mt-1">Mazmur: {sess.pemazmur.join(', ')}</div>
                      </div>

                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-amber-300 font-bold uppercase block">
                          🕯️ Misdinar & Prodiakon
                        </span>
                        <div className="text-[11px] text-white/90 leading-relaxed">
                          {sess.misdinar.slice(0, 4).join(', ')}
                        </div>
                        <div className="text-[11px] text-amber-200/90 mt-1">
                          Prodiakon: {sess.prodiakon.join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex justify-between text-[11px] text-white/60">
                      <span>Tatib: {sess.tatib}</span>
                      <span>{schedule.status === 'FINAL' ? '✓ Resmi' : '• Draft'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center text-xs text-white/60 pt-4 border-t border-white/10 relative z-10">
                Diterbitkan oleh Tim Liturgi Paroki Hati Tak Bernoda Santa Perawan Maria Boyolali • Berkah Dalem (Pekan {wIdx + 1} dari {selectedSchedules.length})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODE 3: WhatsApp Formatted Text */}
      {activeTab === 'whatsapp' && (
        <Card className="p-6 md:p-8 bg-white rounded-3xl border border-surface-muted shadow-lg space-y-5">
          <div className="flex justify-between items-center pb-4 border-b border-surface-muted">
            <div>
              <h3 className="font-display font-bold text-xl text-ink">
                Format Teks Siap Kirim ke WhatsApp ({selectedSchedules.length} Pekan)
              </h3>
              <p className="text-xs text-ink-soft">
                Teks telah disusun dengan rapi menggunakan format bold dan emoji untuk grup WA lingkungan & petugas.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleCopyWhatsApp}
              className="rounded-2xl font-bold shadow-md spring-press bg-[#022C12] text-white hover:bg-emerald-950"
            >
              {copied ? '✓ Berhasil Disalin!' : '📋 Salin Teks'}
            </Button>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={16}
              value={generateWhatsAppText()}
              className="w-full p-4 rounded-2xl bg-surface font-mono text-xs text-ink leading-relaxed border border-surface-muted focus:outline-none select-all"
            />
          </div>
        </Card>
      )}
    </div>
  );
}