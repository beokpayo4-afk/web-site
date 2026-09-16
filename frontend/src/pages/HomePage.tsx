import { CategorySection } from '@/components/storefront/CategorySection'
import { CompactHomeSection } from '@/components/storefront/CompactHomeSection'
import { Hero } from '@/components/storefront/Hero'
import { ProductSection } from '@/components/storefront/ProductSection'
import { TrustRow } from '@/components/storefront/TrustRow'
import { Reveal } from '@/components/motion/Motion'

export function HomePage() {
  return (
    <div className="-mx-4 -mt-8">
      <Hero />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        <Reveal y={36} blur>
          <ProductSection
            kicker="Best sellers"
            title="Electronics sale"
            subtitle="Daily kit from the Luxurisse list, starting at ₹30 and staying under ₹1,000."
            to="/shop?bestseller=true&ordering=selling_price"
            query={{ bestseller: true, ordering: 'selling_price' }}
          />
        </Reveal>
        <Reveal delay={0.04} y={40} blur>
          <CategorySection />
        </Reveal>
        <Reveal delay={0.04} y={32}>
          <CompactHomeSection />
        </Reveal>
        <Reveal y={28}>
          <TrustRow />
        </Reveal>
        <Reveal y={36} blur>
          <ProductSection
            kicker="Catalogue"
            title="Browse the shop"
            subtitle="Live stock from ₹30. MRP beside selling price. GST on the invoice."
            to="/shop?ordering=selling_price"
            query={{ ordering: 'selling_price', page_size: 8 }}
          />
        </Reveal>
      </div>
    </div>
  )
}
