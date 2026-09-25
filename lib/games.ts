export type GameKey = 'freefire' | 'bgmi' | 'codm'

export type GameFormat = 'squad' | 'clan'

export interface GameData {
  key: GameKey
  name: string
  short: string
  tag: string
  color: string
  colorSoft: string
  prize: string
  squads: string
  format: GameFormat
  rosterSize: number
  substituteSlots: number
  description: string
  rules: string[]
  maps: string[]
}

export const games: Record<GameKey, GameData> = {
  freefire: {
    key: 'freefire',
    name: 'Free Fire',
    short: 'FF',
    tag: 'BATTLE ROYALE',
    color: '#ff7a3d',
    colorSoft: 'rgba(255, 122, 61, 0.16)',
    prize: '₹600',
    squads: '64 squads',
    format: 'squad',
    rosterSize: 4,
    substituteSlots: 1,
    description: 'Fast drops, sharp aim, one last squad standing. Bring your best four.',
    rules: [
      'Squad format: 4 players + 1 substitute',
      'Best of 3 matches across Bermuda, Purgatory & Kalahari',
      'No emulators, hacks, or third-party tools',
      'Points based on placement and eliminations',
    ],
    maps: ['Bermuda', 'Purgatory', 'Kalahari'],
  },
  bgmi: {
    key: 'bgmi',
    name: 'BGMI',
    short: 'BG',
    tag: 'TACTICAL BATTLE ROYALE',
    color: '#3d9bff',
    colorSoft: 'rgba(61, 155, 255, 0.16)',
    prize: '₹600',
    squads: '32 squads',
    format: 'squad',
    rosterSize: 4,
    substituteSlots: 1,
    description: 'Outplay the lobby, own the zone, and make every rotation count.',
    rules: [
      'Squad format: 4 players + 1 substitute',
      'Best of 4 matches on Erangel & Miramar',
      'Device integrity checks before every match',
      'Points based on placement and eliminations',
    ],
    maps: ['Erangel', 'Miramar'],
  },
  codm: {
    key: 'codm',
    name: 'Call of Duty: Mobile',
    short: 'CODM',
    tag: 'TACTICAL MULTIPLAYER',
    color: '#00d9ff',
    colorSoft: 'rgba(0, 217, 255, 0.16)',
    prize: '₹600',
    squads: '32 teams',
    format: 'squad',
    rosterSize: 5,
    substituteSlots: 1,
    description: 'Fast rotations, disciplined comms, and precision under pressure. Own the hardpoint.',
    rules: [
      'Squad format: 5 players + 1 substitute',
      'Best of 3 matches across competitive multiplayer modes',
      'No emulators, hacks, or third-party tools',
      'Points based on match wins and objective control',
    ],
    maps: [],
  },
}

export const gameKeys = Object.keys(games) as GameKey[]

export function isGameKey(value: string | undefined | null): value is GameKey {
  return !!value && value in games
}

export function rosterLabel(game: GameData) {
  const extras = game.substituteSlots > 0 ? ` + ${game.substituteSlots} substitute` : ''
  return `${game.rosterSize} players${extras}`
}
