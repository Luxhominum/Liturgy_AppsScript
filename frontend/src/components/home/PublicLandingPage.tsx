import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card, Button, Badge, Chip, Dialog, ParishLogo } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { getLiturgicalInfo } from '../../utils/liturgicalCalendar';
import { REAL_OFFICERS_DATA } from '../../data/realOfficers';

interface PublicLandingPageProps {
  onOpenWorkspace: () => void;
  onOpenCalendar: (targetDate?: string) => void;
  onPrintSchedule: () => void;
}

interface OfficerDutyMatch {
  nama: string;
  lingkungan: string;
  wilayah: string;
  peranList: string[];
  assignedSession?: string;
  assignedRole?: string;
  assignedDate?: string;
}

export default function PublicLandingPage({
  onOpenWorkspace,
  onOpenCalendar,
  onPrintSchedule
}: PublicLandingPageProps) {
  const [activeWeekend, setActiveWeekend] = useState<{
    id: string;
    title: string;
    dateStr: string;
    status: string;
    assignments?: any[];
    communityAssignments?: any[];
    sessions?: any[];
  } | null>(null);

  const [upcomingSpecials, setUpcomingSpecials] = useState<{
    title: string;
    date: string;
    badge: string;
  }[]>([]);

  // Search "Cek Jadwal Tugas Saya" state
  const [officerSearch, setOfficerSearch] = useState('');
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);

  const [allWeekends, setAllWeekends] = useState<any[]>([]);
  const { user } = useAuth();

  // Subscribe to real weekends in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'weekends'),
      (snap) => {
        const weekends = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        setAllWeekends(weekends);
        if (weekends.length > 0) {
          const latest = weekends.find((w) => w.status === 'FINAL') || weekends[0];
          
          if (latest) {
            const dateObj = new Date(latest.tanggal_acuan || latest.id.replace('w-', ''));
            const dateFormatted = dateObj.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });

            setActiveWeekend({
              id: latest.id,
              title: latest.nama_kegiatan || `Jadwal Liturgi ${dateFormatted}`,
              dateStr: dateFormatted,
              status: latest.status || 'DRAFT',
              assignments: latest.assignments || [],
              communityAssignments: latest.communityAssignments || [],
              sessions: latest.sessions || [],
            });
          }

          const specials = weekends
            .filter((w) => w.is_special)
            .map((w) => ({
              title: w.nama_kegiatan || 'Misa Khusus',
              date: w.tanggal_acuan,
              badge: 'Misa Khusus'
            }));
          setUpcomingSpecials(specials);
        }
      },
      (err) => {
        console.warn('[FIRESTORE] Public landing sync notice:', err);
      }
    );

    return () => unsub();
  }, []);

  // Compute the next 4 upcoming Sundays dynamically
  const upcomingFourSundays = useMemo(() => {
    const sundays = [];
    const today = new Date();
    
    // Find upcoming Sunday
    const current = new Date(today);
    const dayOfWeek = current.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    current.setDate(current.getDate() + daysUntilSunday);

    for (let i = 0; i < 4; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i * 7);
      
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${day}`;
      
      const liturgical = getLiturgicalInfo(isoDate);
      
      const dateFormatted = d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      sundays.push({
        dateIso: isoDate,
        dateFormatted,
        isThisWeek: i === 0,
        liturgical,
      });
    }
    return sundays;
  }, []);

  // Live matching for "Cek Jadwal Tugas Saya"
  const matchedOfficers: OfficerDutyMatch[] = useMemo(() => {
    const q = officerSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const matches: OfficerDutyMatch[] = [];

    REAL_OFFICERS_DATA.forEach((officer) => {
      const matchName = officer.nama.toLowerCase().includes(q);
      const matchLing = officer.lingkungan.toLowerCase().includes(q);
      const matchWil = officer.wilayah.toLowerCase().includes(q);

      if (matchName || matchLing || matchWil) {
        const peranList: string[] = [];
        if (officer.organis) peranList.push('Organis');
        if (officer.mazmur) peranList.push('Pemazmur');
        if (officer.lektor) peranList.push('Lektor');
        if (officer.misdinar) peranList.push('Misdinar');
        if (officer.prodiakon) peranList.push('Prodiakon');

        // Check if currently assigned in active weekend
        let assignedSession: string | undefined;
        let assignedRole: string | undefined;

        if (activeWeekend && activeWeekend.assignments) {
          const asg = activeWeekend.assignments.find(
            (a: any) =>
              (a.person_id === officer.nama ||
                a.person_id?.toLowerCase() === officer.nama.toLowerCase() ||
                a.nama === officer.nama) &&
              a.status !== 'REMOVED'
          );
          if (asg) {
            assignedRole = asg.role_id?.replace('ROL-', '') || 'Petugas';
            assignedSession =
              asg.session_id === 'ses-1'
                ? 'Sabtu Sore (17.00 WIB)'
                : asg.session_id === 'ses-2'
                ? 'Minggu Pagi (07.00 WIB)'
                : 'Minggu Sore (17.00 WIB)';
          }
        }

        matches.push({
          nama: officer.nama,
          lingkungan: officer.lingkungan,
          wilayah: officer.wilayah,
          peranList,
          assignedSession,
          assignedRole,
          assignedDate: activeWeekend?.dateStr,
        });
      }
    });

    return matches.slice(0, 6);
  }, [officerSearch, activeWeekend]);

  const officerStats = useMemo(() => {
    let organis = 0;
    let mazmur = 0;
    let lektor = 0;
    let misdinar = 0;
    let prodiakon = 0;
    REAL_OFFICERS_DATA.forEach((o) => {
      if (o.organis) organis++;
      if (o.mazmur) mazmur++;
      if (o.lektor) lektor++;
      if (o.misdinar) misdinar++;
      if (o.prodiakon) prodiakon++;
    });
    return { organis, mazmur, lektor, misdinar, prodiakon, total: REAL_OFFICERS_DATA.length };
  }, []);

  // Guidelines content for modal
  const GUIDELINES = [
    {
      id: 'lektor',
      title: '📖 Lektor (Pembaca Sabda)',
      color: 'bg-emerald-950 text-white',
      badge: 'Sabda & Doa Umat',
      rules: [
        'Hadir di gereja sekurang-kurangnya 30 menit sebelum perayaan Ekaristi dimulai.',
        'Mengenakan busana liturgi (jubah putih lektor) atau pakaian resmi, sopan, dan rapi.',
        'Membaca dan memahami teks Bacaan I, Bacaan II, dan Doa Umat sebelum bertugas.',
        'Melakukan gladi singkat pada mikrofon mimbar sabda untuk memastikan artikulasi dan volume suara prima.',
        'Berjalan dengan khidmat saat prosesi perarakan bersama Imam dan Putra Altar.',
      ],
    },
    {
      id: 'pemazmur',
      title: '🎤 Pemazmur (Mazmur Tanggapan)',
      color: 'bg-amber-900 text-white',
      badge: 'Kidung Sabda',
      rules: [
        'Hadir 30 menit sebelum misa untuk gladi tangga nada dan tempo bersama Organis.',
        'Menyanyikan Mazmur Tanggapan dan Bait Pengantar Injil (Alleluya/Tractus) dengan artikulasi jelas dan penuh penghayatan.',
        'Mengenakan pakaian sopan bernuansa liturgis atau jubah pemazmur resmi paroki.',
        'Membungkuk hormat ke arah Altar sebelum dan sesudah melantunkan mazmur di mimbar.',
      ],
    },
    {
      id: 'misdinar',
      title: '🕯️ Misdinar (Putra & Putri Altar)',
      color: 'bg-[#1B382B] text-amber-200',
      badge: 'Pelayan Meja Suci',
      rules: [
        'Wajib hadir 30 menit sebelum misa untuk mengenakan jubah dan samir sesuai warna liturgi.',
        'Menyiapkan lilin prosesi, dupa, wiruk, bejana cuci tangan, dan kesiapan kredens altar.',
        'Melayani Imam di sekitar Altar dengan sikap hening, khidmat, dan tangan terkatup di dada.',
        'Tidak bercakap-cakap atau bergerak tanpa keperluan liturgis selama perayaan Ekaristi.',
      ],
    },
    {
      id: 'prodiakon',
      title: '🍷 Prodiakon (Pelayan Luar Biasa Komuni)',
      color: 'bg-red-950 text-white',
      badge: 'Pelayan Komuni Kudus',
      rules: [
        'Mengenakan jubah prodiakon bersih dan kalung salib prodiakon resmi keuskupan.',
        'Melakukan doa pribadi sebelum perayaan Ekaristi di sakristi.',
        'Mencuci tangan dengan bersih dan tertib saat mempersiapkan diri menyambut dan membagikan Tubuh Kristus.',
        'Menghitung jumlah hosti suci dan menjaga kekhidmatan barisan komuni umat.',
      ],
    },
    {
      id: 'organis',
      title: '🎹 Organis & 🎵 Paduan Suara (Koor)',
      color: 'bg-purple-950 text-white',
      badge: 'Musik & Pujian',
      rules: [
        'Memilih dan melatih lagu-lagu liturgis yang disetujui Buku Puji Syukur / Madah Bakti sesuai tema misa.',
        'Memastikan lagu Ordinarium (Kyrie, Gloria, Sanctus, Agnus Dei) dinyanyikan sesuai warna liturgi (tidak ada Gloria saat Adven/Prapaskah).',
        'Menyesuaikan dinamika volume organ/iringan agar tidak menenggelamkan suara nyanyian umat.',
        'Paduan Suara hadir 45 menit sebelum misa untuk pemanasan vokal dan gladi posisi.',
      ],
    },
    {
      id: 'tatib',
      title: '🛡️ Petugas Tata Tertib (Tatib Lingkungan)',
      color: 'bg-slate-900 text-white',
      badge: 'Ketertiban Umat',
      rules: [
        'Hadir 45 menit sebelum misa untuk menyambut umat di pintu utama gereja dengan senyum dan ramah.',
        'Membantu mengarahkan umat mengisi bangku depan terlebih dahulu.',
        'Mengkoordinasikan kantong kolekte secara tertib pada saat Persembahan.',
        'Membantu kelancaran barisan umat saat penerimaan Komuni Kudus.',
      ],
    },
  ];

  // Sunday Gospel Theme and Scripture Helper
  const currentSundayLiturgical = upcomingFourSundays[0]?.liturgical;
  const currentSundayFormatted = upcomingFourSundays[0]?.dateFormatted;
  const currentSundayIso = upcomingFourSundays[0]?.dateIso;

  const currentGospelData = useMemo(() => {
    const title = currentSundayLiturgical?.title || '';
    if (title.includes('XXI') || title.includes('21')) {
      return {
        tema: 'Pilihan Mengikuti Kristus & Sabda Hidup Kekal',
        bacaan1: 'Yos 24:1-2a.15-17.18b',
        mazmur: 'Mzm 34:2-3.16-17.18-19',
        bacaan2: 'Ef 5:21-32',
        injil: 'Yohanes 6:60-69',
        ayatEmas: 'Tuhan, kepada siapakah kami akan pergi? Sabda-Mu adalah sabda hidup yang kekal; dan kami telah percaya dan tahu bahwa Engkau adalah Yang Kudus dari Allah.',
        ref: 'Yohanes 6:68-69',
      };
    } else if (title.includes('XXII') || title.includes('22')) {
      return {
        tema: 'Kemurnian Hati & Melakukan Firman Allah',
        bacaan1: 'Ul 4:1-2.6-8',
        mazmur: 'Mzm 15:2-3ab.3cd-4ab.5',
        bacaan2: 'Yak 1:17-18.21b-22.27',
        injil: 'Markus 7:1-8.14-15.21-23',
        ayatEmas: 'Hendaklah kamu menjadi pelaku firman dan bukan hanya pendengar saja; sebab jika tidak demikian, kamu menipu diri sendiri.',
        ref: 'Yakobus 1:22',
      };
    } else if (title.includes('XXIII') || title.includes('23')) {
      return {
        tema: 'Efata: Terbukalah Hati dan Telinga bagi Sabda Allah',
        bacaan1: 'Yes 35:4-7a',
        mazmur: 'Mzm 146:7.8-9a.9bc-10',
        bacaan2: 'Yak 2:1-5',
        injil: 'Markus 7:31-37',
        ayatEmas: 'Ia menjadikan segala-galanya baik, yang tuli dijadikan-Nya mendengar, yang bisu dijadikan-Nya berkata-kata.',
        ref: 'Markus 7:37',
      };
    } else if (title.includes('XXIV') || title.includes('24')) {
      return {
        tema: 'Mengakui Yesus Sebagai Mesias dan Memikul Salib',
        bacaan1: 'Yes 50:5-9a',
        mazmur: 'Mzm 116:1-2.3-4.5-6.8-9',
        bacaan2: 'Yak 2:14-18',
        injil: 'Markus 8:27-35',
        ayatEmas: 'Setiap orang yang mau mengikut Aku, ia harus menyangkal dirinya, memikul salibnya dan mengikut Aku.',
        ref: 'Markus 8:34',
      };
    } else {
      return {
        tema: 'Perayaan Ekaristi Kudus & Penghayatan Sabda Allah',
        bacaan1: 'Kitab Suci Perjanjian Lama',
        mazmur: 'Mazmur Tanggapan Liturgi',
        bacaan2: 'Surat Para Rasul',
        injil: 'Injil Kudus Yesus Kristus',
        ayatEmas: 'Akulah roti hidup yang telah turun dari sorga. Jikalau seorang makan dari roti ini, ia akan hidup selama-lamanya.',
        ref: 'Yohanes 6:51',
      };
    }
  }, [currentSundayLiturgical]);

  return (
    <div className="space-y-12 max-w-[94rem] mx-auto pb-16">
      {/* ========================================================================= */}
      {/* 1. EDITORIAL SACRAL HERO SECTION (SPLIT SCREEN 50/50) */}
      {/* ========================================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4"
      >
        {/* Left Column: Parish Identity, Monogram & Action CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          {/* Liturgical Crest & Parish Badge */}
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-white/95 shadow-xs">
            <ParishLogo className="w-8 h-8 object-contain shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Bidang Liturgi HTB SPM Boyolali
            </span>
            <span className="text-ink-soft">•</span>
            <span className="text-xs font-medium text-emerald-900 font-bold">
              KAS
            </span>
          </div>

          {/* Monumental Serif Title */}
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-display font-bold text-[#022C12] tracking-tight leading-[1.08]">
            PELAYANAN LITURGI YANG <br className="hidden sm:block" />
            RAPI, KUDUS, DAN TERATUR
          </h1>

          {/* Crisp Indonesian Subtext */}
          <p className="text-base sm:text-lg text-ink-soft max-w-2xl font-medium leading-relaxed">
            Sistem Manajemen & Penjadwalan Petugas Liturgi Digital: Memastikan setiap perayaan Ekaristi dan Ibadat berjalan khidmat, tertib, dan tepat waktu di Paroki Hati Tak Bernoda Santa Perawan Maria.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => onOpenCalendar()}
              className="h-12 px-6 rounded-2xl bg-[#022C12] text-white hover:bg-emerald-950 font-bold shadow-lg border border-[#D4AF37]/40 flex items-center gap-2 cursor-pointer spring-press text-sm"
            >
              <span>🗓️</span>
              <span>Buka Kalender Jadwal</span>
            </Button>

            <Button
              variant="secondary"
              onClick={onPrintSchedule}
              className="h-12 px-5 rounded-2xl bg-white hover:bg-surface border border-surface-muted text-ink font-bold shadow-xs cursor-pointer spring-press flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <span>🖨️</span>
              <span>Cetak Warta</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => setIsGuidelinesOpen(true)}
              className="h-12 px-5 rounded-2xl bg-white hover:bg-surface border border-surface-muted text-ink font-bold shadow-xs cursor-pointer spring-press flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <span>📖</span>
              <span>Pedoman Peran</span>
            </Button>

            {user && user.role !== 'VIEWER' ? (
              <Button
                variant="secondary"
                onClick={onOpenWorkspace}
                className="h-12 px-5 rounded-2xl bg-white hover:bg-surface border border-surface-muted text-ink font-bold shadow-xs cursor-pointer spring-press text-xs sm:text-sm"
              >
                ⚙️ Ruang Kerja ({user.role})
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right Column: Dynamic Liturgical Theme & Gospel Reading Card */}
        <div className="lg:col-span-5">
          <Card className="p-6 sm:p-7 backdrop-blur-3xl bg-white/90 rounded-3xl border border-white/90 shadow-2xl space-y-5 relative overflow-hidden group hover:shadow-3xl transition-all">
            {/* Top Liturgical Color Stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-2"
              style={{
                backgroundColor:
                  currentSundayLiturgical?.color === 'HIJAU'
                    ? '#2E7D32'
                    : currentSundayLiturgical?.color === 'UNGU'
                    ? '#6A1B9A'
                    : currentSundayLiturgical?.color === 'MERAH'
                    ? '#C62828'
                    : '#D4AF37',
              }}
            />

            {/* Header: Date + Liturgical Badge */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-xs font-mono font-bold text-ink-soft">
                  {currentSundayFormatted || 'Pekan Ini'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#022C12] text-[#D8EB73] border border-[#D4AF37]/30 shadow-xs">
                {currentSundayLiturgical?.color === 'HIJAU'
                  ? '🟢 Masa Biasa'
                  : currentSundayLiturgical?.color === 'UNGU'
                  ? '🟣 Masa Pertobatan'
                  : currentSundayLiturgical?.color === 'MERAH'
                  ? '🔴 Martir / Roh Kudus'
                  : '⚪ Hari Raya Mulia'}
              </span>
            </div>

            {/* Feast Title */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-widest block">
                Perayaan Ekaristi Mendatang
              </span>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-[#022C12] leading-snug">
                {currentSundayLiturgical?.title || activeWeekend?.title || 'Hari Minggu Liturgi'}
              </h3>
              <p className="text-xs font-semibold text-ink-soft">
                Tema: {currentGospelData.tema}
              </p>
            </div>

            {/* Sacred Scripture & Gospel Verse Quote */}
            <div className="p-4 rounded-2xl bg-[#022C12]/5 border border-[#022C12]/15 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-bold text-[#022C12]">
                <span className="flex items-center gap-1.5">
                  <span>📜</span>
                  <span>Bacaan Injil: {currentGospelData.injil}</span>
                </span>
                <span className="text-[10px] text-ink-soft font-mono font-normal">Tahun B</span>
              </div>

              <blockquote className="text-xs sm:text-[13px] italic font-serif text-ink leading-relaxed pl-2 border-l-2 border-[#D4AF37]">
                "{currentGospelData.ayatEmas}"
              </blockquote>

              <div className="text-right text-[10px] font-bold text-ink-soft">
                — {currentGospelData.ref}
              </div>
            </div>

            {/* Mass Times & 1-Click Studio CTA */}
            <div className="pt-2 border-t border-surface-muted/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-ink-soft space-y-0.5">
                <span className="font-bold text-ink block text-[11px]">Jadwal Misa Paroki:</span>
                <span>Sabtu 17.00 • Minggu 07.00 & 17.00 WIB</span>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenCalendar(currentSundayIso)}
                className="w-full sm:w-auto text-xs font-bold rounded-xl bg-[#022C12] text-white hover:bg-emerald-950 shadow-md spring-press py-2"
              >
                Lihat Jadwal ➔
              </Button>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* 2. INTERACTIVE SECTION: CEK JADWAL TUGAS SAYA */}
      {/* ========================================================================= */}
      {/* 2. DYNAMIC OFFICER DUTY CHECKER & DIRECTORY SEARCH */}
      {/* ========================================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="backdrop-blur-3xl bg-white/90 p-6 sm:p-8 rounded-3xl border border-white shadow-xl space-y-6">
          {/* Header Section with Clear Hierarchy */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-surface-muted">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#022C12]/10 text-[#022C12] text-[10px] font-bold uppercase tracking-wider">
                <span>🔍</span>
                <span>Layanan Mandiri Umat & Petugas</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink tracking-tight">
                Cek Jadwal & Riwayat Tugas Saya
              </h2>
              <p className="text-xs sm:text-sm text-ink-soft max-w-2xl leading-relaxed">
                Ketik nama Anda, nama lingkungan, atau wilayah untuk melihat kualifikasi peran dan penugasan misa mendatang.
              </p>
            </div>
            <Badge variant="complete" className="px-3.5 py-1.5 text-xs font-bold shrink-0">
              {officerStats.total} Petugas Liturgi Siap Melayani
            </Badge>
          </div>

          {/* Balanced 2-Column Grid (Eliminating Dead Negative Space) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Search Bar & Dynamic Results (col-span-7) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Ketik nama petugas (mis. Carolus, Agatha) atau lingkungan..."
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  className="w-full h-13 pl-11 pr-24 rounded-2xl bg-surface/80 hover:bg-surface border border-surface-muted text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#022C12] focus:bg-white transition-all shadow-inner placeholder:text-ink-soft/70"
                />
                <span className="absolute left-3.5 top-3.5 text-base text-ink-soft">
                  👤
                </span>
                {officerSearch && (
                  <button
                    type="button"
                    onClick={() => setOfficerSearch('')}
                    className="absolute right-3 top-2.5 px-2.5 py-1 text-xs font-bold text-ink-soft hover:text-ink bg-white rounded-lg border border-surface-muted shadow-2xs hover:bg-surface transition-colors cursor-pointer"
                  >
                    ✕ Hapus
                  </button>
                )}
              </div>

              {/* Quick Filter Tag Suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-ink-soft font-medium text-[11px]">Cari Cepat:</span>
                {['Carolus', 'Agatha', 'Stefanus', 'Yusup', 'Lukas', 'Mateus', 'Maria Assumpta'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setOfficerSearch(tag)}
                    className="px-2 py-0.5 rounded-lg bg-surface hover:bg-white border border-surface-muted text-[11px] font-semibold text-ink-soft hover:text-ink transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Dynamic Search Results */}
              {officerSearch.trim().length >= 2 ? (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-soft block">
                      Hasil Pencarian ({matchedOfficers.length} Ditemukan):
                    </span>
                    <span className="text-xs text-ink-soft">
                      Kata kunci: <strong>"{officerSearch}"</strong>
                    </span>
                  </div>

                  {matchedOfficers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {matchedOfficers.map((officer, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: idx * 0.04 }}
                          className="p-4 rounded-2xl bg-white border border-surface-muted shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-ink text-sm font-display leading-snug">
                                  {officer.nama}
                                </h3>
                                <p className="text-[11px] text-ink-soft font-medium">
                                  Lingk. {officer.lingkungan} • Wil. {officer.wilayah}
                                </p>
                              </div>
                              <div className="w-7 h-7 rounded-full bg-[#022C12]/10 text-[#022C12] font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                                {officer.nama.charAt(0)}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {officer.peranList.map((r) => (
                                <Chip key={r} className="text-[9px] py-0.5 px-2 bg-surface border border-surface-muted font-bold text-ink">
                                  {r}
                                </Chip>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-surface-muted text-xs">
                            {officer.assignedSession ? (
                              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-[11px]">
                                  <span>✅</span>
                                  <span>Bertugas: {officer.assignedRole}</span>
                                </div>
                                <div className="text-[10px] text-emerald-800">
                                  {officer.assignedSession} ({officer.assignedDate})
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-surface/70 border border-surface-muted text-ink-soft space-y-0.5">
                                <span className="font-bold text-ink block text-[10px]">
                                  Status Pekan Ini: Tidak Bertugas
                                </span>
                                <span className="text-[9px] text-ink-soft">
                                  Tersedia untuk penugasan pada akhir pekan berikutnya.
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-surface/40 rounded-2xl border border-surface-muted text-ink-soft text-xs space-y-1">
                      <p className="font-semibold text-ink">
                        Tidak ditemukan petugas dengan kata kunci "{officerSearch}".
                      </p>
                      <p className="text-[11px]">
                        Coba ketik nama panggilan atau nama lingkungan lain.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface/70 border border-surface-muted text-xs text-ink-soft">
                  <span className="text-base">💡</span>
                  <span className="text-[11px]">
                    <strong>Petunjuk:</strong> Ketik minimal 2 huruf nama petugas atau lingkungan untuk melihat status tugas misa secara instan.
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Balanced Directory Stats & Liturgical Guidelines Hub (col-span-5) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/5 via-surface/60 to-surface/90 border border-surface-muted shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-surface-muted">
                  <span className="text-xs font-bold font-display uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <span>🏛️</span>
                    <span>Statistik Pelayan Liturgi</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    Paroki Boyolali
                  </span>
                </div>

                {/* 5 Roles Breakdown Cards */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-surface-muted shadow-2xs space-y-0.5">
                    <span className="text-[10px] text-ink-soft font-bold uppercase flex items-center gap-1">
                      <span>📖</span> Lektor
                    </span>
                    <div className="text-lg font-bold font-display text-ink">{officerStats.lektor} <span className="text-[10px] font-normal text-ink-soft">Petugas</span></div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-surface-muted shadow-2xs space-y-0.5">
                    <span className="text-[10px] text-ink-soft font-bold uppercase flex items-center gap-1">
                      <span>🎤</span> Pemazmur
                    </span>
                    <div className="text-lg font-bold font-display text-ink">{officerStats.mazmur} <span className="text-[10px] font-normal text-ink-soft">Petugas</span></div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-surface-muted shadow-2xs space-y-0.5">
                    <span className="text-[10px] text-ink-soft font-bold uppercase flex items-center gap-1">
                      <span>🕯️</span> Misdinar
                    </span>
                    <div className="text-lg font-bold font-display text-ink">{officerStats.misdinar} <span className="text-[10px] font-normal text-ink-soft">Petugas</span></div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-surface-muted shadow-2xs space-y-0.5">
                    <span className="text-[10px] text-ink-soft font-bold uppercase flex items-center gap-1">
                      <span>🍷</span> Prodiakon
                    </span>
                    <div className="text-lg font-bold font-display text-ink">{officerStats.prodiakon} <span className="text-[10px] font-normal text-ink-soft">Petugas</span></div>
                  </div>

                  <div className="col-span-2 p-2.5 rounded-xl bg-white border border-surface-muted shadow-2xs flex justify-between items-center">
                    <span className="text-[11px] text-ink font-bold flex items-center gap-1.5">
                      <span>🎹</span> Organis & Musik Liturgi
                    </span>
                    <span className="text-sm font-bold font-display text-ink">{officerStats.organis} Petugas</span>
                  </div>
                </div>

                {/* Quick Action Button to Guidelines */}
                <button
                  type="button"
                  onClick={() => setIsGuidelinesOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#022C12] hover:bg-emerald-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer spring-press"
                >
                  <span>📖</span>
                  <span>Buka Buku Pedoman Liturgi Lengkap</span>
                </button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 3. INTERACTIVE 4-WEEK LITURGICAL TIMELINE RIBBON */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-ink flex items-center gap-2">
              <span>📅</span>
              <span>Linimasa Perayaan 4 Pekan Mendatang</span>
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft">
              Rangkaian masa liturgi, warna liturgis, dan status kesiapan jadwal paroki.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenCalendar()}
            className="text-xs font-bold text-[#022C12] hover:underline"
          >
            Lihat Semua di Kalender ➔
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingFourSundays.map((item, idx) => {
            const lit = item.liturgical;
            const isGreen = lit.color === 'HIJAU';
            const isPurple = lit.color === 'UNGU';
            const isRed = lit.color === 'MERAH';

            const colorBadgeText = isGreen
              ? '🟢 Hijau'
              : isPurple
              ? '🟣 Ungu'
              : isRed
              ? '🔴 Merah'
              : '⚪ Putih';

            return (
              <Card
                key={idx}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 hover:shadow-lg ${
                  item.isThisWeek
                    ? 'bg-gradient-to-b from-white to-[#F6F9ED] border-[#022C12]/30 shadow-md ring-2 ring-[#022C12]/20'
                    : 'bg-white/80 border-surface-muted shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-ink-soft">
                      {item.dateFormatted}
                    </span>
                    {item.isThisWeek ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#022C12] text-[#D8EB73] text-[10px] font-bold uppercase tracking-wider">
                        Pekan Ini
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-ink-soft">
                        Pekan +{idx}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-display font-bold text-ink leading-snug">
                      {lit.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-ink-soft">
                        {colorBadgeText} • {lit.seasonName}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const matchedWkd = allWeekends.find(
                      (w) => w.id === `w-${item.dateIso}` || w.tanggal_acuan === item.dateIso
                    );
                    const sessions =
                      matchedWkd && matchedWkd.sessions && matchedWkd.sessions.length > 0
                        ? matchedWkd.sessions.map((s: any) => ({
                            name:
                              s.nama_khusus ||
                              (s.jenis_sesi === 'SABTU_SORE'
                                ? 'Sabtu Sore'
                                : s.jenis_sesi === 'MINGGU_PAGI'
                                ? 'Minggu Pagi'
                                : 'Minggu Sore'),
                            time: s.waktu_mulai
                              ? s.waktu_mulai.includes('WIB')
                                ? s.waktu_mulai
                                : `${s.waktu_mulai} WIB`
                              : s.jenis_sesi === 'MINGGU_PAGI'
                              ? '07.00 WIB'
                              : '17.00 WIB',
                          }))
                        : [
                            { name: 'Sabtu Sore', time: '17.00 WIB' },
                            { name: 'Minggu Pagi', time: '07.00 WIB' },
                          ];

                    return (
                      <div className="text-xs text-ink-soft bg-surface/70 p-2.5 rounded-xl border border-surface-muted space-y-1.5">
                        <div className="font-semibold text-ink text-[11px] flex justify-between items-center">
                          <span>Jadwal Misa:</span>
                          {matchedWkd?.status === 'FINAL' && (
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                              ✓ Resmi
                            </span>
                          )}
                        </div>
                        {sessions.map((s: any, sIdx: number) => (
                          <div key={sIdx} className="flex justify-between text-[11px] items-center">
                            <span>• {s.name}</span>
                            <span className="font-mono font-semibold text-emerald-950 bg-white/80 px-1.5 py-0.5 rounded border border-surface-muted/60">
                              {s.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <Button
                  variant={item.isThisWeek ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => onOpenCalendar(item.dateIso)}
                  className="w-full text-xs font-bold rounded-xl mt-2"
                >
                  {item.isThisWeek ? '🗓️ Buka Jadwal Pekan Ini' : 'Lihat Jadwal ➔'}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* UPCOMING SPECIAL MASSES BANNER */}
        {upcomingSpecials.length > 0 && (
          <Card className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-3xl mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h4 className="font-display font-bold text-lg text-amber-950">
                    Perayaan Ekaristi & Misa Khusus Mendatang
                  </h4>
                  <p className="text-xs text-amber-900/80">
                    {upcomingSpecials.map((s) => `${s.title} (${s.date})`).join(' • ')}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenCalendar()}
                className="rounded-xl font-bold text-xs"
              >
                Lihat di Kalender ➔
              </Button>
            </div>
          </Card>
        )}
      </motion.div>

      {/* 4. MODAL PEDOMAN PERAN LITURGI */}
      <Dialog
        open={isGuidelinesOpen}
        onClose={() => setIsGuidelinesOpen(false)}
        title="Pedoman & Tata Tertib Pelayanan Liturgi"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-xs text-ink-soft leading-relaxed">
            Panduan persiapan rohani, busana resmi, dan ketepatan waktu bagi seluruh petugas liturgi demi menjaga kesucian dan keindahan perayaan Ekaristi di Paroki Hati Tak Bernoda Santa Perawan Maria.
          </p>

          <div className="space-y-3">
            {GUIDELINES.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-surface/60 border border-surface-muted space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-ink">
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-surface-muted text-ink">
                    {item.badge}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-ink-soft list-disc list-inside leading-relaxed">
                  {item.rules.map((rule, rIdx) => (
                    <li key={rIdx} className="text-ink">
                      <span className="text-ink-soft">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-surface-muted flex justify-end">
            <Button
              variant="primary"
              onClick={() => setIsGuidelinesOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Tutup Pedoman
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

