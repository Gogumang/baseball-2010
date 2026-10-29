import type { PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import { isMissionGameOver } from '@/entities/mission/model/missionGame'
import { inningGoalOf, isCleared, OUTS_PER_INNING } from '@/entities/mission/model/missionGoal'
import type { MissionStatus } from '@/entities/mission/model/missionRun'

/** aac48 — 실점 · 피안타 · 출루 허용 한도가 모두 있으면(노히트노런 · 퍼펙트) 경기가 끝나야 판정한다 */
function waitsForGameEnd(run: PitcherRun): boolean {
  const limits = run.mission.failLimits
  return limits.runs > 0 && limits.hits > 0 && limits.baserunners > 0
}

/** 성공 — (경기 끝을 기다리는 미션이면 경기가 끝났고) 이닝 목표가 있거나 목표 칸이 다 찼다 */
function isMissionDone(run: PitcherRun, gameOver: boolean): boolean {
  if (waitsForGameEnd(run) && !gameOver) return false
  return inningGoalOf(run.mission) !== null || isCleared(run.mission, run.progress)
}

/**
 * **판 끝 미션 판정 0xaaa6c 의 모드 5 갈래** (aab9c~aad20) — `outs` 는 판정 때 state[6](3아웃 판이면 3).
 * ```
 * aac48  +0xa1 아래(실점) · +0xa2 아래(피안타) · +0xa3(출루 허용) 한도가 모두 있으면: 경기 끝(0xb68fc)이 아니면 상태 ≥ 1(아직)
 * aac76~ 목표 칸(0xaa928) · 실패 한도(0xaa940) · 목표가 다 안 찼으면 타석 · 투구 수 한도
 * aad20  경기 끝이고 아직(1)이면 실패(2)
 * ```
 * 노히트노런(13) · 퍼펙트게임(14)은 첫 줄이 서는 미션이다 — 이닝 수를 세지 않고 **한도가 깨지지 않은 채 경기가 끝나면** 성공이다
 * (예: 9회초 3아웃에 사람 칸(홈)이 앞서 있으면 끝). 목표 칸 +0xa4(아웃)이 둘 다 0 이라 aabd6 갈래는 어느 미션에서도 안 선다.
 */
export function judgeStatus(run: PitcherRun, outs: number): MissionStatus {
  if (run.progress.brokenConditions.length > 0) return '실패'
  const gameOver = isMissionGameOver(run.game, outs)
  if (isMissionDone(run, gameOver)) return '성공'
  if (gameOver) return '실패'
  return isOutOfChances(run.remainingPlateAppearances, run.remainingPitches) ? '실패' : '진행중'
}

function isOutOfChances(remainingPlate: number | null, remainingPitches: number | null): boolean {
  if (remainingPlate !== null && remainingPlate <= 0) return true
  return remainingPitches !== null && remainingPitches <= 0
}

/**
 * 진행 중인 판을 판 끝 판정 0xaaa6c 의 순서(실패 한도 → 목표 → 남은 기회)로 다시 잰다 — 정산이 칸을 고친 뒤
 * (낫아웃 보정 a8cfc 등) 판정이 도는 갈래를 위해 내보낸다. 이미 끝난 판은 그대로다.
 */
export function judgePitcherRun(run: PitcherRun, outs: number = run.game.halfEnded ? OUTS_PER_INNING : run.outs): PitcherRun {
  return run.status === '진행중' ? { ...run, status: judgeStatus(run, outs) } : run
}

/**
 * **타석이 안 끝난 공의 판정** — 판정 A 0xae24c 는 공마다 끝(ae374~ae384)에서 모드 5 · 6 이면 0xaaa6c 를 부른다(r4 = 0xf 인 볼 ·
 * 스트라이크도). 차례는 판 끝 판정과 같다: 목표 칸(aac76~aacd6) → 다 찼으면 성공(aace6 → aad20) · 아니면 타석 · 투구 수 한도
 * (aace8~aad1c, R+0x140 ≥ 한도면 실패). 그래서 투구 수를 다 쓰면 타석 도중이라도 실패지만, 그 공으로 목표(MAX게이지)가 다 찼으면 성공이다.
 */
export function checkPitchExhausted(run: PitcherRun): PitcherRun {
  const judged = judgePitcherRun(run)
  return judged.status === run.status ? run : judged
}
