import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react'

const fieldClass = (error?: string, className = '') =>
  `w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-pine ${error ? 'border-red-500' : 'border-line'} ${className}`

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }>(
  function Input({ label, error, id, className = '', ...props }, ref) {
    const inputId = id ?? props.name
    return (
      <label className="block text-left" htmlFor={inputId}>
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
        <input id={inputId} ref={ref} className={fieldClass(error, className)} {...props} />
        {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
      </label>
    )
  },
)

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }
>(function TextArea({ label, error, id, className = '', ...props }, ref) {
  const inputId = id ?? props.name
  return (
    <label className="block text-left" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <textarea id={inputId} ref={ref} className={`min-h-28 ${fieldClass(error, className)}`} {...props} />
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }
>(function Select({ label, error, id, className = '', children, ...props }, ref) {
  const inputId = id ?? props.name
  return (
    <label className="block text-left" htmlFor={inputId}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select id={inputId} ref={ref} className={fieldClass(error, className)} {...props}>
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
})
