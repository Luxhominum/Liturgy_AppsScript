import { useState, useMemo } from 'react';
import { Card, Button, Input, Select, Badge, Chip, Dialog } from '../ui';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import { LINGKUNGAN_TO_WILAYAH } from '../../data/lingkunganWilayahMap';
import { useAuth } from '../../context/AuthContext';
import OfficerProfileDrawer from './OfficerProfileDrawer';
import ImportExportModal from './ImportExportModal';
import type { Person, RoleConfig } from '../../types';

const INITIAL_PEOPLE: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[] = REAL_OFFICERS_DATA.map((o, idx) => {
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

const INITIAL_WILAYAHS = Array.from(new Set(Object.values(LINGKUNGAN_TO_WILAYAH))).sort();

const ALL_ROLES: RoleConfig[] = [
  { role_id: 'ROL-ORGANIS', nama_peran: 'Organis', jumlah_dibutuhkan: 1, jumlah_maksimal: 1, aktif: true, urutan: 1 },
  { role_id: 'ROL-PEMAZMUR', nama_peran: 'Pemazmur', jumlah_dibutuhkan: 2, jumlah_maksimal: 2, aktif: true, urutan: 2 },
  { role_id: 'ROL-LEKTOR', nama_peran: 'Lektor', jumlah_dibutuhkan: 3, jumlah_maksimal: 3, aktif: true, urutan: 3 },
  { role_id: 'ROL-MISDINAR', nama_peran: 'Misdinar', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 4 },
  { role_id: 'ROL-PRODIAKON', nama_peran: 'Prodiakon', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 5 },
];

export default function ManageOfficersTab() {
  const { user } = useAuth();
  const isEditable = Boolean(user && user.role !== 'VIEWER');

  const [activeSubTab, setActiveSubTab] = useState<'PETUGAS' | 'WILAYAH' | 'LINGKUNGAN'>('PETUGAS');
  const [people, setPeople] = useState(INITIAL_PEOPLE);
  const [wilayahList, setWilayahList] = useState<string[]>(INITIAL_WILAYAHS);
  const [lingkunganMap, setLingkunganMap] = useState<Record<string, string>>(LINGKUNGAN_TO_WILAYAH);

  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('SEMUA');
  const [selectedLingkungan, setSelectedLingkungan] = useState('SEMUA');
  const [selectedWilayah, setSelectedWilayah] = useState('SEMUA');

  // Complete list of all Lingkungan in the parish
  const allParishLingkungan = useMemo(() => {
    return Array.from(
      new Set([
        ...Object.keys(lingkunganMap),
        ...people.map((o) => o.namaLingkungan?.toUpperCase() || o.lingkungan_id?.toUpperCase())
      ])
    ).filter(Boolean).sort() as string[];
  }, [lingkunganMap, people]);

  // Complete list of all Wilayah in the parish
  const allParishWilayah = useMemo(() => {
    return Array.from(
      new Set([
        ...wilayahList,
        ...Object.values(lingkunganMap),
        ...people.map((o) => o.namaWilayah?.toUpperCase())
      ])
    ).filter(Boolean).sort() as string[];
  }, [wilayahList, lingkunganMap, people]);

  // Wilayah summary statistics
  const wilayahStats = useMemo(() => {
    return allParishWilayah.map((wilName) => {
      const lingList = Object.entries(lingkunganMap)
        .filter(([, w]) => w.toUpperCase() === wilName.toUpperCase())
        .map(([l]) => l);

      const officersInWilayah = people.filter((p) => {
        const pWil = p.namaWilayah?.toUpperCase() || lingkunganMap[p.namaLingkungan?.toUpperCase() || '']?.toUpperCase();
        return pWil === wilName.toUpperCase();
      });

      const roleCounts: Record<string, number> = {
        Organis: 0,
        Pemazmur: 0,
        Lektor: 0,
        Misdinar: 0,
        Prodiakon: 0,
      };

      officersInWilayah.forEach((p) => {
        (p.peranList || []).forEach((r) => {
          if (roleCounts[r] !== undefined) {
            roleCounts[r]++;
          }
        });
      });

      return {
        nama: wilName,
        lingkunganList: lingList,
        totalLingkungan: lingList.length,
        totalPetugas: officersInWilayah.length,
        petugasAktif: officersInWilayah.filter((p) => p.aktif).length,
        roleCounts,
      };
    });
  }, [allParishWilayah, lingkunganMap, people]);

  // Lingkungan summary statistics
  const lingkunganStats = useMemo(() => {
    return allParishLingkungan.map((lingName) => {
      const wilName = lingkunganMap[lingName.toUpperCase()] || 'MARIA RATU';
      const officersInLing = people.filter(
        (p) => (p.namaLingkungan?.toUpperCase() || p.lingkungan_id?.toUpperCase()) === lingName.toUpperCase()
      );

      const roleCounts: Record<string, number> = {
        Organis: 0,
        Pemazmur: 0,
        Lektor: 0,
        Misdinar: 0,
        Prodiakon: 0,
      };

      officersInLing.forEach((p) => {
        (p.peranList || []).forEach((r) => {
          if (roleCounts[r] !== undefined) {
            roleCounts[r]++;
          }
        });
      });

      return {
        nama: lingName,
        wilayah: wilName,
        totalPetugas: officersInLing.length,
        petugasAktif: officersInLing.filter((p) => p.aktif).length,
        roleCounts,
      };
    });
  }, [allParishLingkungan, lingkunganMap, people]);

  // Modals & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddWilayahModalOpen, setIsAddWilayahModalOpen] = useState(false);
  const [isAddLingkunganModalOpen, setIsAddLingkunganModalOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  const [selectedDrawerPerson, setSelectedDrawerPerson] = useState<(typeof INITIAL_PEOPLE)[0] | null>(null);
  const [editingPerson, setEditingPerson] = useState<(typeof INITIAL_PEOPLE)[0] | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newLingkungan, setNewLingkungan] = useState(allParishLingkungan[0] || 'TIMOTIUS');
  const [newWilayahName, setNewWilayahName] = useState('');
  const [newLingkunganNameInput, setNewLingkunganNameInput] = useState('');
  const [newLingkunganWilayah, setNewLingkunganWilayah] = useState(allParishWilayah[0] || 'MARIA RATU');

  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.nama.toLowerCase().includes(q) ||
      (p.namaLingkungan && p.namaLingkungan.toLowerCase().includes(q)) ||
      (p.namaWilayah && p.namaWilayah.toLowerCase().includes(q));

    const matchRole =
      selectedRoleFilter === 'SEMUA' ||
      (selectedRoleFilter === 'AKTIF' && p.aktif) ||
      (selectedRoleFilter === 'NONAKTIF' && !p.aktif) ||
      (p.peranList && p.peranList.includes(selectedRoleFilter));

    const matchLingkungan =
      selectedLingkungan === 'SEMUA' ||
      p.namaLingkungan?.toUpperCase() === selectedLingkungan;

    const matchWilayah =
      selectedWilayah === 'SEMUA' ||
      p.namaWilayah?.toUpperCase() === selectedWilayah;

    return matchSearch && matchRole && matchLingkungan && matchWilayah;
  });

  // --- CRUD PETUGAS ---
  const handleAddPerson = () => {
    if (!newName.trim()) return;
    const wil = lingkunganMap[newLingkungan.toUpperCase()] || 'MARIA RATU';
    const newPerson = {
      person_id: `PER-${String(people.length + 1).padStart(3, '0')}`,
      nama: newName.trim(),
      lingkungan_id: newLingkungan,
      namaLingkungan: newLingkungan,
      namaWilayah: wil,
      aktif: true,
      peranList: []
    };
    setPeople([newPerson, ...people]);
    setNewName('');
    setIsAddModalOpen(false);
  };

  const handleDeletePerson = (personId: string) => {
    const target = people.find((p) => p.person_id === personId);
    if (!target) return;
    if (confirm(`Apakah Anda yakin ingin menghapus petugas "${target.nama}" secara permanen?`)) {
      setPeople((prev) => prev.filter((p) => p.person_id !== personId));
      if (selectedDrawerPerson?.person_id === personId) {
        setSelectedDrawerPerson(null);
      }
    }
  };

  const handleToggleActive = (personId: string) => {
    setPeople(
      people.map((p) => (p.person_id === personId ? { ...p, aktif: !p.aktif } : p))
    );
    if (selectedDrawerPerson && selectedDrawerPerson.person_id === personId) {
      setSelectedDrawerPerson((prev) => (prev ? { ...prev, aktif: !prev.aktif } : null));
    }
  };

  const handleToggleRoleForPerson = (roleName: string) => {
    if (!editingPerson) return;
    const currentRoles = editingPerson.peranList || [];
    const updatedRoles = currentRoles.includes(roleName)
      ? currentRoles.filter((r) => r !== roleName)
      : [...currentRoles, roleName];

    const updatedPerson = { ...editingPerson, peranList: updatedRoles };
    setEditingPerson(updatedPerson);
    setPeople(people.map((p) => (p.person_id === updatedPerson.person_id ? updatedPerson : p)));

    if (selectedDrawerPerson && selectedDrawerPerson.person_id === updatedPerson.person_id) {
      setSelectedDrawerPerson(updatedPerson);
    }
  };

  // --- CRUD WILAYAH ---
  const handleAddWilayah = () => {
    const trimmed = newWilayahName.trim().toUpperCase();
    if (!trimmed) return;
    if (allParishWilayah.includes(trimmed)) {
      alert(`Wilayah "${trimmed}" sudah terdaftar!`);
      return;
    }
    setWilayahList((prev) => [...prev, trimmed].sort());
    setNewWilayahName('');
    setIsAddWilayahModalOpen(false);
  };

  const handleDeleteWilayah = (wilName: string) => {
    // Safety check: Lingkungan
    const assignedLingkungan = Object.entries(lingkunganMap)
      .filter(([, w]) => w.toUpperCase() === wilName.toUpperCase())
      .map(([l]) => l);

    if (assignedLingkungan.length > 0) {
      alert(
        `⛔ Tidak dapat menghapus Wilayah ${wilName}!\n\nMasih ada ${assignedLingkungan.length} Lingkungan terdaftar di bawah wilayah ini:\n• ${assignedLingkungan.join(', ')}\n\nSilakan hapus atau pindahkan lingkungan-lingkungan tersebut terlebih dahulu.`
      );
      return;
    }

    // Safety check: Petugas
    const assignedOfficers = people.filter(
      (p) => p.namaWilayah?.toUpperCase() === wilName.toUpperCase()
    );

    if (assignedOfficers.length > 0) {
      alert(
        `⛔ Tidak dapat menghapus Wilayah ${wilName}!\n\nMasih ada ${assignedOfficers.length} petugas liturgi terdaftar di bawah wilayah ini.\nSilakan pindahkan lingkungan petugas tersebut terlebih dahulu.`
      );
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus Wilayah "${wilName}" secara permanen?`)) {
      setWilayahList((prev) => prev.filter((w) => w.toUpperCase() !== wilName.toUpperCase()));
    }
  };

  // --- CRUD LINGKUNGAN ---
  const handleAddLingkungan = () => {
    const trimmedLing = newLingkunganNameInput.trim().toUpperCase();
    if (!trimmedLing) return;
    if (lingkunganMap[trimmedLing]) {
      alert(`Lingkungan "${trimmedLing}" sudah terdaftar di bawah Wilayah ${lingkunganMap[trimmedLing]}!`);
      return;
    }
    setLingkunganMap((prev) => ({ ...prev, [trimmedLing]: newLingkunganWilayah }));
    setNewLingkunganNameInput('');
    setIsAddLingkunganModalOpen(false);
  };

  const handleDeleteLingkungan = (lingName: string) => {
    // Safety check: Petugas
    const assignedOfficers = people.filter(
      (p) => (p.namaLingkungan?.toUpperCase() || p.lingkungan_id?.toUpperCase()) === lingName.toUpperCase()
    );

    if (assignedOfficers.length > 0) {
      alert(
        `⛔ Tidak dapat menghapus Lingkungan ${lingName}!\n\nMasih ada ${assignedOfficers.length} petugas liturgi terdaftar di lingkungan ini:\n• ${assignedOfficers.map((p) => p.nama).slice(0, 5).join(', ')}${assignedOfficers.length > 5 ? ' dan lainnya...' : ''}\n\nSilakan pindahkan atau hapus petugas tersebut terlebih dahulu.`
      );
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus Lingkungan "${lingName}" secara permanen?`)) {
      setLingkunganMap((prev) => {
        const updated = { ...prev };
        delete updated[lingName.toUpperCase()];
        return updated;
      });
    }
  };

  const handleImportPeople = (newPeople: any[]) => {
    setPeople([...newPeople, ...people]);
  };

  const handleFilterByWilayahInPetugas = (wilName: string) => {
    setSelectedWilayah(wilName);
    setSelectedLingkungan('SEMUA');
    setActiveSubTab('PETUGAS');
  };

  const handleFilterByLingkunganInPetugas = (lingName: string) => {
    setSelectedLingkungan(lingName);
    setSelectedWilayah('SEMUA');
    setActiveSubTab('PETUGAS');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Stat Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">
            Master Data & Pengelolaan Liturgi
          </h1>
          <p className="text-sm text-ink-soft">
            Pusat data resmi paroki: <strong>{people.length} Petugas</strong> • <strong>{allParishLingkungan.length} Lingkungan</strong> • <strong>{allParishWilayah.length} Wilayah</strong>.
          </p>
        </div>
        {isEditable ? (
          <div className="flex flex-wrap gap-2">
            {activeSubTab === 'PETUGAS' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsImportExportOpen(true)}
                  className="rounded-2xl font-bold shadow-xs spring-press"
                >
                  📊 Impor / Ekspor Excel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsAddModalOpen(true)}
                  className="rounded-2xl font-bold shadow-md shadow-accent/25 spring-press"
                >
                  + Tambah Petugas
                </Button>
              </>
            )}

            {activeSubTab === 'WILAYAH' && (
              <Button
                variant="primary"
                onClick={() => setIsAddWilayahModalOpen(true)}
                className="rounded-2xl font-bold shadow-md shadow-accent/25 spring-press"
              >
                + Tambah Wilayah Baru
              </Button>
            )}

            {activeSubTab === 'LINGKUNGAN' && (
              <Button
                variant="primary"
                onClick={() => setIsAddLingkunganModalOpen(true)}
                className="rounded-2xl font-bold shadow-md shadow-accent/25 spring-press"
              >
                + Tambah Lingkungan Baru
              </Button>
            )}
          </div>
        ) : (
          <div className="px-3.5 py-1.5 rounded-full bg-surface text-ink-soft text-xs font-bold border border-surface-muted flex items-center gap-1.5 shadow-2xs">
            <span>👁️</span>
            <span>Mode Baca (Viewer)</span>
          </div>
        )}
      </div>

      {/* 3-Tier Navigation Subtabs */}
      <div className="flex bg-surface-muted/60 p-1.5 rounded-2xl border border-surface-muted gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('PETUGAS')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'PETUGAS'
              ? 'bg-ink text-accent shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-white/50'
          }`}
        >
          <span>👤</span>
          <span>Daftar Petugas ({people.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('WILAYAH')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'WILAYAH'
              ? 'bg-ink text-accent shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-white/50'
          }`}
        >
          <span>🏛️</span>
          <span>Struktur Wilayah ({allParishWilayah.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('LINGKUNGAN')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'LINGKUNGAN'
              ? 'bg-ink text-accent shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-white/50'
          }`}
        >
          <span>🏘️</span>
          <span>Daftar Lingkungan ({allParishLingkungan.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: DAFTAR PETUGAS */}
      {activeSubTab === 'PETUGAS' && (
        <Card className="backdrop-blur-3xl bg-white/80 p-6 rounded-3xl border border-white/90 shadow-xl">
          {/* Search & Filter Bar */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <Input
                  label="Cari Petugas / Lingkungan"
                  placeholder="Ketik nama petugas, nama lingkungan, atau wilayah..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-bold uppercase text-ink-soft mb-1 block">
                  Filter Wilayah
                </label>
                <select
                  value={selectedWilayah}
                  onChange={(e) => setSelectedWilayah(e.target.value)}
                  className="w-full h-11 rounded-lg border border-surface-muted bg-surface px-3 text-xs font-bold text-ink focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="SEMUA">Semua Wilayah ({allParishWilayah.length})</option>
                  {allParishWilayah.map((opt) => (
                    <option key={opt} value={opt}>
                      Wilayah {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-bold uppercase text-ink-soft mb-1 block">
                  Filter Lingkungan
                </label>
                <select
                  value={selectedLingkungan}
                  onChange={(e) => setSelectedLingkungan(e.target.value)}
                  className="w-full h-11 rounded-lg border border-surface-muted bg-surface px-3 text-xs font-bold text-ink focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="SEMUA">Semua Lingkungan ({allParishLingkungan.length})</option>
                  {allParishLingkungan.map((opt) => (
                    <option key={opt} value={opt}>
                      Lingkungan {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Pill Filters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs font-bold text-ink-soft uppercase mr-2">Filter Peran:</span>
              {['SEMUA', 'AKTIF', 'NONAKTIF', 'Lektor', 'Misdinar', 'Prodiakon', 'Organis', 'Pemazmur'].map((r) => {
                const isSelected = selectedRoleFilter === r;
                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRoleFilter(r)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer spring-press ${
                      isSelected
                        ? 'bg-ink text-white shadow-xs'
                        : 'bg-surface text-ink-soft hover:bg-surface-muted hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
              {(selectedLingkungan !== 'SEMUA' || selectedWilayah !== 'SEMUA') && (
                <button
                  onClick={() => {
                    setSelectedLingkungan('SEMUA');
                    setSelectedWilayah('SEMUA');
                  }}
                  className="ml-auto text-xs text-danger font-bold hover:underline cursor-pointer"
                >
                  Reset Filter Wilayah/Lingkungan
                </button>
              )}
            </div>
          </div>

          {/* Officers Table */}
          <div className="overflow-x-auto rounded-2xl border border-surface-muted/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/80 text-ink-soft text-xs uppercase font-bold tracking-wider border-b border-surface-muted">
                <tr>
                  <th className="py-3.5 px-4">Nama Petugas</th>
                  <th className="py-3.5 px-4">Lingkungan</th>
                  <th className="py-3.5 px-4">Wilayah</th>
                  <th className="py-3.5 px-4">Kelayakan Peran</th>
                  <th className="py-3.5 px-4">Status</th>
                  {isEditable && <th className="py-3.5 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted/60">
                {filteredPeople.length > 0 ? (
                  filteredPeople.map((person) => (
                    <tr
                      key={person.person_id}
                      className="hover:bg-surface/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedDrawerPerson(person)}
                    >
                      <td className="py-3 px-4 font-bold text-ink flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-xs font-mono text-ink">
                          {person.nama.charAt(0)}
                        </div>
                        <span>{person.nama}</span>
                      </td>
                      <td className="py-3 px-4 text-ink-soft font-medium">
                        {person.namaLingkungan || person.lingkungan_id}
                      </td>
                      <td className="py-3 px-4 text-ink-soft text-xs font-semibold">
                        {person.namaWilayah || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {person.peranList && person.peranList.length > 0 ? (
                            person.peranList.map((role) => (
                              <Chip key={role} className="text-[11px] py-0.5 px-2 bg-surface border border-surface-muted font-bold">
                                {role}
                              </Chip>
                            ))
                          ) : (
                            <span className="text-xs text-ink-soft italic">Belum ada peran</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={person.aktif ? 'complete' : 'draft'}>
                          {person.aktif ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      {isEditable && (
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPerson(person)}
                              className="h-8 px-2.5 text-xs font-bold hover:bg-white"
                            >
                              Kelola Peran
                            </Button>
                            <Button
                              variant={person.aktif ? 'secondary' : 'primary'}
                              size="sm"
                              onClick={() => handleToggleActive(person.person_id)}
                              className="h-8 px-2.5 text-xs font-bold"
                            >
                              {person.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeletePerson(person.person_id)}
                              className="h-8 px-2 text-xs font-bold"
                              title="Hapus Petugas Permanen"
                            >
                              🗑️
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isEditable ? 6 : 5} className="py-12 text-center text-ink-soft">
                      Tidak ada petugas yang cocok dengan pencarian atau filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* SUBTAB 2: STRUKTUR WILAYAH */}
      {activeSubTab === 'WILAYAH' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white/70 p-4 rounded-2xl border border-surface-muted">
            <div>
              <h3 className="text-base font-display font-bold text-ink">
                Kelola Seluruh {allParishWilayah.length} Wilayah Paroki
              </h3>
              <p className="text-xs text-ink-soft">
                {isEditable
                  ? 'Anda dapat menambah wilayah baru atau menghapus wilayah yang sudah tidak aktif (setelah lingkungan di dalamnya dipindahkan).'
                  : 'Struktur wilayah resmi paroki dan sebaran peran petugas liturgi.'}
              </p>
            </div>
            {isEditable && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddWilayahModalOpen(true)}
                className="rounded-xl font-bold"
              >
                + Tambah Wilayah
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wilayahStats.map((wil) => (
              <Card
                key={wil.nama}
                className="bg-white/85 backdrop-blur-2xl border border-white/90 rounded-3xl p-5 shadow-md hover:shadow-lg transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                        Wilayah Paroki
                      </span>
                      <h3 className="text-lg font-display font-bold text-ink">
                        {wil.nama}
                      </h3>
                    </div>
                    <Badge variant="complete">
                      {wil.totalPetugas} Petugas
                    </Badge>
                  </div>

                  {/* Lingkungan Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-ink-soft block">
                      Lingkungan Terdaftar ({wil.totalLingkungan}):
                    </span>
                    {wil.lingkunganList.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {wil.lingkunganList.map((ling) => (
                          <span
                            key={ling}
                            className="text-[11px] font-medium bg-surface px-2 py-0.5 rounded-md border border-surface-muted text-ink"
                          >
                            {ling}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-soft italic">Belum ada lingkungan di wilayah ini</span>
                    )}
                  </div>

                  {/* Roles Distribution */}
                  <div className="pt-2 border-t border-surface-muted/60 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                      Kekuatan Peran:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <div className="bg-surface/80 p-1.5 rounded-lg text-center">
                        <span className="text-ink-soft block text-[10px]">Lektor</span>
                        <span className="font-bold text-ink">{wil.roleCounts.Lektor}</span>
                      </div>
                      <div className="bg-surface/80 p-1.5 rounded-lg text-center">
                        <span className="text-ink-soft block text-[10px]">Misdinar</span>
                        <span className="font-bold text-ink">{wil.roleCounts.Misdinar}</span>
                      </div>
                      <div className="bg-surface/80 p-1.5 rounded-lg text-center">
                        <span className="text-ink-soft block text-[10px]">Prodiakon</span>
                        <span className="font-bold text-ink">{wil.roleCounts.Prodiakon}</span>
                      </div>
                      <div className="bg-surface/80 p-1.5 rounded-lg text-center">
                        <span className="text-ink-soft block text-[10px]">Organis</span>
                        <span className="font-bold text-ink">{wil.roleCounts.Organis}</span>
                      </div>
                      <div className="bg-surface/80 p-1.5 rounded-lg text-center col-span-2">
                        <span className="text-ink-soft block text-[10px]">Pemazmur</span>
                        <span className="font-bold text-ink">{wil.roleCounts.Pemazmur}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-surface-muted/60 mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleFilterByWilayahInPetugas(wil.nama)}
                    className="flex-1 text-xs font-bold rounded-xl"
                  >
                    🔍 Lihat {wil.totalPetugas} Petugas
                  </Button>
                  {isEditable && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteWilayah(wil.nama)}
                      className="text-xs font-bold rounded-xl px-3"
                      title={`Hapus Wilayah ${wil.nama}`}
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: DAFTAR LINGKUNGAN */}
      {activeSubTab === 'LINGKUNGAN' && (
        <Card className="backdrop-blur-3xl bg-white/80 p-6 rounded-3xl border border-white/90 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-surface-muted gap-2">
            <div>
              <h3 className="text-lg font-display font-bold text-ink">
                Daftar Seluruh {allParishLingkungan.length} Lingkungan Paroki
              </h3>
              <p className="text-xs text-ink-soft">
                {isEditable
                  ? 'Tabel master lingkungan beserta wilayah induk. Hapus lingkungan hanya diizinkan jika sudah tidak ada petugas terdaftar.'
                  : 'Daftar lingkungan paroki beserta rekapitulasi petugas dan kesiapan peran.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="complete">{allParishLingkungan.length} Lingkungan</Badge>
              {isEditable && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddLingkunganModalOpen(true)}
                  className="rounded-xl font-bold"
                >
                  + Tambah Lingkungan
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-surface-muted/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/80 text-ink-soft text-xs uppercase font-bold tracking-wider border-b border-surface-muted">
                <tr>
                  <th className="py-3.5 px-4">Nama Lingkungan</th>
                  <th className="py-3.5 px-4">Wilayah Induk</th>
                  <th className="py-3.5 px-4">Jumlah Petugas</th>
                  <th className="py-3.5 px-4">Kesiapan Peran (Lektor / Misdinar / Lainnya)</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted/60">
                {lingkunganStats.map((ling) => (
                  <tr key={ling.nama} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-ink flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-accent/20 text-ink flex items-center justify-center text-xs font-mono font-bold">
                        🏘️
                      </span>
                      <span>Lingkungan {ling.nama}</span>
                    </td>
                    <td className="py-3 px-4 text-ink-soft font-semibold text-xs">
                      {ling.wilayah}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={ling.totalPetugas > 0 ? 'complete' : 'draft'}>
                        {ling.totalPetugas} Petugas ({ling.petugasAktif} aktif)
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-soft">
                      <div className="flex gap-1.5">
                        <span className="bg-surface px-1.5 py-0.5 rounded border border-surface-muted">
                          Lektor: {ling.roleCounts.Lektor}
                        </span>
                        <span className="bg-surface px-1.5 py-0.5 rounded border border-surface-muted">
                          Misdinar: {ling.roleCounts.Misdinar}
                        </span>
                        <span className="bg-surface px-1.5 py-0.5 rounded border border-surface-muted">
                          Mazmur: {ling.roleCounts.Pemazmur}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFilterByLingkunganInPetugas(ling.nama)}
                          className="h-8 px-2.5 text-xs font-bold hover:bg-white"
                        >
                          🔍 Lihat Petugas
                        </Button>
                        {isEditable && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteLingkungan(ling.nama)}
                            className="h-8 px-2 text-xs font-bold"
                            title={`Hapus Lingkungan ${ling.nama}`}
                          >
                            🗑️
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Profile Drawer */}
      <OfficerProfileDrawer
        person={selectedDrawerPerson}
        onClose={() => setSelectedDrawerPerson(null)}
        onToggleActive={handleToggleActive}
        onOpenEditRoles={(p) => setEditingPerson(p)}
        onDeletePerson={handleDeletePerson}
        isEditable={isEditable}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        open={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        people={people}
        onImportPeople={handleImportPeople}
      />

      {/* Add Person Modal */}
      <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Tambah Petugas Baru">
        <div className="space-y-4">
          <Input
            label="Nama Lengkap Petugas"
            placeholder="Contoh: Yohanes Maria..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Select
            label={`Lingkungan Asal (${allParishLingkungan.length} Lingkungan)`}
            value={newLingkungan}
            onChange={(e) => setNewLingkungan(e.target.value)}
            options={allParishLingkungan.map((ling) => ({
              value: ling,
              label: `Lingkungan ${ling} (${lingkunganMap[ling] || 'Wilayah'})`
            }))}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddPerson} disabled={!newName.trim()}>
              Simpan Petugas
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Wilayah Modal */}
      <Dialog open={isAddWilayahModalOpen} onClose={() => setIsAddWilayahModalOpen(false)} title="Tambah Wilayah Baru">
        <div className="space-y-4">
          <Input
            label="Nama Wilayah"
            placeholder="Contoh: MARIA REGINA PACIS"
            value={newWilayahName}
            onChange={(e) => setNewWilayahName(e.target.value)}
          />
          <p className="text-xs text-ink-soft leading-relaxed">
            Setelah wilayah baru ditambahkan, Anda dapat mendaftarkan lingkungan-lingkungan baru di bawah wilayah ini.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsAddWilayahModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddWilayah} disabled={!newWilayahName.trim()}>
              Simpan Wilayah
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Lingkungan Modal */}
      <Dialog open={isAddLingkunganModalOpen} onClose={() => setIsAddLingkunganModalOpen(false)} title="Tambah Lingkungan Baru">
        <div className="space-y-4">
          <Input
            label="Nama Lingkungan"
            placeholder="Contoh: FRANSISKUS XAVERIUS"
            value={newLingkunganNameInput}
            onChange={(e) => setNewLingkunganNameInput(e.target.value)}
          />
          <Select
            label="Wilayah Induk"
            value={newLingkunganWilayah}
            onChange={(e) => setNewLingkunganWilayah(e.target.value)}
            options={allParishWilayah.map((w) => ({
              value: w,
              label: `Wilayah ${w}`
            }))}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsAddLingkunganModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddLingkungan} disabled={!newLingkunganNameInput.trim()}>
              Simpan Lingkungan
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Manage Roles Modal */}
      {editingPerson && (
        <Dialog open={!!editingPerson} onClose={() => setEditingPerson(null)} title={`Kelola Peran: ${editingPerson.nama}`}>
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Pilih peran-peran liturgi yang layak dan boleh dijalankan oleh petugas ini:
            </p>
            <div className="space-y-2 bg-surface p-3 rounded-xl border border-surface-muted">
              {ALL_ROLES.map((r) => {
                const hasRole = (editingPerson.peranList || []).includes(r.nama_peran);
                return (
                  <label key={r.role_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                    <span className="text-sm font-bold text-ink">{r.nama_peran}</span>
                    <input
                      type="checkbox"
                      checked={hasRole}
                      onChange={() => handleToggleRoleForPerson(r.nama_peran)}
                      className="w-4 h-4 rounded text-ink accent-ink"
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 border-t border-surface-muted">
              <Button variant="primary" onClick={() => setEditingPerson(null)}>
                Selesai
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

