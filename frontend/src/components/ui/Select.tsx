import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, placeholder, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;
    
    return (
      <div className={`flex flex-col w-full ${className}`}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-bold uppercase text-ink-soft mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-11 min-h-[44px] rounded-lg border border-surface-muted bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-ink transition-shadow cursor-pointer ${
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''
          }`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled} className={option.disabled ? 'text-ink-soft bg-surface' : ''}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <span className="text-danger text-sm mt-1">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;