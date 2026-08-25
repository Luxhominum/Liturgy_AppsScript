import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layout } from './components/layout';
import { CalendarView, PrintScheduleView } from './components/calendar';
import PublicLandingPage from './components/home/PublicLandingPage';
import {
  ManageOfficersTab,
  AdminMonitoringTab,
  RuleSettingsTab,
  AuditLogsTab,
  UserManagementTab
} from './components/admin';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { TabId } from './types';

function parseRouteFromHash(hash: string): { tab: TabId; isPrint: boolean; weekendId: string | null } {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return { tab: 'beranda', isPrint: false, weekendId: null };

  const [path, query] = clean.split('?');
  const params = new URLSearchParams(query || '');
  const weekendId = params.get('id') || null;

  if (path === 'cetak') {
    return { tab: 'jadwal', isPrint: true, weekendId };
  }
  if (path === 'petugas') {
    return { tab: 'kelola-petugas', isPrint: false, weekendId: null };
  }
  const validTabs: TabId[] = ['beranda', 'jadwal', 'kelola-petugas', 'monitoring', 'pengaturan-aturan', 'riwayat-audit', 'pengguna'];
  const matchedTab = validTabs.find((t) => t === path) || 'beranda';

  return { tab: matchedTab, isPrint: false, weekendId };
}

function MainContent() {
  const [activeTab, setActiveTab] = useState<TabId>(() => parseRouteFromHash(window.location.hash).tab);
  const [isPrintView, setIsPrintView] = useState<boolean>(() => parseRouteFromHash(window.location.hash).isPrint);
  const [targetWeekendId, setTargetWeekendId] = useState<string | null>(() => parseRouteFromHash(window.location.hash).weekendId);
  const { user } = useAuth();

  const currentUser = user || {
    email: 'tamu@paroki.org',
    role: 'VIEWER',
    displayName: 'Umat / Tamu'
  };

  // Browser History Navigation Synchronization (Enables Browser Back/Forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseRouteFromHash(window.location.hash);
      setActiveTab(route.tab);
      setIsPrintView(route.isPrint);
      setTargetWeekendId(route.weekendId);
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/beranda');
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const navigateTo = useCallback((tab: TabId, isPrint = false, weekendId: string | null = null) => {
    setActiveTab(tab);
    setIsPrintView(isPrint);
    setTargetWeekendId(weekendId);

    let newHash = `#/${tab}`;
    if (isPrint) {
      newHash = '#/cetak';
    } else if (tab === 'jadwal' && weekendId) {
      newHash = `#/jadwal?id=${encodeURIComponent(weekendId)}`;
    }
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  }, []);

  if (isPrintView) {
    return (
      <div className="max-w-[78rem] mx-auto p-4 md:p-8">
        <PrintScheduleView
          initialWeekendId={targetWeekendId}
          onBack={() => navigateTo('beranda', false, null)}
        />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'beranda':
        return (
          <PublicLandingPage
            onOpenWorkspace={() => navigateTo('jadwal', false, null)}
            onOpenCalendar={(targetDate?: string) => {
              const wkdId = targetDate ? (targetDate.startsWith('w-') ? targetDate : 'w-' + targetDate) : null;
              navigateTo('jadwal', false, wkdId);
            }}
            onPrintSchedule={() => navigateTo('jadwal', true, null)}
          />
        );
      case 'jadwal':
      case 'penjadwalan':
      case 'kalender':
        return (
          <CalendarView
            initialWeekendId={targetWeekendId}
            userRole={currentUser.role}
            onOpenPrint={() => navigateTo('jadwal', true, null)}
          />
        );
      case 'monitoring':
        return currentUser.role === 'ADMIN' ? (
          <AdminMonitoringTab
            onNavigateToSchedule={(wkdId) => navigateTo('jadwal', false, wkdId)}
          />
        ) : (
          <div className="p-8 text-center bg-white/80 rounded-3xl border border-surface-muted max-w-lg mx-auto space-y-4">
            <div className="text-3xl">🔒</div>
            <h3 className="font-display font-bold text-lg text-ink">Akses Terbatas (Admin Khusus)</h3>
            <p className="text-xs text-ink-soft">
              Halaman ini hanya dapat diakses oleh Administrator Paroki. Silakan masuk menggunakan akun Google resmi paroki.
            </p>
          </div>
        );
      case 'kelola-petugas':
        return <ManageOfficersTab />;
      case 'pengaturan-aturan':
        return currentUser.role === 'ADMIN' ? (
          <RuleSettingsTab />
        ) : (
          <div className="p-8 text-center bg-white/80 rounded-3xl border border-surface-muted max-w-lg mx-auto space-y-4">
            <div className="text-3xl">🔒</div>
            <h3 className="font-display font-bold text-lg text-ink">Akses Terbatas (Admin Khusus)</h3>
            <p className="text-xs text-ink-soft">
              Halaman ini hanya dapat diakses oleh Administrator Paroki.
            </p>
          </div>
        );
      case 'riwayat-audit':
        return currentUser.role === 'ADMIN' ? (
          <AuditLogsTab />
        ) : (
          <div className="p-8 text-center bg-white/80 rounded-3xl border border-surface-muted max-w-lg mx-auto space-y-4">
            <div className="text-3xl">🔒</div>
            <h3 className="font-display font-bold text-lg text-ink">Akses Terbatas (Admin Khusus)</h3>
            <p className="text-xs text-ink-soft">
              Halaman ini hanya dapat diakses oleh Administrator Paroki.
            </p>
          </div>
        );
      case 'pengguna':
        return currentUser.role === 'ADMIN' ? (
          <UserManagementTab />
        ) : (
          <div className="p-8 text-center bg-white/80 rounded-3xl border border-surface-muted max-w-lg mx-auto space-y-4">
            <div className="text-3xl">🔒</div>
            <h3 className="font-display font-bold text-lg text-ink">Akses Terbatas (Admin Khusus)</h3>
            <p className="text-xs text-ink-soft">
              Halaman ini hanya dapat diakses oleh Administrator Paroki.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={(tab) => navigateTo(tab, false, null)} user={currentUser}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="will-change-[opacity,transform]"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}