import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

function buttonText(value: React.ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(buttonText).join(' ')
  if (React.isValidElement(value)) return buttonText((value.props as { children?: React.ReactNode }).children)
  return ''
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-core-gradient text-primary-foreground font-semibold shadow-[0_0_24px_rgba(255,190,0,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110',
        destructive:
          'bg-destructive/15 text-red-300 border border-destructive/30 hover:bg-destructive/25 focus-visible:ring-destructive/30',
        outline:
          'border border-border bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:border-border-strong',
        secondary:
          'border border-border bg-white/[0.05] text-foreground hover:bg-white/[0.08]',
        ghost:
          'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3.5',
        sm: 'h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const actionText = `${buttonText(props.children)} ${String(props.title || '')}`.toLocaleLowerCase('pt-BR')
  const deleteAction = /\b(excluir|apagar|deletar)\b|limpar banco/.test(actionText)

  return (
    <Comp
      data-slot="button"
      data-delete-action={deleteAction ? 'true' : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
