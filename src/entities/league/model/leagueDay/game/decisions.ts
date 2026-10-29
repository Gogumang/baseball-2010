import { REGULATION_LAST_INNING_INDEX, applyPitcherChange, applyRunScored } from '@/entities/game/model/winLossSave'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import type { HalfInningResult } from '@/entities/game/model/simulateHalfInning'

/**
 * 반 이닝 하나 동안의 승·패·세 판정 (S1 확정) — 간이 엔진은 **한 점마다** 득점 처리 `0xa5c34` 를 부르고
 * (0xc0fb4·0xc1054 가 점수 `0xb6a9d` +1 바로 뒤), 투수가 바뀐 다음 타석 첫머리에 세이브 후보 `0xa60c0` 을 부른다
 * (0xc262c 의 0xc26a2). 반 이닝 엔진은 판정에 손대지 않으므로 그 결과(타석마다 들어온 점수와 그때 마운드,
 * 교체 때의 아웃·주자·점수)를 차례대로 다시 밟는다 — 교체는 그 앞까지 들어온 점수(`runsBefore`) 자리에 끼운다.
 *
 * 측(side)은 state 칸이다 — 초 공격 칸 0, 말 공격 칸 1. 등번호 자리에는 투수 칸을 넣는다(경기 끝에서
 * 세이브 투수 = 승리 투수 비교에만 쓰이고, 세이브는 어차피 원본 버그로 안 붙는다).
 */
export function decisionsAfterHalfInning(
  state: DecisionState,
  half: HalfInningResult,
  situation: {
    /** 0-기준 이닝 `state+0x6b` */
    readonly inningIndex: number
    /** 공격 칸 `state[9]` (초 0 · 말 1) */
    readonly offenseSide: number
    /** 이 반 이닝이 시작될 때 칸별 점수 [칸 0, 칸 1] */
    readonly scoresBefore: readonly [number, number]
    /** 공격 팀 마운드(지금은 덕아웃)에 서 있는 투수 칸 — 이 반 이닝 동안 바뀌지 않는다 */
    readonly offenseMoundSlot: number
    /** 수비 팀이 이 반 이닝을 시작할 때의 마운드 칸 */
    readonly defenseMoundSlot: number
  },
): DecisionState {
  const { inningIndex, offenseSide } = situation
  const defenseSide = 1 - offenseSide
  const scores: [number, number] = [situation.scoresBefore[0], situation.scoresBefore[1]]
  const scoreOf = (side: number) => scores[side] ?? 0
  let defenseMound = situation.defenseMoundSlot
  const moundPitcherOf = (side: number) => (side === offenseSide ? situation.offenseMoundSlot : defenseMound)
  let decision = state
  let runs = 0
  const changes = [...(half.pitcherChanges ?? [])]
  const applyChangesUpTo = (runsSoFar: number) => {
    while (changes.length > 0 && (changes[0]?.runsBefore ?? 0) <= runsSoFar) {
      const change = changes.shift()
      if (change === undefined) break
      defenseMound = change.pitcherSlot
      decision = applyPitcherChange(decision, {
        lastInningIndex: REGULATION_LAST_INNING_INDEX,
        inningIndex,
        outs: change.outs,
        defenseSide,
        offenseSide,
        scoreOf,
        moundPitcherOf,
        runnerCount: change.runnerCount,
      })
    }
  }
  for (const appearance of half.plateAppearances) {
    if (appearance.runsBattedIn <= 0) continue
    applyChangesUpTo(runs)
    if (appearance.pitcherSlot !== undefined) defenseMound = appearance.pitcherSlot
    for (let run = 0; run < appearance.runsBattedIn; run += 1) {
      scores[offenseSide] = (scores[offenseSide] ?? 0) + 1
      runs += 1
      decision = applyRunScored(decision, {
        inningIndex,
        lastInningIndex: REGULATION_LAST_INNING_INDEX,
        offenseSide,
        defenseSide,
        scoreOf,
        moundPitcherOf,
      })
    }
  }
  applyChangesUpTo(Number.POSITIVE_INFINITY)
  return decision
}
