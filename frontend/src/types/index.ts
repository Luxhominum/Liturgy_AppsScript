// Roles & Auth
export type UserRole = 'ADMIN' | 'SCHEDULER' | 'VIEWER';
export interface User { 
  email: string; 
  role: UserRole; 
  displayName: string; 
}

// Data entities (matching the 13 sheets from PRD)
export interface Wilayah { 
  wilayah_id: string; 
  nama: string; 
  aktif: boolean; 
}

export interface Lingkungan { 
  lingkungan_id: string; 
  nama: string; 
  wilayah_id: string; 
  aktif: boolean; 
}

export interface Person { 
  person_id: string; 
  nama: string; 
  lingkungan_id: string; 
  aktif: boolean; 
}

export interface RoleConfig { 
  role_id: string; 
  nama_peran: string; 
  jumlah_dibutuhkan: number; 
  jumlah_maksimal: number; 
  aktif: boolean; 
  urutan: number; 
}

export interface PersonRole { 
  person_role_id: string; 
  person_id: string; 
  role_id: string; 
  aktif: boolean; 
}

export type WeekendStatus = 'DRAFT' | 'FINAL';
export interface Weekend { 
  weekend_id: string; 
  tanggal_acuan: string; 
  status: WeekendStatus; 
  revisi: number; 
  is_special?: boolean;
  nama_kegiatan?: string;
}

export type SessionType = 'SABTU_SORE' | 'MINGGU_PAGI' | 'MINGGU_SORE' | 'KHUSUS';
export interface Session { 
  session_id: string; 
  weekend_id: string; 
  jenis_sesi: SessionType; 
  tanggal_sesi: string; 
  status: string; 
  nama_khusus?: string; 
}

export type AssignmentStatus = 'ACTIVE' | 'REMOVED';
export interface Assignment { 
  assignment_id: string; 
  weekend_id: string; 
  session_id: string; 
  person_id: string; 
  role_id: string; 
  status: AssignmentStatus; 
}

export type CommunityAssignmentType = 'PADUAN_SUARA' | 'TATIB' | 'HIAS_ALTAR';
export interface CommunityAssignment { 
  community_assignment_id: string; 
  weekend_id: string; 
  session_id: string; 
  jenis_penugasan: CommunityAssignmentType; 
  wilayah_id?: string; 
  lingkungan_id?: string; 
  status: AssignmentStatus; 
}

export interface RuleConfig { 
  rule_id: string; 
  nama_aturan: string; 
  aktif: boolean; 
  tingkat: 'WAJIB' | 'PERINGATAN' | 'OTOMATIS'; 
}

export interface AuditEntry { 
  audit_id: string; 
  waktu: string; 
  pelaku_id: string; 
  aksi: string; 
  jenis_entitas: string; 
  entitas_id: string; 
}

// UI State
export type TabId = 'beranda' | 'jadwal' | 'monitoring' | 'penjadwalan' | 'kalender' | 'kelola-petugas' | 'pengaturan-aturan' | 'riwayat-audit' | 'pengguna';
export type SchedulingWave = 1 | 2 | 3;
export interface SessionProgress { 
  roleId: string; 
  namaPeran: string; 
  dibutuhkan: number; 
  terisi: number; 
  status: 'TERPENUHI' | 'BELUM_LENGKAP'; 
}