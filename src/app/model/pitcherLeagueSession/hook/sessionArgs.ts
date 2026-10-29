import type { AceMatchHoldPort, AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { NariGameSavePort, NariOpenedAces } from '@/pages/management/lib/nariMatchPrepare'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 처음부터 열린 마선수 — 저장 +0x30 · +0x35 (`normalizeAceOpenSave` 가 늘 켠다) */
export const DEFAULT_NARI_OPENED_ACES: NariOpenedAces = {
  pitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
  batterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
}

export const NO_STAT = () => {}

/**
 * 세션 매개변수 — `usePitcherLeagueSession` 의 자리 인자를 기본값을 채워 한데 묶은 것. 하위 훅이 받는다(`PitcherScope`).
 * 각 칸의 뜻은 `usePitcherLeagueSession` 의 인자 머리글에 있다.
 */
export interface PitcherSessionArgs {
  readonly store: JsonStorePort
  readonly random: RandomPort
  readonly gaugeSettingOn: boolean
  readonly wallet: GamePointWalletSession | null
  readonly mergeStore: JsonStorePort | null
  readonly throwModeManual: boolean
  readonly recordStat: (event: AnnalsStatEvent) => void
  readonly aceLevels: Readonly<Record<number, number>> | undefined
  readonly readRegularSeasonOtherModes: (() => RegularSeasonOtherModes | undefined) | undefined
  readonly openedAces: NariOpenedAces
  readonly nariGameSave: NariGameSavePort | undefined
  readonly aceMatchPending: AceMatchPendingPort | undefined
  readonly isOnScreen: boolean
  readonly announceHiddenOpen: ((ids: readonly number[]) => void) | undefined
  readonly aceMatchHold: AceMatchHoldPort | undefined
}
