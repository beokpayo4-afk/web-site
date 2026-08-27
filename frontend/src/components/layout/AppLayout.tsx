import { Outlet } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Header, MobileCartBar } from '@/components/layout/Header'

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>
      <Footer />
      <MobileCartBar />
    </div>
  )
}
