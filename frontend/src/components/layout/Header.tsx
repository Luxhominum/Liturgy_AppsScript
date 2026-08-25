import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, ParishLogo } from '../ui';
import { useAuth } from '../../context/AuthContext';
import type { TabId, User } from '../../types';

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  user: User;
}

export default function Header({ activeTab, onTabChange, user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);

  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const profilePopoverRef = useRef<HTMLDivElement>(null);

  const { firebaseUser, signInWithGoogle, signOut } = useAuth();

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
      }
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(event.target as Node)) {
        setProfilePopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainNavItems: { id: TabId; label: string; icon: string }[] = [
    { id: 'beranda', label: 'Beranda', icon: '🏠' },
    { id: 'jadwal', label: 'Jadwal Liturgi', icon: '📋' },
    { id: 'kelola-petugas', label: 'Petugas', icon: '👥' },
    ...(user.role === 'ADMIN' ? [{ id: 'monitoring' as TabId, label: 'Monitoring', icon: '📊' }] : []),
  ];

  const adminMenuItems: { id: TabId; label: string; icon: string; desc: string }[] = [
    { id: 'pengaturan-aturan', label: 'Pengaturan Aturan', icon: '⚖️', desc: 'Kelola batasan & aturan penugasan' },
    { id: 'riwayat-audit', label: 'Riwayat Audit', icon: '📜', desc: 'Catatan log aktivitas & override' },
    { id: 'pengguna', label: 'Kelola Pengguna', icon: '👤', desc: 'Hak akses & akun tim liturgi' },
  ];

  const isAdminTabActive = ['pengaturan-aturan', 'riwayat-audit', 'pengguna'].includes(activeTab);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/75 border-b border-white/80 shadow-xs">
      <div className="max-w-[94rem] mx-auto px-[clamp(1rem,3vw,3rem)] h-16 flex items-center justify-between gap-4">
        {/* Brand: Official Liturgical Church Crest & 2-Tier Typography */}
        <div
          onClick={() => onTabChange('beranda')}
          className="flex items-center gap-3 cursor-pointer group shrink-0 select-none spring-press"
        >
          <div className="relative w-10 h-10 rounded-full shadow-md shadow-emerald-950/25 border border-amber-400/80 group-hover:border-amber-300 group-hover:scale-105 transition-all duration-300 overflow-hidden flex items-center justify-center shrink-0">
            <ParishLogo className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-display font-bold text-base md:text-lg text-ink tracking-tight block leading-tight group-hover:text-emerald-950 transition-colors">
              Penjadwalan Liturgi
            </span>
            <span className="text-[10px] font-bold tracking-[0.16em] text-emerald-800 uppercase flex items-center gap-1 mt-0.5">
              <span>BIDANG LITURGI HTB SPM BOYOLALI</span>
              <span className="text-[8px] opacity-50">•</span>
              <span className="text-[9px] font-semibold opacity-75">KAS</span>
            </span>
          </div>
        </div>

        {/* Center: Segmented Pill Bar with Motion Layout Morphing */}
        <nav className="hidden lg:flex items-center gap-1 bg-surface/80 p-1.5 rounded-full border border-white shadow-xs backdrop-blur-md">
          {mainNavItems.map((item) => {
            const isActive =
              activeTab === item.id ||
              (item.id === 'jadwal' && (activeTab === 'penjadwalan' || activeTab === 'kalender'));
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1.5 spring-press select-none ${
                  isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute inset-0 bg-gradient-to-r from-[#D8EB73] to-[#E5F295] rounded-full shadow-xs -z-10"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Admin Settings Dropdown */}
          {user.role === 'ADMIN' && (
            <div className="relative" ref={adminDropdownRef}>
              <button
                type="button"
                onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1.5 spring-press select-none ${
                  isAdminTabActive ? 'text-ink font-bold' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {isAdminTabActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute inset-0 bg-gradient-to-r from-[#D8EB73] to-[#E5F295] rounded-full shadow-xs -z-10"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span>⚙️</span>
                <span>Pengaturan</span>
                <span className="text-[9px] opacity-70">▼</span>
              </button>

              {/* Admin Dropdown Popover with Spring Entrance */}
              <AnimatePresence>
                {adminDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -4 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="absolute top-full right-0 mt-2 w-64 backdrop-blur-3xl bg-white/95 border border-white/90 rounded-2xl shadow-xl shadow-ink/10 p-2 z-50 origin-top-right"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft px-3 py-1.5 border-b border-surface-muted/60 mb-1">
                      Menu Admin
                    </div>
                    {adminMenuItems.map((item) => {
                      const isSelected = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id);
                            setAdminDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl spring-press transition-all flex items-start gap-2.5 cursor-pointer ${
                            isSelected ? 'bg-accent/40 text-ink font-bold' : 'hover:bg-surface/80 text-ink'
                          }`}
                        >
                          <span className="text-base leading-none mt-0.5">{item.icon}</span>
                          <div>
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className="text-[10px] text-ink-soft font-normal">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        {/* Right side: Google Auth Profile & Popover with Spring Physics */}
        <div className="flex items-center gap-3">
          {firebaseUser ? (
            <div className="relative" ref={profilePopoverRef}>
              {/* Profile Pill Button */}
              <button
                type="button"
                onClick={() => setProfilePopoverOpen(!profilePopoverOpen)}
                className="flex items-center gap-2.5 bg-white/85 hover:bg-white p-1 pl-1.5 pr-3 rounded-full border border-white shadow-xs backdrop-blur-md cursor-pointer spring-press hover:scale-[1.02]"
              >
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={user.displayName}
                    className="w-7 h-7 rounded-full object-cover border border-white shadow-2xs"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center font-bold text-xs text-ink">
                    {user.displayName.charAt(0)}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-ink truncate max-w-[120px]">
                    {user.displayName}
                  </div>
                </div>
                <Badge variant={user.role === 'ADMIN' ? 'complete' : user.role === 'SCHEDULER' ? 'warning' : 'draft'}>
                  {user.role}
                </Badge>
                <span className="text-[9px] text-ink-soft">▼</span>
              </button>

              {/* Profile Card Popover with Spring Entrance */}
              <AnimatePresence>
                {profilePopoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -4 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="absolute top-full right-0 mt-2 w-72 backdrop-blur-3xl bg-white/95 border border-white/90 rounded-3xl shadow-xl shadow-ink/10 p-4 z-50 space-y-3 origin-top-right"
                  >
                    <div className="flex items-center gap-3 pb-3 border-b border-surface-muted/60">
                      {firebaseUser.photoURL ? (
                        <img
                          src={firebaseUser.photoURL}
                          alt={user.displayName}
                          className="w-11 h-11 rounded-2xl object-cover border border-white shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center font-bold text-base text-ink">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <div className="text-sm font-bold text-ink truncate">{user.displayName}</div>
                        <div className="text-xs text-ink-soft truncate">{user.email}</div>
                        <div className="mt-1">
                          <Badge variant={user.role === 'ADMIN' ? 'complete' : 'draft'}>
                            Role: {user.role}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          signOut();
                          setProfilePopoverOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white text-xs font-bold spring-press transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>🚪</span>
                        <span>Keluar dari Akun</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={signInWithGoogle}
              className="rounded-full shadow-md shadow-ink/10 font-bold spring-press"
            >
              🔐 Masuk Google
            </Button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-ink hover:bg-white/60 rounded-2xl cursor-pointer border border-surface-muted spring-press"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Drawer with Spring Physics */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="lg:hidden p-4 bg-white/95 backdrop-blur-3xl border-b border-surface-muted space-y-2 overflow-hidden"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft px-3 py-1">
              Menu Utama
            </div>
            {mainNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 spring-press ${
                  activeTab === item.id ? 'bg-accent text-ink' : 'text-ink-soft hover:bg-surface'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            {user.role === 'ADMIN' && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft px-3 pt-3 pb-1 border-t border-surface-muted/60">
                  Pengaturan Admin
                </div>
                {adminMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 spring-press ${
                      activeTab === item.id ? 'bg-accent text-ink' : 'text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}