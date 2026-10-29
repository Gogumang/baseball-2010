import { strikeoutRecordIdsOf } from '@/entities/game/model/gameRecords'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import type { HalfInningRun } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import type { RolledPlateAppearance } from '@/entities/game/model/simulateHalfInning/engine/plateAppearance'
import type { HalfInningPitching } from '@/entities/game/model/simulateHalfInning/types/inputs'
import type { HalfInningPlateAppearance } from '@/entities/game/model/simulateHalfInning/types/result'

/** 반 이닝은 3아웃에서 끝난다 */
export const OUTS_PER_INNING = 3

/** 타석이 옮긴 루 — 들어온 점수(3아웃으로 지운 득점 뺌) · 보탠 아웃 · 공 앞 주자 */
export interface AppliedAdvance {
  readonly scored: number
  readonly outsAdded: number
  readonly runnersAtPitch: HalfInningRun['runners']
}

/** 타석 하나의 셈 — 도루 · 공 수 · 안타 · 볼넷 · 삼진(연속 삼진 기록) */
export function applyAppearanceCounts(run: HalfInningRun, appearance: QuickPlateAppearance, before: HalfInningPitching): void {
  const { play } = appearance
  if (appearance.touchesOffenseRecord) run.offenseRecordTouched = true
  // 0xc1a42 — 루를 옮긴 주자마다 (그 주자의 타순 커서)
  for (const cursor of appearance.stolenRunners) {
    run.stolenBases.push({
      battingOrderIndex: cursor,
      ...(run.lineup === undefined ? {} : { rosterSlot: rosterSlotAt(run.lineup, cursor) }),
    })
  }
  run.steals += appearance.steals
  const kind = play.outcome.kind
  run.pitches += play.pitches
  if (kind === '안타' || kind === '홈런') run.hits += 1
  if (kind === '볼넷') run.walks += 1
  if (kind !== '삼진') {
    // 삼진이 아닌 타석이 하나라도 끼면 콤보가 끊긴다
    run.combo = 0
    return
  }
  run.strikeouts += 1
  run.combo += 1
  run.recordIds.push(
    ...strikeoutRecordIdsOf({
      pitches: play.pitches,
      balls: play.balls,
      comboCount: run.combo,
      pitcherStrikeouts: before.strikeouts + run.strikeouts,
    }),
  )
}

/** 루 · 주자 · 아웃 · 점수를 옮긴다 — 3아웃이 되는 순간 들어오던 주자는 득점으로 치지 않는다 */
export function applyAdvance(run: HalfInningRun, appearance: QuickPlateAppearance): AppliedAdvance {
  const advanced = appearance.advance
  const runnersAtPitch = run.runners
  run.bases = advanced.bases
  run.runners = appearance.runners
  run.outs += advanced.outsAdded
  const isThirdOutPlay = run.outs >= OUTS_PER_INNING && advanced.outsAdded > 0
  const scored = isThirdOutPlay ? 0 : advanced.runsScored
  run.runs += scored
  return { scored, outsAdded: advanced.outsAdded, runnersAtPitch }
}

/** 판정은 그대로 두고 **결과만 내보낸다** — 원본이 0xa8024 로 흘려보내는 자리다 */
export function recordPlateAppearance(
  run: HalfInningRun,
  rolled: RolledPlateAppearance,
  scored: number,
  substitutionCalls: number,
): HalfInningPlateAppearance {
  const { play } = rolled.appearance
  const { rosterSlot } = rolled
  const { mound } = run
  const appearance: HalfInningPlateAppearance = {
    battingOrderIndex: run.order,
    outcome: play.outcome,
    runsBattedIn: scored,
    ...(rosterSlot === undefined ? {} : { rosterSlot }),
    ...(mound === undefined ? {} : { pitcherSlot: mound.pitcherSlot }),
    ...(substitutionCalls > 0 ? { substitutionCalls } : {}),
    ...(play.fouled === true ? { fouled: true as const } : {}),
    ...(play.swingingStrikeOutLost === true ? { swingingStrikeOutLost: true as const } : {}),
  }
  run.plateAppearances.push(appearance)
  return appearance
}
