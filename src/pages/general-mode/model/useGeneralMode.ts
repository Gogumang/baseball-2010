import { useCallback, useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  chooseAce, chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, createFlowState,
  moveFirstBat, moveStadium, stepBack, withSetup,
} from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import { rollQuickStart } from '@/pages/general-mode/lib/quickStart'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'
import { teamGameOptionsOf } from '@/pages/general-mode/lib/generalModeSetup'

export interface UseGeneralModeOptions extends QuickStartOpenState {
  readonly random: RandomPort
  /** 메인 메뉴에서 **빠른실행**을 잡고 들어왔는가 (메뉴+0x14c) */
  readonly isQuickStart?: boolean
  /**
   * 저장에서 읽어 온 경기진행 설정 (모드 칸 m = **0**, 일반모드).
   * 안 넘기면 `FULL_PLAY_SETTINGS`("모든 이닝을 직접 플레이") 다 — 원본 저장의 참 기본값은
   * 종류 0(찬스)·값 0 이지만 그러면 득점권 타석만 잡게 된다 (matchSettings 의 웹판 판단).
   */
  readonly initialSettings?: MatchProgressSettings
  /** 환경설정 "투구 게이지" (설정 +0x2d) — 원본 기본값은 꺼짐 */
  readonly gaugeSettingOn?: boolean
  /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) */
  readonly runningModeManual?: boolean
}

export interface GeneralModeSession {
  readonly flow: GeneralModeFlowState
  readonly settings: MatchProgressSettings
  /** 경기 장면(0x104)으로 넘어갔는가 */
  readonly isPlaying: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) */
  readonly isSettingsOpen: boolean
  /** 지금 기록으로 만든 경기 옵션 */
  readonly gameOptions: TeamGameOptions
  readonly actions: {
    readonly selectUserTeam: (teamId: number) => void
    readonly selectAiTeam: (teamId: number) => void
    readonly moveFirstBat: (side: PlayerSide) => void
    readonly selectFirstBat: (side: PlayerSide) => void
    readonly moveStadium: (stadiumId: number) => void
    readonly selectStadium: (stadiumId: number) => void
    readonly selectAce: (cell: number) => void
    /** `*` — 빠른실행 결정사항을 다시 굴린다 */
    readonly respin: () => void
    readonly openSettings: () => void
    readonly closeSettings: () => void
    readonly applySettings: (next: MatchProgressSettings) => void
    readonly start: () => void
    /** CLR. 더 뒤가 없으면 `false` 를 돌려준다 — 부르는 쪽이 모드 목록으로 나가면 된다 */
    readonly back: () => boolean
  }
}

/**
 * **일반모드 한 판의 상태 고리** — 메인 메뉴 하위 상태 18~22 와 경기 장면 0x104 를 묶는다.
 *
 * 준비 기록·단계 규칙은 전부 `lib/generalModeFlow` 에 있고 여기서는 화면이 부르는 손잡이만 묶는다.
 */
export function useGeneralMode(options: UseGeneralModeOptions): GeneralModeSession {
  const {
    random, isQuickStart = false, initialSettings, gaugeSettingOn, runningModeManual,
    openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds,
  } = options

  const [flow, setFlow] = useState<GeneralModeFlowState>(() =>
    createFlowState({
      isQuickStart,
      // 빠른실행은 상태 22 진입 함수(0x314b0)가 기록을 통째로 굴리고 들어간다
      ...(isQuickStart
        ? { setup: rollQuickStart(random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }) }
        : {}),
    }),
  )
  const [settings, setSettings] = useState<MatchProgressSettings>(initialSettings ?? FULL_PLAY_SETTINGS)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isPlaying, setPlaying] = useState(false)

  const respin = useCallback(() => {
    setFlow((current) =>
      withSetup(
        current,
        rollQuickStart(random, { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds }),
      ),
    )
  }, [random, openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds])

  const back = useCallback(() => {
    let canGoBack = true
    setFlow((current) => {
      const previous = stepBack(current)
      if (previous === null) {
        canGoBack = false
        return current
      }
      return previous
    })
    return canGoBack
  }, [])

  const actions = useMemo(
    () => ({
      selectUserTeam: (teamId: number) => setFlow((current) => chooseUserTeam(current, teamId)),
      selectAiTeam: (teamId: number) => setFlow((current) => chooseAiTeam(current, teamId)),
      moveFirstBat: (side: PlayerSide) => setFlow((current) => moveFirstBat(current, side)),
      selectFirstBat: (side: PlayerSide) => setFlow((current) => chooseFirstBat(current, side)),
      moveStadium: (stadiumId: number) => setFlow((current) => moveStadium(current, stadiumId)),
      selectStadium: (stadiumId: number) => setFlow((current) => chooseStadium(current, stadiumId)),
      selectAce: (cell: number) => setFlow((current) => chooseAce(current, cell)),
      respin,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      applySettings: (next: MatchProgressSettings) => {
        setSettings(next)
        setSettingsOpen(false)
      },
      start: () => setPlaying(true),
      back,
    }),
    [respin, back],
  )

  const gameOptions = useMemo(
    () => teamGameOptionsOf(flow.setup, {
      settings,
      ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
      ...(runningModeManual === undefined ? {} : { runningModeManual }),
    }),
    [flow.setup, settings, gaugeSettingOn, runningModeManual],
  )

  return { flow, settings, isPlaying, isSettingsOpen, gameOptions, actions }
}
