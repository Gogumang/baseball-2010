import { useCallback, useRef } from 'react'
import { sceneClosesWithoutShrinkOf } from '@/app/model/commonWindowScene'
import { hallOfFameRecordIdOf } from '@/entities/collection/model/collection'
import { isHallOfFameDeleteBlocked } from '@/entities/season-mode/model/playerRecruit'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import { GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import type { AceMatchStarter } from '@/app/ui/CareerRoutes'
import { useScreenSpritePreload } from '@/app/model/screenSpritePreload'
import { aceCellOfUnlock, recordUnlockIdOf } from '@/entities/collection/model/recordUnlock'
import { recordUnlockNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'
import { aceOpenPriceOf, isAceCellOpen } from '@/pages/general-mode/lib/aceOpenState'
import { useScreenWakeLock } from '@/shared/lib/wakeLock/useScreenWakeLock'
import { useDevPanel } from '@/app/devtools/useDevPanel'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { ALL_ACES_HIDDEN_TEAM_ID } from '@/app/ui/app/appConstants'
import type { AfterCollection } from '@/app/ui/app/useAppCollection'

/** 화면들이 같이 쓰는 손잡이 — 명전 삭제 · 마선수 오픈/레벨업 · 마선수 대결 시작 · 기록달성 해금 · 장면 그림 미리 받기 · 화면 켜 두기 · 개발 패널 */
export function useAppActions(
  app: Pick<
    AfterCollection,
    | 'gameSettings'
    | 'seed'
    | 'screen'
    | 'setScreen'
    | 'runner'
    | 'aceOpen'
    | 'aceLevels'
    | 'wallet'
    | 'hiddenOpenNotice'
    | 'gameSceneCount'
    | 'seasonSession'
    | 'careerSession'
    | 'mission'
    | 'collection'
  >,
) {
  const {
    gameSettings,
    seed,
    screen,
    setScreen,
    runner,
    aceOpen,
    aceLevels,
    wallet,
    hiddenOpenNotice,
    gameSceneCount,
    seasonSession,
    careerSession,
    mission,
    collection,
  } = app
  // 스페셜 명예의 전당 "슬롯에서 삭제" (0x2ac00 · 0x62994) — 시즌 명단 정리 0x221dc 와 칸 비우기를 한 번에
  const seasonRoster = seasonSession.state === null ? null : seasonSession.roster
  const hallOfFameDeletion: HallOfFameDeletion = {
    // 0x2ae0e — 그 명전 선수가 내 시즌 팀에 있고 && 전역기록 +0x4e(시즌모드 경기 중간 저장, 시즌 저장의 `isGameInProgress`)
    isBlocked: (side, slot) =>
      isHallOfFameDeleteBlocked(seasonRoster, hallOfFameRecordIdOf(side, slot), side === '투수', seasonSession.isGameInProgress),
    onDelete: (side, slot) => {
      seasonSession.actions.removeHallOfFamer(hallOfFameRecordIdOf(side, slot), side === '투수')
      collection.deleteHallOfFamer(side, slot)
    },
  }

  // 마선수 오픈(0xa3e2 · 0xa3f6)·레벨업(0x5fbee · 0x5fc0a) — 모자람 판정은 화면이 이미 했다.
  // `spend` 의 자르기 [0, 99999] 가 원본 clamp 와 같다. 일반모드(상태 21)·스페셜(상태 28)이 같이 쓴다
  const aceSelect = {
    openedAcePitcherIds: aceOpen.openedAcePitcherIds,
    openedAceBatterIds: aceOpen.openedAceBatterIds,
    levels: aceLevels.levels,
    // 0xa41a · 0x5fc1a — 저장 뒤 0x22c29(mgr, 0 마선수, 값) 로 사용처 통계에 적는다
    onOpenAce: (cell: number) => {
      wallet.spend(aceOpenPriceOf(cell))
      aceOpen.open(cell)
      collection.recordStat({ kind: 'G사용', usage: GAME_POINT_USAGE.ace, amount: aceOpenPriceOf(cell) })
    },
    onLevelUp: (cell: number, cost: number) => {
      wallet.spend(cost)
      aceLevels.levelUp(cell)
      collection.recordStat({ kind: 'G사용', usage: GAME_POINT_USAGE.ace, amount: cost })
    },
    // 0x7b408 — 격자 종류 7(일반모드 21 · 시즌 0xd7 경기 전)에서 열 칸이 다 열렸으면 0x62368(ui, 12, 0) 히든 팀 외인구단.
    // 웹 표에는 팀 번호 14 로 든다(`hiddenOpenStoredIdOf`)
    onAllAcesOpen: () => {
      // 해금 표(`unlocks.json`)로 풀린 칸은 저장에 없다 — 저장의 열 칸이 다 켜졌을 때만 원본처럼 기록한다
      if (!aceOpen.save.cells.every((open) => open)) return
      collection.openHidden(ALL_ACES_HIDDEN_TEAM_ID)
    },
  }

  /**
   * 이벤트 match → 공략 레코드 대결. 레코드가 없는 team 은 없지만, 만나면 패배 결과로 넘긴다 (추정).
   * 장소 이벤트였다면 match 가 돌려준 "끝남" 으로 0x1c014 의 장소 끝 처리(행동 · 외출 수)가 **나가는 자리에서** 돈다.
   * 결과 이벤트는 어디서 나갔든 140 `[다음 114, 뒤 105]` — 맥락 `대결결과`.
   */
  const startAceMatch: AceMatchStarter = (command, carried, context) => {
    if (context === '장소') careerSession.actions.settlePlaceForAceMatch()
    const target = aceMatchMissionOf(command.team)
    if (target === null) {
      setScreen({ kind: '이벤트', eventId: matchResultEventOf(command.resultEvents, false), context: '대결결과', carried })
      return
    }
    // SYS 8 — 결과 이벤트 · 플래그를 적고 저장한다(나가도 남아 다음 105 진입이 띄운다)
    careerSession.actions.holdAceMatch(command.resultEvents, carried.viewedEventIds)
    mission.actions.beginAceMatch(target, { resultEvents: command.resultEvents, context: '대결결과', carried })
  }

  /**
   * 히든 오픈 알림 공용 창 — 0x62368 이 0x74ef5(종류 1, OK)로 띄운다. 원본 창은 어느 장면 위에도 그려지므로 모든 화면 위에 얹는다.
   * 닫히면 대기 글이 있으면 그 글로 다시 선다(0x75440).
   * 떠 있는 동안 장면은 틀마다 0x754f9 로 창을 보고 키를 건너뛴다 — 경기 장면(0x52c50 52cc6)은 갱신까지 멈춘다
   * (`CommonWindowOpenContext` 머리말). 키는 상자가 잡는 단계에서 다 가져간다.
   */
  /**
   * **기록달성 누계 해금 `0x62234(ui, k)`** — 경기 중 기록 k 를 셀 때마다(0xa77f0 끝 a7922). 문턱은 통계 누계 `+4 + k`(지난
   * 경기까지)를 본다(`recordUnlockIdOf`). 마선수(id 0~7)는 마선수 칸을, 그 밖은 전역 해금표를 켜고 이미 켜져 있으면(0x61f5c)
   * 아무것도 안 한다. 켰으면 0x1f1b9 저장 뒤 공용 창 0x74ef5 에 StrCOMMON[140|138|139] 한 줄(쓰는 곳 줄 없음)
   */
  const aceOpenSaveRef = useRef(aceOpen.save)
  useMirrorRef(aceOpenSaveRef, aceOpen.save)
  const { readStats: readCollectionStats, openHiddenQuietly } = collection
  const { open: openAceCellFlag } = aceOpen
  const { announceText: announceHiddenText } = hiddenOpenNotice
  const unlockByRecord = useCallback(
    (recordId: number) => {
      const id = recordUnlockIdOf(readCollectionStats(), recordId)
      if (id === null) return
      const cell = aceCellOfUnlock(id)
      if (cell !== null) {
        if (isAceCellOpen(aceOpenSaveRef.current, cell)) return
        aceOpenSaveRef.current = { cells: aceOpenSaveRef.current.cells.map((open, at) => (at === cell ? true : open)) }
        openAceCellFlag(cell)
      } else if (!openHiddenQuietly(id)) {
        return
      }
      const text = recordUnlockNoticeTextOf(id)
      if (text !== null) announceHiddenText(text)
    },
    [announceHiddenText, openAceCellFlag, openHiddenQuietly, readCollectionStats],
  )

  /**
   * 지금 장면의 [창+0x24f] — 메인 메뉴 0x234d4 · 경기 0x3301c 는 1. 화면으로 정하고, 경기 장면(0x104)을 그리는 화면이 서 있으면
   * 그 동안 1 이다(`useMarksGameScene`). 이 아래 `MessageBox` 와 히든 오픈 알림 창이 줄임 없이 닫힌다(0x7503c → [창+0x24e]).
   */
  // 다음 장면 그림 미리 받기 — 기다리지 않는다(덜 받았으면 예전처럼 늦게 뜰 뿐)
  useScreenSpritePreload(screen.kind, gameSceneCount > 0)
  // 경기 장면(0x104)이 서 있는 동안 화면이 꺼지지 않게 — 탭이 숨으면 풀고 돌아오면 다시 잡는다 (웹 전용, r365)
  useScreenWakeLock(gameSceneCount > 0)
  // 개발 서버 전용 패널(Tweakpane) — 보기만 하고 속도만 환경설정과 같은 길로 바꾼다. 배포 빌드에는 없다 (r365)
  useDevPanel({
    screenKind: screen.kind,
    gameSceneCount,
    game: careerSession.progress?.game ?? null,
    atBat: runner.atBat,
    bootSeed: seed,
    speedLevel: gameSettings.settings.speedLevel,
    onSpeedLevelChange: (speedLevel) => gameSettings.setSettings({ ...gameSettings.settings, speedLevel }),
  })
  const sceneClosesWithoutShrink = gameSceneCount > 0 || sceneClosesWithoutShrinkOf(screen.kind, mission.player !== null)
  return {
    seasonRoster,
    hallOfFameDeletion,
    aceSelect,
    startAceMatch,
    aceOpenSaveRef,
    unlockByRecord,
    sceneClosesWithoutShrink,
    readCollectionStats,
    openHiddenQuietly,
    openAceCellFlag,
    announceHiddenText,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterActions = AfterCollection & ReturnType<typeof useAppActions>
