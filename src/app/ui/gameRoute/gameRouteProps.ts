import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'

/** 나리 타자편 — 전역 모드 [0x1552d10] = 4 */
export const BATTER_CAREER_MODE = 4

export interface GameRouteProps {
  readonly session: ReturnType<typeof useCareerSession>
  readonly progress: GameProgress
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly career: PlayerCareer
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`). 마선수 대결의 상대 마투수가 능력치 배율
   * 0xd88aa(0xb6414 첫 단계 — 모드를 가리지 않는다)와 마구 횟수 0xd8509(0xaebe4)로 이 칸을 본다.
   * 안 넘기면 배율 없이 날 값이다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
}
