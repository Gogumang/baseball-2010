import { useCallback, useRef, useState } from 'react'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useHiddenOpenNotice } from '@/app/model/useHiddenOpenNotice'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import type { Collection } from '@/entities/collection/model/collection'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { useAceOpen } from '@/pages/general-mode/model/useAceOpen'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { useAceLevels } from '@/entities/mission/model/useAceLevels'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import { leaveGameSceneObject } from '@/widgets/game-scene/model/gameSceneObject'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import type { AfterShell } from '@/app/ui/app/useAppShell'

/** 전역 칸과 늦게 꽂는 손잡이 — 타석 진행기 · 마선수 오픈/레벨 · G 지갑 · 히든 알림 창 · 경기 장면 수 · 세션보다 늦게 서는 기록연감 콜백 칸 */
export function useAppLateBindings(app: Pick<AfterShell, 'aceOpenStore' | 'aceLevelStore' | 'walletStore' | 'legacyGamePoint' | 'gameSettings'>) {
  const { aceOpenStore, aceLevelStore, walletStore, legacyGamePoint, gameSettings } = app
  const runner = useAtBatRunner()
  // 마선수 오픈 플래그 — 원본 전역 기록 `mgr[0x30..0x39]`
  const aceOpen = useAceOpen(aceOpenStore)
  // 마선수 레벨 — 원본 전역 기록 `mgr[0x13a..0x143]`. 미션 마선수 배율(0xb6414)이 이 값을 본다
  const aceLevels = useAceLevels(aceLevelStore)
  // 전역 G 지갑 — 원본 `mgr[+0x64]`. 마선수 구매·미션·홈런더비가 다 이 한 칸을 본다
  const wallet = useGamePointWallet(walletStore, legacyGamePoint)
  /**
   * 기록연감 통계 한 건 쌓기 (0x22e35 · 0x22c29 · 0x22c7d · 0xb663c) — 기록연감 훅은 세션 커리어를 받아 세션보다 늦게 서므로
   * 세션들에는 이 고정 콜백을 넘기고 기록연감이 선 뒤 진짜 함수를 꽂는다.
   */
  const recordStatRef = useRef<(event: AnnalsStatEvent) => void>(() => {})
  /** 히든 오픈 알림 공용 창 [0x140005c] (0x62368 → 0x74ef5) — 어느 화면 위에도 뜬다 */
  const hiddenOpenNotice = useHiddenOpenNotice()
  /** 서 있는 경기 장면(0x104) 화면 수 — `useMarksGameScene` 이 센다 */
  const [gameSceneCount, setGameSceneCount] = useState(0)
  /**
   * 경기 장면 화면이 다 내려갔다 = 장면 0x104 를 나갔다 — 소멸 0x332b8(332e0)이 앱 전역 파티클 관리자를 비우고, 다음 경기 장면은
   * 새 객체(+0xfd4 = 0)로 선다 (`leaveGameSceneObject`). 화면이 같은 커밋에서 바뀌면(경기 → 결과 화면) 내림 · 올림이 한 효과 차례에
   * 들므로 그 차례가 끝난 뒤(마이크로태스크)에도 0 일 때만 내린다 — 다음 그림(rAF)의 파티클 틱보다 앞이다
   */
  const gameSceneCountRef = useRef(0)
  const markGameScene = useCallback((isUp: boolean) => {
    gameSceneCountRef.current += isUp ? 1 : -1
    if (!isUp && gameSceneCountRef.current === 0) {
      queueMicrotask(() => {
        if (gameSceneCountRef.current === 0) leaveGameSceneObject()
      })
    }
    setGameSceneCount((count) => count + (isUp ? 1 : -1))
  }, [])
  /** 미션 선수 고르기가 읽는 명예의 전당 — 기록연감 훅이 선 뒤 아래에서 채운다 (`recordStatRef` 와 같은 까닭) */
  const hallOfFameForMissionRef = useRef<Collection>(EMPTY_COLLECTION)
  const recordStat = useCallback((event: AnnalsStatEvent) => recordStatRef.current(event), [])
  /** 시즌 정규시즌 승리 수 +0xbf (0x9f6f0) — 기록연감 훅이 선 뒤 꽂는다 (`recordStatRef` 와 같은 까닭) */
  const recordSeasonRegularWinRef = useRef<() => void>(() => {})
  const recordSeasonRegularWin = useCallback(() => recordSeasonRegularWinRef.current(), [])
  /** `0x62368(ui, k, 0)` — 기록연감 훅의 열기 + 알림. 미션 세션이 그보다 먼저 서므로 `recordStatRef` 처럼 꽂는다 */
  const openHiddenRef = useRef<(id: number, then?: (() => void) | null) => boolean>(() => false)
  const openHidden = useCallback((id: number, then: (() => void) | null = null) => openHiddenRef.current(id, then), [])
  /** 시즌 팀 경기가 영입한 명전 선수를 그 기록으로 세울 때 읽는 명전 칸 — 위 ref 와 같은 값 */
  const readHallOfFame = useCallback(() => hallOfFameForMissionRef.current, [])
  /**
   * 시즌 결산 0x6900 의 0x29 "오토봇 배트" 검사가 읽는 것 — 나리 투수편·타자편 저장의 +0x7a 와 전역 해금표 `app+0xc0`.
   * 기록연감·투수편 세션은 시즌 세션보다 늦게 서므로 아래에서 채우고 시즌 세션은 결산에 들어갈 때 읽는다.
   */
  const autobotBatInputRef = useRef<SeasonAutobotBatInput | undefined>(undefined)
  const readAutobotBatInput = useCallback(() => autobotBatInputRef.current, [])
  /**
   * 나리 두 편 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 같은 0x29 검사 — 다른 편 저장 +0x7a · 시즌 기록 +0x7a ·
   * 전역 해금표. 세션들이 다 선 뒤 아래에서 채우고 팝업을 닫을 때 읽는다.
   */
  const otherModesRef = useRef<{ batter?: RegularSeasonOtherModes; pitcher?: RegularSeasonOtherModes }>({})
  const readBatterOtherModes = useCallback(() => otherModesRef.current.batter, [])
  const readPitcherOtherModes = useCallback(() => otherModesRef.current.pitcher, [])
  const seasonGameSettingsRef = useRef(gameSettings.settings)
  useMirrorRef(seasonGameSettingsRef, gameSettings.settings)
  const seasonGameSettingsNow = useCallback(
    () => ({
      gaugeSettingOn: seasonGameSettingsRef.current.pitchControl === '게이지',
      runningModeManual: seasonGameSettingsRef.current.runningMode === '수동',
      throwModeManual: seasonGameSettingsRef.current.throwMode === '수동',
    }),
    [],
  )
  return {
    runner,
    aceOpen,
    aceLevels,
    wallet,
    recordStatRef,
    hiddenOpenNotice,
    gameSceneCountRef,
    markGameScene,
    hallOfFameForMissionRef,
    recordStat,
    recordSeasonRegularWinRef,
    recordSeasonRegularWin,
    openHiddenRef,
    openHidden,
    readHallOfFame,
    autobotBatInputRef,
    readAutobotBatInput,
    otherModesRef,
    readBatterOtherModes,
    readPitcherOtherModes,
    seasonGameSettingsRef,
    seasonGameSettingsNow,
    gameSceneCount,
    setGameSceneCount,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterLateBindings = AfterShell & ReturnType<typeof useAppLateBindings>
