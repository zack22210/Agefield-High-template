import * as React from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'button-primary',
        outline: 'button-outline',
        dark: 'button-dark'
      },
      size: {
        default: 'h-12 px-5 text-xs',
        sm: 'h-10 px-4 text-xs',
        lg: 'h-14 px-7 text-sm'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default'
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, ...props}, ref) => (
    <button ref={ref} className={cn(buttonVariants({variant, size, className}))} {...props} />
  )
);
Button.displayName = 'Button';

export {Button, buttonVariants};
