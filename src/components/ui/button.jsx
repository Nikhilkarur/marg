import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
        gold: 'bg-gold-500 text-white hover:bg-gold-600 shadow-sm shadow-gold-500/20',
        danger: 'bg-marg-danger text-white hover:bg-red-600 shadow-sm shadow-red-500/20',
        outline:
          'border border-marg-border bg-white text-marg-text hover:bg-gray-50',
        outlineDanger:
          'border border-marg-danger/40 text-marg-danger hover:bg-red-50',
        ghost: 'text-marg-text hover:bg-gray-100',
      },
      size: {
        default: 'h-11 px-5',
        lg: 'h-12 px-6 text-base',
        sm: 'h-9 px-4 text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

const Button = forwardRef(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }
