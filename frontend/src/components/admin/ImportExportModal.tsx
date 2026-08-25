import { useState, type ChangeEvent } from 'react';
import { Dialog, Button } from '../ui';
import { exportOfficersListCsv } from '../../utils/exportUtils';
import type { Person } from '../../types';

interface ImportExportModalProps {
  open: boolean;
  onClose: () => void;
  people: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[];
  onImportPeople: (newPeople: any[]) => void;
}

export default function ImportExportModal({
  open,
  onClose,
  people,
  onImportPeople,
}: ImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState('');

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        
        if (lines.length <= 1) {
          setImportError('File CSV kosong atau tidak memiliki data.');
          return;
        }

        // Parse simple CSV
        const parsed: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols[0]) {
            parsed.push({
              person_id: `PER-IMP-${String(i).padStart(3, '0')}`,
              nama: cols[0],
              namaLingkungan: cols[1] || 'TIMOTIUS',
              namaWilayah: cols[2] || 'MARIA RATU',
              peranList: cols[3] ? cols[3].split(';').map((r) => r.trim()) : [],
              aktif: true,
            });
          }
        }

        setPreviewData(parsed);
      } catch (err: any) {
        setImportError(`Gagal membaca file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (previewData.length > 0) {
      onImportPeople(previewData);
      setPreviewData([]);
      setFileName('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Impor & Ekspor Data Master Petugas">
      <div className="space-y-5">
        {/* Tab Selector */}
        <div className="flex bg-surface p-1 rounded-2xl border border-surface-muted">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-ink shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            📥 Ekspor Data (CSV / Excel)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-ink shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            📤 Unggah / Impor File Baru
          </button>
        </div>

        {/* Export Tab Content */}
        {activeTab === 'export' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-950 flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
              📊
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-ink">
                Unduh Master Roster Petugas Liturgi
              </h3>
              <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1">
                Unduh seluruh {people.length} master data petugas paroki beserta lingkungan, wilayah, dan peran ke dalam format CSV / Excel spreadsheet.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => exportOfficersListCsv(people)}
                className="rounded-2xl font-bold px-6 shadow-md"
              >
                📥 Unduh Master File CSV ({people.length} Petugas)
              </Button>
            </div>
          </div>
        )}

        {/* Import Tab Content */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div className="p-5 border-2 border-dashed border-surface-muted hover:border-ink/40 rounded-3xl text-center bg-surface/40 transition-colors">
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white text-ink flex items-center justify-center text-xl mx-auto shadow-xs border border-surface-muted">
                  📁
                </div>
                <div className="text-xs font-bold text-ink">
                  {fileName ? `File Terpilih: ${fileName}` : 'Klik untuk pilih file .CSV'}
                </div>
                <div className="text-[11px] text-ink-soft">
                  Format kolom: Nama, Lingkungan, Wilayah, Peran (dipisah tanda ;)
                </div>
              </label>
            </div>

            {importError && (
              <div className="p-3 rounded-2xl bg-danger/10 text-danger text-xs font-bold">
                ⚠️ {importError}
              </div>
            )}

            {previewData.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-ink flex justify-between items-center">
                  <span>Pratinjau Data Impor ({previewData.length} Petugas)</span>
                  <span className="text-[10px] text-emerald-800 font-bold">✓ Valid</span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-surface-muted rounded-2xl bg-white text-xs divide-y divide-surface-muted">
                  {previewData.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between">
                      <div>
                        <strong className="text-ink">{p.nama}</strong>
                        <div className="text-[10px] text-ink-soft">
                          Lingkungan {p.namaLingkungan} • {p.namaWilayah}
                        </div>
                      </div>
                      <div className="text-[10px] text-ink-soft">
                        {p.peranList.join(', ') || 'Semua Peran'}
                      </div>
                    </div>
                  ))}
                  {previewData.length > 5 && (
                    <div className="p-2 text-center text-[10px] text-ink-soft italic">
                      + {previewData.length - 5} data lainnya...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
              <Button variant="secondary" onClick={onClose}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={previewData.length === 0}
                className="font-bold"
              >
                Konfirmasi Impor ({previewData.length} Petugas)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}