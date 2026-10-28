import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonHallOfFame } from '@/app/model/seasonHallOfFameRecords'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { SeasonGameSettingOptions } from '@/app/model/seasonSession/types/session'

/** `useSeasonSession` 의 매개변수 묶음 — 하위 훅에 넘긴다 (r346, 매개변수 설명은 `useSeasonSession` 에) */
export interface SeasonSessionArgs {
  readonly store: JsonStorePort
  readonly random: RandomPort
  readonly wallet: GamePointWalletSession | null
  readonly aceLevels: Readonly<Record<number, number>> | undefined
  readonly recordStat: ((event: AnnalsStatEvent) => void) | undefined
  readonly autobotBatInput: (() => SeasonAutobotBatInput | undefined) | undefined
  readonly rewardStore: JsonStorePort | undefined
  readonly readHallOfFame: (() => SeasonHallOfFame | undefined) | undefined
  readonly matchSettingsSeenSlot:
    | {
        readonly read: () => boolean
        readonly markSeen: () => void
        /** 전역 m = 1 칸(시즌 경기진행 설정) — 옛 저장이면 null. 넘기면 이 칸이 시즌 설정의 주인이다(`SeasonSave.matchSettings`) */
        readonly readSeasonSettings?: () => MatchProgressSettings | null
        readonly writeSeasonSettings?: (settings: MatchProgressSettings) => void
      }
    | undefined
  readonly onRegularSeasonWin: (() => void) | undefined
  readonly gameSettingsNow: (() => SeasonGameSettingOptions) | undefined
}
