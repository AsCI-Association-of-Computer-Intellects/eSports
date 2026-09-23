import type { GameData } from '@/lib/games'

interface GameLogoProps {
  game: GameData
  size?: number
}


export default function GameLogo({ game, size = 96 }: GameLogoProps) {
  return (
    <div
      className="game-logo-tile flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
      style={{ width: size, height: size, '--logo-color': game.color } as React.CSSProperties}
      role="img"
      aria-label={`${game.name} logo placeholder`}
    >
      <img src={`/logos/${game.key}.png`} alt={`${game.name} logo`} className="h-full w-full object-contain" />
    </div>
  )
}
