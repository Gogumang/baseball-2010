import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonHallOfFame } from '@/app/model/seasonHallOfFameRecords'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { SeasonGameSettingOptions, SeasonSession } from '@/app/model/seasonSession/types/session'
import { useSeasonSaveState } from '@/app/model/seasonSession/state/useSeasonSaveState'
import { useSeasonSceneState } from '@/app/model/seasonSession/state/useSeasonSceneState'
import { useSeasonUiState } from '@/app/model/seasonSession/state/useSeasonUiState'
import { useSeasonPersistence } from '@/app/model/seasonSession/state/useSeasonPersistence'
import { useSceneEntryEffect } from '@/app/model/seasonSession/scene/useSceneEntryEffect'
import { useSeasonRosterActions } from '@/app/model/seasonSession/roster/useSeasonRosterActions'
import { useSeasonShopActions } from '@/app/model/seasonSession/shop/useSeasonShopActions'
import { useNextGameStart } from '@/app/model/seasonSession/nextGame/useNextGameStart'
import { useMatchInfoActions } from '@/app/model/seasonSession/nextGame/useMatchInfoActions'
import { useEntryEditActions } from '@/app/model/seasonSession/nextGame/useEntryEditActions'
import { useSettleGame } from '@/app/model/seasonSession/settlement/useSettleGame'
import { useAfterGameActions } from '@/app/model/seasonSession/settlement/useAfterGameActions'
import { usePostseasonActions } from '@/app/model/seasonSession/postseason/usePostseasonActions'
import { useTrainingOutingActions } from '@/app/model/seasonSession/management/useTrainingOutingActions'
import { useSeasonEndActions } from '@/app/model/seasonSession/seasonEnd/useSeasonEndActions'
import { useSeasonEventActions } from '@/app/model/seasonSession/seasonEnd/useSeasonEventActions'
import { useGameProgressActions } from '@/app/model/seasonSession/game/useGameProgressActions'
import { seasonSessionOf } from '@/app/model/seasonSession/hook/seasonSessionOf'

export { SEASON_DEFAULT_MATCH_SETTINGS, seasonEvaluationJingleIdOf } from '@/app/model/seasonSession/constants/seasonConstants'
export type { SeasonSession, SeasonGameSettingOptions } from '@/app/model/seasonSession/types/session'
export { seasonRecordAcesAfterGame } from '@/app/model/seasonSession/records/humanGameRecords'
export { seasonGameProgressOf, withRecordSalaryGrades } from '@/app/model/seasonSession/save/normalize'
export { seasonLeagueRecordsOf } from '@/app/model/seasonSession/awards/leagueRecords'
export { seasonTeamRankOf, seasonGoalInputOf, seasonGoalWindowNumbersFor, seasonPostseasonRankOf } from '@/app/model/seasonSession/goals/seasonGoals'

/**
 * @param wallet 전역 G 지갑(`useGamePointWallet`). 넘기면 **지갑이 G 의 주인**이고
 *   시즌은 자기 주머니를 안 쓴다. 안 넘기면 예전처럼 세션 주머니로 논다(테스트용) —
 *   그 자리는 새로 고치면 사라진다.
 * @param aceLevels 전역 마선수 레벨 열 칸(`mgr[0x13a..0x143]`, `useAceLevels().levels`).
 *   시즌 경기 옵션에 그대로 실어 명단 마선수 능력치 배율 `0xd88aa`(0xb6414 첫 단계)와
 *   상대 마투수 마구 횟수 `0xd8509` 가 이 값을 보게 한다 — 시즌이라고 따로 보는 칸은 없다.
 *   안 넘기면 팀 경기 쪽 기본(전부 Lv1 = 60%)이다.
 */
export function useSeasonSession(
  store: JsonStorePort,
  random: RandomPort,
  wallet: GamePointWalletSession | null = null,
  aceLevels?: Readonly<Record<number, number>>,
  /** 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (G 사용처 0x22c29 — 시즌은 k 3). 안 넘기면 안 쌓는다 */
  recordStat?: (event: AnnalsStatEvent) => void,
  /**
   * 결산 0x6900 의 0x29 검사가 읽는 다른 두 모드 저장 +0x7a 와 전역 해금표 — 결산에 들어갈 때 부른다.
   * 안 넘기면(그 저장을 못 읽으면) 0x29 검사를 건너뛴다 (나리 쪽 `applyRegularSeasonReward` 와 같은 자세).
   */
  autobotBatInput?: () => SeasonAutobotBatInput | undefined,
  /**
   * 전역기록 `+0x145` 지급 비트를 담는 저장소 (`game_o.sav` 의 그 바이트 — `collectionRewards.ts`). 넘기면 리그 1위 G 를
   * 받은 문턱이 새로 고쳐도 남는다. 안 넘기면 세션 상태로만 든다(테스트용 — 예전 동작).
   */
  rewardStore?: JsonStorePort,
  /**
   * 기록연감의 명전 칸 — 영입한 명전 선수(id ≥ 0xb4)를 팀 경기에 그 기록으로 세울 때 읽는다(`seasonHallOfFameRecordSourceOf`).
   * 기록연감 훅이 시즌 세션보다 늦게 서므로 경기를 세울 때 부른다. 안 넘기면 그 선수는 예전 근사(남은 표 칸)로 선다.
   */
  readHallOfFame?: () => SeasonHallOfFame | undefined,
  /**
   * 전역기록 +0x11e 손잡이 — 0xdd 진입 0x6548 과 일반모드 22 진입 0x3163c~0x31688 이 **같은 칸**을 본다: 둘 중 먼저 들어간
   * 쪽에서 한 번만 설정 창이 저절로 뜬다. 넘기면 이 칸도 읽고 쓴다(시즌 저장 `matchSettingsSeen` 은 옛 저장 몫으로 계속 적는다).
   */
  matchSettingsSeenSlot?: {
    readonly read: () => boolean
    readonly markSeen: () => void
    /** 전역 m = 1 칸(시즌 경기진행 설정) — 옛 저장이면 null. 넘기면 이 칸이 시즌 설정의 주인이다(`SeasonSave.matchSettings`) */
    readonly readSeasonSettings?: () => MatchProgressSettings | null
    readonly writeSeasonSettings?: (settings: MatchProgressSettings) => void
  },
  /**
   * 정산 0x4ea0c 4f1e8~4f212 — 정규시즌 경기에서 사람 팀이 이기면 전역기록 +0xbf 를 올리고(0x9f6f0) 100 이면 히든 45.
   * 기록연감 훅이 든다(`recordSeasonRegularWin`). 안 넘기면 세지 않는다
   */
  onRegularSeasonWin?: () => void,
  /**
   * 경기를 세울 때 읽는 환경설정 세 칸 — 투구 게이지(설정 +0x2d) · 주루(+0xbd) · 송구(+0xf4).
   * 원본은 모드를 가리지 않고 경기 중에 이 칸을 본다:
   * - 게이지 0x3f500: `설정[+0x2d] != 0 && 0xb6c21(...) == 0 && 경기[+0xfc8] != 0x16` — 모드 검사 없음
   * - 주루 0xae690: `경기[0x31 + 경기[9]] == 1 || 설정+0xbd != 0` (0x46418 이 설정+0xbd 를 넘긴다)
   * - 송구 0xae6c8: 같은 꼴, 수비 측 경기[0xa] (0x526ac)
   * 일반모드(`GeneralModeScreen` 의 `gaugeSettingOn` · `runningModeManual` · `throwModeManual`)처럼 경기를 세울 때
   * 옵션에 싣는다. 안 넘기면 팀 경기 기본(게이지 끔 · 주루 자동 · 송구 수동)이다.
   */
  gameSettingsNow?: () => SeasonGameSettingOptions,
): SeasonSession {
  const args = {
    store,
    random,
    wallet,
    aceLevels,
    recordStat,
    autobotBatInput,
    rewardStore,
    readHallOfFame,
    matchSettingsSeenSlot,
    onRegularSeasonWin,
    gameSettingsNow,
  }
  const c1 = { ...args, ...useSeasonSaveState(args) }
  const c2 = { ...c1, ...useSeasonSceneState(c1) }
  const c3 = { ...c2, ...useSeasonUiState(c2) }
  const c4 = { ...c3, ...useSeasonPersistence(c3) }
  const c5 = { ...c4, ...useSceneEntryEffect(c4) }
  const c6 = { ...c5, ...useSeasonRosterActions(c5) }
  const c7 = { ...c6, ...useSeasonShopActions(c6) }
  const c8 = { ...c7, ...useNextGameStart(c7) }
  const c9 = { ...c8, ...useMatchInfoActions(c8) }
  const c10 = { ...c9, ...useEntryEditActions(c9) }
  const c11 = { ...c10, ...useSettleGame(c10) }
  const c12 = { ...c11, ...useAfterGameActions(c11) }
  const c13 = { ...c12, ...usePostseasonActions(c12) }
  const c14 = { ...c13, ...useTrainingOutingActions(c13) }
  const c15 = { ...c14, ...useSeasonEndActions(c14) }
  const c16 = { ...c15, ...useSeasonEventActions(c15) }
  const c17 = { ...c16, ...useGameProgressActions(c16) }
  return seasonSessionOf(c17)
}
