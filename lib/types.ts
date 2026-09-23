import type { GameKey } from '@/lib/games'

export type RosterRole = 'leader' | 'member'

export interface TicketRosterEntry {
  role: RosterRole
  in_game_uid: string
  email: string | null
  branch: string | null
  section: string | null
  year_of_study: string | null
  claimed: boolean
}

export interface Ticket {
  team_id: string
  team_name: string
  game_key: GameKey
  role: RosterRole
  in_game_uid: string
  email: string | null
  branch: string | null
  section: string | null
  year_of_study: string | null
  created_at: string
  roster: TicketRosterEntry[]
}

export const YEARS_OF_STUDY = ['1st year', '2nd year', '3rd year', '4th year'] as const
