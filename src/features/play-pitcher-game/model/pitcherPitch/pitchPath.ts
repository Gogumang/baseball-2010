import { pitchPathOf } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { pitchSpeedStageOf } from '@/entities/pitching/model/pitchSpeedStage'
import { MAGIC_PITCH_TYPE_NUMBER, magicPitchRecordIndexOf } from '@/entities/pitcher-career/model/magicPitch'
import type { MistakeHumanPitchInput, PitcherRepertoire } from '@/features/play-pitcher-game/model/pitcherPitch/types'

/**
 * 마구 구속 단계 · 궤적 레코드 — 원본 그대로:
 * - 구속 rank 0x66d54(66d56): 구질 == 0x16(마구)면 식을 안 거치고 **0** → 0x34968 이 돌려주는 단계 rank/2 도 0
 * - 궤적 준비 0x9e669(9e67c): 구질 == 0x16 이면 공 [+0x18](구속 단계)에 단계 대신 **0** 을 쓴다
 * - 레코드는 단계가 아니라 0x9e944 번호(`magicPitchRecordIndexOf` — 육성 `3(m−1) + 폼/2` · 마투수 `m + 7`)로 곧장 고른다.
 *   CPU `releaseCpuPitch` 와 같은 길이다
 */
const MAGIC_PITCH_SPEED_STAGE = 0

function magicRecordOf(repertoire: PitcherRepertoire): { readonly recordIndex: number } | Record<string, never> {
  const recordIndex = magicPitchRecordIndexOf(repertoire.magicNumber, repertoire.form)
  return recordIndex === null ? {} : { recordIndex }
}

/**
 * 사람 투구의 궤적 레코드를 목표점까지 놓는다 (0x9e669 준비 → 0x9e3c9 곡선) — 구속 단계는 등급 t 로 낸 능력치 배율(`pitchSpeedStageOf`),
 * 마구는 단계 0 · 마구 레코드. `frames` 를 주면 공 점 수를 그것으로 바꾼다(실투 0x9e301). 굴림이 없다.
 */
export function humanPitchPathOf(input: MistakeHumanPitchInput, target: WorldPoint, frames?: number): WorldPoint[] {
  const { typeNumber, stats, repertoire } = input
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  const speedStage = isMagic ? MAGIC_PITCH_SPEED_STAGE : pitchSpeedStageOf(typeNumber - 1, stats, input.grade)
  return pitchPathOf({
    typeNumber,
    form: repertoire.form,
    speedStage,
    target,
    ...(frames === undefined ? {} : { frames }),
    ...(isMagic ? magicRecordOf(repertoire) : {}),
  })
}
