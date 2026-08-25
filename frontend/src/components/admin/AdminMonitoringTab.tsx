import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Button, Badge, Dialog } from '../ui';
import { finalizeWeekendApi } from '../../services/api';
import { runAutoAssignEngine } from '../../utils/autoAssignEngine';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import type { RoleConfig, Person } from '../../types';
import FairShareAnalyticsTab from './FairShareAnalyticsTab';

interface AdminMonitoringTabProps {
  onNavigateToSchedule: (weekendId: string) => void;
}

const DEFAULT_ROLES: RoleConfig[] = [
  { role_id: 'ROL-ORGANIS', nama_peran: 'Organis', jumlah_dibutuhkan: 1, jumlah_maksimal: 1, aktif: true, urutan: 1 },
  { role_id: 'ROL-PEMAZMUR', nama_peran: 'Pemazmur', jumlah_dibutuhkan: 2, jumlah_maksimal: 2, aktif: true, urutan: 2 },
  { role_id: 'ROL-LEKTOR', nama_peran: 'Lektor', jumlah_dibutuhkan: 3, jumlah_maksimal: 3, aktif: true, urutan: 3 },
  { role_id: 'ROL-MISDINAR', nama_peran: 'Misdinar', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 4 },
  { role_id: 'ROL-PRODIAKON', nama_peran: 'Prodiakon', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 5 },
];

const INITIAL_REAL_PEOPLE: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[] = REAL_OFFICERS_DATA.map((o, idx) => {
  const peranList: string[] = [];
  if (o.organis) peranList.push('Organis');
  if (o.mazmur) peranList.push('Pemazmur');
  if (o.lektor) peranList.push('Lektor');
  if (o.misdinar) peranList.push('Misdinar');
  if (o.prodiakon) peranList.push('Prodiakon');

  return {
    person_id: `PER-${String(idx + 1).padStart(3, '0')}`,
    nama: o.nama,
    lingkungan_id: o.lingkungan,
    namaLingkungan: o.lingkungan,
    namaWilayah: o.wilayah,
    aktif: true,
    peranList
  };
});

export default function AdminMonitoringTab({ onNavigateToSchedule }: AdminMonitoringTabProps) {
  const [adminSubTab, setAdminSubTab] = useState<'monitoring' | 'analisis'>('monitoring');
  const [weekends, setWeekends] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'READY' | 'FINAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [deletePromptWkd, setDeletePromptWkd] = useState<any | null>(null);
  const [finalizePromptWkd, setFinalizePromptWkd] = useState<any | null>(null);
  const [viewDetailsWkd, setViewDetailsWkd] = useState<any | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Subscribe to real Firestore weekends
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'weekends'), (snap) => {
      const list: any[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      // Sort chronologically
      list.sort((a, b) => (b.tanggal_acuan || '').localeCompare(a.tanggal_acuan || ''));
      setWeekends(list);
    });

    return () => unsub();
  }, []);

  // Compute stats across all weekends
  const computedWeekends = weekends.map((wkd) => {
    const sessions = wkd.sessions || [];
    const assignments = wkd.assignments || [];
    const communityAssignments = wkd.communityAssignments || [];

    let totalNeeded = 0;
    let totalFilled = 0;
    const missingWarnings: string[] = [];

    sessions.forEach((s: any) => {
      // Choir requirement
      totalNeeded += 1;
      const hasChoir = communityAssignments.some(
        (c: any) => c.session_id === s.session_id && c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED'
      );
      if (hasChoir) {
        totalFilled += 1;
      } else {
        missingWarnings.push(`Koor (${s.nama_khusus || s.jenis_sesi})`);
      }

      // Individual roles
      DEFAULT_ROLES.forEach((role) => {
        totalNeeded += role.jumlah_dibutuhkan;
        const filledRole = assignments.filter(
          (a: any) => a.session_id === s.session_id && a.role_id === role.role_id && a.status !== 'REMOVED'
        ).length;
        totalFilled += Math.min(filledRole, role.jumlah_dibutuhkan);

        if (filledRole < role.jumlah_dibutuhkan) {
          const diff = role.jumlah_dibutuhkan - filledRole;
          missingWarnings.push(`${diff} ${role.nama_peran} (${s.nama_khusus || s.jenis_sesi})`);
        }
      });
    });

    const percent = totalNeeded > 0 ? Math.round((totalFilled / totalNeeded) * 100) : 0;
    const isReadyToFinalize = percent === 100 && wkd.status !== 'FINAL';

    return {
      ...wkd,
      totalNeeded,
      totalFilled,
      percent,
      isReadyToFinalize,
      missingWarnings,
      sessionsCount: sessions.length,
    };
  });

  // Filtered list
  const filtered = computedWeekends.filter((wkd) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (wkd.nama_kegiatan || '').toLowerCase().includes(q) ||
      (wkd.tanggal_acuan || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (statusFilter === 'DRAFT') return wkd.status === 'DRAFT' && !wkd.isReadyToFinalize;
    if (statusFilter === 'READY') return wkd.isReadyToFinalize;
    if (statusFilter === 'FINAL') return wkd.status === 'FINAL';

    return true;
  });

  // Top Metrics
  const totalSchedules = computedWeekends.length;
  const readyToFinalizeCount = computedWeekends.filter((w) => w.isReadyToFinalize).length;
  const needAttentionCount = computedWeekends.filter((w) => w.status === 'DRAFT' && w.percent < 100).length;
  const totalFinalCount = computedWeekends.filter((w) => w.status === 'FINAL').length;

  // Quick Auto-Assign Handler from table
  const handleQuickAutoAssign = async (wkd: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(wkd.id);
    try {
      const res = runAutoAssignEngine({
        weekendId: wkd.id,
        sessions: wkd.sessions || [],
        roles: DEFAULT_ROLES,
        people: INITIAL_REAL_PEOPLE,
        existingAssignments: wkd.assignments || [],
        existingCommunityAssignments: wkd.communityAssignments || [],
      });

      await setDoc(
        doc(db, 'weekends', wkd.id),
        {
          assignments: res.assignments,
          communityAssignments: res.communityAssignments,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      alert(`✓ Berhasil mengisi otomatis jadwal ${wkd.nama_kegiatan}!`);
    } catch (err) {
      console.error('Quick auto-assign failed:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  const getWeekendDisplayTitle = (wkd: any) => {
    if (!wkd) return 'Jadwal Liturgi';
    if (wkd.nama_kegiatan && wkd.nama_kegiatan !== 'undefined') return wkd.nama_kegiatan;
    if (wkd.title && wkd.title !== 'undefined') return wkd.title;
    const targetDate = wkd.tanggal_acuan || (wkd.id ? wkd.id.replace('w-', '') : '');
    if (targetDate) {
      const lit = getLiturgicalInfo(targetDate);
      return `${lit.title} (${targetDate})`;
    }
    return 'Jadwal Liturgi Akhir Pekan';
  };

  const generateWhatsAppSummary = (wkd: any): string => {
    if (!wkd) return '';
    const title = getWeekendDisplayTitle(wkd);
    const targetDate = wkd.tanggal_acuan || (wkd.id ? wkd.id.replace('w-', '') : '');
    const dateObj = new Date(targetDate + 'T00:00:00');
    const dateFormatted = dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const sessions = wkd.sessions || [];
    const assignments = (wkd.assignments || []).filter((a: any) => a.status !== 'REMOVED');
    const communityAssignments = (wkd.communityAssignments || []).filter((c: any) => c.status !== 'REMOVED');

    const hiasAltar = communityAssignments.find((c: any) => c.jenis_penugasan === 'HIAS_ALTAR');

    let text = `*JADWAL PETUGAS LITURGI*\n*${title.toUpperCase()}*\n📅 ${dateFormatted}\nStatus: ${wkd.status === 'FINAL' ? 'RESMI (FINAL)' : 'DRAFT'} (Rev. ${wkd.revisi || 1})\n\n`;

    if (hiasAltar) {
      text += `🌿 *HIAS ALTAR (AKHIR PEKAN):* Wilayah ${hiasAltar.wilayah_id}\n\n`;
    }

    sessions.forEach((s: any, idx: number) => {
      const sName = s.nama_khusus || (s.jenis_sesi === 'SABTU_SORE' ? 'Sabtu Sore - 17.00 WIB' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Minggu Pagi - 07.00 WIB' : 'Minggu Sore - 17.00 WIB');
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `⛪ *MISA ${idx + 1}: ${sName.toUpperCase()}*\n`;

      const choir = communityAssignments.find((c: any) => c.session_id === s.session_id && c.jenis_penugasan === 'PADUAN_SUARA');
      if (choir) {
        text += `🎵 *Koor:* ${choir.lingkungan_id ? `Lingkungan ${choir.lingkungan_id}` : `Wilayah ${choir.wilayah_id}`}\n`;
      }

      const getRolePeople = (roleId: string) => {
        return assignments
          .filter((a: any) => a.session_id === s.session_id && a.role_id === roleId)
          .map((a: any) => {
            const p = INITIAL_REAL_PEOPLE.find((o) => o.person_id === a.person_id || o.nama === a.person_id);
            return p?.nama || a.person_id;
          });
      };

      const organis = getRolePeople('ROL-ORGANIS');
      if (organis.length > 0) text += `🎹 *Organis:* ${organis.join(', ')}\n`;

      const pemazmur = getRolePeople('ROL-PEMAZMUR');
      if (pemazmur.length > 0) text += `🎤 *Pemazmur:* ${pemazmur.join(', ')}\n`;

      const lektor = getRolePeople('ROL-LEKTOR');
      if (lektor.length > 0) text += `📖 *Lektor:* ${lektor.join(', ')}\n`;

      const misdinar = getRolePeople('ROL-MISDINAR');
      if (misdinar.length > 0) text += `🔔 *Misdinar:* ${misdinar.join(', ')}\n`;

      const prodiakon = getRolePeople('ROL-PRODIAKON');
      if (prodiakon.length > 0) text += `🍞 *Prodiakon:* ${prodiakon.join(', ')}\n`;

      const tatib = communityAssignments.find((c: any) => c.session_id === s.session_id && c.jenis_penugasan === 'TATIB');
      if (tatib) {
        text += `🕯️ *Tatib:* ${tatib.lingkungan_id ? `Lingkungan ${tatib.lingkungan_id}` : `Grup ${tatib.wilayah_id}`}\n`;
      }

      text += `\n`;
    });

    text += `_Paroki Maria Bunda Segala Bangsa_\n_Jadwal diterbitkan secara digital via Aplikasi Liturgi_`;
    return text;
  };

  // Quick Finalize Execution
  const confirmFinalizeSchedule = async () => {
    if (!finalizePromptWkd) return;
    const wkd = finalizePromptWkd;
    const title = getWeekendDisplayTitle(wkd);
    setIsProcessing(wkd.id);
    try {
      await finalizeWeekendApi({
        weekendId: wkd.id,
        expectedRevision: wkd.revisi || 1,
      });
      setFinalizePromptWkd(null);
      alert(`✓ Jadwal "${title}" berhasil difinalisasi resmi sebagai warta liturgi paroki!`);
    } catch (err) {
      console.error('Quick finalize failed:', err);
      alert('Gagal memfinalisasi jadwal. Pastikan koneksi internet stabil.');
    } finally {
      setIsProcessing(null);
    }
  };

  // Delete Schedule Execution
  const confirmDeleteSchedule = async () => {
    if (!deletePromptWkd) return;
    const wkd = deletePromptWkd;
    setIsProcessing(wkd.id);
    try {
      await deleteDoc(doc(db, 'weekends', wkd.id));
      setDeletePromptWkd(null);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-8 max-w-[94rem] mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink text-accent text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>🛡️</span>
            <span>Dashboard Koordinator Liturgi</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-ink tracking-tight">
            {adminSubTab === 'monitoring' ? 'Monitoring Progres Penjadwalan' : 'Analisis Pemerataan Pelayanan'}
          </h1>
          <p className="text-sm text-ink-soft">
            {adminSubTab === 'monitoring'
              ? 'Klik baris jadwal manapun untuk langsung membuka ruang kerja studio misa tersebut.'
              : 'Visibilitas rotasi giliran Koor, Tatib, Hias Altar, dan frekuensi tugas 172 petugas liturgi.'}
          </p>
        </div>

        {/* Sub-view Navigation Switcher */}
        <div className="flex bg-surface-muted/80 p-1.5 rounded-2xl border border-surface-muted gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setAdminSubTab('monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer spring-press ${
              adminSubTab === 'monitoring'
                ? 'bg-ink text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            📋 Monitoring ({computedWeekends.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('analisis')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer spring-press ${
              adminSubTab === 'analisis'
                ? 'bg-ink text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            📊 Analisis Pemerataan
          </button>
        </div>
      </div>

      {adminSubTab === 'analisis' ? (
        <FairShareAnalyticsTab weekends={weekends} />
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white/85 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft block">
                Total Jadwal Misa
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-display font-bold text-ink">{totalSchedules}</span>
                <span className="text-xs font-bold text-ink-soft">Jadwal</span>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent rounded-3xl border border-emerald-500/30 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block">
                🎉 Siap Difinalisasi
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-display font-bold text-emerald-950">{readyToFinalizeCount}</span>
                <span className="text-xs font-bold text-emerald-900">100% Lengkap</span>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent rounded-3xl border border-amber-500/30 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                ⚠️ Perlu Perhatian
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-display font-bold text-amber-950">{needAttentionCount}</span>
                <span className="text-xs font-bold text-amber-900">Belum Lengkap</span>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent rounded-3xl border border-blue-500/30 shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
                ✓ Warta Resmi (Final)
              </span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-display font-bold text-blue-950">{totalFinalCount}</span>
                <span className="text-xs font-bold text-blue-900">Jadwal Resmi</span>
              </div>
            </Card>
          </div>

      {/* Main Monitoring Table Card */}
      <Card className="p-6 bg-white/85 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-xl space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-surface-muted">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface rounded-2xl border border-surface-muted">
            {[
              { id: 'ALL', label: `Semua (${computedWeekends.length})` },
              { id: 'READY', label: `🎉 Siap Finalisasi (${readyToFinalizeCount})` },
              { id: 'DRAFT', label: `⚠️ Belum Lengkap (${needAttentionCount})` },
              { id: 'FINAL', label: `✓ Final (${totalFinalCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer spring-press ${
                  statusFilter === tab.id
                    ? 'bg-ink text-white shadow-xs'
                    : 'text-ink-soft hover:text-ink hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Cari tanggal atau perayaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 rounded-xl border border-surface-muted bg-surface px-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Schedule Matrix Table */}
        <div className="overflow-x-auto rounded-2xl border border-surface-muted">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface/80 text-ink-soft text-xs uppercase font-bold tracking-wider border-b border-surface-muted">
              <tr>
                <th className="py-3.5 px-4">Tanggal & Perayaan Ekaristi</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Kelengkapan Peran</th>
                <th className="py-3.5 px-4">Kekurangan Petugas</th>
                <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted">
              {filtered.length > 0 ? (
                filtered.map((wkd) => {
                  const dateObj = new Date(wkd.tanggal_acuan + 'T00:00:00');
                  const dateFormatted = dateObj.toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr
                      key={wkd.id}
                      onClick={() => onNavigateToSchedule(wkd.id)}
                      className="hover:bg-amber-500/5 transition-all cursor-pointer group"
                      title="Klik untuk membuka ruang kerja jadwal ini"
                    >
                      {/* Date & Title */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-ink font-display text-base flex items-center gap-2 group-hover:text-emerald-950 transition-colors">
                          <span>{wkd.nama_kegiatan}</span>
                          {wkd.is_special && (
                            <span className="text-[10px] font-mono bg-amber-500/20 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                              Misa Khusus
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-soft font-mono mt-0.5">
                          {dateFormatted} • {wkd.sessionsCount} Sesi Misa
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {wkd.status === 'FINAL' ? (
                          <Badge variant="complete">✓ Resmi</Badge>
                        ) : wkd.isReadyToFinalize ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-950 border border-emerald-500/30">
                            🎉 Siap Finalisasi
                          </span>
                        ) : (
                          <Badge variant="draft">• Draft ({wkd.percent}%)</Badge>
                        )}
                      </td>

                      {/* Fulfillment Progress */}
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-mono font-bold text-ink">
                            <span>{wkd.percent}%</span>
                            <span className="text-ink-soft">{wkd.totalFilled}/{wkd.totalNeeded} slot</span>
                          </div>
                          <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                wkd.percent === 100
                                  ? 'bg-emerald-600'
                                  : wkd.percent > 50
                                  ? 'bg-[#D4AF37]'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${wkd.percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Missing Roles Indicators */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {wkd.missingWarnings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {wkd.missingWarnings.slice(0, 3).map((warn: string, i: number) => (
                              <span
                                key={i}
                                className="text-[10px] font-medium bg-amber-500/10 text-amber-900 border border-amber-500/20 px-2 py-0.5 rounded-lg"
                              >
                                {warn}
                              </span>
                            ))}
                            {wkd.missingWarnings.length > 3 && (
                              <span className="text-[10px] text-ink-soft font-bold self-center">
                                +{wkd.missingWarnings.length - 3} lainnya
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                            <span>✓</span>
                            <span>Seluruh peran terisi</span>
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-2">
                          {/* View Assigned Officers Modal Trigger */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewDetailsWkd(wkd);
                            }}
                            className="h-8 px-2.5 text-xs font-bold bg-white hover:bg-surface border border-surface-muted text-ink shadow-2xs"
                          >
                            👁️ Lihat Petugas
                          </Button>

                          {/* Quick Auto Assign Button */}
                          {wkd.status !== 'FINAL' && wkd.percent < 100 && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isProcessing === wkd.id}
                              onClick={(e) => handleQuickAutoAssign(wkd, e)}
                              className="h-8 px-2.5 text-xs font-bold bg-[#022C12] text-white hover:bg-emerald-950 border border-[#D4AF37]/50"
                            >
                              ⚡ Auto-Assign
                            </Button>
                          )}

                          {/* Quick Finalize Button */}
                          {wkd.isReadyToFinalize && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isProcessing === wkd.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFinalizePromptWkd(wkd);
                              }}
                              className="h-8 px-2.5 text-xs font-bold bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs"
                            >
                              ✓ Finalisasi
                            </Button>
                          )}

                          {/* Open in Studio Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigateToSchedule(wkd.id)}
                            className="h-8 px-2.5 text-xs font-bold hover:bg-white"
                          >
                            Buka Studio ➔
                          </Button>

                          {/* Delete Schedule Button */}
                          <button
                            type="button"
                            disabled={isProcessing === wkd.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletePromptWkd(wkd);
                            }}
                            title="Hapus Jadwal"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-danger hover:bg-danger/10 border border-danger/20 transition-colors cursor-pointer spring-press text-xs"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-soft">
                    Tidak ada jadwal yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </>
      )}

      {/* ========================================================================= */}
      {/* IN-APP CONFIRMATION MODAL CARDS (NO BROWSER POPUPS) */}
      {/* ========================================================================= */}

      {/* 1. In-App Delete Confirmation Modal Card */}
      {deletePromptWkd && (
        <Dialog
          open={!!deletePromptWkd}
          onClose={() => setDeletePromptWkd(null)}
          title="⚠️ Hapus Jadwal Liturgi"
        >
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-danger/10 border border-danger/25 rounded-2xl text-xs space-y-2">
              <p className="font-semibold text-ink leading-relaxed">
                Apakah Anda yakin ingin menghapus jadwal{' '}
                <strong className="text-danger font-bold">
                  "{getWeekendDisplayTitle(deletePromptWkd)}"
                </strong>?
              </p>
              <p className="text-ink-soft">
                Seluruh data penugasan petugas, paduan suara, dan sesi misa terkait akan dihapus secara permanen dari database.
              </p>
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-surface-muted">
              <Button
                variant="secondary"
                onClick={() => setDeletePromptWkd(null)}
                disabled={isProcessing === deletePromptWkd.id}
                className="rounded-xl font-bold text-xs"
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeleteSchedule}
                disabled={isProcessing === deletePromptWkd.id}
                className="rounded-xl font-bold text-xs bg-danger text-white hover:bg-danger/90 shadow-md"
              >
                {isProcessing === deletePromptWkd.id ? '⏳ Menghapus...' : '🗑️ Ya, Hapus Jadwal'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 2. In-App Finalize Confirmation Modal Card */}
      {finalizePromptWkd && (
        <Dialog
          open={!!finalizePromptWkd}
          onClose={() => setFinalizePromptWkd(null)}
          title="✓ Finalisasi Jadwal Liturgi"
        >
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs space-y-2">
              <p className="font-semibold text-ink leading-relaxed">
                Finalisasi jadwal{' '}
                <strong className="text-emerald-950 font-bold">
                  "{getWeekendDisplayTitle(finalizePromptWkd)}"
                </strong>?
              </p>
              <p className="text-ink-soft">
                Jadwal ini akan berstatus <strong>RESMI (FINAL)</strong> dan diterbitkan sebagai warta liturgi resmi paroki.
              </p>
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-surface-muted">
              <Button
                variant="secondary"
                onClick={() => setFinalizePromptWkd(null)}
                disabled={isProcessing === finalizePromptWkd.id}
                className="rounded-xl font-bold text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={confirmFinalizeSchedule}
                disabled={isProcessing === finalizePromptWkd.id}
                className="rounded-xl font-bold text-xs bg-emerald-800 text-white hover:bg-emerald-900 shadow-md"
              >
                {isProcessing === finalizePromptWkd.id ? '⏳ Memproses...' : '✓ Ya, Terbitkan Resmi'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 3. Detailed Session Officers Modal Card */}
      {viewDetailsWkd && (() => {
        const title = getWeekendDisplayTitle(viewDetailsWkd);
        const targetDate = viewDetailsWkd.tanggal_acuan || (viewDetailsWkd.id ? viewDetailsWkd.id.replace('w-', '') : '');
        const dateObj = new Date(targetDate + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const sessions = viewDetailsWkd.sessions || [];
        const assignments = (viewDetailsWkd.assignments || []).filter((a: any) => a.status !== 'REMOVED');
        const communityAssignments = (viewDetailsWkd.communityAssignments || []).filter((c: any) => c.status !== 'REMOVED');
        const hiasAltar = communityAssignments.find((c: any) => c.jenis_penugasan === 'HIAS_ALTAR');

        const handleCopyWhatsApp = () => {
          const text = generateWhatsAppSummary(viewDetailsWkd);
          navigator.clipboard.writeText(text);
          setCopiedSuccess(true);
          setTimeout(() => setCopiedSuccess(false), 2500);
        };

        return (
          <Dialog
            open={!!viewDetailsWkd}
            onClose={() => setViewDetailsWkd(null)}
            title={`📋 Rincian Petugas: ${title}`}
          >
            <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1">
              {/* Header Info */}
              <div className="p-4 bg-surface rounded-2xl border border-surface-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                    {dateFormatted}
                  </div>
                  <div className="font-display font-bold text-lg text-ink">
                    {title}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={viewDetailsWkd.status === 'FINAL' ? 'complete' : 'draft'}>
                    {viewDetailsWkd.status === 'FINAL' ? '✓ Resmi (Final)' : 'Draft'}
                  </Badge>
                  <span className="text-xs font-mono text-ink-soft bg-white px-2.5 py-1 rounded-lg border border-surface-muted">
                    Revisi {viewDetailsWkd.revisi || 1}
                  </span>
                </div>
              </div>

              {/* Hias Altar Banner */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌿</span>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-emerald-950">
                      Hias Altar Akhir Pekan (1 Wilayah / Pekan)
                    </div>
                    <div className="text-xs font-semibold text-emerald-900">
                      {hiasAltar ? `Wilayah ${hiasAltar.wilayah_id}` : 'Belum ditugaskan'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300">
                  Tingkat Pekan
                </span>
              </div>

              {/* Session Cards Breakdown */}
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-xs text-ink-soft italic text-center py-4">Belum ada sesi misa terdaftar.</p>
                ) : (
                  sessions.map((s: any, idx: number) => {
                    const sName = s.nama_khusus || (s.jenis_sesi === 'SABTU_SORE' ? 'Sabtu Sore - 17.00 WIB' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Minggu Pagi - 07.00 WIB' : 'Minggu Sore - 17.00 WIB');
                    const choir = communityAssignments.find((c: any) => c.session_id === s.session_id && c.jenis_penugasan === 'PADUAN_SUARA');
                    const tatib = communityAssignments.find((c: any) => c.session_id === s.session_id && c.jenis_penugasan === 'TATIB');

                    const getRolePeople = (roleId: string) => {
                      return assignments
                        .filter((a: any) => a.session_id === s.session_id && a.role_id === roleId)
                        .map((a: any) => {
                          const p = INITIAL_REAL_PEOPLE.find((o) => o.person_id === a.person_id || o.nama === a.person_id);
                          return p?.nama || a.person_id;
                        });
                    };

                    const organis = getRolePeople('ROL-ORGANIS');
                    const pemazmur = getRolePeople('ROL-PEMAZMUR');
                    const lektor = getRolePeople('ROL-LEKTOR');
                    const misdinar = getRolePeople('ROL-MISDINAR');
                    const prodiakon = getRolePeople('ROL-PRODIAKON');

                    return (
                      <div key={s.session_id || idx} className="p-4 bg-white rounded-2xl border border-surface-muted shadow-xs space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
                          <h4 className="font-display font-bold text-sm text-ink flex items-center gap-2">
                            <span>⛪</span>
                            <span>{sName}</span>
                          </h4>
                          <span className="text-[10px] font-mono text-ink-soft bg-surface px-2 py-0.5 rounded-md">
                            Misa {idx + 1}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Koor & Musik */}
                          <div className="p-3 bg-surface rounded-xl space-y-1.5 border border-surface-muted/60">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-ink block mb-1">
                              🎵 Paduan Suara & Musik
                            </span>
                            <div className="text-ink">
                              <strong>Koor:</strong>{' '}
                              <span className="text-ink-soft">
                                {choir ? (choir.lingkungan_id ? `Lingkungan ${choir.lingkungan_id}` : `Wilayah ${choir.wilayah_id}`) : '—'}
                              </span>
                            </div>
                            <div className="text-ink">
                              <strong>Organis:</strong>{' '}
                              <span className="text-ink-soft">{organis.length > 0 ? organis.join(', ') : '—'}</span>
                            </div>
                            <div className="text-ink">
                              <strong>Pemazmur:</strong>{' '}
                              <span className="text-ink-soft">{pemazmur.length > 0 ? pemazmur.join(', ') : '—'}</span>
                            </div>
                          </div>

                          {/* Tata Tertib */}
                          <div className="p-3 bg-surface rounded-xl space-y-1.5 border border-surface-muted/60">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-ink block mb-1">
                              🕯️ Tata Tertib Misa
                            </span>
                            <div className="text-ink">
                              <strong>Tatib:</strong>{' '}
                              <span className="text-ink-soft">
                                {tatib ? (tatib.lingkungan_id ? `Lingkungan ${tatib.lingkungan_id}` : `Grup ${tatib.wilayah_id}`) : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Pelayan Sabda & Altar (Full Width) */}
                          <div className="md:col-span-2 p-3 bg-surface rounded-xl space-y-2 border border-surface-muted/60">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-ink block">
                              📖 Pelayan Sabda & Altar
                            </span>

                            <div className="space-y-1.5">
                              <div>
                                <span className="font-bold text-ink">Lektor ({lektor.length}):</span>{' '}
                                <span className="text-ink-soft">{lektor.length > 0 ? lektor.join(', ') : '—'}</span>
                              </div>
                              <div>
                                <span className="font-bold text-ink">Misdinar ({misdinar.length}):</span>{' '}
                                <span className="text-ink-soft">{misdinar.length > 0 ? misdinar.join(', ') : '—'}</span>
                              </div>
                              <div>
                                <span className="font-bold text-ink">Prodiakon ({prodiakon.length}):</span>{' '}
                                <span className="text-ink-soft">{prodiakon.length > 0 ? prodiakon.join(', ') : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-surface-muted">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyWhatsApp}
                  className="w-full sm:w-auto text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>{copiedSuccess ? '✓' : '📋'}</span>
                  <span>{copiedSuccess ? 'Teks Berhasil Disalin!' : 'Salin Format WhatsApp'}</span>
                </Button>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const id = viewDetailsWkd.id;
                      setViewDetailsWkd(null);
                      onNavigateToSchedule(id);
                    }}
                    className="w-full sm:w-auto text-xs font-bold bg-ink text-white hover:bg-ink-soft shadow-xs"
                  >
                    Buka di Studio ➔
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewDetailsWkd(null)}
                    className="w-full sm:w-auto text-xs font-bold"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          </Dialog>
        );
      })()}
    </div>
  );
}
