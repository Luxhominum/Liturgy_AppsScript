import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    
    return (
      <div className={`flex flex-col w-full ${className}`}>
        <label htmlFor={inputId} className="text-xs font-bold uppercase text-ink-soft mb-1">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`h-11 min-h-[44px] rounded-lg border border-surface-muted bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-ink transition-shadow ${
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''
          }`}
          {...props}
        />
        {error && <span className="text-danger text-sm mt-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
