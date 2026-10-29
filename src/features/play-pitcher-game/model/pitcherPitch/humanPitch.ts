import { aimStartOf } from '@/features/play-pitcher-game/model/pitchAim'
import { applyControlError } from '@/entities/pitching/model/pitchTarget'
import { rollDisplaySpeedKmh } from '@/entities/pitching/model/displaySpeed'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { GAUGE_LAST_CELL } from '@/entities/pitcher-career/model/pitchGauge'
import { MAGIC_PITCH_TYPE_NUMBER, magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import { humanPitchPathOf } from '@/features/play-pitcher-game/model/pitcherPitch/pitchPath'
import { plateOf } from '@/features/play-pitcher-game/model/pitcherPitch/zone'
import type { HumanPitchInput, PitcherRepertoire } from '@/features/play-pitcher-game/model/pitcherPitch/types'

/** 게이지를 안 쓴 공의 그림 칸 = t + 3 (0x4dce0) — CPU 의 `COMPUTER_AIM_OFFSET` 과 같은 줄이다 */
const NON_GAUGE_AIM_OFFSET = 3

/**
 * **제구 흩어짐 반지름을 고르는 그림 칸 `scene+0x17bc`** — 투구 순간 0x4dc78 이 읽는 값.
 *
 * ```
 * 4dcd4: bl 0x3f500 (게이지를 쓰는가 — 수비가 사람 · 설정 +0x2d · 구질 ≠ 22)
 * 4dcde: 쓰면 → 4dcf0 (17bc 는 게이지 커서가 멈춘 칸 그대로)
 * 4dce0: 안 쓰면 → scene+0x17bc ← scene+0x17c0(t) + 3
 * 4dd82: 반지름 = slt_pitch 프레임 min(0x3b + 17bc, 0x43) 의 폭/2,  t == 0 이면 프레임 0x3b 의 폭/2 (4ddb2)
 * ```
 * 게이지 커서(0x4d708)는 t 가 0 인 동안만 틱마다 +1 이고, OK(0x50e08)가 t 를 정하면 멈춘다 — 그래서 게이지로 등급을
 * 정한 공은 17bc = 누른 칸 g(1~9)다. 안 누르고 던지면 t = 0 이라 칸과 상관없이 프레임 0x3b 다.
 *
 * 부르는 쪽은 게이지를 안 쓰면 `gaugeCell` 을 0 으로 넘긴다(투수편·팀 경기·미션 화면 모두). 그래서
 * "마구가 아니고 칸이 1~9" 이면 게이지로 정한 공이고, 그 밖(게이지 끔 · 마구 · 안 누름)은 t + 3 이다.
 * 안 누른 공은 t = 0 이라 어느 칸이든 같은 반지름이므로 이 가름은 원본과 결과가 같다.
 */
function aimCellOf(input: Pick<HumanPitchInput, 'typeNumber' | 'gaugeCell' | 'grade'>): number {
  const pressedGauge = input.typeNumber !== MAGIC_PITCH_TYPE_NUMBER && input.gaugeCell >= 1 && input.gaugeCell <= GAUGE_LAST_CELL
  return pressedGauge ? input.gaugeCell : input.grade + NON_GAUGE_AIM_OFFSET
}

/** 구질 이름 · 변화량 — 일반 구질은 `pitchTypes` 표(없는 번호는 첫 칸), 마구는 번호·폼으로 고른 이름에 변화 0 */
function pitchLookOf(typeNumber: number, repertoire: PitcherRepertoire): Pick<Pitch, 'type' | 'breakOffset'> {
  if (typeNumber === MAGIC_PITCH_TYPE_NUMBER) {
    return { type: magicPitchNameOf(repertoire.magicNumber, repertoire.form) ?? '마구', breakOffset: { x: 0, y: 0 } }
  }
  const type = PITCH_TYPES[typeNumber - 1] ?? PITCH_TYPES[0]
  return { type: type.name, breakOffset: { x: type.horizontalBreak ?? 0, y: type.verticalBreak ?? 0 } }
}

/**
 * 사람 투구 한 개를 만든다 — `entities/pitching/model/selectPitch.selectPitch`(CPU) 와 같은 순서지만
 * 구질·코스·등급을 사람이 정한다는 것만 다르다.
 *
 * 등급 t 가 쓰이는 곳은 원본과 같이 둘뿐이다 (P1 4-2):
 *   ① 능력치 배율 70~110% → 구속 단계 (`pitchSpeedStageOf`)
 *   ② 제구 흩어짐 표 0xcfd60 (`applyControlError`)
 */
export function buildHumanPitch(input: HumanPitchInput, random: RandomPort): Pitch {
  const { typeNumber, stats, repertoire, side } = input
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  const target = input.aim ?? aimStartOf(side)
  // 0x34968(4dcc2) — 표시 구속 [+0x19a0]. 부르는 쪽이 등급(0x4dbac · 게이지)을 정한 **뒤**, 흩어짐 rand(0,100) **앞**이다.
  // 사람 · CPU 를 가르지 않는다 (`displaySpeed`)
  const displaySpeedKmh = rollDisplaySpeedKmh(
    { typeNumber, stats, controlTier: input.grade, magicNumber: repertoire.magicNumber, form: repertoire.form },
    random,
  )
  // 투수 미션의 조준 흔들림(0x39c5c)은 0x10 의 틱마다 이미 지나왔다(`pitchAim.aimTickOf`) — 여기는 놓는 순간
  // 0x4dc78 의 표시 구속 · 제구 흩어짐뿐이다
  const finalTarget = applyControlError(target, { tier: input.grade, isComputer: false, aimIndex: aimCellOf(input) }, random)
  const worldPath = humanPitchPathOf(input, finalTarget)
  const look = pitchLookOf(typeNumber, repertoire)

  return {
    type: look.type,
    plate: plateOf(finalTarget, side),
    breakOffset: look.breakOffset,
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier: input.grade,
    worldPath,
    stageSide: side,
    displaySpeedKmh,
    // 경기+0xfc8 == 0x16 — 0x34be0 의 마구 타이밍 폭 · 이펙트 세 곳이 이 칸으로 연다
    isMagicPitch: isMagic,
  }
}
