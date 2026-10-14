import { advancePitcherAnimation, pitcherPoseOf } from '@/pages/special/lib/hallOfFameFigure'
import type { FigureAnimation, HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * **투수편 기본정보 카드의 투수 그림** (0x15e20 투수 갈래 · 앞그림 0x16a34 · 틀 0x142b4, 직접 떴다).
 *
 * ```
 * 진입 0x108f8 (상점 111 · 장비착용 121 · 기본정보 119)
 *   [장면+0x114] = 선수 기록 0x30 바이트 사본 → [gfx+0x148] · 그림 [장면+0xe4] = 0x79369(단일 PZX 투수) → [gfx+0x16c]
 *   0x10810(장면, 사본): 그림 vt+8(그림, 팀 [[장면+0xb0]+1], 폼 rec[0xb]>>4, 피부 rec[0xb] bit2-3, 손 0xb63c1(rec), −1) ·
 *     그림+0x48 = 0 · 0x768b5(장비 칸 비움) · 부위 0~3 니블 n ≥ 1 이면 vt+0x14(그림, 부위, n − 1)
 *     투수 애니 [장면+0x10c]: +0x24 = −1 · +0xc = 폼 · 0x9dff9(애니, 0)
 * 틀 0x142b4 (111 틀 0x14a74 · 121 틀 0x14408 머리, 투수 갈래 0x14374~0x143ea) — t = 상태 틱 [장면+0x2c]
 *   t == 30 이거나 (t ≠ 0 이고 t % 140 == 0) 이면 0x9dff9(애니, 1)(던지기) · [장면+0x108] = 0
 *   애니 상태 1 이고 단계 > 11 이면 [장면+0x108]++ — 늘리기 전 값이 4 를 넘으면 0x9dff9(애니, 0) · [장면+0x108] = 0
 *   애니 vt+8(한 걸음) · 자세 [장면+0x104] = 0x9e0b9(애니)
 * 앞그림 0x16a34: 모드 ≠ 4 이고 상태 0x66 · 0x67 · 0x6f · 0x77 · 0x79 면 0x65e80(skin, &[0x1552ae0], 그림, 자세) —
 *   54×75 이미지에 (27, 62) 로 그림을 떠 둔다(명예의 전당과 같은 함수)
 * 카드 0x15e20 (15ebe~15eec): [0x1552ae0] 을 0x98975(…, 박스 0.x, 박스 0.y − 0x23, −1, 0, 0, 0x10, 2, 1) 로 —
 *   박스 0 은 mode_ui 프레임 0 의 (11, 53, 93, 117) — 타자 갈래가 (x + w/2, y + h − 10) 에 그림을 두는 그 박스다
 * ```
 * 그림 생김새는 사본 니블을 따르므로 장비 창이 줄을 훑으면(0x81938 → vt+0x14) 그 장비를 끼운 채로 그린다.
 */

/** 이미지를 찍는 자리 — (박스 0.x, 박스 0.y − 0x23) · 효과 0x10 · 2 = 정수 두 배 확대(0x15ed4~0x15ede, 시즌 카드 0xaf3e~0xaf48 과 같다) */
export const PITCHER_CARD_IMAGE = { x: 11, y: 53 - 0x23, scale: 2 } as const

const animationOf = (form: number, state: number): FigureAnimation => ({ state, step: 0, count: 0, form })

/** 던지기를 시작하는 틱인가 — 30 이거나 0 이 아닌 140 의 배수 (0x14374~0x14386) */
const startsPitch = (tick: number) => tick === 30 || (tick !== 0 && tick % 0x8c === 0)

/** 상태 틱 `tick`(진입 첫 틀 0) 의 틀이 끝난 뒤 자세 [장면+0x104] */
export function pitcherCardPoseAt(form: number, tick: number): number {
  // 던지기 시작마다 애니와 [장면+0x108] 이 새로 서므로 마지막 시작 틱부터만 굴려도 같다
  const lastStart = tick < 30 ? 0 : tick < 0x8c ? 30 : Math.floor(tick / 0x8c) * 0x8c
  let animation = animationOf(form, 0)
  let hold = 0
  let pose = 0
  for (let t = lastStart; t <= tick; t += 1) {
    if (startsPitch(t)) {
      animation = animationOf(form, 1)
      hold = 0
    }
    if (animation.state === 1 && animation.step > 0xb) {
      const before = hold
      hold += 1
      if (before > 4) {
        animation = animationOf(form, 0)
        hold = 0
      }
    }
    animation = advancePitcherAnimation(animation)
    pose = pitcherPoseOf(animation)
  }
  return pose
}

/** 0x10810 이 그림에 넘기는 값 — 폼 = 2 × 타입 + 손, 팀 = 내 팀, 니블은 부위 0~3(제구 · 구속 · 변화 · 체력 차례) */
export function pitcherCardLookOf(
  career: { readonly typeIndex: number; readonly handIndex: number; readonly skinIndex: number; readonly teamId: number },
  equipmentLevels: PitcherAbility,
): HallOfFameFigureLook {
  const [first, second, third, fourth] = PITCHER_ABILITY_ORDER.map((key) => equipmentLevels[key])
  return {
    form: career.typeIndex * 2 + career.handIndex,
    skin: career.skinIndex,
    team: career.teamId,
    equipment: [first, second, third, fourth],
  }
}
