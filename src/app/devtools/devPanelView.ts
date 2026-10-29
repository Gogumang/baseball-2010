import type { GameState } from '@/entities/game/model/gameState'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'

/**
 * **개발 패널이 보는 것** (r365) — 앱이 렌더마다 지금 값을 넘긴다. 패널은 보기만 하고, 바꾸는 것은 앱이 넘긴 세션 액션(`onSpeedLevelChange`)뿐이다.
 * 게임 코드에 새 전역 상태를 만들지 않는다.
 */
export interface DevPanelView {
  readonly screenKind: string
  /** 서 있는 경기 장면(0x104) 화면 수 */
  readonly gameSceneCount: number
  /** 나만의리그 타자편 경기(`useCareerSession`) — 다른 모드 경기는 아직 안 이었다 */
  readonly game: GameState | null
  /** 타석 진행(`useAtBatRunner`) — 경기 · 미션이 같이 쓴다 */
  readonly atBat: AtBatState
  readonly bootSeed: number
  readonly speedLevel: number
  /** 환경설정 저장과 같은 길(`useGameSettings().setSettings`) */
  readonly onSpeedLevelChange: (level: number) => void
}

const NO_GAME = '-'

export function inningTextOf(game: GameState | null): string {
  return game === null ? NO_GAME : `${game.inning}회 ${game.half} · ${game.outs}아웃`
}

export function scoreTextOf(game: GameState | null): string {
  return game === null ? NO_GAME : `우리 ${game.ourScore} : ${game.opponentScore} 상대`
}

export function basesTextOf(game: GameState | null): string {
  if (game === null) return NO_GAME
  const { first, second, third } = game.bases
  return [first ? '1' : '_', second ? '2' : '_', third ? '3' : '_'].join(' ')
}

export function countTextOf(atBat: AtBatState): string {
  return `B${atBat.balls} S${atBat.strikes}`
}
