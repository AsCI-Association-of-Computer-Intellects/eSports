'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  ChevronDown,
  Gift,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import GameLogo from '@/components/GameLogo'
import { games, gameKeys, type GameKey } from '@/lib/games'

export default function HomePage() {
  const [selectedGame, setSelectedGame] = useState<GameKey>('freefire')
  const game = games[selectedGame]
  const [carouselIndex, setCarouselIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(i => (i + 1) % gameKeys.length)
    }, 2800)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="relative overflow-x-clip">
      <Navbar />

      {/* Hero */}
      <section
        id="top"
        className="relative mx-auto grid min-h-[620px] max-w-[1440px] grid-cols-1 items-center gap-8 overflow-hidden px-5 py-10 sm:px-8 sm:py-14 md:min-h-[680px] md:gap-12 lg:grid-cols-[1fr_0.95fr] lg:px-12 xl:px-16"
      >
        {/* Ambient Glows */}
        <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40 sm:opacity-50" />
        <div className="pointer-events-none absolute -left-16 -top-24 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(0,140,255,0.22),transparent_70%)] blur-[90px] sm:h-[460px] sm:w-[460px]" />
        <div className="pointer-events-none absolute -right-16 top-24 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,50,30,0.1),transparent_70%)] blur-[90px] sm:h-[440px] sm:w-[440px]" />
        <div className="scanline-shift pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_5px)]" />

        {/* Hero Left Content */}
        <div className="relative z-10 flex flex-col items-start gap-5 sm:gap-6">
          <div className="inline-flex items-center gap-2 border-l-2 border-accent-bright bg-accent-bright/10 px-3 py-2 hud-label text-accent-bright">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-bright shadow-[0_0_8px_rgba(0,217,255,0.8)]" />
            AsCI presents • E-sports tournament • Sep 25 – 30, 2026
          </div>

          <h1 className="max-w-full text-[42px] font-black leading-[0.88] tracking-[-0.03em] text-ink xs:text-[50px] sm:text-[72px] md:text-[82px] lg:text-[clamp(4.4rem,7vw,6.7rem)]">
            TEAM UP.
            <br />
            <span className="bg-gradient-to-r from-accent-bright via-sky-400 to-accent bg-clip-text text-transparent">
              WIN LOUD.
            </span>
          </h1>

          <p className="max-w-[48ch] text-base leading-relaxed text-muted sm:text-lg">
            Organized by the <strong className="text-ink">Association of Computer Intellects (AsCI)</strong>.
            Build your squad, sharpen your strategy, and compete across a professional inter-college tournament with zero registration fee.
          </p>

          {/* Quick Perks Strip */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-accent-bright">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-bright/25 bg-accent-bright/10 px-2.5 py-1">
              <Sparkles size={13} /> 100% Free Entry
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-bright/25 bg-accent-bright/10 px-2.5 py-1">
              <Trophy size={13} /> Team competition
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-bright/25 bg-accent-bright/10 px-2.5 py-1">
              <Award size={13} /> Digital Certificate for All
            </span>
          </div>

          <div className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center sm:gap-5">
            <Link
              href={`/register/${selectedGame}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-accent-gradient px-7 py-3.5 font-display text-[15px] font-bold uppercase tracking-[0.08em] text-[#04101f] shadow-[0_0_24px_rgba(0,191,255,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(0,217,255,0.42)] sm:w-auto"
            >
              <span>Register for Free</span>
              <ArrowRight size={18} />
            </Link>

            <a
              href="#tournaments"
              className="inline-flex items-center justify-center gap-1.5 py-2 font-display text-sm font-semibold text-muted transition-colors hover:text-accent-bright sm:text-[15px]"
            >
              <span>Explore tournaments</span>
              <ChevronDown size={16} />
            </a>
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs sm:text-sm text-muted">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-bg bg-white shadow-[0_0_14px_rgba(0,191,255,0.2)]">
              <img src="/logos/AsCI.png" alt="AsCI" className="h-full w-full object-contain" />
            </div>
            <span>
              Hosted by <strong className="font-semibold text-ink">AsCI Club</strong> • Inter-college team esports
            </span>
          </div>
        </div>

        {/* Hero Right Carousel */}
        <div className="relative z-10 flex h-[380px] w-full items-center justify-center sm:h-[460px] lg:h-[540px]">
          <div className="cinematic-frame relative flex h-full w-full max-w-[600px] items-center justify-center overflow-hidden">
            <div className="absolute left-5 top-5 z-20 hud-label text-accent-bright">AsCI / LIVE SERIES 01</div>
            <div className="absolute right-5 top-5 z-20 flex items-center gap-2 hud-label text-muted"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> SELECT TITLE</div>
            <div className="absolute bottom-5 left-5 z-20 hud-label text-muted">INTER-COLLEGE TEAM PLAY</div>
            {gameKeys.map((key, i) => {
              const item = games[key]
              const isActive = i === carouselIndex
              return (
                <div
                  key={key}
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-4 transition-all duration-700 ease-in-out ${
                    isActive
                      ? 'scale-100 opacity-100 pointer-events-auto'
                      : 'scale-95 opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="relative z-10 flex h-56 w-56 items-center justify-center drop-shadow-[0_14px_48px_rgba(0,191,255,0.3)] sm:h-72 sm:w-72 md:h-[360px] md:w-[360px]">
                    <img
                      src={`/logos/${key}.png`}
                      alt={item.name}
                      className="h-full w-full object-contain rounded-xl"
                      loading="lazy"
                    />
                  </div>
                  <span className="z-10 text-center font-display text-xl font-bold uppercase tracking-[0.16em] text-ink sm:text-2xl">
                    {item.name}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Dots Indicator */}
          <div className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-3">
            {gameKeys.map((key, i) => (
              <button
                key={key}
                type="button"
                onClick={() => setCarouselIndex(i)}
                aria-label={`Show ${games[key].name}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === carouselIndex ? 'w-6 bg-accent-bright' : 'w-2 bg-border-strong hover:bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Compact tournament facts */}
      <section className="border-y border-border bg-bg-elevated/70">
        <div className="mx-auto grid max-w-[1320px] grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[
            ['DATE', '25–30 SEP 2026'],
            ['FORMAT', 'TEAM / SQUAD'],
            ['GAMES', `${gameKeys.length} TITLES`],
            ['ENTRY', 'FREE'],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-4 sm:px-7 sm:py-5">
              <div className="font-display text-[10px] font-bold tracking-[0.18em] text-accent-bright">{label}</div>
              <div className="mt-1 font-display text-base font-bold tracking-wider text-ink sm:text-lg">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Ticker */}
      <section className="overflow-hidden border-y border-border bg-bg-elevated">
        <div className="flex w-max animate-ticker-scroll items-center gap-7 whitespace-nowrap py-3.5">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex items-center gap-7">
              {[
                'ORGANIZED BY AsCI',
                'SEPTEMBER 25 - 30, 2026',
                'ZERO REGISTRATION FEE',
                'TOP 1: IN-GAME CURRENCY',
                'DIGITAL CERTIFICATES FOR ALL',
              ].map(label => (
                <span key={label} className="flex items-center gap-7 px-1 font-display text-[13px] font-semibold tracking-widest text-muted">
                  {label}
                  <b className="text-accent">•</b>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Team competition */}
      <section className="relative border-b border-border bg-bg-elevated/55 px-5 py-12 sm:px-8 md:py-16 lg:px-16">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="font-display text-[13px] font-semibold tracking-widest text-accent-bright">TEAM COMPETITION</div>
              <h2 className="mt-2 text-[30px] leading-none sm:text-[42px]">More than a player. <em className="not-italic text-accent-bright">A squad.</em></h2>
            </div>
            <p className="max-w-[42ch] text-sm">The bracket rewards the teams that communicate clearly, adapt quickly, and stay composed under pressure.</p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-4">
            {[
              { icon: Shield, label: 'Strategy', body: 'Think ahead.' },
              { icon: Sparkles, label: 'Gameplay', body: 'Show your skills.' },
              { icon: Users, label: 'Teamwork', body: 'Build together.' },
              { icon: Trophy, label: 'Competition', body: 'Bring your best.' },
            ].map(({ icon: Icon, label, body }) => (
              <div key={label} className="bg-bg-elevated/90 p-5 sm:p-6">
                <Icon size={20} className="mb-7 text-accent-bright" />
                <h3 className="text-base uppercase tracking-wider">{label}</h3>
                <p className="mt-1 text-xs">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tournaments */}
      <section id="tournaments" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
        <div className="mb-11 flex flex-wrap items-end justify-between gap-8">
          <div>
            <div className="font-display text-[13px] font-semibold tracking-widest text-faint">01 / CHOOSE YOUR BATTLE</div>
            <h2 className="mt-2.5 text-[32px] leading-[1.05] sm:text-[46px]">
              Pick your <em className="not-italic text-accent-bright">arena.</em>
            </h2>
          </div>
          <p className="max-w-[40ch] text-[15px]">
            Zero entry fee. The #1 champion in each game walks away with exclusive in-game currency, and every participant receives an official digital certificate.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gameKeys.map((key, index) => {
            const item = games[key]
            const active = selectedGame === key
            return (
              <button
                key={key}
                onClick={() => setSelectedGame(key)}
                style={{ '--game-color': item.color } as React.CSSProperties}
                className={`cinematic-card group flex flex-col gap-5 rounded-card border border-border p-6 text-left text-ink transition-all duration-300 hover:-translate-y-1 hover:border-border-strong ${
                  active ? 'game-card-active bg-gradient-to-br from-surface-strong to-surface' : ''
                }`}
              >
                <div className="relative z-10 flex items-center gap-2.5">
                  <span className="font-display text-[13px] font-bold text-faint">0{index + 1}</span>
                  <span className="game-tag-outline rounded-full border px-2.5 py-1 font-display text-[11px] font-semibold tracking-widest">
                    FREE ENTRY
                  </span>
                  <span className={`ml-auto inline-flex transition-all ${active ? 'translate-x-0.5' : ''}`} style={{ color: active ? item.color : undefined }}>
                    <ArrowRight size={17} />
                  </span>
                </div>
                <div className="relative z-10 transition-transform duration-300 group-hover:scale-[1.03]">
                  <GameLogo game={item} size={108} />
                </div>
                <div className="relative z-10">
                  <h3 className="mb-1.5 text-[22px]">{item.name}</h3>
                  <p className="text-sm">{item.description}</p>
                </div>
                <div className="relative z-10 flex flex-col gap-2 border-t border-border pt-4 text-[13px] text-muted">
                  <div className="flex items-center gap-2 text-accent-bright">
                    <Trophy size={14} /> <strong>Top 1:</strong> Rs.600 Cash for 1st Position Squad
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Award size={13} /> Digital Cert for All
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={13} /> {item.squads}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:px-16">
        <div className="flex flex-col items-start gap-4.5 lg:sticky lg:top-28 lg:self-start">
          <div className="font-display text-[13px] font-semibold tracking-widest text-faint">02 / KNOW THE CODE</div>
          <h2 className="text-[32px] leading-[1.05] sm:text-[46px]">
            Play clean.
            <br />
            <em className="not-italic text-accent-bright">Play to win.</em>
          </h2>
          <p className="max-w-[38ch] text-[15px]">
            Organized fairly by the AsCI committee. Level playing field, transparent scoring, and zero toxicity.
          </p>
          <Link
            href={`/register/${selectedGame}`}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3.5 font-display text-[15px] font-semibold text-ink transition-colors hover:border-accent-bright hover:text-accent-bright"
          >
            Register for {game.name} <ArrowRight size={16} />
          </Link>
        </div>

        <div className="rounded-panel border border-border bg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap gap-2">
            {gameKeys.map(key => {
              const selected = selectedGame === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedGame(key)}
                  className={`rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                    selected ? 'border-accent bg-accent-soft text-ink' : 'border-border text-muted'
                  }`}
                >
                  {games[key].name}
                </button>
              )
            })}
          </div>

          <div className="mb-5 flex items-center gap-3.5">
            <div
              className="rule-icon-tile flex h-11 w-11 items-center justify-center rounded-xl border font-display text-sm font-bold"
              style={{ color: game.color }}
            >
              {game.short}
            </div>
            <div>
              <span className="mb-0.5 block font-display text-[11px] font-semibold tracking-widest text-faint">{game.tag}</span>
              <h3 className="text-xl">{game.name} rules</h3>
            </div>
          </div>

          <div className="flex flex-col">
            {game.rules.map((rule, i) => (
              <div key={rule} className="grid grid-cols-[28px_1fr_18px] items-center gap-3.5 border-t border-border py-3.5 first:border-t-0">
                <span className="font-display text-xs font-bold text-faint">0{i + 1}</span>
                <p className="text-sm text-ink">{rule}</p>
                <Check size={17} className="text-accent" />
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2.5 border-t border-border pt-5 text-[13px] text-faint">
            <Shield size={16} className="mt-0.5 flex-shrink-0 text-accent" />
            AsCI coordinator decisions are final. By registering, every player agrees to the code of conduct.
          </div>
        </div>
      </section>

      {/* Why & Event Details */}
      <section id="why" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 md:py-24 lg:px-16">
        <div className="font-display text-[13px] font-semibold tracking-widest text-faint">03 / EVENT OVERVIEW</div>
        <h2 className="mb-11 mt-2.5 text-[32px] leading-[1.05] sm:text-[46px]">
          Hosted by AsCI.
          <br />
          <em className="not-italic text-accent-bright">Everything you need to know.</em>
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Calendar,
              num: '01',
              title: 'Sept 25 – 30, 2026',
              body: 'A full 6-day esports tournament bracket conducted smoothly across multiple qualifiers leading to the grand finals.',
            },
            {
              icon: Gift,
              num: '02',
              title: 'Top 1 In-Game Currency',
              body: 'The undisputed #1 champion player in each game will be awarded exclusive in-game currency directly to their ID.',
            },
            {
              icon: Award,
              num: '03',
              title: 'Free Entry & Certificates',
              body: 'Zero registration fee for all squads. Every participating player receives an official verified digital certificate from AsCI.',
            },
          ].map(({ icon: Icon, num, title, body }) => (
            <div key={num} className="flex flex-col gap-3.5 rounded-card border border-border bg-surface p-6">
              <span className="font-display text-xs font-bold text-faint">{num}</span>
              <Icon size={24} className="text-accent-bright" />
              <h3 className="text-lg">{title}</h3>
              <p className="text-sm">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}