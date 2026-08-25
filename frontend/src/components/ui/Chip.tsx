import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  label?: string;
  onRemove?: () => void;
}

const Chip: FC<ChipProps> = ({ children, label, onRemove, className = '', ...props }) => {
  const content = children || label;
  return (
    <span
      className={`inline-flex items-center bg-surface-muted text-ink px-3 py-1 rounded-full text-sm font-medium ${className}`}
      {...props}
    >
      {content}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
          aria-label="Hapus"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Chip;
