/** 아이콘 (타자 4bae6~4bcd4 · 투수 4c00e~4c206) — 그림 · 칸 · 위/아래 화살표 애니 7 · 8 */
import { has } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'
import { skillCategoryOf } from '@/widgets/batting-stage/lib/skillPanel/skillPanelSheet'
import type { SkillPanelDrawSource } from '@/widgets/batting-stage/lib/skillPanel/skillPanelView'
import { BATTER_SIDE, STAGE_HEIGHT, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

const MAX_ICONS = 3

const ICON_STEP = 0xf

export const BATTER_ICON_ORIGIN = { x: STAGE_WIDTH / 2 - 0x14, y: STAGE_HEIGHT - 0x60 } as const

const PITCHER_ICON_OFFSET = { x: -0x14, cpuY: -0x34, humanY: -0x4e } as const

/** 0x93d91 로 도는 애니 7 · 8 의 한 바퀴 — 칸 지연 1 + 2 (animations.json) */
const ARROW_CYCLE = [1, 2] as const

export interface SkillPanelIcon {
  /** game_ui 이미지 번호 */
  readonly image: number
  readonly isUp: boolean
  /** 칸 왼쪽 위 */
  readonly x: number
  readonly y: number
}

/**
 * **0x4b550(장면, 비트, 타자?)** — 아이콘 그림.
 * 타자: 비트 > 21 → 없음 · {10,12,16,19} 75 파워 · {15,17,18} 74 히트 · {20,21} 76 수비.
 * 투수: 표 0xd020c[비트 − 10] (비트 10~22) — 10 · 18 → 81 체력 · 11 · 21 → 79 구속 · 16 · 17 · 20 · 22 → 78 제구 · 19 → 80 변화.
 */
export function skillIconImageOf(bit: number, isBatter: boolean): number {
  if (isBatter) {
    if (bit > 0x15 || bit < 0) return -1
    const mask = 1 << bit
    if (mask & 0x91400) return 0x4b
    if (mask & 0x68000) return 0x4a
    if (mask & 0x300000) return 0x4c
    return -1
  }
  const table: Readonly<Record<number, number>> = { 10: 0x51, 11: 0x4f, 16: 0x4e, 17: 0x4e, 18: 0x51, 19: 0x50, 20: 0x4e, 21: 0x4f, 22: 0x4e }
  return table[bit] ?? -1
}

/** 아이콘 칸 셋 (4bb34~4bc30 · 4c0b0~4c166) — 같은 그림은 한 칸에 모으고, 없는 그림(−1)도 칸은 차지한다 */
export function skillIconSlotsOf(bits: number, isBatter: boolean): readonly { readonly image: number; readonly isUp: boolean }[] {
  const slots: { image: number; isUp: boolean }[] = []
  for (let bit = 23; bit >= 0 && slots.length < MAX_ICONS; bit -= 1) {
    if (!has(bits, bit)) continue
    const image = skillIconImageOf(bit, isBatter)
    const category = skillCategoryOf(bit)
    const isUp = (category & 1) !== 0 || (category & 4) !== 0
    const same = slots.find((slot) => slot.image === image)
    if (same === undefined) {
      slots.push({ image, isUp })
      continue
    }
    if (same.isUp) same.isUp = isUp
  }
  return slots
}

/** 아이콘 그리는 자리 — 그림 > 0 인 칸만, 그릴 때마다 15 위로 */
export function placedIconsOf(
  slots: readonly { readonly image: number; readonly isUp: boolean }[],
  origin: { readonly x: number; readonly y: number },
): readonly SkillPanelIcon[] {
  let y = origin.y
  const icons: SkillPanelIcon[] = []
  for (const slot of slots) {
    if (slot.image <= 0) continue
    icons.push({ image: slot.image, isUp: slot.isUp, x: origin.x, y })
    y -= ICON_STEP
  }
  return icons
}

/** 투수 아이콘 칸 왼쪽 위 — 투수 앵커(표 0xcfb18[+0x17e1]) + (−20, CPU 수비면 −0x34 · 사람이면 −0x4e) (4c00e~4c098) */
export function pitcherIconOriginOf(source: SkillPanelDrawSource): { readonly x: number; readonly y: number } {
  const anchor = stageLayoutOf(source.batterHand === BATTER_SIDE.좌타 ? BATTER_SIDE.좌타 : BATTER_SIDE.우타).pitcherAnchor
  return {
    x: anchor.x + PITCHER_ICON_OFFSET.x,
    y: anchor.y + (source.isDefenseCpu ? PITCHER_ICON_OFFSET.cpuY : PITCHER_ICON_OFFSET.humanY),
  }
}

/**
 * 애니 7 · 8 의 칸 — 두 애니는 경기 장면에 하나씩이고 이 판만 돌린다(그린 뒤 0x93d91 · 0x93cfd(애니, 1)).
 * 처음엔 멈춰 있어(0x938d4) 첫 그림의 진행은 헛돌고, 그 뒤 그림마다 한 칸 — 칸 지연 1 · 2 를 돈다.
 * `draws` 는 경기 장면에서 이 판을 그린 수(이번 그림 앞까지).
 */
export function skillArrowEntryOf(draws: number): number {
  if (draws <= 0) return 0
  const cycle = ARROW_CYCLE[0] + ARROW_CYCLE[1]
  return (draws - 1) % cycle < ARROW_CYCLE[0] ? 0 : 1
}
