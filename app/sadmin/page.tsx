'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Calendar, LogOut, Shield, Trophy, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { games, gameKeys, type GameKey } from '@/lib/games'

type RosterMember = {
  registration_id: string
  role: string
  display_name: string | null
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
  group_key: 'A' | 'B' | 'C' | 'D' | null
  eliminated_by_match_id: string | null
  score: number
  roster: RosterMember[]
}

type AdminMatch = {
  id: string
  game_key: GameKey
  title: string
  scheduled_at: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  group_key: 'A' | 'B' | 'C' | 'D'
  scores: MatchScore[]
}

type MatchScore = { team_id: string; team_name: string; kills: number; finish_position: number; points: number }

type NewTeamForm = {
  gameKey: GameKey
  groupKey: 'A' | 'B' | 'C' | 'D'
  teamName: string
  leaderName: string
  leaderEmail: string
  leaderUid: string
}

type NewMemberForm = { teamId: string; name: string; email: string; uid: string }

type MatchForm = {
  id: string | null
  gameKey: GameKey
  groupKey: 'A' | 'B' | 'C' | 'D'
  scheduledAt: string
  status: AdminMatch['status']
}

const emptyMatch: MatchForm = {
  id: null,
  gameKey: 'freefire',
  groupKey: 'A',
  scheduledAt: '',
  status: 'scheduled',
}

const emptyTeam: NewTeamForm = {
  gameKey: 'freefire', groupKey: 'A', teamName: '', leaderName: '', leaderEmail: '', leaderUid: '',
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
  const [teamEdits, setTeamEdits] = useState<Record<string, { teamName: string; leaderEmail: string; leaderName: string; groupKey: 'A' | 'B' | 'C' | 'D' }>>({})
  const [memberEdits, setMemberEdits] = useState<Record<string, { name: string; email: string; uid: string }>>({})
  const [savingDetails, setSavingDetails] = useState<string | null>(null)
  const [savingMatch, setSavingMatch] = useState(false)
  const [matchForm, setMatchForm] = useState<MatchForm>(emptyMatch)
  const [newTeam, setNewTeam] = useState<NewTeamForm>(emptyTeam)
  const [newMember, setNewMember] = useState<NewMemberForm>({ teamId: '', name: '', email: '', uid: '' })
  const [savingNewTeam, setSavingNewTeam] = useState(false)
  const [teamGameFilter, setTeamGameFilter] = useState<GameKey | 'all'>('all')
  const [groupSearch, setGroupSearch] = useState('')
  const [matchScoreEdits, setMatchScoreEdits] = useState<Record<string, { kills: string; position: string }>>({})

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
    setTeamEdits(Object.fromEntries(nextTeams.map(team => {
      const leader = team.roster.find(member => member.role === 'leader')
      return [team.team_id, { teamName: team.team_name, leaderEmail: leader?.email || '', leaderName: leader?.display_name || leader?.email || '', groupKey: team.group_key || 'A' }]
    })))
    setMemberEdits(Object.fromEntries(nextTeams.flatMap(team => team.roster.map(member => [member.registration_id, { name: member.display_name || member.email || '', email: member.email || '', uid: member.in_game_uid }]))))
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


  const updateTeamDetails = async (teamId: string) => {
    if (!supabase) return
    const details = teamEdits[teamId]
    if (!details) return
    setSavingDetails(teamId)
    const { error: detailsError } = await supabase.rpc('update_team_details', {
      p_team_id: teamId,
      p_team_name: details.teamName,
      p_leader_email: details.leaderEmail,
      p_leader_name: details.leaderName,
      p_group_key: details.groupKey,
    })
    setSavingDetails(null)
    if (detailsError) {
      setError(detailsError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }
    setTeams(current => current.map(team => team.team_id === teamId ? {
      ...team,
      team_name: details.teamName,
      roster: team.roster.map(member => member.role === 'leader' ? { ...member, email: details.leaderEmail, display_name: details.leaderName } : member),
    } : team))
    setError(null)
  }

  const updateMemberDetails = async (registrationId: string) => {
    if (!supabase) return
    const details = memberEdits[registrationId]
    if (!details) return
    const { error: memberError } = await supabase.rpc('update_registration_details', {
      p_registration_id: registrationId,
      p_display_name: details.name,
      p_email: details.email,
      p_in_game_uid: details.uid,
    })
    if (memberError) setError(memberError.message.replace(/^.*ERROR:\s*/i, ''))
    else {
      setError(null)
      await loadDashboard()
    }
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
      p_group_key: matchForm.groupKey,
      p_scheduled_at: new Date(matchForm.scheduledAt).toISOString(),
      p_status: matchForm.status,
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

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setSavingNewTeam(true)
    const { error: createError } = await supabase.rpc('admin_create_team', {
      p_game_key: newTeam.gameKey,
      p_group_key: newTeam.groupKey,
      p_team_name: newTeam.teamName,
      p_leader_name: newTeam.leaderName,
      p_leader_email: newTeam.leaderEmail,
      p_leader_uid: newTeam.leaderUid,
    })
    setSavingNewTeam(false)
    if (createError) {
      setError(createError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }
    setNewTeam(emptyTeam)
    setError(null)
    await loadDashboard()
  }

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !newMember.teamId) return
    const { error: memberError } = await supabase.rpc('admin_add_team_member', {
      p_team_id: newMember.teamId,
      p_display_name: newMember.name,
      p_email: newMember.email,
      p_in_game_uid: newMember.uid,
    })
    if (memberError) {
      setError(memberError.message.replace(/^.*ERROR:\s*/i, ''))
      return
    }
    setNewMember({ teamId: '', name: '', email: '', uid: '' })
    setError(null)
    await loadDashboard()
  }

  const visibleTeams = teamGameFilter === 'all' ? teams : teams.filter(team => team.game_key === teamGameFilter)
  const groupTeams = teams.filter(team => team.game_key === matchForm.gameKey && team.group_key === matchForm.groupKey && !team.eliminated_by_match_id && team.team_name.toLowerCase().includes(groupSearch.trim().toLowerCase()))

  const saveMatchScore = async (matchId: string, teamId: string) => {
    if (!supabase) return
    const edit = matchScoreEdits[`${matchId}:${teamId}`]
    if (!edit) return
    const { error: scoreError } = await supabase.rpc('save_match_score', {
      p_match_id: matchId,
      p_team_id: teamId,
      p_kills: Number(edit.kills),
      p_finish_position: Number(edit.position),
    })
    if (scoreError) setError(scoreError.message.replace(/^.*ERROR:\s*/i, ''))
    else await loadDashboard()
  }

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
                      <div className="mb-5 grid grid-cols-1 gap-3 rounded-control border border-border bg-bg-elevated/50 p-4 sm:grid-cols-4">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                          Team name
                          <input value={teamEdits[team.team_id]?.teamName || ''} onChange={event => setTeamEdits(current => ({ ...current, [team.team_id]: { ...current[team.team_id], teamName: event.target.value } }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                          Leader name
                          <input value={teamEdits[team.team_id]?.leaderName || ''} onChange={event => setTeamEdits(current => ({ ...current, [team.team_id]: { ...current[team.team_id], leaderName: event.target.value } }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                          Leader email
                          <input type="email" value={teamEdits[team.team_id]?.leaderEmail || ''} onChange={event => setTeamEdits(current => ({ ...current, [team.team_id]: { ...current[team.team_id], leaderEmail: event.target.value } }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-muted">
                          Group
                          <select value={teamEdits[team.team_id]?.groupKey || 'A'} onChange={event => setTeamEdits(current => ({ ...current, [team.team_id]: { ...current[team.team_id], groupKey: event.target.value as 'A' | 'B' | 'C' | 'D' } }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none">
                            {['A', 'B', 'C', 'D'].map(group => <option key={group} value={group}>Group {group}</option>)}
                          </select>
                        </label>
                        <button type="button" onClick={() => void updateTeamDetails(team.team_id)} disabled={savingDetails === team.team_id} className="inline-flex items-center justify-center rounded-control border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent-bright disabled:opacity-60 sm:col-span-3">
                          {savingDetails === team.team_id ? 'Saving team details…' : 'Save team details'}
                        </button>
                      </div>
                      <ul className="space-y-2 text-sm">
                        {team.roster.map(member => (
                          <li key={`${team.team_id}-${member.in_game_uid}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                              <input value={memberEdits[member.registration_id]?.name || ''} onChange={event => setMemberEdits(current => ({ ...current, [member.registration_id]: { ...current[member.registration_id], name: event.target.value } }))} placeholder="Member name" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                              <input type="email" value={memberEdits[member.registration_id]?.email || ''} onChange={event => setMemberEdits(current => ({ ...current, [member.registration_id]: { ...current[member.registration_id], email: event.target.value } }))} placeholder="Member email" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                              <input value={memberEdits[member.registration_id]?.uid || ''} onChange={event => setMemberEdits(current => ({ ...current, [member.registration_id]: { ...current[member.registration_id], uid: event.target.value } }))} placeholder="In-game UID" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                              <button type="button" onClick={() => void updateMemberDetails(member.registration_id)} className="rounded-control border border-accent/40 px-3 py-2 text-xs font-semibold text-accent-bright">Save</button>
                            </div>
                            <span className="text-xs text-muted">UID {member.in_game_uid} · {member.role}</span>
                          </li>
                        ))}
                      </ul>
                      <form onSubmit={addMember} className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <input required value={newMember.teamId === team.team_id ? newMember.name : ''} onChange={event => setNewMember(current => ({ ...current, teamId: team.team_id, name: event.target.value }))} placeholder="New member name" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                        <input required type="email" value={newMember.teamId === team.team_id ? newMember.email : ''} onChange={event => setNewMember(current => ({ ...current, teamId: team.team_id, email: event.target.value }))} placeholder="Member email" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                        <input required value={newMember.teamId === team.team_id ? newMember.uid : ''} onChange={event => setNewMember(current => ({ ...current, teamId: team.team_id, uid: event.target.value }))} placeholder="In-game UID" className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-sm text-ink" />
                        <button type="submit" className="rounded-control border border-accent/40 px-3 py-2 text-xs font-semibold text-accent-bright">Add member</button>
                      </form>
                    </div>
                  </details>
                ))}
                {visibleTeams.length === 0 && <p className="rounded-panel border border-border p-6 text-sm text-muted">No teams match this sport filter.</p>}
              </div>
            </section>

            <section className="space-y-8">
              <div>
                <div className="mb-5 flex items-end gap-3"><UserPlus size={20} className="text-accent-bright" /><div><div className="hud-label text-faint">ROSTER MANAGEMENT</div><h2 className="mt-2 text-2xl">Add a team</h2></div></div>
                <form onSubmit={createTeam} className="rounded-panel border border-border bg-surface p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Sport<select value={newTeam.gameKey} onChange={event => setNewTeam(current => ({ ...current, gameKey: event.target.value as GameKey }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink"><option value="freefire">Free Fire</option><option value="bgmi">BGMI</option><option value="codm">Call of Duty: Mobile</option></select></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Group<select value={newTeam.groupKey} onChange={event => setNewTeam(current => ({ ...current, groupKey: event.target.value as NewTeamForm['groupKey'] }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink">{['A', 'B', 'C', 'D'].map(group => <option key={group} value={group}>Group {group}</option>)}</select></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted sm:col-span-2">Team name<input required value={newTeam.teamName} onChange={event => setNewTeam(current => ({ ...current, teamName: event.target.value }))} placeholder="e.g. BR T LxEsports" className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink" /></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Leader name<input required value={newTeam.leaderName} onChange={event => setNewTeam(current => ({ ...current, leaderName: event.target.value }))} placeholder="Full name" className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink" /></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Leader email<input required type="email" value={newTeam.leaderEmail} onChange={event => setNewTeam(current => ({ ...current, leaderEmail: event.target.value }))} placeholder="leader@gmail.com" className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink" /></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted sm:col-span-2">Leader in-game UID<input required value={newTeam.leaderUid} onChange={event => setNewTeam(current => ({ ...current, leaderUid: event.target.value }))} placeholder="In-game UID" className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink" /></label>
                  </div>
                  <button type="submit" disabled={savingNewTeam} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-control bg-accent-gradient px-4 py-3 text-sm font-semibold text-[#04101f] disabled:opacity-60"><UserPlus size={15} /> {savingNewTeam ? 'Adding team…' : 'Add team'}</button>
                  <p className="mt-3 text-xs text-muted">The leader must sign in with Google once before being added.</p>
                </form>
              </div>
              <div>
                <div className="mb-5 flex items-end gap-3"><Calendar size={20} className="text-accent-bright" /><div><div className="hud-label text-faint">MATCH OPERATIONS</div><h2 className="mt-2 text-2xl">Schedule a group match</h2></div></div>
                <form onSubmit={saveMatch} className="rounded-panel border border-border bg-surface p-5 sm:p-6">
                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Game<select value={matchForm.gameKey} onChange={event => setMatchForm(current => ({ ...current, gameKey: event.target.value as GameKey }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink"><option value="freefire">Free Fire</option><option value="bgmi">BGMI</option><option value="codm">Call of Duty: Mobile</option></select></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Group<select value={matchForm.groupKey} onChange={event => setMatchForm(current => ({ ...current, groupKey: event.target.value as MatchForm['groupKey'] }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink">{['A', 'B', 'C', 'D'].map(group => <option key={group} value={group}>Group {group}</option>)}</select></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Search teams in this group<input value={groupSearch} onChange={event => setGroupSearch(event.target.value)} placeholder="Search team name" className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-faint" /></label>
                    <p className="text-xs text-muted">{groupTeams.length} active teams in {games[matchForm.gameKey].name} Group {matchForm.groupKey}</p>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Date and time<input required type="datetime-local" value={matchForm.scheduledAt} onChange={event => setMatchForm(current => ({ ...current, scheduledAt: event.target.value }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink" /></label>
                    <label className="flex flex-col gap-2 text-xs font-semibold text-muted">Status<select value={matchForm.status} onChange={event => setMatchForm(current => ({ ...current, status: event.target.value as AdminMatch['status'] }))} className="rounded-control border border-border bg-bg-elevated px-3 py-2.5 text-sm text-ink"><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
                    <button type="submit" disabled={savingMatch} className="inline-flex items-center justify-center gap-2 rounded-control bg-accent-gradient px-4 py-3 text-sm font-semibold text-[#04101f] disabled:opacity-60"><Calendar size={15} /> {savingMatch ? 'Saving…' : matchForm.id ? 'Update match' : 'Schedule match'}</button>
                    {matchForm.id && <button type="button" onClick={() => { setGroupSearch(''); setMatchForm(emptyMatch) }} className="text-xs text-muted">Cancel editing</button>}
                  </div>
                </form>
              </div>
              <div>
                <div className="mb-4 flex items-center gap-2"><Trophy size={18} className="text-accent-bright" /><h2 className="text-xl">Matches and scoring</h2></div>
                <div className="space-y-3">
                  {matches.map(match => <div key={match.id} className="rounded-control border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3"><div><div className="font-display text-[10px] font-bold uppercase tracking-widest text-accent-bright">{games[match.game_key].name} · GROUP {match.group_key}</div><h3 className="mt-1 text-base">{match.title}</h3><p className="mt-1 text-xs text-muted">{new Date(match.scheduled_at).toLocaleString()} · {match.status}</p></div><button type="button" onClick={() => setMatchForm({ id: match.id, gameKey: match.game_key, groupKey: match.group_key, scheduledAt: localDateTime(match.scheduled_at), status: match.status })} className="text-xs font-semibold text-accent-bright">Edit</button></div>
                    {match.status === 'completed' && <div className="mt-4 space-y-2 border-t border-border pt-3">{match.scores.map(score => { const key = `${match.id}:${score.team_id}`; const edit = matchScoreEdits[key] || { kills: String(score.kills), position: String(score.finish_position) }; return <div key={score.team_id} className="grid grid-cols-[1fr_70px_70px_auto] items-end gap-2 text-xs"><span className="pb-2 text-ink">{score.team_name}</span><input type="number" min="0" value={edit.kills} onChange={event => setMatchScoreEdits(current => ({ ...current, [key]: { ...edit, kills: event.target.value } }))} className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-ink" placeholder="Kills" /><input type="number" min="1" value={edit.position} onChange={event => setMatchScoreEdits(current => ({ ...current, [key]: { ...edit, position: event.target.value } }))} className="rounded-control border border-border bg-bg-elevated px-2 py-2 text-ink" placeholder="Place" /><button type="button" onClick={() => void saveMatchScore(match.id, score.team_id)} className="rounded-control border border-accent/40 px-2 py-2 text-accent-bright">Save</button></div> })}</div>}
                  </div>)}
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
