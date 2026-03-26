import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3
                           bg-white border-b border-surface-border">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-md text-ink-muted hover:bg-surface hover:text-ink
                       transition-colors cursor-pointer"
            aria-label="開啟選單"
            aria-expanded={mobileNavOpen}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="font-heading font-semibold text-base text-ink tracking-tight">
            VitaShelf
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
