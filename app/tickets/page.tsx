'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Ticket as TicketIcon, Users } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import GameLogo from '@/components/GameLogo'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { games, gameKeys, type GameKey } from '@/lib/games'
import type { Ticket } from '@/lib/types'

const groupLinks: Record<GameKey, string> = {
  freefire: 'https://chat.whatsapp.com/DVFvGHTBbk1ClQDkY69rka',
  bgmi: 'https://chat.whatsapp.com/LgJcYTRbIXF4kDdBCQeXBT',
  codm: 'https://chat.whatsapp.com/LgJcYTRbIXF4kDdBCQeXBT',
}

export default function TicketsPage() {
  const { user, loading: authLoading } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return

    const loadTickets = async () => {
      if (!supabase) {
        setLoading(false)
        setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
        return
      }
      const { data, error: ticketsError } = await supabase.rpc('get_my_tickets')
      if (ticketsError) {
        setError(ticketsError.message)
        setTickets([])
      } else {
        setTickets(Array.isArray(data) ? (data as Ticket[]) : [])
        setError(null)
      }
      setLoading(false)
    }

    void loadTickets()
  }, [authLoading, user, supabase])

  const ticketByGame = new Map(tickets.map(ticket => [ticket.game_key, ticket]))

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-12 sm:px-8 md:py-16">
        <div className="relative mb-10 overflow-hidden border-y border-border py-7 sm:py-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,191,255,0.16),transparent_68%)] blur-2xl" />
          <div className="relative hud-label text-accent-bright">YOUR ARENA PASS / LIVE REGISTRATION</div>
          <h1 className="mt-3 text-[38px] leading-[0.92] sm:text-[52px]">
            Tickets for <em className="not-italic text-accent-bright">{user?.email || 'your Gmail'}.</em>
          </h1>
          <p className="mt-2 max-w-[56ch] text-sm">
            Every game tied to this Gmail shows as a ticket. If you are not on a roster yet, register as team leader — one team per game.
          </p>
        </div>

        {loading || authLoading ? (
          <p className="text-sm">Loading tickets…</p>
        ) : error ? (
          <p className="text-sm text-[#ff8fa3]">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {gameKeys.map(key => {
              const game = games[key]
              const ticket = ticketByGame.get(key)
              return (
                <article
                  key={key}
                  className="cinematic-card group flex flex-col overflow-hidden rounded-panel border border-border transition-all duration-300 hover:-translate-y-1 hover:border-border-strong"
                  style={{ '--game-color': game.color } as React.CSSProperties}
                >
                  <div className="relative z-10 flex items-start gap-4 border-b border-border p-5">
                    <div className="transition-transform duration-300 group-hover:scale-105">
                      <GameLogo game={game} size={64} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[11px] font-semibold tracking-widest text-faint">{game.tag}</div>
                      <h2 className="truncate text-xl">{game.name}</h2>
                      {ticket ? <p className="text-sm text-ink">{ticket.team_name}</p> : <p className="text-sm">Not registered</p>}
                    </div>
                    <span className={`border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider ${ticket ? 'border-accent/40 bg-accent-soft text-accent-bright' : 'border-border text-faint'}`}>
                      {ticket ? ticket.role : 'Open'}
                    </span>
                  </div>

                  {ticket ? (
                    <div className="relative z-10 flex flex-1 flex-col gap-3 p-5">
                      <p className="font-display text-xs font-semibold tracking-widest text-faint">
                        UID · {ticket.in_game_uid}
                      </p>
                      {(ticket.branch || ticket.year_of_study) && (
                        <p className="text-xs text-muted">
                          {[ticket.branch, ticket.section && `Sec ${ticket.section}`, ticket.year_of_study]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <ul className="space-y-2">
                        {(ticket.roster || []).map(entry => (
                          <li key={`${entry.role}-${entry.in_game_uid}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                              <Users size={14} className="flex-shrink-0 text-faint" />
                              <span className="truncate">{entry.email || entry.in_game_uid}</span>
                            </span>
                            <span className="flex-shrink-0 text-xs uppercase tracking-wider text-faint">{entry.role}</span>
                          </li>
                        ))}
                      </ul>
                      <a
                        href={groupLinks[key]}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-auto inline-flex items-center justify-center gap-2 rounded-control border border-accent/40 bg-accent-soft px-5 py-3 font-display text-[14px] font-semibold text-accent-bright transition-colors hover:border-accent-bright"
                      >
                        Join Group <ExternalLink size={16} />
                      </a>
                    </div>
                  ) : (
                    <div className="relative z-10 flex flex-1 flex-col justify-between gap-4 p-5">
                      <p className="text-sm">This Gmail is not on a {game.name} roster yet. Register a team as leader.</p>
                      <Link
                        href={`/register/${key}`}
                        className="inline-flex items-center justify-center gap-2 rounded-control bg-accent-gradient px-5 py-3 font-display text-[14px] font-semibold text-[#04101f] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,191,255,0.28)]"
                      >
                        Register team <ArrowRight size={16} />
                      </Link>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {!loading && !authLoading && !error && tickets.length === 0 && (
          <p className="mt-8 inline-flex items-center gap-2 text-sm text-muted">
            <TicketIcon size={16} className="text-accent-bright" /> No tickets on this Gmail yet.
          </p>
        )}
      </main>
      <Footer />
    </div>
  )
}
