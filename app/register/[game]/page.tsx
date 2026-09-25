'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import GameLogo from '@/components/GameLogo'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { games, gameKeys, isGameKey, rosterLabel } from '@/lib/games'
import { YEARS_OF_STUDY, type Ticket } from '@/lib/types'

const inputClass =
  'rounded-control border border-border bg-bg-elevated px-3.5 py-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none'

const whatsappCommunityUrl = 'https://chat.whatsapp.com/GGsrJqf2yVR0T59xoGXb46'

function CollegeFields({ prefix, required }: { prefix: string; required: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
        Branch
        <select name={`${prefix}-branch`} required={required} defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select branch
          </option>
          {['CSE', 'IT', 'CSD', 'CSM', 'CSC'].map(branch => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
        Section
        <input name={`${prefix}-section`} required={required} placeholder="e.g. A" className={inputClass} />
      </label>
      <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
        Year of study
        <select name={`${prefix}-year`} required={required} defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select year
          </option>
          {YEARS_OF_STUDY.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default function RegisterPage() {
  const params = useParams<{ game: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const gameKey = isGameKey(params.game) ? params.game : 'freefire'
  const game = games[gameKey]
  const memberSlots = game.rosterSize - 1 + game.substituteSlots

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [existing, setExisting] = useState<Ticket | null>(null)
  const [checking, setChecking] = useState(true)

  const reportError = (message: string) => {
    setError(message)
    window.alert(message)
  }

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/login?next=/register/${gameKey}`)
      return
    }
    if (!supabase) {
      setChecking(false)
      return
    }

    supabase.rpc('get_my_tickets').then(({ data, error: ticketsError }) => {
      if (!ticketsError && Array.isArray(data)) {
        const match = (data as Ticket[]).find(ticket => ticket.game_key === gameKey) ?? null
        setExisting(match)
      }
      setChecking(false)
    })
  }, [authLoading, user, supabase, gameKey, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !user) return

    const formData = new FormData(event.currentTarget)
    const teamName = String(formData.get('teamName') || '').trim()
    const leader = {
      in_game_uid: String(formData.get('leaderUid') || '').trim(),
      branch: String(formData.get('leader-branch') || '').trim(),
      section: String(formData.get('leader-section') || '').trim(),
      year_of_study: String(formData.get('leader-year') || '').trim(),
    }

    const members: {
      in_game_uid: string
      email: string
      branch: string
      section: string
      year_of_study: string
    }[] = []

    for (let i = 0; i < memberSlots; i++) {
      const uid = String(formData.get(`memberUid-${i}`) || '').trim()
      const email = String(formData.get(`memberEmail-${i}`) || '').trim()
      const branch = String(formData.get(`member-${i}-branch`) || '').trim()
      const section = String(formData.get(`member-${i}-section`) || '').trim()
      const year_of_study = String(formData.get(`member-${i}-year`) || '').trim()
      const required = i < game.rosterSize - 1
      if (required && (!uid || !email || !branch || !section || !year_of_study)) {
        reportError('Fill in Gmail, in-game UID, branch, section, and year for every starting player.')
        return
      }
      if (uid || email) {
        members.push({ in_game_uid: uid, email, branch, section, year_of_study })
      }
    }

    if (!teamName || !leader.in_game_uid) {
      reportError('Team name and your in-game UID are required.')
      return
    }

    setError(null)
    setSubmitting(true)

    const { error: registerError } = await supabase.rpc('register_team', {
      p_game_key: gameKey,
      p_team_name: teamName,
      p_leader: leader,
      p_members: members,
    })

    setSubmitting(false)

    if (registerError) {
      reportError(registerError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }

    setRegistered(true)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:py-16">
        <div className="grid w-full max-w-[980px] grid-cols-1 overflow-hidden rounded-panel border border-border bg-surface md:grid-cols-[0.9fr_1.15fr]">
          <aside className="flex flex-col justify-between gap-8 border-b border-border bg-[linear-gradient(165deg,#0e1424,#0a0e18)] p-7 md:border-b-0 md:border-r sm:p-11">
            <div>
              <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-faint hover:text-accent-bright">
                <ArrowLeft size={14} /> Back to tickets
              </Link>
              <p className="mt-8 text-sm">
                One Gmail can join only one team per game. Teammates see this ticket when they sign in with the Gmail you enter.
              </p>
            </div>
            <div className="flex items-center gap-3.5">
              <GameLogo game={game} size={48} />
              <div>
                <span className="mb-0.5 block font-display text-[11px] font-semibold tracking-widest text-faint">{game.tag}</span>
                <h3 className="text-lg">{game.name}</h3>
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-5 p-7 sm:p-11">
            <div className="font-display text-[13px] font-semibold tracking-widest text-accent-bright">TEAM LEADER REGISTRATION</div>
            {authLoading || checking ? (
              <p className="text-sm">Checking your Gmail…</p>
            ) : registered ? (
              <>
                <h2 className="text-[26px] leading-[1.08] sm:text-[32px]">
                  You&apos;re <em className="not-italic text-accent-bright">in.</em>
                </h2>
                <p className="-mt-2.5 text-sm">
                  Your {game.name} team has been registered successfully. Join the AsCI Esports community on WhatsApp for updates.
                </p>
                <a
                  href={whatsappCommunityUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 font-display text-[15px] font-semibold text-[#04101f]"
                >
                  Join WhatsApp community <ArrowRight size={17} />
                </a>
                <Link
                  href="/tickets"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-6 py-3.5 font-display text-[15px] font-semibold text-ink hover:border-border-strong"
                >
                  View tickets <ArrowRight size={17} />
                </Link>
              </>
            ) : existing ? (
              <>
                <h2 className="text-[26px] leading-[1.08] sm:text-[32px]">
                  Already <em className="not-italic text-accent-bright">registered.</em>
                </h2>
                <p className="-mt-2.5 text-sm">
                  {user?.email} is already on {existing.team_name} for {game.name} as {existing.role}. You cannot join another team in this game.
                </p>
                <Link
                  href="/tickets"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 font-display text-[15px] font-semibold text-[#04101f]"
                >
                  View tickets <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-[26px] leading-[1.08] sm:text-[32px]">
                  Register as <em className="not-italic text-accent-bright">leader.</em>
                </h2>
                <p className="-mt-2.5 text-sm">
                  Roster: {rosterLabel(game)}. Add each teammate&apos;s Gmail, in-game UID, branch, section, and year.
                </p>

                {error && (
                  <div className="rounded-control border border-[rgba(255,90,120,0.28)] bg-[rgba(255,90,120,0.1)] px-3.5 py-2.5 text-sm text-[#ff8fa3]">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
                    {game.format === 'clan' ? 'Clan name' : 'Team name'}
                    <input name="teamName" required placeholder="e.g. Night Owls" className={inputClass} />
                  </label>

                  <div className="rounded-control border border-border p-4">
                    <p className="mb-3 font-display text-[12px] font-semibold tracking-widest text-accent-bright">YOU (LEADER)</p>
                    <label className="mb-3 flex flex-col gap-2 text-[13px] font-semibold text-muted">
                      Gmail
                      <input value={user?.email || ''} readOnly className={`${inputClass} opacity-70`} />
                    </label>
                    <label className="mb-3 flex flex-col gap-2 text-[13px] font-semibold text-muted">
                      In-game UID
                      <input name="leaderUid" required placeholder="Your in-game profile UID" className={inputClass} />
                    </label>
                    <CollegeFields prefix="leader" required />
                  </div>

                  {Array.from({ length: memberSlots }).map((_, i) => {
                    const required = i < game.rosterSize - 1
                    const isSub = i >= game.rosterSize - 1
                    return (
                      <div key={i} className="rounded-control border border-border p-4">
                        <p className="mb-3 font-display text-[12px] font-semibold tracking-widest text-faint">
                          {isSub ? 'SUBSTITUTE (OPTIONAL)' : `MEMBER ${i + 1}`}
                        </p>
                        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
                            Gmail
                            <input
                              name={`memberEmail-${i}`}
                              type="email"
                              required={required}
                              placeholder="teammate@gmail.com"
                              className={inputClass}
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-[13px] font-semibold text-muted">
                            In-game UID
                            <input name={`memberUid-${i}`} required={required} placeholder="In-game UID" className={inputClass} />
                          </label>
                        </div>
                        <CollegeFields prefix={`member-${i}`} required={required} />
                      </div>
                    )
                  })}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 font-display text-[15px] font-semibold text-[#04101f] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {submitting ? 'Registering…' : 'Register team'} <ArrowRight size={17} />
                  </button>
                </form>
              </>
            )}

            {gameKeys.length > 1 && (
              <p className="text-[13px]">
                Wrong game?{' '}
                {gameKeys
                  .filter(key => key !== gameKey)
                  .map((key, i, arr) => (
                    <span key={key}>
                      <Link href={`/register/${key}`} className="border-b border-transparent font-semibold text-muted hover:border-accent-bright hover:text-accent-bright">
                        {games[key].name}
                      </Link>
                      {i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
