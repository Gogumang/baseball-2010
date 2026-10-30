import { useCallback, useEffect, useMemo, useState } from 'react'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { stepBack, chooseAce } from '@/pages/general-mode/lib/generalModeFlow'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { writeSetupRecord } from '@/pages/general-mode/model/setupRecord'
import { mountOnce } from '@/shared/lib/strictMount/strictMount'
import type { GeneralModeSession, UseGeneralModeOptions } from './useGeneralMode/generalModeTypes'
import { initialGeneralModeOf, matchInfoEntryOf } from './useGeneralMode/matchInfoEntry'
import { matchInfoStartersOf, useGeneralEntryEdit } from './useGeneralMode/useGeneralEntryEdit'
import { flowSelectActionsOf } from './useGeneralMode/flowSelectActions'
import { generalGameOptionsOf } from './useGeneralMode/generalGameOptions'
import { useMatchBlockWrite } from './useGeneralMode/useMatchBlockWrite'
import { useMatchSettingsSeen } from './useGeneralMode/useMatchSettingsSeen'
import { useQuickRespin } from './useGeneralMode/useQuickRespin'

export type { MatchSettingsSeenSlot } from './useGeneralMode/generalModeTypes'

/**
 * **일반모드 한 판의 상태 고리** — 메인 메뉴 하위 상태 18~22 와 경기 장면 0x104 를 묶는다.
 *
 * 준비 기록·단계 규칙은 전부 `lib/generalModeFlow` 에 있고 여기서는 화면이 부르는 손잡이만 묶는다.
 */
export function useGeneralMode(options: UseGeneralModeOptions): GeneralModeSession {
  const { random, isQuickStart = false, initialSettings, onSettingsConfirm, aceLevels, gaugeSettingOn, runningModeManual, throwModeManual } = options
  const { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds } = options

  /**
   * 상태 22 진입 `0x314b0` — 빠른실행이면 기록을 통째로 굴리고(31500~31546), 모드 1 이면 이어서 **`0x30f20` 으로
   * 경기를 세운다**(3158c): 상대 마선수 둘 → AI 선발 → 사람 선발 굴림 넷 (`rollTeamSetup`). 원본은 경기 장면이
   * 아니라 여기서 굴리므로 경기정보·엔트리 편집(상태 23)이 이미 굴린 팀을 보고, OK 키(0x311a8)는 굴리지 않는다.
   * 마운트에 한 번만 굴린다 — 개발 StrictMode 의 두 번째 그림은 첫 그림의 값을 받는다(`mountOnce`, r231).
   */
  const [initial] = useState(() =>
    mountOnce('generalMode.initial', () =>
      initialGeneralModeOf(isQuickStart, random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }),
    ),
  )
  const [flow, setFlow] = useState<GeneralModeFlowState>(initial.flow)
  // 갱신 함수 끝의 되쓰기 — 화면이 고친 기록(빠른실행 굴림 · 재굴림 포함)이 다음 판까지 남는다
  useEffect(() => {
    writeSetupRecord(flow.setup)
  }, [flow.setup])
  /** 0x30f20 이 굴린 넷 — 상태 22 에 들어올 때마다(23 에서 돌아온 것 말고) 새로 굴린다 */
  const [rolls, setRolls] = useState<TeamSetupRolls | null>(initial.rolls)
  /** 22 진입 무대의 구장 +0x70 — 진입마다(23 에서 돌아온 것 말고) 새로 만든다. 재굴림 끝(31290)은 무대를 안 만든다 */
  const [matchInfoStadium, setMatchInfoStadium] = useState<number | null>(initial.stadium)
  const [matchInfoStage, setMatchInfoStage] = useState<MatchInfoStadiumState | null>(initial.stage)
  const [settings, setSettings] = useState<MatchProgressSettings>(initialSettings ?? FULL_PLAY_SETTINGS)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const checkMatchSettingsSeen = useMatchSettingsSeen(options.matchSettingsSeen, initial.flow.step, setSettingsOpen)
  const [isPlaying, setPlaying] = useState(false)
  /**
   * 블록 쓰기 차례 — `0x30f20`(22 들어옴 · 재굴림 끝) · `0x2a370`(23 나감)마다 하나 올린다. 쓰기는 그 차례의 기록이
   * 화면에 선 뒤(effect) 그때의 경기 옵션으로 세운다. 빠른실행은 처음부터 22 라 1 로 연다
   */
  const [blockWriteSerial, setBlockWriteSerial] = useState(initial.rolls === null ? 0 : 1)
  const bumpBlockWrite = useCallback(() => setBlockWriteSerial((serial) => serial + 1), [])
  /**
   * 유저 팀 레코드(저장 칸 `0x1f875(저장, 쪽)`)를 엔트리 편집이 고친 것. 원본은 상태 22 들어옴 `0x314b0` 이
   * 이전 상태가 23 이 아닐 때마다 `0x30f20` 으로 경기를 새로 세우므로(314c8 `cmp [메뉴+0x28], #0x17`)
   * 21 로 물러났다 오거나 재굴림하면 고친 것이 사라진다 — 웹도 그때 비운다.
   * 나갈 때 `0x2a370` 이 두 팀을 저장 칸 0x32·0x33(이어하기 칸과 같은 자리, R10)에 적고 파일을 쓴다 — `onMatchBlockWrite`.
   */
  const [userEntryRoster, setUserEntryRoster] = useState<SeasonTeamRoster | null>(null)
  const [respin, isRespinning, respinBuilt] = useQuickRespin(flow, random, options, { setFlow, setRolls, setUserEntryRoster, bumpBlockWrite })

  /** 상태 21 OK — 마타자를 고르면 22 로 들어가며 0x30f20 이 굴린다 */
  const selectAce = useCallback(
    (cell: number) => {
      const next = chooseAce(flow, cell)
      if (next.step === GENERAL_MODE_STEP.경기정보 && flow.step !== GENERAL_MODE_STEP.경기정보) {
        setUserEntryRoster(null)
        const entry = matchInfoEntryOf(next.setup, random)
        setRolls(entry.rolls)
        setMatchInfoStadium(entry.stadium)
        setMatchInfoStage(entry.stage)
        bumpBlockWrite()
        checkMatchSettingsSeen()
      }
      setFlow(next)
    },
    [flow, random, bumpBlockWrite, checkMatchSettingsSeen],
  )

  const back = useCallback(() => {
    const previous = stepBack(flow)
    if (previous === null) return false
    setUserEntryRoster(null)
    // 22 를 떠나면 0x30f20 이 세운 팀도 버린다 — 다시 들어오면 새로 굴린다
    setRolls(null)
    setFlow(previous)
    return true
  }, [flow])

  // 엔트리 편집기 · 경기정보 선발 줄이 보는 팀 — 재굴림이 도는 동안은 0x30f20 이 마지막으로 세운 두 팀(`useQuickRespin`)
  const builtTeams = respinBuilt ?? flow.setup
  const entry = useGeneralEntryEdit(
    {
      userTeamId: builtTeams.userTeamId,
      aiTeamId: builtTeams.aiTeamId,
      acePitcherId: flow.setup.acePitcherId,
      aceBatterId: flow.setup.aceBatterId,
      rolls,
      userEntryRoster,
    },
    aceLevels,
    setUserEntryRoster,
    bumpBlockWrite,
  )
  const { openEntry, pressEntryKeyAction, pointEntryCursorAction, frameEntryAction, closeEntryAceLocked } = entry

  const [userStarterName, cpuMatchInfo] = matchInfoStartersOf(
    flow.step === GENERAL_MODE_STEP.경기정보,
    builtTeams,
    rolls,
    userEntryRoster,
    entry.sourceOf,
  )

  const actions = useMemo(
    () => ({
      ...flowSelectActionsOf(setFlow),
      selectAce,
      respin,
      // 도는 동안([메뉴+0x154] ≤ 0x13)은 312b6 에서 끝나 키 처리까지 가지 않는다
      openSettings: () => {
        if (!isRespinning) setSettingsOpen(true)
      },
      closeSettings: () => setSettingsOpen(false),
      // 확인 0x60376 — 전역 m = 0 칸에 되쓰고 0x1f1b9 로 파일까지
      applySettings: (next: MatchProgressSettings) => {
        setSettings(next)
        setSettingsOpen(false)
        onSettingsConfirm?.(next)
      },
      start: () => {
        if (!isRespinning) setPlaying(true)
      },
      back: () => (isRespinning ? true : back()),
      openEntry: (isUserTeam: boolean) => {
        if (!isRespinning) openEntry(isUserTeam)
      },
      pressEntryKey: pressEntryKeyAction,
      pointEntryCursor: pointEntryCursorAction,
      frameEntry: frameEntryAction,
      closeEntryAceLocked,
    }),
    [
      respin,
      isRespinning,
      selectAce,
      back,
      openEntry,
      pressEntryKeyAction,
      pointEntryCursorAction,
      frameEntryAction,
      closeEntryAceLocked,
      onSettingsConfirm,
    ],
  )

  const gameOptions = useMemo(
    () => generalGameOptionsOf(flow.setup, settings, { gaugeSettingOn, runningModeManual, throwModeManual, aceLevels }, rolls, userEntryRoster),
    [flow.setup, settings, gaugeSettingOn, runningModeManual, throwModeManual, aceLevels, rolls, userEntryRoster],
  )

  useMatchBlockWrite(blockWriteSerial, gameOptions, options.onMatchBlockWrite, random)

  return {
    flow,
    entryEdit: entry.entryEdit,
    userStarterName,
    cpuMatchInfo,
    matchInfoStadium,
    matchInfoStage,
    settings,
    isPlaying,
    isSettingsOpen,
    isRespinning,
    gameOptions,
    actions,
  }
}
