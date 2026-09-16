import { type ReactNode, useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'

export const easeLux = [0.22, 1, 0.36, 1] as const
export const springLux = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.8 }

type BoxProps = {
  children: ReactNode
  className?: string
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  blur = false,
}: BoxProps & { delay?: number; y?: number; blur?: boolean }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: blur ? 'blur(10px)' : 'blur(0px)' }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.18, margin: '0px 0px -8% 0px' }}
      transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease: easeLux }}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className, delay = 0.08 }: BoxProps & { delay?: number }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, amount: 0.12 }}
      variants={
        reduce
          ? undefined
          : {
              hidden: {},
              show: { transition: { staggerChildren: delay, delayChildren: 0.06 } },
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
              hidden: { opacity: 0, y: 22, scale: 0.98 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.55, ease: easeLux },
              },
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
      transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : delay, ease: easeLux }}
    >
      {children}
    </motion.div>
  )
}

/** Word-by-word entrance for brand / headlines. */
export function TextReveal({
  text,
  className,
  delay = 0,
  once = false,
}: {
  text: string
  className?: string
  delay?: number
  once?: boolean
}) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  if (reduce) {
    return <span className={className}>{text}</span>
  }

  return (
    <motion.span
      className={className}
      aria-label={text}
      initial="hidden"
      animate={once ? undefined : 'show'}
      whileInView={once ? 'show' : undefined}
      viewport={once ? { once: true, amount: 0.4 } : undefined}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.045, delayChildren: delay } },
      }}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '110%', opacity: 0 },
              show: { y: '0%', opacity: 1, transition: { duration: 0.65, ease: easeLux } },
            }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/** Subtle scroll parallax for hero media. */
export function Parallax({
  children,
  className,
  offset = 48,
}: BoxProps & { offset?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [0, offset])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08])

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    <motion.div ref={ref} className={className} style={{ y, scale }}>
      {children}
    </motion.div>
  )
}

/** Soft magnetic pull toward the cursor (buttons / CTAs). */
export function Magnetic({
  children,
  className,
  strength = 18,
}: BoxProps & { strength?: number }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 20 })
  const springY = useSpring(y, { stiffness: 260, damping: 20 })

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const midX = rect.left + rect.width / 2
        const midY = rect.top + rect.height / 2
        x.set(((event.clientX - midX) / rect.width) * strength)
        y.set(((event.clientY - midY) / rect.height) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/** Cursor-lit card sheen for premium tiles. */
export function SpotlightCard({ children, className }: BoxProps) {
  const reduce = useReducedMotion()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const opacity = useMotionValue(0)
  const opacitySpring = useSpring(opacity, { stiffness: 280, damping: 28 })
  const background = useMotionTemplate`
    radial-gradient(420px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.18), transparent 55%)
  `

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={`relative overflow-hidden ${className ?? ''}`}
      onPointerEnter={() => opacity.set(1)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        mouseX.set(event.clientX - rect.left)
        mouseY.set(event.clientY - rect.top)
        opacity.set(1)
      }}
      onPointerLeave={() => opacity.set(0)}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background, opacity: opacitySpring }}
      />
      {children}
    </motion.div>
  )
}
