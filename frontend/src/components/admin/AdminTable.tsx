import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">{children}</div>
}

export function AdminTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-paper-2 text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
  name,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  name?: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-line text-pine"
      />
      {label}
    </label>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" className="bg-red-700 hover:bg-red-800" onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
