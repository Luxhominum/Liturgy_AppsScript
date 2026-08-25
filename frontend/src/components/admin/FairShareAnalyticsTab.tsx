import { useState, useMemo } from 'react';
import { Card, Badge, Chip } from '../ui';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import { LINGKUNGAN_TO_WILAYAH } from '../../data/lingkunganWilayahMap';

interface FairShareAnalyticsTabProps {
  weekends: any[];
}

const ALL_WILAYAHS = [
  'MARIA ASSUMPTA',
  'MARIA BUNDA ALLAH',
  'MARIA CARMEL',
  'MARIA CORDIS',
  'MARIA IMMACULATA',
  'MARIA LOURDES',
  'MARIA MATER DEI',
  'MARIA MATER DOLOROSA',
  'MARIA RATU',
  'MARIA RATU ROSARI',
  'MARIA TAK BERNODA',
  'BRAYAT MINULYA',
];

export default function FairShareAnalyticsTab({ weekends }: FairShareAnalyticsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'komunitas' | 'petugas'>('komunitas');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('SEMUA');
  const [searchOfficerTerm, setSearchOfficerTerm] = useState<string>('');
  const [selectedWilayahFilter, setSelectedWilayahFilter] = useState<string>('SEMUA');

  // Filter only valid weekends (Draft & Final, excluding deleted)
  const validWeekends = useMemo(() => {
    return weekends.filter((w) => w && w.id && w.status !== 'DELETED');
  }, [weekends]);

  // Aggregate Community Assignments (Koor, Hias Altar, Tatib)
  const communityAnalytics = useMemo(() => {
    const choirByWilayah: Record<string, { count: number; lastDate: string; weekends: string[] }> = {};
    const altarByWilayah: Record<string, { count: number; lastDate: string; weekends: string[] }> = {};
    const tatibByLingkungan: Record<string, { count: number; lastDate: string; weekends: string[] }> = {};

    ALL_WILAYAHS.forEach((w) => {
      choirByWilayah[w] = { count: 0, lastDate: '-', weekends: [] };
      altarByWilayah[w] = { count: 0, lastDate: '-', weekends: [] };
    });

    Object.keys(LINGKUNGAN_TO_WILAYAH).forEach((lingk) => {
      tatibByLingkungan[lingk] = { count: 0, lastDate: '-', weekends: [] };
    });

    let totalChoirCount = 0;
    let totalAltarCount = 0;
    let totalTatibCount = 0;

    validWeekends.forEach((w) => {
      const commList = w.communityAssignments || [];
      const wDate = w.tanggal_acuan || w.id.replace('w-', '');

      commList.forEach((c: any) => {
        if (c.status === 'REMOVED') return;

        // 1. Paduan Suara (Choir)
        if (c.jenis_penugasan === 'PADUAN_SUARA') {
          let wil = (c.wilayah_id || '').toUpperCase().trim();
          if (!wil && c.lingkungan_id) {
            wil = (LINGKUNGAN_TO_WILAYAH[c.lingkungan_id.toUpperCase()] || '').toUpperCase();
          }
          if (wil) {
            if (!choirByWilayah[wil]) {
              choirByWilayah[wil] = { count: 0, lastDate: '-', weekends: [] };
            }
            choirByWilayah[wil].count += 1;
            choirByWilayah[wil].weekends.push(wDate);
            choirByWilayah[wil].lastDate = wDate;
            totalChoirCount += 1;
          }
        }

        // 2. Hias Altar
        if (c.jenis_penugasan === 'HIAS_ALTAR') {
          let wil = (c.wilayah_id || '').toUpperCase().trim();
          if (!wil && c.lingkungan_id) {
            wil = (LINGKUNGAN_TO_WILAYAH[c.lingkungan_id.toUpperCase()] || '').toUpperCase();
          }
          if (wil) {
            if (!altarByWilayah[wil]) {
              altarByWilayah[wil] = { count: 0, lastDate: '-', weekends: [] };
            }
            altarByWilayah[wil].count += 1;
            altarByWilayah[wil].weekends.push(wDate);
            altarByWilayah[wil].lastDate = wDate;
            totalAltarCount += 1;
          }
        }

        // 3. Tatib (Tata Tertib)
        if (c.jenis_penugasan === 'TATIB') {
          const lingk = (c.lingkungan_id || '').toUpperCase().trim();
          if (lingk) {
            if (!tatibByLingkungan[lingk]) {
              tatibByLingkungan[lingk] = { count: 0, lastDate: '-', weekends: [] };
            }
            tatibByLingkungan[lingk].count += 1;
            tatibByLingkungan[lingk].weekends.push(wDate);
            tatibByLingkungan[lingk].lastDate = wDate;
            totalTatibCount += 1;
          }
        }
      });
    });

    return {
      choirByWilayah,
      altarByWilayah,
      tatibByLingkungan,
      totalChoirCount,
      totalAltarCount,
      totalTatibCount,
    };
  }, [validWeekends]);

  // Aggregate Individual Officer Duty Frequency
  const officerAnalytics = useMemo(() => {
    const officerDutyMap: Record<
      string,
      {
        nama: string;
        lingkungan: string;
        wilayah: string;
        roles: string[];
        totalTugas: number;
        roleBreakdown: Record<string, number>;
        history: { date: string; sessionName: string; roleName: string }[];
      }
    > = {};

    REAL_OFFICERS_DATA.forEach((o) => {
      const roles: string[] = [];
      if (o.organis) roles.push('Organis');
      if (o.mazmur) roles.push('Pemazmur');
      if (o.lektor) roles.push('Lektor');
      if (o.misdinar) roles.push('Misdinar');
      if (o.prodiakon) roles.push('Prodiakon');

      officerDutyMap[o.nama] = {
        nama: o.nama,
        lingkungan: o.lingkungan,
        wilayah: o.wilayah,
        roles,
        totalTugas: 0,
        roleBreakdown: {
          Organis: 0,
          Pemazmur: 0,
          Lektor: 0,
          Misdinar: 0,
          Prodiakon: 0,
        },
        history: [],
      };
    });

    validWeekends.forEach((w) => {
      const asgList = w.assignments || [];
      const wDate = w.tanggal_acuan || w.id.replace('w-', '');
      const sessions = w.sessions || [];

      asgList.forEach((a: any) => {
        if (a.status === 'REMOVED') return;

        const personId = a.person_id || a.nama || '';
        const officerEntry = officerDutyMap[personId];
        if (officerEntry) {
          officerEntry.totalTugas += 1;

          let roleKey = 'Lainnya';
          if (a.role_id === 'ROL-ORGANIS') roleKey = 'Organis';
          else if (a.role_id === 'ROL-PEMAZMUR') roleKey = 'Pemazmur';
          else if (a.role_id === 'ROL-LEKTOR') roleKey = 'Lektor';
          else if (a.role_id === 'ROL-MISDINAR') roleKey = 'Misdinar';
          else if (a.role_id === 'ROL-PRODIAKON') roleKey = 'Prodiakon';

          if (officerEntry.roleBreakdown[roleKey] !== undefined) {
            officerEntry.roleBreakdown[roleKey] += 1;
          }

          const matchedSession = sessions.find((s: any) => s.session_id === a.session_id);
          const sessionName = matchedSession?.nama_khusus || (matchedSession?.jenis_sesi === 'SABTU_SORE' ? 'Sabtu Sore' : 'Minggu Pagi');

          officerEntry.history.push({
            date: wDate,
            sessionName,
            roleName: roleKey,
          });
        }
      });
    });

    const officersList = Object.values(officerDutyMap);

    // Distribution classification
    const zeroDuty = officersList.filter((o) => o.totalTugas === 0);
    const lowDuty = officersList.filter((o) => o.totalTugas === 1 || o.totalTugas === 2);
    const highDuty = officersList.filter((o) => o.totalTugas >= 3);

    return {
      officersList,
      zeroDutyCount: zeroDuty.length,
      lowDutyCount: lowDuty.length,
      highDutyCount: highDuty.length,
      totalOfficers: officersList.length,
    };
  }, [validWeekends]);

  // Filtered Officers List
  const filteredOfficers = useMemo(() => {
    let list = [...officerAnalytics.officersList];

    // Search query
    if (searchOfficerTerm.trim()) {
      const q = searchOfficerTerm.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.nama.toLowerCase().includes(q) ||
          o.lingkungan.toLowerCase().includes(q) ||
          o.wilayah.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (selectedRoleFilter !== 'SEMUA') {
      list = list.filter((o) => o.roles.includes(selectedRoleFilter));
    }

    // Wilayah filter
    if (selectedWilayahFilter !== 'SEMUA') {
      list = list.filter((o) => o.wilayah.toUpperCase() === selectedWilayahFilter.toUpperCase());
    }

    // Sort by total tugas descending, then name
    list.sort((a, b) => b.totalTugas - a.totalTugas || a.nama.localeCompare(b.nama));
    return list;
  }, [officerAnalytics.officersList, searchOfficerTerm, selectedRoleFilter, selectedWilayahFilter]);

  return (
    <div className="space-y-6">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <span>📅</span> Akhir Pekan Terjadwal
          </span>
          <div className="text-2xl font-bold font-display text-ink">
            {validWeekends.length} <span className="text-xs font-normal text-ink-soft">Pekan Liturgi</span>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <span>👥</span> Total Petugas Terdaftar
          </span>
          <div className="text-2xl font-bold font-display text-ink">
            {officerAnalytics.totalOfficers} <span className="text-xs font-normal text-ink-soft">Orang</span>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <span>💤</span> Belum Bertugas
          </span>
          <div className="text-2xl font-bold font-display text-amber-700">
            {officerAnalytics.zeroDutyCount} <span className="text-xs font-normal text-ink-soft">Petugas (0x)</span>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <span>🔥</span> Paling Sering Bertugas
          </span>
          <div className="text-2xl font-bold font-display text-emerald-900">
            {officerAnalytics.highDutyCount} <span className="text-xs font-normal text-ink-soft">Petugas (≥3x)</span>
          </div>
        </Card>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex bg-surface-muted/60 p-1.5 rounded-2xl border border-surface-muted max-w-md gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('komunitas')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'komunitas'
              ? 'bg-white text-ink shadow-xs'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          🏛️ Rotasi Komunitas (Koor, Tatib, Altar)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('petugas')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'petugas'
              ? 'bg-white text-ink shadow-xs'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          👤 Pemerataan Petugas (172 Orang)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ROTASI KOMUNITAS (KOOR, TATIB, HIAS ALTAR) */}
      {/* ========================================================================= */}
      {activeSubTab === 'komunitas' && (
        <div className="space-y-6">
          {/* Grid 2 Kolom: Koor & Hias Altar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Rotasi Paduan Suara per Wilayah */}
            <Card className="p-6 bg-white rounded-3xl border border-surface-muted shadow-xs space-y-4">
              <div className="flex justify-between items-start pb-3 border-b border-surface-muted">
                <div>
                  <h3 className="font-bold text-base font-display text-ink flex items-center gap-2">
                    <span>🎵</span>
                    <span>Rotasi Paduan Suara (Koor) per Wilayah</span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Total {communityAnalytics.totalChoirCount} penugasan Koor di seluruh sesi misa.
                  </p>
                </div>
                <Badge variant="draft" className="text-[10px] font-mono">
                  6 Wilayah
                </Badge>
              </div>

              <div className="space-y-3">
                {ALL_WILAYAHS.map((wil) => {
                  const data = communityAnalytics.choirByWilayah[wil] || { count: 0, lastDate: '-' };
                  const maxCount = Math.max(...Object.values(communityAnalytics.choirByWilayah).map((v) => v.count), 1);
                  const pct = Math.round((data.count / maxCount) * 100);

                  return (
                    <div key={wil} className="space-y-1.5 p-3 rounded-2xl bg-surface/50 border border-surface-muted/60">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-ink">Wilayah {wil}</span>
                        <span className="font-mono font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                          {data.count} Kali Bertugas
                        </span>
                      </div>
                      {/* Visual Bar */}
                      <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#022C12] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, data.count > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-soft pt-0.5">
                        <span>Terakhir bertugas: {data.lastDate !== '-' ? data.lastDate : 'Belum pernah'}</span>
                        <span>{data.count === 0 ? '⚠️ Belum Ada Giliran' : '✓ Aktif'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 2. Rotasi Hias Altar per Wilayah */}
            <Card className="p-6 bg-white rounded-3xl border border-surface-muted shadow-xs space-y-4">
              <div className="flex justify-between items-start pb-3 border-b border-surface-muted">
                <div>
                  <h3 className="font-bold text-base font-display text-ink flex items-center gap-2">
                    <span>🌿</span>
                    <span>Rotasi Hias Altar per Wilayah (Pekan)</span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    1 Wilayah bertanggung jawab merias Altar selama 1 akhir pekan penuh.
                  </p>
                </div>
                <Badge variant="draft" className="text-[10px] font-mono">
                  1 Wilayah / Pekan
                </Badge>
              </div>

              <div className="space-y-3">
                {ALL_WILAYAHS.map((wil) => {
                  const data = communityAnalytics.altarByWilayah[wil] || { count: 0, lastDate: '-' };
                  const maxCount = Math.max(...Object.values(communityAnalytics.altarByWilayah).map((v) => v.count), 1);
                  const pct = Math.round((data.count / maxCount) * 100);

                  return (
                    <div key={wil} className="space-y-1.5 p-3 rounded-2xl bg-surface/50 border border-surface-muted/60">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-ink">Wilayah {wil}</span>
                        <span className="font-mono font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300">
                          {data.count} Kali Hias Altar
                        </span>
                      </div>
                      {/* Visual Bar */}
                      <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-700 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, data.count > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-soft pt-0.5">
                        <span>Terakhir: {data.lastDate !== '-' ? data.lastDate : 'Belum pernah'}</span>
                        <span>{data.count === 0 ? '⚠️ Belum Ada Giliran' : '✓ Pernah Bertugas'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* 3. Rotasi Tata Tertib (Tatib) per 35 Lingkungan */}
          <Card className="p-6 bg-white rounded-3xl border border-surface-muted shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-surface-muted">
              <div>
                <h3 className="font-bold text-base font-display text-ink flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Distribusi Tugas Tata Tertib (Tatib) — 35 Lingkungan</span>
                </h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Memastikan setiap lingkungan mendapatkan giliran menjaga ketertiban perayaan Ekaristi secara adil.
                </p>
              </div>
              <Badge variant="complete" className="text-xs">
                {communityAnalytics.totalTatibCount} Penugasan Tatib Terisi
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.keys(LINGKUNGAN_TO_WILAYAH).map((lingk) => {
                const wil = LINGKUNGAN_TO_WILAYAH[lingk];
                const data = communityAnalytics.tatibByLingkungan[lingk] || { count: 0, lastDate: '-' };

                return (
                  <div
                    key={lingk}
                    className={`p-3 rounded-2xl border transition-all space-y-1.5 ${
                      data.count > 0
                        ? 'bg-white border-emerald-200 shadow-2xs'
                        : 'bg-surface/50 border-surface-muted/80 opacity-75'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-ink leading-tight">
                        Lingk. {lingk}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          data.count > 0
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-surface-muted text-ink-soft'
                        }`}
                      >
                        {data.count}x
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-soft">
                      Wilayah {wil}
                    </div>
                    <div className="text-[9px] text-ink-soft pt-1 border-t border-surface-muted/60 flex justify-between">
                      <span>Terakhir:</span>
                      <span className="font-semibold">{data.lastDate !== '-' ? data.lastDate : 'Belum'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PEMERATAAN PETUGAS PERORANGAN (172 ORANG) */}
      {/* ========================================================================= */}
      {activeSubTab === 'petugas' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <Card className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Search */}
              <div className="sm:col-span-6 relative">
                <input
                  type="text"
                  placeholder="Cari nama petugas, lingkungan, atau wilayah..."
                  value={searchOfficerTerm}
                  onChange={(e) => setSearchOfficerTerm(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-surface-muted text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#022C12]"
                />
                <span className="absolute left-3.5 top-3 text-sm text-ink-soft">
                  🔍
                </span>
              </div>

              {/* Role Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface border border-surface-muted text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#022C12]"
                >
                  <option value="SEMUA">Semua Peran</option>
                  <option value="Lektor">📖 Lektor</option>
                  <option value="Pemazmur">🎤 Pemazmur</option>
                  <option value="Misdinar">🕯️ Misdinar</option>
                  <option value="Prodiakon">🍷 Prodiakon</option>
                  <option value="Organis">🎹 Organis</option>
                </select>
              </div>

              {/* Wilayah Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedWilayahFilter}
                  onChange={(e) => setSelectedWilayahFilter(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface border border-surface-muted text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#022C12]"
                >
                  <option value="SEMUA">Semua Wilayah</option>
                  {ALL_WILAYAHS.map((w) => (
                    <option key={w} value={w}>
                      Wilayah {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Officer Frequency Table */}
          <Card className="p-0 bg-white rounded-3xl border border-surface-muted shadow-xs overflow-hidden">
            <div className="p-4 bg-surface/60 border-b border-surface-muted flex justify-between items-center text-xs">
              <span className="font-bold text-ink">
                Menampilkan {filteredOfficers.length} Petugas Liturgi
              </span>
              <span className="text-ink-soft">
                Urutan: Beban Tugas Terbanyak ➔ Sedikit
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface/40 border-b border-surface-muted font-bold text-ink-soft uppercase text-[10px] tracking-wider">
                    <th className="p-3.5 pl-5">Nama Petugas</th>
                    <th className="p-3.5">Lingkungan & Wilayah</th>
                    <th className="p-3.5">Kualifikasi Peran</th>
                    <th className="p-3.5 text-center">Total Tugas</th>
                    <th className="p-3.5">Rincian Peran Bertugas</th>
                    <th className="p-3.5 pr-5">Status Beban</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted text-xs">
                  {filteredOfficers.map((officer, idx) => (
                    <tr key={idx} className="hover:bg-surface/40 transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-ink">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#022C12]/10 text-[#022C12] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {officer.nama.charAt(0)}
                          </div>
                          <span>{officer.nama}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-ink-soft">
                        Lingk. {officer.lingkungan} <br />
                        <span className="text-[10px] opacity-80">Wil. {officer.wilayah}</span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {officer.roles.map((r) => (
                            <Chip key={r} className="text-[9px] py-0.5 px-2 bg-surface border border-surface-muted font-bold">
                              {r}
                            </Chip>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`font-mono font-bold px-2.5 py-1 rounded-full text-xs ${
                            officer.totalTugas === 0
                              ? 'bg-surface-muted text-ink-soft'
                              : officer.totalTugas >= 3
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                              : 'bg-blue-50 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {officer.totalTugas}x
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-ink-soft">
                        {officer.totalTugas > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(officer.roleBreakdown)
                              .filter(([_, count]) => count > 0)
                              .map(([role, count]) => (
                                <span key={role} className="text-[10px] font-medium text-ink bg-surface px-1.5 py-0.5 rounded border border-surface-muted">
                                  {role}: <strong>{count}x</strong>
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-ink-soft italic text-[11px]">— Belum bertugas</span>
                        )}
                      </td>
                      <td className="p-3.5 pr-5">
                        {officer.totalTugas >= 3 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Beban Tinggi
                          </span>
                        ) : officer.totalTugas > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            Proporsional
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-muted text-ink-soft">
                            Tersedia
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
