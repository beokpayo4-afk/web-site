import { Link } from 'react-router-dom'

import { NewsletterSection } from '@/components/storefront/NewsletterSection'
import { HOME_AISLES } from '@/content/aisles'

const quickLinks = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/shop', 'Shop'],
  ['/contact', 'Contact'],
] as const

const policyLinks = [
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms and Conditions'],
  ['/refund-policy', 'Refund and Returns Policy'],
  ['/shipping-policy', 'Shipping and Returns'],
  ['/cancellation-policy', 'Cancellation Policy'],
] as const

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-pine text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl">Nexora</p>
          <p className="mt-3 max-w-sm text-sm text-paper/80">
            Your one-stop shop for electronics and compact home essentials. Original catalogue. GST on the invoice.
          </p>
        </div>
        <div>
          <p className="font-semibold">Quick Links</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-paper/80">
            {quickLinks.map(([to, label]) => (
              <Link key={to} to={to} className="hover:text-paper">
                {label}
              </Link>
            ))}
            <Link to="/faq" className="hover:text-paper">
              FAQ
            </Link>
            {HOME_AISLES.map((aisle) => (
              <Link key={aisle.id} to={aisle.to} className="hover:text-paper">
                {aisle.navLabel}
              </Link>
            ))}
            {policyLinks.map(([to, label]) => (
              <Link key={to} to={to} className="hover:text-paper">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-3 space-y-2 text-sm text-paper/80">
            <p>
              Email:{' '}
              <a className="hover:text-paper" href="mailto:hello@nexora.example">
                hello@nexora.example
              </a>
            </p>
            <p>Bengaluru, India — placeholder studio copy until final branding.</p>
          </div>
        </div>
        <div className="rounded-2xl bg-paper p-5 text-ink">
          <NewsletterSection compact />
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-paper/60">
          © {new Date().getFullYear()} Nexora. Independent storefront. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
