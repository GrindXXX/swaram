import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'rage' | 'resolved' | 'outline' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-ink text-paper',
  rage: 'bg-rage text-paper',
  resolved: 'bg-resolved text-paper',
  outline: 'border-[1.5px] border-ink bg-transparent text-ink',
  ghost: 'border-[1.5px] border-rage bg-transparent text-rage',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', icon, fullWidth = true, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`flex min-h-[50px] items-center justify-center gap-2 rounded-full font-mono text-sm font-bold tracking-wide ${VARIANT_CLASS[variant]} ${fullWidth ? 'w-full' : 'px-6'} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
