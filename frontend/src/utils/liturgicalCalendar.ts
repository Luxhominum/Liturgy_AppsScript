export type LiturgicalSeason = 'ADVEN' | 'NATAL' | 'PRAPASKAH' | 'TRIHARI_SUCI' | 'PASKAH' | 'MASA_BIASA';
export type LiturgicalColor = 'HIJAU' | 'UNGU' | 'PUTIH' | 'MERAH' | 'MERAH_MUDA';
export type LiturgicalRank = 'HARI_RAYA' | 'PESTA' | 'PERINGATAN' | 'BIASA';

export interface LiturgicalDay {
  dateStr: string;
  title: string;
  season: LiturgicalSeason;
  seasonName: string;
  color: LiturgicalColor;
  colorHex: string;
  colorClass: string;
  rank: LiturgicalRank;
}

// Anonymous Gregorian Computus algorithm for Catholic Easter
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ROMAN_NUMERALS = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
  'XXXI', 'XXXII', 'XXXIII', 'XXXIV'
];

export function getLiturgicalInfo(dateInput: Date | string): LiturgicalDay {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput);
  const year = date.getFullYear();
  const dateStr = toDateString(date);
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  const easter = getEasterSunday(year);
  const ashWednesday = addDays(easter, -46);
  const palmSunday = addDays(easter, -7);
  const holyThursday = addDays(easter, -3);
  const goodFriday = addDays(easter, -2);
  const holySaturday = addDays(easter, -1);
  const divineMercySunday = addDays(easter, 7);
  const ascensionSunday = addDays(easter, 42); // celebrated on 7th Sunday of Easter in Indonesia
  const pentecostSunday = addDays(easter, 49);
  const trinitySunday = addDays(easter, 56);
  const corpusChristiSunday = addDays(easter, 63);
  const sacredHeart = addDays(easter, 68);

  // Advent calculation
  const christmas = new Date(year, 11, 25);
  const christmasDayOfWeek = christmas.getDay();
  const fourthSundayAdvent = new Date(year, 11, 25 - (christmasDayOfWeek === 0 ? 7 : christmasDayOfWeek));
  const thirdSundayAdvent = addDays(fourthSundayAdvent, -7);
  const secondSundayAdvent = addDays(fourthSundayAdvent, -14);
  const firstSundayAdvent = addDays(fourthSundayAdvent, -21);

  // Christ the King is the Sunday before First Sunday of Advent
  const christTheKingSunday = addDays(firstSundayAdvent, -7);

  // Fixed Solemnities & Feasts in Indonesia
  if (month === 0 && day === 1) {
    return { dateStr, title: 'Hari Raya Santa Perawan Maria Bunda Allah', season: 'NATAL', seasonName: 'Masa Natal', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 2 && day === 19) {
    return { dateStr, title: 'Hari Raya Santo Yusuf, Suami SP Maria', season: 'PRAPASKAH', seasonName: 'Masa Prapaskah', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 2 && day === 25) {
    return { dateStr, title: 'Hari Raya Kabar Sukacita', season: 'PRAPASKAH', seasonName: 'Masa Prapaskah', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 5 && day === 24) {
    return { dateStr, title: 'Hari Raya Kelahiran St. Yohanes Pembaptis', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 5 && day === 29) {
    return { dateStr, title: 'Hari Raya St. Petrus dan St. Paulus, Rasul', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'MERAH', colorHex: '#DC2626', colorClass: 'bg-red-500 text-white', rank: 'HARI_RAYA' };
  }
  if (month === 7 && day === 15) {
    return { dateStr, title: 'Hari Raya SP Maria Diangkat ke Surga', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 7 && day === 17) {
    return { dateStr, title: 'Misa Hari Kemerdekaan Republik Indonesia', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-red-300', rank: 'PESTA' };
  }
  if (month === 10 && day === 1) {
    return { dateStr, title: 'Hari Raya Semua Orang Kudus', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 10 && day === 2) {
    return { dateStr, title: 'Pengenangan Arwah Semua Orang Beriman', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'UNGU', colorHex: '#7C3AED', colorClass: 'bg-purple-600 text-white', rank: 'PERINGATAN' };
  }
  if (month === 11 && day === 8) {
    return { dateStr, title: 'Hari Raya SP Maria Dikandung Tanpa Noda', season: 'ADVEN', seasonName: 'Masa Adven', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (month === 11 && day === 24) {
    return { dateStr, title: 'Malam Natal (Kelahiran Tuhan Yesus Kristus)', season: 'NATAL', seasonName: 'Masa Natal', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-400 font-bold', rank: 'HARI_RAYA' };
  }
  if (month === 11 && day === 25) {
    return { dateStr, title: 'Hari Raya Natal (Kelahiran Tuhan Yesus Kristus)', season: 'NATAL', seasonName: 'Masa Natal', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-400 font-bold', rank: 'HARI_RAYA' };
  }

  // Movable Solemnities & Feasts
  if (dateStr === toDateString(ashWednesday)) {
    return { dateStr, title: 'Rabu Abu (Pembukaan Masa Prapaskah)', season: 'PRAPASKAH', seasonName: 'Masa Prapaskah', color: 'UNGU', colorHex: '#7C3AED', colorClass: 'bg-purple-700 text-white font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(palmSunday)) {
    return { dateStr, title: 'Minggu Palma Mengenangkan Sengsara Tuhan', season: 'PRAPASKAH', seasonName: 'Pekan Suci', color: 'MERAH', colorHex: '#DC2626', colorClass: 'bg-red-600 text-white font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(holyThursday)) {
    return { dateStr, title: 'Kamis Putih (Perjamuan Malam Terakhir)', season: 'TRIHARI_SUCI', seasonName: 'Trihari Suci', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300 font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(goodFriday)) {
    return { dateStr, title: 'Jumat Agung (Mengenangkan Wafat Tuhan)', season: 'TRIHARI_SUCI', seasonName: 'Trihari Suci', color: 'MERAH', colorHex: '#DC2626', colorClass: 'bg-red-600 text-white font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(holySaturday)) {
    return { dateStr, title: 'Malam Paskah (Tirakatan Kebangkitan Tuhan)', season: 'TRIHARI_SUCI', seasonName: 'Trihari Suci', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-400 font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(easter)) {
    return { dateStr, title: 'Hari Raya Paskah Kebangkitan Tuhan', season: 'PASKAH', seasonName: 'Masa Paskah', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-400 font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(divineMercySunday)) {
    return { dateStr, title: 'Minggu Kerahiman Ilahi (Minggu Paskah II)', season: 'PASKAH', seasonName: 'Masa Paskah', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(ascensionSunday)) {
    return { dateStr, title: 'Hari Raya Kenaikan Tuhan ke Surga', season: 'PASKAH', seasonName: 'Masa Paskah', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300 font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(pentecostSunday)) {
    return { dateStr, title: 'Hari Raya Pentakosta (Turunnya Roh Kudus)', season: 'PASKAH', seasonName: 'Masa Paskah', color: 'MERAH', colorHex: '#DC2626', colorClass: 'bg-red-600 text-white font-bold', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(trinitySunday)) {
    return { dateStr, title: 'Hari Raya Tritunggal Mahakudus', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(corpusChristiSunday)) {
    return { dateStr, title: 'Hari Raya Tubuh dan Darah Kristus', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(sacredHeart)) {
    return { dateStr, title: 'Hari Raya Hati Yesus yang Mahakudus', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-300', rank: 'HARI_RAYA' };
  }
  if (dateStr === toDateString(christTheKingSunday)) {
    return { dateStr, title: 'Hari Raya Tuhan Kita Yesus Kristus Raja Semesta Alam', season: 'MASA_BIASA', seasonName: 'Masa Biasa', color: 'PUTIH', colorHex: '#FFFFFF', colorClass: 'bg-white text-ink border-amber-400 font-bold', rank: 'HARI_RAYA' };
  }

  // Seasons Evaluation
  // 1. ADVENT SEASON
  if (date >= firstSundayAdvent && date < christmas) {
    let adventWeek = 1;
    if (date >= fourthSundayAdvent) adventWeek = 4;
    else if (date >= thirdSundayAdvent) adventWeek = 3;
    else if (date >= secondSundayAdvent) adventWeek = 2;

    const isGaudete = adventWeek === 3 && dayOfWeek === 0;
    const title = dayOfWeek === 0
      ? `Minggu Adven ${ROMAN_NUMERALS[adventWeek]}${isGaudete ? ' (Gaudete)' : ''}`
      : `Pekan Adven ${ROMAN_NUMERALS[adventWeek]}`;

    return {
      dateStr,
      title,
      season: 'ADVEN',
      seasonName: 'Masa Adven',
      color: isGaudete ? 'MERAH_MUDA' : 'UNGU',
      colorHex: isGaudete ? '#F472B6' : '#7C3AED',
      colorClass: isGaudete ? 'bg-pink-400 text-white' : 'bg-purple-700 text-white',
      rank: dayOfWeek === 0 ? 'HARI_RAYA' : 'BIASA'
    };
  }

  // 2. CHRISTMAS SEASON
  const baptismLord = new Date(year, 0, 10); // around Jan 8-13
  if ((month === 11 && day >= 25) || (month === 0 && date <= baptismLord)) {
    const title = (month === 11 && day === 25)
      ? 'Hari Raya Natal'
      : (month === 0 && day <= 6)
      ? 'Hari Raya Penampakan Tuhan (Epifani)'
      : 'Pesta Pembaptisan Tuhan';

    return {
      dateStr,
      title,
      season: 'NATAL',
      seasonName: 'Masa Natal',
      color: 'PUTIH',
      colorHex: '#FFFFFF',
      colorClass: 'bg-white text-ink border-amber-300',
      rank: 'PESTA'
    };
  }

  // 3. LENT SEASON (Masa Prapaskah)
  if (date >= ashWednesday && date < easter) {
    const diffDays = Math.floor((date.getTime() - ashWednesday.getTime()) / (1000 * 60 * 60 * 24));
    const lentWeek = Math.min(5, Math.floor((diffDays - 4) / 7) + 1);
    const isLaetare = lentWeek === 4 && dayOfWeek === 0;

    const title = dayOfWeek === 0
      ? `Minggu Prapaskah ${ROMAN_NUMERALS[lentWeek]}${isLaetare ? ' (Laetare)' : ''}`
      : `Pekan Prapaskah ${ROMAN_NUMERALS[Math.max(1, lentWeek)]}`;

    return {
      dateStr,
      title,
      season: 'PRAPASKAH',
      seasonName: 'Masa Prapaskah',
      color: isLaetare ? 'MERAH_MUDA' : 'UNGU',
      colorHex: isLaetare ? '#F472B6' : '#7C3AED',
      colorClass: isLaetare ? 'bg-pink-400 text-white' : 'bg-purple-700 text-white',
      rank: dayOfWeek === 0 ? 'HARI_RAYA' : 'BIASA'
    };
  }

  // 4. EASTER SEASON (Masa Paskah)
  if (date >= easter && date <= pentecostSunday) {
    const diffDays = Math.floor((date.getTime() - easter.getTime()) / (1000 * 60 * 60 * 24));
    const easterWeek = Math.floor(diffDays / 7) + 1;

    const title = dayOfWeek === 0
      ? `Minggu Paskah ${ROMAN_NUMERALS[easterWeek]}`
      : `Pekan Paskah ${ROMAN_NUMERALS[easterWeek]}`;

    return {
      dateStr,
      title,
      season: 'PASKAH',
      seasonName: 'Masa Paskah',
      color: 'PUTIH',
      colorHex: '#FFFFFF',
      colorClass: 'bg-white text-ink border-amber-300',
      rank: dayOfWeek === 0 ? 'HARI_RAYA' : 'BIASA'
    };
  }

  // 5. ORDINARY TIME (Masa Biasa)
  // Compute approximate week of Ordinary Time
  let ordinaryWeek = 1;
  if (date > pentecostSunday && date < firstSundayAdvent) {
    // Second part of Ordinary time: count backwards from Christ the King (Week 34)
    const diffDaysFromKing = Math.floor((christTheKingSunday.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const weeksBeforeKing = Math.floor(diffDaysFromKing / 7);
    ordinaryWeek = Math.max(1, Math.min(34, 34 - weeksBeforeKing));
  } else if (date < ashWednesday) {
    // First part of Ordinary time
    const diffDays = Math.floor((date.getTime() - new Date(year, 0, 6).getTime()) / (1000 * 60 * 60 * 24));
    ordinaryWeek = Math.max(1, Math.min(9, Math.floor(diffDays / 7) + 1));
  }

  const title = dayOfWeek === 0 || dayOfWeek === 6
    ? `Minggu Biasa ${ROMAN_NUMERALS[ordinaryWeek]}`
    : `Pekan Biasa ${ROMAN_NUMERALS[ordinaryWeek]}`;

  return {
    dateStr,
    title,
    season: 'MASA_BIASA',
    seasonName: 'Masa Biasa',
    color: 'HIJAU',
    colorHex: '#059669',
    colorClass: 'bg-emerald-600 text-white',
    rank: 'BIASA'
  };
}