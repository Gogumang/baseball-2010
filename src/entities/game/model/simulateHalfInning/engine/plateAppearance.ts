import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickAtBatPitcher, QuickAtBatSituation } from '@/entities/game/model/quickAtBat'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { facingPitcherOf } from '@/entities/game/model/simulateHalfInning/defense/facingPitcher'
import { INTIMIDATE_SKILL_ID, drainQuickPitcher } from '@/entities/game/model/simulateHalfInning/defense/stamina'
import { batterOnOf } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import type { HalfInningInput, HalfInningRun } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import { staminaPercentOf } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning/types/defense'

/** 굴린 타석 하나 — 결과와 그 타석 동안 공마다 깎인 마운드 스태미나 */
export interface RolledPlateAppearance {
  readonly appearance: QuickPlateAppearance
  /** 타석을 친 선수의 로스터 칸 (`offense` 를 넘겼을 때만) */
  readonly rosterSlot: number | undefined
  /** 마지막 공까지 깎은 스태미나 — 공을 안 던졌거나 마운드가 없으면 `undefined` */
  readonly pitchStamina: number | undefined
}

/** 이 타석 동안 공마다 깎이는 스태미나 — 0xc262c 는 공을 던지기 **앞에** 0xa5e14 로 깎는다(c26c8) */
interface PitchDrain {
  stamina: number | undefined
  thrown: number
}

/** 타석 하나를 굴린다 (0xc262c c26be~c271c) — 볼넷 진루 · 도루 · 땅볼 진루는 `playQuickPlateAppearance` 가 먹인다 */
export function rollPlateAppearance(run: HalfInningRun, input: HalfInningInput): RolledPlateAppearance {
  const { defense } = input
  const { mound, order, lineup } = run
  const facing = defense !== undefined && mound !== undefined ? moundPitcherOf(defense, mound, mound.stamina, run.runs) : input.pitcher
  const drain: PitchDrain = { stamina: mound?.stamina, thrown: 0 }
  const rosterSlot = lineup !== undefined ? rosterSlotAt(lineup, order) : undefined
  const appearance = playQuickPlateAppearance(
    {
      batter: batterOnOf(run, input, order),
      pitcher: facing,
      situation: situationOf(run, input),
      bases: run.bases,
      outs: run.outs,
      runners: run.runners,
      batterId: order,
      // 도루 판정의 앞선 주자 주력 — 그 주자 타순 커서에 선 타자(c19a0)
      runnerRunOf: (cursor) => batterOnOf(run, input, cursor).run,
      ...(defense === undefined || mound === undefined ? {} : { beforePitch: () => drainBeforePitch(run, input, defense, mound, drain) }),
    },
    input.random,
  )
  return { appearance, rosterSlot, pitchStamina: drain.stamina }
}

/**
 * 간이 엔진이 보는 투수 체력은 **체력%**(0xaebb0)다 — 0xc1430·0xc183c 가 그 값을 읽는다
 * (P1 3-3). 그래서 마운드가 있으면 능력치 칸 3 대신 살아 있는 체력%를 넘긴다.
 */
function moundPitcherOf(defense: HalfInningDefense, mound: HalfInningMound, stamina: number, runs: number): QuickAtBatPitcher {
  return facingPitcherOf(defense, mound.pitcherSlot, staminaPercentOf(stamina), runs)
}

/** 0xab214 에 넘기는 이 타석의 판 */
function situationOf(run: HalfInningRun, input: HalfInningInput): QuickAtBatSituation {
  const { defense } = input
  const { lineup } = run
  return {
    ...input.swing,
    inning: input.inning,
    // 0xab966 — 수비 점수 > 공격 점수 (반 이닝 시작 리드에서 이 이닝 득점을 뺀다). 수비를 모르면 거짓
    ...(defense === undefined ? {} : { isLosing: defense.lead - run.runs > 0 }),
    // 이 타순 칸의 오늘 타석 결과 링 (0xa908c 가 넣는 팀 객체 + 타순×0x18 + 0x34)
    ...(lineup === undefined ? {} : { recentAtBatCodes: lineup.records[lineupSlotOf(run.order)]?.results ?? [] }),
  }
}

/** 공 하나 앞의 소모 0xa5e14 — 깎은 체력%로 본 마운드 투수를 돌려준다 */
function drainBeforePitch(
  run: HalfInningRun,
  input: HalfInningInput,
  defense: HalfInningDefense,
  mound: HalfInningMound,
  drain: PitchDrain,
): QuickAtBatPitcher {
  const stamina = drainQuickPitcher(
    defense,
    // 투구 수는 타석이 끝나야 더해지므로 이 타석에서 이미 던진 공을 얹어 넘긴다 (`drainMoraleOf` 의 첫 공 판정)
    { ...mound, stamina: drain.stamina ?? mound.stamina, pitches: mound.pitches + drain.thrown },
    1,
    batterOnOf(run, input, run.order).skillIds.includes(INTIMIDATE_SKILL_ID),
  )
  drain.stamina = stamina
  drain.thrown += 1
  return moundPitcherOf(defense, mound, stamina, run.runs)
}
