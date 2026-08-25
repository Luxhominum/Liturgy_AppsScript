import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SchedulingWorkspace from './SchedulingWorkspace';
import type { UserRole } from '../../types';

interface SchedulingDrawerProps {
  open: boolean;
  onClose: () => void;
  weekendId: string | null;
  isSpecialMode?: boolean;
  userRole: UserRole;
  onOpenPrint?: () => void;
}

export default function SchedulingDrawer({
  open,
  onClose,
  weekendId,
  isSpecialMode = false,
  userRole,
  onOpenPrint,
}: SchedulingDrawerProps) {
  // Listen for Escape key to close drawer
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && weekendId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          />

          {/* Slide-over Workspace Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-6xl bg-[#F5F2E6] h-full shadow-2xl border-l border-white/90 flex flex-col overflow-y-auto z-10"
          >
            {/* Sticky Drawer Top Bar */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-2xl px-6 py-3.5 border-b border-surface-muted/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-muted text-ink text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer spring-press"
                >
                  <span>←</span>
                  <span>Kembali ke Kalender</span>
                </button>
                <div className="hidden sm:block text-xs font-bold text-ink-soft">
                  Ruang Kerja Penjadwalan
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-ink-soft hover:text-ink hover:bg-surface transition-colors cursor-pointer spring-press font-bold"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Workspace Canvas */}
            <div className="p-6 md:p-8 flex-1">
              <SchedulingWorkspace
                key={weekendId}
                userRole={userRole}
                initialWeekendId={weekendId}
                isSpecialMode={isSpecialMode}
                onOpenCalendar={onOpenPrint}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}