'use client'

import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

const icons = {
  default: <Info className="size-5 shrink-0 text-primary" />,
  success: <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />,
  destructive: <XCircle className="size-5 shrink-0 text-red-400" />,
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              {icons[props.variant ?? 'default']}
              <div className="grid gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
