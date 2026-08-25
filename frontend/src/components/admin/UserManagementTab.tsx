import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Badge, Input, Select, Button, Dialog } from '../ui';
import type { User, UserRole } from '../../types';

export default function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('SCHEDULER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanDuplicates = async () => {
    try {
      setIsCleaning(true);
      const snap = await getDocs(collection(db, 'users'));
      const emailMap = new Map<string, { role: UserRole; displayName: string; docIds: string[] }>();

      snap.docs.forEach((d) => {
        const data = d.data();
        const rawEmail = data.email || d.id;
        if (!rawEmail) return;
        const email = rawEmail.trim().toLowerCase();
        const role = (data.role as UserRole) || 'VIEWER';
        const displayName = data.display_name || data.displayName || data.email || 'Pengguna Paroki';

        if (!emailMap.has(email)) {
          emailMap.set(email, { role, displayName, docIds: [d.id] });
        } else {
          const entry = emailMap.get(email)!;
          entry.docIds.push(d.id);
          if (role === 'ADMIN' || (role === 'SCHEDULER' && entry.role !== 'ADMIN')) {
            entry.role = role;
          }
          if (displayName && !displayName.includes('@')) {
            entry.displayName = displayName;
          }
        }
      });

      let deletedCount = 0;
      for (const [email, entry] of emailMap.entries()) {
        const canonicalDocId = email.replace(/[^a-zA-Z0-9]/g, '_');
        await setDoc(doc(db, 'users', canonicalDocId), {
          email,
          display_name: entry.displayName,
          role: entry.role,
          updated_at: new Date().toISOString()
        }, { merge: true });

        for (const docId of entry.docIds) {
          if (docId !== canonicalDocId) {
            await deleteDoc(doc(db, 'users', docId));
            deletedCount++;
          }
        }
      }

      alert(`✓ Database berhasil dibersihkan! ${deletedCount} rekaman duplikat lama telah disatukan.`);
    } catch (err) {
      console.error('Failed to clean duplicates:', err);
      alert('Gagal membersihkan database.');
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const emailMap = new Map<string, { email: string; displayName: string; role: UserRole; docIds: string[] }>();

        snap.docs.forEach((d) => {
          const data = d.data();
          const rawEmail = data.email || d.id;
          if (!rawEmail) return;
          const email = rawEmail.trim().toLowerCase();
          const role = (data.role as UserRole) || 'VIEWER';
          const displayName = data.display_name || data.displayName || data.email || 'Pengguna Paroki';

          if (!emailMap.has(email)) {
            emailMap.set(email, {
              email,
              displayName,
              role,
              docIds: [d.id]
            });
          } else {
            const existing = emailMap.get(email)!;
            existing.docIds.push(d.id);
            const canonicalDocId = email.replace(/[^a-zA-Z0-9]/g, '_');
            if (d.id === canonicalDocId) {
              existing.role = role;
              if (displayName && displayName !== email) existing.displayName = displayName;
            }
          }
        });

        // Clean up redundant duplicate docs in background
        emailMap.forEach((entry, email) => {
          const canonicalDocId = email.replace(/[^a-zA-Z0-9]/g, '_');
          const duplicateDocIds = entry.docIds.filter((id) => id !== canonicalDocId);
          duplicateDocIds.forEach((dupId) => {
            deleteDoc(doc(db, 'users', dupId)).catch(() => {});
          });
        });

        const liveUsers: User[] = Array.from(emailMap.values()).map((item) => ({
          email: item.email,
          displayName: item.displayName,
          role: item.role
        }));

        setUsers(liveUsers);
      },
      (err) => {
        console.warn('[FIRESTORE] Users sync notice:', err);
      }
    );

    return () => unsub();
  }, []);

  const handleAddUser = async () => {
    if (!newEmail) return;

    try {
      setIsSubmitting(true);
      const cleanEmail = newEmail.trim().toLowerCase();
      const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const userRef = doc(db, 'users', docId);

      await setDoc(
        userRef,
        {
          email: cleanEmail,
          display_name: newName.trim() || cleanEmail,
          role: newRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );

      // Optimistic local update
      setUsers((prev) => {
        const existing = prev.find((u) => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          return prev.map((u) => (u.email.toLowerCase() === cleanEmail ? { ...u, role: newRole, displayName: newName || u.displayName } : u));
        }
        return [...prev, { email: cleanEmail, displayName: newName || cleanEmail, role: newRole }];
      });

      setNewEmail('');
      setNewName('');
      setNewRole('SCHEDULER');
      setIsAddModalOpen(false);
      alert(`Pengguna ${cleanEmail} berhasil ditambahkan sebagai ${newRole}!`);
    } catch (error) {
      console.error('Failed to add user to Firestore:', error);
      alert('Gagal menambahkan pengguna. Pastikan koneksi internet aktif.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (email: string, updatedRole: UserRole) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      setUsers((prev: User[]) => prev.map((u: User) => (u.email.toLowerCase() === cleanEmail ? { ...u, role: updatedRole } : u)));

      const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const userRef = doc(db, 'users', docId);

      await setDoc(
        userRef,
        {
          email: cleanEmail,
          role: updatedRole,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Failed to update role in Firestore:', error);
    }
  };

  const [deletePromptUser, setDeletePromptUser] = useState<User | null>(null);

  const confirmDeleteUser = async () => {
    if (!deletePromptUser) return;
    try {
      const cleanEmail = deletePromptUser.email.trim().toLowerCase();
      setUsers((prev: User[]) => prev.filter((u: User) => u.email.toLowerCase() !== cleanEmail));
      const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      await deleteDoc(doc(db, 'users', docId));
      setDeletePromptUser(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Gagal menghapus pengguna.');
    }
  };

  const filteredUsers = users.filter(
    (u: User) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Pengaturan Hak Akses Pengguna</h1>
          <p className="text-sm text-ink-soft">
            Atur peran (Admin, Penjadwal, Pelihat) untuk setiap akun Google paroki. Perubahan otomatis tersimpan ke Firestore.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleCleanDuplicates}
            disabled={isCleaning}
            className="rounded-xl font-bold text-xs bg-white hover:bg-surface border-surface-muted"
          >
            {isCleaning ? '⏳ Membersihkan...' : '🧹 Bersihkan Duplikat Database'}
          </Button>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)} className="rounded-xl font-bold text-xs">
            + Tambah Pengguna
          </Button>
        </div>
      </div>

      <Card className="backdrop-blur-2xl bg-white/70 border border-white/80 shadow-xl shadow-ink/5 p-6 rounded-3xl">
        <div className="mb-4">
          <Input
            label="Cari Akun Pengguna"
            placeholder="Ketik email Google atau nama pengguna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-muted text-xs uppercase text-ink-soft bg-surface/50">
              <tr>
                <th className="p-3">Nama Pengguna</th>
                <th className="p-3">Email Google</th>
                <th className="p-3">Hak Akses Saat Ini</th>
                <th className="p-3">Ubah Hak Akses</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted">
              {filteredUsers.map((user: User) => (
                <tr key={user.email} className="hover:bg-white/60 transition-colors">
                  <td className="p-3 font-bold text-ink">{user.displayName}</td>
                  <td className="p-3 text-ink-soft">{user.email}</td>
                  <td className="p-3">
                    <Badge
                      variant={
                        user.role === 'ADMIN' ? 'complete' : user.role === 'SCHEDULER' ? 'warning' : 'draft'
                      }
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="w-44">
                      <Select
                        value={user.role}
                        options={[
                          { value: 'ADMIN', label: 'ADMIN (Semua Hak)' },
                          { value: 'SCHEDULER', label: 'SCHEDULER (Edit Draft)' },
                          { value: 'VIEWER', label: 'VIEWER (Lihat Saja)' }
                        ]}
                        onChange={(e) => handleRoleChange(user.email, e.target.value as UserRole)}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/10"
                      onClick={() => setDeletePromptUser(user)}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete User Confirmation Modal Card */}
      {deletePromptUser && (
        <Dialog
          open={!!deletePromptUser}
          onClose={() => setDeletePromptUser(null)}
          title="⚠️ Hapus Hak Akses Pengguna"
        >
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-danger/10 border border-danger/25 rounded-2xl text-xs space-y-2">
              <p className="font-semibold text-ink leading-relaxed">
                Hapus hak akses untuk pengguna{' '}
                <strong className="text-danger font-bold">
                  {deletePromptUser.displayName} ({deletePromptUser.email})
                </strong>?
              </p>
              <p className="text-ink-soft">
                Akun ini tidak akan lagi memiliki hak akses khusus di aplikasi penjadwalan liturgi.
              </p>
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-surface-muted">
              <Button
                variant="secondary"
                onClick={() => setDeletePromptUser(null)}
                className="rounded-xl font-bold text-xs"
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeleteUser}
                className="rounded-xl font-bold text-xs bg-danger text-white hover:bg-danger/90 shadow-md"
              >
                🗑️ Ya, Hapus Akses
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Tambah Pengguna Baru">
        <div className="space-y-4">
          <Input
            label="Email Akun Google"
            type="email"
            placeholder="Contoh: sekretariat@paroki.org..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            label="Nama Lengkap / Jabatan"
            placeholder="Contoh: Ibu Maria (Koordinator Liturgi)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div>
            <label className="block text-xs font-bold uppercase text-ink-soft mb-1">
              Pilih Hak Akses (Role)
            </label>
            <Select
              value={newRole}
              options={[
                { value: 'SCHEDULER', label: 'SCHEDULER (Bisa susun jadwal draft)' },
                { value: 'ADMIN', label: 'ADMIN (Semua hak akses + finalisasi)' },
                { value: 'VIEWER', label: 'VIEWER (Hanya melihat jadwal)' }
              ]}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddUser} disabled={!newEmail || isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}