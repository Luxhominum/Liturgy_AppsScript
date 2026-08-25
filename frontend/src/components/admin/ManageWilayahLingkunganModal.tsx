import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Dialog, Button } from '../ui';
import { LINGKUNGAN_TO_WILAYAH } from '../../data/lingkunganWilayahMap';

interface ManageWilayahLingkunganModalProps {
  open: boolean;
  onClose: () => void;
  onStructureChange?: (map: Record<string, string>) => void;
}

export default function ManageWilayahLingkunganModal({
  open,
  onClose,
  onStructureChange,
}: ManageWilayahLingkunganModalProps) {
  const [structure, setStructure] = useState<Record<string, string>>(LINGKUNGAN_TO_WILAYAH);
  const [newWilayahName, setNewWilayahName] = useState('');
  const [newLingkunganInputs, setNewLingkunganInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Subscribe to real-time Firestore parish structure
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'metadata', 'parish_structure'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.map) {
          setStructure(data.map);
          if (onStructureChange) onStructureChange(data.map);
        }
      } else {
        // Seed initial default structure
        setDoc(doc(db, 'metadata', 'parish_structure'), {
          map: LINGKUNGAN_TO_WILAYAH,
          updatedAt: new Date().toISOString(),
        }).catch(console.error);
      }
    });

    return () => unsub();
  }, []);

  // Compute grouped Wilayah -> Lingkungan[]
  const groupedWilayah = Object.entries(structure).reduce((acc, [lingkungan, wilayah]) => {
    const wUpper = wilayah.toUpperCase().trim();
    if (!acc[wUpper]) acc[wUpper] = [];
    if (!acc[wUpper].includes(lingkungan.toUpperCase().trim())) {
      acc[wUpper].push(lingkungan.toUpperCase().trim());
    }
    return acc;
  }, {} as Record<string, string[]>);

  // Sort wilayah and their lingkungans
  const sortedWilayahs = Object.keys(groupedWilayah).sort();

  const handleSaveToFirestore = async (newMap: Record<string, string>) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'metadata', 'parish_structure'), {
        map: newMap,
        updatedAt: new Date().toISOString(),
      });
      setStructure(newMap);
      if (onStructureChange) onStructureChange(newMap);
    } catch (err) {
      console.error('Failed to update parish structure:', err);
      alert('Gagal menyimpan perubahan ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add a brand new Wilayah
  const handleAddWilayah = async () => {
    const wName = newWilayahName.trim().toUpperCase();
    if (!wName) return;

    if (sortedWilayahs.includes(wName)) {
      alert('Wilayah dengan nama ini sudah ada!');
      return;
    }

    // Default with 1 placeholder Lingkungan or empty
    const defaultLingkungan = `${wName} 1`;
    const newMap = { ...structure, [defaultLingkungan]: wName };
    await handleSaveToFirestore(newMap);
    setNewWilayahName('');
  };

  // Delete an entire Wilayah and its Lingkungans
  const handleDeleteWilayah = async (wilayahName: string) => {
    const count = groupedWilayah[wilayahName]?.length || 0;
    if (
      confirm(
        `⚠️ Hapus Wilayah "${wilayahName}"?\n\nTindakan ini akan menghapus wilayah ini beserta ${count} lingkungan yang ada di dalamnya.`
      )
    ) {
      const newMap: Record<string, string> = {};
      Object.entries(structure).forEach(([l, w]) => {
        if (w.toUpperCase().trim() !== wilayahName.toUpperCase().trim()) {
          newMap[l] = w;
        }
      });
      await handleSaveToFirestore(newMap);
    }
  };

  // Add Lingkungan under a Wilayah
  const handleAddLingkungan = async (wilayahName: string) => {
    const lName = (newLingkunganInputs[wilayahName] || '').trim().toUpperCase();
    if (!lName) return;

    if (structure[lName]) {
      alert(`Lingkungan "${lName}" sudah terdaftar di Wilayah "${structure[lName]}"!`);
      return;
    }

    const newMap = { ...structure, [lName]: wilayahName.toUpperCase().trim() };
    await handleSaveToFirestore(newMap);
    setNewLingkunganInputs((prev) => ({ ...prev, [wilayahName]: '' }));
  };

  // Delete a specific Lingkungan
  const handleDeleteLingkungan = async (lingkunganName: string, wilayahName: string) => {
    if (confirm(`Hapus Lingkungan "${lingkunganName}" dari Wilayah "${wilayahName}"?`)) {
      const newMap = { ...structure };
      delete newMap[lingkunganName];
      await handleSaveToFirestore(newMap);
    }
  };

  // Filtered list
  const filteredWilayahs = sortedWilayahs.filter((w) => {
    const q = searchFilter.toLowerCase();
    if (!q) return true;
    if (w.toLowerCase().includes(q)) return true;
    const lingkungans = groupedWilayah[w] || [];
    return lingkungans.some((l) => l.toLowerCase().includes(q));
  });

  const totalLingkunganCount = Object.keys(structure).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="🏛️ Kelola Struktur Wilayah & Lingkungan Paroki"
    >
      <div className="space-y-6 pt-2 max-h-[75vh] overflow-y-auto pr-1">
        {/* Top Summary and Global Add Wilayah */}
        <div className="p-4 rounded-2xl bg-surface border border-surface-muted space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft block">
                Total Master Data
              </span>
              <span className="text-sm font-bold text-ink">
                {sortedWilayahs.length} Wilayah • {totalLingkunganCount} Lingkungan
              </span>
            </div>
          </div>

          {/* Add New Wilayah Row */}
          <div className="flex gap-2 pt-2 border-t border-surface-muted">
            <input
              type="text"
              placeholder="Ketik Nama Wilayah Baru (contoh: MARIA STELLA MARIS)..."
              value={newWilayahName}
              onChange={(e) => setNewWilayahName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWilayah()}
              className="flex-1 h-10 rounded-xl border border-surface-muted bg-white px-3 text-xs font-bold text-ink uppercase focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddWilayah}
              disabled={!newWilayahName.trim() || isSaving}
              className="h-10 px-4 font-bold text-xs shadow-xs spring-press"
            >
              + Tambah Wilayah
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div>
          <input
            type="text"
            placeholder="Cari nama wilayah atau lingkungan..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-surface-muted bg-surface px-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Wilayah Grid / Cards */}
        <div className="space-y-4">
          {filteredWilayahs.length > 0 ? (
            filteredWilayahs.map((wilayah) => {
              const lingkungans = groupedWilayah[wilayah] || [];
              const inputVal = newLingkunganInputs[wilayah] || '';

              return (
                <div
                  key={wilayah}
                  className="p-4 rounded-2xl bg-white border border-surface-muted shadow-2xs space-y-3"
                >
                  {/* Wilayah Card Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span className="font-display font-bold text-ink text-sm">
                        WILAYAH {wilayah}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-surface text-ink-soft px-2 py-0.5 rounded-full">
                        {lingkungans.length} Lingkungan
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWilayah(wilayah)}
                      disabled={isSaving}
                      className="text-[11px] font-bold text-danger hover:bg-danger/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Wilayah beserta lingkungannya"
                    >
                      🗑️ Hapus Wilayah
                    </button>
                  </div>

                  {/* Lingkungans Chips List */}
                  <div className="flex flex-wrap gap-2">
                    {lingkungans.map((lingkungan) => (
                      <div
                        key={lingkungan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-surface-muted/80 text-xs font-bold text-ink shadow-2xs group hover:border-ink/30 transition-all"
                      >
                        <span>{lingkungan}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLingkungan(lingkungan, wilayah)}
                          disabled={isSaving}
                          title={`Hapus ${lingkungan}`}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-ink-soft hover:text-danger hover:bg-danger/10 text-xs font-bold transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Lingkungan to this Wilayah Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder={`+ Tambah Lingkungan ke Wilayah ${wilayah}...`}
                      value={inputVal}
                      onChange={(e) =>
                        setNewLingkunganInputs((prev) => ({
                          ...prev,
                          [wilayah]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLingkungan(wilayah)}
                      className="flex-1 h-9 rounded-lg border border-surface-muted bg-surface/50 px-2.5 text-xs font-medium text-ink uppercase focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddLingkungan(wilayah)}
                      disabled={!inputVal.trim() || isSaving}
                      className="h-9 px-3 text-xs font-bold"
                    >
                      + Tambah
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-ink-soft">
              Tidak ada wilayah atau lingkungan yang cocok dengan pencarian.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-4 border-t border-surface-muted">
          <Button variant="primary" onClick={onClose} className="font-bold text-xs shadow-md">
            Selesai
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
