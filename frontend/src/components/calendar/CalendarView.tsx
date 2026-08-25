import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../config/firebase';
import { Card, Button } from '../ui';
import {
  WorkspaceHeader,
  SessionNavTabs,
  SessionCard,
  StatusPanel,
  SelectOfficerModal,
  AutoAssignPreviewModal,
  RuleValidationModal
} from '../scheduling';
import { Dialog, Input, Select } from '../ui';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';
import { LINGKUNGAN_TO_WILAYAH } from '../../data/lingkunganWilayahMap';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';
import { finalizeWeekendApi, subscribeToWeekend, subscribeToPeople } from '../../services/api';
import { runAutoAssignEngine, type AutoAssignResult } from '../../utils/autoAssignEngine';
import {
  validateWeekendSchedule,
  getAdjacentWeekendDates,
  resolveWilayah,
  type ValidationSummary
} from '../../utils/ruleValidator';
import type {
  Session,
  Assignment,
  CommunityAssignment,
  RoleConfig,
  Person,
  UserRole
} from '../../types';

interface CalendarSchedule {
  id: string;
  tanggalAcuan: string;
  namaKegiatan: string;
  isSpecialMass?: boolean;
  status: 'DRAFT' | 'FINAL';
  revisi: number;
  sessions: {
    jenis: string;
    nama: string;
    waktu: string;
    terpenuhi: boolean;
  }[];
}

interface CalendarViewProps {
  userRole?: UserRole;
  initialWeekendId?: string | null;
  onOpenPrint?: () => void;
}

const DEFAULT_ROLES: RoleConfig[] = [
  { role_id: 'ROL-ORGANIS', nama_peran: 'Organis', jumlah_dibutuhkan: 1, jumlah_maksimal: 1, aktif: true, urutan: 1 },
  { role_id: 'ROL-PEMAZMUR', nama_peran: 'Pemazmur', jumlah_dibutuhkan: 2, jumlah_maksimal: 2, aktif: true, urutan: 2 },
  { role_id: 'ROL-LEKTOR', nama_peran: 'Lektor', jumlah_dibutuhkan: 3, jumlah_maksimal: 3, aktif: true, urutan: 3 },
  { role_id: 'ROL-MISDINAR', nama_peran: 'Misdinar', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 4 },
  { role_id: 'ROL-PRODIAKON', nama_peran: 'Prodiakon', jumlah_dibutuhkan: 6, jumlah_maksimal: 6, aktif: true, urutan: 5 },
];

const SPECIAL_WILAYAH = ['Grasia', 'Luar Paroki', 'Becanbo', 'Lain Lain'];

const INITIAL_REAL_PEOPLE: (Person & { namaLingkungan?: string; namaWilayah?: string; peranList?: string[] })[] = REAL_OFFICERS_DATA.map((o, idx) => {
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

const PARISH_WILAYAH_LIST = Array.from(
  new Set([
    ...REAL_OFFICERS_DATA.map((o) => o.wilayah.toUpperCase()),
    ...SPECIAL_WILAYAH.map((w) => w.toUpperCase())
  ])
).sort().map((w) => ({
  wilayah_id: w,
  nama: w,
  aktif: true
}));

const PARISH_LINGKUNGAN_LIST = Array.from(
  new Set([
    ...Object.keys(LINGKUNGAN_TO_WILAYAH),
    ...REAL_OFFICERS_DATA.map((o) => o.lingkungan.toUpperCase())
  ])
).sort().map((l) => ({
  lingkungan_id: l,
  nama: l,
  wilayah_id: LINGKUNGAN_TO_WILAYAH[l.toUpperCase()] || 'MARIA RATU',
  aktif: true
}));

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function CalendarView({ userRole = 'ADMIN', initialWeekendId = null, onOpenPrint }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<CalendarSchedule[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<'ALL' | 'HAS_SCHEDULE' | 'NO_SCHEDULE' | 'READY' | 'FINAL'>('ALL');
  const [hoveredDateInfo, setHoveredDateInfo] = useState<{ day: any; lit: any; schedule: any; clientX: number; clientY: number } | null>(null);
  
  // Selected Weekend State (null = Full Calendar Grid, string = Adaptive Workspace & Mini Calendar)
  const [selectedWeekendId, setSelectedWeekendId] = useState<string | null>(initialWeekendId);
  const [, setSelectedIsSpecial] = useState<boolean>(false);
  const [showMobileMiniCal, setShowMobileMiniCal] = useState(false);
  const [mobileCalendarView, setMobileCalendarView] = useState<'GRID' | 'LIST'>('GRID');
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isOfficerSearchModalOpen, setIsOfficerSearchModalOpen] = useState(false);
  const [officerSearchTerm, setOfficerSearchTerm] = useState('');

  useEffect(() => {
    if (initialWeekendId) {
      setSelectedWeekendId(initialWeekendId);
    }
  }, [initialWeekendId]);

  // Active Workspace State
  const [activeSessionId, setActiveSessionId] = useState<string>('ses-1');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [communityAssignments, setCommunityAssignments] = useState<CommunityAssignment[]>([]);
  const [people, setPeople] = useState(INITIAL_REAL_PEOPLE);
  const [weekendDoc, setWeekendDoc] = useState<any>(null);
  const [isRevisionUnlocked, setIsRevisionUnlocked] = useState(false);

  // Reset revision unlock when navigating between weekends
  useEffect(() => {
    setIsRevisionUnlocked(false);
  }, [selectedWeekendId]);

  // Auth & Status permission guard: VIEWER role or FINAL (locked) schedules cannot mutate unless explicitly unlocked for revision
  const canUserManage = Boolean(userRole && userRole !== 'VIEWER');
  const isScheduleFinal = weekendDoc?.status === 'FINAL';
  const isEditable = Boolean(
    canUserManage &&
    (!selectedWeekendId || !isScheduleFinal || isRevisionUnlocked)
  );

  const [adjacentSchedules, setAdjacentSchedules] = useState<{
    weekendId: string;
    tanggalAcuan: string;
    assignments: Assignment[];
    communityAssignments: CommunityAssignment[];
  }[]>([]);

  const [validationModalState, setValidationModalState] = useState<{
    open: boolean;
    summary: ValidationSummary | null;
  }>({
    open: false,
    summary: null
  });

  // Modal states
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('17.00 WIB');
  const [selectModalState, setSelectModalState] = useState<{
    open: boolean;
    sessionId: string;
    sessionName: string;
    role: RoleConfig | null;
  }>({
    open: false,
    sessionId: '',
    sessionName: '',
    role: null
  });

  // Auto-Assign State
  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null);
  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [isApplyingAutoAssign, setIsApplyingAutoAssign] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Sync real schedules list from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'weekends'), (snap) => {
      const liveList: CalendarSchedule[] = snap.docs.map((d) => {
        const data = d.data();
        const isSpecial = data.is_special || false;
        return {
          id: d.id,
          tanggalAcuan: data.tanggal_acuan || d.id.replace('w-', ''),
          namaKegiatan: data.nama_kegiatan || (isSpecial ? 'Misa Khusus' : `Minggu (${data.tanggal_acuan})`),
          isSpecialMass: isSpecial,
          status: (data.status as 'DRAFT' | 'FINAL') || 'DRAFT',
          revisi: data.revisi || 1,
          sessions: (data.sessions || []).map((s: any) => {
            let defaultWaktu = '17.00 WIB';
            if (s.jenis_sesi === 'MINGGU_PAGI') defaultWaktu = '07.00 WIB';
            if (s.waktu_mulai) defaultWaktu = s.waktu_mulai.includes('WIB') ? s.waktu_mulai : `${s.waktu_mulai} WIB`;
            return {
              jenis: s.jenis_sesi || 'SABTU_SORE',
              nama: s.nama_khusus || (s.jenis_sesi === 'SABTU_SORE' ? 'Sabtu Sore' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Minggu Pagi' : 'Minggu Sore'),
              waktu: defaultWaktu,
              terpenuhi: false
            };
          })
        };
      });
      setSchedules(liveList);
    });
    return () => unsub();
  }, []);

  // Sync active weekend details & adjacent weekends when selected
  useEffect(() => {
    if (!selectedWeekendId) {
      setAdjacentSchedules([]);
      return;
    }

    const targetDate = selectedWeekendId.replace('w-', '');
    const { prevDate, nextDate } = getAdjacentWeekendDates(targetDate);

    const unsubWeekend = subscribeToWeekend(selectedWeekendId, (data) => {
      if (data.weekend) {
        setWeekendDoc(data.weekend);
        setSelectedIsSpecial(!!data.weekend.is_special);
      }

      const dateStr = selectedWeekendId.replace('w-', '');
      const dObj = new Date(dateStr + 'T00:00:00');
      const isWeekendDay = dObj.getDay() === 0 || dObj.getDay() === 6;

      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
      } else if (!isWeekendDay || data.weekend?.is_special) {
        setSessions([]);
      } else {
        const defaultSess: Session[] = [
          { session_id: 'ses-1', weekend_id: selectedWeekendId, jenis_sesi: 'SABTU_SORE', tanggal_sesi: `${dateStr}T17:00:00Z`, status: 'DRAFT' },
          { session_id: 'ses-2', weekend_id: selectedWeekendId, jenis_sesi: 'MINGGU_PAGI', tanggal_sesi: `${dateStr}T07:00:00Z`, status: 'DRAFT' },
        ];
        setSessions(defaultSess);
      }
      setAssignments(data.assignments);
      setCommunityAssignments(data.communityAssignments);
    });

    const unsubPrev = onSnapshot(doc(db, 'weekends', 'w-' + prevDate), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setAdjacentSchedules((prev) => {
        const filtered = prev.filter((s) => s.tanggalAcuan !== prevDate);
        if (!data) return filtered;
        return [
          ...filtered,
          {
            weekendId: 'w-' + prevDate,
            tanggalAcuan: prevDate,
            assignments: data.assignments || [],
            communityAssignments: data.communityAssignments || []
          }
        ];
      });
    });

    const unsubNext = onSnapshot(doc(db, 'weekends', 'w-' + nextDate), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setAdjacentSchedules((prev) => {
        const filtered = prev.filter((s) => s.tanggalAcuan !== nextDate);
        if (!data) return filtered;
        return [
          ...filtered,
          {
            weekendId: 'w-' + nextDate,
            tanggalAcuan: nextDate,
            assignments: data.assignments || [],
            communityAssignments: data.communityAssignments || []
          }
        ];
      });
    });

    const unsubPeople = subscribeToPeople((livePeople) => {
      if (livePeople.length > 0) {
        setPeople((prev) =>
          livePeople.map((lp) => {
            const existing = prev.find((p) => p.person_id === lp.person_id || p.nama === lp.nama);
            return {
              ...lp,
              namaLingkungan: existing?.namaLingkungan || lp.lingkungan_id,
              namaWilayah: existing?.namaWilayah,
              peranList: existing?.peranList || []
            };
          })
        );
      }
    });

    return () => {
      unsubWeekend();
      unsubPrev();
      unsubNext();
      unsubPeople();
    };
  }, [selectedWeekendId]);

  // Set default active session when sessions change
  useEffect(() => {
    if (sessions.length > 0 && (!activeSessionId || !sessions.find(s => s.session_id === activeSessionId))) {
      setActiveSessionId(sessions[0].session_id);
    }
  }, [sessions, activeSessionId]);

  // Calendar Day Generator
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const days = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pMonth = month === 0 ? 11 : month - 1;
      const pYear = month === 0 ? year - 1 : year;
      const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      const dObj = new Date(pYear, pMonth, pDay);
      const isSunday = dObj.getDay() === 0;
      const isSaturday = dObj.getDay() === 6;

      let matchingSundayStr = dateStr;
      if (isSaturday) {
        const nextSun = new Date(dObj);
        nextSun.setDate(dObj.getDate() + 1);
        matchingSundayStr = `${nextSun.getFullYear()}-${String(nextSun.getMonth() + 1).padStart(2, '0')}-${String(nextSun.getDate()).padStart(2, '0')}`;
      }

      days.push({
        dayNumber: pDay,
        dateStr,
        isCurrentMonth: false,
        isSunday,
        isSaturday,
        matchingSundayStr
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(year, month, d);
      const isSunday = dObj.getDay() === 0;
      const isSaturday = dObj.getDay() === 6;

      let matchingSundayStr = dateStr;
      if (isSaturday) {
        const nextSun = new Date(dObj);
        nextSun.setDate(dObj.getDate() + 1);
        matchingSundayStr = `${nextSun.getFullYear()}-${String(nextSun.getMonth() + 1).padStart(2, '0')}-${String(nextSun.getDate()).padStart(2, '0')}`;
      }

      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isSunday,
        isSaturday,
        matchingSundayStr
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nMonth = month === 11 ? 0 : month + 1;
      const nYear = month === 11 ? year + 1 : year;
      const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(nYear, nMonth, d);
      const isSunday = dObj.getDay() === 0;
      const isSaturday = dObj.getDay() === 6;

      let matchingSundayStr = dateStr;
      if (isSaturday) {
        const nextSun = new Date(dObj);
        nextSun.setDate(dObj.getDate() + 1);
        matchingSundayStr = `${nextSun.getFullYear()}-${String(nextSun.getMonth() + 1).padStart(2, '0')}-${String(nextSun.getDate()).padStart(2, '0')}`;
      }

      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isSunday,
        isSaturday,
        matchingSundayStr
      });
    }

    return days;
  }, [year, month]);

  // Mobile Weekend List Computation
  const monthWeekendList = useMemo(() => {
    return calendarDays
      .filter((d) => d.isCurrentMonth && (d.isSunday || d.isSaturday))
      .filter((d) => d.isSunday)
      .map((sun) => {
        const dateObj = new Date(sun.dateStr + 'T00:00:00');
        const lit = getLiturgicalInfo(dateObj);
        const existingSchedule = schedules.find((s) => s.tanggalAcuan === sun.dateStr);
        return {
          sunday: sun,
          lit,
          existingSchedule,
          dateFormatted: dateObj.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
        };
      });
  }, [calendarDays, schedules]);

  // Mobile Active Selected Day Preview Computation
  const activeMobileSelectedDay = useMemo(() => {
    const day = calendarDays.find((d) => d.dateStr === mobileSelectedDate) || calendarDays.find((d) => d.isCurrentMonth && d.isSunday) || calendarDays[0];
    if (!day) return null;
    const dateObj = new Date(day.dateStr + 'T00:00:00');
    const lit = getLiturgicalInfo(dateObj);
    const existingSchedule = schedules.find((s) => s.tanggalAcuan === day.matchingSundayStr || s.tanggalAcuan === day.dateStr);
    return {
      day,
      lit,
      existingSchedule,
      dateFormatted: dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
    };
  }, [calendarDays, mobileSelectedDate, schedules]);

  // Quick Officer Search Memo
  const searchedOfficers = useMemo(() => {
    const q = officerSearchTerm.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return REAL_OFFICERS_DATA.filter((o) =>
      o.nama.toLowerCase().includes(q) ||
      o.lingkungan.toLowerCase().includes(q) ||
      o.wilayah.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [officerSearchTerm]);

  // Month Navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Direct 1-Click Zero-Modal Date Click Handler (Weekday vs Weekend Aware)
  const handleDateCellClick = async (
    dayDateStr: string,
    isSaturday: boolean,
    isSunday: boolean,
    matchingSundayStr: string
  ) => {
    const isWeekend = isSaturday || isSunday;
    const targetDate = isWeekend ? (isSaturday ? matchingSundayStr : dayDateStr) : dayDateStr;
    const weekendId = 'w-' + targetDate;

    // Check if schedule already exists
    const existingSchedule = schedules.find(
      (s) => s.tanggalAcuan === targetDate || s.tanggalAcuan === dayDateStr
    );

    if (existingSchedule) {
      setSelectedWeekendId(existingSchedule.id);
      setSelectedIsSpecial(!!existingSchedule.isSpecialMass);
      return;
    }

    // Permission check: Viewers cannot create new schedules
    if (!canUserManage) {
      alert('Jadwal belum tersedia pada tanggal ini.\n\nSilakan masuk (Login) dengan akun Administrator atau Tim Penjadwal untuk membuat jadwal baru.');
      return;
    }

    // Instant zero-modal draft initialization: Reset previous weekend lock states
    setWeekendDoc(null);
    setIsRevisionUnlocked(false);

    const dateObj = new Date(targetDate + 'T00:00:00');
    const litInfo = getLiturgicalInfo(dateObj);

    let defaultSessions: Session[] = [];
    let isSpecial = false;
    let activityTitle = litInfo.title;

    if (isWeekend) {
      // Standard Weekend (Saturday 17.00 & Sunday 07.00)
      defaultSessions = [
        {
          session_id: 'ses-1',
          weekend_id: weekendId,
          jenis_sesi: 'SABTU_SORE',
          tanggal_sesi: `${targetDate}T17:00:00Z`,
          status: 'DRAFT'
        },
        {
          session_id: 'ses-2',
          weekend_id: weekendId,
          jenis_sesi: 'MINGGU_PAGI',
          tanggal_sesi: `${targetDate}T07:00:00Z`,
          status: 'DRAFT'
        }
      ];
    } else {
      // Weekday (Senin-Jumat) -> ONLY Tambah Sesi (0 default sessions)
      isSpecial = true;
      activityTitle = `Misa ${litInfo.title}`;
      defaultSessions = [];
    }

    try {
      await setDoc(doc(db, 'weekends', weekendId), {
        id: weekendId,
        tanggal_acuan: targetDate,
        is_special: isSpecial,
        status: 'DRAFT',
        revisi: 1,
        nama_kegiatan: activityTitle,
        sessions: defaultSessions,
        assignments: [],
        communityAssignments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setSelectedWeekendId(weekendId);
      setSelectedIsSpecial(isSpecial);
    } catch (err) {
      console.error('Failed to create instant schedule:', err);
      // Fallback local open
      setSelectedWeekendId(weekendId);
      setSelectedIsSpecial(isSpecial);
    }
  };

  // Add Mass Session
  const handleAddSession = async () => {
    if (!newSessionName.trim() || !selectedWeekendId) return;

    const newId = 'ses-' + (sessions.length + 1) + '-' + Date.now();
    const newSessionObj: Session = {
      session_id: newId,
      weekend_id: selectedWeekendId,
      jenis_sesi: 'KHUSUS',
      nama_khusus: newSessionName.trim() + (newSessionTime ? ` (${newSessionTime})` : ''),
      tanggal_sesi: `${selectedWeekendId.replace('w-', '')}T17:00:00Z`,
      status: 'DRAFT'
    };

    const updatedSessions = [...sessions, newSessionObj];
    setSessions(updatedSessions);
    setActiveSessionId(newId);
    setIsAddSessionModalOpen(false);
    setNewSessionName('');

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          sessions: updatedSessions,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to save added session:', err);
    }
  };

  // Delete Mass Session
  const handleDeleteSession = async (sessionId: string) => {
    if (!selectedWeekendId) return;
    const updatedSessions = sessions.filter((s) => s.session_id !== sessionId);
    const updatedAssignments = assignments.filter((a) => a.session_id !== sessionId);
    const updatedCommunity = communityAssignments.filter((c) => c.session_id !== sessionId);

    setSessions(updatedSessions);
    setAssignments(updatedAssignments);
    setCommunityAssignments(updatedCommunity);

    if (activeSessionId === sessionId && updatedSessions.length > 0) {
      setActiveSessionId(updatedSessions[0].session_id);
    }

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          sessions: updatedSessions,
          assignments: updatedAssignments,
          communityAssignments: updatedCommunity,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Automated Smart Schedule Engine
  const handleTriggerAutoAssign = () => {
    if (!selectedWeekendId) return;
    const adjacentAssignments = adjacentSchedules.flatMap((s) => s.assignments || []);
    const result = runAutoAssignEngine({
      weekendId: selectedWeekendId,
      sessions,
      roles: DEFAULT_ROLES,
      people,
      existingAssignments: assignments,
      existingCommunityAssignments: communityAssignments,
      adjacentAssignments
    });
    setAutoAssignResult(result);
    setIsAutoAssignOpen(true);
  };

  const handleApplyAutoAssign = async () => {
    if (!autoAssignResult || !selectedWeekendId) return;
    setIsApplyingAutoAssign(true);
    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          assignments: autoAssignResult.assignments,
          communityAssignments: autoAssignResult.communityAssignments,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      setAssignments(autoAssignResult.assignments);
      setCommunityAssignments(autoAssignResult.communityAssignments);
      setIsAutoAssignOpen(false);
      setAutoAssignResult(null);
    } catch (err) {
      console.error('Failed to commit auto assign:', err);
      alert('Gagal menerapkan jadwal otomatis.');
    } finally {
      setIsApplyingAutoAssign(false);
    }
  };

  // Role Assignment Handlers
  const handleOpenSelectModal = (sessionId: string, sessionName: string, role: RoleConfig) => {
    setSelectModalState({
      open: true,
      sessionId,
      sessionName,
      role
    });
  };

  const handleAssignOfficers = async (newPersonIds: string[]) => {
    if (!selectModalState.role || !selectedWeekendId) return;

    const sessionId = selectModalState.sessionId;
    const roleId = selectModalState.role.role_id;

    // Filter out previous assignments for this role & session
    const filtered = assignments.filter(
      (a) => !(a.session_id === sessionId && a.role_id === roleId)
    );

    const newAssignments: Assignment[] = newPersonIds.map((pId) => ({
      assignment_id: 'asg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      weekend_id: selectedWeekendId,
      session_id: sessionId,
      person_id: pId,
      role_id: roleId,
      status: 'ACTIVE'
    }));

    const updatedAssignments = [...filtered, ...newAssignments];
    setAssignments(updatedAssignments);

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          assignments: updatedAssignments,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      for (const asg of newAssignments) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'assignments', asg.assignment_id), asg, { merge: true });
      }
    } catch (err) {
      console.error('Firestore direct assignment error:', err);
    }
  };

  const handleAssignCommunity = async (
    sessionId: string,
    type: 'PADUAN_SUARA' | 'TATIB' | 'HIAS_ALTAR',
    value: string,
    isLingkungan = false
  ) => {
    if (!selectedWeekendId) return;

    // Check if this exact community assignment already exists in this session
    const alreadyExists = communityAssignments.some(
      (c) =>
        c.session_id === sessionId &&
        c.jenis_penugasan === type &&
        c.status !== 'REMOVED' &&
        ((isLingkungan && c.lingkungan_id === value) || (!isLingkungan && c.wilayah_id === value))
    );

    if (alreadyExists) return;

    const parentWilayah = isLingkungan ? (LINGKUNGAN_TO_WILAYAH[value.toUpperCase()] || '') : value;

    const newEntry: CommunityAssignment = {
      community_assignment_id: 'comm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      weekend_id: selectedWeekendId,
      session_id: sessionId,
      jenis_penugasan: type,
      status: 'ACTIVE'
    };

    if (isLingkungan) {
      newEntry.lingkungan_id = value;
      if (parentWilayah) {
        newEntry.wilayah_id = parentWilayah;
      }
    } else {
      newEntry.wilayah_id = value;
    }

    const updatedCommunity = [...communityAssignments.filter((c) => c.status !== 'REMOVED'), newEntry];
    setCommunityAssignments(updatedCommunity);

    // Auto-prune any conflicting individual officers already assigned from this choir's Wilayah (BR-013)
    let updatedAssignments = [...assignments];
    const removedNames: string[] = [];
    if (type === 'PADUAN_SUARA' && parentWilayah && !SPECIAL_WILAYAH.includes(parentWilayah.toUpperCase())) {
      const wilUpper = parentWilayah.toUpperCase();
      updatedAssignments = assignments.filter((a) => {
        if (a.status === 'REMOVED' || a.role_id === 'ROL-ORGANIS') return true;
        const p = people.find((item) => item.person_id === a.person_id || item.nama === a.person_id);
        const pWil = resolveWilayah(p?.namaLingkungan || p?.lingkungan_id, p?.namaWilayah);
        if (pWil && pWil.toUpperCase() === wilUpper) {
          removedNames.push(p?.nama || a.person_id);
          return false;
        }
        return true;
      });
      if (removedNames.length > 0) {
        setAssignments(updatedAssignments);
      }
    }

    const cleanEntry = JSON.parse(JSON.stringify(newEntry));
    const cleanCommunityList = JSON.parse(JSON.stringify(updatedCommunity));
    const cleanAssignmentsList = JSON.parse(JSON.stringify(updatedAssignments));

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          assignments: cleanAssignmentsList,
          communityAssignments: cleanCommunityList,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      await setDoc(doc(db, 'weekends', selectedWeekendId, 'community_assignments', newEntry.community_assignment_id), cleanEntry, { merge: true });

      for (const a of assignments) {
        if (!updatedAssignments.some((u) => u.assignment_id === a.assignment_id)) {
          await setDoc(
            doc(db, 'weekends', selectedWeekendId, 'assignments', a.assignment_id),
            { status: 'REMOVED' },
            { merge: true }
          );
        }
      }

      if (removedNames.length > 0) {
        alert(
          `ℹ️ Penyesuaian Mutlak Liturgi (BR-013):\n\nWilayah ${parentWilayah} telah ditugaskan sebagai Paduan Suara.\n\n${removedNames.length} petugas (${removedNames.join(', ')}) dari wilayah ini telah otomatis dilepas seketika dari penugasan individu untuk mencegah beban ganda.`
        );
      }
    } catch (err) {
      console.error('Firestore direct community error:', err);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!selectedWeekendId) return;
    const updatedAssignments = assignments.filter((a) => a.assignment_id !== assignmentId);
    const updatedCommunity = communityAssignments.filter((c) => c.community_assignment_id !== assignmentId);

    setAssignments(updatedAssignments);
    setCommunityAssignments(updatedCommunity);

    const cleanAssignments = JSON.parse(JSON.stringify(updatedAssignments));
    const cleanCommunity = JSON.parse(JSON.stringify(updatedCommunity));

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          assignments: cleanAssignments,
          communityAssignments: cleanCommunity,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      if (assignmentId.startsWith('asg-')) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'assignments', assignmentId), { status: 'REMOVED' }, { merge: true });
      } else if (assignmentId.startsWith('comm-')) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'community_assignments', assignmentId), { status: 'REMOVED' }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to remove assignment:', err);
    }
  };

  const handleAssignHiasAltarWeekend = async (wilayahName: string) => {
    if (!selectedWeekendId || !isEditable) return;

    // Check if this wilayah is doing choir this weekend (BR-052 Warning)
    const choirWilayahList = communityAssignments
      .filter((c) => c.jenis_penugasan === 'PADUAN_SUARA' && c.status !== 'REMOVED')
      .map((c) => c.wilayah_id || (c.lingkungan_id ? LINGKUNGAN_TO_WILAYAH[c.lingkungan_id.toUpperCase()] : ''))
      .filter(Boolean);

    if (choirWilayahList.map(w => w.toUpperCase()).includes(wilayahName.toUpperCase())) {
      const proceed = confirm(
        `⚠️ Peringatan Liturgi (BR-052):\n\nWilayah ${wilayahName} sudah bertugas sebagai Paduan Suara di akhir pekan ini.\n\nApakah Anda yakin ingin tetap menugaskan Wilayah ${wilayahName} sebagai Hias Altar?`
      );
      if (!proceed) return;
    }

    const existing = communityAssignments.find(
      (c) => c.jenis_penugasan === 'HIAS_ALTAR' && c.status !== 'REMOVED'
    );

    const updatedCommunity = communityAssignments.filter(
      (c) => !(c.jenis_penugasan === 'HIAS_ALTAR' && c.status !== 'REMOVED')
    );

    const newEntry: CommunityAssignment = {
      community_assignment_id: 'comm-hias-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      weekend_id: selectedWeekendId,
      session_id: 'WEEKEND',
      jenis_penugasan: 'HIAS_ALTAR',
      wilayah_id: wilayahName,
      status: 'ACTIVE'
    };

    updatedCommunity.push(newEntry);
    setCommunityAssignments(updatedCommunity);

    const cleanCommunityList = JSON.parse(JSON.stringify(updatedCommunity));
    const cleanEntry = JSON.parse(JSON.stringify(newEntry));

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          communityAssignments: cleanCommunityList,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      if (existing) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'community_assignments', existing.community_assignment_id), { status: 'REMOVED' }, { merge: true });
      }
      await setDoc(doc(db, 'weekends', selectedWeekendId, 'community_assignments', newEntry.community_assignment_id), cleanEntry, { merge: true });
    } catch (err) {
      console.error('Firestore Hias Altar save error:', err);
    }
  };

  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');

  const handleSaveDraft = async () => {
    if (!selectedWeekendId) return;
    setSaveStatus('SAVING');
    try {
      const targetDate = selectedWeekendId.replace('w-', '');
      const docRef = doc(db, 'weekends', selectedWeekendId);

      // 1. Save top-level document with full state
      await setDoc(
        docRef,
        {
          id: selectedWeekendId,
          tanggal_acuan: targetDate,
          status: 'DRAFT',
          revisi: weekendDoc?.revisi || 1,
          sessions: sessions,
          assignments: assignments,
          communityAssignments: communityAssignments,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      // 2. Sync sessions subcollection
      for (const sess of sessions) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'sessions', sess.session_id), sess, { merge: true });
      }

      // 3. Sync individual assignments subcollection
      for (const assign of assignments) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'assignments', assign.assignment_id), assign, { merge: true });
      }

      // 4. Sync community assignments subcollection
      for (const comm of communityAssignments) {
        await setDoc(doc(db, 'weekends', selectedWeekendId, 'community_assignments', comm.community_assignment_id), comm, { merge: true });
      }

      setSaveStatus('SAVED');
      setTimeout(() => {
        setSaveStatus('IDLE');
      }, 2500);
    } catch (err) {
      console.error('Failed to save draft progress:', err);
      setSaveStatus('IDLE');
    }
  };

  // Real-time Liturgical Rule Validation & Dynamic Conflict Detection
  const liveValidationSummary = useMemo(() => {
    if (!selectedWeekendId) return null;
    const targetDate = selectedWeekendId.replace('w-', '');
    return validateWeekendSchedule({
      weekendId: selectedWeekendId,
      targetDate,
      isSpecialMass: !!weekendDoc?.is_special,
      sessions,
      assignments,
      communityAssignments,
      roles: DEFAULT_ROLES,
      people,
      adjacentSchedules,
    });
  }, [selectedWeekendId, weekendDoc?.is_special, sessions, assignments, communityAssignments, people, adjacentSchedules]);

  const conflictedBlockers = useMemo(() => liveValidationSummary?.blockers || [], [liveValidationSummary]);
  const conflictedPersonIds = useMemo(
    () => new Set(conflictedBlockers.map((b) => b.personId).filter(Boolean) as string[]),
    [conflictedBlockers]
  );
  const conflictedAssignmentIds = useMemo(
    () => new Set(conflictedBlockers.map((b) => b.assignmentId).filter(Boolean) as string[]),
    [conflictedBlockers]
  );
  const conflictDetailsMap = useMemo(() => {
    const map = new Map<string, string>();
    conflictedBlockers.forEach((b) => {
      if (b.personId) map.set(b.personId, b.details);
      if (b.assignmentId) map.set(b.assignmentId, b.details);
    });
    return map;
  }, [conflictedBlockers]);

  const handleFinalize = () => {
    if (!selectedWeekendId) return;
    setValidationModalState({
      open: true,
      summary: liveValidationSummary,
    });
  };

  const handleConfirmFinalize = async () => {
    if (!selectedWeekendId) return;
    try {
      await finalizeWeekendApi({
        weekendId: selectedWeekendId,
        expectedRevision: weekendDoc?.revisi || 1
      });
      setWeekendDoc((prev: any) => (prev ? { ...prev, status: 'FINAL' } : null));
      alert('✓ Jadwal berhasil difinalisasi resmi untuk warta umat!');
    } catch (error) {
      console.error('Finalize failed:', error);
      alert('Gagal memfinalisasi jadwal.');
    }
  };

  const handleRemoveConflictedAssignments = async (conflictedPersonIds: string[], conflictedAssignmentIds: string[]) => {
    if (!selectedWeekendId) return;

    const personIdSet = new Set(conflictedPersonIds.map((id) => id.toLowerCase().trim()));
    const asgIdSet = new Set(conflictedAssignmentIds);

    const updatedAssignments = assignments.filter((a) => {
      if (asgIdSet.has(a.assignment_id)) return false;
      const pId = (a.person_id || '').toLowerCase().trim();
      if (personIdSet.has(pId)) return false;
      return true;
    });

    const removedCount = assignments.length - updatedAssignments.length;
    setAssignments(updatedAssignments);
    setValidationModalState((prev) => ({ ...prev, open: false }));

    const cleanAssignments = JSON.parse(JSON.stringify(updatedAssignments));

    try {
      await setDoc(
        doc(db, 'weekends', selectedWeekendId),
        {
          assignments: cleanAssignments,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      for (const a of assignments) {
        if (!updatedAssignments.some((u) => u.assignment_id === a.assignment_id)) {
          await setDoc(
            doc(db, 'weekends', selectedWeekendId, 'assignments', a.assignment_id),
            { status: 'REMOVED' },
            { merge: true }
          );
        }
      }
      alert(`✓ ${removedCount} penugasan petugas yang bentrok telah berhasil dilepas.`);
    } catch (err) {
      console.error('Failed to remove conflicted assignments:', err);
    }
  };

  // Progress Checklist Calculation
  const progressMap = useMemo(() => {
    const map: Record<string, any[]> = {};

    sessions.forEach((s) => {
      map[s.session_id] = DEFAULT_ROLES.map((r) => {
        const filled = assignments.filter(
          (a) => a.session_id === s.session_id && a.role_id === r.role_id && a.status !== 'REMOVED'
        ).length;

        return {
          roleId: r.role_id,
          namaPeran: r.nama_peran,
          dibutuhkan: r.jumlah_dibutuhkan,
          terisi: filled,
          status: filled >= r.jumlah_dibutuhkan ? 'TERPENUHI' : 'BELUM_LENGKAP'
        };
      });
    });

    return map;
  }, [sessions, assignments]);

  const activeSession = sessions.find((s) => s.session_id === activeSessionId) || sessions[0];

  const selectedDateObj = selectedWeekendId
    ? new Date(selectedWeekendId.replace('w-', '') + 'T00:00:00')
    : null;
  const currentLiturgicalInfo = selectedDateObj ? getLiturgicalInfo(selectedDateObj) : null;

  const currentWeekendData: any = selectedWeekendId ? {
    id: selectedWeekendId,
    date: selectedWeekendId.replace('w-', ''),
    weekend_id: selectedWeekendId,
    tanggal_acuan: selectedWeekendId.replace('w-', ''),
    status: (weekendDoc?.status as 'DRAFT' | 'FINAL') || 'DRAFT',
    revision: weekendDoc?.revisi || 1,
    title: currentLiturgicalInfo?.title || 'Jadwal Liturgi',
  } : null;

  const formattedHeaderSessions = sessions.map((s) => ({
    id: s.session_id,
    name: s.nama_khusus || (s.jenis_sesi === 'SABTU_SORE' ? 'Sabtu Sore' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Minggu Pagi' : 'Minggu Sore'),
    time: s.jenis_sesi === 'MINGGU_PAGI' ? '08.00 WIB' : '17.00 WIB',
  }));

  return (
    <div className="space-y-6 max-w-[94rem] mx-auto">
      <AnimatePresence mode="wait">
        {!selectedWeekendId ? (
          <motion.div
            key="calendar-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 will-change-[opacity,transform]"
          >
            {/* Header & Month Navigation Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/90 shadow-sm">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink text-accent text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>📅</span>
                  <span>Kalender Liturgi KWI</span>
                </div>
                <h1 className="text-3xl font-display font-bold text-ink tracking-tight">
                  {MONTH_NAMES[month]} {year}
                </h1>
                <p className="text-xs text-ink-soft mt-0.5">
                  Arahkan kursor ke tanggal untuk preview jadwal, atau klik untuk membuka ruang kerja studio misa.
                </p>
              </div>

              {/* Action Buttons & Month Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOfficerSearchModalOpen(true)}
                  className="rounded-xl font-bold text-xs bg-white hover:bg-surface border-surface-muted shadow-2xs flex items-center gap-1.5"
                >
                  <span>🔍</span>
                  <span>Cek Tugas Petugas</span>
                </Button>

                {onOpenPrint && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenPrint}
                    className="rounded-xl font-bold text-xs bg-white hover:bg-surface border-surface-muted shadow-2xs flex items-center gap-1.5"
                  >
                    <span>🖨️</span>
                    <span>Cetak Warta</span>
                  </Button>
                )}

                {/* Month Switcher Controls */}
                <div className="flex items-center gap-1 backdrop-blur-xl bg-surface/80 p-1 rounded-2xl border border-surface-muted shadow-xs">
                  <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 px-2.5 rounded-xl font-bold">
                    ‹
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleToday} className="h-8 px-2.5 text-xs font-bold rounded-xl bg-white shadow-2xs">
                    Bulan Ini
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 px-2.5 rounded-xl font-bold">
                    ›
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter Pills & Liturgical Legend Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-xs">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua Tanggal' },
                  { id: 'HAS_SCHEDULE', label: '📋 Ada Jadwal' },
                  { id: 'NO_SCHEDULE', label: '⚠️ Belum Terjadwal' },
                  { id: 'READY', label: '• Draft' },
                  { id: 'FINAL', label: '✓ Resmi (Final)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCalendarFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer spring-press ${
                      calendarFilter === f.id
                        ? 'bg-ink text-white shadow-xs'
                        : 'bg-surface text-ink-soft hover:text-ink hover:bg-surface-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Liturgical Colors Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
                  <span>Hijau (Biasa)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6A1B9A]" />
                  <span>Ungu (Tobat)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C62828]" />
                  <span>Merah (Martir)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] border border-amber-400" />
                  <span>Putih/Emas (Hari Raya)</span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 1. DEDICATED MOBILE CALENDAR VIEW (< sm screens) */}
            {/* ========================================================================= */}
            <div className="block sm:hidden space-y-4">
              {/* Mobile View Mode Switcher */}
              <div className="flex bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setMobileCalendarView('GRID')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer spring-press ${
                    mobileCalendarView === 'GRID'
                      ? 'bg-ink text-accent shadow-xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <span>📅</span>
                  <span>Kalender Ringkas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCalendarView('LIST')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer spring-press ${
                    mobileCalendarView === 'LIST'
                      ? 'bg-ink text-accent shadow-xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <span>📋</span>
                  <span>Daftar Pekan ({monthWeekendList.length})</span>
                </button>
              </div>

              {mobileCalendarView === 'GRID' ? (
                <div className="space-y-4">
                  {/* Clean iOS-Style Compact 7-Col Month Grid */}
                  <Card className="p-3 bg-white/90 backdrop-blur-xl rounded-3xl border border-white/90 shadow-md">
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {/* Day Headers (1-2 chars) */}
                      {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
                        <span
                          key={d}
                          className={`py-1 text-[11px] font-bold rounded-lg ${
                            i === 0 || i === 6 ? 'text-amber-900 bg-amber-500/15' : 'text-ink-soft'
                          }`}
                        >
                          {d}
                        </span>
                      ))}

                      {/* Day Cells (Square, Centered Number + Dot) */}
                      {calendarDays.map((day, idx) => {
                        const dateObj = new Date(day.dateStr + 'T00:00:00');
                        const lit = getLiturgicalInfo(dateObj);
                        const existingSchedule = schedules.find(
                          (s) => s.tanggalAcuan === day.matchingSundayStr || s.tanggalAcuan === day.dateStr
                        );
                        const isSelected = mobileSelectedDate === day.dateStr;
                        const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                        const isSundayOrSolemnity = day.isSunday || lit.rank === 'HARI_RAYA' || lit.color === 'PUTIH';

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMobileSelectedDate(day.dateStr);
                            }}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center relative cursor-pointer transition-all ${
                              !day.isCurrentMonth
                                ? 'opacity-25'
                                : isSelected
                                ? 'bg-ink text-white font-bold shadow-md ring-2 ring-emerald-700'
                                : existingSchedule?.status === 'FINAL'
                                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300/60'
                                : existingSchedule
                                ? 'bg-[#D8EB73]/50 text-ink font-bold border border-[#D8EB73]'
                                : isSundayOrSolemnity
                                ? 'bg-amber-400/20 text-amber-950 font-bold hover:bg-amber-400/30'
                                : 'text-ink hover:bg-surface'
                            } ${isToday && !isSelected ? 'ring-2 ring-emerald-600 ring-offset-1' : ''}`}
                          >
                            <span className="text-xs font-mono">{day.dayNumber}</span>
                            {/* Liturgical Dot */}
                            {day.isCurrentMonth && (
                              <span
                                className="w-1.5 h-1.5 rounded-full mt-0.5"
                                style={{
                                  backgroundColor:
                                    lit.color === 'HIJAU'
                                      ? '#2E7D32'
                                      : lit.color === 'UNGU'
                                      ? '#6A1B9A'
                                      : lit.color === 'MERAH'
                                      ? '#C62828'
                                      : lit.color === 'MERAH_MUDA'
                                      ? '#E91E63'
                                      : '#D4AF37'
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Selected Date Action Card */}
                  {activeMobileSelectedDay && (
                    <Card className="p-5 bg-gradient-to-b from-white to-[#F6F9ED] rounded-3xl border border-[#022C12]/20 shadow-md space-y-3.5">
                      <div className="flex items-center justify-between border-b border-surface-muted pb-2.5">
                        <span className="text-xs font-mono font-bold text-ink-soft">
                          {activeMobileSelectedDay.dateFormatted}
                        </span>
                        {activeMobileSelectedDay.existingSchedule ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              activeMobileSelectedDay.existingSchedule.status === 'FINAL'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#022C12] text-[#D8EB73]'
                            }`}
                          >
                            {activeMobileSelectedDay.existingSchedule.status === 'FINAL' ? '✓ Resmi' : '• Draft'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-muted text-ink-soft text-[10px] font-bold">
                            Belum Ada Jadwal
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-base font-display font-bold text-ink leading-snug">
                          {activeMobileSelectedDay.lit.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                          <span>
                            {activeMobileSelectedDay.lit.color === 'HIJAU'
                              ? '🟢 Hijau'
                              : activeMobileSelectedDay.lit.color === 'UNGU'
                              ? '🟣 Ungu'
                              : activeMobileSelectedDay.lit.color === 'MERAH'
                              ? '🔴 Merah'
                              : '⚪ Putih'}{' '}
                            • {activeMobileSelectedDay.lit.seasonName}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        onClick={() =>
                          handleDateCellClick(
                            activeMobileSelectedDay.day.dateStr,
                            activeMobileSelectedDay.day.isSaturday,
                            activeMobileSelectedDay.day.isSunday,
                            activeMobileSelectedDay.day.matchingSundayStr
                          )
                        }
                        className="w-full font-bold text-xs shadow-md spring-press rounded-xl py-2.5"
                      >
                        {activeMobileSelectedDay.existingSchedule
                          ? '🗓️ Buka Studio Jadwal Sesi Misa ➔'
                          : '+ Buat Jadwal Misa Baru ➔'}
                      </Button>
                    </Card>
                  )}
                </div>
              ) : (
                /* Mobile View Mode: DAFTAR AKHIR PEKAN (Card Feed) */
                <div className="space-y-3">
                  {monthWeekendList.map((item, idx) => (
                    <Card
                      key={idx}
                      className="p-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-white shadow-sm space-y-3 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-soft">
                          {item.dateFormatted}
                        </span>
                        {item.existingSchedule ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.existingSchedule.status === 'FINAL'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#022C12] text-[#D8EB73]'
                            }`}
                          >
                            {item.existingSchedule.status === 'FINAL' ? '✓ Resmi' : '• Draft'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-muted text-ink-soft text-[10px] font-bold">
                            Belum Terjadwal
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-display font-bold text-sm text-ink leading-snug">
                          {item.lit.title}
                        </h4>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {item.lit.color === 'HIJAU'
                            ? '🟢 Hijau'
                            : item.lit.color === 'UNGU'
                            ? '🟣 Ungu'
                            : item.lit.color === 'MERAH'
                            ? '🔴 Merah'
                            : '⚪ Putih'}{' '}
                          • {item.lit.seasonName}
                        </p>
                      </div>

                      <Button
                        variant={item.existingSchedule ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() =>
                          handleDateCellClick(
                            item.sunday.dateStr,
                            item.sunday.isSaturday,
                            item.sunday.isSunday,
                            item.sunday.matchingSundayStr
                          )
                        }
                        className="w-full font-bold text-xs rounded-xl"
                      >
                        {item.existingSchedule ? '🗓️ Buka Studio Jadwal ➔' : '+ Buat Jadwal ➔'}
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 2. DESKTOP CALENDAR VIEW (>= sm screens) */}
            {/* ========================================================================= */}
            <Card className="hidden sm:block p-4 md:p-6 backdrop-blur-3xl bg-white/85 rounded-3xl border border-white/90 shadow-xl relative">
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {/* Day of Week Headers */}
                {DAY_NAMES.map((name, i) => (
                  <div
                    key={name}
                    className={`text-center py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl ${
                      i >= 5 ? 'bg-amber-400/20 text-ink font-bold border border-amber-400/30' : 'text-ink-soft bg-surface/50'
                    }`}
                  >
                    {name}
                  </div>
                ))}

                {/* Calendar Day Tiles */}
                {calendarDays.map((day, idx) => {
                  const dateObj = new Date(day.dateStr + 'T00:00:00');
                  const lit = getLiturgicalInfo(dateObj);

                  const existingSchedule = schedules.find(
                    (s) => s.tanggalAcuan === day.matchingSundayStr || s.tanggalAcuan === day.dateStr
                  );

                  const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                  const isSundayOrSolemnity = day.isSunday || lit.rank === 'HARI_RAYA' || lit.color === 'PUTIH';

                  // Check if filtered out
                  const isMatchFilter = (() => {
                    if (calendarFilter === 'ALL') return true;
                    if (calendarFilter === 'HAS_SCHEDULE') return !!existingSchedule;
                    if (calendarFilter === 'NO_SCHEDULE') return !existingSchedule && (day.isSunday || day.isSaturday);
                    if (calendarFilter === 'READY') return existingSchedule?.status === 'DRAFT';
                    if (calendarFilter === 'FINAL') return existingSchedule?.status === 'FINAL';
                    return true;
                  })();

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDateCellClick(day.dateStr, day.isSaturday, day.isSunday, day.matchingSundayStr)}
                      onMouseEnter={(e) => {
                        setHoveredDateInfo({
                          day,
                          lit,
                          schedule: existingSchedule,
                          clientX: e.clientX,
                          clientY: e.clientY
                        });
                      }}
                      onMouseMove={(e) => {
                        setHoveredDateInfo({
                          day,
                          lit,
                          schedule: existingSchedule,
                          clientX: e.clientX,
                          clientY: e.clientY
                        });
                      }}
                      onMouseLeave={() => setHoveredDateInfo(null)}
                      className={`min-h-[125px] md:min-h-[155px] p-2.5 md:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between cursor-pointer group relative overflow-hidden select-none spring-press ${
                        !isMatchFilter
                          ? 'opacity-20 grayscale pointer-events-none'
                          : !day.isCurrentMonth
                          ? 'bg-surface/30 border-transparent opacity-40 hover:opacity-75'
                          : isSundayOrSolemnity
                          ? 'bg-gradient-to-b from-amber-500/10 via-white to-white border-amber-400/40 shadow-xs hover:border-amber-500 hover:shadow-lg'
                          : day.isSaturday
                          ? 'bg-white border-surface-muted shadow-2xs hover:border-ink/40 hover:shadow-md'
                          : 'bg-surface/45 border-surface-muted/60 hover:bg-white hover:border-ink/30 hover:shadow-sm'
                      } ${isToday ? 'ring-2 ring-emerald-600 ring-offset-2' : ''}`}
                    >
                      {/* Liturgical Color Top Stripe */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5"
                        style={{
                          backgroundColor:
                            lit.color === 'HIJAU'
                              ? '#2E7D32'
                              : lit.color === 'UNGU'
                              ? '#6A1B9A'
                              : lit.color === 'MERAH'
                              ? '#C62828'
                              : lit.color === 'MERAH_MUDA'
                              ? '#E91E63'
                              : '#D4AF37'
                        }}
                      />

                      {/* Day Header */}
                      <div className="flex justify-between items-start pt-1">
                        <span
                          className={`text-xs font-bold rounded-xl w-7 h-7 flex items-center justify-center font-mono transition-transform group-hover:scale-110 ${
                            isToday
                              ? 'bg-emerald-900 text-white shadow-xs'
                              : isSundayOrSolemnity
                              ? 'bg-amber-400/30 text-amber-950 font-bold border border-amber-400/40'
                              : 'text-ink bg-surface/60'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {/* Liturgical Color Dot */}
                        <div className="flex items-center gap-1">
                          {isSundayOrSolemnity && (
                            <span className="text-[10px]" title="Hari Raya / Minggu">✨</span>
                          )}
                          <span
                            className="w-2.5 h-2.5 rounded-full shadow-2xs"
                            style={{
                              backgroundColor:
                                lit.color === 'HIJAU'
                                  ? '#2E7D32'
                                  : lit.color === 'UNGU'
                                  ? '#6A1B9A'
                                  : lit.color === 'MERAH'
                                  ? '#C62828'
                                  : lit.color === 'MERAH_MUDA'
                                  ? '#E91E63'
                                  : '#D4AF37'
                            }}
                          />
                        </div>
                      </div>

                      {/* Feast Day Title or Existing Schedule Badge */}
                      <div className="my-1 space-y-1">
                        {existingSchedule ? (() => {
                          const daySessions = existingSchedule.sessions.filter((s: any) => {
                            if (day.isSaturday) return s.jenis === 'SABTU_SORE';
                            if (day.isSunday) return s.jenis === 'MINGGU_PAGI' || s.jenis === 'MINGGU_SORE';
                            return true;
                          });
                          const sessionLabel = day.isSaturday
                            ? '1 Sesi (Sabtu Sore)'
                            : day.isSunday
                            ? `${daySessions.length} Sesi (${daySessions.map((s: any) => s.nama).join(', ') || 'Minggu Pagi'})`
                            : `${existingSchedule.sessions.length} Sesi`;

                          return (
                            <div
                              className={`p-2 rounded-xl text-[10px] font-bold border transition-colors shadow-2xs ${
                                existingSchedule.status === 'FINAL'
                                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/30'
                                  : 'bg-[#D8EB73]/40 text-ink border-[#D8EB73]'
                              }`}
                            >
                              <div className="truncate font-display text-xs">{existingSchedule.namaKegiatan}</div>
                              <div className="text-[9px] opacity-80 mt-0.5 flex justify-between items-center">
                                <span>{existingSchedule.status === 'FINAL' ? '✓ Resmi' : '• Draft'}</span>
                                <span className="font-mono font-semibold">{sessionLabel}</span>
                              </div>
                            </div>
                          );
                        })() : (day.isSunday || day.isSaturday) && day.isCurrentMonth ? (
                          <div className="p-1.5 rounded-xl bg-surface/60 border border-dashed border-surface-muted text-[10px] font-medium text-ink-soft leading-tight group-hover:border-ink/30 group-hover:text-ink">
                            <div className="truncate font-semibold text-[10px]">{lit.title}</div>
                            <div className="text-[9px] text-amber-900/80 font-bold mt-0.5 flex items-center gap-1">
                              <span>+ Buat Jadwal</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] font-medium text-ink-soft leading-tight truncate group-hover:text-ink px-1">
                            {lit.title}
                          </div>
                        )}
                      </div>

                      {/* Footer Action Hint */}
                      <div className="text-[9px] font-bold text-ink-soft flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-surface-muted/40">
                        <span className="text-emerald-900">{existingSchedule ? 'Buka Studio' : '+ Tambah'}</span>
                        <span>➔</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Floating Luxury Glass Quick Preview Tooltip rendered via createPortal into document.body */}
            {typeof document !== 'undefined' &&
              createPortal(
                <AnimatePresence>
                  {hoveredDateInfo && (() => {
                    const tooltipWidth = 310;
                    const tooltipHeight = 175;
                    const margin = 16;
                    const screenW = window.innerWidth;
                    const screenH = window.innerHeight;

                    let left = hoveredDateInfo.clientX - tooltipWidth / 2;
                    if (left < margin) left = margin;
                    if (left + tooltipWidth > screenW - margin) {
                      left = screenW - tooltipWidth - margin;
                    }

                    // Default: place directly above mouse cursor
                    let top = hoveredDateInfo.clientY - tooltipHeight - 16;
                    // If not enough room at top of viewport, flip to below mouse cursor
                    if (top < margin) {
                      top = hoveredDateInfo.clientY + 24;
                    }
                    // If bottom overflows screen, clamp
                    if (top + tooltipHeight > screenH - margin) {
                      top = screenH - tooltipHeight - margin;
                    }

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          position: 'fixed',
                          left: `${left}px`,
                          top: `${top}px`,
                          zIndex: 999999,
                        }}
                        className="w-[310px] p-4 rounded-3xl bg-[#022C12]/95 backdrop-blur-2xl border border-amber-400/50 shadow-2xl text-white pointer-events-none space-y-2.5 transform-gpu select-none"
                      >
                        <div className="flex justify-between items-start gap-2 border-b border-white/15 pb-2">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                              {hoveredDateInfo.lit.seasonName || hoveredDateInfo.lit.season} • Warna: {hoveredDateInfo.lit.color}
                            </div>
                            <h4 className="font-display font-bold text-sm text-white leading-snug mt-0.5">
                              {hoveredDateInfo.lit.title}
                            </h4>
                          </div>
                          <span className="text-xs font-mono font-bold bg-white/10 px-2 py-0.5 rounded-lg text-accent shrink-0">
                            {hoveredDateInfo.day.dayNumber} {MONTH_NAMES[month]}
                          </span>
                        </div>

                        {hoveredDateInfo.schedule ? (() => {
                          const isSat = hoveredDateInfo.day.isSaturday;
                          const isSun = hoveredDateInfo.day.isSunday;
                          const activeDaySessions = hoveredDateInfo.schedule.sessions.filter((s: any) => {
                            if (isSat) return s.jenis === 'SABTU_SORE';
                            if (isSun) return s.jenis === 'MINGGU_PAGI' || s.jenis === 'MINGGU_SORE';
                            return true;
                          });

                          return (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between text-white/80 text-[11px]">
                                <span>Status: <strong className="text-white">{hoveredDateInfo.schedule.status === 'FINAL' ? '✓ Resmi' : 'Draft'}</strong></span>
                                <span className="text-amber-300 font-mono">
                                  {activeDaySessions.length} Sesi Misa Hari Ini
                                </span>
                              </div>
                              <div className="bg-white/10 p-2 rounded-xl text-[11px] text-white/90 space-y-1">
                                {activeDaySessions.length > 0 ? (
                                  activeDaySessions.map((s: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center">
                                      <span>• {s.nama}</span>
                                      <span className="font-mono text-amber-300">{s.waktu}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-white/70 italic text-[10px]">
                                    Jadwal pekan ini: {hoveredDateInfo.schedule.sessions.map((s: any) => `${s.nama} (${s.waktu})`).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="text-xs text-white/70 bg-white/5 p-2 rounded-xl">
                            Belum ada jadwal penugasan pada tanggal ini.
                          </div>
                        )}

                        <div className="text-[10px] text-amber-300/90 font-bold flex items-center justify-between pt-1">
                          <span>Klik untuk masuk ruang kerja</span>
                          <span>➔</span>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>,
                document.body
              )}
          </motion.div>
        ) : (
          /* MODE 2: ADAPTIVE WORKSPACE & LEFT MINI-CALENDAR SIDEBAR */
          <motion.div
            key="calendar-workspace"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 will-change-[opacity,transform]"
          >
            {/* Workspace Top Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-surface-muted">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedWeekendId(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-surface border border-surface-muted text-ink text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer spring-press"
                >
                  <span>⛶</span>
                  <span>Tampilkan Kalender Penuh</span>
                </button>
                <div className="text-xs font-bold text-ink-soft">
                  Mode Ruang Kerja Penjadwalan
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenPrint || (() => {})}
                  className="rounded-xl font-bold text-xs"
                >
                  🖨️ Cetak Warta
                </Button>
                {userRole === 'ADMIN' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFinalize}
                    className="rounded-xl font-bold text-xs shadow-md"
                  >
                    ✓ Finalisasi Jadwal
                  </Button>
                )}
              </div>
            </div>

            {/* Workspace Header Banner */}
            <WorkspaceHeader
              weekend={currentWeekendData}
              sessions={formattedHeaderSessions as any}
              userRole={userRole}
              onOpenWeekend={() => {}}
              onFinalize={handleFinalize}
              onPrint={onOpenPrint || (() => {})}
              onAutoAssign={handleTriggerAutoAssign}
              onSaveDraft={handleSaveDraft}
              saveStatus={saveStatus}
              isRevisionUnlocked={isRevisionUnlocked}
              onUnlockRevision={() => setIsRevisionUnlocked(true)}
            />

            {/* Weekend-Level Dedicated Hias Altar Banner (1 Wilayah Per Pekan) */}
            {selectedWeekendId && (() => {
              const currentHiasAltar = communityAssignments.find(
                (c) => c.jenis_penugasan === 'HIAS_ALTAR' && c.status !== 'REMOVED'
              );

              return (
                <div className="p-4 md:p-5 rounded-3xl bg-white/80 backdrop-blur-2xl border border-emerald-900/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-700/10 border border-emerald-700/20 text-emerald-800 flex items-center justify-center text-xl shrink-0 shadow-2xs">
                      🌿
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-ink text-sm md:text-base">
                          Penugasan Hias Altar Akhir Pekan
                        </h3>
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300/60">
                          1 Wilayah / Pekan
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft">
                        Wilayah yang bertugas mendekorasi & merangkai bunga altar untuk seluruh rangkaian misa pekan ini.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {currentHiasAltar ? (
                      <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200 shadow-2xs">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <span>✨</span>
                          <span>Wilayah {currentHiasAltar.wilayah_id}</span>
                        </span>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(currentHiasAltar.community_assignment_id)}
                            className="text-emerald-800 hover:text-danger text-xs font-bold ml-1 p-0.5 rounded hover:bg-danger/10 cursor-pointer"
                            title="Hapus Hias Altar"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : isEditable ? (
                      <div className="w-full md:w-72">
                        <Select
                          options={PARISH_WILAYAH_LIST.filter((w) => !SPECIAL_WILAYAH.includes(w.nama)).map((w) => ({
                            value: w.nama,
                            label: `Wilayah ${w.nama}`
                          }))}
                          placeholder="-- Pilih Wilayah Hias Altar --"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            handleAssignHiasAltarWeekend(val);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-soft italic">Belum ada wilayah hias altar</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3-Column Studio Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Mini-Calendar Picker & Session Stepper (col-span-3) */}
              <div className="lg:col-span-3 space-y-4">
                {/* Mobile Mini-Calendar Toggle Trigger (< lg) */}
                <div className="lg:hidden flex items-center justify-between bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-white shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📅</span>
                    <span className="text-xs font-bold text-ink">Mini Kalender Liturgi</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowMobileMiniCal(!showMobileMiniCal)}
                    className="text-xs font-bold h-8 px-3 rounded-xl bg-white"
                  >
                    {showMobileMiniCal ? '▲ Tutup' : '▼ Buka'}
                  </Button>
                </div>

                {/* Mini Month Calendar (Always visible on lg+, toggleable on mobile) */}
                <div className={`p-4 rounded-3xl bg-white/85 backdrop-blur-2xl border border-white/90 shadow-md space-y-3 ${showMobileMiniCal ? 'block' : 'hidden lg:block'}`}>
                  <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      {MONTH_NAMES[month]} {year}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={handlePrevMonth}
                        className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-xs text-ink font-bold hover:bg-surface-muted cursor-pointer"
                      >
                        ‹
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-xs text-ink font-bold hover:bg-surface-muted cursor-pointer"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  {/* Compact Mini Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                    {DAY_NAMES.map((d) => (
                      <span key={d} className="font-bold text-ink-soft py-0.5">
                        {d.charAt(0)}
                      </span>
                    ))}
                    {calendarDays.map((day, idx) => {
                      const hasWkd = schedules.find((s) => s.tanggalAcuan === day.matchingSundayStr || s.tanggalAcuan === day.dateStr);
                      const isCur = selectedWeekendId === `w-${day.matchingSundayStr}` || selectedWeekendId === `w-${day.dateStr}`;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleDateCellClick(day.dateStr, day.isSaturday, day.isSunday, day.matchingSundayStr)}
                          className={`h-7 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
                            !day.isCurrentMonth
                              ? 'opacity-30'
                              : isCur
                              ? 'bg-ink text-white font-bold shadow-xs'
                              : hasWkd
                              ? 'bg-accent/40 text-ink font-bold hover:bg-accent'
                              : day.isSunday
                              ? 'text-danger font-bold hover:bg-surface'
                              : 'text-ink hover:bg-surface'
                          }`}
                        >
                          {day.dayNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Session Stepper (Desktop lg+) */}
                <div className="hidden lg:block p-4 rounded-3xl bg-white/85 backdrop-blur-2xl border border-white/90 shadow-md">
                  <SessionNavTabs
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelectSession={setActiveSessionId}
                    assignments={assignments}
                    communityAssignments={communityAssignments}
                    roles={DEFAULT_ROLES}
                    isEditable={isEditable}
                    onAddSession={isEditable ? () => setIsAddSessionModalOpen(true) : undefined}
                    onDeleteSession={isEditable ? handleDeleteSession : undefined}
                  />
                </div>
              </div>

              {/* Center Column: Mass Assignment Canvas (col-span-6) */}
              <div className="lg:col-span-6 space-y-4">
                {/* Mobile Quick Session Switcher (< lg) */}
                <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 bg-surface-muted/60 p-1.5 rounded-2xl border border-surface-muted">
                  {sessions.map((s) => (
                    <button
                      key={s.session_id}
                      type="button"
                      onClick={() => setActiveSessionId(s.session_id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer spring-press ${
                        s.session_id === activeSessionId
                          ? 'bg-ink text-accent shadow-xs'
                          : 'bg-white/70 text-ink-soft hover:bg-white hover:text-ink'
                      }`}
                    >
                      <span>{s.jenis_sesi === 'SABTU_SORE' ? 'Sabtu 17.00' : s.jenis_sesi === 'MINGGU_PAGI' ? 'Minggu 07.00' : s.nama_khusus || 'Minggu 17.00'}</span>
                    </button>
                  ))}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setIsAddSessionModalOpen(true)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-ink border border-surface-muted whitespace-nowrap hover:bg-surface cursor-pointer spring-press"
                    >
                      + Sesi
                    </button>
                  )}
                </div>

                {activeSession ? (
                  <SessionCard
                    key={activeSession.session_id}
                    session={activeSession}
                    assignments={assignments.filter((a) => a.session_id === activeSession.session_id)}
                    communityAssignments={communityAssignments.filter(
                      (c) => c.session_id === activeSession.session_id
                    )}
                    roles={DEFAULT_ROLES}
                    isEditable={isEditable}
                    conflictedPersonIds={conflictedPersonIds}
                    conflictedAssignmentIds={conflictedAssignmentIds}
                    conflictDetailsMap={conflictDetailsMap}
                    onOpenSelectModal={handleOpenSelectModal}
                    onAssignCommunity={handleAssignCommunity}
                    onRemoveAssignment={handleRemoveAssignment}
                    wilayahList={PARISH_WILAYAH_LIST}
                    lingkunganList={PARISH_LINGKUNGAN_LIST}
                    people={people}
                  />
                ) : (
                  <Card className="p-8 md:p-12 text-center bg-white/85 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-md space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-2xl mx-auto">
                      ⛪
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-display font-bold text-ink">
                        Belum Ada Sesi Misa Terdaftar
                      </h3>
                      <p className="text-xs text-ink-soft max-w-sm mx-auto">
                        {isEditable
                          ? 'Tanggal hari kerja ini belum memiliki sesi misa. Klik tombol di bawah untuk menambahkan sesi misa harian atau perayaan khusus.'
                          : 'Belum ada jadwal penugasan misa yang terdaftar pada tanggal ini.'}
                      </p>
                    </div>
                    {isEditable && (
                      <Button
                        variant="primary"
                        onClick={() => setIsAddSessionModalOpen(true)}
                        className="font-bold text-xs shadow-md spring-press mx-auto"
                      >
                        + Tambah Sesi Misa
                      </Button>
                    )}
                  </Card>
                )}
              </div>

              {/* Right Column: Completion Checklist (col-span-3) */}
              <div className="lg:col-span-3">
                <div className="sticky top-20">
                  <StatusPanel
                    sessions={formattedHeaderSessions}
                    progressMap={progressMap}
                    communityAssignments={communityAssignments}
                    conflicts={conflictedBlockers as any}
                    onRemoveConflicted={handleRemoveConflictedAssignments}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Select Officer Modal */}
      <SelectOfficerModal
        open={selectModalState.open}
        onClose={() => setSelectModalState((prev) => ({ ...prev, open: false }))}
        sessionName={selectModalState.sessionName}
        role={selectModalState.role}
        availablePeople={people}
        isAdmin={userRole === 'ADMIN'}
        currentAssignments={assignments.filter(
          (a) =>
            a.session_id === selectModalState.sessionId &&
            a.role_id === selectModalState.role?.role_id &&
            a.status !== 'REMOVED'
        )}
        allWeekendAssignments={assignments}
        adjacentAssignments={adjacentSchedules.flatMap((s) => s.assignments || [])}
        allWeekendCommunity={communityAssignments}
        onSave={handleAssignOfficers}
      />

      {/* Add Special Session Modal */}
      <Dialog
        open={isAddSessionModalOpen}
        onClose={() => setIsAddSessionModalOpen(false)}
        title="Tambah Sesi Misa"
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Nama Sesi / Ujud Misa"
            placeholder="Contoh: Misa Pagi, Misa Krisma, Misa Syukur"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
          />
          <Input
            label="Jam Pelaksanaan"
            placeholder="Contoh: 06.00 WIB, 18.00 WIB"
            value={newSessionTime}
            onChange={(e) => setNewSessionTime(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsAddSessionModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleAddSession}
              disabled={!newSessionName.trim()}
            >
              Simpan Sesi
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 1-Click Smart Auto-Assign Simulation Modal */}
      <AutoAssignPreviewModal
        open={isAutoAssignOpen}
        onClose={() => setIsAutoAssignOpen(false)}
        onApply={handleApplyAutoAssign}
        result={autoAssignResult}
        isLoading={isApplyingAutoAssign}
      />

      {/* Pre-Flight Liturgical Rule Validation Modal */}
      <RuleValidationModal
        open={validationModalState.open}
        onClose={() => setValidationModalState((prev) => ({ ...prev, open: false }))}
        summary={validationModalState.summary}
        onConfirmFinalize={handleConfirmFinalize}
        onRemoveConflicted={handleRemoveConflictedAssignments}
        weekendTitle={currentWeekendData?.nama_kegiatan || 'Jadwal Misa'}
      />

      {/* Officer Quick Search Modal */}
      <Dialog
        open={isOfficerSearchModalOpen}
        onClose={() => setIsOfficerSearchModalOpen(false)}
        title="🔍 Cek Riwayat & Kualifikasi Petugas"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Input
            label="Ketik Nama Petugas atau Lingkungan"
            placeholder="Contoh: Carolus, Agatha, St. Mikael..."
            value={officerSearchTerm}
            onChange={(e) => setOfficerSearchTerm(e.target.value)}
          />

          {officerSearchTerm.trim().length >= 2 ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-ink-soft">
                Hasil Pencarian ({searchedOfficers.length} ditemukan):
              </span>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchedOfficers.map((o, idx) => {
                  const roles: string[] = [];
                  if (o.organis) roles.push('Organis');
                  if (o.mazmur) roles.push('Pemazmur');
                  if (o.lektor) roles.push('Lektor');
                  if (o.misdinar) roles.push('Misdinar');
                  if (o.prodiakon) roles.push('Prodiakon');

                  return (
                    <div key={idx} className="p-3 bg-surface rounded-xl border border-surface-muted space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-ink">{o.nama}</span>
                        <span className="text-xs text-ink-soft">Wilayah {o.wilayah}</span>
                      </div>
                      <div className="text-xs text-ink-soft">Lingkungan {o.lingkungan}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {roles.map((r) => (
                          <span key={r} className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-surface-muted">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-soft">
              Ketik minimal 2 huruf untuk mencari data dari 172 petugas liturgi paroki.
            </p>
          )}

          <div className="flex justify-end pt-2 border-t border-surface-muted">
            <Button variant="secondary" onClick={() => setIsOfficerSearchModalOpen(false)} className="rounded-xl text-xs font-bold">
              Tutup
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
