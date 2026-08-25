/**
 * Triggers a browser file download of CSV data with UTF-8 BOM
 * ensuring Microsoft Excel opens it correctly without character encoding issues.
 */
export function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportOfficersListCsv(officers: Array<{
  person_id: string;
  nama: string;
  namaWilayah?: string;
  namaLingkungan?: string;
  peranList?: string[];
  aktif: boolean;
}>) {
  const headers = ['ID Petugas', 'Nama Lengkap', 'Wilayah', 'Lingkungan', 'Peran yang Dimiliki', 'Status'];
  const rows = officers.map((o) => [
    o.person_id,
    `"${o.nama.replace(/"/g, '""')}"`,
    `"${(o.namaWilayah || '').replace(/"/g, '""')}"`,
    `"${(o.namaLingkungan || '').replace(/"/g, '""')}"`,
    `"${(o.peranList || []).join(', ')}"`,
    o.aktif ? 'Aktif' : 'Nonaktif'
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsvFile(`Daftar_Petugas_Liturgi_${dateStr}.csv`, csvContent);
}

export function exportScheduleCsv(periode: string, rows: Array<{
  tanggal: string;
  misa: string;
  koor: string;
  altar: string;
  tatib: string;
  tugas: string;
  nama: string;
  wilayah: string;
}>) {
  const headers = ['Tanggal', 'Misa', 'Koor (Paduan Suara)', 'Hias Altar', 'Tatib', 'Tugas', 'Petugas', 'Asal Wilayah'];
  const dataRows = rows.map((r) => [
    `"${r.tanggal}"`,
    `"${r.misa}"`,
    `"${r.koor}"`,
    `"${r.altar}"`,
    `"${r.tatib}"`,
    `"${r.tugas}"`,
    `"${r.nama}"`,
    `"${r.wilayah}"`
  ]);

  const csvContent = [
    `"JADWAL PETUGAS LITURGI GEREJA KATOLIK"`,
    `"Periode: ${periode}"`,
    '',
    headers.join(','),
    ...dataRows.map((r) => r.join(','))
  ].join('\r\n');

  downloadCsvFile(`Jadwal_Liturgi_${periode.replace(/\s+/g, '_')}.csv`, csvContent);
}