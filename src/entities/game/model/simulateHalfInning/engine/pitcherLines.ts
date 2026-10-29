import { chargedRunsByPitcher, scoredFromBasesOf, settleRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import type { HalfInningRun } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import type { RolledPlateAppearance } from '@/entities/game/model/simulateHalfInning/engine/plateAppearance'
import type { AppliedAdvance } from '@/entities/game/model/simulateHalfInning/engine/tally'
import type { HalfInningMound, HalfInningPitcherLine } from '@/entities/game/model/simulateHalfInning/types/defense'

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
const MAXIMUM_COUNTER = 99

/**
 * 타석 뒤 수비 쪽 셈 — 투수 줄 · 책임 투수 · 마운드 카운터 (`defense` 를 넘겼을 때만 부른다).
 * 실점은 들어온 주자마다 그 주자를 내보낸 투수(주자+0x30)에게 — 승계 주자는 앞 투수 몫이다 (0xa8ea4~0xa8f36).
 * 간이 엔진 주자는 죽지 않아(0xc0fb4 는 전원을 민다) 루에서 빠진 앞선 주자가 들어온 주자다
 */
export function applyPitcherLines(run: HalfInningRun, mound: HalfInningMound, rolled: RolledPlateAppearance, advance: AppliedAdvance): void {
  const { play } = rolled.appearance
  const { scored } = advance
  const settled = settleRunnerPitchers({
    tags: run.runnerPitchers,
    before: advance.runnersAtPitch,
    after: run.runners,
    batter: run.order,
    pitcher: mound.pitcherSlot,
    scoredFromBases: scoredFromBasesOf(advance.runnersAtPitch, run.runners, scored),
  })
  run.runnerPitchers = settled.tags
  addLine(run, mound.pitcherSlot, {
    outs: advance.outsAdded,
    runsAllowed: 0,
    strikeouts: play.outcome.kind === '삼진' ? 1 : 0,
    pitches: play.pitches,
  })
  for (const [slot, runsCharged] of chargedRunsByPitcher(settled.charged)) {
    addLine(run, slot, { outs: 0, runsAllowed: runsCharged, strikeouts: 0, pitches: 0 })
  }
  run.inningRunsAllowed = Math.min(MAXIMUM_COUNTER, run.inningRunsAllowed + scored)
  run.mound = {
    ...mound,
    // 공마다 이미 깎았다 (`rollPlateAppearance` 의 `beforePitch`)
    stamina: rolled.pitchStamina ?? mound.stamina,
    runsAllowed: Math.min(MAXIMUM_COUNTER, mound.runsAllowed + scored),
    pitches: mound.pitches + play.pitches,
    // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 타석을 하나 치렀으면 반드시 내려가 있다
    justChanged: false,
  }
}

function addLine(run: HalfInningRun, slot: number, add: Omit<HalfInningPitcherLine, 'pitcherSlot'>): void {
  const line = run.lines.get(slot) ?? { pitcherSlot: slot, outs: 0, runsAllowed: 0, strikeouts: 0, pitches: 0 }
  run.lines.set(slot, {
    pitcherSlot: slot,
    outs: line.outs + add.outs,
    runsAllowed: line.runsAllowed + add.runsAllowed,
    strikeouts: line.strikeouts + add.strikeouts,
    pitches: line.pitches + add.pitches,
  })
}
