import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import Header from './Header';
import type { TabId, User } from '../../types';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  user: User;
  children: ReactNode;
}

export default function Layout({ activeTab, onTabChange, user, children }: LayoutProps) {
  // Lenis 60fps silky smooth scrolling
  useEffect(() => {
    // Respect prefers-reduced-motion
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      prevent: (node) => {
        return (
          node.nodeType === 1 &&
          ((node as HTMLElement).closest('[data-lenis-prevent]') !== null ||
            (node as HTMLElement).closest('[role="dialog"]') !== null ||
            (node as HTMLElement).closest('.overflow-y-auto') !== null)
        );
      },
    });

    (window as any).lenis = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      (window as any).lenis = null;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#F5F2E6] flex flex-col font-body text-ink relative overflow-x-hidden selection:bg-accent selection:text-ink">
      {/* High-visibility glowing ambient background orbs */}
      <div className="fixed top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-[#E2F56C]/35 to-[#C3EC50]/20 blur-[120px] pointer-events-none -z-10 transform-gpu" />
      <div className="fixed top-[30%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-[#9AD6FF]/35 to-[#BFE4FF]/20 blur-[130px] pointer-events-none -z-10 transform-gpu" />
      <div className="fixed bottom-[-15%] left-[20%] w-[60vw] h-[45vw] rounded-full bg-gradient-to-tr from-[#E6D4F8]/35 to-[#F1E8FC]/25 blur-[140px] pointer-events-none -z-10 transform-gpu" />

      {/* Subtle Liturgical Parchment Grain Overlay */}
      <div className="fixed inset-0 bg-parchment-grain pointer-events-none z-50 opacity-40 mix-blend-overlay" />

      <Header activeTab={activeTab} onTabChange={onTabChange} user={user} />
      <main 
        id="main-content" 
        className="flex-1 w-full max-w-[94rem] mx-auto px-[clamp(1rem,3vw,3rem)] py-8 overflow-x-hidden relative z-10"
      >
        {children}
      </main>
    </div>
  );
}