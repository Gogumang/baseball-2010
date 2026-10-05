import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { foulRecordOf } from '@/entities/game/model/gameRecords'

/**
 * 사람 타석 하나에서 **공마다** 쌓는 것 — 타석 결과(`AtBatState`)에는 남지 않는 두 가지다.
 *
 * - `pitches`: 이 타석에 던진 공 수. 원본은 공이 나갈 때마다(상태 0x11 진입 0x3de10 의 0x3dec6)
 *   `0xa5e14(ctx, 구질)` 를 불러 투수 투구 수(+0x28)·스태미나를 깎는다. 간이 엔진 동료 타석은
 *   gameFlow 가 `play.pitches` 로 같은 일을 하지만, 사람 타석은 이 수가 gameFlow 로 들어오지 않았다.
 *   ⚠️ 스태미나 소모 c 는 **구질**에 달렸다(`pitchStaminaCostOf`, 0x66ef0) — 공 수만으로는 모자라고
 *   공마다의 구질 번호가 더 있어야 한다. 그 번호는 투구를 만드는 쪽(타석 화면)이 들고 있다.
 * - `foulStreak`·`foulRecordIds`: 연속 파울 카운터 ctx+0x15f 와 그로 난 기록 32·33 (`0xa7dbc`,
 *   호출지는 사람 타석 판정 0x51408 의 v=7 갈래 하나). 파울이 아닌 공이 오면 0 으로 끊긴다
 *   (0x3dfac 끝의 0xa5fdc — ⚠️ **유력**, `foulRecordOf` 주석).
 *
 * 타석이 바뀌면 `EMPTY_AT_BAT_PITCH_TALLY` 로 새로 시작한다 — 타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다.
 * 견제는 공이 아니라 `resolvePitch` 를 지나지 않으므로 여기에 들어오지 않는다.
 */
export interface AtBatPitchTally {
  readonly pitches: number
  readonly foulStreak: number
  /** 이 타석에서 난 32·33 — gameFlow `startPlayerOutcome` 의 `foulRecordIds` 로 넘긴다 */
  readonly foulRecordIds: readonly number[]
}

export const EMPTY_AT_BAT_PITCH_TALLY: AtBatPitchTally = { pitches: 0, foulStreak: 0, foulRecordIds: [] }

/** 공 하나를 센다 — 판정이 난 뒤(`resolvePitch` 의 `detail.resolution`)마다 한 번 */
export function tallyPitch(tally: AtBatPitchTally, resolution: PitchResolution): AtBatPitchTally {
  const pitches = tally.pitches + 1
  if (resolution.kind !== '파울') return { ...tally, pitches, foulStreak: 0 }
  const step = foulRecordOf(tally.foulStreak)
  return {
    pitches,
    foulStreak: step.foulStreak,
    foulRecordIds: [...tally.foulRecordIds, ...step.recordIds],
  }
}
