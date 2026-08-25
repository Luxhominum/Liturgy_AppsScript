import {
  ROLES,
  SESSION_TYPES,
  WEEKEND_STATUS,
  ASSIGNMENT_STATUS,
  COMMUNITY_ASSIGNMENT_TYPE,
  RULE_LEVELS
} from '../config/constants';

export type UserRole = typeof ROLES[keyof typeof ROLES];
export type SessionType = typeof SESSION_TYPES[keyof typeof SESSION_TYPES];
export type WeekendStatus = typeof WEEKEND_STATUS[keyof typeof WEEKEND_STATUS];
export type AssignmentStatus = typeof ASSIGNMENT_STATUS[keyof typeof ASSIGNMENT_STATUS];
export type CommunityAssignmentType = typeof COMMUNITY_ASSIGNMENT_TYPE[keyof typeof COMMUNITY_ASSIGNMENT_TYPE];
export type RuleLevel = typeof RULE_LEVELS[keyof typeof RULE_LEVELS];

export interface PersonDoc {
  person_id: string;
  nama: string;
  lingkungan_id: string;
  aktif: boolean;
  dibuat_pada: Date | string;
  diubah_pada: Date | string;
  dibuat_oleh?: string;
  diubah_oleh?: string;
}

export interface WilayahDoc {
  wilayah_id: string;
  nama: string;
  aktif: boolean;
}

export interface LingkunganDoc {
  lingkungan_id: string;
  nama: string;
  wilayah_id: string;
  aktif: boolean;
}

export interface RoleConfigDoc {
  role_id: string;
  nama_peran: string;
  jumlah_dibutuhkan: number;
  jumlah_maksimal: number;
  aktif: boolean;
  urutan: number;
}

export interface PersonRoleDoc {
  person_role_id: string;
  person_id: string;
  role_id: string;
  aktif: boolean;
}

export interface RuleConfigDoc {
  rule_id: string;
  nama_aturan: string;
  aktif: boolean;
  tingkat: RuleLevel;
  konfigurasi_json?: string;
  versi_kebijakan: number;
  diubah_pada: Date | string;
  diubah_oleh?: string;
}

export interface WeekendDoc {
  weekend_id: string;
  tanggal_acuan: string; // YYYY-MM-DD (Sunday reference date)
  status: WeekendStatus;
  revisi: number;
  dibuat_pada: Date | string;
  diubah_pada: Date | string;
  difinalkan_pada?: Date | string | null;
  difinalkan_oleh?: string | null;
}

export interface SessionDoc {
  session_id: string;
  weekend_id: string;
  jenis_sesi: SessionType;
  tanggal_sesi: string; // ISO date string
  status: string;
  nama_khusus?: string;
}

export interface AssignmentDoc {
  assignment_id: string;
  weekend_id: string;
  session_id: string;
  person_id: string;
  role_id: string;
  status: AssignmentStatus;
  dibuat_pada: Date | string;
  dibuat_oleh: string;
  diubah_pada: Date | string;
  diubah_oleh: string;
}

export interface CommunityAssignmentDoc {
  community_assignment_id: string;
  weekend_id: string;
  session_id: string;
  jenis_penugasan: CommunityAssignmentType;
  wilayah_id?: string;
  lingkungan_id?: string;
  alasan_override?: string;
  status: AssignmentStatus;
  dibuat_pada: Date | string;
  dibuat_oleh: string;
}

export interface AuditLogDoc {
  audit_id: string;
  waktu: Date | string;
  pelaku_id: string;
  aksi: string;
  jenis_entitas: string;
  entitas_id: string;
  nilai_lama_json?: string;
  nilai_baru_json?: string;
  rule_id?: string;
  alasan_override?: string;
  versi_kebijakan?: number;
}

export interface UserDoc {
  uid: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SystemConfigDoc {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}

// Conflict validation types
export interface RuleViolation {
  ruleId: string;
  personId?: string;
  pesan: string;
}

export interface ValidationResult {
  blokir: RuleViolation[];
  peringatan: RuleViolation[];
}
