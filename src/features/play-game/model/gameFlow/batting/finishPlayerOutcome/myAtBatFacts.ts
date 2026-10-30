import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { advanceRunners, type BaseState } from '@/entities/game/model/baseState'
import { applyAtBatOutcome, type GameState } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates, type DefensePlayResult } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/otherSlices'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 내 타석 정산 0xa8024 가 보는 판의 사실들 — 계산만 한다(굴림 · 저장 없음) */
export interface MyAtBatFacts {
  readonly nextGame: GameState
  readonly runsBattedIn: number
  /** 정산 [sp+0x30] — 낫아웃이면 삼진 사건이 하나 더 든다 */
  readonly settledOuts: number
  /** 낫아웃(state[0x1a]) — 판 운명을 진루로 먹이는 삼진 */
  readonly droppedThirdStrike: boolean
  readonly isWalkOff: boolean
  /** 타자 게이트 [sp+0x34] — 포스트시즌 · 국가대항전이면 거짓 (`resolveDefensePlay`) */
  readonly isRecorded: boolean
  /** 홈런 수 [sp+0x24] > 0 — 아래 `homeRunCountedOf` */
  readonly homeRunCounted: boolean
  /** 판이 끝난 뒤의 루 — 0xa59c0 의 득점권 아웃이 본다 */
  readonly basesAfterPlay: BaseState
}

/** 판의 진루(수비 진행기를 돈 판) 또는 보통 진루 — 아웃 수와 판 끝 루 */
function playAdvanceOf(progress: GameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null): { outs: number; bases: BaseState } {
  if (defensePlay !== null) return { outs: defensePlay.advance.outsAdded, bases: defensePlay.advance.bases }
  const plain = advanceRunners(progress.game.bases, outcome, progress.game.outs)
  return { outs: plain.outsAdded, bases: plain.bases }
}

/** 수비 진행기를 돈 판이면 살아남은 주자로 신원을 앉힌다 */
function nextGameOf(progress: GameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null): GameState {
  if (defensePlay === null) return applyAtBatOutcome(progress.game, outcome)
  return applyAtBatOutcome(progress.game, outcome, defensePlay.advance, { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) })
}

/**
 * 홈런 수 [sp+0x24] > 0 — 담장을 넘긴 사건 8 은 게이트 없이 센다(a80a8). 장내 홈런 state[0x25] 는 a84d6 이 [sp+0x34] 가
 * 참일 때만 더해, 거짓이면 루타 4 안타로만 적히고 홈런 갈래 a85be~a86b4(레코드 홈런 · 기록 1~4 · 백투백 0xa794c · B0)와
 * a8728 의 타순 칸 홈런 +0x13 · 0xa7b00(12~14)을 건너뛴다. 결과 링은 루타 4(a8704) 그대로라 사이클 · 뒤 타석의 한 타자
 * 홈런 셈(링 코드 4)에는 든다 — 이 경기 기록(`myStats`)의 홈런도 그대로 센다(포스트시즌 레코드 줄은 `withoutRecordLine` 이 뺀다)
 */
function homeRunCountedOf(outcome: AtBatOutcome, defensePlay: DefensePlayResult | null, isRecorded: boolean): boolean {
  if (outcome.kind !== '홈런') return false
  return defensePlay?.groundHomeRun !== true || isRecorded
}

export function myAtBatFactsOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  isRecorded: boolean,
): MyAtBatFacts {
  const nextGame = nextGameOf(progress, outcome, defensePlay)
  const runsBattedIn = nextGame.ourScore - progress.game.ourScore
  const advance = playAdvanceOf(progress, outcome, defensePlay)
  // 낫아웃(state[0x1a]) — 0x3e09e 갈래의 삼진 콜 0xa7c4c 가 사건 5 를 넣고 타자주자 판을 돈다(판 운명을 진루로 먹이는 삼진은
  // 이 갈래뿐이다). 정산 [sp+0x30] 에 그 사건이 판의 아웃 사건 앞에 하나 더 든다 — 0xa59c0 의 아웃(−1 · 병살 G+0x118 ·
  // 득점권 아웃) · 결과비트 B8/B10 · 상대 투수 +0x20(a8cb0, 보정 없음)이 그 값을 본다
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null
  return {
    nextGame,
    runsBattedIn,
    settledOuts: advance.outs + (droppedThirdStrike ? 1 : 0),
    droppedThirdStrike,
    isWalkOff: nextGame.isFinished && runsBattedIn > 0 && nextGame.ourScore > nextGame.opponentScore,
    isRecorded,
    homeRunCounted: homeRunCountedOf(outcome, defensePlay, isRecorded),
    basesAfterPlay: advance.bases,
  }
}
