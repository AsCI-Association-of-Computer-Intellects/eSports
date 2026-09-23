'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, Ticket, X } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()

  return (
    <nav className="sticky top-0 z-40 flex min-w-0 items-center gap-3 border-b border-border bg-[#03070D]/90 px-3.5 py-3.5 backdrop-blur-xl sm:gap-6 sm:px-8 lg:px-16">
      <Link href="/" aria-label="AsCI esports home" className="mr-auto flex min-w-0 items-center gap-2 font-display text-base font-bold tracking-[0.08em] sm:gap-2.5 sm:text-[18px]">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-control border border-white/20 bg-white shadow-[0_0_18px_rgba(0,217,255,0.3)]">
          <img src="/logos/AsCI.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="truncate">
          AsCI<span className="text-accent-bright"> / </span>ESPORTS
        </span>
      </Link>

      <div
        className={`fixed inset-x-0 top-[73px] flex-col items-start gap-1 border-b border-border bg-bg-elevated px-5 pb-6 pt-4 text-sm font-medium text-muted transition-all duration-200 md:static md:flex md:translate-y-0 md:flex-row md:items-center md:gap-7 md:border-none md:bg-transparent md:p-0 md:opacity-100 ${
          menuOpen ? 'flex translate-y-0 opacity-100' : 'hidden -translate-y-2 opacity-0 md:flex'
        }`}
      >
        <Link href="/#tournaments" onClick={() => setMenuOpen(false)} className={`relative w-full py-2.5 hover:text-ink md:w-auto md:py-0 ${pathname === '/' ? 'after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-accent-bright' : ''}`}>
          Tournaments
        </Link>
        <Link href="/#rules" onClick={() => setMenuOpen(false)} className="w-full py-2.5 hover:text-ink md:w-auto md:py-0">
          Rules
        </Link>
        <Link href="/#why" onClick={() => setMenuOpen(false)} className="w-full py-2.5 hover:text-ink md:w-auto md:py-0">
          About AsCI
        </Link>
        {user && (
          <Link href="/tickets" onClick={() => setMenuOpen(false)} className={`relative inline-flex w-full items-center gap-1.5 py-2.5 hover:text-ink md:w-auto md:py-0 ${pathname === '/tickets' ? 'text-accent-bright after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-accent-bright' : ''}`}>
            <Ticket size={14} /> My tickets
          </Link>
        )}
        {user ? (
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              void signOut()
            }}
            className="w-full py-2.5 text-left hover:text-ink md:hidden"
          >
            Sign out
          </button>
        ) : (
          <Link href="/login" onClick={() => setMenuOpen(false)} className="w-full py-2.5 hover:text-ink md:hidden">
            Sign in
          </Link>
        )}
      </div>

      {loading ? (
        <span className="hidden text-sm text-muted md:inline">…</span>
      ) : user ? (
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 rounded-control border border-border-strong px-5 py-2.5 font-display text-[14px] font-semibold text-ink transition-colors hover:border-accent-bright hover:text-accent-bright"
          >
            <Ticket size={15} /> Tickets
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          className="hidden items-center gap-2 rounded-full bg-accent-gradient px-6 py-3 font-display text-[15px] font-semibold text-[#04101f] transition-transform hover:-translate-y-0.5 md:inline-flex"
        >
          <span>Sign in with Google</span>
          <ArrowRight size={16} />
        </Link>
      )}

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
        className="inline-flex flex-shrink-0 rounded-lg border border-border-strong p-2 text-ink md:hidden"
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </nav>
  )
}
