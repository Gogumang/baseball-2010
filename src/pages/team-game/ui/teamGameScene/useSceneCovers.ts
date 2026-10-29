import { useState } from 'react'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import type { TeamGameProgress, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'

interface SceneCoverInput {
  readonly mode: number
  readonly progress: TeamGameProgress
  readonly summary: TeamGameSummary | null
  readonly isBurstResultHeld: boolean
}

/** 인트로(0xc) · 공수 교대 판(0x18 교대 가지) · 경기 끝 판(0x18) — 경기 장면을 통째로 덮는 판의 닫힘 칸 */
export function useSceneCovers({ mode, progress, summary, isBurstResultHeld }: SceneCoverInput) {
  /** 경기 끝 결과 판(0x18)에서 OK 를 눌러 정산(0x19)으로 넘어갔는가 */
  const [isEndBoardClosed, setEndBoardClosed] = useState(false)
  /** 경기 시작 인트로(상태 0xc)를 다 봤는가 — 모드 1·2 만 선다 (대전 8·9 는 없다) */
  const [isIntroDone, setIntroDone] = useState(!hasGameIntro(mode))
  /** OK 로 닫은 마지막 공수 교대 판(상태 0x18 교대 가지)의 번호 */
  const [closedBoardSerial, setClosedBoardSerial] = useState(0)
  const board = progress.halfInningBoard
  const isHalfInningBoardOpen = board !== null && board.serial !== closedBoardSerial && summary === null && !isBurstResultHeld
  /** 인트로·교대 판·벤치 클리어링이 화면을 덮고 있는가 — 경기 키(0x498d4)가 안 먹는다 */
  // 붙든 사구가 0x12 대기 · 진입 앞이면 아직 타석 · 투구 장면이 0x12 를 그린다(A-22) — 연출 단계만 덮는다
  const isSceneCovering = !isIntroDone || isHalfInningBoardOpen || progress.pendingBenchClearing?.phase === 'scene'
  return { isEndBoardClosed, setEndBoardClosed, isIntroDone, setIntroDone, setClosedBoardSerial, board, isHalfInningBoardOpen, isSceneCovering }
}
