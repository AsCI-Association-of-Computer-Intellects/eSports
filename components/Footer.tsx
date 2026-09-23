import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative mt-12 flex flex-wrap items-center justify-between gap-3.5 border-t border-border px-5 py-8 font-display text-xs font-semibold tracking-widest text-faint sm:px-8 lg:px-16">
      <div className="neon-divider absolute inset-x-0 top-0" />
      <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-[0.08em] text-ink">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-control border border-white/20 bg-white">
          <img src="/logos/AsCI.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span>
          AsCI<span className="text-accent-bright"> / </span>ESPORTS
        </span>
      </Link>
      <span>© 2026 AsCI ESPORTS</span>
      <span className="text-accent-bright/70">TEAM COMPETITION / BUILT FOR THE BOLD</span>
    </footer>
  )
}
