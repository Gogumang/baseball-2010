import type { QuickAtBatBatter, QuickAtBatPitcher, QuickAtBatPlay } from '@/entities/game/model/quickAtBat'
import { recordLineupPlay } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createHalfInningRun, halfInningResultOf } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import type { HalfInningInput, HalfInningRun } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import { applyPitcherLines } from '@/entities/game/model/simulateHalfInning/engine/pitcherLines'
import { rollPlateAppearance } from '@/entities/game/model/simulateHalfInning/engine/plateAppearance'
import { substitutionTicks } from '@/entities/game/model/simulateHalfInning/engine/substitution'
import { OUTS_PER_INNING, applyAdvance, applyAppearanceCounts, recordPlateAppearance } from '@/entities/game/model/simulateHalfInning/engine/tally'
import type { HalfInningDefense } from '@/entities/game/model/simulateHalfInning/types/defense'
import { EMPTY_HALF_INNING_PITCHING } from '@/entities/game/model/simulateHalfInning/types/inputs'
import type { HalfInningHooks, HalfInningPitching, HalfInningSwingContext } from '@/entities/game/model/simulateHalfInning/types/inputs'
import type { HalfInningOffense } from '@/entities/game/model/simulateHalfInning/types/offense'
import type { HalfInningPlateAppearance, HalfInningResult } from '@/entities/game/model/simulateHalfInning/types/result'
import type { HalfInningTick } from '@/entities/game/model/simulateHalfInning/types/tick'

/** 한 이닝이 끝나지 않는 일은 없지만, 판정이 한쪽으로 쏠릴 때를 대비한 안전망 (원본에는 없다) */
const MAXIMUM_BATTERS = 100

export function simulateHalfInning(
  battingOrderIndex: number,
  batterAt: (battingOrderIndex: number) => QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  inning: number,
  random: RandomPort,
  before: HalfInningPitching = EMPTY_HALF_INNING_PITCHING,
  hooks: HalfInningHooks = {},
  defense?: HalfInningDefense,
  offense?: HalfInningOffense,
  swing?: HalfInningSwingContext,
): HalfInningResult {
  const ticks = simulateHalfInningTicks(battingOrderIndex, batterAt, pitcher, inning, random, before, hooks, defense, offense, swing)
  for (;;) {
    const next = ticks.next()
    if (next.done === true) return next.value
  }
}

/**
 * `simulateHalfInning` 의 **틱 단위** 꼴 — 0xc262c 한 번마다 멈춘다(`HalfInningTick`). 끝까지 돌리면 `simulateHalfInning` 과
 * 굴림 · 결과가 한 톨도 다르지 않다(같은 몸통). 자동진행 중계(미션 0x21)가 틱마다 한 번씩 부른다.
 */
export function* simulateHalfInningTicks(
  battingOrderIndex: number,
  batterAt: (battingOrderIndex: number) => QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  inning: number,
  random: RandomPort,
  before: HalfInningPitching = EMPTY_HALF_INNING_PITCHING,
  hooks: HalfInningHooks = {},
  defense?: HalfInningDefense,
  offense?: HalfInningOffense,
  /** 간이 타석이 0xab214 에 넘기는 모드·팀 조작 (`QuickAtBatSituation`). 안 넘기면 '일반' · 양 팀 CPU */
  swing?: HalfInningSwingContext,
): Generator<HalfInningTick, HalfInningResult, void> {
  const input: HalfInningInput = { batterAt, pitcher, inning, random, before, hooks, defense, offense, swing }
  const run = createHalfInningRun(battingOrderIndex, input)
  for (let faced = 0; faced < MAXIMUM_BATTERS && run.outs < OUTS_PER_INNING; faced += 1) {
    if (isStoppedBefore(run, hooks)) {
      run.stoppedBeforeBatter = true
      break
    }
    const substitutionCalls = yield* substitutionTicks(run, input)
    // 0xc262c 한 번 = 이 타석 (한 틱). 경기 끝 · 3아웃 판정은 다음 틱의 0xc2198 이라 굴림이 없다
    yield playPlateAppearanceTick(run, input, substitutionCalls)
    // 0xc2198 c21d6 — 타석 뒤 경기 끝 판정 0xb68fc (3아웃이 된 타석 뒤에도 반 이닝 넘김보다 먼저 본다)
    if (hooks.endsGame?.({ runs: run.runs, outs: run.outs }) === true) {
      run.gameEnded = true
      break
    }
  }
  return halfInningResultOf(run)
}

/**
 * **자동진행이 사람에게 넘기는 자리** — 타석을 열기 앞(대타 · 교체 판정 0xc1ba4 보다 먼저)에 `hooks.stopsBefore` 가 참이면 멈춘다
 */
function isStoppedBefore(run: HalfInningRun, hooks: HalfInningHooks): boolean {
  const { lineup } = run
  return hooks.stopsBefore?.({ battingOrderIndex: run.order, ...(lineup === undefined ? {} : { lineup }) }) === true
}

/** 타석 하나 — 준비(돌발 0x8f158) → 굴림 → 셈 → 끝(돌발 판정 0x8f414) → 수비 셈 → 다음 타순 */
function playPlateAppearanceTick(run: HalfInningRun, input: HalfInningInput, substitutionCalls: number): HalfInningTick {
  const { hooks, defense, before } = input
  // 상태 0xf — 타석 준비. 원본은 여기서 돌발미션 발동을 굴린다 (0x8f158)
  hooks.onAtBatStart?.({
    bases: run.bases,
    outs: run.outs,
    battingOrderIndex: run.order,
    strikeoutsSoFar: before.strikeouts + run.strikeouts,
  })
  const outsBefore = run.outs
  const rolled = rollPlateAppearance(run, input)
  const { play } = rolled.appearance
  applyAppearanceCounts(run, rolled.appearance, before)
  const advance = applyAdvance(run, rolled.appearance)
  const appearance = recordPlateAppearance(run, rolled, advance.scored, substitutionCalls)
  // 타순 칸 기록(안타·홈런·타석) — 다음 CPU 대타 판정이 본다 (0xa8024)
  if (run.lineup !== undefined) run.lineup = recordLineupPlay(run.lineup, run.order, play.outcome, { quickEngine: true })
  // 타석이 끝나는 자리 — 원본은 여기서 돌발 결과비트로 판정한다 (0x8f414)
  hooks.onAtBatEnd?.({
    outcome: play.outcome,
    runsBattedIn: advance.scored,
    outsBefore,
    outsAdded: advance.outsAdded,
    inningEnded: run.outs >= OUTS_PER_INNING,
  })
  if (defense !== undefined && run.mound !== undefined) applyPitcherLines(run, run.mound, rolled, advance)
  // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c) — 다음 타석은 다시 대타를 묻는다
  if (run.pinchHitUsed !== undefined) run.pinchHitUsed = false
  run.order += 1
  return plateAppearanceTickOf(run, appearance, play)
}

/** 타석 틱 — 방금 친 타자의 타순 커서와 그때 명단 · 마운드 · 아웃 · 카운트 */
function plateAppearanceTickOf(run: HalfInningRun, appearance: HalfInningPlateAppearance, play: QuickAtBatPlay): HalfInningTick {
  const { lineup, mound } = run
  return {
    kind: 'plateAppearance',
    appearance,
    strikes: play.strikes,
    balls: play.balls,
    battingOrderIndex: run.order - 1,
    ...(lineup === undefined ? {} : { lineup }),
    ...(mound === undefined ? {} : { pitcherSlot: mound.pitcherSlot }),
    outs: run.outs,
  }
}
