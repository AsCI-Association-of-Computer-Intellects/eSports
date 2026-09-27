'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Calendar, LogOut, Save, Shield, Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { games, gameKeys, type GameKey } from '@/lib/games'

type RosterMember = {
  role: string
  email: string | null
  in_game_uid: string
  branch: string | null
  section: string | null
  year_of_study: string | null
}

type AdminTeam = {
  team_id: string
  team_name: string
  game_key: GameKey
  eliminated_by_match_id: string | null
  score: number
  roster: RosterMember[]
}

type AdminMatch = {
  id: string
  game_key: GameKey
  title: string | null
  scheduled_at: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  winner_team_id: string | null
  team_a_id: string | null
  team_b_id: string | null
  team_a_name: string | null
  team_b_name: string | null
}

type MatchForm = {
  id: string | null
  gameKey: GameKey
  teamAId: string
  teamBId: string
  scheduledAt: string
  status: AdminMatch['status']
  winnerTeamId: string
}

const emptyMatch: MatchForm = {
  id: null,
  gameKey: 'freefire',
  teamAId: '',
  teamBId: '',
  scheduledAt: '',
  status: 'scheduled',
  winnerTeamId: '',
}

function localDateTime(isoDate: string) {
  const date = new Date(isoDate)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function SAdminPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [matches, setMatches] = useState<AdminMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scoreEdits, setScoreEdits] = useState<Record<string, string>>({})
  const [savingTeam, setSavingTeam] = useState<string | null>(null)
  const [savingMatch, setSavingMatch] = useState(false)
  const [matchForm, setMatchForm] = useState<MatchForm>(emptyMatch)
  const [teamGameFilter, setTeamGameFilter] = useState<GameKey | 'all'>('all')
  const [teamASearch, setTeamASearch] = useState('')
  const [teamBSearch, setTeamBSearch] = useState('')

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  const loadDashboard = async () => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase is not configured.')
      return
    }

    setLoading(true)
    const { data, error: dashboardError } = await supabase.rpc('get_admin_dashboard')
    if (dashboardError) {
      setError(dashboardError.message.replace(/^.*ERROR:\s*/i, ''))
      setLoading(false)
      return
    }

    const dashboard = data as { teams?: AdminTeam[]; matches?: AdminMatch[] }
    const nextTeams = Array.isArray(dashboard.teams) ? dashboard.teams : []
    setTeams(nextTeams)
    setMatches(Array.isArray(dashboard.matches) ? dashboard.matches : [])
    setScoreEdits(Object.fromEntries(nextTeams.map(team => [team.team_id, String(team.score)])))
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?next=/sadmin')
      return
    }
    void loadDashboard()
  }, [authLoading, user, router, supabase])

  const updateScore = async (teamId: string) => {
    if (!supabase) return
    const score = Number(scoreEdits[teamId])
    if (!Number.isFinite(score) || score < 0) {
      setError('Scores must be zero or higher.')
      return
    }

    setSavingTeam(teamId)
    const { error: scoreError } = await supabase.rpc('update_team_score', {
      p_team_id: teamId,
      p_score: score,
    })
    setSavingTeam(null)
    if (scoreError) {
      setError(scoreError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }
    setTeams(current => current.map(team => (team.team_id === teamId ? { ...team, score } : team)))
    setError(null)
  }

  const saveMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !matchForm.scheduledAt) {
      setError('Choose a date and time for the match.')
      return
    }

    setSavingMatch(true)
    const { error: matchError } = await supabase.rpc('save_match', {
      p_match_id: matchForm.id,
      p_game_key: matchForm.gameKey,
      p_team_a_id: matchForm.teamAId,
      p_team_b_id: matchForm.teamBId,
      p_scheduled_at: new Date(matchForm.scheduledAt).toISOString(),
      p_status: matchForm.status,
      p_winner_team_id: matchForm.winnerTeamId || null,
    })
    setSavingMatch(false)
    if (matchError) {
      setError(matchError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }

    setMatchForm(emptyMatch)
    setError(null)
    await loadDashboard()
  }

  const visibleTeams = teamGameFilter === 'all' ? teams : teams.filter(team => team.game_key === teamGameFilter)
  const sportTeams = teams.filter(team => team.game_key === matchForm.gameKey && (!team.eliminated_by_match_id || team.eliminated_by_match_id === matchForm.id))
  const filteredTeamA = sportTeams.filter(team => team.team_name.toLowerCase().includes(teamASearch.trim().toLowerCase()) || team.team_id === matchForm.teamAId)
  const filteredTeamB = sportTeams.filter(team => team.team_name.toLowerCase().includes(teamBSearch.trim().toLowerCase()) || team.team_id === matchForm.teamBId)
  const selectedTeamA = teams.find(team => team.team_id === matchForm.teamAId)
  const selectedTeamB = teams.find(team => team.team_id === matchForm.teamBId)
  const autoTitle = selectedTeamA && selectedTeamB ? `${selectedTeamA.team_name} vs ${selectedTeamB.team_name}` : 'Select Team A and Team B'

  if (authLoading || loading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-5 py-16">
          <p className="text-sm">Checking admin access…</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 py-12 sm:px-8 md:py-16 lg:px-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-y border-border py-7 sm:py-9">
          <div>
            <div className="hud-label text-accent-bright">PRIVATE CONTROL / SADMIN</div>
            <h1 className="mt-3 text-[38px] leading-[0.92] sm:text-[52px]">Tournament <em className="not-italic text-accent-bright">control.</em></h1>
            <p className="mt-3 max-w-[58ch] text-sm">Manage registered teams, publish scores, and schedule matches from one private console.</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-border-strong hover:text-ink"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-control border border-[rgba(255,90,120,0.28)] bg-[rgba(255,90,120,0.1)] px-4 py-3 text-sm text-[#ff8fa3]">
            {error}
            {error.toLowerCase().includes('admin access') && <span> Add your Gmail to the `admin_users` table first.</span>}
          </div>
        ) : null}

        {error?.toLowerCase().includes('admin access') ? (
          <section className="rounded-panel border border-border bg-surface p-7 sm:p-10">
            <Shield size={28} className="text-accent-bright" />
            <h2 className="mt-5 text-2xl">Admin access is not enabled.</h2>
            <p className="mt-2 max-w-[55ch] text-sm">This private page is ready, but no admin email has been approved yet. Add the email to Supabase&apos;s `public.admin_users` table, then sign in again.</p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_0.85fr]">
            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="hud-label text-faint">ROSTER MANAGEMENT</div>
                  <h2 className="mt-2 text-2xl">Registered teams</h2>
                </div>
                <span className="font-display text-xs font-bold tracking-widest text-accent-bright">{teams.length} TEAMS</span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setTeamGameFilter('all')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${teamGameFilter === 'all' ? 'border-accent bg-accent-soft text-ink' : 'border-border text-muted'}`}>All sports</button>
                {gameKeys.map(key => (
                  <button key={key} type="button" onClick={() => setTeamGameFilter(key)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${teamGameFilter === key ? 'border-accent bg-accent-soft text-ink' : 'border-border text-muted'}`}>
                    {games[key].name}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {visibleTeams.map(team => (
                  <details key={team.team_id} className="rounded-panel border border-border bg-surface p-5" open>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-accent-bright">{games[team.game_key].name}</span>
                        <h3 className="text-lg">{team.team_name}</h3>
                        <span className="ml-auto text-xs text-muted">{team.roster.length} players</span>
                        {team.eliminated_by_match_id && <span className="border border-red-400/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">Eliminated</span>}
                      </div>
                    </summary>
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-4 flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                          Score
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={scoreEdits[team.team_id] ?? team.score}
                            onChange={event => setScoreEdits(current => ({ ...current, [team.team_id]: event.target.value }))}
                            className="w-32 rounded-control border border-border bg-bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void updateScore(team.team_id)}
                          disabled={savingTeam === team.team_id}
                          className="inline-flex items-center gap-2 rounded-control bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-[#04101f] disabled:opacity-60"
                        >
                          <Save size={15} /> {savingTeam === team.team_id ? 'Saving…' : 'Save score'}
                        </button>
                      </div>
                      <ul className="space-y-2 text-sm">
                        {team.roster.map(member => (
                          <li key={`${team.team_id}-${member.in_game_uid}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
                            <span className="text-ink">{member.email || 'No email'} <span className="text-muted">· {member.role}</span></span>
                            <span className="text-xs text-muted">UID {member.in_game_uid}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ))}
                {visibleTeams.length === 0 && <p className="rounded-panel border border-border p-6 text-sm text-muted">No teams match this sport filter.</p>}
              </div>
            </section>

            <section className="space-y-8">
              <div>
                <div className="mb-5 flex items-end gap-3">
                  <Calendar size={20} className="text-accent-bright" />
                  <div>
                    <div className="hud-label text-faint">MATCH OPERATIONS</div>
                    <h2 className="mt-2 text-2xl">Schedule a match</h2>
                  </div>
                </div>
                <form onSubmit={saveMatch} className="rounded-panel border border-border bg-surface p-5 sm:p-6">
                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                      Game
                      <select value={matchForm.gameKey} onChange={event => { setTeamASearch(''); setTeamBSearch(''); setMatchForm(current => ({ ...current, gameKey: event.target.value as GameKey, teamAId: '', teamBId: '', winnerTeamId: '' })) }} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                        {gameKeys.map(key => <option key={key} value={key}>{games[key].name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                      Match title (automatic)
                      <input readOnly value={autoTitle} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink opacity-80" />
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                        Team A
                        <input value={teamASearch} onChange={event => setTeamASearch(event.target.value)} placeholder={`Search ${games[matchForm.gameKey].name} teams`} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                        <select required value={matchForm.teamAId} onChange={event => setMatchForm(current => ({ ...current, teamAId: event.target.value, winnerTeamId: current.winnerTeamId === current.teamAId ? '' : current.winnerTeamId }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                          <option value="">Select Team A</option>
                          {filteredTeamA.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                        Team B
                        <input value={teamBSearch} onChange={event => setTeamBSearch(event.target.value)} placeholder={`Search ${games[matchForm.gameKey].name} teams`} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                        <select required value={matchForm.teamBId} onChange={event => setMatchForm(current => ({ ...current, teamBId: event.target.value, winnerTeamId: current.winnerTeamId === current.teamBId ? '' : current.winnerTeamId }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                          <option value="">Select Team B</option>
                          {filteredTeamB.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                      Date and time
                      <input required type="datetime-local" value={matchForm.scheduledAt} onChange={event => setMatchForm(current => ({ ...current, scheduledAt: event.target.value }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                      Status
                      <select value={matchForm.status} onChange={event => setMatchForm(current => ({ ...current, status: event.target.value as AdminMatch['status'] }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                        <option value="scheduled">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                      Winner {matchForm.status === 'completed' ? '(required)' : '(optional)'}
                      <select required={matchForm.status === 'completed'} value={matchForm.winnerTeamId} onChange={event => setMatchForm(current => ({ ...current, winnerTeamId: event.target.value }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                        <option value="">Select winner</option>
                        {selectedTeamA && <option value={selectedTeamA.team_id}>{selectedTeamA.team_name}</option>}
                        {selectedTeamB && <option value={selectedTeamB.team_id}>{selectedTeamB.team_name}</option>}
                      </select>
                    </label>
                    <button type="submit" disabled={savingMatch} className="inline-flex items-center justify-center gap-2 rounded-control bg-accent-gradient px-4 py-3 text-sm font-semibold text-[#04101f] disabled:opacity-60">
                      <Calendar size={15} /> {savingMatch ? 'Saving…' : matchForm.id ? 'Update match' : 'Schedule match'}
                    </button>
                    {matchForm.id && <button type="button" onClick={() => { setTeamASearch(''); setTeamBSearch(''); setMatchForm(emptyMatch) }} className="text-xs text-muted hover:text-ink">Cancel editing</button>}
                  </div>
                </form>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2"><Trophy size={18} className="text-accent-bright" /><h2 className="text-xl">Scheduled matches</h2></div>
                <div className="space-y-3">
                  {matches.map(match => (
                    <div key={match.id} className="rounded-control border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-[10px] font-bold uppercase tracking-widest text-accent-bright">{games[match.game_key].name}</div>
                          <h3 className="mt-1 text-base">{match.team_a_name || 'Team A'} vs {match.team_b_name || 'Team B'}</h3>
                          <p className="mt-1 text-xs text-muted">{new Date(match.scheduled_at).toLocaleString()} · {match.status}</p>
                          {match.winner_team_id && <p className="mt-1 text-xs text-accent-bright">Winner selected</p>}
                        </div>
                        <button type="button" onClick={() => { setTeamASearch(''); setTeamBSearch(''); setMatchForm({ id: match.id, gameKey: match.game_key, teamAId: match.team_a_id || '', teamBId: match.team_b_id || '', scheduledAt: localDateTime(match.scheduled_at), status: match.status, winnerTeamId: match.winner_team_id || '' }) }} className="text-xs font-semibold text-accent-bright hover:text-ink">Edit</button>
                      </div>
                    </div>
                  ))}
                  {matches.length === 0 && <p className="text-sm text-muted">No matches scheduled yet.</p>}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
