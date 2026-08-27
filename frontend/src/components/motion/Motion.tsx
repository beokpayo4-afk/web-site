import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

type BoxProps = {
  children: ReactNode
  className?: string
}

export function Reveal({ children, className, delay = 0, y = 24 }: BoxProps & { delay?: number; y?: number }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className, delay = 0.06 }: BoxProps & { delay?: number }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, amount: 0.15 }}
      variants={
        reduce
          ? undefined
          : {
              hidden: {},
              show: { transition: { staggerChildren: delay } },
            }
      }
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: BoxProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={
        reduce
          ? undefined
          : {
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
            }
      }
    >
      {children}
    </motion.div>
  )
}

export function FadeIn({ children, className, delay = 0 }: BoxProps & { delay?: number }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </motion.div>
  )
}
