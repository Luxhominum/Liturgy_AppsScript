import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

const Card: FC<CardProps> = ({ title, children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white/85 backdrop-blur-xl rounded-3xl border border-white/90 p-6 glass-specular transition-all duration-200 ${className}`}
      {...props}
    >
      {title && (
        <h3 className="font-display font-bold text-xl text-ink border-b border-surface-muted/80 pb-4 mb-4">
          {title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
