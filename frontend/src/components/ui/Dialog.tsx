import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Dialog: FC<DialogProps> = ({ open, onClose, title, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      (window as any).lenis?.stop();
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCloseRef.current();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = originalOverflow;
        (window as any).lenis?.start();
        document.removeEventListener('keydown', handleEscape);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [open]);

  const content = (
    <AnimatePresence>
      {open && (
        <div 
          data-lenis-prevent="true"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-center justify-center p-4 min-h-screen"
        >
          {/* Backdrop with Motion Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Modal Panel with Emil Kowalski Spring Physics */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            data-lenis-prevent="true"
            initial={{ opacity: 0, scale: 0.93, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="relative bg-white/95 backdrop-blur-2xl rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-white/90 focus:outline-none my-auto max-h-[88vh] flex flex-col z-20 text-ink"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-muted/80 shrink-0">
              <h2 id="dialog-title" className="font-display font-bold text-2xl text-ink">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="text-ink-soft hover:text-ink focus:outline-none rounded-full p-1.5 cursor-pointer hover:bg-surface transition-colors spring-press"
                aria-label="Tutup"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div 
              data-lenis-prevent="true"
              className="flex-1 min-h-0 flex flex-col overflow-y-auto pr-1"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

export default Dialog;