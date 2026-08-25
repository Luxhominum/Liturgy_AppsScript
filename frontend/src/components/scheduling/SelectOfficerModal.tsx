import { useState, useMemo } from 'react';
import { Dialog, Button, Input, Badge } from '../ui';
import type { Person, RoleConfig, Assignment, CommunityAssignment } from '../../types';
import { getPersonQualifications, resolveWilayah, ROLE_ID_TO_NAME } from '../../utils/ruleValidator';

interface SelectOfficerModalProps {
  open: boolean;
  onClose: () => void;
  role: RoleConfig | null;
  sessionName: string;
  isSpecialSession?: boolean;
  currentAssignments: Assignment[];
  allWeekendAssignments: Assignment[];
  adjacentAssignments?: Assignment[];
  allWeekendCommunity: CommunityAssignment[];
  availablePeople: (Person & { lastAssignedAt?: string; namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[];
  onSave: (personIds: string[], overrideReason?: string) => Promise<void>;
  isAdmin: boolean;
}

const SPECIAL_WILAYAH = ['GRASIA', 'LUAR PAROKI', 'BECANBO', 'LAIN LAIN'];

const WILAYAH_CHIPS = [
  'SEMUA',
  'MARIA RATU',
  'MARIA CARMEL',
  'MARIA IMMACULATA',
  'BRAYAT MINULYA',
  'MARIA ASSUMPTA',
  'MARIA BUNDA ALLAH',
  'MARIA CORDIS',
  'MARIA LOURDES',
  'MARIA MATER DEI',
  'MARIA MATER DOLOROSA',
  'MARIA RATU ROSARI',
  'MARIA TAK BERNODA'
];

export default function SelectOfficerModal({
  open,
  onClose,
  role,
  sessionName,
  isSpecialSession = false,
  currentAssignments,
  allWeekendAssignments,
  adjacentAssignments = [],
  allWeekendCommunity,
  availablePeople,
  onSave,
  isAdmin: _isAdmin,
}: SelectOfficerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWilayahFilter, setSelectedWilayahFilter] = useState('SEMUA');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortByLru, setSortByLru] = useState(false);

  const currentRoleId = role?.role_id;
  const maxQuota = isSpecialSession ? 99 : (role?.jumlah_maksimal || 1);
  const currentCount = currentAssignments.filter((a) => a.role_id === currentRoleId).length;
  const remainingQuota = Math.max(0, maxQuota - currentCount);

  // Active Choir Wilayah in this weekend (with proper Lingkungan mapping)
  const choirWilayahInWeekend = useMemo(() => {
    const wilSet = new Set<string>();
    allWeekendCommunity
      .filter((c) => c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED')
      .forEach((c) => {
        const w = resolveWilayah(c.lingkungan_id, c.wilayah_id);
        if (w && !SPECIAL_WILAYAH.includes(w.toUpperCase())) {
          wilSet.add(w.toUpperCase());
        }
      });
    return wilSet;
  }, [allWeekendCommunity]);

  // Candidates Filter with full BR-xxx enforcement & Wilayah Pill Filter
  const filteredCandidates = useMemo(() => {
    if (!currentRoleId || !role) return [];
    const requiredPeran = ROLE_ID_TO_NAME[currentRoleId] || role.nama_peran;
    const isOrganis = currentRoleId === 'ROL-ORGANIS';

    let list = availablePeople.filter((p) => {
      // 0. Quick Wilayah Filter Pill
      if (selectedWilayahFilter !== 'SEMUA') {
        const pWil = resolveWilayah(p.namaLingkungan || p.lingkungan_id, p.namaWilayah);
        if (!pWil.toUpperCase().includes(selectedWilayahFilter.toUpperCase())) return false;
      }

      // 1. Search Query Filter
      const q = searchQuery.toLowerCase();
      const matchName = p.nama.toLowerCase().includes(q);
      const matchLingkungan = p.namaLingkungan ? p.namaLingkungan.toLowerCase().includes(q) : false;
      const matchWilayah = p.namaWilayah ? p.namaWilayah.toLowerCase().includes(q) : false;
      if (q && !matchName && !matchLingkungan && !matchWilayah) return false;

      // In special mass mode, no restriction blocks
      if (isSpecialSession) return true;

      // 2. BR-020: Kelayakan Peran (Robust fallback check)
      const qual = getPersonQualifications(p);
      const hasRole = qual.some((r) => r.toLowerCase().includes(requiredPeran.toLowerCase()));
      if (!hasRole) {
        return false;
      }

      // 3. BR-030/031: Strict 1x Assignment per Weekend (No double-booking, except Organis)
      if (!isOrganis) {
        const alreadyAssignedInWeekend = allWeekendAssignments.some((a) => {
          if (a.status === 'REMOVED') return false;
          const aId = (a.person_id || '').toLowerCase().trim();
          const pId = (p.person_id || '').toLowerCase().trim();
          const pName = (p.nama || '').toLowerCase().trim();
          return aId === pId || aId === pName;
        });
        if (alreadyAssignedInWeekend) {
          return false;
        }
      }

      // 4. BR-032: Larangan Tugas Berturut-turut dalam 2 Minggu (N-7 atau N+7)
      const alreadyAssignedInAdjacent = adjacentAssignments.some((a) => {
        if (a.status === 'REMOVED') return false;
        const aId = (a.person_id || '').toLowerCase().trim();
        const pId = (p.person_id || '').toLowerCase().trim();
        const pName = (p.nama || '').toLowerCase().trim();
        return aId === pId || aId === pName;
      });
      if (alreadyAssignedInAdjacent) {
        return false;
      }

      // 5. BR-013: Wilayah members of active Choir cannot take individual roles in this weekend (except Organis)
      if (!isOrganis) {
        const pWil = resolveWilayah(p.namaLingkungan || p.lingkungan_id, p.namaWilayah);
        if (pWil && choirWilayahInWeekend.has(pWil.toUpperCase())) {
          return false;
        }
      }

      return true;
    });

    if (sortByLru) {
      list = [...list].sort((a, b) => {
        const timeA = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
        const timeB = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
        return timeA - timeB;
      });
    }

    return list;
  }, [availablePeople, allWeekendAssignments, adjacentAssignments, choirWilayahInWeekend, currentRoleId, isSpecialSession, role, searchQuery, selectedWilayahFilter, sortByLru]);

  if (!open || !role) return null;

  const handleTogglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      setSelectedIds(selectedIds.filter((id) => id !== personId));
    } else {
      if (selectedIds.length < remainingQuota) {
        setSelectedIds([...selectedIds, personId]);
      }
    }
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsSubmitting(true);
      await onSave(selectedIds, overrideReason);
      setSelectedIds([]);
      setOverrideReason('');
      onClose();
    } catch (error) {
      console.error('Failed to assign officers:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Pilih ${role.nama_peran}`}>
      <div className="space-y-3.5 flex flex-col flex-1 min-h-0">
        {/* Special Session Banner */}
        {isSpecialSession && (
          <div className="p-2.5 bg-accent/30 text-ink rounded-xl border border-ink text-xs font-bold flex items-center gap-2">
            <span>✨ Mode Misa Khusus:</span>
            <span className="font-medium text-ink-soft">Bebas memilih petugas tanpa batasan kuota / peran.</span>
          </div>
        )}

        {/* Quota & Session Info */}
        <div className="flex items-center justify-between bg-surface/80 p-3 rounded-2xl border border-surface-muted text-sm">
          <div>
            <span className="text-ink-soft block text-[11px] font-medium">Sesi Misa</span>
            <span className="font-bold text-ink">{sessionName}</span>
          </div>
          <div className="text-right">
            <span className="text-ink-soft block text-[11px] font-medium">Sisa Kuota</span>
            <span className="font-bold text-ink font-mono">
              {isSpecialSession ? 'Bebas / Tanpa Batas' : `${remainingQuota - selectedIds.length} / ${role.jumlah_maksimal} tempat`}
            </span>
          </div>
        </div>

        {/* Quick Wilayah Horizontal Pill Filter */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
            Filter Cepat Wilayah:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {WILAYAH_CHIPS.map((wChip) => {
              const isSelected = selectedWilayahFilter === wChip;
              const shortName = wChip === 'SEMUA' ? 'Semua Wilayah' : wChip.replace('MARIA ', 'M. ');
              return (
                <button
                  key={wChip}
                  type="button"
                  onClick={() => setSelectedWilayahFilter(wChip)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-ink text-accent border-ink shadow-xs scale-[1.02]'
                      : 'bg-white/80 text-ink-soft border-surface-muted hover:bg-white hover:text-ink'
                  }`}
                >
                  {shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and LRU Toggle */}
        <div className="flex gap-2">
          <Input
            label={`Cari Petugas ${isSpecialSession ? '(Semua Petugas)' : `Khusus ${role.nama_peran}`}`}
            placeholder="Ketik nama, lingkungan, atau wilayah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setSortByLru(!sortByLru)}
              className={`h-11 min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                sortByLru
                  ? 'bg-accent text-ink border-ink shadow-xs'
                  : 'bg-white text-ink-soft border-surface-muted hover:bg-surface'
              }`}
              title="Urutkan berdasarkan yang paling lama/belum pernah bertugas"
            >
              ★ Saran LRU
            </button>
          </div>
        </div>

        <div className="text-xs text-ink-soft flex justify-between items-center px-1">
          <span>
            {isSpecialSession
              ? `Menampilkan ${filteredCandidates.length} petugas (Bebas Batasan)`
              : `Menampilkan ${filteredCandidates.length} kandidat siap tugas`}
          </span>
          {sortByLru && <span className="font-bold text-ink">Urutan: Paling lama bertugas</span>}
        </div>

        {/* Candidates List */}
        <div 
          data-lenis-prevent="true"
          className="flex-1 min-h-[250px] max-h-[46vh] overflow-y-auto overscroll-contain touch-pan-y space-y-2 pr-1 select-none"
        >
          {filteredCandidates.length === 0 ? (
            <p className="text-center py-6 text-sm text-ink-soft">
              Tidak ada kandidat petugas yang memenuhi kriteria kelayakan saat ini.
            </p>
          ) : (
            filteredCandidates.map((person) => {
              const isSelected = selectedIds.includes(person.person_id);
              const disabled = !isSelected && selectedIds.length >= remainingQuota;
              const initials = person.nama
                .split(' ')
                .slice(0, 2)
                .map((n) => n.charAt(0))
                .join('')
                .toUpperCase();

              return (
                <div
                  key={person.person_id}
                  onClick={() => !disabled && handleTogglePerson(person.person_id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/25 border-ink font-bold shadow-xs'
                      : disabled
                      ? 'opacity-40 border-surface-muted cursor-not-allowed bg-surface/50'
                      : 'bg-white/90 border-surface-muted/80 hover:border-ink/50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-ink focus:ring-accent accent-ink cursor-pointer"
                    />
                    <div className="w-7 h-7 rounded-full bg-ink text-accent flex items-center justify-center font-bold text-xs shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="text-ink text-sm font-medium">{person.nama}</div>
                      <div className="text-xs text-ink-soft">
                        {person.namaWilayah ? `${person.namaWilayah} — ` : ''}Lingkungan {person.namaLingkungan}
                        {person.peranList && (
                          <span className="ml-2 text-[10px] text-ink-soft font-mono bg-surface px-1.5 py-0.5 rounded border border-surface-muted">
                            {person.peranList.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {person.lastAssignedAt ? (
                      <span className="text-[11px] text-ink-soft">
                        Terakhir: {new Date(person.lastAssignedAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <Badge variant="success">Belum pernah</Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-surface-muted shrink-0 mt-auto">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={selectedIds.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Menyimpan...' : `Tugaskan (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}