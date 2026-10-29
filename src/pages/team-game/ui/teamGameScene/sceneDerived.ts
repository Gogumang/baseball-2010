import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { currentPitcherAceIndex } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { useBurstState } from './useBurstState'

/** 지금 마운드에 선 상대 투수가 마투수면 그 선수 (0xb88c8 로 8번 칸에 앉은 그것) */
export const opposingAcePitcherOf = (progress: TeamGameProgress) => ACE_PITCHERS[currentPitcherAceIndex(progress)] ?? null

/**
 * 띄울 돌발 창 — 결과 창(0x1d)은 0xe 앞이라 늘 띄우고, 제안 창(0x1b)은 0xe 의 OK 뒤 메시지 1 이 0x8f158 을 굴려
 * 예약하므로(0x50c42) OK 를 받은 뒤에만 띄운다
 */
export function visibleBurstLinesOf(burstState: ReturnType<typeof useBurstState>, isAwaitingConfirm: boolean) {
  return burstState.resolution === null && isAwaitingConfirm ? null : burstState.burstLines
}

/** 돌발 띠 0x8e858 의 [M+0xc] — 발동부터 결과 창을 닫을 때(0x8e5b8 8e7ee~8e800)까지 */
export function burstBandRowOf(burstState: ReturnType<typeof useBurstState>) {
  return burstState.burst?.current ?? burstState.resolution?.row ?? null
}

interface RecordAlertDrawingInput {
  readonly isIntroDone: boolean
  readonly summary: TeamGameSummary | null
  readonly isDefenseInPlay: boolean
  readonly isPitchSceneBeforePlay: boolean
  readonly isReplaying: boolean
}

/** 기록 달성 알림 0x4e35c 를 그리는가 — 0x17 이 아니면 그린다. 0x11 끝 · 0x13 을 그리는 동안은 아직 0x17 이 아니다 */
export function isRecordAlertDrawnOf(s: RecordAlertDrawingInput): boolean {
  return s.isIntroDone && s.summary === null && (!s.isDefenseInPlay || s.isPitchSceneBeforePlay) && !s.isReplaying
}

/** 서 있는 공수 교대 판의 번호 — 상태 틱 0 점의 갈래 */
export function openBoardSerialOf(isHalfInningBoardOpen: boolean, board: TeamGameProgress['halfInningBoard']): number | null {
  if (!isHalfInningBoardOpen) return null
  return board?.serial ?? 0
}
