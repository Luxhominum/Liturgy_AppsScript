import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Badge, Input } from '../ui';
import type { AuditEntry } from '../../types';

export default function AuditLogsTab() {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<(AuditEntry & { detail?: string; overrideReason?: string })[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('waktu', 'desc'), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const liveLogs = snap.docs.map((d) => {
          const data = d.data();
          return {
            audit_id: d.id,
            waktu: data.waktu ? new Date(data.waktu.toDate ? data.waktu.toDate() : data.waktu).toLocaleString('id-ID') : new Date().toLocaleString('id-ID'),
            pelaku_id: data.pelaku_id || 'System',
            aksi: data.aksi || 'PERUBAHAN',
            jenis_entitas: data.jenis_entitas || 'Jadwal',
            entitas_id: data.entitas_id || '',
            detail: data.detail || '',
            overrideReason: data.overrideReason || ''
          };
        });
        setLogs(liveLogs);
      },
      (err) => {
        console.warn('[FIRESTORE] Audit logs notice:', err);
      }
    );

    return () => unsub();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const s = search.toLowerCase();
    return (
      log.aksi.toLowerCase().includes(s) ||
      log.pelaku_id.toLowerCase().includes(s) ||
      (log.detail && log.detail.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-ink">Riwayat Audit Perubahan</h1>
        <p className="text-sm text-ink-soft">
          Pencatatan seluruh aktivitas perubahan jadwal, penugasan, dan alasan override tersimpan otomatis di Firestore.
        </p>
      </div>

      <Card className="backdrop-blur-2xl bg-white/70 border border-white/80 shadow-xl shadow-ink/5 p-6 rounded-3xl">
        <div className="mb-4">
          <Input
            label="Cari Log"
            placeholder="Cari berdasarkan aksi, pelaku, atau detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-muted text-xs uppercase text-ink-soft bg-surface/50">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Pelaku</th>
                  <th className="p-3">Aksi</th>
                  <th className="p-3">Detail & Alasan Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted">
                {filteredLogs.map((log) => (
                  <tr key={log.audit_id} className="hover:bg-white/60 transition-colors">
                    <td className="p-3 text-xs text-ink-soft whitespace-nowrap">{log.waktu}</td>
                    <td className="p-3 font-medium text-ink">{log.pelaku_id}</td>
                    <td className="p-3">
                      <Badge variant="complete">{log.aksi}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="text-ink font-medium">{log.detail}</div>
                      {log.overrideReason && (
                        <div className="text-xs text-danger font-bold mt-0.5">
                          Alasan Override: {log.overrideReason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-ink-soft space-y-2">
            <div className="text-2xl">📜</div>
            <p className="text-sm font-medium">Belum ada riwayat aktivitas yang tercatat.</p>
            <p className="text-xs text-ink-soft/70">Aktivitas penugasan dan finalisasi jadwal akan otomatis tercatat di sini.</p>
          </div>
        )}
      </Card>
    </div>
  );
}