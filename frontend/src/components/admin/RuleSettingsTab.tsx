import { useState } from 'react';
import { Card, Badge } from '../ui';
import type { RuleConfig } from '../../types';

export const ALL_PRD_RULES: (RuleConfig & { deskripsi: string; catatanKhusus?: string })[] = [
  // --- TINGKAT WAJIB (BLOCK) ---
  {
    rule_id: 'BR-020',
    nama_aturan: 'Kelayakan Peran (Person Roles)',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Orang harus memiliki peran itu dalam daftar Person_Roles aktif sebelum bisa ditugaskan.'
  },
  {
    rule_id: 'BR-026',
    nama_aturan: 'Kapasitas Kuota Peran per Sesi',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Kuota peran per sesi tidak boleh dilewati (Organis: 1, Pemazmur: 2, Lektor: 3, Misdinar: 6, Prodiakon: 6).'
  },
  {
    rule_id: 'BR-030/031',
    nama_aturan: 'Larangan Tugas Ganda dalam Satu Akhir Pekan',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Orang yang sama dilarang bertugas lebih dari satu kali dalam satu akhir pekan penuh (sesi manapun).',
    catatanKhusus: 'Pengecualian khusus: Hanya peran Organis yang diizinkan bertugas di lebih dari 1 sesi dalam 1 akhir pekan.'
  },
  {
    rule_id: 'BR-032',
    nama_aturan: 'Larangan Bertugas di Akhir Pekan Berturut-turut',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Petugas dilarang bertugas di 2 akhir pekan berturut-turut (sebelum / sesudahnya).',
    catatanKhusus: 'Berlaku untuk SEMUA orang tanpa pengecualian, termasuk peran Organis.'
  },
  {
    rule_id: 'BR-013',
    nama_aturan: 'Keadilan Koor Paduan Suara (Wilayah)',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Wilayah Koor tidak boleh 2x dalam satu akhir pekan dan tidak boleh berturut-turut antar akhir pekan. Orang dari Wilayah yang sedang bertugas Koor dilarang mengisi peran individu lain di akhir pekan yang sama (kecuali Organis).'
  },
  {
    rule_id: 'BR-041',
    nama_aturan: 'Keadilan Tatib Lingkungan',
    tingkat: 'WAJIB',
    aktif: true,
    deskripsi: 'Lingkungan Tatib tidak boleh 2x seminggu dan tidak boleh berturut-turut antar akhir pekan. Wilayah dari Lingkungan Tatib tersebut tidak boleh sedang bertugas Paduan Suara di akhir pekan yang sama.'
  },

  // --- TINGKAT PERINGATAN (WARNING) ---
  {
    rule_id: 'BR-052',
    nama_aturan: 'Peringatan Tumpang Tindih Koor & Hias Altar',
    tingkat: 'PERINGATAN',
    aktif: true,
    deskripsi: 'Wilayah yang sama tidak boleh menjadi Koor Paduan Suara DAN Hias Altar di akhir pekan yang sama (peringatan dua arah).',
    catatanKhusus: 'Dapat dilanjutkan jika disetujui Admin dengan mengisi alasan override.'
  },

  // --- TINGKAT OTOMATIS (AUTO) ---
  {
    rule_id: 'BR-034',
    nama_aturan: 'Penghitungan Live Terakhir Bertugas',
    tingkat: 'OTOMATIS',
    aktif: true,
    deskripsi: 'Tanggal terakhir bertugas dihitung secara real-time dari riwayat penugasan, bukan disimpan statis.'
  },
  {
    rule_id: 'BR-027',
    nama_aturan: 'Saran Petugas Terlama (Least Recently Used / LRU)',
    tingkat: 'OTOMATIS',
    aktif: true,
    deskripsi: 'Sistem mengurutkan rekomendasi petugas berdasarkan siapa yang paling lama / belum pernah bertugas.'
  },
  {
    rule_id: 'BR-051',
    nama_aturan: 'Penugasan Hias Altar Tingkat Akhir Pekan',
    tingkat: 'OTOMATIS',
    aktif: true,
    deskripsi: 'Hias Altar ditugaskan satu kali per akhir pekan (berlaku untuk seluruh sesi misa pada akhir pekan tersebut).'
  },
  {
    rule_id: 'BR-062',
    nama_aturan: 'Status Kelengkapan Progres Peran (Checklist)',
    tingkat: 'OTOMATIS',
    aktif: true,
    deskripsi: 'Panel status otomatis menghitung rasio terisi / dibutuhkan untuk setiap peran pada setiap sesi misa.'
  }
];

export default function RuleSettingsTab() {
  const [rules, setRules] = useState(ALL_PRD_RULES);

  const handleToggleRule = (ruleId: string) => {
    setRules(
      rules.map((r) => {
        if (r.rule_id === ruleId) {
          if (r.tingkat === 'WAJIB') return r;
          return { ...r, aktif: !r.aktif };
        }
        return r;
      })
    );
  };

  const wajibCount = rules.filter((r) => r.tingkat === 'WAJIB').length;
  const warningCount = rules.filter((r) => r.tingkat === 'PERINGATAN').length;
  const autoCount = rules.filter((r) => r.tingkat === 'OTOMATIS').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Pengaturan Aturan Bisnis Liturgi</h1>
          <p className="text-sm text-ink-soft">
            Daftar lengkap seluruh 11 aturan baku paroki sesuai spesifikasi PRD & sistem VBA asli.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="bg-danger/10 text-danger px-3 py-1.5 rounded-lg">
            {wajibCount} WAJIB (Block)
          </span>
          <span className="bg-accent text-ink px-3 py-1.5 rounded-lg">
            {warningCount} PERINGATAN (Override)
          </span>
          <span className="bg-blue-soft text-ink px-3 py-1.5 rounded-lg">
            {autoCount} OTOMATIS (Sistem)
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => {
          const isWajib = rule.tingkat === 'WAJIB';

          return (
            <Card key={rule.rule_id} className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink text-base">{rule.rule_id}</span>
                    <span className="font-bold text-ink text-base">- {rule.nama_aturan}</span>
                    <Badge
                      variant={
                        rule.tingkat === 'WAJIB'
                          ? 'danger'
                          : rule.tingkat === 'PERINGATAN'
                          ? 'warning'
                          : 'complete'
                      }
                    >
                      {rule.tingkat}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-soft">{rule.deskripsi}</p>
                  {rule.catatanKhusus && (
                    <p className="text-xs text-ink font-medium bg-surface p-2 rounded-lg border border-surface-muted">
                      💡 <strong>Catatan:</strong> {rule.catatanKhusus}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 whitespace-nowrap">
                  {isWajib ? (
                    <span className="text-xs font-bold text-ink-soft bg-surface-muted px-3 py-1 rounded-full">
                      Terkunci (Wajib)
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer bg-surface px-3 py-1.5 rounded-lg border border-surface-muted hover:border-ink-soft transition-colors">
                      <input
                        type="checkbox"
                        checked={rule.aktif}
                        onChange={() => handleToggleRule(rule.rule_id)}
                        className="w-4 h-4 rounded text-ink accent-ink cursor-pointer"
                      />
                      {rule.aktif ? 'Aktif' : 'Nonaktif'}
                    </label>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}