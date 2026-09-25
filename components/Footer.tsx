import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-border px-5 py-8 font-display text-xs font-semibold tracking-widest text-faint sm:px-8 lg:px-16">
      <div className="neon-divider absolute inset-x-0 top-0" />
      <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-[0.08em] text-ink">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-control border border-white/20 bg-white">
          <img src="/logos/AsCI.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span>
          AsCI<span className="text-accent-bright"> / </span>ESPORTS
        </span>
      </Link>
      <div className="flex flex-col gap-1.5 tracking-[0.12em]">
        <span className="text-[10px] text-accent-bright">EMERGENCY CONTACT / QUERIES</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="tel:6303510255" className="transition-colors hover:text-accent-bright">Bharat · 6303510255</a>
          <a href="tel:7978163823" className="transition-colors hover:text-accent-bright">Charan · 7978163823</a>
        </div>
      </div>
      <span>© 2026 AsCI ESPORTS</span>
      <span className="text-accent-bright/70">TEAM COMPETITION / BUILT FOR THE BOLD</span>
    </footer>
  )
}
