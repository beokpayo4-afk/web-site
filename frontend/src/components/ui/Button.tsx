import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { buttonClassName, type ButtonVariant } from '@/components/ui/buttonStyles'

export type { ButtonVariant }

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  return (
    <button className={buttonClassName(variant, className)} {...props}>
      {children}
    </button>
  )
}
