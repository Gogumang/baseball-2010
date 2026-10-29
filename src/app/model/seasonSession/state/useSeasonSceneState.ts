import { useState, useEffect, useRef } from 'react'
import { type SeasonSceneState, SEASON_SCENE_STATE, enterSeasonScene } from '@/entities/season-mode/model/seasonStateMachine'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { type CollectionRewardRecord, normalizeCollectionRewardRecord } from '@/entities/collection/model/collectionRewards'
import { type SquadPurpose, SQUAD_PURPOSE, type PreGameAces, PRE_GAME_ACES_START } from '@/entities/season-mode/model/preGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { SeasonSummaryEntry } from '@/entities/season-mode/model/seasonRewards'
import { type SeasonGlobalSlots, seasonGlobalSlotsOf } from '@/app/model/seasonSession/save/globals'
import type { PendingSeasonGame, SeasonGameKind } from '@/app/model/seasonSession/types/session'
import type { SeasonSaveStateContext } from '@/app/model/seasonSession/state/useSeasonSaveState'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** `useSeasonSession` 몸통 문장 14~37 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonSceneState(ctx: SeasonSaveStateContext) {
  const { save, rewardStore, store, loadedSave, autobotBatInput } = ctx
  const [scene, setScene] = useState<SeasonSceneState>(() =>
    save === null
      ? SEASON_SCENE_STATE.팀고르기
      : // SR+0x1bc 가 서 있으면(엔딩까지 본 시즌) 진입 분기가 phase 를 보기 전에 관리 메뉴로 보낸다
        enterSeasonScene(save.state.record, {
          hasSeasonSave: true,
          forceManagementMenu: save.state.record.endingSeen,
        }),
  )
  const [notice, setNotice] = useState('')
  const [gameOptions, setGameOptions] = useState<TeamGameOptions | null>(null)
  /** 이어하기로 세울 진행 — 새 경기면 null (`SeasonSession.resumeGame`) */
  const [resumeGame, setResumeGame] = useState<TeamGameProgress | null>(null)
  /** 지금 경기에 넘긴 내 팀 명단을 0x6548 로테이션 몇 칸 돌렸는가 (`withOwnRecordRotation`) — 끝 스태미나를 되돌린다 */
  const [ownRotationShift, setOwnRotationShift] = useState(0)
  /** 지금 치르는 경기가 무엇인가 — 끝났을 때 어디로 정산할지 갈린다 */
  const [gameKind, setGameKind] = useState<SeasonGameKind>('정규')
  /** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 (시즌을 새로 해도 남는다, `rewardStore` 에 둔다) */
  const [rewardRecord, setRewardRecord] = useState<CollectionRewardRecord>(() => normalizeCollectionRewardRecord(rewardStore?.load()))
  const leagueFirstAwardedBits = rewardRecord.awardedBits
  useEffect(() => {
    rewardStore?.save(rewardRecord)
  }, [rewardRecord, rewardStore])
  /**
   * 지갑을 안 넘겼을 때만 쓰는 **세션 주머니** — 옛 동작 그대로다 (테스트용).
   * 지갑을 넘기면 이 칸은 놀고 `wallet.balance` 가 유일한 값이다.
   */
  const [ownGamePoints, setOwnGamePoints] = useState(0)
  /**
   * 다음경기 화면(0xd8)에 **관리 메뉴에서** 들어왔는가 — 원본 키 0x48ea 가 보는 이전 상태
   * `this+0x24 == 0xc9` 자리다. 경기 뒤(0xf1)·저장에서 바로 들어오면 거짓이라 취소가 안 먹는다.
   */
  const [nextGameFromMenu, setNextGameFromMenu] = useState(false)
  /** 선수단 0xd7 의 `this+0x11c` — 구단관리 코치채용은 2, 경기 전 흐름은 1 */
  const [squadPurpose, setSquadPurpose] = useState<SquadPurpose>(SQUAD_PURPOSE.코치채용)
  const [preGameAces, setPreGameAces] = useState<PreGameAces>(PRE_GAME_ACES_START)
  const [pendingGame, setPendingGame] = useState<PendingSeasonGame | null>(null)
  const [isMatchSettingsOpen, setIsMatchSettingsOpen] = useState(false)
  const [matchInfoStage, setMatchInfoStage] = useState<MatchInfoStadiumState | null>(null)
  /**
   * 전역기록 칸 둘 — 구장 히든 app+0xe0(S3 7절) · 이벤트 100 수령 +0xbe(0x8c714). 시즌 저장에 실어 두고 시즌을 쓸 때마다 같이
   * 적는다(`SeasonGlobalSlots`) — 새로 고쳐도 · 새 시즌에도 남는다
   */
  const [globals, setGlobals] = useState<SeasonGlobalSlots>(() => seasonGlobalSlotsOf(store.load(), loadedSave))
  const globalsRef = useRef(globals)
  const { openedStadiumIds, event100Awarded } = globals
  /** 전역 해금표 app+0xc0 중 시즌모드가 연 칸 (0x29) — 세션 상태, 앱이 기록연감 해금 목록에 합친다 */
  const [openedHiddenIds, setOpenedHiddenIds] = useState<readonly number[]>([])
  /** 지금 결산 진입(0x6900) — 0x29 가 새로 열려 진입의 리그 1위 G 검사를 건너뛰었는가 (0x69ce → 0x6ac8) */
  const [summaryEntry, setSummaryEntry] = useState<SeasonSummaryEntry | null>(null)
  const summaryEntrySerialRef = useRef(0)
  const autobotBatInputRef = useRef(autobotBatInput)
  useMirrorRef(autobotBatInputRef, autobotBatInput)
  return {
    scene,
    setScene,
    notice,
    setNotice,
    gameOptions,
    setGameOptions,
    resumeGame,
    setResumeGame,
    ownRotationShift,
    setOwnRotationShift,
    gameKind,
    setGameKind,
    setRewardRecord,
    leagueFirstAwardedBits,
    ownGamePoints,
    setOwnGamePoints,
    nextGameFromMenu,
    setNextGameFromMenu,
    squadPurpose,
    setSquadPurpose,
    preGameAces,
    setPreGameAces,
    pendingGame,
    setPendingGame,
    isMatchSettingsOpen,
    setIsMatchSettingsOpen,
    matchInfoStage,
    setMatchInfoStage,
    setGlobals,
    globalsRef,
    openedStadiumIds,
    event100Awarded,
    openedHiddenIds,
    setOpenedHiddenIds,
    summaryEntry,
    setSummaryEntry,
    summaryEntrySerialRef,
    autobotBatInputRef,
  }
}

/** `useSeasonSceneState` 까지 선 값 */
export type SeasonSceneStateContext = SeasonSaveStateContext & ReturnType<typeof useSeasonSceneState>
