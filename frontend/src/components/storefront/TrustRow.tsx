import { motion, useReducedMotion } from 'motion/react'

import { Stagger, StaggerItem, springLux } from '@/components/motion/Motion'

const notes = [
  {
    title: 'Free shipping',
    body: 'On every order, with GST on the invoice.',
    icon: (
      <path
        d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7V10ZM7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  {
    title: 'Easy returns',
    body: 'Seven days on unused, sealed items.',
    icon: (
      <path
        d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: 'Support that answers',
    body: 'Luxurisse desk, not a ticket farm.',
    icon: (
      <path
        d="M5 18v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  {
    title: 'GST on the invoice',
    body: 'Tax is calculated on the server.',
    icon: (
      <path
        d="M4 6h16v12H4V6Zm0 4h16M8 6v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
]

export function TrustRow() {
  const reduce = useReducedMotion()

  return (
    <Stagger className="grid gap-6 border-y border-line bg-white px-4 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-2" delay={0.1}>
      {notes.map((note) => (
        <StaggerItem key={note.title}>
          <motion.div
            className="flex gap-3"
            whileHover={reduce ? undefined : { y: -4 }}
            transition={springLux}
          >
            <motion.svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-8 w-8 shrink-0 text-clay"
              aria-hidden="true"
              whileHover={reduce ? undefined : { rotate: -8, scale: 1.08 }}
              transition={springLux}
            >
              {note.icon}
            </motion.svg>
            <div>
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{note.body}</p>
            </div>
          </motion.div>
        </StaggerItem>
      ))}
    </Stagger>
  )
}
