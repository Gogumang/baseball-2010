import type { RandomPort } from '@/shared/api/random/randomPort'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { RESULT_WAIT_TICKS_AT_BAT_END, useFreePassPlayStart, useHitByPitchWait } from './otherSlices'

interface ReplayFlowInput {
  readonly session: TeamGameSession
  readonly random: RandomPort
  readonly play: TeamGameProgress['lastDefensePlay']
  readonly shownPlay: TeamGameProgress['lastDefensePlay']
  readonly isMenuOpen: boolean
  /** 일시정지 팝업(경기 중 메뉴 · 조작방법) — 0x52cc6 */
  readonly isFrozen: boolean
}

/**
 * 재생 판(홈런 비행 · 밀어내기)과 붙든 사구 — 볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기(0x1f 틱) 뒤 판정 A 가 0x17 로 보낸다 —
 * 그동안 타석 화면을 둔다
 */
export function useReplayFlow({ session, random, play, shownPlay, isMenuOpen, isFrozen }: ReplayFlowInput) {
  const { progress, actions } = session
  const resolution = progress.lastBurstResolution
  const unshownPlay = play !== null && play !== shownPlay ? play : null
  const isReplayReady = useFreePassPlayStart(
    unshownPlay,
    progress.pendingBenchClearing !== null,
    // 경기 중 메뉴(0x741a0 팝업)가 떠 있으면 0x12 상태 틱이 멈춘다 (0x52cc6)
    isMenuOpen,
    // 0x12 끝 돌발 판정의 결과 창(0x1d)을 닫은 뒤에야 판정 A 의 0x17
    resolution !== null,
  )
  const isReplaying = unshownPlay !== null && unshownPlay.ticks.length > 0 && isReplayReady
  // 사구 — 0x12 대기 틱 31 의 4e74c 판정(공 끝 칸 채우기와 같은 셈: 타석 공은 판정 틀 다음 그림이 틱 0, 내 공은 0x12 진입 틀
  // (`enterPitchResult` — r293)에 붙든 칸이 서 그 그림이 틱 0 이라 하나 적다), 들어갔으면 다음 틀의 진입 0x3a5f0 (A-22)
  const heldHitByPitch = progress.pendingBenchClearing
  useHitByPitchWait({
    hold: heldHitByPitch,
    waitTicks: heldHitByPitch?.side === '수비' ? RESULT_WAIT_TICKS_AT_BAT_END - 1 : RESULT_WAIT_TICKS_AT_BAT_END,
    isFrozen,
    random,
    onJudge: actions.judgeHitByPitch,
    onEnter: actions.enterBenchClearing,
  })
  /** 재생할 판 — 재생 중일 때만 */
  const replayPlay = isReplaying ? unshownPlay : null
  return { isReplaying, replayPlay }
}
