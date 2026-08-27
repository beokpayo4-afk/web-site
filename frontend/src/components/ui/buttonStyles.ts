const variants = {
  primary: 'bg-clay text-white hover:bg-clay-2',
  secondary: 'bg-pine text-white hover:bg-pine-2',
  ghost: 'bg-transparent text-ink border border-line hover:bg-paper-2',
  danger: 'bg-red-700 text-white hover:bg-red-800',
} as const

export type ButtonVariant = keyof typeof variants

export function buttonClassName(variant: ButtonVariant = 'primary', className = '') {
  return `inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`
}
