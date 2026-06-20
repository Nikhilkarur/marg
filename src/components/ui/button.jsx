import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white hover:from-emerald-600 hover:to-emerald-800 shadow-sm shadow-emerald-600/30 hover:shadow-md hover:shadow-emerald-600/40',
        gold: 'bg-gradient-to-br from-gold-400 to-gold-600 text-white hover:from-gold-500 hover:to-gold-600 shadow-sm shadow-gold-500/30 hover:shadow-md hover:shadow-gold-500/40',
        danger: 'bg-gradient-to-br from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800 shadow-sm shadow-red-500/30 hover:shadow-md hover:shadow-red-500/40',
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
