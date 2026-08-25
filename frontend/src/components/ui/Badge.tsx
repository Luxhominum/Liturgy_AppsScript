import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'draft' | 'complete' | 'final' | 'danger' | 'success' | 'warning';
  children: ReactNode;
}

const Badge: FC<BadgeProps> = ({ variant = 'draft', children, className = '', ...props }) => {
  const variants = {
    draft: 'bg-surface-muted text-ink-soft',
    complete: 'bg-blue-soft text-ink',
    final: 'bg-lilac-soft text-ink',
    danger: 'bg-danger/10 text-danger',
    success: 'bg-blue-soft text-ink',
    warning: 'bg-accent text-ink',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${variants[variant] || variants.draft} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
